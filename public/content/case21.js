// ケース21：ニアリアルタイム分析
registerCase({
  id: 21,
  category: "データ・分析",
  title: "ニアリアルタイム分析",
  scenario: "<p>スマホゲームを運営する会社で、ユーザーの行動イベント（画面表示・アイテム購入・ステージクリアなど）が毎秒数百〜数千件発生しています。これまでは1日1回の夜間集計でしたが、ゲーム内イベントやキャンペーンの効果をその場で確認して施策を打ちたいという要望が強くなりました。イベント発生から数秒〜数十秒遅れでKPIダッシュボードに反映される仕組みを、少人数の基盤チームで作ります。</p>",
  requirements: [
    "イベントは毎秒数百件以上、キャンペーン時はさらに跳ね上がる",
    "発生から数秒〜数十秒でダッシュボードに反映したい",
    "集計前の生データも残し、後から自由に深掘り分析したい",
    "一時的な障害でもデータを取りこぼしたくない",
    "基盤チームは少人数。サーバーの運用管理は避けたい"
  ],
  main: {
    name: "Pub/Sub+Dataflow+BigQueryのストリーミング構成",
    diagram: {
      cols: 6, rows: 2,
      groups: [
        { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [3, 1] }
      ],
      nodes: [
        { id: "ev", icon: "client/client", label: "アプリ・サーバー\nイベント発生源", col: 0, row: 0 },
        { id: "pubsub", icon: "integration/pubsub", label: "Pub/Sub\n受け口・バッファ", col: 1, row: 0 },
        { id: "dflow", icon: "analytics/dataflow", label: "Dataflow\nストリーム処理", col: 2, row: 0 },
        { id: "bq", icon: "analytics/bigquery", label: "BigQuery\n生データ+集計", col: 3, row: 0 },
        { id: "ls", icon: "analytics/looker-studio", label: "Looker Studio\nダッシュボード", col: 4, row: 0 },
        { id: "analyst", icon: "client/users", label: "運営チーム", col: 5, row: 0 },
        { id: "mon", icon: "ops/cloud-monitoring", label: "Cloud Monitoring\n遅延・滞留監視", col: 2, row: 1 }
      ],
      edges: [
        { from: "ev", to: "pubsub", label: "イベント送信" },
        { from: "pubsub", to: "dflow", label: "購読" },
        { from: "dflow", to: "bq", label: "ストリーム書き込み" },
        { from: "bq", to: "ls", label: "クエリ" },
        { from: "analyst", to: "ls", label: "閲覧" },
        { from: "dflow", to: "mon", label: "メトリクス", dashed: true, noArrow: true }
      ]
    },
    flow: [
      "アプリやゲームサーバーは、発生したイベントをPub/Subのトピックへ送信します。送る側は後段の処理の混雑を一切気にしなくてよいのがポイントです",
      "Dataflowがメッセージを購読し、重複排除・整形・ウィンドウ集計（例：1分ごとの売上合計）といったストリーム処理を行います",
      "処理結果と生データをBigQueryへストリーミング書き込みします。発生から数秒〜数十秒でクエリ可能になります",
      "Looker StudioがBigQueryを定期的にクエリし、運営チームはブラウザでダッシュボードを見ます",
      "Dataflowの処理遅延やPub/Subのメッセージ滞留はCloud Monitoringで監視し、異常時に通知します"
    ],
    services: [
      { icon: "integration/pubsub", name: "Pub/Sub", role: "イベントの受け口となるメッセージングサービス。送信側と処理側を切り離し、スパイクや後段の停止を吸収するバッファになる" },
      { icon: "analytics/dataflow", name: "Dataflow", role: "Apache Beamベースのマネージドなストリーム/バッチ処理基盤。ウィンドウ集計や重複排除を担い、負荷に応じてワーカーが自動増減する" },
      { icon: "analytics/bigquery", name: "BigQuery", role: "サーバーレスのデータウェアハウス。生データと集計結果の両方を貯め、SQLで数秒後には分析できる" },
      { icon: "analytics/looker-studio", name: "Looker Studio", role: "無料のBIツール。BigQueryに接続してダッシュボードを作り、URLで共有できる" },
      { icon: "ops/cloud-monitoring", name: "Cloud Monitoring", role: "Dataflowの処理遅延（データの鮮度）やPub/Subの未処理メッセージ数を監視し、しきい値超過で通知する" }
    ],
    points: [
      "Pub/Subを挟むのは、イベントの発生側と処理側を疎結合にするためです。処理側が一時停止してもメッセージは既定で最大7日間保持されるため、復旧後に追いつき処理ができ、取りこぼしを防げます",
      "Dataflowを使うのは、ウィンドウ集計・重複排除・遅れて届くデータの扱いといったストリーム処理の難所を、実績あるモデル（Apache Beam）に任せるためです。自前でコンシューマーを書くより信頼性の作り込みが大幅に減ります",
      "BigQueryへの書き込みにはStorage Write APIを使います。従来のストリーミング挿入より安価で、同じデータを二重に書き込まない（exactly-once）保証を作れます",
      "「リアルタイム」の定義を要件として詰めることが最重要です。本当に数秒が必要なのか、数分でよいのかでコストが大きく変わります。数分でよければ代替パターン2の構成で十分です"
    ],
    pros: [
      "全部品がマネージドでサーバー管理ゼロ。イベント量の増減に自動で追従する",
      "Pub/Subのバッファリングにより、障害時もデータ欠損に強い",
      "生データと集計結果が同じBigQueryに残るため、後からの深掘り分析も同じ基盤でできる",
      "Looker Studioは無料で、ダッシュボードの共有にライセンス費がかからない"
    ],
    cons: [
      "Dataflowのストリーミングジョブは常時起動で、ワーカーVM分の固定費がかかる",
      "Apache Beamのプログラミングモデルには学習コストがある",
      "数秒の鮮度が本当に必要か見極めないと、過剰投資になりやすい"
    ],
    cost: "<strong>月3万〜10万円程度</strong>が目安（東京リージョン・1USD=150円前後）。内訳はDataflowストリーミングジョブ（小規模ワーカー常時2台前後）が月2万〜6万円、Pub/SubとBigQueryがデータ量に応じた従量課金、Looker Studioは無料。イベント量が増えるとDataflowとBigQueryが比例して増えます。",
    references: [
      { title: "Pub/Subの概要", url: "https://cloud.google.com/pubsub/docs/overview?hl=ja", note: "メッセージングの基本概念" },
      { title: "Dataflowの概要", url: "https://cloud.google.com/dataflow/docs/overview?hl=ja" },
      { title: "BigQuery Storage Write API", url: "https://cloud.google.com/bigquery/docs/write-api?hl=ja", note: "ストリーミング書き込みの現行推奨API" },
      { title: "Pub/Sub to BigQueryテンプレート", url: "https://cloud.google.com/dataflow/docs/guides/templates/provided/pubsub-to-bigquery?hl=ja", note: "コードを書かずにこの構成を試せる公式テンプレート" },
      { title: "Looker Studio", url: "https://cloud.google.com/looker-studio?hl=ja" }
    ]
  },
  alternatives: [
    {
      name: "Pub/SubのBigQueryサブスクリプション直結構成",
      when: "途中の変換・集計が不要で、まずイベントをそのままBigQueryへ貯めたい場合",
      diagram: {
        cols: 5, rows: 1,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [2, 0] }
        ],
        nodes: [
          { id: "ev", icon: "client/client", label: "アプリ・サーバー", col: 0, row: 0 },
          { id: "pubsub", icon: "integration/pubsub", label: "Pub/Sub\nBigQueryサブスク", col: 1, row: 0 },
          { id: "bq", icon: "analytics/bigquery", label: "BigQuery\n生データ+ビュー", col: 2, row: 0 },
          { id: "ls", icon: "analytics/looker-studio", label: "Looker Studio", col: 3, row: 0 },
          { id: "analyst", icon: "client/users", label: "運営チーム", col: 4, row: 0 }
        ],
        edges: [
          { from: "ev", to: "pubsub", label: "イベント送信" },
          { from: "pubsub", to: "bq", label: "直接書き込み" },
          { from: "bq", to: "ls", label: "接続" },
          { from: "analyst", to: "ls", label: "閲覧" }
        ]
      },
      flow: [
        "Pub/SubにBigQueryサブスクリプションを作ると、届いたメッセージがDataflowを介さず直接BigQueryテーブルへ書き込まれます",
        "変換や集計はBigQuery側のSQL（ビューや定期実行クエリ）で行います。貯めてから変換するELTの発想です",
        "Looker Studioは集計済みビューを参照してダッシュボードを表示します"
      ],
      services: [
        { icon: "integration/pubsub", name: "Pub/Sub（BigQueryサブスクリプション）", role: "メッセージをそのままBigQueryへ流し込む機能。ストリーム処理基盤の構築が不要になる" },
        { icon: "analytics/bigquery", name: "BigQuery", role: "生データの着地点。整形・集計はSQLのビューや定期クエリで後段的に行う" },
        { icon: "analytics/looker-studio", name: "Looker Studio", role: "集計ビューに接続するダッシュボード" }
      ],
      points: [
        "Dataflowという最も高価で学習コストの高い部品を省けるのが最大の利点です。まずこの構成で始め、複雑な処理が必要になったら推奨構成へ進化させる段階論が現実的です",
        "重複排除や複雑なウィンドウ集計はできないため、多少の重複を許容してSQL側で除去する設計になります",
        "メッセージのスキーマ（項目構成）とテーブルの対応を事前に決めておく必要があり、スキーマ変更には弱めです"
      ],
      pros: [
        "Dataflowの固定費とBeamの学習コストがゼロになる",
        "構成部品が少なく、少人数でも運用しやすい"
      ],
      cons: [
        "書き込み前の整形・重複排除・突合など高度なストリーム処理はできない",
        "変換をSQLに寄せるため、複雑になるとビューの管理が煩雑になる"
      ],
      cost: "<strong>月数千円〜</strong>が目安。Pub/SubのBigQueryサブスクリプション経由の書き込みは従量課金で、Dataflowの常時起動費がないぶん推奨構成より大幅に安くなります。",
      references: [
        { title: "BigQueryサブスクリプション", url: "https://cloud.google.com/pubsub/docs/bigquery?hl=ja", note: "この構成の中核機能の公式解説" },
        { title: "サブスクリプションの作成", url: "https://cloud.google.com/pubsub/docs/create-subscription?hl=ja" }
      ]
    },
    {
      name: "マイクロバッチ構成（数分〜1時間間隔の定期集計）",
      when: "鮮度要件が数分〜1時間でよく、コストを最小にしたい場合",
      diagram: {
        cols: 5, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [3, 1] }
        ],
        nodes: [
          { id: "ev", icon: "client/client", label: "アプリ・サーバー", col: 0, row: 0 },
          { id: "gcs", icon: "storage/cloud-storage", label: "Cloud Storage\nログファイル", col: 1, row: 0 },
          { id: "jobs", icon: "compute/cloud-run-jobs", label: "Cloud Run Jobs\nロード処理", col: 2, row: 0 },
          { id: "bq", icon: "analytics/bigquery", label: "BigQuery\n集計", col: 3, row: 0 },
          { id: "ls", icon: "analytics/looker-studio", label: "Looker Studio", col: 4, row: 0 },
          { id: "sched", icon: "integration/cloud-scheduler", label: "Cloud Scheduler", col: 2, row: 1 }
        ],
        edges: [
          { from: "ev", to: "gcs", label: "ログ書き出し" },
          { from: "gcs", to: "jobs", label: "まとめて読む" },
          { from: "jobs", to: "bq", label: "ロード" },
          { from: "bq", to: "ls", label: "接続" },
          { from: "sched", to: "jobs", label: "定時起動" }
        ]
      },
      flow: [
        "アプリはイベントをCloud Storageへログファイルとして書き出します（数分ごとにまとめて出力）",
        "Cloud SchedulerがCloud Run Jobsを数分〜1時間おきに起動し、たまったファイルをBigQueryへロードします",
        "BigQueryの定期実行クエリで集計テーブルを更新し、Looker Studioが表示します"
      ],
      services: [
        { icon: "storage/cloud-storage", name: "Cloud Storage", role: "イベントログファイルの一時置き場。最も安価なバッファ" },
        { icon: "compute/cloud-run-jobs", name: "Cloud Run Jobs", role: "ロード処理を実行時間分だけの課金で実行するバッチ用コンテナ実行環境" },
        { icon: "integration/cloud-scheduler", name: "Cloud Scheduler", role: "cron形式の定時起動サービス。マイクロバッチの心臓部" },
        { icon: "analytics/bigquery", name: "BigQuery", role: "ロード先。ファイルからのバッチロードは無料のため、コストはクエリとストレージのみ" }
      ],
      points: [
        "BigQueryへのファイルからのバッチロードは課金対象外のため、この構成は取り込みコストがほぼゼロになります",
        "鮮度は起動間隔ぶん（数分〜1時間）遅れます。「ダッシュボードは5分遅れでよい」と合意できるなら、これで十分なことが実務では多いです",
        "定期バッチの組み方の詳細はケース16で扱っています。この構成はその応用です"
      ],
      pros: [
        "常時起動の部品がなく、月額コストが桁違いに安い",
        "部品がすべて初心者にも扱いやすく、デバッグも容易"
      ],
      cons: [
        "鮮度は起動間隔に依存し、秒単位の反映はできない",
        "イベント量が増えるとロード処理の実行時間管理（間隔内に終わるか）が必要になる"
      ],
      cost: "<strong>月数百円〜数千円</strong>が目安。Cloud SchedulerとCloud Run Jobsはごく少額で、BigQueryのバッチロードは無料。ストレージとクエリの従量課金が中心です。",
      references: [
        { title: "Cloud Run Jobsの作成", url: "https://cloud.google.com/run/docs/create-jobs?hl=ja" },
        { title: "データのバッチ読み込み", url: "https://cloud.google.com/bigquery/docs/batch-loading-data?hl=ja", note: "バッチロードが無料である点も記載" },
        { title: "クエリのスケジューリング", url: "https://cloud.google.com/bigquery/docs/scheduling-queries?hl=ja" }
      ]
    }
  ],
  cost: "<p>推奨構成は<strong>月3万〜10万円程度</strong>（Dataflow常時起動が支配的）。BigQueryサブスクリプション直結なら<strong>月数千円〜</strong>、マイクロバッチなら<strong>月数百円〜数千円</strong>まで下がります。いずれも東京リージョン・1USD=150円前後の目安で、コストの差はほぼ「どこまでの鮮度を買うか」の差です。</p>",
  summary: "<p>ニアリアルタイム分析の定石は<strong>Pub/Subで受けてDataflowで処理しBigQueryへ流し込む</strong>3段構えです。ただしこの構成の価値は「数秒の鮮度」を買っている点にあり、要件が数分単位でよければDataflowを省いた直結構成やマイクロバッチで費用は桁で下がります。アーキテクチャを選ぶ前に「リアルタイムとは何秒か」を発注者と合意することが、このケース最大の学びです。集めたデータの活用はケース22、ログへの応用はケース23、IoTへの応用はケース38で扱います。</p>",
  quiz: [
    {
      q: "アプリから直接BigQueryへ書き込めば部品を減らせるのに、なぜPub/Subを挟むのでしょうか。",
      a: "送信側と処理側を切り離すためです。BigQueryや処理側に一時的な障害・遅延があっても、Pub/Subがメッセージを既定で最大7日間保持するため取りこぼしを防げます。またキャンペーン時のスパイクをバッファとして吸収し、送信側はエラー処理や再送の作り込みを最小限にできます。直接書き込みでは、書き込み失敗時のリカバリをすべてアプリ側が背負うことになります。"
    },
    {
      q: "運営チームから「ダッシュボードの更新は5分に1回で十分」と言われました。あなたなら構成をどう変えますか。",
      a: "常時起動のDataflowをやめ、Pub/SubのBigQueryサブスクリプション直結や、Cloud Scheduler起点のマイクロバッチへ変更します。月数万円のDataflow費用が数百円〜数千円に下がり、運用部品も減ります。ストリーム処理は「秒単位の鮮度」への対価なので、鮮度要件が緩んだ瞬間に最適解が変わる、というコストと要件の対応関係を意識することが重要です。"
    },
    {
      q: "Dataflowのジョブが数時間停止した場合、その間のイベントデータは失われるでしょうか。",
      a: "失われません。Pub/Subは確認応答（Ack）が返っていないメッセージを既定で最大7日間保持するため、Dataflowが復旧すると滞留したメッセージから順に追いつき処理が行われます。ダッシュボードへの反映は遅れますが、データ自体は欠損しません。これがPub/Subを挟む構成の耐障害性の核心で、滞留量をCloud Monitoringで監視しておけば異常にも早く気づけます。"
    }
  ]
});
