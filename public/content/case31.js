// ケース31：MLOps基盤（学習パイプライン）
registerCase({
  id: 31,
  category: "AI・機械学習",
  title: "MLOps基盤（学習パイプライン）",
  scenario: "<p>需要予測モデルを本番運用しているEC企業です。データサイエンティスト2人が毎月、手元のノートブックで再学習し、精度を目視確認してからエンジニアにデプロイを依頼する、という手作業のフローで回しています。作業が属人化して再学習は月1回が限界になり、「いま本番で動いているモデルは、どのデータとどのコードから作られたのか」を誰も即答できない状態です。再学習・評価・デプロイまでを自動化する機械学習基盤（MLOps基盤）を作ります。</p>",
  requirements: [
    "再学習・評価・デプロイの一連の流れを自動化したい（手作業の排除）",
    "どのモデルがどのデータ・コードから生まれたか追跡できるようにしたい（再現性）",
    "評価基準を満たさないモデルを本番に出さないゲートが欲しい",
    "学習リソースはジョブ実行中だけ使い、常時稼働のコストは避けたい",
    "モデルやチームが増えても同じ仕組みに載せられるようにしたい"
  ],
  main: {
    name: "Vertex AI Pipelinesによる学習パイプライン自動化",
    diagram: {
      cols: 5, rows: 3,
      groups: [
        { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [4, 2] }
      ],
      nodes: [
        { id: "dev", icon: "client/developer", label: "開発者\n学習コード修正", col: 0, row: 0 },
        { id: "build", icon: "devtools/cloud-build", label: "Cloud Build\nCI", col: 1, row: 0 },
        { id: "ar", icon: "devtools/artifact-registry", label: "Artifact Registry\nイメージ保管", col: 2, row: 0 },
        { id: "sched", icon: "integration/cloud-scheduler", label: "Scheduler\n定期起動", col: 1, row: 1 },
        { id: "pipe", icon: "ai/vertex-ai", label: "Vertex AI\nPipelines", col: 2, row: 1 },
        { id: "reg", icon: "ai/vertex-ai", label: "Model\nRegistry", col: 3, row: 1 },
        { id: "ep", icon: "ai/vertex-ai", label: "推論\nエンドポイント", col: 4, row: 1 },
        { id: "bq", icon: "analytics/bigquery", label: "BigQuery\n学習データ", col: 1, row: 2 },
        { id: "gcs", icon: "storage/cloud-storage", label: "GCS\n成果物保存", col: 3, row: 2 },
        { id: "app", icon: "compute/cloud-run", label: "業務アプリ\nCloud Run", col: 4, row: 2 }
      ],
      edges: [
        { from: "dev", to: "build", label: "push" },
        { from: "build", to: "ar", label: "イメージ登録" },
        { from: "ar", to: "pipe", label: "イメージ取得", dashed: true },
        { from: "sched", to: "pipe", label: "定期実行" },
        { from: "bq", to: "pipe", label: "学習データ" },
        { from: "pipe", to: "gcs", label: "モデル保存" },
        { from: "pipe", to: "reg", label: "モデル登録" },
        { from: "reg", to: "ep", label: "評価後デプロイ" },
        { from: "app", to: "ep", label: "オンライン推論" }
      ]
    },
    flow: [
      "開発者が学習コードを修正してpushすると、Cloud Buildがパイプラインの部品（コンポーネント）のコンテナイメージをビルドし、Artifact Registryへ登録する",
      "Cloud Schedulerが定期的（例：毎週）にVertex AI Pipelinesの実行を起動する。データ更新イベントを契機にすることもできる",
      "パイプラインはBigQueryから学習データを取り出し、前処理・学習・評価をステップごとのコンテナで順に実行し、途中の成果物をCloud Storageへ保存する",
      "評価ステップで精度が基準を超えたモデルだけをModel Registryへ登録し、推論エンドポイントへデプロイする",
      "業務アプリ（Cloud Run）はエンドポイントを呼び出してオンライン推論の結果を受け取る"
    ],
    services: [
      { icon: "ai/vertex-ai", name: "Vertex AI Pipelines", role: "前処理・学習・評価・デプロイを1本のパイプラインとして定義・実行する。各ステップの入出力（リネージ）を自動記録する" },
      { icon: "ai/vertex-ai", name: "Vertex AI Model Registry", role: "学習済みモデルの台帳。バージョン管理と「どのモデルが本番か」の管理を担う" },
      { icon: "ai/vertex-ai", name: "Vertex AI推論エンドポイント", role: "登録済みモデルをAPIとして公開し、アプリからのオンライン推論に低遅延で応答する" },
      { icon: "analytics/bigquery", name: "BigQuery", role: "学習データの置き場。行動履歴や売上データをSQLで抽出してパイプラインへ渡す" },
      { icon: "storage/cloud-storage", name: "Cloud Storage", role: "前処理済みデータやモデルファイルなど、パイプラインの成果物の保存先" },
      { icon: "devtools/cloud-build", name: "Cloud Build", role: "学習コードのCI。テストとコンテナイメージのビルドを自動化する" },
      { icon: "devtools/artifact-registry", name: "Artifact Registry", role: "パイプラインの各ステップが使うコンテナイメージの保管庫" },
      { icon: "integration/cloud-scheduler", name: "Cloud Scheduler", role: "パイプラインの定期起動を担うcronサービス" },
      { icon: "compute/cloud-run", name: "Cloud Run", role: "推論結果を利用する業務アプリ側。エンドポイントを呼び出す" }
    ],
    points: [
      "ノートブックのまま自動化せず、ステップをコンテナに分けたのは「同じ入力なら同じ結果」を保証するためです。学習の再現性はMLOpsの土台で、ここを崩すと後の全部が崩れます",
      "評価ゲートをパイプラインの中に置いたのは、「精度が落ちたモデルが自動でデプロイされる」事故を防ぐためです。自動化と品質保証は必ずセットで設計します",
      "学習リソースはパイプライン実行中だけ確保されます。常時稼働のGPUサーバーを持たないことがコスト面の決め手で、要件の「実行時だけ使う」に応えています",
      "コードの正しさはCI（Cloud Build）、モデルの良し悪しはパイプラインの評価ステップ、と検証の役割を分けています。どちらか一方に混ぜると責任範囲が曖昧になります"
    ],
    pros: [
      "再学習が「スケジュール任せ」になり、月1回が毎日でも回せる頻度になる",
      "モデル・データ・コードの系譜（リネージ）が自動記録され、「このモデルはどう作られたか」に即答できる",
      "学習は実行時だけの課金で、アイドルコストが小さい",
      "モデルが増えてもパイプラインを複製すれば同じ品質管理に載せられる"
    ],
    cons: [
      "パイプライン定義（Kubeflow Pipelines形式）の学習コストがあり、最初の1本を作るまでが大変",
      "ステップのコンテナ化や依存関係の管理など、データサイエンス以外のエンジニアリング作業が増える",
      "オンライン推論エンドポイントは常時稼働ノードが必要で、呼び出しが少なくても固定費がかかる（バッチ推論で足りるならそちらが安い）"
    ],
    cost: "<strong>月2万〜5万円程度から</strong>が目安です。内訳の例：オンライン推論エンドポイント（n1-standard-2相当を常時1ノード）が月約1.3万円、週次の学習ジョブ（e2-standard-4を1時間）が1回数十円、パイプライン実行料が1回約5円、ほかBigQuery・Cloud Storage・Cloud Buildが小規模なら計数百〜数千円です。GPU学習を使う場合は学習ジョブの単価が大きく上がります。※東京リージョン・1USD=150円換算の概算。",
    references: [
      { title: "Vertex AI Pipelinesの概要", url: "https://cloud.google.com/vertex-ai/docs/pipelines/introduction?hl=ja", note: "パイプラインの考え方と構成要素" },
      { title: "Vertex AI Model Registryの概要", url: "https://cloud.google.com/vertex-ai/docs/model-registry/introduction?hl=ja" },
      { title: "MLOps：機械学習における継続的デリバリーと自動化のパイプライン", url: "https://cloud.google.com/architecture/mlops-continuous-delivery-and-automation-pipelines-in-machine-learning?hl=ja", note: "MLOpsの成熟度レベルを解説した定番ドキュメント" },
      { title: "Vertex AIでの予測の概要", url: "https://cloud.google.com/vertex-ai/docs/predictions/overview?hl=ja", note: "オンライン推論とバッチ推論の使い分け" },
      { title: "Cloud Buildの概要", url: "https://cloud.google.com/build/docs/overview?hl=ja" }
    ]
  },
  alternatives: [
    {
      name: "BigQuery MLでSQL完結の学習",
      when: "データがBigQueryに揃っていて、需要予測や分類など定番の表形式データのモデルを、SQLが得意なチームで作る場合",
      diagram: {
        cols: 3, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [2, 1] }
        ],
        nodes: [
          { id: "analyst", icon: "client/developer", label: "アナリスト\nSQLで学習", col: 0, row: 0 },
          { id: "bq", icon: "analytics/bigquery", label: "BigQuery\nデータ+学習", col: 1, row: 0 },
          { id: "app", icon: "compute/cloud-run", label: "業務アプリ\nCloud Run", col: 2, row: 1 }
        ],
        edges: [
          { from: "analyst", to: "bq", label: "CREATE MODEL" },
          { from: "app", to: "bq", label: "ML.PREDICT" }
        ]
      },
      flow: [
        "アナリストがCREATE MODEL文を実行すると、BigQueryがデータを外に出さずに内部でモデルを学習する",
        "再学習はBigQueryのスケジュールクエリ（クエリの定期実行機能）で自動化する",
        "業務アプリはML.PREDICT関数を含むSQLを投げて予測結果を受け取る"
      ],
      services: [
        { icon: "analytics/bigquery", name: "BigQuery ML", role: "SQLだけで学習・評価・推論まで行う。データウェアハウスの中で機械学習が完結する" },
        { icon: "compute/cloud-run", name: "Cloud Run", role: "予測結果を使う業務アプリ側。BigQueryへクエリを発行する" }
      ],
      points: [
        "学習データの移動が発生しません。データのある場所に処理を寄せる「データ引力」の考え方で、前処理から推論までSQLの世界で完結します",
        "精度の頂点よりも「チームが自力で回せること」を優先する判断です。専任のMLエンジニアがいなくても運用できます",
        "高度なカスタムモデルが必要になったら、BigQuery MLで作ったモデルをVertex AIへ持ち上げる道もあり、推奨構成への段階的な移行が可能です"
      ],
      pros: [
        "SQLだけで始められ、学習コストが最小",
        "学習インフラの管理がゼロで、データ移動がないためガバナンスも保ちやすい"
      ],
      cons: [
        "使えるモデルは定番アルゴリズム中心で、自由度は限定的",
        "ミリ秒級の応答が必要なオンライン推論には不向き（クエリ実行のオーバーヘッドがある）",
        "評価して合格したものだけ使う、というゲートは自前のクエリ運用で作り込む必要がある"
      ],
      cost: "学習・推論ともクエリのスキャン量ベースの課金が基本です。数十GBの学習データなら学習1回は数百円規模で、月次の再学習+日次の予測なら<strong>月数百円〜数千円</strong>が目安です。モデル種別によって単価の扱いが異なるため、公式の料金表で確認してください。",
      references: [
        { title: "BigQuery MLの概要", url: "https://cloud.google.com/bigquery/docs/bqml-introduction?hl=ja" },
        { title: "スケジュールされたクエリ", url: "https://cloud.google.com/bigquery/docs/scheduling-queries?hl=ja", note: "再学習の定期実行に使う" }
      ]
    },
    {
      name: "Cloud Scheduler+Cloud Run Jobsの軽量ML運用",
      when: "モデルが1つで学習も数十分で終わる規模のうちは、専用のML基盤を持たずに済ませたい場合",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [0, 0], to: [2, 1] }
        ],
        nodes: [
          { id: "sched", icon: "integration/cloud-scheduler", label: "Scheduler\n夜間起動", col: 0, row: 0 },
          { id: "jobs", icon: "compute/cloud-run-jobs", label: "Run Jobs\n学習スクリプト", col: 1, row: 0 },
          { id: "gcs", icon: "storage/cloud-storage", label: "GCS\nモデル保存", col: 2, row: 0 },
          { id: "bq", icon: "analytics/bigquery", label: "BigQuery\n学習データ", col: 1, row: 1 },
          { id: "api", icon: "compute/cloud-run", label: "Cloud Run\n推論API", col: 2, row: 1 },
          { id: "app", icon: "client/client", label: "アプリ", col: 3, row: 1 }
        ],
        edges: [
          { from: "sched", to: "jobs", label: "定期起動" },
          { from: "bq", to: "jobs", label: "学習データ" },
          { from: "jobs", to: "gcs", label: "モデル保存" },
          { from: "api", to: "gcs", label: "起動時に読込", dashed: true },
          { from: "app", to: "api", label: "推論API" }
        ]
      },
      flow: [
        "Cloud Schedulerが夜間にCloud Run Jobsの学習ジョブを起動する",
        "ジョブはBigQueryから学習データを読み込み、学習したモデルファイルをCloud Storageへ保存する",
        "推論APIのCloud Runは起動時に最新モデルをCloud Storageから読み込み、アプリへ予測を返す"
      ],
      services: [
        { icon: "integration/cloud-scheduler", name: "Cloud Scheduler", role: "学習ジョブの定期起動" },
        { icon: "compute/cloud-run-jobs", name: "Cloud Run Jobs", role: "学習スクリプトをコンテナで実行する。処理が終わればコンテナごと消え、課金も止まる" },
        { icon: "storage/cloud-storage", name: "Cloud Storage", role: "学習済みモデルファイルの受け渡し場所" },
        { icon: "analytics/bigquery", name: "BigQuery", role: "学習データの抽出元" },
        { icon: "compute/cloud-run", name: "Cloud Run", role: "モデルを読み込んで予測を返す推論API。リクエストが無ければゼロまで縮む" }
      ],
      points: [
        "ケース16の定期バッチと同じ骨格です。MLでも「小さく始める」なら特別な基盤は要りません",
        "モデルの系譜管理や評価ゲートは自前実装になります。モデルや担当者が増えて管理が破綻し始めたら、推奨構成へ移行するサインです",
        "推論を専用エンドポイントでなくCloud Runに載せることで固定費を避けています。呼び出し頻度が低い社内向けモデルに向く形です"
      ],
      pros: [
        "圧倒的に安く、構成が単純",
        "既存のCloud Run運用ノウハウがそのまま使える"
      ],
      cons: [
        "実験管理・リネージ・評価ゲートが無く、属人化しやすい",
        "学習が長時間・大規模（GPU前提）になると仕組みごと作り替えが必要"
      ],
      cost: "学習ジョブ（2vCPU・1日30分）と推論用Cloud Runを合わせて<strong>月数百円〜数千円</strong>が目安です。MLOps基盤としては最安の入り口です。",
      references: [
        { title: "Cloud Run Jobsの作成", url: "https://cloud.google.com/run/docs/create-jobs?hl=ja" },
        { title: "Cloud Schedulerの概要", url: "https://cloud.google.com/scheduler/docs/overview?hl=ja" }
      ]
    }
  ],
  cost: "<p>推奨構成（Vertex AI Pipelines）は<strong>月2万〜5万円程度から</strong>で、常時稼働の推論エンドポイントが固定費の中心です。BigQuery ML案と軽量構成案はいずれも<strong>月数百円〜数千円</strong>で始められます。費用の差は「自動化・追跡・品質ゲートという仕組み」への投資であり、モデル数と再学習頻度が増えるほど推奨構成の投資が回収しやすくなります。※いずれも東京リージョン・1USD=150円前後の概算目安。</p>",
  summary: "<p>MLOpsの本質は「モデルを作ること」ではなく<strong>「モデルを作り続けられる仕組みを作ること」</strong>です。判断の分かれ目は3つあります。データがBigQueryに揃っていてチームがSQL中心ならBigQuery ML、モデルが1つで軽いうちはCloud Run Jobsの軽量構成、モデルと関係者が増えて再現性・品質ゲートが必要になったらVertex AI Pipelinesです。ケース30のレコメンドのような個別のML活用が増えてきた組織が、学習の仕組みを共通基盤化するのが本ケースの位置づけです。</p>",
  quiz: [
    {
      q: "評価ステップをパイプラインに入れず、学習が終わったモデルをそのままデプロイする設計にすると、どんな事故が起きうるでしょうか。",
      a: "学習データの欠損や分布の変化で精度が落ちたモデルが、誰のチェックも受けずに本番へ出てしまいます。自動化は失敗も自動で量産するため、「基準を満たしたものだけ通す」評価ゲートを自動化の中に組み込むことが必須です。手動運用時代に人間が目視でやっていた確認を、パイプラインの1ステップとして明文化するのがMLOpsの要点です。"
    },
    {
      q: "データはすべてBigQueryにあり、チームはSQLが得意でMLエンジニアはいません。作りたいのは月次の需要予測です。あなたならどの構成から始めますか。",
      a: "BigQuery MLから始めるのが合理的です。データ移動が不要で、学習も再学習（スケジュールクエリ）もSQLで完結するため、今のチームのスキルだけで運用まで回せます。精度やモデルの自由度が課題になった時点で、Vertex AIへの移行を検討すれば十分です。技術の高度さではなく「チームが回せるか」で選ぶのがこの分かれ目の本質です。"
    },
    {
      q: "推論エンドポイントの固定費が課題になりました。よく調べると、予測を使うのは1日1回の夜間バッチ集計だけでした。あなたならどうしますか。",
      a: "常時稼働のオンライン推論エンドポイントをやめ、バッチ推論に切り替えます。夜間にまとめて予測を実行し結果をBigQueryやCloud Storageへ書き出せば、推論のための常時稼働ノードが不要になり固定費が消えます。オンライン推論は「リクエストに即時応答が必要か」で採否を決めるもので、利用パターンを確認せずに選ぶと無駄な固定費になる典型例です。"
    }
  ]
});
