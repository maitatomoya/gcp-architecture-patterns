// ケース38：IoTセンサーデータ収集
registerCase({
  id: 38,
  category: "IoT・リアルタイム",
  title: "IoTセンサーデータ収集",
  scenario: "<p>工場の生産設備500台に温度・振動・電流のセンサーを取り付け、10秒間隔で計測値を送信します。設備の異常をダッシュボードで即座に把握し、蓄積したデータから故障の予兆を分析するのが目的です。工場は今後増える予定で、最終的には数千台規模になります。計測値の取りこぼしは異常検知の穴になるため許されません。なお、GCPにはかつてIoT Coreというデバイス管理サービスがありましたが、2023年に廃止されました。このケースはその廃止後の定石構成を学びます。</p>",
  requirements: [
    "数百〜数千台のデバイスからの時系列データを取りこぼさず受けたい",
    "送信のバーストや後段システムの一時障害でもデータを失いたくない",
    "設備ごとの直近の状態を数十ミリ秒で参照し、ダッシュボードに出したい",
    "全履歴をSQLで分析し、故障の予兆検知につなげたい",
    "パイプラインの詰まり（データ滞留）にすぐ気づけるようにしたい"
  ],
  main: {
    name: "Pub/Sub+Dataflowストリーミング構成",
    diagram: {
      cols: 5, rows: 3,
      groups: [
        { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [4, 2] }
      ],
      nodes: [
        { id: "mon", icon: "ops/cloud-monitoring", label: "Cloud Monitoring\n滞留を監視", col: 1, row: 0 },
        { id: "bt", icon: "database/bigtable", label: "Bigtable\n直近データ", col: 3, row: 0 },
        { id: "run", icon: "compute/cloud-run", label: "Cloud Run\nダッシュボードAPI", col: 4, row: 0 },
        { id: "devices", icon: "client/iot-device", label: "センサー\nデバイス群", col: 0, row: 1 },
        { id: "pubsub", icon: "integration/pubsub", label: "Pub/Sub\n取り込みの入口", col: 1, row: 1 },
        { id: "dataflow", icon: "analytics/dataflow", label: "Dataflow\nストリーム処理", col: 2, row: 1 },
        { id: "bq", icon: "analytics/bigquery", label: "BigQuery\n全量を蓄積", col: 3, row: 2 }
      ],
      edges: [
        { from: "devices", to: "pubsub", label: "計測値を送信" },
        { from: "pubsub", to: "dataflow", label: "pull" },
        { from: "dataflow", to: "bt", label: "最新状態" },
        { from: "dataflow", to: "bq", label: "履歴" },
        { from: "run", to: "bt", label: "低遅延参照" },
        { from: "pubsub", to: "mon", noArrow: true, dashed: true }
      ]
    },
    flow: [
      "各デバイスはサービスアカウント認証を使い、HTTPS経由でPub/Subへ計測値を直接publish（送信）します。IoT Core廃止後、MQTTが不要ならこの直接送信が公式に案内される定石です",
      "Pub/Subが取り込みの緩衝材（バッファ）になります。後段が一時的に止まってもメッセージは保持され、復旧後に続きから処理できるため、取りこぼしを防げます",
      "Dataflowがメッセージをpull（取り出し）し、重複排除・値の検証・単位変換などをストリーム処理しながら2系統へ書き分けます",
      "設備ごとの最新状態と直近データはBigtableへ書き込み、ダッシュボードAPIのCloud Runが数十ミリ秒で参照します",
      "全履歴はBigQueryへ蓄積し、故障予兆の分析をSQLで行います。Cloud MonitoringでPub/Subの未確認メッセージ数（滞留）を監視し、パイプラインの詰まりを検知します"
    ],
    services: [
      { icon: "integration/pubsub", name: "Pub/Sub", role: "大量メッセージの受け口と緩衝材。バーストを吸収し、処理されるまでメッセージを保持する" },
      { icon: "analytics/dataflow", name: "Dataflow", role: "ストリーム処理エンジン。重複排除・検証・変換をしながら流量に応じて自動スケールする" },
      { icon: "database/bigtable", name: "Bigtable", role: "時系列データに強いNoSQLデータベース。設備IDを指定した点参照をミリ秒級で返す" },
      { icon: "analytics/bigquery", name: "BigQuery", role: "全履歴の蓄積と分析。数億行の集計をSQLで数秒〜数十秒で処理する" },
      { icon: "compute/cloud-run", name: "Cloud Run", role: "ダッシュボードや他システム向けに直近データを返すAPI" },
      { icon: "ops/cloud-monitoring", name: "Cloud Monitoring", role: "滞留メッセージ数やパイプラインの遅延を監視し、しきい値超過でアラートを出す" }
    ],
    points: [
      "デバイスから直接データベースへ書かせず、Pub/Subを挟んでいます。受信とデータ処理を分離すると、送信のバーストや後段の障害・メンテナンスをPub/Subが吸収してくれるため、「取りこぼさない」という最重要要件を構造で満たせます",
      "書き込み先をBigtableとBigQueryの2系統に分けたのは、読み方がまったく違うからです。ダッシュボードは「この設備の今」を1点だけ速く読みたい（Bigtable向き）、予兆分析は「全設備の3か月分」を一括で集計したい（BigQuery向き）。1つのDBで両方を狙うとどちらも中途半端になります",
      "Bigtableの行キーは「設備ID+タイムスタンプ」の形にします。時刻を先頭にすると新着データが常に同じ領域へ集中して書き込みが詰まる（ホットスポット）ため、キー設計が性能を左右します",
      "Dataflowを挟むかは規模次第です。重複排除やウィンドウ集計（一定時間の窓で区切った集計）が必要な規模なら価値がありますが、小規模には過剰なので代替1のような簡略構成から始めるのが健全です"
    ],
    pros: [
      "後段の障害や再デプロイ中もPub/Subがデータを保持し、取りこぼしに強い",
      "デバイス数が数千台に増えても、Pub/SubとDataflowが自動でスケールする",
      "低遅延参照（Bigtable）と大規模分析（BigQuery）を両立できる",
      "滞留の監視により、障害を「データが消えた後」ではなく「詰まった時点」で検知できる"
    ],
    cons: [
      "Bigtableは最小構成でも月数万円の固定費があり、小規模には重い",
      "Dataflowのプログラミングモデル（Apache Beam）に学習コストがある",
      "構成要素が多く、少人数チームには運用の負担感がある",
      "MQTTしか話せないデバイスには別途ブローカーが必要（代替2）"
    ],
    cost: "<strong>月10万円前後から</strong>（東京リージョン・1USD=150円前後の概算）。内訳の目安は、Bigtable1ノードで約7万円、Dataflowの常時ストリーミングジョブで約2〜3万円、Pub/Subがメッセージ量に応じて数千円、BigQueryの保管・クエリが数千円です。Bigtableが支配的なので、直近参照の要件が緩いうちは代替1で10分の1以下に抑え、規模が育ってから移行する判断が現実的です。",
    references: [
      { title: "Pub/Subの概要", url: "https://cloud.google.com/pubsub/docs/overview?hl=ja" },
      { title: "コネクテッドデバイスアーキテクチャ", url: "https://cloud.google.com/architecture/connected-devices?hl=ja", note: "IoT Core廃止後の公式リファレンス" },
      { title: "Dataflowのストリーミングパイプライン", url: "https://cloud.google.com/dataflow/docs/concepts/streaming-pipelines?hl=ja" },
      { title: "Bigtableの時系列スキーマ設計", url: "https://cloud.google.com/bigtable/docs/schema-design-time-series?hl=ja", note: "行キー設計とホットスポット回避" }
    ]
  },
  alternatives: [
    {
      name: "Cloud Run直接受信の小規模構成",
      when: "デバイスが数百台まで・毎秒数十件程度で、変換処理も軽く、直近データの参照が数秒遅れでよい場合",
      diagram: {
        cols: 4, rows: 1,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [3, 0] }
        ],
        nodes: [
          { id: "devices", icon: "client/iot-device", label: "センサー\nデバイス群", col: 0, row: 0 },
          { id: "run", icon: "compute/cloud-run", label: "Cloud Run\n受信・検証", col: 1, row: 0 },
          { id: "bq", icon: "analytics/bigquery", label: "BigQuery\n蓄積・直近参照", col: 2, row: 0 },
          { id: "ls", icon: "analytics/looker-studio", label: "Looker Studio\nダッシュボード", col: 3, row: 0 }
        ],
        edges: [
          { from: "devices", to: "run", label: "HTTPS送信" },
          { from: "run", to: "bq", label: "直接書き込み" },
          { from: "bq", to: "ls", label: "可視化" }
        ]
      },
      flow: [
        "デバイスはHTTPSでCloud Runの受信APIへ計測値を送り、Cloud Runが認証と値の検証を行います",
        "検証済みのデータはBigQueryのStorage Write API（ストリーミングで直接書き込む高速なAPI）でそのまま蓄積します",
        "ダッシュボードはLooker StudioからBigQueryを直接参照します。数秒〜数十秒の鮮度で足りるなら、これで十分実用になります"
      ],
      services: [
        { icon: "compute/cloud-run", name: "Cloud Run", role: "受信・認証・検証を1つで担う。リクエスト量に応じて自動スケールする" },
        { icon: "analytics/bigquery", name: "BigQuery", role: "蓄積と参照を1つで兼ねる。この規模なら直近データの読み出しもBigQueryで間に合う" },
        { icon: "analytics/looker-studio", name: "Looker Studio", role: "無料で使えるBIツール。BigQueryをつなぐだけでダッシュボードができる" }
      ],
      points: [
        "BigtableとDataflowを持たないことで、固定費を月数千円まで下げています。設計の中心は「今の規模に必要なものだけ持つ」ことです",
        "Pub/Subがないぶん、Cloud Runの障害中に送られたデータはデバイス側の再送に頼ることになります。デバイスのファームウェアに再送処理を入れておくことが、この構成の取りこぼし対策です",
        "成長して限界が来たら、最初の改修は「デバイスの送信先をPub/Subへ変える」ことです。そこから推奨構成へ段階的に育てられるので、初期の作り込みを無駄にしません"
      ],
      pros: [
        "月数千円で始められ、構成要素が少なく理解しやすい",
        "サーバーレスだけで構成され、運用の手間がほぼない"
      ],
      cons: [
        "Cloud Run停止中の取りこぼし対策がデバイス側の再送頼みになる",
        "ミリ秒級の直近参照はできない（BigQueryは点参照が得意ではない）",
        "毎秒数百件を超えると、受信のさばきとコストの両面で限界が来る"
      ],
      cost: "<strong>月数百円〜数千円程度</strong>（東京リージョン・1USD=150円前後の概算）。Cloud RunとBigQueryのストリーミング書き込みはこの規模なら微額で、Looker Studioは無料です。推奨構成との差はほぼBigtableとDataflowの有無で説明できます。",
      references: [
        { title: "BigQuery Storage Write API", url: "https://cloud.google.com/bigquery/docs/write-api?hl=ja", note: "ストリーミング書き込みの公式ガイド" },
        { title: "Cloud Runとは", url: "https://cloud.google.com/run/docs/overview/what-is-cloud-run?hl=ja" }
      ]
    },
    {
      name: "GKE上のMQTTブローカー構成",
      when: "デバイスのファームウェアがMQTT前提で変更できない場合や、デバイスへのコマンド送信（双方向通信）が必要な場合",
      diagram: {
        cols: 5, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [4, 1] },
          { type: "vpc", label: "VPC", from: [2, 0], to: [2, 1], depth: 1 }
        ],
        nodes: [
          { id: "devices", icon: "client/iot-device", label: "MQTT\nデバイス群", col: 0, row: 0 },
          { id: "lb", icon: "network/cloud-load-balancing", label: "Cloud LB\nTCP振り分け", col: 1, row: 0 },
          { id: "gke", icon: "compute/gke", label: "GKE\nMQTTブローカー", col: 2, row: 0 },
          { id: "pubsub", icon: "integration/pubsub", label: "Pub/Sub\n以降は推奨構成へ", col: 3, row: 0 },
          { id: "nat", icon: "network/cloud-nat", label: "Cloud NAT\n外向き通信", col: 2, row: 1 }
        ],
        edges: [
          { from: "devices", to: "lb", label: "MQTT(TCP)" },
          { from: "lb", to: "gke", label: "転送" },
          { from: "gke", to: "pubsub", label: "橋渡し" },
          { from: "gke", to: "nat", noArrow: true, dashed: true }
        ]
      },
      flow: [
        "デバイスはMQTT（IoTで広く使われる軽量な常時接続プロトコル）で、TCPロードバランサ経由でGKE上のMQTTブローカー（EMQXやMosquitto等のOSS）へ接続します",
        "ブローカーが受けたメッセージはブリッジ機能でPub/Subへ転送し、以降のDataflow・Bigtable・BigQueryは推奨構成と同じ流れに乗せます",
        "デバイスへのコマンド送信は、ブローカーの購読トピックを通じて逆方向に届けます。GKEノードからの外向き通信はCloud NATを経由します"
      ],
      services: [
        { icon: "compute/gke", name: "GKE", role: "MQTTブローカーを動かすKubernetes基盤。ブローカーの冗長化・スケールを担う" },
        { icon: "network/cloud-load-balancing", name: "Cloud Load Balancing", role: "MQTTのTCP接続を複数のブローカーへ振り分ける入口" },
        { icon: "integration/pubsub", name: "Pub/Sub", role: "ブローカーとGCPの分析パイプラインをつなぐ橋。ここから先は推奨構成と共通" },
        { icon: "network/cloud-nat", name: "Cloud NAT", role: "VPC内のGKEノードが外部へ通信するための出口" }
      ],
      points: [
        "IoT Core廃止により、GCPにはマネージドのMQTTブローカーがありません。MQTTが必須なら自前運用（またはサードパーティのマネージドサービス）になる、という現状認識がこの構成の出発点です",
        "設計の本体はブローカーの高可用性です。デバイスは常時接続なので、ブローカーの再起動は数千台の一斉再接続を引き起こします。複数レプリカと接続の分散が必須です",
        "パイプライン側（Pub/Sub以降）を推奨構成と共通にしているため、MQTTデバイスとHTTPS直送デバイスが混在しても、分析基盤は1つで済みます。双方向制御を本格的に扱う設計はケース41で深掘りします"
      ],
      pros: [
        "既存デバイスのファームウェアを変更せずに接続できる",
        "コマンド送信などの双方向通信に対応できる"
      ],
      cons: [
        "ブローカーの可用性・スケール・パッチ適用の運用責任を自社で持つ",
        "GKEとブローカー運用のぶん、費用と必要スキルが増える"
      ],
      cost: "<strong>月3〜5万円程度から+推奨構成の費用</strong>（東京リージョン・1USD=150円前後の概算）。GKEの小規模ノードプールとロードバランサでこの程度かかり、後段のパイプライン費用は推奨構成と同じです。",
      references: [
        { title: "GKEの概要", url: "https://cloud.google.com/kubernetes-engine/docs/concepts/kubernetes-engine-overview?hl=ja" },
        { title: "コネクテッドデバイスアーキテクチャ", url: "https://cloud.google.com/architecture/connected-devices?hl=ja", note: "MQTTブローカーを含む構成例の公式ガイド" }
      ]
    }
  ],
  cost: "<p>推奨構成は<strong>月10万円前後から</strong>で、費用の大半をBigtableとDataflowが占めます。小規模なら代替1で<strong>月数千円</strong>に抑えられ、MQTT必須の場合は代替2でブローカー運用ぶんが上乗せになります。「取りこぼし耐性とミリ秒参照にいくら払うか」が判断軸で、いずれも東京リージョン・1USD=150円前後の目安です。</p>",
  summary: "<p>IoTデータ収集の定石は<strong>「受信・処理・保存を分離し、入口にPub/Subを置く」</strong>ことです。緩衝材が入口にあるだけで、バーストも後段障害もデータ喪失につながらなくなります。もう1つの学びは保存先の使い分けで、「1点を速く読む」Bigtableと「大量を一括で分析する」BigQueryは得意分野がまったく違うため、要件が両方あるなら2系統書き込みが正解になります。ただしこのフル構成は安くないので、規模が小さいうちは代替1で始めて、限界が見えたら入口から順に育てるのが現実的です。similarな骨格はケース40（位置情報）でも登場し、ストリーム分析の作法はケース21、双方向制御はケース41で学べます。</p>",
  quiz: [
    {
      q: "この構成では、デバイスからBigQueryやBigtableへ直接書き込ませず、必ずPub/Subを経由させています。直接書き込みと比べて何が良くなるのでしょうか。",
      a: "後段の状態とデータの受け取りを切り離せることです。直接書き込みでは、データベースの障害・メンテナンス・一時的な性能低下がそのまま取りこぼしになります。Pub/Subを挟めばメッセージは処理されるまで保持され、後段の復旧後に続きから処理できます。送信バーストの吸収役にもなるため、「取りこぼさない」という要件を運用の頑張りではなく構造で満たせるのが利点です。"
    },
    {
      q: "保存先をBigtableとBigQueryの2つに分けているのはなぜでしょうか。1つのデータベースにまとめた場合の問題も含めて説明してください。",
      a: "読み方が正反対だからです。ダッシュボードは特定設備の最新値を1点だけミリ秒で読みたく、これはBigtableの得意分野です。一方の予兆分析は全設備の数か月分を一括集計したく、これはBigQueryの得意分野です。BigQueryだけにすると点参照が遅く割高になり、Bigtableだけにすると自由なSQL集計ができません。用途ごとに最適な保存先へ同じデータを書き分けるのは、データ基盤設計の基本パターンです。"
    },
    {
      q: "まだデバイスが50台しかない立ち上げ期だとしたら、あなたはどの構成で始めますか。理由も説明してください。",
      a: "代替1のCloud Run+BigQuery直接書き込みで始めるのが妥当です。50台・10秒間隔なら毎秒数件程度で、月数千円で十分に受け切れ、Bigtableの固定費月数万円を正当化できる要件がまだありません。ただし将来の移行を見越して、デバイス側に再送処理を実装し、送信部分を差し替えやすい作りにしておきます。限界が見えたら送信先をPub/Subに変えるところから推奨構成へ育てます。最初からフル構成を組むのではなく、成長に合わせて段階的に投資するのが実務的な判断です。"
    }
  ]
});
