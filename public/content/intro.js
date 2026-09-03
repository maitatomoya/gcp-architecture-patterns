// 「はじめに」：この教材の使い方とGCPアーキテクチャの考え方
registerIntro({
  tocTitle: "はじめに：構成を選ぶ力",
  content: `<h2>はじめに：アーキテクチャを「選ぶ力」を鍛える</h2>
<p>Google Cloud（GCP）には100を超えるサービスがあります。ひとつひとつの使い方を覚えることも大切ですが、実務で本当に問われるのは「<strong>このサービス（プロダクト）には、どの部品を、どう組み合わせるか</strong>」を判断する力です。この教材は、その判断力をケーススタディで鍛えます。</p>

<h3>この教材の構成</h3>
<p>1ケース＝1つの「作りたいサービス」です。各ケースは同じ流れで進みます。</p>
<table>
<tr><th>セクション</th><th>学べること</th></tr>
<tr><td>どんなサービス？</td><td>題材となるサービスの内容と状況（規模・チーム・予算）</td></tr>
<tr><td>前提・要件</td><td>アーキテクチャを決める判断材料の整理</td></tr>
<tr><td>推奨アーキテクチャ</td><td>構成図と、その読み方</td></tr>
<tr><td>使うサービス</td><td>構成図に登場する各GCPサービスの役割</td></tr>
<tr><td>設計の工夫点</td><td>「なぜこうしたか」の設計判断</td></tr>
<tr><td>メリット・デメリット</td><td>この構成の得意・不得意を正直に</td></tr>
<tr><td>代替パターン</td><td>「ここを重視するならこっち」という別解と使い分け</td></tr>
</table>
<p>各ケースに載せている費用感は、いずれも<strong>東京リージョン（asia-northeast1）・1USD=150円前後</strong>で計算した概算です。GCPの料金は改定されることがあるため、実際に構築する際は必ず公式の料金ページで最新の金額を確認してください。</p>

<h3>構成図の読み方（この教材の描き方）</h3>
<p>GCPにはAWSのような公式のグループ枠規定がないため、この教材では独自の統一ルールで描きます。まず「枠」の意味です。</p>
<ul>
<li><strong>Google Cloud（青の実線枠）</strong>：Google Cloud上にあるものすべての境界</li>
<li><strong>プロジェクト（グレーの実線枠）</strong>：リソースと請求のまとまり。GCPでは環境分離の基本単位</li>
<li><strong>リージョン（青の破線枠）</strong>：どの地域のデータセンター群か</li>
<li><strong>ゾーン（薄青の破線枠）</strong>：リージョン内の独立した区画。障害の分離単位</li>
<li><strong>VPCネットワーク（緑の実線枠）</strong>：あなた専用の仮想ネットワーク。GCPではリージョンをまたげる「グローバルVPC」が特徴</li>
<li><strong>サブネット（緑の実線枠＋薄緑背景）</strong>：VPCをリージョン単位で区切った区画</li>
<li><strong>GKEクラスタ（青の破線枠）</strong>：Kubernetesクラスタの範囲</li>
<li><strong>マネージドインスタンスグループ（オレンジの破線枠）</strong>：負荷に応じてVM台数が増減する範囲</li>
<li><strong>オンプレミス（グレーの実線枠）</strong>：自社データセンターや社内ネットワーク</li>
</ul>
<p>次に「ノード（部品）」の色です。GCP公式アイコンは同梱していないため、各サービスはカテゴリ色の角丸ボックスに略称を入れて描きます。色を見れば「どの系統の部品か」が一目で分かります。</p>
<table>
<tr><th>色</th><th>カテゴリ</th><th>代表的なサービス</th></tr>
<tr><td><span style="display:inline-block;width:14px;height:14px;border-radius:4px;background:#4285F4;vertical-align:middle"></span> 青</td><td>コンピュート</td><td>Cloud Run、Compute Engine、GKE、Cloud Functions</td></tr>
<tr><td><span style="display:inline-block;width:14px;height:14px;border-radius:4px;background:#F9AB00;vertical-align:middle"></span> アンバー</td><td>ストレージ</td><td>Cloud Storage、Filestore</td></tr>
<tr><td><span style="display:inline-block;width:14px;height:14px;border-radius:4px;background:#EA4335;vertical-align:middle"></span> 赤</td><td>データベース</td><td>Cloud SQL、Spanner、Firestore、Bigtable</td></tr>
<tr><td><span style="display:inline-block;width:14px;height:14px;border-radius:4px;background:#34A853;vertical-align:middle"></span> 緑</td><td>ネットワーク</td><td>Cloud Load Balancing、Cloud CDN、Cloud DNS</td></tr>
<tr><td><span style="display:inline-block;width:14px;height:14px;border-radius:4px;background:#9334E6;vertical-align:middle"></span> 紫</td><td>データ分析</td><td>BigQuery、Dataflow、Looker Studio</td></tr>
<tr><td><span style="display:inline-block;width:14px;height:14px;border-radius:4px;background:#00897B;vertical-align:middle"></span> ティール</td><td>連携・メッセージング</td><td>Pub/Sub、Eventarc、Cloud Tasks、Cloud Scheduler</td></tr>
<tr><td><span style="display:inline-block;width:14px;height:14px;border-radius:4px;background:#E52592;vertical-align:middle"></span> ピンク</td><td>AI・機械学習</td><td>Vertex AI、Gemini、Vision API、Document AI</td></tr>
<tr><td><span style="display:inline-block;width:14px;height:14px;border-radius:4px;background:#5F6368;vertical-align:middle"></span> グレー</td><td>運用・監視</td><td>Cloud Monitoring、Cloud Logging、Cloud Trace</td></tr>
<tr><td><span style="display:inline-block;width:14px;height:14px;border-radius:4px;background:#174EA6;vertical-align:middle"></span> 濃青</td><td>セキュリティ・ID</td><td>IAM、Secret Manager、Identity-Aware Proxy</td></tr>
<tr><td><span style="display:inline-block;width:14px;height:14px;border-radius:4px;background:#FA7B17;vertical-align:middle"></span> オレンジ</td><td>開発・CI/CD</td><td>Cloud Build、Artifact Registry、Cloud Deploy</td></tr>
<tr><td><span style="display:inline-block;width:14px;height:14px;border-radius:4px;background:#202124;vertical-align:middle"></span> 黒</td><td>利用者・外部</td><td>ユーザー、モバイル、外部SaaSなどGCPの外側の登場人物</td></tr>
</table>
<p>矢印はリクエストやデータの流れです。「枠の意味」と「色の意味」を覚えるだけで、この教材の構成図はすべて同じ読み方で理解できます。</p>

<h3>GCPでのサービス選定の軸</h3>
<p>全ケースを通じて、判断は結局この3つのバランスに帰着します。これはクラウド共通の考え方です。</p>
<table>
<tr><th>軸</th><th>問い</th><th>代表的な選択</th></tr>
<tr><td>コスト</td><td>いくらまで払えるか。使わない時間も課金されるか</td><td>サーバーレス vs 常時起動</td></tr>
<tr><td>運用の手間</td><td>誰が面倒を見るのか。チームに何人いるか</td><td>マネージド vs 自前運用</td></tr>
<tr><td>性能・可用性</td><td>どれだけ速く、どれだけ止まってはいけないか</td><td>マルチゾーン・マルチリージョン・キャッシュ</td></tr>
</table>
<p>その上で、GCPには「迷ったらこう考える」という定石がいくつかあります。</p>
<ul>
<li><strong>コンピュートはCloud Runから考える</strong>：コンテナを渡せばスケーリングもHTTPSも面倒を見てくれる。Cloud Runで足りない要件（常時接続・特殊なプロトコル・細かいクラスタ制御）が出て初めてGKEやCompute Engineを検討する</li>
<li><strong>分析はBigQueryに寄せる</strong>：サーバーレスのデータウェアハウスであるBigQueryがGCP最大の武器。データを溜める場所に迷ったら「最終的にBigQueryで分析できるか」から逆算する</li>
<li><strong>非同期連携はPub/Sub</strong>：サービス間の疎結合・イベント駆動はPub/Subが背骨になる</li>
<li><strong>リレーショナルDBは規模で選ぶ</strong>：1リージョンで足りるならCloud SQL、グローバル分散や無停止の水平スケールが要るならSpanner</li>
<li><strong>環境分離はプロジェクト単位</strong>：本番・検証・開発をプロジェクトごと分けるのがGCP流。請求もIAMも自然に分離できる</li>
</ul>
<p>表に出てくる用語を2つだけ補足します。「<strong>マネージド</strong>」とは、サーバーの保守・パッチ当て・バックアップといった面倒な運用をGoogleが代わりに引き受けてくれるサービス形態のことです。「<strong>マルチゾーン</strong>」とは、同じリージョン内の物理的に独立した区画（ゾーン）にサーバーやデータベースを分散配置し、片方に障害が起きてもサービスを止めない構成のことです。</p>
<div class="intro-note">
<p><strong>大事な考え方</strong>：正解のアーキテクチャは1つではありません。「今の要件にはこれが合う。要件が変わればこう変える」と説明できることが、設計力です。各ケースの代替パターンは、まさにその練習のためにあります。</p>
</div>

<h3>読み方ガイド：あなたに合った読む順番</h3>
<p>50ケースを前から全部読む必要はありません。目的別のおすすめルートを用意しました。まずは自分に近いタイプの5〜6ケースを読み、そこから興味の赴くままに広げるのが効率的です。</p>
<table>
<tr><th>読者タイプ</th><th>おすすめルート</th></tr>
<tr><td>完全初心者・非エンジニア</td><td><a href="#case-1">ケース1</a> → <a href="#case-7">ケース7</a> → <a href="#case-12">ケース12</a> → <a href="#case-42">ケース42</a> → <a href="#case-46">ケース46</a></td></tr>
<tr><td>Webアプリを載せたい</td><td><a href="#case-7">ケース7</a> → <a href="#case-8">ケース8</a> → <a href="#case-14">ケース14</a> → <a href="#case-43">ケース43</a> → <a href="#case-45">ケース45</a></td></tr>
<tr><td>データ分析・ML基盤を作りたい</td><td><a href="#case-20">ケース20</a> → <a href="#case-21">ケース21</a> → <a href="#case-22">ケース22</a> → <a href="#case-26">ケース26</a> → <a href="#case-31">ケース31</a></td></tr>
<tr><td>個人開発・フリーランス</td><td><a href="#case-1">ケース1</a> → <a href="#case-7">ケース7</a> → <a href="#case-14">ケース14</a> → <a href="#case-16">ケース16</a> → <a href="#case-10">ケース10</a></td></tr>
<tr><td>インフラ・運用担当</td><td><a href="#case-43">ケース43</a> → <a href="#case-44">ケース44</a> → <a href="#case-46">ケース46</a> → <a href="#case-47">ケース47</a> → <a href="#case-49">ケース49</a> → <a href="#case-50">ケース50</a></td></tr>
</table>

<h3>進め方</h3>
<p>ケースは前から順に読むと段階的に難しくなりますが、興味のあるケースからつまみ食いしても大丈夫です。読んだら「読んだ」チェックを付けて進捗を記録しましょう。なお、読了チェックはこのブラウザ内にのみ保存されるため、端末やブラウザを替えると引き継がれません。</p>`
});
