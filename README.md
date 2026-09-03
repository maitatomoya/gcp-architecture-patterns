# GCP Architecture Patterns

「どんなサービスに、どんなGCP構成を組むか」をケーススタディ形式で学ぶ学習Webサービス。

各ケースで、要件の整理→推奨アーキテクチャ（構成図）→各サービスの役割→
設計の工夫点→メリット・デメリット→代替パターン→公式ドキュメント、の流れで
「アーキテクチャを選ぶ力」を鍛える。

## 特徴

- 構成図は画像ではなくJSON仕様（nodes/groups/edges）から`diagram.js`がSVGを動的生成。
  機械検証・修正がしやすい
- GCP公式アイコンは再配布条件の関係で同梱せず、各サービスを
  「カテゴリ色の角丸ボックス＋略称」で描画する（凡例は「はじめに」に掲載）
- 依存パッケージなしの静的サイト。ビルド不要

## 起動方法

```bash
node server.js
```

http://localhost:3949 で開く。

## 構成

```
server.js              ローカル開発用の静的配信サーバー
public/
  index.html
  app.js               ケース表示UI
  diagram.js           JSON→SVG構成図レンダラー（カテゴリ色・略称のカタログもここ）
  styles.css
  content/
    intro.js           はじめに（構成図の読み方・選定の軸・色の凡例）
    resources.js       参考資料リスト（Google Cloud公式リンク集）
    glossary.js        用語集
    caseNN.js          各ケースの教材データ（case01〜case50）
scripts/
  validate.js          教材データの機械検証（必須フィールド・図の構造・幾何チェック）
  check-headers.js     グループヘッダーの衝突チェック
```

## 教材データの検証

```bash
node scripts/validate.js        # 全ケース検証
node scripts/check-headers.js   # ヘッダー衝突チェック
```

ケース教材の書き方は`.tmp/content-spec.md`、50ケースの一覧は`.tmp/case-list.md`を参照。
