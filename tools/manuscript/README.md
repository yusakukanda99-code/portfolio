# 原稿マスターの生成

`index.html` を正として、原稿マスター（docx）を書き出します。
docx は生成物です。直接編集せず、サイトを直してから流し直してください。

## 使い方

```bash
cd tools/manuscript
npm i -D playwright gsap          # 初回のみ
pip install python-docx           # 初回のみ
node dump.mjs                     # サイトを読んで site.json を作る
python3 genmaster.py              # site.json から docx を作る
python3 genmaster.py ~/Desktop/原稿.docx   # 出力先を指定する場合
```

`CHROME_PATH` を指定すると、その Chromium / Chrome を使います。
`node_modules/gsap` があれば CDN の代わりにそれを読み込みます（オフラインでも動く）。

## 出力の構成

1. 共通部分 — ヒーロー／コンセプト図／プロジェクトカード／About／フッター
2. ケース詳細 — PROJECT 01〜06、Context → Judgment → Evidence → Result
3. All Works — プロジェクトごとに全件
4. 本文に拾われていない固定文言 — ナビ・ボタン・セクションラベルなど

4 は差分確認用です。ここが増えていたら、原稿として管理すべき文言が
サイトに追加されたという合図になります。生成スクリプト側で拾い先を
決めてやると、次回から 1〜3 に入ります。

## 仕組み

`CASES` `WORKS` `CASE_META` はページ内の定数をそのまま読んでいます。
PROJECT 02（c01）だけは作り込んだ直書き DOM なので、`dump.mjs` の中で
他ケースと同じ形（context / judgment / evidence / result）に組み直しています。
サイト側のクラス名を変えたときは `dump.mjs` のセレクタも直してください。
