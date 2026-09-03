// ケース46：監視・オブザーバビリティ
registerCase({
  id: 46,
  category: "運用・セキュリティ・信頼性",
  title: "監視・オブザーバビリティ",
  scenario: "<p>Cloud Runで動くWebサービス（ケース7で作ったようなSaaS）を3人のチームで運用しています。これまで障害には「ユーザーからの問い合わせで気づく」状態で、原因調査もサーバーのログを目視で追うだけでした。利用者が増えてきたため、障害の検知・原因特定・傾向把握を仕組み化したい。専任の運用担当は置けないので、できるだけマネージドな仕組みで、まずは低コストに始めたいという状況です。</p><p>この分野は「オブザーバビリティ（可観測性）」と呼ばれ、メトリクス（数値の時系列）・ログ（出来事の記録）・トレース（1リクエストの処理の流れ）の3本柱で「システムの中で何が起きているかを外から観測できる状態」を作ることを指します。</p>",
  requirements: [
    "障害をユーザーより先に検知して通知を受けたい",
    "エラーの発生と急増をすぐ把握したい",
    "遅いリクエストの「どこが遅いか」を特定したい",
    "専任担当なしで運用できるマネージドな仕組みにしたい",
    "小規模のうちはコストをほぼゼロに抑えたい"
  ],
  main: {
    name: "Cloud Operations（Monitoring+Logging+Trace+Error Reporting）標準構成",
    diagram: {
      cols: 5, rows: 3,
      groups: [
        { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [3, 2] }
      ],
      nodes: [
        { id: "users", icon: "client/users", label: "ユーザー", col: 0, row: 1 },
        { id: "run", icon: "compute/cloud-run", label: "Cloud Run\nアプリ", col: 1, row: 1 },
        { id: "log", icon: "ops/cloud-logging", label: "Cloud Logging\nログ集約", col: 2, row: 0 },
        { id: "trace", icon: "ops/cloud-trace", label: "Cloud Trace\n分散トレース", col: 2, row: 2 },
        { id: "errrep", icon: "ops/error-reporting", label: "Error Reporting\n例外の自動集約", col: 3, row: 0 },
        { id: "mon", icon: "ops/cloud-monitoring", label: "Cloud Monitoring\n指標とアラート", col: 3, row: 1 },
        { id: "dev", icon: "client/developer", label: "開発チーム\n通知を受ける", col: 4, row: 1 }
      ],
      edges: [
        { from: "users", to: "run", label: "HTTPS" },
        { from: "run", to: "log", label: "ログ自動送信" },
        { from: "run", to: "trace", label: "トレース送信" },
        { from: "run", to: "mon", label: "メトリクス" },
        { from: "log", to: "errrep", label: "例外を抽出" },
        { from: "log", to: "mon", label: "ログから指標化", dashed: true },
        { from: "mon", to: "dev", label: "アラート通知" },
        { from: "errrep", to: "dev", label: "新規エラー通知", dashed: true }
      ]
    },
    flow: [
      "Cloud Runの標準出力・標準エラーに書いたログとリクエストログは、エージェントの導入なしでCloud Loggingへ自動送信される",
      "リクエスト数・レイテンシ・CPU使用率などの基本メトリクスも自動でCloud Monitoringに記録される",
      "アプリにOpenTelemetry（計測用の標準ライブラリ）を組み込むと、1リクエストが「DB照会に何ミリ秒、外部API呼び出しに何ミリ秒」といった内訳つきでCloud Traceに記録される",
      "スタックトレースつきのエラーログはError Reportingが自動で検出し、同じ原因のエラーをグループ化して件数を数えてくれる",
      "Cloud Monitoringのアラートポリシーが「エラー率が5%を超えた」などの条件を監視し、メールやチャットへ通知する"
    ],
    services: [
      { icon: "compute/cloud-run", name: "Cloud Run", role: "監視対象のアプリ実行基盤。ログ・メトリクスの送信機能を最初から内蔵している" },
      { icon: "ops/cloud-logging", name: "Cloud Logging", role: "全サービスのログの集約先。検索・フィルタ・保持期間管理・他サービスへの転送（シンク）を担う" },
      { icon: "ops/cloud-monitoring", name: "Cloud Monitoring", role: "メトリクスの保存・ダッシュボード・アラート通知。監視の司令塔" },
      { icon: "ops/cloud-trace", name: "Cloud Trace", role: "1リクエストの処理の流れを区間ごとの所要時間つきで可視化する分散トレーシング" },
      { icon: "ops/error-reporting", name: "Error Reporting", role: "ログの中から例外を自動で見つけてグループ化し、新種のエラー発生を通知する" }
    ],
    points: [
      "図に監視エージェントや収集サーバーが無いのは省略ではありません。Cloud RunやCloud SQLなどのマネージドサービスはログ・メトリクスの送信が組み込み済みで、収集の仕組みを自分で運用しなくてよいのがGCPの監視の出発点です",
      "ダッシュボードより先にアラートを整備します。「人が毎日見に行く」運用は必ず形骸化するので、異常のときだけ通知が来る状態を先に作るのが定石です",
      "アラートはCPU使用率のような原因ベースではなく、エラー率・レイテンシのようなユーザー影響（症状）ベースで設定します。原因ベースの通知を増やしすぎると、通知が無視される「アラート疲れ」を招きます",
      "3本柱は役割分担です。Monitoringで「何かがおかしい」に気づき、Traceで「どこが遅いか」を絞り、Loggingで「そのとき何が起きたか」を確かめる、という順で使います"
    ],
    pros: [
      "エージェント導入・監視サーバー構築が不要で、ほぼ設定ゼロから始められる",
      "Loggingの無料枠（プロジェクトごとに月50GiBの取り込み）が大きく、小規模なら0円で運用できる",
      "ログ・メトリクス・トレースが同じ基盤に集まるため、画面を行き来して相関を追いやすい"
    ],
    cons: [
      "ログ量が増えると取り込み課金（無料枠超過分は1GiBあたり約75円）が効いてくるため、不要なログの除外設計が必要になる",
      "ログの保持期間はデフォルト30日で、長期保存や横断分析には別途設計が要る（代替パターンとケース23参照）",
      "トレースはアプリ側の計装（ライブラリ組み込み）が必要で、自動で全部が見えるわけではない"
    ],
    cost: "<strong>月0円〜数千円</strong>が目安（東京リージョン、1USD=150円換算）。Cloud Loggingは月50GiB/プロジェクトまで取り込み無料、超過は1GiBあたり約75円。Cloud MonitoringはGCPサービスの標準メトリクスが無料。Cloud Traceも無料枠内に収まる規模が多く、Error Reportingは無料です。小規模サービスならほぼ0円で、ログを月100GiB取り込む規模になっても約4,000円程度です。",
    references: [
      { title: "Cloud Monitoringのドキュメント", url: "https://cloud.google.com/monitoring/docs?hl=ja", note: "監視全体の入口" },
      { title: "アラートの概要", url: "https://cloud.google.com/monitoring/alerts?hl=ja", note: "アラートポリシーの考え方と設定" },
      { title: "Cloud Runのロギング", url: "https://cloud.google.com/run/docs/logging?hl=ja", note: "標準出力が自動でLoggingへ送られる仕組み" },
      { title: "Cloud Traceのドキュメント", url: "https://cloud.google.com/trace/docs?hl=ja" },
      { title: "Error Reportingのドキュメント", url: "https://cloud.google.com/error-reporting/docs?hl=ja" }
    ]
  },
  alternatives: [
    {
      name: "ログシンクでBigQueryに集約する長期分析構成",
      when: "監査などでログの長期保存が必要な場合や、SQLでログを横断分析したい場合",
      diagram: {
        cols: 5, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [0, 0], to: [4, 1] }
        ],
        nodes: [
          { id: "run", icon: "compute/cloud-run", label: "Cloud Run\nアプリ", col: 0, row: 0 },
          { id: "log", icon: "ops/cloud-logging", label: "Cloud Logging\nログルーター", col: 1, row: 0 },
          { id: "gcs", icon: "storage/cloud-storage", label: "Cloud Storage\n低コスト保管", col: 3, row: 0 },
          { id: "bq", icon: "analytics/bigquery", label: "BigQuery\nSQLで分析", col: 2, row: 1 },
          { id: "ls", icon: "analytics/looker-studio", label: "Looker Studio\nダッシュボード", col: 4, row: 1 }
        ],
        edges: [
          { from: "run", to: "log", label: "ログ送信" },
          { from: "log", to: "gcs", label: "長期アーカイブ" },
          { from: "log", to: "bq", label: "分析用シンク" },
          { from: "bq", to: "ls", label: "可視化" }
        ]
      },
      flow: [
        "アプリのログはこれまで通りCloud Loggingへ集まる",
        "Cloud Loggingのログルーターに「シンク」（ログの転送ルール）を設定し、条件に合うログをBigQueryへ流し込む",
        "監査用など「めったに見ないが消せない」ログは、より安価なCloud Storageへ別のシンクでアーカイブする",
        "BigQueryに溜まったログをSQLで集計し、Looker Studioでエラー傾向や利用状況のダッシュボードを作る"
      ],
      services: [
        { icon: "ops/cloud-logging", name: "Cloud Logging", role: "ログの受け口。シンクで宛先を振り分けるルーターの役割も持つ" },
        { icon: "analytics/bigquery", name: "BigQuery", role: "ログの長期保存とSQL分析。サーバーレスなDWHなので分析基盤の運用は不要" },
        { icon: "storage/cloud-storage", name: "Cloud Storage", role: "監査向けの低コストな長期アーカイブ先。クラス変更でさらに安くできる" },
        { icon: "analytics/looker-studio", name: "Looker Studio", role: "無料のBIツール。BigQueryのログ集計結果をグラフ化して共有する" }
      ],
      points: [
        "Loggingの標準保持期間（30日）を超えて残したいログだけをシンクで外に出す設計にすると、保存コストを用途ごとに最適化できます",
        "「すぐ検索したい直近ログはLogging、集計・傾向分析はBigQuery、証跡の保管はCloud Storage」と置き場所を分けるのがGCPの定石です",
        "シンクはフィルタ式で対象を絞れます。全ログを流すとBigQueryの保存料が無駄にかさむため、必要なログだけに絞るのがコツです",
        "この構成はケース23（ログ分析基盤）の入口にあたります。全社規模の集約はそちらで扱います"
      ],
      pros: [
        "保持期間を自分で決められ、年単位の保存要件（監査対応）に応えられる",
        "SQLという慣れた道具でエラー傾向・ユーザー行動を自由に分析できる",
        "Looker Studioまで含めて追加のサーバー運用がゼロ"
      ],
      cons: [
        "シンクの設定やBigQueryのテーブル設計など、初期設計の手間が増える",
        "BigQueryの保存料とクエリ料が別途かかる（少量なら軽微だが野放図に流すと増える）",
        "リアルタイムの障害検知は結局Monitoringのアラートが担うため、この構成だけでは監視は完結しない"
      ],
      cost: "<strong>月数百円〜数千円</strong>を上乗せ（東京リージョン、1USD=150円換算）。BigQueryの保存は1GiBあたり月約3〜5円、クエリはスキャン1TiBあたり約1,100円。月50GiBのログを保存して日常的に集計する程度なら数百円規模に収まります。Cloud Storageのアーカイブはさらに安価です。",
      references: [
        { title: "ルーティングとストレージの概要", url: "https://cloud.google.com/logging/docs/routing/overview?hl=ja", note: "ログルーターとシンクの仕組み" },
        { title: "シンクの構成", url: "https://cloud.google.com/logging/docs/export/configure_export_v2?hl=ja", note: "BigQuery・Cloud Storageへの転送設定" },
        { title: "Cloud Loggingのドキュメント", url: "https://cloud.google.com/logging/docs?hl=ja" }
      ]
    },
    {
      name: "外部監視SaaS（Datadog等）併用構成",
      when: "マルチクラウドやオンプレを含めて1つの画面で監視したい場合、既に監視SaaSの運用資産がある場合",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [0, 0], to: [2, 1] }
        ],
        nodes: [
          { id: "run", icon: "compute/cloud-run", label: "Cloud Run\nアプリ", col: 0, row: 1 },
          { id: "log", icon: "ops/cloud-logging", label: "Cloud Logging", col: 1, row: 0 },
          { id: "ps", icon: "integration/pubsub", label: "Pub/Sub\nログ転送", col: 2, row: 0 },
          { id: "mon", icon: "ops/cloud-monitoring", label: "Cloud Monitoring", col: 2, row: 1 },
          { id: "ext", icon: "client/external-saas", label: "監視SaaS\nDatadog等", col: 3, row: 1 }
        ],
        edges: [
          { from: "run", to: "log", label: "ログ" },
          { from: "run", to: "mon", label: "メトリクス" },
          { from: "log", to: "ps", label: "シンク" },
          { from: "ps", to: "ext", label: "プッシュ転送" },
          { from: "mon", to: "ext", label: "API経由で取得", dashed: true }
        ]
      },
      flow: [
        "ログ・メトリクスの収集自体はGCP標準の仕組み（Cloud Logging・Cloud Monitoring）が担う",
        "Cloud LoggingのシンクでログをPub/Subへ流し、監視SaaS側の取り込みエンドポイントへプッシュ転送する",
        "メトリクスは監視SaaSがCloud MonitoringのAPIから定期取得する（SaaS提供のGCP連携機能を使う）",
        "アラート・ダッシュボード・オンコール管理は監視SaaS側に一本化する"
      ],
      services: [
        { icon: "ops/cloud-logging", name: "Cloud Logging", role: "GCP側のログの一次受け。シンクで外部への出口を作る" },
        { icon: "integration/pubsub", name: "Pub/Sub", role: "ログを外部SaaSへ確実に届けるための配送路。受け側の一時的な障害にも再送で耐える" },
        { icon: "ops/cloud-monitoring", name: "Cloud Monitoring", role: "メトリクスの源泉。SaaSはここからAPIでデータを取得する" },
        { icon: "client/external-saas", name: "監視SaaS（Datadog・New Relic等）", role: "複数クラウドを横断する統合ダッシュボード・アラート・オンコール管理" }
      ],
      points: [
        "AWSやオンプレも含めた全体を1画面で見たい場合、クラウド中立なSaaSに集約する価値が出ます。GCP単独ならこの構成は過剰です",
        "SaaSに全ログを送ると取り込み課金が高くつくため、シンクのフィルタで送るログを厳選し、全量はGCP側に残す二段構えにします",
        "Prometheus資産があるチームは、Managed Service for Prometheus（Monitoringのマネージド互換機能）という中間の選択肢も検討できます",
        "通知経路が二重にならないよう、アラートの責任はどちらか一方に寄せるのが運用のコツです"
      ],
      pros: [
        "マルチクラウド・オンプレを含む全システムを単一画面で監視できる",
        "APM（アプリ性能管理）やオンコール管理など、SaaSの成熟した機能群を使える",
        "既存のSaaS運用ノウハウ・ダッシュボード資産をそのまま活かせる"
      ],
      cons: [
        "SaaSの利用料が支配的で、GCP完結の構成より大幅に高くなりやすい",
        "ログを外部に送るための転送設計とデータ持ち出しの社内承認が必要になる",
        "SaaS側の障害時は監視が見えなくなるため、最低限のアラートはGCP側にも残す配慮が要る"
      ],
      cost: "<strong>月数万円〜</strong>（1USD=150円換算）。Datadog等はホスト数・取り込みログ量に応じた課金で、小規模でも月1〜5万円程度から始まります。加えてPub/Subの転送量とインターネットへの下り転送費が少額かかります。GCP標準構成の数十倍になり得るため、マルチクラウド監視という明確な理由があるときに選びます。",
      references: [
        { title: "シンクの構成（Pub/Subへのエクスポート）", url: "https://cloud.google.com/logging/docs/export/configure_export_v2?hl=ja" },
        { title: "Managed Service for Prometheus", url: "https://cloud.google.com/stackdriver/docs/managed-prometheus?hl=ja", note: "Prometheus資産がある場合の中間選択肢" }
      ]
    }
  ],
  cost: "<p>推奨構成は<strong>月0円〜数千円</strong>（Logging無料枠50GiB/月が大きく、小規模なら実質無料）。BigQuery分析を足すと<strong>月数百円〜数千円</strong>の上乗せ。外部SaaS併用は<strong>月数万円〜</strong>とコスト構造が一桁変わります。いずれも東京リージョン・1USD=150円前提の目安で、支配的な変数は「月間ログ取り込み量」です。</p>",
  summary: "<p>GCPの監視は「エージェントを立てて集める」のではなく、<strong>マネージドサービスが最初からログ・メトリクスを送ってくる</strong>前提で設計します。だからこそ最初の仕事は収集ではなく、アラート設計（ユーザー影響ベースで通知を絞る）になります。判断の分かれ目は、GCP完結でよいか（標準構成）、長期保存・SQL分析が要るか（BigQueryシンク追加）、マルチクラウド横断か（SaaS併用）の3点です。ログ分析を本格化するならケース23、CI/CDまで含めた運用自動化はケース43も参照してください。</p>",
  quiz: [
    {
      q: "推奨構成の図には監視エージェントやログ収集サーバーが1つも描かれていません。オンプレの監視構成と比べて、なぜ不要なのでしょうか。",
      a: "Cloud RunをはじめとするGCPのマネージドサービスは、ログとメトリクスをCloud Logging・Cloud Monitoringへ送る機能を最初から内蔵しているためです。オンプレでは収集エージェントの導入・監視サーバーの構築と保守が監視の大仕事でしたが、GCPでは収集は済んでいる状態から始まります。そのぶん人間の仕事は、何を異常と定義しどう通知するかというアラート設計に移ります。"
    },
    {
      q: "アラートを増やしすぎた結果、通知が多すぎてチームが無視するようになってしまいました。どう立て直すべきでしょうか。",
      a: "CPU使用率やメモリ使用率のような原因ベースの通知を思い切って減らし、エラー率・レイテンシ・可用性といったユーザー影響（症状）ベースの少数のアラートに絞り直します。原因系の数値は異常時に調査で見るダッシュボードへ移せば十分です。「通知が来たら必ず行動する」状態を保てる数まで減らすことが、アラートを機能させる唯一の方法です。"
    },
    {
      q: "サービスが成長し、ログ取り込みが月500GiBに達してLoggingの課金が気になり始めました。あなたなら何から手を付けますか。",
      a: "まず内訳を調べ、量を支配しているログを特定します。ヘルスチェックのアクセスログやデバッグログなど「保存する価値が薄い大量ログ」は、ログルーターの除外フィルタで取り込み自体を止めるのが最も効きます（取り込み課金は保存前に発生するため）。そのうえで、長期保存が必要なログだけをシンクでBigQueryやCloud Storageへ逃がし、Loggingの保持は短くする、という置き場所の最適化を行います。"
    }
  ]
});
