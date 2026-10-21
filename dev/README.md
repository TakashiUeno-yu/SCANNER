# dev（開発用。公開アプリの動作には不要）

- `decoder/`：合成シンボル（CC-A／CC-B）デコーダ `cc-core.js`・`tables.js` と、Node でのテスト土台 `harness.mjs`・写真風画像生成 `mkphotos.mjs`。`npm install` 後に使う。パターン表は BWIPP（MIT, Terry Burton）の micropdf417 / gs1-cc から抽出。アプリ本体には `src/scanner.html` の `<!--CC-BEGIN-->`〜`<!--CC-END-->` に同じものが入っている。
- `test/`：Playwright で画面を撮るスクリプト。パス（/home/claude/… など）は作ったときの Claude 側の環境のままなので、使うときは書き換える。
