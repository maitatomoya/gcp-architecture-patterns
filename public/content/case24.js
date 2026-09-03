// ケース24：ETL/ELTパイプライン
registerCase({
  id: 24,
  category: "データ・分析",
  title: "ETL/ELTパイプライン",
  scenario: "<p>ケース22で作った分析基盤が成長し、取り込みジョブが20本を超えました。業務DBのCDC、外部システムからの日次ファイル連携、SaaSのAPI取得、それらが終わってから走る変換SQLと、ジョブ同士の依存関係が複雑になっています。cronの時刻ずらしで運用してきましたが、前段の失敗に気づかず後段が空のデータで走る事故が発生。依存関係と失敗時の再実行までを一元管理するデータパイプラインの運行基盤を整えます。データエンジニアは3人です。</p>",
  requirements: [
    "ジョブ間の依存関係（Aが済んでからB）を定義して実行したい",
    "失敗時は自動リトライし、回復しなければ通知してほしい",
    "実行履歴と所要時間を一覧で確認したい",
    "大容量データの変換処理をスケールさせたい",
    "過去日付分の再実行（バックフィル）を安全に行いたい"
  ],
  main: {
    name: "Cloud Composer+Dataflowのパイプライン運行構成",
    diagram: {
      cols: 5, rows: 3,
      groups: [
        { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [3, 2] }
      ],
      nodes: [
        { id: "db", icon: "client/onprem-server", label: "業務DB", col: 0, row: 0 },
        { id: "ext", icon: "client/external-saas", label: "外部システム\nCSV連携", col: 0, row: 1 },
        { id: "dstr", icon: "analytics/datastream", label: "Datastream\nCDC", col: 1, row: 0 },
        { id: "gcs", icon: "storage/cloud-storage", label: "Cloud Storage\nファイル置き場", col: 1, row: 1 },
        { id: "dflow", icon: "analytics/dataflow", label: "Dataflow\n変換処理", col: 2, row: 1 },
        { id: "bq", icon: "analytics/bigquery", label: "BigQuery\nDWH", col: 3, row: 0 },
        { id: "composer", icon: "analytics/composer", label: "Cloud Composer\n運行管理", col: 2, row: 2 },
        { id: "consumer", icon: "client/client", label: "BI・ML\n活用先", col: 4, row: 0 }
      ],
      edges: [
        { from: "db", to: "dstr", label: "変更ログ" },
        { from: "dstr", to: "bq", label: "継続反映" },
        { from: "ext", to: "gcs", label: "ファイル連携" },
        { from: "gcs", to: "dflow", label: "読み込み" },
        { from: "dflow", to: "bq", label: "整形・ロード" },
        { from: "composer", to: "dflow", label: "ジョブ起動", dashed: true },
        { from: "composer", to: "bq", label: "SQL変換実行", dashed: true },
        { from: "bq", to: "consumer", label: "参照" }
      ]
    },
    flow: [
      "Cloud Composer（マネージドなApache Airflow）が毎日決まった時刻にDAG（ジョブの依存関係をコードで定義したもの）を起動します",
      "業務DBの変更はDatastreamが常時BigQueryへ反映し、ファイル連携分はComposerがDataflowジョブを起動してCloud Storageから整形・ロードします",
      "取り込みの完了を待ってから、ComposerがBigQuery上の変換SQLを依存順に実行します",
      "途中で失敗したタスクは自動リトライし、回復しなければ担当者へ通知します。実行履歴と所要時間はComposerの画面で一覧できます",
      "整い終わったデータは、BIダッシュボードや機械学習など下流の用途から参照されます"
    ],
    services: [
      { icon: "analytics/composer", name: "Cloud Composer", role: "パイプラインの司令塔。マネージドなApache Airflowで、依存関係・スケジュール・リトライ・実行履歴・通知を一元管理する" },
      { icon: "analytics/dataflow", name: "Dataflow", role: "大容量データの整形・突合などSQLだけでは書きにくい変換を担う分散処理基盤。データ量に応じてワーカーが自動増減する" },
      { icon: "analytics/datastream", name: "Datastream", role: "業務DBの変更差分（CDC）をBigQueryへ継続反映する。バッチの枠外で常時動く取り込み経路" },
      { icon: "storage/cloud-storage", name: "Cloud Storage", role: "外部システムとのファイル受け渡し場所。パイプラインの入口となるランディングゾーン" },
      { icon: "analytics/bigquery", name: "BigQuery", role: "DWH本体。SQLで書ける変換はBigQuery内で実行し（ELT）、Dataflowと使い分ける" }
    ],
    points: [
      "ETLかELTかは二者択一ではなく使い分けです。ファイルの解凍・文字コード変換・大規模な突合のようにSQLで書きにくい処理はDataflow（ETL）、集計や結合などSQLで書ける処理はBigQuery内（ELT）に寄せると、それぞれの得意分野が活きます",
      "Composerを入れる決め手はジョブの本数と依存関係の複雑さです。cronの時刻ずらしは「前段の失敗に気づかず後段が走る」「処理時間が延びて追い越しが起きる」という構造的な事故を防げません",
      "各タスクは冪等（何回実行しても同じ結果になる性質）に作ります。日付パーティション単位の洗い替えにしておくと、リトライでもバックフィルでも二重取り込みが起きません",
      "Composerは環境自体が常時起動で、ジョブ数に関係なく固定費がかかります。ジョブが数本のうちはケース16のScheduler構成で十分で、複雑さがコストに見合ってから導入します"
    ],
    pros: [
      "依存関係・リトライ・実行履歴・通知・バックフィルが標準機能で、運行管理の自作が不要",
      "Airflowはワークフロー管理のデファクトで、ノウハウや経験者を見つけやすい",
      "取り込み・変換の全ジョブが1つの画面で見渡せ、障害対応が速くなる",
      "DAGはPythonコードなのでGitでレビュー・版管理できる"
    ],
    cons: [
      "Composer環境の固定費が高く、小規模パイプラインには過剰",
      "Airflow（Python）とDAG設計の学習コストがかかる",
      "Composer環境自体のバージョンアップという運用作業が定期的に発生する"
    ],
    cost: "<strong>月7万〜20万円程度</strong>が目安（東京リージョン・1USD=150円前後）。内訳はCloud Composerの小構成が月5万円前後、Dataflowバッチジョブが実行時間分の従量（日次1時間程度なら月数千円〜数万円）、BigQueryとDatastreamがデータ量次第。ジョブが数本ならケース16の構成で月数千円に抑えられるため、複雑さが固定費に見合うかが導入判断です。",
    references: [
      { title: "Cloud Composerの概要", url: "https://cloud.google.com/composer/docs/concepts/overview?hl=ja" },
      { title: "Dataflowテンプレートの概要", url: "https://cloud.google.com/dataflow/docs/concepts/dataflow-templates?hl=ja", note: "定型的な変換をコードなしで動かす選択肢" },
      { title: "データのバッチ読み込み", url: "https://cloud.google.com/bigquery/docs/batch-loading-data?hl=ja" },
      { title: "Datastreamの概要", url: "https://cloud.google.com/datastream/docs/overview?hl=ja" }
    ]
  },
  alternatives: [
    {
      name: "Cloud Scheduler+Cloud Run Jobsの軽量構成",
      when: "ジョブが数本で依存関係が単純、固定費をかけたくない場合",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [3, 1] }
        ],
        nodes: [
          { id: "ext", icon: "client/external-saas", label: "外部システム", col: 0, row: 1 },
          { id: "sched", icon: "integration/cloud-scheduler", label: "Cloud Scheduler\n定時起動", col: 1, row: 0 },
          { id: "jobs", icon: "compute/cloud-run-jobs", label: "Cloud Run Jobs\n取り込み・変換", col: 2, row: 0 },
          { id: "gcs", icon: "storage/cloud-storage", label: "Cloud Storage", col: 1, row: 1 },
          { id: "bq", icon: "analytics/bigquery", label: "BigQuery", col: 3, row: 0 }
        ],
        edges: [
          { from: "sched", to: "jobs", label: "定時起動" },
          { from: "ext", to: "gcs", label: "ファイル連携" },
          { from: "gcs", to: "jobs", label: "読み込み" },
          { from: "jobs", to: "bq", label: "ロード・変換" }
        ]
      },
      flow: [
        "Cloud Schedulerが決まった時刻にCloud Run Jobsを起動します",
        "ジョブはCloud Storageのファイルを読み込み、BigQueryへのロードと変換SQLの実行を1本のプログラム内で順番に行います",
        "依存関係は「1つのジョブの中で逐次実行する」ことで表現し、失敗時はジョブごと再実行します"
      ],
      services: [
        { icon: "integration/cloud-scheduler", name: "Cloud Scheduler", role: "cron形式の定時起動。実行そのものはしない起動係" },
        { icon: "compute/cloud-run-jobs", name: "Cloud Run Jobs", role: "取り込みと変換の処理本体。実行時間分だけの課金で、常時起動費がない" },
        { icon: "storage/cloud-storage", name: "Cloud Storage", role: "ファイルの受け渡し場所" },
        { icon: "analytics/bigquery", name: "BigQuery", role: "ロード先。変換SQLもジョブから実行する" }
      ],
      points: [
        "依存関係が「AのあとにB」程度なら、1本のジョブ内の逐次処理として書くのが最も確実です。時刻ずらしの複数ジョブより追い越し事故が起きません",
        "この構成の限界は、ジョブをまたぐ依存・部分再実行・実行履歴の一覧性です。ジョブが10本を超えたり分岐が生まれたりしたら、推奨構成への移行を検討します",
        "定期バッチ処理の基本形はケース16で詳しく扱っています"
      ],
      pros: [
        "固定費ゼロで、月数百円から運用できる",
        "部品が少なく、Airflowのような新しい学習対象がない"
      ],
      cons: [
        "ジョブをまたぐ依存関係や部分再実行の仕組みは自作になる",
        "実行履歴や失敗箇所の可視性が低く、本数が増えると管理しきれない"
      ],
      cost: "<strong>月数百円〜数千円</strong>が目安。SchedulerとCloud Run Jobsは実行分のみの従量課金で、BigQueryのバッチロードは無料です。",
      references: [
        { title: "Cloud Run Jobsの作成", url: "https://cloud.google.com/run/docs/create-jobs?hl=ja" },
        { title: "クエリのスケジューリング", url: "https://cloud.google.com/bigquery/docs/scheduling-queries?hl=ja", note: "SQLだけの変換ならこれで足りる場合もある" }
      ]
    },
    {
      name: "Workflows+Eventarcのイベント駆動構成",
      when: "「ファイルが届いたら処理」のようにイベント起点で動かし、サーバーレスに寄せたい場合",
      diagram: {
        cols: 5, rows: 1,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [4, 0] }
        ],
        nodes: [
          { id: "ext", icon: "client/external-saas", label: "外部システム", col: 0, row: 0 },
          { id: "gcs", icon: "storage/cloud-storage", label: "Cloud Storage", col: 1, row: 0 },
          { id: "evarc", icon: "integration/eventarc", label: "Eventarc\nイベント検知", col: 2, row: 0 },
          { id: "flows", icon: "integration/workflows", label: "Workflows\n手順実行", col: 3, row: 0 },
          { id: "bq", icon: "analytics/bigquery", label: "BigQuery", col: 4, row: 0 }
        ],
        edges: [
          { from: "ext", to: "gcs", label: "アップロード" },
          { from: "gcs", to: "evarc", label: "作成イベント" },
          { from: "evarc", to: "flows", label: "起動" },
          { from: "flows", to: "bq", label: "ロード・変換実行" }
        ]
      },
      flow: [
        "外部システムがCloud Storageへファイルをアップロードします",
        "Eventarcがオブジェクト作成イベントを検知し、Workflowsを起動します",
        "Workflowsが「ロード→検証→変換SQL→通知」といった手順をステップとして順に実行します。各ステップの失敗時リトライも定義できます"
      ],
      services: [
        { icon: "integration/eventarc", name: "Eventarc", role: "Cloud Storageなど各サービスのイベントを検知して後続を起動するイベントルーター" },
        { icon: "integration/workflows", name: "Workflows", role: "サーバーレスのオーケストレーター。API呼び出しの手順をYAMLで定義し、実行分だけの課金で動く" },
        { icon: "storage/cloud-storage", name: "Cloud Storage", role: "イベントの発生源となるファイル置き場" },
        { icon: "analytics/bigquery", name: "BigQuery", role: "ロードと変換の実行先" }
      ],
      points: [
        "定時起動ではなく「届いたら即処理」のため、ファイル到着が不定期な連携ではムダな空振り実行がなくなり、反映も速くなります",
        "WorkflowsはComposerと違い完全従量課金で、待機中の費用がゼロです。ただし複雑な依存グラフやバックフィル、豊富な連携部品ではAirflowに軍配が上がります",
        "イベント駆動の設計パターン全般はケース17やケース19と共通です"
      ],
      pros: [
        "固定費ゼロのサーバーレスで、イベント量が少なければ月数百円レベル",
        "ファイル到着から処理開始までの遅延が小さい"
      ],
      cons: [
        "複雑な依存グラフや日次バックフィルの管理はAirflowほど得意ではない",
        "手順が長く複雑になるとYAML定義の見通しが悪くなる"
      ],
      cost: "<strong>月数百円〜数千円</strong>が目安。WorkflowsとEventarcはほぼ従量課金のみで、BigQueryのバッチロードは無料。処理本体をDataflowにする場合はその実行時間分が加わります。",
      references: [
        { title: "Workflowsの概要", url: "https://cloud.google.com/workflows/docs/overview?hl=ja" },
        { title: "Eventarcの概要", url: "https://cloud.google.com/eventarc/docs/overview?hl=ja" }
      ]
    }
  ],
  cost: "<p>推奨構成は<strong>月7万〜20万円程度</strong>で、Composerの固定費（月5万円前後〜）が支配的です。Scheduler+Cloud Run Jobs構成なら<strong>月数百円〜数千円</strong>、Workflows+Eventarc構成も<strong>月数百円〜数千円</strong>で済みます。パイプラインの複雑さ（本数・依存・再実行要件）がComposerの固定費に見合うかどうかが判断の中心です（東京リージョン・1USD=150円前後の目安）。</p>",
  summary: "<p>データパイプラインの本質は変換処理そのものより<strong>運行管理（依存関係・失敗検知・再実行）</strong>にあります。cronの時刻ずらしは一見動きますが、前段の失敗を後段が知らないという構造的欠陥を抱えています。ジョブが増えたらComposerのようなオーケストレーターに「順序と失敗の管理」を任せ、各タスクは冪等に作る。これが安心してバックフィルできる基盤の条件です。一方でジョブが少ないうちはScheduler構成やイベント駆動構成が安くて速い、という段階論も忘れずに。前段のDWH設計はケース22、定期バッチの基本はケース16を参照してください。</p>",
  quiz: [
    {
      q: "cronで「2時に取り込み、3時に変換」と時刻をずらして依存関係を表現する運用には、どんな構造的リスクがあるでしょうか。",
      a: "大きく2つあります。第一に、2時の取り込みが失敗しても3時の変換はそれを知らずに実行され、空データや古いデータで集計が走ってしまいます。第二に、データ量の増加で取り込みが1時間を超えると、変換が取り込みを追い越して不完全なデータを読みます。どちらも「後段が前段の完了を確認していない」ことが原因で、時刻ではなく完了イベントで繋ぐ依存関係の明示的な管理（DAG）が根本対策になります。"
    },
    {
      q: "タスクを冪等に作るとはどういうことで、なぜパイプラインでは特に重要なのでしょうか。",
      a: "同じタスクを何回実行しても結果が同じになる性質のことです。例えば「その日のパーティションを削除してから入れ直す」洗い替え方式にしておけば、2回走っても二重取り込みになりません。パイプラインではリトライやバックフィルで同じタスクを再実行する場面が日常的にあるため、冪等でないタスクが1つあるだけで「再実行していいか分からない」状態になり、失敗時の復旧が手作業と調査だらけになります。"
    },
    {
      q: "現在のジョブは3本で、依存関係も1つだけです。将来に備えて今からCloud Composerを導入すべきでしょうか。あなたの判断と理由を述べてください。",
      a: "今は導入せず、Scheduler+Cloud Run Jobsのような軽量構成で始めるのが妥当です。Composerはジョブ数に関係なく月5万円前後の固定費と、環境自体の管理・バージョンアップという運用負荷が発生し、3本のジョブには明らかに過剰です。ただし移行のサインを決めておくことが重要で、ジョブが10本を超える、分岐や合流のある依存が生まれる、バックフィルを頻繁に行う、のいずれかが出た時点でComposerへ載せ替えます。最初から大きい道具を持つのではなく、複雑さが費用に見合った時に導入する判断が実務的です。"
    }
  ]
});
