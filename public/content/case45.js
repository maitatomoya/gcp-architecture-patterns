// ケース45：コンテナ基盤選定（Cloud Run vs GKE）
registerCase({
  id: 45,
  category: "運用・セキュリティ・信頼性",
  title: "コンテナ基盤選定（Cloud Run vs GKE）",
  scenario: "<p>新規Webサービスのコンテナ実行基盤を選定するフェーズ。バックエンドエンジニアは4人でSRE専任はいません。当面はHTTPのAPIとWeb配信が中心ですが、将来はリアルタイム機能や常駐ワーカーの構想もあります。GCPのコンテナ基盤は大きくCloud Run（サーバーレス）とGKE（Kubernetes）の2択で、<strong>どちらを選ぶかはGCP設計の最頻出の分かれ道</strong>です。このケースでは「まずCloud Run」という定石と、GKEへ倒れる条件を判断基準ごと学びます。</p>",
  requirements: [
    "HTTPリクエスト処理のAPI/Web配信が当面の中心",
    "ノード管理やアップグレードに運用の人手を割けない",
    "アクセスはほぼゼロの時間帯から急なスパイクまで振れる",
    "アイドル時のコストをできるだけゼロに近づけたい",
    "将来の常駐処理や特殊な要件にも道を残したい"
  ],
  main: {
    name: "Cloud Run中心のサーバーレス構成",
    diagram: {
      cols: 4, rows: 2,
      groups: [
        { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [3, 1] }
      ],
      nodes: [
        { id: "users", icon: "client/users", label: "ユーザー", col: 0, row: 1 },
        { id: "lb", icon: "network/cloud-load-balancing", label: "Cloud LB\nHTTPS終端", col: 1, row: 1 },
        { id: "runWeb", icon: "compute/cloud-run", label: "Cloud Run\nWeb配信", col: 2, row: 0 },
        { id: "runApi", icon: "compute/cloud-run", label: "Cloud Run\nAPI", col: 2, row: 1 },
        { id: "ar", icon: "devtools/artifact-registry", label: "Artifact Registry\nイメージ保管", col: 3, row: 0 },
        { id: "mon", icon: "ops/cloud-monitoring", label: "Cloud Monitoring\n自動で収集", col: 3, row: 1 }
      ],
      edges: [
        { from: "users", to: "lb", label: "HTTPS" },
        { from: "lb", to: "runWeb", label: "パスで振り分け" },
        { from: "lb", to: "runApi" },
        { from: "ar", to: "runWeb", label: "イメージ配備", dashed: true },
        { from: "runApi", to: "mon", label: "メトリクス/ログ", dashed: true }
      ]
    },
    flow: [
      "ユーザーのHTTPSリクエストはCloud Load Balancingが受け、サーバーレスNEG（LBとサーバーレスサービスをつなぐ仕組み）経由でCloud Runへ転送する",
      "Web配信とAPIは別々のCloud Runサービスに分け、それぞれ独立にスケール・デプロイする",
      "各サービスはArtifact Registryのコンテナイメージから起動し、リクエスト量に応じてゼロ〜数百インスタンスまで自動で増減する",
      "メトリクスとログは追加の仕込みなしでCloud MonitoringとCloud Loggingに集まり、少人数でも監視を始められる"
    ],
    services: [
      { icon: "compute/cloud-run", name: "Cloud Run", role: "コンテナのサーバーレス実行環境。リクエスト応答型のワークロードなら、スケールもパッチもGoogleに任せられる" },
      { icon: "network/cloud-load-balancing", name: "Cloud Load Balancing", role: "独自ドメイン・複数サービスのパスルーティング・Cloud ArmorやCDNの追加口。グローバルLBを1つ置くだけで済むのがGCPの特徴" },
      { icon: "devtools/artifact-registry", name: "Artifact Registry", role: "コンテナイメージの保管庫。どの基盤を選んでもここは共通で使う" },
      { icon: "ops/cloud-monitoring", name: "Cloud Monitoring", role: "リクエスト数・レイテンシなどのメトリクスを自動収集。ダッシュボードとアラートの土台" }
    ],
    points: [
      "迷ったらCloud Runから始めるのがGCPの定石。リクエスト応答型でステートレス（状態をコンテナ内に持たない）なら要件を満たし、運用の大半をGoogleへ委譲できる。ケース7のMVP構成と同じ思想",
      "ゼロスケール（リクエストが無ければインスタンス0台＝ほぼ無料）はGKEでは実現しにくいCloud Run最大の強み。スパイク型のトラフィックと相性がよい",
      "LBを頭に置いたのは独自ドメイン・Cloud Armor・CDN・複数サービスのルーティングのため。試作段階ならCloud Run標準のURLを直接公開してLBを省略してもよい",
      "コンテナで作っておく限り、後からGKEへ載せ替える道は常に残る。基盤選定を「やり直せる決定」にしておくことが、この段階で最も重要な設計判断"
    ],
    pros: [
      "ノード・クラスタの運用がゼロで、少人数チームの手が空く",
      "ゼロスケールでアイドル時の費用がほぼゼロ",
      "リビジョン単位のデプロイ・ロールバック・トラフィック分割が標準機能",
      "スパイクへの自動スケールが速く、キャパシティ設計が不要"
    ],
    cons: [
      "常駐プロセスやサイドカー構成などKubernetes特有の柔軟さはない",
      "リクエスト処理の外で動くバックグラウンド処理に制約がある",
      "1リクエストの最大処理時間などプラットフォームの上限がある",
      "WebSocketは使えるが、大量の常時接続を安く維持する用途には向かない"
    ],
    cost: "<strong>月0円〜数千円</strong>（小規模・スパイク型の目安。東京リージョン・1USD=150円換算）。リクエスト処理中のCPU・メモリ秒課金で無料枠も大きく、アイドル時はほぼゼロ。Cloud Load Balancingを置くと月3,000円程度の固定費が加わります。",
    references: [
      { title: "Cloud Runとは", url: "https://cloud.google.com/run/docs/overview/what-is-cloud-run?hl=ja" },
      { title: "アプリケーションホスティングオプションの比較", url: "https://cloud.google.com/hosting-options?hl=ja", note: "GCPの実行基盤全体の公式比較" },
      { title: "サーバーレスNEGによるロードバランシング", url: "https://cloud.google.com/load-balancing/docs/https/setting-up-https-serverless?hl=ja" },
      { title: "Cloud Monitoringドキュメント", url: "https://cloud.google.com/monitoring/docs?hl=ja" }
    ]
  },
  alternatives: [
    {
      name: "GKE Autopilot構成",
      when: "サイドカーや常駐ワーカー、Podレベルの細かい制御、Kubernetesエコシステムが必要になった場合",
      diagram: {
        cols: 6, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [4, 1] },
          { type: "vpc", label: "VPCネットワーク", from: [2, 0], to: [3, 1], depth: 1 },
          { type: "gke-cluster", label: "GKEクラスタ", from: [2, 1], to: [3, 1], depth: 2 }
        ],
        nodes: [
          { id: "users", icon: "client/users", label: "ユーザー", col: 0, row: 1 },
          { id: "lb", icon: "network/cloud-load-balancing", label: "Cloud LB\nGatewayで構成", col: 1, row: 1 },
          { id: "web", icon: "compute/gke-autopilot", label: "Webサービス\nPod", col: 2, row: 1 },
          { id: "worker", icon: "compute/gke-autopilot", label: "常駐ワーカー\nPod", col: 3, row: 1 },
          { id: "nat", icon: "network/cloud-nat", label: "Cloud NAT\n外向き通信", col: 3, row: 0 },
          { id: "ar", icon: "devtools/artifact-registry", label: "Artifact Registry\nイメージ保管", col: 4, row: 1 },
          { id: "ext", icon: "client/external-saas", label: "外部API\nSaaS", col: 5, row: 0 }
        ],
        edges: [
          { from: "users", to: "lb", label: "HTTPS" },
          { from: "lb", to: "web", label: "ルーティング" },
          { from: "web", to: "worker", label: "内部通信" },
          { from: "worker", to: "nat", label: "外部呼び出し" },
          { from: "nat", to: "ext", label: "NAT経由" },
          { from: "ar", to: "worker", label: "イメージ配備", dashed: true }
        ]
      },
      flow: [
        "リクエストはGKEのGateway機能で構成したCloud Load BalancingからVPC内のPodへ届く",
        "WebサービスPodと常駐ワーカーPodが同じクラスタで動き、クラスタ内部の通信で連携する",
        "プライベートなノードから外部SaaSへの外向き通信はCloud NATを経由する",
        "Autopilotがノードの確保・スケール・セキュリティパッチを自動で行い、利用者はPodの定義に集中する"
      ],
      services: [
        { icon: "compute/gke-autopilot", name: "GKE Autopilot", role: "ノード運用をGoogleに任せるモードのKubernetes。Pod単位の課金で、クラスタ管理の負荷を大きく下げる" },
        { icon: "network/cloud-load-balancing", name: "Cloud Load Balancing", role: "GKEのGateway/Ingressから自動構成される入口" },
        { icon: "network/cloud-nat", name: "Cloud NAT", role: "プライベートなノードからの外向き通信の出口。サーバーレス構成には無かった登場人物" },
        { icon: "devtools/artifact-registry", name: "Artifact Registry", role: "イメージ保管。推奨構成と共通" }
      ],
      points: [
        "AutopilotはKubernetesのAPIをそのままに、ノード管理という最も重い運用を消した選択肢。GKEを選ぶ場合の第一候補にしてよい",
        "常駐ワーカー・サイドカー・DaemonSet・大量のWebSocket常時接続など、Cloud Runの制約に当たった要件の受け皿になる",
        "推奨構成に無かったVPCとCloud NATが登場している点に注目。Kubernetesを選ぶことはネットワーク設計の責任も引き受けることを意味する",
        "ゼロスケールはせず、クラスタ管理手数料とPod分の費用がアイドル時もかかる"
      ],
      pros: [
        "Kubernetesの表現力で常駐・特殊ワークロードに対応できる",
        "ノード管理不要でGKE Standardより運用負荷が大幅に低い",
        "Kubernetesの知識・マニフェスト資産・OSSエコシステムがそのまま使える"
      ],
      cons: [
        "Cloud RunよりKubernetes概念の学習コストが高い",
        "アイドル時も費用が発生しゼロスケールしない",
        "マニフェストやGateway設定など管理するコードと設定が増える"
      ],
      cost: "<strong>月1.5万円〜</strong>。クラスタ管理手数料約11,000円（1クラスタ分の無料クレジットあり）に加え、Podが要求したCPU・メモリ分の従量課金が常時かかる。小規模Webでは推奨構成より明確に高い。",
      references: [
        { title: "GKE Autopilotの概要", url: "https://cloud.google.com/kubernetes-engine/docs/concepts/autopilot-overview?hl=ja" },
        { title: "GKEとCloud Run", url: "https://cloud.google.com/kubernetes-engine/docs/concepts/gke-and-cloud-run?hl=ja", note: "両者の使い分けの公式解説" },
        { title: "GKEの概要", url: "https://cloud.google.com/kubernetes-engine/docs/concepts/kubernetes-engine-overview?hl=ja" }
      ]
    },
    {
      name: "Cloud Run+GKE併用構成",
      when: "API系はCloud Runで足りるが、一部だけ常駐処理や特殊なワークロードがある場合",
      diagram: {
        cols: 5, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [4, 1] },
          { type: "vpc", label: "VPCネットワーク", from: [4, 0], to: [4, 1], depth: 1 },
          { type: "gke-cluster", label: "GKEクラスタ", from: [4, 1], to: [4, 1], depth: 2 }
        ],
        nodes: [
          { id: "users", icon: "client/users", label: "ユーザー", col: 0, row: 1 },
          { id: "lb", icon: "network/cloud-load-balancing", label: "Cloud LB\nHTTPS終端", col: 1, row: 1 },
          { id: "run", icon: "compute/cloud-run", label: "Cloud Run\nWeb/API", col: 2, row: 1 },
          { id: "pubsub", icon: "integration/pubsub", label: "Pub/Sub\nジョブ受け渡し", col: 3, row: 1 },
          { id: "gkew", icon: "compute/gke", label: "GKE\n常駐/特殊処理", col: 4, row: 1 }
        ],
        edges: [
          { from: "users", to: "lb", label: "HTTPS" },
          { from: "lb", to: "run" },
          { from: "run", to: "pubsub", label: "重い処理を依頼" },
          { from: "pubsub", to: "gkew", label: "購読して実行" }
        ]
      },
      flow: [
        "ユーザー向けのWebとAPIはCloud Runで受け、ゼロスケールの恩恵を受ける",
        "常駐が必要な処理や特殊なワークロードだけをGKE上のワーカーに置く",
        "両者はPub/Subを介して疎結合につなぎ、互いのデプロイや障害が直接波及しないようにする",
        "GKE側の外向き通信がPub/SubなどGoogle APIだけなら、限定公開のGoogleアクセスで完結しCloud NATを省略できる"
      ],
      services: [
        { icon: "compute/cloud-run", name: "Cloud Run", role: "リクエスト応答型のWeb/API担当。トラフィックの大半をサーバーレスで処理する" },
        { icon: "compute/gke", name: "GKE", role: "常駐ワーカーや特殊要件のワークロード専用の基盤。範囲を絞って運用負荷を最小にする" },
        { icon: "integration/pubsub", name: "Pub/Sub", role: "2つの基盤をつなぐ疎結合の接着剤。片方の載せ替えが他方に波及しない" },
        { icon: "network/cloud-load-balancing", name: "Cloud Load Balancing", role: "ユーザー向けの入口。Cloud RunとGKE双方をバックエンドにできる" }
      ],
      points: [
        "全ワークロードをどちらかへ寄せる必要はない。ワークロードごとに適した基盤を選ぶのがコンテナ時代の設計で、実務ではこの併用が最も多い着地点のひとつ",
        "Pub/Subを挟む疎結合はケース19のイベント駆動と同じ考え方。同期呼び出しでつなぐと片方の障害が連鎖する",
        "代償は2基盤分の運用知識と監視。GKE側の範囲を意識的に小さく保つことが持続のコツ"
      ],
      pros: [
        "大半のトラフィックをサーバーレスの低コストで処理しつつ、特殊要件にも対応できる",
        "段階的にGKEへ移行する（またはGKEから撤退する）途中の形としても機能する"
      ],
      cons: [
        "2つの基盤の運用知識・監視・デプロイ手順が必要になる",
        "構成の説明コストが上がり、チームの認知負荷が増える"
      ],
      cost: "<strong>月1.5万円〜+従量</strong>。Cloud Run側はほぼ従量のみ、GKE側はクラスタ管理手数料とワーカー分が常時かかる合算。GKEの守備範囲を絞るほど安くなる。",
      references: [
        { title: "GKEとCloud Run", url: "https://cloud.google.com/kubernetes-engine/docs/concepts/gke-and-cloud-run?hl=ja" },
        { title: "Pub/Subの概要", url: "https://cloud.google.com/pubsub/docs/overview?hl=ja" }
      ]
    }
  ],
  cost: "<p>小規模のWeb/APIなら推奨構成が<strong>月0円〜数千円</strong>（+LB約3,000円）で圧倒的に安く、GKE Autopilotは<strong>月1.5万円〜</strong>の固定費が下限になります。常時高負荷になるとCloud Runの従量課金が積み上がり差は縮むため、<strong>負荷が常時張り付くほどGKEが、スパイク型ほどCloud Runが有利</strong>という関係を覚えておきましょう。</p>",
  summary: "<p>コンテナ基盤選定の定石は「<strong>まずCloud Run、GKEは要件が求めたときだけ</strong>」です。分かれ目になるのはリクエスト応答型か常駐型かというワークロードの性質で、サイドカー・DaemonSet・大量の常時接続・Podレベルの制御といった言葉が要件に出てきたらGKE（まずAutopilot）を検討します。どちらを選んでもArtifact RegistryとCloud Load Balancingは共通で、コンテナである限り載せ替えは可能。つまりこれは一発勝負ではなく、やり直せる意思決定です。ケース7・ケース13・ケース41で実際の使い分けの現場を見られます。</p>",
  quiz: [
    {
      q: "現在Cloud Runで動いているサービスに、どのような要件が加わったらGKEへの移行を検討すべきでしょうか。具体例を2つ以上挙げてください。",
      a: "例えば、リクエストと無関係に動き続ける常駐ワーカーが必要になったとき、全Podに監視エージェントを配るDaemonSetやサイドカーを使いたいとき、数万件のWebSocket常時接続を安く維持したいとき、GPUやPod配置の細かい制御が必要になったときなどです。共通点は「リクエスト応答型・ステートレス」というCloud Runの前提から外れることです。逆に言えば、この前提の中にいる限りGKEへ移す理由はほぼありません。"
    },
    {
      q: "GKEを選ぶ場合にAutopilotが第一候補になるのはなぜですか。Standardとの違いから説明してください。",
      a: "Standardはノード（実体の仮想マシン）のサイズ選定・台数管理・アップグレードを利用者が担いますが、Autopilotはそこを全部Googleに任せ、Podが要求したリソース分だけ課金される方式です。Kubernetesを選ぶ理由の多くはPodレベルの表現力であって、ノード運用がしたいわけではありません。SRE専任がいないチームなら、Kubernetesの利点だけを取りに行けるAutopilotから始め、特殊なノード要件が出たときだけStandardを検討するのが合理的です。"
    },
    {
      q: "あなたのチームに「リアルタイムチャットを追加したい。WebSocketで10万同時接続を見込む」という要件が来ました。既存のAPIはCloud Runで動いています。どう設計しますか。",
      a: "既存のAPIはCloud Runのまま残し、チャット部分だけを分けて考えます。Cloud RunもWebSocketに対応していますが、10万本の常時接続はインスタンスが張り付き接続時間分の課金が続くため、常駐型が得意なGKEに接続維持サーバーを置く併用構成が候補になります。さらにその前に、ケース39のようにFirestoreのリアルタイムリスナーで要件を満たせれば接続維持そのものを持たずに済みます。全面移行ではなくワークロード単位で基盤を選ぶのが実務的な答えです。"
    }
  ]
});
