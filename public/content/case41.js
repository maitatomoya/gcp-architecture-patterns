// ケース41：スマートデバイス双方向制御
registerCase({
  id: 41,
  category: "IoT・リアルタイム",
  title: "スマートデバイス双方向制御",
  scenario: "<p>業務用空調・照明設備を製造するメーカーで、全国に設置された数万台のデバイスをクラウドから管理したい。温度や稼働状態を常時収集するだけでなく、管理画面からの電源操作・設定変更・ファームウェア更新指示を<strong>デバイスへ即時に届ける双方向通信</strong>が必須です。デバイスは省電力マイコンで、IoT向けの軽量な出版購読型プロトコルであるMQTTで通信します。かつての定番だったGoogle CloudのIoT Coreは2023年8月に提供終了したため、その後の定石である「自前または外部のMQTTブローカー＋Pub/Sub」構成を組みます。バックエンド担当は3人です。</p>",
  requirements: [
    "サーバーからデバイスへコマンドを即時に届けたい（ポーリング不可）",
    "デバイス側の制約からMQTT対応が必須",
    "数万台の常時接続を安定して維持したい",
    "デバイスの最新状態を管理画面から即座に参照したい",
    "デバイスごとの認証と鍵の安全な管理が必要"
  ],
  main: {
    name: "GKE上のMQTTブローカー+Pub/Sub構成",
    diagram: {
      cols: 6, rows: 3,
      groups: [
        { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [5, 2] },
        { type: "vpc", label: "VPCネットワーク", from: [2, 0], to: [3, 1], depth: 1 },
        { type: "gke-cluster", label: "GKEクラスタ", from: [2, 1], to: [3, 1], depth: 2 }
      ],
      nodes: [
        { id: "device", icon: "client/iot-device", label: "IoTデバイス\n現場の設備", col: 0, row: 1 },
        { id: "app", icon: "client/client", label: "管理アプリ\n操作画面", col: 0, row: 2 },
        { id: "kms", icon: "security/cloud-kms", label: "Cloud KMS\nデバイス鍵保護", col: 1, row: 0 },
        { id: "lb", icon: "network/cloud-load-balancing", label: "Cloud LB\nTCPパススルー", col: 1, row: 1 },
        { id: "broker", icon: "compute/gke", label: "MQTTブローカー\n常時接続を維持", col: 2, row: 1 },
        { id: "bridge", icon: "compute/gke", label: "ブリッジ\nPub/Sub連携", col: 3, row: 1 },
        { id: "pubsubT", icon: "integration/pubsub", label: "Pub/Sub\nテレメトリ", col: 4, row: 1 },
        { id: "runProc", icon: "compute/cloud-run", label: "Cloud Run\n受信処理", col: 5, row: 1 },
        { id: "fs", icon: "database/firestore", label: "Firestore\nデバイス状態", col: 5, row: 0 },
        { id: "runApi", icon: "compute/cloud-run", label: "Cloud Run\nコマンドAPI", col: 1, row: 2 },
        { id: "pubsubC", icon: "integration/pubsub", label: "Pub/Sub\nコマンド", col: 3, row: 2 }
      ],
      edges: [
        { from: "device", to: "lb", label: "MQTT/TLS" },
        { from: "lb", to: "broker" },
        { from: "broker", to: "bridge" },
        { from: "bridge", to: "pubsubT", label: "計測データ発行" },
        { from: "pubsubT", to: "runProc", label: "push配信" },
        { from: "runProc", to: "fs", label: "状態を更新" },
        { from: "app", to: "runApi", label: "コマンド送信" },
        { from: "runApi", to: "pubsubC", label: "コマンド発行" },
        { from: "pubsubC", to: "bridge", label: "購読して転送" },
        { from: "kms", to: "broker", noArrow: true, dashed: true }
      ]
    },
    flow: [
      "デバイスは出荷時に書き込んだ秘密鍵でTLS相互認証し、TCPパススルー型のCloud Load Balancing経由でGKE上のMQTTブローカーへ常時接続を張る",
      "デバイスからの計測データ（テレメトリ）はブローカーが受け取り、ブリッジがPub/Subのテレメトリトピックへ発行する",
      "Pub/SubがCloud Runへpush配信し、Cloud RunがFirestoreに持つデバイスごとの最新状態（デバイスシャドウ）を更新する。管理アプリはリアルタイムリスナーで即座に反映を受け取る",
      "管理アプリからのコマンドはCloud RunのコマンドAPIが受け、Pub/Subのコマンドトピックへ発行する",
      "ブリッジがコマンドを購読してブローカーへ渡し、確立済みのMQTT接続を通じてデバイスへ即時に届く"
    ],
    services: [
      { icon: "compute/gke", name: "GKE", role: "MQTTブローカー（EMQXなどのOSS）とPub/Sub連携ブリッジを動かすKubernetes基盤。数万台の常時接続を維持する常駐ワークロードの置き場所" },
      { icon: "network/cloud-load-balancing", name: "Cloud Load Balancing", role: "MQTTのTCP接続をそのままブローカーへ渡すパススルー型ロードバランサ。接続の入口を1つにまとめる" },
      { icon: "integration/pubsub", name: "Pub/Sub", role: "テレメトリとコマンドの中継役。ブローカーとバックエンドを疎結合にし、急増するメッセージも取りこぼさず貯める" },
      { icon: "compute/cloud-run", name: "Cloud Run", role: "テレメトリの受信処理と、管理アプリ向けコマンドAPI。リクエスト応答型の処理はサーバーレスに任せる" },
      { icon: "database/firestore", name: "Firestore", role: "デバイスごとの最新状態を1ドキュメントで保持（デバイスシャドウ）。管理アプリへのリアルタイム反映もリスナー機能で実現" },
      { icon: "security/cloud-kms", name: "Cloud KMS", role: "デバイス認証に使うCA鍵や秘密鍵を保護する鍵管理サービス。鍵そのものを取り出さずに署名・検証できる" }
    ],
    points: [
      "MQTTブローカーをCloud RunでなくGKEに置いたのは、数万台が接続を張りっぱなしにする常駐型ワークロードだから。Cloud Runはリクエストが来たら起動して応答したら終わるモデルが基本で、大量の長時間接続を安く維持する用途には合わない",
      "ブローカーとバックエンドの間にPub/Subを挟むのは疎結合にするため。受信処理が一時停止してもメッセージはPub/Subに貯まり、後から分析基盤（ケース38）など購読者を追加しても送信側は変更不要になる",
      "Firestoreには全履歴ではなく最新状態だけを持たせる。時系列の生データを貯めたい場合はケース38のようにBigQueryやBigtableへ流す役割分担が定石",
      "この図にCloud NATが無いのは、GKEノードからの外向き通信がPub/SubなどGoogle APIに限られ、VPCの限定公開のGoogleアクセスで完結するため。外部SaaSへの通信が必要になったらCloud NATを追加する"
    ],
    pros: [
      "確立済みのMQTT接続を使うため、サーバーからのコマンドがポーリングなしで即時に届く",
      "ブローカーとバックエンドがPub/Subで疎結合になり、処理や分析の追加が容易",
      "MQTTは業界標準プロトコルで、デバイス側のライブラリや実装資産が豊富",
      "ブローカーの台数・設定を自分で制御でき、接続数の増加に合わせた設計ができる"
    ],
    cons: [
      "GKEクラスタとブローカーの運用（バージョンアップ・監視・スケール設計）を自分たちで担う必要がある",
      "常時稼働のためアイドル時もクラスタとノードの費用がかかる",
      "接続数が増えたときのブローカーのスケールアウト（セッションの分散）は設計難度が高い"
    ],
    cost: "<strong>月3万円〜8万円程度</strong>（数万台・毎分1メッセージ規模の目安。東京リージョン・1USD=150円換算）。内訳はGKEクラスタ管理手数料約11,000円（1クラスタ分の無料クレジットあり）＋ブローカー用ノード1〜3万円、Cloud Load Balancing約3,000円〜、Pub/SubとCloud Run・Firestoreは従量で数千円〜。台数とメッセージ頻度でPub/Sub費用が大きく変わります。",
    references: [
      { title: "コネクテッドデバイスのアーキテクチャ", url: "https://cloud.google.com/architecture/connected-devices?hl=ja", note: "IoT Core提供終了後の公式アーキテクチャガイド集" },
      { title: "MQTTブローカーのアーキテクチャ", url: "https://cloud.google.com/architecture/connected-devices/mqtt-broker-architecture?hl=ja", note: "この構成そのものの公式解説" },
      { title: "Pub/Subの概要", url: "https://cloud.google.com/pubsub/docs/overview?hl=ja" },
      { title: "GKEの概要", url: "https://cloud.google.com/kubernetes-engine/docs/concepts/kubernetes-engine-overview?hl=ja" },
      { title: "Cloud Key Management Serviceの概要", url: "https://cloud.google.com/kms/docs/key-management-service?hl=ja" }
    ]
  },
  alternatives: [
    {
      name: "Firestoreリアルタイムリスナー方式",
      when: "デバイスが数百台規模で、Wi-Fi接続の高機能機器（HTTPSとSDKが使える）の場合",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [3, 1] }
        ],
        nodes: [
          { id: "device", icon: "client/iot-device", label: "IoTデバイス\nSDKで接続", col: 0, row: 0 },
          { id: "app", icon: "client/client", label: "管理アプリ", col: 0, row: 1 },
          { id: "fs", icon: "database/firestore", label: "Firestore\n状態/コマンド", col: 1, row: 0 },
          { id: "fn", icon: "compute/cloud-functions", label: "Cloud Functions\n変更に反応", col: 2, row: 0 },
          { id: "bq", icon: "analytics/bigquery", label: "BigQuery\n履歴蓄積", col: 3, row: 0 }
        ],
        edges: [
          { from: "device", to: "fs", label: "読み書きと購読" },
          { from: "app", to: "fs", label: "コマンド書込" },
          { from: "fs", to: "fn", label: "変更トリガー" },
          { from: "fn", to: "bq", label: "履歴を蓄積" }
        ]
      },
      flow: [
        "デバイスはFirebase SDKでFirestoreへ直接接続し、自分の状態ドキュメントを定期的に更新する",
        "管理アプリはコマンド用ドキュメントに指示内容を書き込む",
        "デバイスは自分宛てのコマンドドキュメントをリアルタイムリスナーで監視しており、書き込みが即座にプッシュで届く",
        "Cloud FunctionsがFirestoreの変更をトリガーに集計や通知を行い、履歴をBigQueryへ蓄積する"
      ],
      services: [
        { icon: "database/firestore", name: "Firestore", role: "状態とコマンドの置き場所。リアルタイムリスナーがサーバープッシュの役割を果たし、MQTT基盤なしで双方向を実現する" },
        { icon: "compute/cloud-functions", name: "Cloud Functions", role: "Firestoreの書き込みをトリガーに動く小さな処理。集計・異常検知・通知などを担う" },
        { icon: "analytics/bigquery", name: "BigQuery", role: "状態変化の履歴を貯めて分析する列指向データウェアハウス" }
      ],
      points: [
        "MQTT基盤を一切持たずに双方向通信を実現できる。リスナーによるプッシュ配信はFirestoreの標準機能なので、実装はSDKの数行で済む",
        "セキュリティルールで「デバイスは自分のドキュメントだけ読み書き可」と宣言的に制限でき、認証はIdentity Platformやカスタムトークンと組み合わせる",
        "台数とメッセージ頻度が増えるとFirestoreの書き込み課金が支配的になる。数千台・高頻度になったら推奨構成への移行を検討する"
      ],
      pros: [
        "サーバー運用がゼロで、初期実装が圧倒的に速い",
        "小規模ならほぼ無料枠内で動く",
        "管理アプリへの状態反映も同じリスナー機構で完結する"
      ],
      cons: [
        "MQTT非対応。省電力マイコンや不安定な回線のデバイスには不向き",
        "台数・頻度が増えると書き込み課金で割高になる",
        "配信品質（QoS）や接続状態の細かい制御はできない"
      ],
      cost: "<strong>月数百円〜数千円</strong>（数百台・毎分更新程度の目安）。Firestoreの読み書き回数とCloud Functionsの実行時間の従量課金が中心で、無料枠に収まる規模も多い。",
      references: [
        { title: "Firestoreドキュメント", url: "https://cloud.google.com/firestore/docs?hl=ja" },
        { title: "Cloud Firestore（Firebaseドキュメント）", url: "https://firebase.google.com/docs/firestore?hl=ja", note: "リアルタイムリスナーやセキュリティルールの解説" }
      ]
    },
    {
      name: "パートナー製マネージドMQTT+Pub/Sub連携",
      when: "MQTTは必須だが、ブローカーの運用を自分たちで持ちたくない場合",
      diagram: {
        cols: 5, rows: 2,
        groups: [
          { type: "external", label: "外部SaaS", from: [1, 1], to: [1, 1] },
          { type: "gcp-cloud", label: "Google Cloud", from: [2, 0], to: [4, 1] }
        ],
        nodes: [
          { id: "app", icon: "client/client", label: "管理アプリ", col: 0, row: 0 },
          { id: "device", icon: "client/iot-device", label: "IoTデバイス", col: 0, row: 1 },
          { id: "mqtt", icon: "client/external-saas", label: "マネージド\nMQTTブローカー", col: 1, row: 1 },
          { id: "pubsubC", icon: "integration/pubsub", label: "Pub/Sub\nコマンド", col: 2, row: 0 },
          { id: "pubsubT", icon: "integration/pubsub", label: "Pub/Sub\nテレメトリ", col: 2, row: 1 },
          { id: "run", icon: "compute/cloud-run", label: "Cloud Run\n処理/コマンドAPI", col: 3, row: 1 },
          { id: "fs", icon: "database/firestore", label: "Firestore\nデバイス状態", col: 4, row: 1 }
        ],
        edges: [
          { from: "device", to: "mqtt", label: "MQTT/TLS" },
          { from: "mqtt", to: "pubsubT", label: "テレメトリ連携" },
          { from: "pubsubT", to: "run", label: "push配信" },
          { from: "run", to: "fs", label: "状態を更新" },
          { from: "app", to: "run", label: "コマンド送信" },
          { from: "run", to: "pubsubC", label: "コマンド発行" },
          { from: "pubsubC", to: "mqtt" }
        ]
      },
      flow: [
        "デバイスはパートナー企業が提供するマネージドMQTTブローカー（SaaS）へ接続する",
        "SaaSの連携機能が、受信したテレメトリをGCP側のPub/Subへ流し込む",
        "以降は推奨構成と同じで、Cloud Runが処理しFirestoreの状態を更新する",
        "コマンドはCloud RunからPub/Subのコマンドトピックへ発行し、SaaSが購読してMQTTでデバイスへ届ける"
      ],
      services: [
        { icon: "client/external-saas", name: "マネージドMQTTブローカー（パートナーSaaS）", role: "MQTT接続の維持・スケール・可用性をSLA付きで提供する外部サービス。デバイス管理やファームウェア配信機能を持つ製品もある" },
        { icon: "integration/pubsub", name: "Pub/Sub", role: "SaaSとGCP内部の橋渡し。ここから先の構成を推奨構成と共通化できる" },
        { icon: "compute/cloud-run", name: "Cloud Run", role: "テレメトリ処理とコマンドAPI" },
        { icon: "database/firestore", name: "Firestore", role: "デバイスの最新状態の保持" }
      ],
      points: [
        "IoT Coreの提供終了後、Google自身がパートナー製品の利用を移行先として案内している経緯があり、素直な選択肢のひとつ",
        "Pub/Subから先はGCP側の推奨構成とほぼ同じにできるため、将来自前ブローカー運用（推奨構成）へ切り替える道も残る",
        "障害時の切り分けが自社とSaaSの2社にまたがる点、データが外部サービスを経由する点は契約・コンプライアンス面の確認が必要"
      ],
      pros: [
        "ブローカーの運用負荷がゼロになり、少人数チームでも回せる",
        "デバイス登録管理やOTA更新などIoT専門機能を最初から使える"
      ],
      cons: [
        "SaaS利用料が接続台数に応じてかかり、大規模では割高になりやすい",
        "外部サービス起因の障害・仕様変更の影響を受ける",
        "データ経路が外部を通るため、契約やセキュリティ要件の確認が必要"
      ],
      cost: "<strong>月数万円〜</strong>（SaaS利用料が主で、プランと接続台数に依存）。GCP側はPub/Sub・Cloud Run・Firestoreの従量で月数千円〜。",
      references: [
        { title: "コネクテッドデバイスのアーキテクチャ", url: "https://cloud.google.com/architecture/connected-devices?hl=ja", note: "パートナー製品を含む選択肢の整理" },
        { title: "デバイスからPub/Subへの直接接続アーキテクチャ", url: "https://cloud.google.com/architecture/connected-devices/device-pubsub-architecture?hl=ja", note: "MQTTを使わずPub/Subへ直接送る派生パターン" },
        { title: "Pub/Subの概要", url: "https://cloud.google.com/pubsub/docs/overview?hl=ja" }
      ]
    }
  ],
  cost: "<p>推奨構成は<strong>月3万円〜8万円程度</strong>（数万台規模）で、GKEとノードの固定費が下限を作ります。Firestoreリスナー方式は<strong>月数百円〜数千円</strong>と圧倒的に安いものの、MQTT非対応で数百台規模まで。パートナーSaaS方式は<strong>月数万円〜</strong>でブローカー運用をゼロにできますが、台数が増えるほど自前運用より割高になっていきます。台数・プロトコル・運用体制の3点で決まります。</p>",
  summary: "<p>双方向制御の核心は「サーバーからデバイスへ即時に届ける経路」をどう作るかです。MQTTの常時接続は<strong>常駐型ワークロード</strong>なので、リクエスト応答型のCloud Runではなく、常駐が得意なGKEや外部SaaSにブローカーを置きます。一方でバックエンド処理はPub/Subで疎結合にしてサーバーレスに寄せるのがGCP流です。収集だけならケース38の構成で足りるところに「双方向」という要件が加わった瞬間、ブローカーという登場人物が必要になる。この分かれ目を覚えておきましょう。</p>",
  quiz: [
    {
      q: "MQTTブローカーをCloud RunでなくGKEに置いたのはなぜでしょうか。Cloud Runもコンテナを動かせるのに、です。",
      a: "MQTTブローカーは数万台のデバイスと接続を張りっぱなしにする常駐型ワークロードだからです。Cloud Runはリクエストが来たときに起動し応答したら課金が終わるモデルが基本で、大量の長時間接続を維持する用途では課金モデルもスケールの仕組みも合いません。常駐・常時接続という言葉が出たら、GKEやCompute Engineなど常駐が前提の基盤を検討するのが判断の型です。"
    },
    {
      q: "ブローカーが受けたテレメトリを、Cloud Runへ直接HTTPで送らずPub/Subを挟んでいます。この一手間にはどんな価値がありますか。",
      a: "疎結合とバッファリングの価値があります。受信処理側の障害やデプロイ中でもメッセージはPub/Subに貯まって失われず、処理再開後に追いつけます。また将来分析基盤や異常検知など購読者を追加するとき、ブローカー側は一切変更不要です。送り手と受け手を直結せず間にキューを挟む設計は、ケース15やケース38とも共通するイベント駆動の基本形です。"
    },
    {
      q: "あなたのプロダクトはWi-Fi接続のスマート家電300台で、デバイスにはHTTPSとFirebase SDKが載せられます。この場合も推奨構成にすべきでしょうか。",
      a: "この規模と条件ならFirestoreリスナー方式が合理的です。300台であればFirestoreの課金は月数百円規模で、GKEクラスタとブローカー運用の固定費・人件費を払う理由がありません。リアルタイムリスナーでコマンドの即時配信も実現できます。台数が数千台を超える、省電力マイコンでMQTTが必須になる、といった変化が見えた時点で推奨構成への移行を検討すれば十分です。"
    }
  ]
});
