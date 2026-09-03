// ケース23：ログ分析基盤
registerCase({
  id: 23,
  category: "データ・分析",
  title: "ログ分析基盤",
  scenario: "<p>Cloud Run上の複数のマイクロサービスと一部のVMで構成されたシステム群を運用しています。これまで障害調査のたびに各サービスのログを個別に見て回っており、時間がかかっていました。全システムのログを1か所に集約し、直近のログは素早く検索、数か月分はSQLで傾向分析、1年以上は監査要件のために安価に保管する、という3段構えのログ基盤を作ります。運用チームは3人です。</p>",
  requirements: [
    "全サービスのログを1か所で横断検索したい",
    "エラーの急増に自動で気づける仕組みがほしい",
    "SQLでの集計分析（エラー傾向・利用状況）をしたい",
    "監査要件で1年以上の長期保管が必要",
    "保管コストはできるだけ抑えたい"
  ],
  main: {
    name: "Cloud Loggingシンク+BigQuery+Cloud Storageの3段構成",
    diagram: {
      cols: 6, rows: 2,
      groups: [
        { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [3, 1] }
      ],
      nodes: [
        { id: "ops", icon: "client/users", label: "運用者", col: 0, row: 1 },
        { id: "run", icon: "compute/cloud-run", label: "Cloud Run\n各サービス", col: 1, row: 0 },
        { id: "logging", icon: "ops/cloud-logging", label: "Cloud Logging\nログルーター", col: 2, row: 0 },
        { id: "bq", icon: "analytics/bigquery", label: "BigQuery\n傾向分析用", col: 3, row: 0 },
        { id: "gcs", icon: "storage/cloud-storage", label: "Cloud Storage\n長期保管用", col: 3, row: 1 },
        { id: "mon", icon: "ops/cloud-monitoring", label: "Cloud Monitoring\nアラート", col: 1, row: 1 },
        { id: "ls", icon: "analytics/looker-studio", label: "Looker Studio\n可視化", col: 4, row: 0 },
        { id: "dev", icon: "client/developer", label: "開発者・分析者", col: 5, row: 0 }
      ],
      edges: [
        { from: "run", to: "logging", label: "自動収集" },
        { from: "logging", to: "bq", label: "分析シンク" },
        { from: "logging", to: "gcs", label: "保管シンク" },
        { from: "logging", to: "mon", label: "指標化", dashed: true },
        { from: "mon", to: "ops", label: "通知" },
        { from: "bq", to: "ls", label: "SQL集計" },
        { from: "dev", to: "ls", label: "閲覧" }
      ]
    },
    flow: [
      "Cloud Runなどサーバーレス系の標準出力ログは、エージェント不要でCloud Loggingに自動収集されます（VMはOpsエージェントを入れて同じ場所へ送ります）",
      "ログルーターのシンク（ログの転送ルール）が振り分けます。分析対象のログはBigQueryへ、全量はCloud Storageへ流します",
      "エラーログの件数はログベースの指標としてCloud Monitoringに送られ、しきい値を超えると運用者に通知されます",
      "開発者は直近の障害調査にはLoggingのログエクスプローラ、傾向分析にはBigQuery+Looker Studioを使います",
      "Cloud Storage側はライフサイクル設定で、古いログを自動的に低価格の保存クラスへ移行します"
    ],
    services: [
      { icon: "ops/cloud-logging", name: "Cloud Logging", role: "ログの自動収集と横断検索の入口。ログルーターがシンクの条件に従って各保存先へ振り分ける" },
      { icon: "analytics/bigquery", name: "BigQuery", role: "SQLでのログ傾向分析を担う。エラー率の推移や利用状況の集計など、検索ではなく集計が必要な用途に使う" },
      { icon: "storage/cloud-storage", name: "Cloud Storage", role: "全量ログの長期保管庫。保存クラスの使い分けで監査用の1年以上の保管を最安で実現する" },
      { icon: "ops/cloud-monitoring", name: "Cloud Monitoring", role: "ログから作った指標（エラー件数など）を監視し、急増時にメールやチャットへ通知する" },
      { icon: "analytics/looker-studio", name: "Looker Studio", role: "BigQueryの集計結果をダッシュボード化し、エラー傾向をチームで共有する" }
    ],
    points: [
      "置き場を3つに分けるのは、それぞれ得意分野が違うからです。Loggingは検索性が高いものの長期保持は割高、BigQueryはSQL集計が得意、Cloud Storageは保管単価が最安です。1か所にまとめると検索性かコストのどちらかを諦めることになります",
      "Loggingの既定の保持期間は30日（_Defaultバケット）です。それを超えて残したい分をシンクでどこへ逃がすかが、この構成の主眼です",
      "シンクでは除外フィルタも重要です。ヘルスチェックやデバッグログなどのノイズを取り込み前に除外するだけで、費用が大きく下がります",
      "アラートは「エラーが出たら」ではなく「急増したら」に設定します。ゼロにできない散発エラーで毎回通知すると、アラート疲れで本当の障害を見逃します"
    ],
    pros: [
      "サーバーレス系はエージェントレスで自動収集され、集約の仕組みを自作しなくてよい",
      "目的別の3段構えで、検索性・分析力・保管コストを同時に満たせる",
      "監査用の長期保管が月数百円レベルで実現できる",
      "シンクはプロジェクト横断の集約もでき、システムが増えても同じ形で拡張できる"
    ],
    cons: [
      "Loggingの取り込みは無料枠（月50GiB）超過分に費用がかかり、大量ログでは無視できない",
      "置き場が3つに分かれるため、「どの調査ではどこを見るか」のガイドがないと迷子になる",
      "BigQueryへシンクしたログはネストした構造になっており、SQLに少し慣れが必要"
    ],
    cost: "<strong>月1.5万〜3万円程度</strong>が目安（月200GiBのログ量、東京リージョン・1USD=150円前後）。内訳はLogging取り込み（無料枠50GiB超過分150GiB×約75円）が約11,000円、BigQueryのストレージとクエリが数千円、Cloud Storage（Coldline等）は数百円。費用はログ量にほぼ比例するため、除外フィルタによるノイズ削減が最大のコスト対策です。",
    references: [
      { title: "ルーティングとストレージの概要", url: "https://cloud.google.com/logging/docs/routing/overview?hl=ja", note: "ログルーターとシンクの公式解説" },
      { title: "シンクの構成", url: "https://cloud.google.com/logging/docs/export/configure_export_v2?hl=ja" },
      { title: "ログベースの指標の概要", url: "https://cloud.google.com/logging/docs/logs-based-metrics?hl=ja", note: "エラー急増アラートの土台" },
      { title: "オブジェクトのライフサイクル管理", url: "https://cloud.google.com/storage/docs/lifecycle?hl=ja" },
      { title: "ストレージクラス", url: "https://cloud.google.com/storage/docs/storage-classes?hl=ja", note: "長期保管の単価を下げる選択肢" }
    ]
  },
  alternatives: [
    {
      name: "Log Analytics構成（Logging内で完結）",
      when: "エクスポート先の管理を増やしたくなく、SQL分析もLoggingの中で済ませたい場合",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [3, 1] }
        ],
        nodes: [
          { id: "run", icon: "compute/cloud-run", label: "Cloud Run\n各サービス", col: 1, row: 0 },
          { id: "logging", icon: "ops/cloud-logging", label: "Cloud Logging\n分析対応バケット", col: 2, row: 0 },
          { id: "bq", icon: "analytics/bigquery", label: "BigQuery\nリンクデータセット", col: 3, row: 1 }
        ],
        edges: [
          { from: "run", to: "logging", label: "自動収集" },
          { from: "logging", to: "bq", label: "リンク", dashed: true }
        ]
      },
      flow: [
        "ログバケットをLog Analytics対応にアップグレードすると、Loggingの画面からログに対して直接SQLを実行できるようになります",
        "リンクデータセットを作ると、データを複製せずにBigQuery側からも同じログを参照できます",
        "検索・SQL分析・可視化までがLoggingとBigQueryの標準機能で完結し、シンクの管理が不要になります"
      ],
      services: [
        { icon: "ops/cloud-logging", name: "Cloud Logging（Log Analytics）", role: "ログバケット自体がSQL分析に対応。検索と分析の置き場を1つにできる" },
        { icon: "analytics/bigquery", name: "BigQuery（リンクデータセット）", role: "ログバケットへの読み取り専用の窓。データを二重に持たずにBigQueryのツール群から分析できる" }
      ],
      points: [
        "データを複製しないため、BigQueryシンク方式で発生しがちな二重保存コストがなくなります。エクスポートの設定ミスでログが欠ける事故も起きません",
        "保持期間はバケット設定で延長できますが、延長分には保持費用がかかります。1年以上の監査保管はCloud Storageシンクを併用するほうが安くつきます",
        "比較的新しい方式のため、BigQueryシンク方式の情報が多い現場ではチームの習熟度も考慮に入れます"
      ],
      pros: [
        "シンクやエクスポート先の管理が不要で、構成が最もシンプル",
        "データの二重保存がなく、その分のコストが浮く"
      ],
      cons: [
        "長期保持を全てLoggingで賄うと割高で、監査用途にはGCS併用が結局必要",
        "テーブル設計を自分で持てないため、細かい最適化（パーティション設計など）はできない"
      ],
      cost: "<strong>月1万〜2万円程度</strong>が目安（月200GiB想定）。取り込み費用は推奨構成と同じで、二重保存分が浮くぶん少し安くなります。保持期間の延長には別途費用がかかります。",
      references: [
        { title: "Log Analyticsのクエリと表示", url: "https://cloud.google.com/logging/docs/analyze/query-and-view?hl=ja", note: "Logging内でSQL分析する機能の公式解説" },
        { title: "ログバケットの構成", url: "https://cloud.google.com/logging/docs/buckets?hl=ja" }
      ]
    },
    {
      name: "Pub/Sub経由の加工・外部連携構成",
      when: "機微情報のマスキングなど保存前の加工が必要、または外部のSIEMにもログを流したい場合",
      diagram: {
        cols: 6, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [4, 1] }
        ],
        nodes: [
          { id: "run", icon: "compute/cloud-run", label: "Cloud Run\n各サービス", col: 1, row: 0 },
          { id: "logging", icon: "ops/cloud-logging", label: "Cloud Logging\nログルーター", col: 2, row: 0 },
          { id: "pubsub", icon: "integration/pubsub", label: "Pub/Sub\n中継", col: 3, row: 0 },
          { id: "dflow", icon: "analytics/dataflow", label: "Dataflow\nマスキング加工", col: 4, row: 0 },
          { id: "bq", icon: "analytics/bigquery", label: "BigQuery\n加工済みログ", col: 4, row: 1 },
          { id: "siem", icon: "client/external-saas", label: "外部SIEM", col: 5, row: 0 }
        ],
        edges: [
          { from: "run", to: "logging", label: "自動収集" },
          { from: "logging", to: "pubsub", label: "Pub/Subシンク" },
          { from: "pubsub", to: "dflow", label: "購読" },
          { from: "dflow", to: "bq", label: "書き込み" },
          { from: "dflow", to: "siem", label: "転送" }
        ]
      },
      flow: [
        "ログルーターのシンク先をPub/Subにし、ログをメッセージとして流します",
        "Dataflowが購読し、個人情報のマスキングや形式変換などの加工を行ってからBigQueryへ書き込みます",
        "同じ流れから外部のSIEM（セキュリティログを統合監視する製品）へも転送できます"
      ],
      services: [
        { icon: "integration/pubsub", name: "Pub/Sub", role: "ログの中継点。複数の宛先への分配と、後段が止まったときのバッファを兼ねる" },
        { icon: "analytics/dataflow", name: "Dataflow", role: "保存前のマスキング・整形・振り分けを行うストリーム処理。ケース21と同じ技術の応用" },
        { icon: "analytics/bigquery", name: "BigQuery", role: "加工済みログの分析基盤" },
        { icon: "client/external-saas", name: "外部SIEM", role: "セキュリティチームが使う統合監視製品。GCP外のシステムと合わせた横断監視ができる" }
      ],
      points: [
        "シンクの直接転送では「保存する前に内容を書き換える」ことができません。個人情報を含むログをマスキングしてから貯めたい要件が出た時点で、この中継構成が必要になります",
        "Pub/Subを挟むことで宛先を後から増やせます。BigQueryとSIEMの二股のような分配は、この構成の得意技です",
        "Dataflowの常時起動費がかかるため、加工要件がないなら推奨構成のほうが安くシンプルです"
      ],
      pros: [
        "保存前のマスキング・整形・エンリッチができ、コンプライアンス要件に応えられる",
        "外部SIEMなどGCP外のシステムへの転送も同じ仕組みで実現できる"
      ],
      cons: [
        "Dataflowの常時起動費と実装・運用の手間が加わる",
        "加工パイプライン自体の障害がログ欠損につながるため、監視対象が増える"
      ],
      cost: "<strong>月3万〜10万円程度</strong>が目安。推奨構成の費用に加えて、Dataflowストリーミングジョブ（小規模で月2万〜6万円）とPub/Subの従量課金が乗ります。",
      references: [
        { title: "ルーティングとストレージの概要", url: "https://cloud.google.com/logging/docs/routing/overview?hl=ja" },
        { title: "Pub/Subの概要", url: "https://cloud.google.com/pubsub/docs/overview?hl=ja" },
        { title: "集約シンク", url: "https://cloud.google.com/logging/docs/export/aggregated_sinks?hl=ja", note: "組織・フォルダ単位でログを集約する方法" }
      ]
    }
  ],
  cost: "<p>推奨構成は月200GiB規模で<strong>月1.5万〜3万円程度</strong>。Log Analytics構成は二重保存が減り<strong>月1万〜2万円程度</strong>、加工が必要なPub/Sub経由構成はDataflow費用が乗って<strong>月3万〜10万円程度</strong>です。いずれもログ量に比例するため、除外フィルタでノイズを減らすことがどの構成でも最優先のコスト対策になります（東京リージョン・1USD=150円前後の目安）。</p>",
  summary: "<p>ログ基盤の設計は<strong>「検索はLogging、分析はBigQuery、保管はCloud Storage」という適材適所の振り分け</strong>に尽きます。全部を1か所に置くと検索性かコストのどちらかが破綻します。もう1つの柱は取り込み量の制御で、ヘルスチェックなどのノイズ除外がそのまま費用削減になります。エラー急増の検知はログベース指標+Cloud Monitoringで自動化し、人がログを見張る運用をなくしましょう。監視全体の設計はケース46、セキュリティ監査ログの扱いはケース47で扱います。</p>",
  quiz: [
    {
      q: "検索も分析も保管も、全部BigQueryに集約すれば置き場は1つで済みそうです。なぜ3か所に分けるのでしょうか。",
      a: "用途ごとに最適な道具が違うからです。障害調査ではLoggingのログエクスプローラの絞り込みや時系列表示が圧倒的に速く、SQLを書くBigQueryは即応調査には向きません。逆に数か月分のエラー傾向の集計は検索画面では無理でSQLの出番です。そして1年以上の保管はCloud Storageの低価格クラスが桁違いに安く済みます。3か所に分けるのは冗長なのではなく、検索性・分析力・保管単価をそれぞれ最良の道具で満たすための設計です。"
    },
    {
      q: "ログの取り込み費用が想定の3倍になっていました。あなたなら何から手を付けますか。",
      a: "まずどのサービスのどんなログが量を占めているかの内訳を調べます。経験上、ロードバランサーのヘルスチェック、アクセスログ、デバッグレベルのログが上位を占めがちです。その上でシンクの除外フィルタでノイズを取り込み前に落とし、アプリ側のログレベルを見直します。全量が監査に必要な場合でも、高価なLoggingやBigQueryには絞ったログだけを入れ、全量は安価なCloud Storageへ直行させる振り分けが有効です。"
    },
    {
      q: "エラーログを検知したら即通知、という設定にしたところ、チームが通知を無視するようになりました。何が起きていて、どう直すべきでしょうか。",
      a: "いわゆるアラート疲れです。ゼロにできない散発的なエラーで毎回通知が鳴ると、人は通知を信用しなくなり、本当の障害通知まで見逃します。直し方は、件数やエラー率のしきい値を設けて「急増したときだけ」通知する、重要度で通知先を分ける（緊急はオンコール、それ以外は翌朝確認のチャンネルへ）、対応不要と分かったエラーは発生源を修正するか除外する、の3点です。アラートは「鳴ったら必ず行動する」状態を保つことが監視設計の本質です。"
    }
  ]
});
