# Yusaku Kanda — Portfolio

神田有作のポートフォリオサイト。単一HTML＋画像アセットの静的サイトです。

## 構成

```
├── index.html            # サイト本体（HTML / CSS / JS すべて内包）
├── assets/
│   └── img/
│       ├── kanda_yusaku.webp   # プロフィール写真
│       └── works/              # 制作物画像（All Works・スライダー・詳細で使用）
└── README.md
```

## 公開（GitHub Pages）

1. このリポジトリを GitHub に push
2. Settings → Pages → Branch を `main` / `(root)` に設定
3. 数分後、`https://<ユーザー名>.github.io/<リポジトリ名>/` で公開

## 依存

- GSAP 3.12.5 / ScrollTrigger（cdnjs から読み込み）
- フォント：Inter・Noto Sans JP（Google Fonts）

ビルド工程はありません。ファイルを差し替えるだけで更新できます。
