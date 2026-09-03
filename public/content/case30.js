// ケース30：レコメンドエンジン
registerCase({
  id: 30,
  category: "AI・機械学習",
  title: "レコメンドエンジン",
  scenario: "<p>月間50万人が使うECサイトで、トップページと商品ページに「あなたへのおすすめ」を出すことになりました。ユーザーの閲覧・カート追加・購入といった行動履歴から一人ひとりに合った商品を算出します。おすすめ枠の表示はページ描画の一部なので、APIの応答は数十ミリ秒以内が必須です。行動ログは1日数百万件発生します。まずは協調フィルタリング（「この商品を見た人はこれも買っています」のように、似た行動のユーザー同士から好みを推定する手法）で始め、効果を計測しながら改善していく方針です。</p>",
  requirements: [
    "ユーザーごとにパーソナライズしたおすすめを返したい",
    "おすすめAPIの応答は数十ミリ秒以内（ページ表示を遅らせない）",
    "1日数百万件の行動ログを取りこぼさず蓄積したい",
    "おすすめの効果（クリック率・購入率）を計測して改善サイクルを回したい",
    "行動履歴のない新規ユーザーにも何かしら表示したい"
  ],
  main: {
    name: "バッチ学習+キャッシュ配信のレコメンド基盤",
    diagram: {
      cols: 5, rows: 2,
      groups: [
        { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [4, 1] }
      ],
      nodes: [
        { id: "app", icon: "client/client", label: "ECサイト\nアプリ", col: 0, row: 0 },
        { id: "runapi", icon: "compute/cloud-run", label: "Cloud Run\nおすすめAPI", col: 1, row: 0 },
        { id: "mem", icon: "database/memorystore", label: "Memorystore\n結果キャッシュ", col: 2, row: 0 },
        { id: "ps", icon: "integration/pubsub", label: "Pub/Sub\n行動ログ受信", col: 1, row: 1 },
        { id: "dflow", icon: "analytics/dataflow", label: "Dataflow\nストリーム処理", col: 2, row: 1 },
        { id: "bq", icon: "analytics/bigquery", label: "BigQuery\n行動履歴", col: 3, row: 1 },
        { id: "vertex", icon: "ai/vertex-ai", label: "Vertex AI\nモデル学習", col: 4, row: 1 }
      ],
      edges: [
        { from: "app", to: "runapi", label: "おすすめ要求" },
        { from: "runapi", to: "mem", label: "キャッシュ参照" },
        { from: "runapi", to: "ps", label: "行動ログ" },
        { from: "ps", to: "dflow", label: "ストリーム処理" },
        { from: "dflow", to: "bq", label: "整形して蓄積" },
        { from: "bq", to: "vertex", label: "学習データ" },
        { from: "vertex", to: "mem", label: "予測結果を書込" }
      ]
    },
    flow: [
      "閲覧・カート追加・購入などの行動ログは、おすすめAPI経由でPub/Subへ送り、Dataflowが重複除去・整形しながらBigQueryへ蓄積します",
      "Vertex AIがBigQueryの行動履歴から協調フィルタリングのモデルを毎晩学習し、全ユーザー分のおすすめ商品リストをバッチ予測でまとめて算出します",
      "算出したおすすめリストをMemorystore（インメモリの高速キャッシュ）へ書き込みます。実際の書き込みはバッチジョブが担います",
      "ユーザーがページを開くと、おすすめAPIはMemorystoreからそのユーザーのリストを読むだけで返します。ここに機械学習の計算は登場しないため数ミリ秒で応答できます",
      "表示したおすすめのクリック・購入も行動ログとして戻り、効果計測と翌日の学習データになります"
    ],
    services: [
      { icon: "compute/cloud-run", name: "Cloud Run", role: "おすすめAPIの本体。キャッシュ参照と行動ログの受け付けだけを行う薄いAPIで、アクセスに応じて自動スケールする" },
      { icon: "database/memorystore", name: "Memorystore", role: "ユーザーID→おすすめ商品リストを保持するインメモリキャッシュ。数十ミリ秒の応答要件を支える要" },
      { icon: "integration/pubsub", name: "Pub/Sub", role: "1日数百万件の行動ログを受け止める入口。スパイクしても取りこぼさない緩衝材" },
      { icon: "analytics/dataflow", name: "Dataflow", role: "ログの重複除去・整形・セッション集計を流れ作業で行うストリーム処理基盤" },
      { icon: "analytics/bigquery", name: "BigQuery", role: "行動履歴の蓄積先であり、学習データの供給元。クリック率などの効果計測もSQLで行う" },
      { icon: "ai/vertex-ai", name: "Vertex AI", role: "協調フィルタリングモデルの学習と、全ユーザー分のバッチ予測を毎晩実行する" }
    ],
    points: [
      "リクエストのたびにモデルで計算するのではなく、夜間に全ユーザー分を計算してキャッシュしておく「事前計算方式」を選びました。応答数十ミリ秒という要件は、リアルタイム推論では難しくても、キャッシュのキー参照なら余裕で満たせます。おすすめの鮮度が1日遅れになるのがトレードオフです",
      "行動ログの経路にPub/Sub+Dataflowを挟んだのは、セール時のスパイクを吸収しつつ、重複や欠損を整えてからBigQueryへ入れるためです。学習データの品質がおすすめの品質を決めます",
      "新規ユーザーや行動の少ないユーザー（コールドスタート問題）には個人化リストが作れないため、人気ランキングやカテゴリ別売れ筋を既定値としてキャッシュに用意しておき、APIは常に何かを返せるようにします",
      "「おすすめの表示→クリック→購入」のログが自動的に翌日の学習データへ戻る循環を最初から設計しています。効果計測なしのレコメンドは改善のしようがありません"
    ],
    pros: [
      "応答が数ミリ秒〜数十ミリ秒で安定し、ページ表示を遅らせない",
      "推論サーバーの常時稼働が不要で、学習・予測は夜間バッチに集約される",
      "行動ログ基盤がそのまま効果計測・改善サイクルの土台になる",
      "モデルを高度化しても配信側（API+キャッシュ）は作り直さなくてよい"
    ],
    cons: [
      "おすすめが最新の行動を反映するのは翌日以降（日次バッチの場合）",
      "MemorystoreとDataflowは常時稼働の固定費がかかる",
      "全ユーザー分の事前計算はユーザー数に比例して学習・予測コストが増える",
      "構成要素が多く、ログ設計からモデル評価まで役割の広い知識が必要"
    ],
    cost: "<strong>月5万円〜15万円程度</strong>（月間50万ユーザー・1日数百万ログの想定、東京リージョン・1USD=150円換算の目安）。内訳はDataflowのストリーム処理（最小構成で月3万円前後〜）、Memorystore（数GBで月5,000円〜1万円台）、BigQueryの保存とクエリ、夜間の学習・バッチ予測（1回数百円〜数千円）です。ログ量が少ないうちはPub/SubからBigQueryへ直接書き込むサブスクリプションを使い、Dataflowを省略して月数万円圧縮する選択もあります。",
    references: [
      { title: "Memorystore for Redisドキュメント", url: "https://cloud.google.com/memorystore/docs/redis?hl=ja" },
      { title: "Dataflowドキュメント", url: "https://cloud.google.com/dataflow/docs?hl=ja" },
      { title: "Vertex AIのトレーニング方法の概要", url: "https://cloud.google.com/vertex-ai/docs/training-overview?hl=ja" },
      { title: "Vertex AIの予測の概要", url: "https://cloud.google.com/vertex-ai/docs/predictions/overview?hl=ja", note: "バッチ予測とオンライン予測の使い分け" },
      { title: "Pub/Subドキュメント", url: "https://cloud.google.com/pubsub/docs?hl=ja" }
    ]
  },
  alternatives: [
    {
      name: "BigQuery MLで小さく始める構成",
      when: "機械学習の専任者がおらず、まずSQLだけで協調フィルタリングの効果を検証したい場合",
      diagram: {
        cols: 5, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [4, 1] }
        ],
        nodes: [
          { id: "app", icon: "client/client", label: "ECサイト\nアプリ", col: 0, row: 0 },
          { id: "runapi", icon: "compute/cloud-run", label: "Cloud Run\nおすすめAPI", col: 1, row: 0 },
          { id: "fstr", icon: "database/firestore", label: "Firestore\n結果の配信用", col: 2, row: 0 },
          { id: "jobs", icon: "compute/cloud-run-jobs", label: "Cloud Run Jobs\n結果の転送", col: 3, row: 0 },
          { id: "bq", icon: "analytics/bigquery", label: "BigQuery\n履歴+ML学習", col: 4, row: 0 },
          { id: "sched", icon: "integration/cloud-scheduler", label: "Cloud Scheduler\n定時トリガー", col: 4, row: 1 }
        ],
        edges: [
          { from: "app", to: "runapi", label: "おすすめ要求" },
          { from: "runapi", to: "fstr", label: "結果参照" },
          { from: "jobs", to: "fstr", label: "予測結果を書込" },
          { from: "jobs", to: "bq", label: "結果読み出し" },
          { from: "sched", to: "bq", label: "定時にML実行" }
        ]
      },
      flow: [
        "行動履歴はアプリの既存ログ経路からBigQueryへ日次で取り込みます（ログ収集の作りはケース23参照）",
        "Cloud Schedulerを起点に、BigQuery MLの行列分解モデル（協調フィルタリングをSQLで作れる機能）の学習と予測をスケジュールされたクエリで実行します",
        "Cloud Run Jobsが予測結果のテーブルを読み出し、ユーザーIDをキーにFirestoreへ書き込みます",
        "おすすめAPIはFirestoreから該当ユーザーのリストを読んで返します。ミリ秒一桁のキャッシュほどではないものの、数十ミリ秒要件は満たせます"
      ],
      services: [
        { icon: "analytics/bigquery", name: "BigQuery ML", role: "SQLだけで行列分解モデルの学習・予測ができる機能。学習基盤を別に立てずに済む" },
        { icon: "database/firestore", name: "Firestore", role: "予測結果の配信用ストア。サーバーレスで固定費がなく、小規模の配信に十分な速さを持つ" },
        { icon: "compute/cloud-run-jobs", name: "Cloud Run Jobs", role: "BigQueryの予測結果をFirestoreへ転送する夜間ジョブ" },
        { icon: "compute/cloud-run", name: "Cloud Run", role: "おすすめAPI。役割は推奨構成と同じ" },
        { icon: "integration/cloud-scheduler", name: "Cloud Scheduler", role: "学習・予測・転送の定時実行トリガー" }
      ],
      points: [
        "「レコメンドに効果があるか」を確かめる段階では、Dataflowも専用の学習基盤も過剰です。既にBigQueryに行動データがあるなら、SQLを書くだけでモデルが作れるBigQuery MLが最短です",
        "MemorystoreではなくFirestoreを配信に使うことで常時稼働の固定費をなくしています。トラフィックが増えて応答がシビアになったらMemorystoreへ差し替えます",
        "BigQuery MLの行列分解モデルはオンデマンド課金では学習できず、スロット予約（Editionsの購入）が必要になる点に注意が必要です。短時間の予約でも学習は回せますが、見積もり時に見落としやすいポイントです",
        "この構成で効果が確認できたら、ログ経路をリアルタイム化し（Pub/Sub+Dataflow）、モデルをVertex AIへ移す、と推奨構成へ段階的に育てられます"
      ],
      pros: [
        "SQL中心の開発でML専任者がいなくても構築でき、初期投資が最小",
        "固定費がほぼなく、検証をやめる判断も気軽にできる",
        "推奨構成への移行パスが素直（配信APIはそのまま使える）"
      ],
      cons: [
        "行動履歴の反映は日次で、ログ経路のリアルタイム性もない",
        "行列分解の学習にスロット予約が必要で、完全な従量課金にはならない",
        "モデルの表現力はVertex AIでの本格的な学習より限定的"
      ],
      cost: "<strong>月5,000円〜3万円程度</strong>（東京リージョン・1USD=150円換算の目安）。BigQueryの保存・クエリとFirestoreの読み書きが中心で、学習時のみスロット予約の費用が加わります。固定費がほぼないため、検証フェーズの構成として現実的です。",
      references: [
        { title: "BigQuery MLの概要", url: "https://cloud.google.com/bigquery/docs/bqml-introduction?hl=ja", note: "SQLでできるモデルの種類と使い方" },
        { title: "Firestoreドキュメント", url: "https://cloud.google.com/firestore/docs?hl=ja" },
        { title: "Cloud Schedulerドキュメント", url: "https://cloud.google.com/scheduler/docs?hl=ja" }
      ]
    },
    {
      name: "Vertex AI Search for commerceに任せる構成",
      when: "EC特化のレコメンドを自前の学習なしで導入したい場合や、「よく一緒に買われる商品」など定番のおすすめ枠を早く並べたい場合",
      diagram: {
        cols: 4, rows: 1,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [3, 0] }
        ],
        nodes: [
          { id: "app", icon: "client/client", label: "ECサイト\nアプリ", col: 0, row: 0 },
          { id: "run", icon: "compute/cloud-run", label: "Cloud Run\n中継API", col: 1, row: 0 },
          { id: "vas", icon: "ai/vertex-ai-search", label: "Vertex AI Search\nfor commerce", col: 2, row: 0 },
          { id: "bq", icon: "analytics/bigquery", label: "BigQuery\n商品カタログ", col: 3, row: 0 }
        ],
        edges: [
          { from: "app", to: "run", label: "要求・行動ログ" },
          { from: "run", to: "vas", label: "予測取得" },
          { from: "bq", to: "vas", label: "商品カタログ連携" }
        ]
      },
      flow: [
        "商品カタログ（商品ID・名前・カテゴリ・価格など）をBigQuery経由でVertex AI Search for commerceへ連携します",
        "閲覧・カート・購入などのユーザーイベントを中継API経由でサービスへ送り続けます。この行動データがGoogleの学習済みの仕組みで自動的にモデルへ反映されます",
        "おすすめが必要な場面で予測APIを呼ぶと、「あなたへのおすすめ」「よく一緒に買われる商品」などのモデル別に商品リストが返ります",
        "モデルの学習・更新・チューニングはサービス側が自動で行い、自前の学習パイプラインは持ちません"
      ],
      services: [
        { icon: "ai/vertex-ai-search", name: "Vertex AI Search for commerce", role: "EC向けの検索・レコメンドのマネージドサービス。カタログとイベントを渡すだけで複数種類のおすすめモデルが使える" },
        { icon: "compute/cloud-run", name: "Cloud Run", role: "アプリとサービスの間でイベント送信と予測取得を中継する薄いAPI" },
        { icon: "analytics/bigquery", name: "BigQuery", role: "商品カタログとイベント履歴の管理・連携元" }
      ],
      points: [
        "レコメンドは「作る」以外に「買う」選択肢がある領域です。小売向けに磨かれた学習済みの仕組みを使えば、モデル開発ゼロで定番のおすすめ枠を並べられます",
        "モデルの中身はブラックボックスで、独自の推薦ロジック（自社の在庫都合や粗利の重み付けなど）を深く組み込むことはできません。ビジネスルールの調整機能の範囲で対応します",
        "効果が出るには十分な量のイベントデータが必要で、導入直後から精度が高いわけではありません。データがたまるまでの期間を計画に織り込みます",
        "予測リクエスト課金のため、表示面が増えるほど費用が伸びます。自前構成との損益分岐はトラフィック規模で試算します"
      ],
      pros: [
        "モデルの開発・学習・運用が一切不要で、導入が最速",
        "「よく一緒に買われる商品」などEC定番のおすすめモデルが最初からそろっている",
        "Googleの小売向けノウハウが継続的に反映される"
      ],
      cons: [
        "推薦ロジックの内部を制御できず、独自の工夫の余地が限られる",
        "予測リクエスト課金はトラフィックが大きいと自前構成より高くつくことがある",
        "カタログとイベントのデータ整備という地味な作業は結局必要"
      ],
      cost: "<strong>月数万円〜</strong>（東京リージョン・1USD=150円換算の目安）。予測リクエスト数とイベント量に応じた従量課金が中心で、月間50万ユーザー規模の表示面に出すと数万円〜十数万円になり得ます。モデル開発の人件費が不要になる点まで含めて自前構成と比較します。",
      references: [
        { title: "Vertex AI Search for commerceドキュメント", url: "https://cloud.google.com/retail/docs?hl=ja", note: "EC向けレコメンド・検索の公式ドキュメント" },
        { title: "BigQueryの概要", url: "https://cloud.google.com/bigquery/docs/introduction?hl=ja" }
      ]
    }
  ],
  cost: "<p>推奨構成は<strong>月5万円〜15万円程度</strong>で、DataflowとMemorystoreの常時稼働分が土台になります。検証段階ならBigQuery ML構成で<strong>月5,000円〜3万円程度</strong>に抑えられ、開発リソースがなければVertex AI Search for commerceに<strong>月数万円〜</strong>で任せる道もあります。いずれも東京リージョン・1USD=150円換算の目安で、ユーザー数・ログ量・表示面の数に比例して変わります。</p>",
  summary: "<p>レコメンドの設計は<strong>「学習はゆっくり・配信は一瞬」を分離する</strong>のが骨格です。応答数十ミリ秒の要件はモデルの高速化ではなく、事前計算+キャッシュという配信側の設計で満たします。そのうえで、学習側は検証段階のBigQuery MLから本格運用のVertex AIまで段階的に育てられ、そもそも自前で作らずマネージドサービスを買う選択もあります。行動ログを集めるストリーム処理の詳細はケース21、モデルの再学習を自動化する仕組みはケース31で扱います。</p>",
  quiz: [
    {
      q: "推奨構成では、おすすめAPIが呼ばれた瞬間には機械学習の計算を一切していません。それでも「パーソナライズされたおすすめ」が返せるのはなぜですか。また、この方式の代償は何でしょうか。",
      a: "夜間バッチで全ユーザー分のおすすめリストをあらかじめ計算し、MemorystoreにユーザーIDをキーとして格納してあるからです。API はキャッシュを参照するだけなので数ミリ秒で応答できます。代償はおすすめの鮮度で、直前の行動が反映されるのは次のバッチ実行後になります。「応答速度」と「鮮度」のどちらを要件として優先するかで、事前計算方式かリアルタイム推論かが決まります。"
    },
    {
      q: "登録直後の新規ユーザーには行動履歴がなく、協調フィルタリングではおすすめを計算できません（コールドスタート問題）。この構成ではどう対処していますか。",
      a: "人気ランキングやカテゴリ別売れ筋といった、個人の履歴に依存しない既定リストをあらかじめキャッシュに用意しておき、個人化リストがないユーザーにはそれを返します。APIが「何も返せない」状態を作らないことが実装上のポイントです。新規ユーザーの行動がたまれば、翌日以降のバッチから自動的に個人化リストに切り替わります。おすすめの中身と同じくらい、データがないときの既定動作の設計が重要です。"
    },
    {
      q: "経営陣から「まず1ヶ月でおすすめ枠の効果を見せてほしい。エンジニアはあなた1人」と言われました。3つの構成のうちどれを選び、どう進めますか。",
      a: "BigQuery ML構成を選びます。1人・1ヶ月という制約では、Dataflowや学習パイプラインを組む推奨構成は間に合わず、Vertex AI Search for commerceもカタログ・イベント整備とデータ蓄積期間を考えると効果提示までが不確実です。既存の行動データをBigQueryへ入れ、SQLで行列分解モデルを学習し、Firestore経由で一部ページに表示してクリック率を計測する、が最短です。効果が示せたら推奨構成へ段階的に育てる計画も同時に提示します。制約が構成を決める典型例です。"
    }
  ]
});
