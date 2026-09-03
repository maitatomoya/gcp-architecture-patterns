// ケース13：ゲームバックエンド
registerCase({
  id: 13,
  category: "Webアプリ・EC",
  title: "ゲームバックエンド",
  scenario: "<p>スマホ向けのリアルタイム対戦ゲーム（4人同時対戦・1試合約5分）のバックエンドを設計したい。同時接続は平常時で数千、イベント時には数万を見込む。対戦中は低遅延の常時接続が必要で、試合結果やアイテム付与ではデータの不整合（アイテムの重複付与・巻き戻り）が許されない。時間帯によるアクセス差が大きく、将来は海外展開も視野に入れている状況です。</p>",
  requirements: [
    "対戦中は低遅延の常時接続通信ができること",
    "マッチング（対戦相手の組み合わせ）を数秒以内に完了したい",
    "試合結果・アイテムなどのデータ整合性を厳密に守りたい",
    "イベント時のスパイクに合わせてサーバーを自動増減したい",
    "プレイログを分析してゲームバランス調整に活かしたい"
  ],
  main: {
    name: "GKE+Spanner+Memorystore構成",
    diagram: {
      cols: 5, rows: 3,
      groups: [
        { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [4, 2] },
        { type: "gke-cluster", label: "GKEクラスタ", from: [2, 0], to: [2, 1], depth: 1 }
      ],
      nodes: [
        { id: "gsrv", icon: "compute/gke", label: "ゲームサーバー\n常駐Pod群", col: 2, row: 0 },
        { id: "ps", icon: "integration/pubsub", label: "Pub/Sub\nプレイログ", col: 3, row: 0 },
        { id: "bq", icon: "analytics/bigquery", label: "BigQuery\n分析基盤", col: 4, row: 0 },
        { id: "users", icon: "client/mobile-client", label: "プレイヤー", col: 0, row: 1 },
        { id: "lb", icon: "network/cloud-load-balancing", label: "Cloud LB\nAPI入口", col: 1, row: 1 },
        { id: "api", icon: "compute/gke", label: "APIサーバー\nマッチング", col: 2, row: 1 },
        { id: "spanner", icon: "database/spanner", label: "Spanner\nプレイヤーデータ", col: 3, row: 1 },
        { id: "mem", icon: "database/memorystore", label: "Memorystore\n待機列/セッション", col: 2, row: 2 }
      ],
      edges: [
        { from: "users", to: "lb", label: "ログイン/API" },
        { from: "lb", to: "api" },
        { from: "api", to: "spanner", label: "プレイヤーデータ" },
        { from: "api", to: "mem", label: "マッチング状態" },
        { from: "users", to: "gsrv", label: "対戦通信" },
        { from: "gsrv", to: "spanner", label: "結果保存" },
        { from: "gsrv", to: "ps", label: "イベント発行" },
        { from: "ps", to: "bq", label: "分析へ連携" }
      ]
    },
    flow: [
      "プレイヤーはCloud Load Balancing経由でGKE上のAPIサーバーにログインし、対戦相手を要求する",
      "APIサーバーはMemorystoreの待機列でプレイヤーを組み合わせ、空いているゲームサーバーPodを1つ割り当てて接続先を返す",
      "プレイヤーは割り当てられたゲームサーバーへ直接接続し、試合中は低遅延の常時接続で通信する",
      "試合結果・アイテム付与はゲームサーバーがSpannerへトランザクションで保存し、不正や重複を防ぐ",
      "プレイ中のイベントログはPub/Subへ発行し、BigQueryサブスクリプションで分析基盤へ流し込む"
    ],
    services: [
      { icon: "compute/gke", name: "GKE", role: "マッチングAPIと対戦用ゲームサーバーを動かすKubernetes基盤。負荷に応じたPod・ノードの自動増減を担う" },
      { icon: "database/spanner", name: "Spanner", role: "プレイヤーデータの保存先。強整合性と水平スケールを両立し、将来のマルチリージョン展開にも対応する分散RDB" },
      { icon: "database/memorystore", name: "Memorystore", role: "マッチング待機列・セッション・ランキングなど、ミリ秒応答が必要な揮発データを持つインメモリストア（Redis互換）" },
      { icon: "integration/pubsub", name: "Pub/Sub", role: "プレイログの受け口。ゲームサーバーから分析基盤へのイベント配送を疎結合にする" },
      { icon: "analytics/bigquery", name: "BigQuery", role: "プレイログの分析基盤。ゲームバランス調整や不正検知のクエリを担う" },
      { icon: "network/cloud-load-balancing", name: "Cloud Load Balancing", role: "ログイン・マッチングAPIの入り口。対戦通信そのものはここを通らない点に注意" }
    ],
    points: [
      "リアルタイム対戦の本体であるゲームサーバーは「状態を持つ常駐プロセス」で、リクエスト応答型のCloud Runとは相性が悪いため、GKEで常駐Podとして動かします。これがこのケースでGKEを選ぶ最大の理由です",
      "ゲームサーバーへの接続をLBで分散していないのは意図的です。試合の状態は特定のPodのメモリ上にあるため、マッチング時にサーバーを割り当てて直接接続させます。実運用ではAgonesのようなゲームサーバー管理の仕組みをGKEに載せ、UDP接続の割り当てやPodの保護を任せるのが定番です",
      "Spannerを選んだのは、アイテム重複付与のような不整合を強整合トランザクションで防ぎつつ、プレイヤー数の成長に水平スケールで追従でき、海外展開時にマルチリージョン構成へ移行できるためです。小規模ならCloud SQLで十分です（代替パターン2）",
      "分析はBigQueryに寄せるのがGCPの定石です。Pub/SubのBigQueryサブスクリプションを使うと、取り込みコードを書かずにログを流し込めます"
    ],
    pros: [
      "常時接続・状態保持というゲーム特有の要件に正面から対応できる",
      "Spannerによりデータ整合性とスケールの両立ができ、成長時のDB移行が不要",
      "イベント時はGKEのオートスケールでゲームサーバーを自動増設できる",
      "プレイログ分析までの経路が最初から組み込まれている"
    ],
    cons: [
      "Kubernetes・Agones等の運用スキルが必要で、学習コストが高い",
      "Spanner・GKE・Memorystoreはいずれも固定費があり、小規模タイトルには過剰",
      "マッチングやサーバー割り当てのロジックは自作が必要で、実装量が多い",
      "対戦プロトコル（UDP/WebSocket等）の設計・チューニングは別途必要"
    ],
    cost: "<strong>月7万円〜15万円程度から</strong>。内訳の目安はGKEノード（e2-standard-4を3台）約4万5,000円+クラスタ管理料約1万1,000円+Spanner（最小100処理ユニット）約1万円+Memorystore（基本階層1GB）約5,000円+LB約3,000円。同時接続数万規模ではノード追加でさらに増えます。東京リージョン・1USD=150円前後での概算です。",
    references: [
      { title: "GKEの概要", url: "https://cloud.google.com/kubernetes-engine/docs/concepts/kubernetes-engine-overview?hl=ja" },
      { title: "Spannerの概要", url: "https://cloud.google.com/spanner/docs/overview?hl=ja", note: "強整合性と水平スケールを両立する仕組みの解説" },
      { title: "Memorystore for Redisの概要", url: "https://cloud.google.com/memorystore/docs/redis/redis-overview?hl=ja" },
      { title: "Google Cloudのゲームソリューション", url: "https://cloud.google.com/solutions/games?hl=ja", note: "ゲーム業界向けの構成例・事例集" },
      { title: "パススルーNetwork Load Balancer", url: "https://cloud.google.com/load-balancing/docs/network?hl=ja", note: "UDP等の対戦通信を負荷分散する場合に使う" }
    ]
  },
  alternatives: [
    {
      name: "Cloud Run+Firestoreのターン制ゲーム構成",
      when: "リアルタイムの常時接続が不要なターン制・非同期対戦（将棋・パズルの手番制など）の場合",
      diagram: {
        cols: 3, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [2, 1] }
        ],
        nodes: [
          { id: "users", icon: "client/mobile-client", label: "プレイヤー", col: 0, row: 0 },
          { id: "run", icon: "compute/cloud-run", label: "Cloud Run\nゲームAPI", col: 1, row: 0 },
          { id: "fstr", icon: "database/firestore", label: "Firestore\n対局/プレイヤー", col: 2, row: 0 },
          { id: "fcm", icon: "integration/fcm", label: "FCM\nプッシュ通知", col: 1, row: 1 }
        ],
        edges: [
          { from: "users", to: "run", label: "手を送信" },
          { from: "run", to: "fstr", label: "対局状態を保存" },
          { from: "run", to: "fcm" },
          { from: "fcm", to: "users", label: "手番通知" }
        ]
      },
      flow: [
        "プレイヤーの一手はCloud RunのゲームAPIが検証し、Firestoreの対局ドキュメントへトランザクションで保存する",
        "相手プレイヤーのアプリはFirestoreのリアルタイムリスナーで盤面の変化を即座に受け取る",
        "アプリを閉じている相手にはFCMのプッシュ通知で手番が来たことを知らせる"
      ],
      services: [
        { icon: "compute/cloud-run", name: "Cloud Run", role: "手の検証・勝敗判定などのゲームロジック。リクエスト応答型で完全従量課金" },
        { icon: "database/firestore", name: "Firestore", role: "対局状態・プレイヤーデータの保存先。リアルタイムリスナーで盤面同期も担う" },
        { icon: "integration/fcm", name: "Firebase Cloud Messaging", role: "手番が来たことを知らせるプッシュ通知" }
      ],
      points: [
        "手番制なら「相手の操作が数百ミリ秒遅れて見える」ことが問題にならないため、常駐サーバーを持たずFirestoreの同期機能だけで対戦を成立させられます",
        "ゲームサーバーが不要になると、インフラはほぼ全て従量課金になり、遊ばれていない時間のコストが消えます。個人開発や小規模タイトルの現実解です",
        "不正対策として、手の検証は必ずCloud Run側で行い、クライアントからFirestoreを直接書き換えさせない設計にします"
      ],
      pros: [
        "サーバー費用がほぼ従量課金になり、小規模なら月数百円で運用できる",
        "Kubernetesの運用知識が不要で、少人数でも作り切れる",
        "Firestoreのリアルタイムリスナーで盤面同期の実装量が激減する"
      ],
      cons: [
        "1秒未満の応答が求められるアクション性の高い対戦には使えない",
        "同時対戦人数や1試合のデータ量が増えると読み書き課金が膨らむ",
        "リクエスト応答型のため、サーバー主導の演出やティック処理（一定間隔の状態更新）は作りにくい"
      ],
      cost: "<strong>月数百円〜5,000円程度</strong>。Cloud Run・Firestore・FCMの無料枠が大きく、小規模タイトルならほぼ無料枠内に収まります。GKE構成と比べて2桁小さい費用で始められるのが最大の利点です。",
      references: [
        { title: "Firestoreのドキュメント", url: "https://firebase.google.com/docs/firestore?hl=ja" },
        { title: "Firebase Cloud Messaging", url: "https://firebase.google.com/docs/cloud-messaging?hl=ja" }
      ]
    },
    {
      name: "Compute Engine(MIG)+Cloud SQL構成",
      when: "コンテナ運用に慣れていないチームが中小規模のリアルタイムゲームを運用する場合",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [3, 1] },
          { type: "mig", label: "MIG自動スケール", from: [2, 0], to: [2, 0], depth: 1 }
        ],
        nodes: [
          { id: "users", icon: "client/mobile-client", label: "プレイヤー", col: 0, row: 0 },
          { id: "gce", icon: "compute/compute-engine", label: "ゲームサーバー\nVM群", col: 2, row: 0 },
          { id: "api", icon: "compute/cloud-run", label: "Cloud Run\nマッチングAPI", col: 1, row: 1 },
          { id: "sql", icon: "database/cloud-sql", label: "Cloud SQL\nプレイヤーデータ", col: 3, row: 1 }
        ],
        edges: [
          { from: "users", to: "gce", label: "対戦通信" },
          { from: "users", to: "api", label: "マッチング要求" },
          { from: "api", to: "gce", label: "サーバー割当" },
          { from: "api", to: "sql", label: "プレイヤーデータ" },
          { from: "gce", to: "sql", label: "結果保存" }
        ]
      },
      flow: [
        "マッチングAPI（Cloud Run）がプレイヤーを組み合わせ、MIG（マネージドインスタンスグループ：VMの自動スケール範囲）内の空きVMを割り当てる",
        "プレイヤーは割り当てられたVM上のゲームサーバーへ直接接続して対戦する",
        "試合結果はゲームサーバーがCloud SQLへトランザクションで保存する"
      ],
      services: [
        { icon: "compute/compute-engine", name: "Compute Engine", role: "ゲームサーバーを動かす仮想マシン。MIGでテンプレートから自動増減させる" },
        { icon: "compute/cloud-run", name: "Cloud Run", role: "マッチング・ロビーなどのAPI部分。リクエスト応答型の処理はサーバーレスに寄せる" },
        { icon: "database/cloud-sql", name: "Cloud SQL", role: "プレイヤーデータ・試合結果の保存先。単一リージョンの中小規模ならSpannerより安価で十分" }
      ],
      points: [
        "「常駐が必要なゲームサーバーだけVM、それ以外はサーバーレス」という割り切りで、Kubernetesを学ばずにリアルタイムゲームを運用できます",
        "SpannerではなくCloud SQLを選べるのは規模が読めるからです。単一リージョン・数万人規模まではCloud SQLで十分で、費用は1桁下がります",
        "VMのスケールイン（縮小）時に対戦中のサーバーを止めない工夫（試合終了までインスタンスを保護する設定や排出処理）が必要になります。この課題を仕組みで解決してくれるのがGKE+Agonesです"
      ],
      pros: [
        "Kubernetes不要で、VMの知識だけで運用に入れる",
        "Cloud SQL採用によりデータベース費用をSpannerの数分の1に抑えられる",
        "MIGのオートスケールでイベント時の増設は自動化できる"
      ],
      cons: [
        "OSパッチ・ミドルウェア管理などVM運用の手間を負い続ける",
        "スケールイン時に対戦中セッションを守る制御を自作する必要がある",
        "成長して海外展開する段階でGKE+Spanner構成への作り直しが視野に入る"
      ],
      cost: "<strong>月2万円〜4万円程度</strong>。内訳の目安はゲームサーバーVM（e2-medium2台〜）約7,000円+Cloud SQL約8,000円+Cloud Run数百円〜。VM台数はプレイヤー数に比例して増えますが、Spanner・GKE管理料が無いぶん初期は大幅に安く済みます。",
      references: [
        { title: "インスタンスグループの概要", url: "https://cloud.google.com/compute/docs/instance-groups?hl=ja", note: "MIGによる自動スケールの仕組み" },
        { title: "インスタンスの自動スケーリング", url: "https://cloud.google.com/compute/docs/autoscaler?hl=ja" }
      ]
    }
  ],
  cost: "<p>本命のGKE+Spanner構成は<strong>月7万円〜15万円程度から</strong>と固定費が大きく、事業として成立する規模のタイトル向けです。ターン制ならFirestore案で<strong>月数百円〜</strong>、中小規模のリアルタイム対戦ならMIG案で<strong>月2万円〜4万円程度</strong>が目安です（東京リージョン・1USD=150円前後）。<strong>ゲームの通信特性（常時接続かどうか）と規模の見通しが、構成もコストも桁で変える</strong>ことがこのケースの特徴です。</p>",
  summary: "<p>ゲームバックエンドの分かれ目は「リアルタイム常時接続が必要か」です。必要なら<strong>状態を持つ常駐サーバーが必須になり、GKE（+Agones）が本命</strong>。不要なターン制ならFirestoreの同期機能でサーバーレスに寄せられます。もう1つの学びはデータベース選定で、<strong>強整合性・水平スケール・マルチリージョンの3つが揃って初めてSpannerを選ぶ</strong>価値が出ます。リアルタイム同期の技術はケース39、コンテナ基盤の選定基準はケース45、マルチリージョン展開はケース49で深掘りします。</p>",
  quiz: [
    {
      q: "APIサーバーはCloud Runでもよさそうなのに、ゲームサーバーはGKEで動かしています。ゲームサーバーをCloud Runにできない本質的な理由は何でしょうか。",
      a: "対戦中の試合状態が特定サーバーのメモリ上に存在し続ける「ステートフルな常駐プロセス」だからです。Cloud Runはリクエスト応答型でインスタンスの生存や接続先を制御できず、任意のUDP通信やインスタンス指定の接続にも向きません。マッチングでサーバーを割り当てて直接接続させ、試合が終わるまでそのプロセスを維持する、という制御にはGKEのような基盤が必要です。"
    },
    {
      q: "プレイヤーデータの保存先としてSpannerを選びましたが、Cloud SQLとの判断基準はどこにあるのでしょうか。",
      a: "判断軸は整合性・スケール・リージョン展開の3つです。強整合トランザクションはどちらも提供するため、実際の分かれ目は「単一インスタンスの性能限界を超える書き込み規模になるか」と「マルチリージョンで低遅延に読み書きしたいか」です。この2つが視野に入るならSpanner、単一リージョンで数万人規模までならCloud SQLで十分で費用も1桁安くなります。最初からSpannerにするか、成長後に移行するかはデータ移行コストとの天秤です。"
    },
    {
      q: "海外展開が決まり、北米・欧州のプレイヤーにも快適に遊んでもらう必要が出ました。あなたならこの構成のどこを変えますか。",
      a: "対戦の遅延を決めるゲームサーバーを各地域のリージョンに配置し、プレイヤーを最寄りのサーバーへマッチングさせるのが第一手です。プレイヤーデータはSpannerのマルチリージョン構成に移行し、どの地域からも一貫したデータを読み書きできるようにします。APIの入り口はグローバル外部LBがそのまま各地域へ振り分けてくれます。最初にSpannerを選んでおいたことがここで効いてくる、という設計の伏線回収です。詳細はケース49で扱います。"
    }
  ]
});
