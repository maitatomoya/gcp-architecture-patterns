// ケース8：中規模ECサイト
registerCase({
  id: 8,
  category: "Webアプリ・EC",
  title: "中規模ECサイト",
  scenario: "<p>月商数千万円規模のECサイトをGCPで組みます。平常時は秒間数十リクエストですが、セール開始の瞬間だけ数十倍のスパイク（急激なアクセス増）が来ます。注文と決済は1件も取りこぼせず、二重注文も許されません。カード情報は決済代行サービスに任せる前提です。エンジニアは4人で、インフラ専任はいません。ケース7のMVP構成が成長した先の姿として読んでください。</p>",
  requirements: [
    "セール開始時のスパイクに耐える（平常時の数十倍）",
    "注文・決済処理は確実に実行する（取りこぼし・二重実行の防止）",
    "商品ページの表示は速く保つ（表示速度は売上に直結）",
    "データベースは障害があっても短時間で復旧してほしい",
    "SQLインジェクションなどの攻撃から入口で守りたい",
    "インフラ専任なしで運用できるマネージド中心の構成にしたい"
  ],
  main: {
    name: "Cloud Run+Cloud SQL（HA）+キャッシュ・キュー構成",
    diagram: {
      cols: 6, rows: 3,
      groups: [
        { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [5, 2] },
        { type: "zone", label: "ゾーンa", from: [4, 1], to: [4, 1], depth: 1 },
        { type: "zone", label: "ゾーンb", from: [5, 1], to: [5, 1], depth: 1 }
      ],
      nodes: [
        { id: "users", icon: "client/users", label: "購入者", col: 0, row: 1 },
        { id: "armor", icon: "network/cloud-armor", label: "Cloud Armor\nWAF", col: 1, row: 0 },
        { id: "lb", icon: "network/cloud-load-balancing", label: "Cloud LB\nHTTPS終端", col: 1, row: 1 },
        { id: "cdn", icon: "network/cloud-cdn", label: "Cloud CDN\n商品画像", col: 2, row: 0 },
        { id: "run", icon: "compute/cloud-run", label: "Cloud Run\nECアプリ", col: 2, row: 1 },
        { id: "mem", icon: "database/memorystore", label: "Memorystore\nRedis", col: 3, row: 0 },
        { id: "tasks", icon: "integration/cloud-tasks", label: "Cloud Tasks\nジョブキュー", col: 2, row: 2 },
        { id: "worker", icon: "compute/cloud-run", label: "Cloud Run\nワーカー", col: 3, row: 2 },
        { id: "sqlp", icon: "database/cloud-sql", label: "Cloud SQL\nプライマリ", col: 4, row: 1 },
        { id: "sqls", icon: "database/cloud-sql", label: "Cloud SQL\nスタンバイ", col: 5, row: 1 }
      ],
      edges: [
        { from: "users", to: "lb", label: "HTTPS" },
        { from: "armor", to: "lb", noArrow: true, dashed: true },
        { from: "cdn", to: "lb", noArrow: true, dashed: true },
        { from: "lb", to: "run", label: "動的リクエスト" },
        { from: "run", to: "mem", label: "カート・セッション" },
        { from: "run", to: "sqlp", label: "注文の書き込み" },
        { from: "run", to: "tasks", label: "後処理を登録" },
        { from: "tasks", to: "worker", label: "HTTPプッシュ" },
        { from: "worker", to: "sqlp", label: "在庫・履歴更新" },
        { from: "sqlp", to: "sqls", label: "同期レプリケーション", dashed: true }
      ]
    },
    flow: [
      "リクエストはグローバル外部ロードバランサで受け、Cloud ArmorがSQLインジェクションなどの攻撃パターンや特定IPからの異常アクセスを入口で遮断します",
      "商品画像やCSSはCloud CDNがエッジから返し、動的リクエストだけがCloud Runに届きます。Cloud Runはスパイクに合わせて自動でインスタンスを増やします",
      "カートやセッション、商品情報のキャッシュはMemorystore（Redis）に置き、Cloud SQLへの読み取り負荷を減らします",
      "注文確定は最小限の処理（注文レコードの書き込みと決済代行の呼び出し）だけを同期で行い、Cloud SQLプライマリへ書き込みます",
      "確認メール送信・ポイント付与・出荷連携などの後処理はCloud Tasksに登録し、ワーカーが1件ずつリトライつきで実行します。プライマリ障害時はスタンバイへ自動フェイルオーバーします"
    ],
    services: [
      { icon: "network/cloud-load-balancing", name: "Cloud Load Balancing", role: "HTTPSの終端と負荷分散。Cloud CDNとCloud Armorはこのロードバランサに紐づけて有効化する" },
      { icon: "network/cloud-armor", name: "Cloud Armor", role: "WAF（Webアプリケーションファイアウォール）。攻撃パターンの遮断・IP制限・レート制限を入口で行う" },
      { icon: "network/cloud-cdn", name: "Cloud CDN", role: "商品画像などをエッジでキャッシュ配信し、表示速度とオリジン負荷を同時に改善する" },
      { icon: "compute/cloud-run", name: "Cloud Run", role: "ECアプリ本体とワーカーの実行基盤。リクエスト量に応じた自動スケールでスパイクを受け止める" },
      { icon: "database/memorystore", name: "Memorystore for Redis", role: "マネージドなインメモリキャッシュ。カート・セッション・商品キャッシュを高速に読み書きする" },
      { icon: "database/cloud-sql", name: "Cloud SQL（HA構成）", role: "注文・在庫・会員の正本データ。同一リージョン内の別ゾーンに同期スタンバイを持ち、障害時に自動フェイルオーバーする" },
      { icon: "integration/cloud-tasks", name: "Cloud Tasks", role: "後処理のジョブキュー。実行先URLへのHTTPプッシュ・自動リトライ・実行レート制御を担う" }
    ],
    points: [
      "注文処理を「同期でやること」と「あとでよいこと」に分けるのがこのケースの核心です。同期処理を最小にするほどスパイク時の応答が安定し、後処理はCloud Tasksのリトライに任せることで取りこぼしを防げます",
      "非同期の部品にPub/SubではなくCloud Tasksを選んだのは、特定のURLへ1件ずつ届けたい・失敗時のリトライ間隔や実行レートを細かく制御したい・二重実行をタスク名で抑止したいという要件がキュー型と相性が良いためです。イベントを複数の購読者へ広く配るのが目的ならPub/Sub（ケース15）を選びます",
      "Cloud SQLのHA構成は、同一リージョン内の別ゾーンに同期スタンバイを立てる仕組みで、インスタンス費用が実質2倍になります。注文データを扱うECでは「ゾーン障害で数時間止まる」損失のほうが大きいと判断して採用しました",
      "セール開始直後のコールドスタートを避けるため、Cloud Runの最小インスタンス数をセール前に引き上げておきます（固定費との引き換えです）。MemorystoreやCloud SQLへの接続はプライベートなネットワーク経由で、教材の図では線1本に省略しています"
    ],
    pros: [
      "スパイク対応（Cloud Run+CDN）と確実な注文処理（Cloud Tasks）を両立できる",
      "ゾーン障害でもCloud SQLが自動フェイルオーバーし、短時間で復旧する",
      "WAF・CDN・キャッシュ・キューがすべてマネージドで、インフラ専任なしでも運用できる",
      "ケース7の構成からの自然な増築であり、作り直しなしで到達できる"
    ],
    cons: [
      "HA構成でCloud SQLの費用が2倍になる（可用性への保険料）",
      "キャッシュを挟むぶん「古いデータが見える」問題への設計（無効化のタイミング）が必要になる",
      "同期/非同期の分割やべき等性（同じ処理を2回実行しても結果が変わらない性質）の実装など、アプリ側の設計難易度が上がる",
      "部品が増えたぶん、どこで何が起きたかを追う監視の整備（ケース46）が前提になる"
    ],
    cost: "<strong>月5万円〜15万円程度</strong>が目安です。中心はCloud SQLのHA構成（2vCPU/8GBクラスで月3万円前後、HAでその2倍）で、Memorystoreの最小構成が月5,000円前後、Cloud Runは最小インスタンス確保分を含めて月数千円〜数万円、Cloud Armor・CDN・ロードバランサが合わせて月数千円程度です。セール規模やトラフィックで大きく変動します。東京リージョン・1USD=150円前後の概算です。",
    references: [
      { title: "Cloud SQLの高可用性構成について", url: "https://cloud.google.com/sql/docs/mysql/high-availability?hl=ja", note: "HA構成と自動フェイルオーバーの公式解説" },
      { title: "Memorystore for Redisの概要", url: "https://cloud.google.com/memorystore/docs/redis/redis-overview?hl=ja" },
      { title: "Cloud Tasksドキュメント", url: "https://cloud.google.com/tasks/docs?hl=ja", note: "キューのリトライ・レート制御の仕組み" },
      { title: "Cloud Armorの概要", url: "https://cloud.google.com/armor/docs/cloud-armor-overview?hl=ja" },
      { title: "Cloud CDNの概要", url: "https://cloud.google.com/cdn/docs/overview?hl=ja" }
    ]
  },
  alternatives: [
    {
      name: "GKE Autopilot構成",
      when: "サービスを複数チームで分割開発する、サイドカーや常駐処理などCloud Runに収まらない要件が増えてきた場合",
      diagram: {
        cols: 6, rows: 3,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [5, 2] },
          { type: "vpc", label: "VPCネットワーク", from: [2, 0], to: [4, 2], depth: 1 },
          { type: "gke-cluster", label: "GKEクラスタ", from: [2, 1], to: [3, 2], depth: 2 }
        ],
        nodes: [
          { id: "psp", icon: "client/external-saas", label: "決済代行\nサービス", col: 0, row: 0 },
          { id: "users", icon: "client/users", label: "購入者", col: 0, row: 1 },
          { id: "lb", icon: "network/cloud-load-balancing", label: "Cloud LB\nHTTPS終端", col: 1, row: 1 },
          { id: "front", icon: "compute/gke-autopilot", label: "フロントAPI\nPod群", col: 2, row: 1 },
          { id: "api", icon: "compute/gke-autopilot", label: "注文サービス\nPod群", col: 3, row: 1 },
          { id: "nat", icon: "network/cloud-nat", label: "Cloud NAT\n外向き通信", col: 4, row: 0 },
          { id: "sql", icon: "database/cloud-sql", label: "Cloud SQL\nHA構成", col: 5, row: 1 },
          { id: "mem", icon: "database/memorystore", label: "Memorystore\nRedis", col: 5, row: 2 }
        ],
        edges: [
          { from: "users", to: "lb", label: "HTTPS" },
          { from: "lb", to: "front", label: "リクエスト" },
          { from: "front", to: "api", label: "内部通信" },
          { from: "api", to: "sql", label: "SQL" },
          { from: "api", to: "mem", label: "キャッシュ" },
          { from: "api", to: "nat", label: "外向き通信" },
          { from: "nat", to: "psp", label: "決済API呼び出し" }
        ]
      },
      flow: [
        "入口は同じくロードバランサで受け、VPC内のGKEクラスタで動くフロントAPIのPod群へ届けます",
        "クラスタ内ではフロント・注文・在庫などのサービスがPodとして分かれ、内部通信で連携します。Autopilotではノード（VM）の管理はGoogleが行います",
        "PodはプライベートIPのみで動かし、決済代行など外部への通信はCloud NAT経由で出します（送信元IPを固定できるため、決済代行のIP制限にも対応できます）",
        "データ層はCloud SQLとMemorystoreで、推奨構成と同じ考え方です"
      ],
      services: [
        { icon: "compute/gke-autopilot", name: "GKE Autopilot", role: "Kubernetesクラスタのマネージド版。ノード管理不要でPod単位の課金。細かなワークロード制御・サイドカー・常駐処理が可能" },
        { icon: "network/cloud-load-balancing", name: "Cloud Load Balancing", role: "入口。GKEのGatewayやIngressから自動構成される" },
        { icon: "network/cloud-nat", name: "Cloud NAT", role: "プライベートなPodからインターネットへ出るための出口。送信元IPの固定にも使う" },
        { icon: "database/cloud-sql", name: "Cloud SQL（HA構成）", role: "注文データの正本。推奨構成と共通" },
        { icon: "database/memorystore", name: "Memorystore for Redis", role: "キャッシュ・セッション置き場。推奨構成と共通" }
      ],
      points: [
        "Cloud Runとの本質的な違いは自由度と責任の交換です。KubernetesはPodの配置・ネットワーク・常駐処理まで細かく制御できる代わりに、マニフェスト管理やバージョンアップ追従という継続的な運用作業が発生します",
        "この構成で初めてVPCとCloud NATが図に登場します。GKEのノードとPodはあなたのVPC内で動くため、外向き通信の経路を自分で用意する必要があるのです。サーバーレス構成（推奨構成）でNATが不要だった理由と対になっています",
        "4人チームでインフラ専任がいない現状では過剰と判断して代替案としました。マイクロサービス化が進みチームが分かれてきたら再評価します（判断基準の詳細はケース45で扱います）"
      ],
      pros: [
        "サイドカー・常駐ワーカー・WebSocketなどCloud Runに収まりにくいワークロードも動かせる",
        "Kubernetesの標準的なエコシステム（Helm・ArgoCDなど）をそのまま使える",
        "Autopilotならノード管理が不要で、素のGKEより運用負担が小さい"
      ],
      cons: [
        "Kubernetesの学習・運用コストは依然として大きい（マニフェスト・権限・アップグレード）",
        "最小構成でもCloud Runよりアイドル費用がかかりやすい",
        "小規模チームでは技術選定として過剰になりがち"
      ],
      cost: "<strong>月8万円〜20万円程度</strong>。Autopilotはリクエストではなく確保したPodリソースに課金されるため、常時稼働分の費用が乗ります。クラスタ管理手数料（1クラスタ月1万円強、無料枠1クラスタあり）+Pod分+データ層（推奨構成と同等）という内訳です。",
      references: [
        { title: "GKE Autopilotの概要", url: "https://cloud.google.com/kubernetes-engine/docs/concepts/autopilot-overview?hl=ja" },
        { title: "外部アプリケーションロードバランサの概要", url: "https://cloud.google.com/load-balancing/docs/https?hl=ja" }
      ]
    },
    {
      name: "Spanner採用構成",
      when: "セール時の書き込みがCloud SQLの垂直スケールの限界を超える、または海外展開までデータベースを作り替えたくない場合",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [3, 1] }
        ],
        nodes: [
          { id: "users", icon: "client/users", label: "購入者", col: 0, row: 1 },
          { id: "armor", icon: "network/cloud-armor", label: "Cloud Armor\nWAF", col: 1, row: 0 },
          { id: "lb", icon: "network/cloud-load-balancing", label: "Cloud LB\nHTTPS終端", col: 1, row: 1 },
          { id: "run", icon: "compute/cloud-run", label: "Cloud Run\nECアプリ", col: 2, row: 1 },
          { id: "spanner", icon: "database/spanner", label: "Spanner\n水平スケールDB", col: 3, row: 1 }
        ],
        edges: [
          { from: "users", to: "lb", label: "HTTPS" },
          { from: "armor", to: "lb", noArrow: true, dashed: true },
          { from: "lb", to: "run", label: "リクエスト" },
          { from: "run", to: "spanner", label: "読み書き" }
        ]
      },
      flow: [
        "入口からCloud Runまでは推奨構成と同じで、データベースだけをSpannerに置き換えます",
        "Spannerは処理ユニットを増やすことで書き込みも読み取りも水平にスケールし、ノード追加時の停止がありません",
        "可用性はSpanner自体が複数ゾーンへの複製で確保するため、HA構成やフェイルオーバーの管理が不要になります"
      ],
      services: [
        { icon: "database/spanner", name: "Spanner", role: "書き込みも水平スケールするリレーショナルDB。強い整合性とSQLを保ったまま、セールのスパイクにも処理ユニット追加で追従できる" },
        { icon: "compute/cloud-run", name: "Cloud Run", role: "アプリ本体。推奨構成と共通" },
        { icon: "network/cloud-load-balancing", name: "Cloud Load Balancing", role: "入口。Cloud ArmorとCDNの紐づけ先" },
        { icon: "network/cloud-armor", name: "Cloud Armor", role: "WAF。推奨構成と共通" }
      ],
      points: [
        "Cloud SQLのスケールは基本「1台を大きくする」（垂直）で、限界と再起動を伴う増強がつきまといます。書き込みそのものが頭打ちになったらSpannerの出番です",
        "単調増加する注文番号を主キーにすると特定サーバーに書き込みが集中する（ホットスポット）など、Spanner特有の設計作法を最初に学ぶ必要があります",
        "在庫の一貫性を保ったままスケールできるのが、キャッシュや非同期化では代替できないSpannerの価値です。そこまでの書き込み規模でないなら推奨構成で十分です"
      ],
      pros: [
        "書き込みスパイクに処理ユニット追加で追従でき、無停止でスケールする",
        "HA・フェイルオーバー運用が不要（可用性が仕組みとして組み込まれている）",
        "将来のマルチリージョン展開（ケース6）に同じDBのまま進める"
      ],
      cons: [
        "最小構成でもCloud SQLの小規模インスタンスより高い",
        "MySQL/PostgreSQLとの互換性はなく、既存アプリの移行には書き換えが必要",
        "ホットスポット回避など設計の学習コストがかかる"
      ],
      cost: "<strong>月3万円〜15万円程度</strong>。100処理ユニット（月1.5万円前後）から始められ、1ノード（1,000処理ユニット）で月13万円前後です。Cloud SQLのHA構成と比べると、小規模では割高、書き込みが多い規模では逆転しうる価格構造です。",
      references: [
        { title: "Spannerの概要", url: "https://cloud.google.com/spanner/docs/overview?hl=ja" },
        { title: "スキーマ設計のベストプラクティス（ホットスポット回避）", url: "https://cloud.google.com/spanner/docs/schema-and-data-model?hl=ja" }
      ]
    }
  ],
  cost: "<p>推奨構成は<strong>月5万円〜15万円程度</strong>で、費用の中心はCloud SQLのHA構成です。GKE Autopilot構成は<strong>月8万円〜20万円程度</strong>、Spanner構成は<strong>月3万円〜15万円程度</strong>が目安です。ECでは「止まった時間×売上」が損失に直結するため、可用性への投資（HAやSpanner）を売上規模と突き合わせて判断します。東京リージョン・1USD=150円前後の概算です。</p>",
  summary: "<p>ECの設計は<strong>「速さはキャッシュで、確実さはキューで、可用性はゾーン分散で」</strong>という役割分担に集約されます。スパイクはCDNとCloud Runの自動スケールで受け、注文の同期処理は最小に絞り、後処理はCloud Tasksのリトライに任せる。この分割ができていれば、データベースをCloud SQLからSpannerへ、実行基盤をCloud RunからGKEへ差し替える判断も局所的に済みます。非同期処理の深掘りはケース15、Cloud RunとGKEの選定基準はケース45で扱います。</p>",
  quiz: [
    {
      q: "注文確定APIでは注文レコードの書き込みだけを同期で行い、確認メール送信はCloud Tasks経由の非同期にしました。メール送信も同期でやると何が問題になるのでしょうか。",
      a: "メール送信は外部サービス依存で遅延や一時障害が起きやすく、同期に含めると注文確定APIの応答がその影響を受けてしまいます。セールのスパイク時にはメール基盤の詰まりが注文全体の失敗に波及しかねません。非同期に逃がせば、注文は確実に確定させたうえで、メールはCloud Tasksが自動リトライで最終的に届けてくれます。「失敗してもリトライでよい処理か」が同期/非同期の分割基準です。"
    },
    {
      q: "Cloud SQLのHA構成は費用が実質2倍です。あなたはこの保険料を払う判断をどう説明しますか。HAなしで起きることと比べて考えてください。",
      a: "HAなしでゾーン障害やインスタンス障害が起きると、バックアップからの復元で数時間の停止と直近データの損失リスクが生じます。月商数千万円のECなら数時間の停止だけで数十万円規模の売上損失と信頼低下につながり、月数万円のHA費用を大きく上回ります。逆に社内向けツールや検証環境なら止まっても損失が小さく、HAは不要という判断になります。可用性投資は「止まったときの損失額」から逆算するのが基本です。"
    },
    {
      q: "セール開始直後の1分間だけ「ページは表示されるが注文確定が遅い」という状況になりました。あなたはまずどこを疑い、どんな対策を打ちますか。",
      a: "表示（キャッシュ・CDN側）は無事で書き込みだけ遅いので、まずCloud SQLの書き込み負荷とCloud Runからの接続数、次に注文APIのコールドスタートを疑います。対策は、セール前にCloud Runの最小インスタンス数を引き上げて起動済みにしておく、接続プールを見直す、注文処理の同期部分をさらに絞る、それでも書き込み自体が限界ならCloud SQLの増強やSpanner移行を検討する、という順番です。観測なしに対策は選べないため、ケース46の監視が前提になります。"
    }
  ]
});
