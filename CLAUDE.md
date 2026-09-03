# GCP Architecture Patterns 開発ルール

「どんなサービスにどんなGCP構成を組むか」をケーススタディ形式で学ぶ学習Webサービス。
設計の詳細は`.tmp/design.md`、ケース教材の書き方は`.tmp/content-spec.md`を参照
（いずれもローカル作業用・Git管理外）。

## 起動方法

```bash
node server.js
```

http://localhost:3949 で開く。ビルド不要・依存パッケージなしの静的サイト。

## 【必須】ブラウザでの実表示確認（スキップ禁止）

図・UI・コンテンツに変更を入れたら、**必ずブラウザで実表示を確認してから完了とする**。
コードを読むだけ・エディタ上の確認だけで完了にしてはいけない。

確認観点：
- ラベル同士・ラベルとノードボックスの**重なり**
- グループ枠からの**はみ出し・見切れ**
- 矢印（エッジ）が他ノードのボックスを**貫通**していないか
- エッジラベルが線と交差して読めなくなっていないか
- 狭い画面（800px以下）でのレイアウト崩れ

確認はスクリーンショットを撮って目視すること。

## 【必須】各アーキテクチャの公式参考文献

各アーキテクチャ（推奨・代替パターンとも）の最後に、必ず公式ドキュメントへの
リンクを`references`として載せる：

```js
references: [
  { title: "リンクの日本語タイトル", url: "https://cloud.google.com/...?hl=ja", note: "補足（任意）" }
]
```

- Google公式（cloud.google.com / firebase.google.com / developers.google.com）を優先。
  日本語版（?hl=ja）があれば日本語版
- 追加時に`curl`等でHTTP 200を確認する（デッドリンク禁止）

## 教材データの書き方

- ケースは`public/content/caseNN.js`に1ファイル1ケースで`registerCase({...})`
- 構成図はJSON仕様（nodes/groups/edges、グリッド座標）→ `public/diagram.js`が描画
- GCP公式アイコンは同梱していない。ノードの`icon`は「カテゴリ/スラッグ」形式
  （例：`compute/cloud-run`）で、`diagram.js`の`SERVICE_ABBR`に登録済みのものだけ使う
- 作図の正確性ルールとレイアウトルール（エッジの貫通禁止・ラベル中点の重複禁止）は
  `.tmp/design.md`と`.tmp/content-spec.md`参照
- 書いたら必ず`node --check`と`node scripts/validate.js`、`node scripts/check-headers.js`で検証

## コード規約

- コメント・ドキュメントは日本語、絵文字不使用
- 依存パッケージを増やさない（フレームワーク・ビルドツール不使用）
- コミット・プッシュはユーザーの明示的な許可を得てから。masterへの直接コミット禁止（PR経由）
