# SCANNER 開発ノウハウ（2026-10-21 クローズ）

広告の増えた ICONIT の代わりに作った、iPhone 用のバーコード／QR リーダー Web アプリ「SCANNER」（旧名 スキャン帳）の開発で分かったことのまとめ。経緯の詳細は `HANDOFF.md`。

---

## 1. 最終構成

| 項目 | 内容 |
| --- | --- |
| 公開アドレス | https://takashiueno-yu.github.io/SCANNER/ （**大文字・小文字を区別**。`/scanner/` は 404） |
| リポジトリ | https://github.com/TakashiUeno-yu/SCANNER （Public、main の /(root)。旧名 scan-cho） |
| 最終版 | v18（元ソース `src/scanner.html`。公開用 index.html は `tools/build_pages.py` で生成、ハッシュ 908822b3…）。2026-10-22 ホーム画面アイコンを新デザインに |
| リポジトリの構成 | 直下＝公開ファイル（`index.html`・`zxing_reader.wasm`・`apple-touch-icon.png`・`icon-512.png`・`manifest.webmanifest`・`README.md`）、`src/`＝元ソース、`tools/`＝生成スクリプト、`icons/`＝アイコン原図、`manual/`＝手順書の元、`notes/`＝このノウハウ、`dev/`＝デコーダ開発・テスト。**リポジトリが正本**（2026-10-22〜） |
| Artifact 版 | https://claude.ai/artifact/3Qvh5hZqFU9Lgm2pvyHsQ9 （v18。カメラの連続読み取りは不可、動作確認用） |
| 使用手順書 | `SCANNER_使用手順書_v6.pdf`（A4・8ページ、PC の `C:\claude\2026-10_iphone-apps\`）。元は `manual/` |
| 開発ソース | リポジトリの `manual/`・`dev/`・`tools/`（旧 `SCANNER_開発ソース_v1.zip` の中身） |

---

## 2. 技術構成

- **1ファイル完結の HTML**（CSS・JS 内蔵）。ビルド不要。GitHub 用は先頭に head（アイコン・manifest・ホーム画面名）を付けるだけ（`tools/build_pages.py`）。
- 読み取りエンジンは2段構え。
  - 1段目：`@zxing/library@0.21.3`（JS 版）。
  - 2段目：読めないときに `zxing-wasm@2.2.4`（zxing-cpp の WebAssembly 版）を使う。
- wasm は `zxing_reader.wasm` を同じ場所に置き、`prepareZXingModule({overrides:{locateFile:…}})` で読み込み先を指定する。同梱ファイルを取れないときは jsDelivr に切り替える。
- 合成シンボル（期限・ロット）は**自作デコーダ**（HTML 内 `<!--CC-BEGIN-->`〜`<!--CC-END-->`）。
- 保存先
  - 履歴：localStorage `scancho.history.v1`（最大300件）
  - 医薬品マスター：IndexedDB（"medhot"＝医薬品コード、"hot"＝HOT）

---

## 3. 読み取りのノウハウ

### ライブラリの得手不得手

- JS 版 ZXing は **GS1 DataBar 限定型（PTP シート・輸液バッグ）が読めない**。zxing-wasm は読める。
- JS 版 ZXing の DataBar 拡張型は重く、ライブラリ自身も「本番向けでない」としているので外した。拡張型は zxing-wasm で読む。
- 無料ライブラリはどれも**合成シンボル（CC-A／CC-B）に非対応**（zxing-wasm 3.1.x を含む）。期限 (17)・ロット (10) を読むには自作が必要だった。

### 合成シンボル自作デコーダの要点

1. zxing-wasm で直線部（DataBar・GS1-128）の位置を取る
2. バーの向きを推定する（勾配・構造テンソル）
3. 直線部の上を走査して、行パターン（RAP）とコードワードを判定する
4. GF(929) の RS 誤り訂正をかける
5. GS1 汎用ビット列（方式 10／0）を復号する

- パターン表と行構成は、BWIPP（bwip-js 同梱の barcode.ps、MIT）から抽出した。
- **実写真で効いた対策**
  - トナーのにじみでできる 0.2 モジュール程度の細い偽ランを、前後のランと統合する。
  - 推定した向きが 2〜3° ずれると、走査線が行をまたぐ。zxing の向きと勾配の向きを中心に、±6° を 0.8° 刻みで試す。
  - 写真に複数のバーコードがあるときは、読めた GTIN と同じ直線部の上だけを探す（取り違え防止）。
- 未対応：CC-C、方式 11（AI 90）。

### 連続読み取り（カメラ）

- 誤読対策として、**同じ結果が2コマ続いたら確定**。
- 確定直後の最大3コマ（150ms 間隔）で合成シンボルを探し、見つかれば期限・ロット付きで結果画面へ進む。
- 2D 部分の解像度を確保するため、カメラは 1920×1080（ideal）で取る。
- 画面が隠れたら（visibilitychange）カメラを解放し、戻ったら自動で再開する。iOS が track を止めたときも開き直す。
- iPhone で映像が小さく右下に出る件は、video を枠に `position:absolute; inset:0; object-fit:cover` で置いて直した。

### 撮影・写真から読むときの再試行順

サイズ違い（2400／1400／3200px）→ 白黒反転 → ±8°・±15° 回転。

---

## 4. 医薬品マスター（MEDIS）

### 使うファイル

- **主マスター**：「医薬品コード」全件 CSV の「調剤包装単位・販売包装単位・元梱包装単位コードファイル（ZIP）」
  - URL：`https://medhot.medd.jp/csv/A_<前月末日>_2.zip`（例 `A_20260930_2.zip`、約 1.6MB、Shift_JIS）
  - 調剤包装（先頭0）・販売包装（1）・元梱（2）の3種の GTIN をすべて引ける（2026-09-30 版で 56,942 品目、コード 129,396 件）。
- **HOT コードマスター**（任意）：販売包装単位コード付版 `h<年月日>_h.zip`（`https://www2.medis.or.jp/hcode/moto_data/`）。HOT13 の表示用。
  - **調剤包装単位のコードが無く、JAN 列も空**なので、これだけでは PTP シート・アンプルの名前が出ない（主マスターを全件ファイルに替えた理由）。

### 取得方法

- MEDIS のサーバーは CORS を許可していないので、アプリから直接は取れない。
- 「① ダウンロード」（前月末日の URL をアプリが作る）→ Safari の「ダウンロード」に保存 →「② 読み込む」で選ぶ、の2タップにした。zip のまま読み込める（ブラウザ内で展開し、Shift_JIS を読む）。
- 月初めで前月分がまだ公開されていないときは 404 になる。

### 再配布しない

- MEDIS のサイトに再配布可の記載が無いので、GitHub・代理サーバーには置かない。データは各端末の中だけに保存する。

### 医療用医薬品の判定ルール

日薬連「医療用医薬品へのバーコード表示」2023 に準拠。

| 判定 | 条件 |
| --- | --- |
| 医療用医薬品 | マスターに載っている、または GTIN-14 の先頭3桁が 049・149・249・045・145・245 |
| インストアコード | 先頭1桁を除いた番号が 2 で始まる（古書店の値札など） |
| GS1 商品コード | 上のどちらでもない 14 桁の GS1 コード（PMDA リンクは出さない） |

- 145… は医療用ガス会社や新しい製薬会社（事業者コード 45）。HOT 2026-09 版で 2,031 件。
- 包装単位とバーコードの種類が表示ルールと合わないときは、読み違いの可能性として注意を出す。
  - 元梱は GS1-128。
  - 調剤・販売は DataBar。販売包装は期限・ロットが必須。

---

## 5. PMDA へのリンク（GTIN 直リンク）

- 電子添文：`https://www.pmda.go.jp/PmdaSearch/bookSearch/01/{GTIN14}`
- 関連文書：`https://www.pmda.go.jp/PmdaSearch/rdSearch/01/{GTIN14}?user=1`（医療関係者向け）／`?user=2`（一般向け）
- 出典：https://www.pmda.go.jp/files/000268389.pdf 。電子添文の著作権は製造販売業者にある。

---

## 6. iPhone・Safari でハマった点

| 現象 | 原因・対処 |
| --- | --- |
| Artifact 内で連続読み取りが動かない | Artifact の枠がカメラ（getUserMedia）を許可しない。GitHub Pages など自前の https に置く |
| 起動するたびにカメラの許可を聞かれる | ホーム画面アプリの iOS 側の仕様で、アプリ内からは記録できない。**設定 → アプリ → Safari → カメラ →「許可」**で解消 |
| ホーム画面への追加の場所 | 最近の Safari は、画面下のアドレスバー左の **≡ → 共有 → ホーム画面に追加** |
| ホーム画面の名前 | `apple-mobile-web-app-title` と manifest の name。変えたらアイコンを追加し直す |
| 連続読み取り→結果画面で「サイトを開く」と、カメラ使用中の緑の点が消えずに出続ける（v18） | トラックを stop しても video が srcObject を持ったままだと、iOS がカメラを手放すのに時間がかかり、その間にアプリ内ブラウザへ移ると残る。stopLive で `video.pause(); video.srcObject=null` まで行い、リンクを押したときも stopLive を呼ぶ。getUserMedia の待ち中に止められたら、取れたカメラをすぐ閉じる（v19） |
| ホーム画面アプリからリンクを開くと、アプリ内のブラウザ（右下にコンパス）で開く | `target=_blank` はアプリ内表示になる仕様。普通の Safari で開くには `x-safari-https://…` に移動する（iOS 17 以降）。v20 で「サイトを開く」「Googleで検索」「Amazon」「Yahoo!」に適用、PMDA はアプリ内のまま。1.5 秒たっても切り替わらなければ、そのボタンは次からアプリ内で開く |
| ホーム画面のアイコンを変えたのに前のまま | iOS は追加したときのアイコンを持ち続ける。ホーム画面から削除して追加し直す（同じアドレスなら履歴・マスターは残る） |
| アプリを更新したのに前のまま | アプリ切り替え画面で上にスワイプして完全に閉じ、開き直す |
| Artifact 版と GitHub 版で履歴・マスターが別 | 保存場所（オリジン）が別。それぞれで読み込みが必要 |
| アドレスを変えると履歴・マスターが消える | ホーム画面アプリは追加し直すと保存領域が新しくなる。リポジトリ名の変更＝アドレスの変更なので要注意 |
| リポジトリ名の変更で古いアドレスが 404 | GitHub Pages は旧アドレスから転送しない（git のリモートだけ転送される） |
| 見出しが2行に折れる | `text-wrap:balance` と flex の組み合わせ。h1 を `white-space:nowrap; flex:0 0 auto` に |
| `[hidden]` が効かない | CSS で display を指定すると負ける。`[hidden]{display:none!important}` を入れる |

---

## 7. GitHub Pages の更新手順（2026-10-22〜 リポジトリが正本）

PC の作業用の複製は `C:\claude\2026-10_iphone-apps\SCANNER\`（git clone）。版ごとのフォルダ（`github-pages_vN\`）は作らない。

1. `git pull` で最新にする
2. `src/scanner.html` を直す（Artifact 版で確認するときは、このファイルをそのまま Artifact に公開する）
3. `python tools/build_pages.py` で直下の `index.html` を作り直す（`--check` で一致確認だけ）
4. 日本語のメッセージでコミットし、`git push`。版を上げたら `git tag v19` のようにタグを付けて `git push --tags`
5. 1〜2分で公開ページに反映される。**公開版のハッシュ**が手元と一致するか確認する

- push は Claude が PC 側のシェルで行う。認証は SCANNER 専用の Fine-grained トークン（Contents: Read and write）を `C:\claude\_secrets\github_scanner_token.txt` に置き、push のときだけ `http.extraHeader` で渡す（.git の設定には書かない）。期限が切れたら作り直す。
- トークンが使えないときは、従来どおり https://github.com/TakashiUeno-yu/SCANNER/upload/main にファイルをドラッグ → 緑の「Commit changes」（押し忘れると反映されない）。ブラウザ経由でも画像のバイト列は変わらない（2026-10-22 確認）。
- PC 側のシェルで connected フォルダの中の git を使うには、そのセッションでファイル削除の許可が要る（git が自分の .lock を消すため）。
- Claude のクラウド環境と PC 側のシェルからは github.io に接続できない（プロキシで拒否される）。確認はアプリ内ブラウザで `fetch` → `crypto.subtle.digest` で行う。github.com（git）と api.github.com はアプリ内ブラウザ・PC 側シェルから使える。
- デプロイの完了は GitHub API（`/repos/TakashiUeno-yu/SCANNER/actions/runs` の「pages build and deployment」）で見られる。完了前に取ると古いファイルが返る。

---

## 8. ロゴ（7セグ＋14セグ）

- 「SCANNER」を SVG の多角形で描き、h1 に直接埋め込んでいる。生成は `tools/logo_gen.py`（旧 logo_gen_v2.py。引数：N・R の幅 48、斜め線の太さ 0.75、K 0.3、出力先）。
- S・C・A・E は7セグ。N・R だけ14セグ風で、文字幅を 48 に広げている（ほかは 40）。斜め線が立ちすぎないようにするため。
- N の上下の斜め線は、**文字の中心を通る1本の帯**を、上下のセルの内側の長方形で切ったもの。これで同一直線になり、段差が出ない。
- 斜め線の端は、縦切りと横切りの両方。外側の端は横が長く、中央側の端は縦が長い（約 2:1）。
- R の斜め線は、N の下側と同じ形を T/2 だけ下にずらしたもの。
- 消えているセグメント（灰色）は描かない。色は文字色（ダークモードでは白）。8°の斜体。
- 既存作品のロゴそのものは再現しない。7セグ・14セグという一般的な表示形式でオマージュした。

---

## 9. 使用手順書の作り方

- 元は markdown（`manual/manual.md`、旧名 scan-cho_manual.md）。`manual/build.py` で `[[FIG a.png|説明;;b.png|説明]]` を図の横並びに変換して HTML にし、Playwright（Chromium）の `page.pdf` で A4 PDF にする。フォントは Noto Sans CJK JP。
- iPhone のスクリーンショット（750×1334）は、**上 40px（ステータスバー）を切る**。
- 手書きの赤線は、赤い画素を検出して背景色で塗りつぶして消した。
- 1枚だけの図は `.shots.one` で幅 60% にする。見出しと表が泣き別れしないよう、`p:has(+table){break-after:avoid}` を入れた。

---

## 10. テストの方法

- Playwright＋headless Chromium で、ページの読み込み・読み取り・画面撮影を自動化した。CDN は `page.route` でローカルファイルに差し替えた。
- 連続読み取りは、仮想カメラ（`--use-file-for-fake-video-capture=…y4m`）で再現した。
- 合成シンボルは、bwip-js で作った画像にランダムな値を入れて往復テストした（60/60）。縮小・回転・透視・円柱ゆがみ・ぼけ・JPEG・白黒反転を加えて確認している。
- **日本語のファイル名は `setInputFiles` で読み込まれない**ので、英字の名前にコピーして渡した。
- 最後は必ず iPhone 実機で確認する（PC では見えない問題が多い。例：映像の位置、カメラの許可、ホーム画面の名前）。

---

## 11. 進め方の教訓

- 版ごとに新しいファイル名（`_vN`）にする。PC に書き戻したらハッシュで一致を確認する。
- 公開も「アップした」ではなく、公開版のハッシュで確認する。
- 名前・アドレスの変更は、ホーム画面アプリでは「入れ直し＋データ消失」になる。早めに決めるほうがよい。
- マスターのような第三者データは、再配布にならない方式（端末内に取り込む）を最初に選ぶ。

---

## 12. 残っている課題（必要になったら）

- CC-C（GS1-128 の上の大きい合成シンボル）は未対応。GS1-128 は実物ラベルでの確認が不十分。
- 手順書の第4章（スクロール後の結果）と第6章（サイズ計測）の図は、PC で撮ったもの。
- Claude Docs 版の手順書（https://claude.ai/artifact/QcmZXvPSxugsvLMMP2VvdG ）は、旧名・旧アドレスのまま（PDF の v6 が最新）。
- マスターは月1回、①→②で更新する。
