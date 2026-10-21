# SCANNER

広告なしのバーコード／QR リーダー（自分用の Web アプリ）。読み取りはすべて端末の中で行い、どこにも送信しません。

- 対応：JAN/EAN・UPC・Code128・Code39・ITF・NW-7・GS1 DataBar（標準型・限定型・拡張型）・GS1-128・QR・Data Matrix・PDF417 など
- 医薬品の GS1 コードから PMDA の電子添文・関連文書を開けます（電子添文の著作権は各製造販売業者にあります）
- 合成シンボル（CC-A／CC-B）から使用期限・ロットを読みます
- iPhone の Safari で開き、「ホーム画面に追加」で使います

使用ライブラリ：@zxing/library 0.21.3（Apache-2.0）、zxing-wasm 2.2.4（MIT）。合成シンボルのパターン表は BWIPP（MIT, Terry Burton）から抽出。

## リポジトリの構成

| 場所 | 中身 |
| --- | --- |
| 直下 | 公開ファイル（GitHub Pages で https://takashiueno-yu.github.io/SCANNER/ に出る） |
| `src/scanner.html` | 元ソース。直下の `index.html` は `python tools/build_pages.py` で作る（直接は直さない） |
| `tools/` | `build_pages.py`（index.html の生成）、`logo_gen.py`（ロゴ SVG の生成） |
| `icons/` | アイコンの原図（SVG・1024px） |
| `manual/` | 使用手順書の元（markdown・図・PDF 化スクリプト） |
| `notes/KNOWHOW.md` | 開発ノウハウ・ハマりどころ |
| `dev/` | 合成シンボルデコーダの開発土台とテスト用スクリプト |

医薬品マスター（MEDIS のデータ）は再配布しないため、このリポジトリには置きません。各端末でアプリから取り込みます。
