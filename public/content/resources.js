// 参考資料リスト：Google Cloud公式のパターン集・設計資料へのリンク集
// 掲載URLは追加時にHTTP 200を確認すること（品質ルール）
registerResources({
  tocTitle: "参考資料リスト",
  content: `<h2>参考資料リスト：公式のパターン集と設計資料</h2>
<p>この教材の50ケースは入口にすぎません。実際の設計では、Google Cloudが公式に公開している
パターン集・リファレンスアーキテクチャを引ける力が武器になります。ここでは
「次にどこを見ればよいか」を用途別に整理します。<strong>すべてGoogle Cloud公式の資料</strong>です。</p>

<h3>パターン・構成図を探す</h3>
<table>
<tr><th>資料</th><th>内容</th><th>こういうときに見る</th></tr>
<tr>
<td><a href="https://cloud.google.com/architecture?hl=ja" target="_blank" rel="noopener noreferrer">Cloud Architecture Center</a></td>
<td>公式の総合ハブ。リファレンスアーキテクチャ・設計ガイド・ベストプラクティスがここに集約されている</td>
<td>まず最初にブックマークする場所。迷ったらここから辿る</td>
</tr>
<tr>
<td><a href="https://cloud.google.com/architecture/all-jss-guides?hl=ja" target="_blank" rel="noopener noreferrer">Jump Start Solutions</a></td>
<td>代表的な構成（3層Webアプリ・データ分析基盤など）を、Terraformでそのままデプロイできる形で提供する公式ソリューション集</td>
<td>「定石構成を実際に手元で動かして学びたい」とき。この教材のケースの次の一歩に最適</td>
</tr>
<tr>
<td><a href="https://cloud.google.com/architecture/hybrid-multicloud-patterns?hl=ja" target="_blank" rel="noopener noreferrer">ハイブリッド・マルチクラウドのパターン集</a></td>
<td>オンプレ併用やマルチクラウドのアーキテクチャパターンを体系的に解説した公式ドキュメント</td>
<td>ケース33〜34のような接続・移行案件を深掘りしたいとき</td>
</tr>
<tr>
<td><a href="https://cloud.google.com/solutions?hl=ja" target="_blank" rel="noopener noreferrer">ソリューションカタログ</a></td>
<td>業種・ユースケース別のソリューション紹介。事例や関連資料へのリンクつき</td>
<td>「この業種の定石が知りたい」とき</td>
</tr>
</table>

<h3>設計の考え方を学ぶ</h3>
<table>
<tr><th>資料</th><th>内容</th><th>こういうときに見る</th></tr>
<tr>
<td><a href="https://cloud.google.com/architecture/framework?hl=ja" target="_blank" rel="noopener noreferrer">Google Cloud Architecture Framework</a></td>
<td>運用効率・セキュリティ・信頼性・コスト最適化・パフォーマンスの5本柱で設計を評価する公式フレームワーク。AWSのWell-Architectedに相当</td>
<td>設計レビューの観点が欲しいとき。面接や試験でも頻出の考え方</td>
</tr>
<tr>
<td><a href="https://cloud.google.com/docs/enterprise/best-practices-for-enterprise-organizations?hl=ja" target="_blank" rel="noopener noreferrer">企業向けベストプラクティス</a></td>
<td>組織・プロジェクト設計、IAM、ネットワーク、請求管理など、企業導入時の設計指針を網羅した公式ガイド</td>
<td>ケース37のようなマルチプロジェクト統制を実務に落とすとき</td>
</tr>
<tr>
<td><a href="https://cloud.google.com/architecture/landing-zones?hl=ja" target="_blank" rel="noopener noreferrer">ランディングゾーンの設計</a></td>
<td>組織として最初に整えるべき土台（ID・リソース階層・ネットワーク・セキュリティ）の設計手順</td>
<td>会社としてGCPを本格導入する準備をするとき</td>
</tr>
</table>

<h3>手を動かす・調べる</h3>
<table>
<tr><th>資料</th><th>内容</th><th>こういうときに見る</th></tr>
<tr>
<td><a href="https://cloud.google.com/docs?hl=ja" target="_blank" rel="noopener noreferrer">Google Cloudドキュメント</a></td>
<td>全サービスの公式ドキュメントの入口</td>
<td>各ケースのreferencesから深掘りするとき</td>
</tr>
<tr>
<td><a href="https://cloud.google.com/products/calculator?hl=ja" target="_blank" rel="noopener noreferrer">料金計算ツール</a></td>
<td>構成を入力して月額を見積もる公式ツール</td>
<td>ケースの「費用感の目安」を自分の規模で計算し直すとき</td>
</tr>
<tr>
<td><a href="https://cloud.google.com/free?hl=ja" target="_blank" rel="noopener noreferrer">無料枠・無料トライアル</a></td>
<td>Always Free（恒久無料枠）と$300クレジットの説明。Cloud RunやBigQueryにも無料枠がある</td>
<td>学習用に実際に触ってみるとき。まずここで課金の仕組みを確認</td>
</tr>
<tr>
<td><a href="https://cloud.google.com/customers?hl=ja" target="_blank" rel="noopener noreferrer">導入事例</a></td>
<td>実企業の採用事例。使ったサービスと構成の解説つきのものも多い</td>
<td>「実際の会社はどう組んでいるか」を知りたいとき</td>
</tr>
<tr>
<td><a href="https://cloud.google.com/blog/ja" target="_blank" rel="noopener noreferrer">Google Cloud公式ブログ（日本語）</a></td>
<td>新機能・アーキテクチャ解説・事例の公式ブログ</td>
<td>最新動向を追うとき</td>
</tr>
<tr>
<td><a href="https://cloud.google.com/icons?hl=ja" target="_blank" rel="noopener noreferrer">公式アーキテクチャアイコン</a></td>
<td>GCP公式の構成図用アイコン集（利用規約つき）。この教材では同梱していないが、実務の設計書ではこれを使う</td>
<td>仕事で提出する構成図を描くとき</td>
</tr>
</table>

<p>この教材を読み終えたら、<a href="https://cloud.google.com/architecture?hl=ja" target="_blank" rel="noopener noreferrer">Cloud Architecture Center</a>の
リファレンスアーキテクチャを1日1本読む習慣をおすすめします。この教材で身につけた
「要件→構成→トレードオフ」の読み方がそのまま通用するはずです。</p>`
});
