// ケース3：大規模ニュースサイト
registerCase({
  id: 3,
  category: "Webサイト・配信",
  title: "大規模ニュースサイト",
  scenario: "<p>月間数千万PVのニュースメディアを支える基盤を作りたい。速報が出ると数分で平常時の数十倍のアクセスが押し寄せる。編集部は24時間体制で入稿し、読者向けの配信は1秒でも速く表示したい。エンジニアチームは複数名おり、Kubernetesの経験者もいる。DDoS攻撃を受けた経験もあるため、防御も要件に入っている。</p>",
  requirements: [
    "速報時に平常時の数十倍へ跳ねるトラフィックをさばく",
    "記事ページの表示速度を保つ（キャッシュ戦略が前提）",
    "DDoSや不正リクエストからの防御を入口に組み込む",
    "配信系と入稿系を分けてスケール・デプロイしたい",
    "データベースは冗長化して止めない"
  ],
  main: {
    name: "GKE+多層キャッシュ構成",
    diagram: {
      cols: 5, rows: 3,
      groups: [
        { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [4, 2] },
        { type: "vpc", label: "VPCネットワーク", from: [2, 0], to: [4, 2], depth: 1 },
        { type: "gke-cluster", label: "GKEクラスタ", from: [3, 0], to: [3, 1], depth: 2 }
      ],
      nodes: [
        { id: "users", icon: "client/users", label: "読者", col: 0, row: 1 },
        { id: "office", icon: "client/office", label: "編集部\nCMS入稿", col: 0, row: 2 },
        { id: "armor", icon: "network/cloud-armor", label: "Cloud Armor\nWAF", col: 1, row: 0 },
        { id: "lb", icon: "network/cloud-load-balancing", label: "Cloud LB\nグローバル", col: 1, row: 1 },
        { id: "cdn", icon: "network/cloud-cdn", label: "Cloud CDN\nキャッシュ", col: 1, row: 2 },
        { id: "web", icon: "compute/gke", label: "GKE\n配信ポッド", col: 3, row: 0 },
        { id: "cms", icon: "compute/gke", label: "GKE\n入稿ポッド", col: 3, row: 1 },
        { id: "nat", icon: "network/cloud-nat", label: "Cloud NAT\n外向き通信", col: 4, row: 0 },
        { id: "mem", icon: "database/memorystore", label: "Memorystore\nRedisキャッシュ", col: 4, row: 1 },
        { id: "sql", icon: "database/cloud-sql", label: "Cloud SQL\nHA構成", col: 4, row: 2 }
      ],
      edges: [
        { from: "users", to: "lb", label: "HTTPS" },
        { from: "office", to: "lb", label: "入稿" },
        { from: "armor", to: "lb", noArrow: true, dashed: true },
        { from: "cdn", to: "lb", noArrow: true, dashed: true },
        { from: "lb", to: "web", label: "配信系" },
        { from: "lb", to: "cms", label: "入稿系" },
        { from: "web", to: "mem", label: "キャッシュ参照" },
        { from: "web", to: "sql", label: "記事読み取り" },
        { from: "cms", to: "sql", label: "記事書き込み" },
        { from: "web", to: "nat", label: "外部API", dashed: true }
      ]
    },
    flow: [
      "読者のリクエストはグローバルなCloud Load Balancingが受け、Cloud Armorが攻撃的なリクエストをブロックし、Cloud CDNが記事ページや画像をエッジから配信します",
      "キャッシュを通過したリクエストだけがVPC内のGKEの配信ポッドへ届きます",
      "配信ポッドはまずMemorystore（Redis）のキャッシュを参照し、無ければCloud SQLから読み取ってRedisへ格納します",
      "編集部の入稿は同じロードバランサーからURLパスに応じて入稿ポッドへ振り分けられ、Cloud SQLへ書き込みます",
      "GKEノードから外部通信社のAPIを取得するなどの外向き通信はCloud NAT経由で行います"
    ],
    services: [
      { icon: "network/cloud-load-balancing", name: "Cloud Load Balancing", role: "世界中で単一IPを持つグローバルな入口。配信系・入稿系へのルーティングもここで行います" },
      { icon: "network/cloud-armor", name: "Cloud Armor", role: "WAF（不正なリクエストを検査・遮断する防御壁）。DDoS対策とルールベースの防御をLBの手前側で担います" },
      { icon: "network/cloud-cdn", name: "Cloud CDN", role: "記事ページ・画像のエッジ配信。速報スパイクの大半はここで吸収します" },
      { icon: "compute/gke", name: "GKE", role: "コンテナ群を動かすKubernetesのマネージドサービス。配信・入稿を別のワークロードとして運用します" },
      { icon: "database/memorystore", name: "Memorystore（Redis）", role: "ミリ秒応答のインメモリキャッシュ。CDNで受けきれない動的な部分のDB負荷を肩代わりします" },
      { icon: "database/cloud-sql", name: "Cloud SQL（HA構成）", role: "記事データの本体。別ゾーンのスタンバイ機へ自動フェイルオーバーする高可用性構成にします" },
      { icon: "network/cloud-nat", name: "Cloud NAT", role: "プライベートなGKEノードがインターネットへ出るための出口です" }
    ],
    points: [
      "キャッシュをCDN→Redis→DBの3層にするのは、ニュースが圧倒的に読み取り過多だからです。DBまで到達するリクエストを全体の1%未満に抑えることが、スパイク耐性とコストの両方を決めます",
      "配信と入稿を別ポッドに分けるのは、速報時に配信側だけをHPA（水平ポッドオートスケーラー：負荷に応じてポッド数を増減する仕組み）で増やし、入稿側を巻き込まずにデプロイするためです",
      "Cloud SQLのHA構成は別ゾーンのスタンバイへ自動で切り替わります。ゾーン障害でも書き込みが止まらないことを、キャッシュではなくDB側の冗長化で担保します",
      "LB・Armor・CDNがVPCの手前のグローバル側で受け止めるのはGCPらしい特徴です。攻撃も含めた大半のトラフィックは、自分のネットワークに入る前に処理が終わります"
    ],
    pros: [
      "速報スパイクにCDNとHPA・クラスタオートスケーラーの多段構えで追従できる",
      "カナリアデプロイや細かいリソース制御などKubernetesの表現力を活かせる",
      "配信系・入稿系を独立にスケール・リリースできる",
      "入口で防御が完結し、攻撃トラフィックがVPCへ入りにくい"
    ],
    cons: [
      "Kubernetesの運用スキルが必須で、経験者がいないチームでは回らない",
      "ノード・Redis・HA構成DBが常時起動で固定費が大きい",
      "構成要素が多く、障害時に原因の切り分けが難しくなる"
    ],
    cost: "<strong>月15万〜30万円程度〜</strong>。目安の内訳は、GKEノード（e2-standard-4を3台）が5〜6万円、GKE管理料が約1.1万円、Cloud SQLのHA構成が3〜6万円、Memorystoreが2〜3万円、LB・Armor・CDNと配信量が数万円です。東京リージョン・1USD=150円前後の概算で、PV数と配信量に応じて大きく変動します。",
    references: [
      { title: "GKEの概要", url: "https://cloud.google.com/kubernetes-engine/docs/concepts/kubernetes-engine-overview?hl=ja" },
      { title: "水平ポッド自動スケーリング", url: "https://cloud.google.com/kubernetes-engine/docs/concepts/horizontalpodautoscaler?hl=ja", note: "スパイク追従の中核となる仕組み" },
      { title: "Cloud Armorの概要", url: "https://cloud.google.com/armor/docs/cloud-armor-overview?hl=ja" },
      { title: "Memorystore for Redisの概要", url: "https://cloud.google.com/memorystore/docs/redis/redis-overview?hl=ja" },
      { title: "Cloud SQLの高可用性構成", url: "https://cloud.google.com/sql/docs/mysql/high-availability?hl=ja" }
    ]
  },
  alternatives: [
    {
      name: "Cloud Run構成（運用を軽くする）",
      when: "Kubernetes経験者がいない・常駐処理や特殊プロトコルなどGKE特有の要件が無い場合",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [3, 1] }
        ],
        nodes: [
          { id: "users", icon: "client/users", label: "読者", col: 0, row: 0 },
          { id: "lb", icon: "network/cloud-load-balancing", label: "Cloud LB\nグローバル", col: 1, row: 0 },
          { id: "cdn", icon: "network/cloud-cdn", label: "Cloud CDN\nキャッシュ", col: 1, row: 1 },
          { id: "run", icon: "compute/cloud-run", label: "Cloud Run\n配信・入稿", col: 2, row: 0 },
          { id: "sql", icon: "database/cloud-sql", label: "Cloud SQL\nHA構成", col: 3, row: 0 },
          { id: "armor", icon: "network/cloud-armor", label: "Cloud Armor\nWAF", col: 2, row: 1 }
        ],
        edges: [
          { from: "users", to: "lb", label: "HTTPS" },
          { from: "lb", to: "run", label: "転送" },
          { from: "run", to: "sql", label: "SQL" },
          { from: "cdn", to: "lb", noArrow: true, dashed: true },
          { from: "armor", to: "lb", noArrow: true, dashed: true }
        ]
      },
      flow: [
        "入口の構え（LB+Cloud CDN+Cloud Armor）は推奨構成とまったく同じです",
        "アプリはCloud Runのサービスとして動き、リクエスト数に応じてインスタンスが自動で増減します",
        "配信用・入稿用を別のCloud Runサービスに分ければ、GKEと同じようにスケールとデプロイを分離できます",
        "Cloud SQLへはCloud SQL接続の仕組みで接続します。Memorystoreを足す場合はVPCへの接続設定を追加します"
      ],
      services: [
        { icon: "compute/cloud-run", name: "Cloud Run", role: "コンテナのサーバーレス実行環境。ノード管理なしでポッド相当のスケールを実現します" },
        { icon: "network/cloud-load-balancing", name: "Cloud Load Balancing", role: "グローバルな入口。CDN・Armor・ルーティングの役割は推奨構成と同じです" },
        { icon: "network/cloud-cdn", name: "Cloud CDN", role: "エッジキャッシュでオリジンへのリクエストを減らします" },
        { icon: "network/cloud-armor", name: "Cloud Armor", role: "WAF。入口防御の要件はこの構成でも満たせます" },
        { icon: "database/cloud-sql", name: "Cloud SQL（HA構成）", role: "記事データの本体。冗長化の考え方は推奨構成と同じです" }
      ],
      points: [
        "GKEとの本質的な違いはアプリではなく運用の主体です。ノードのアップグレードや容量計画をGoogleに任せ、チームはアプリに集中できます",
        "スパイク時のコールドスタート（インスタンス起動までの数秒の遅延）対策として、配信サービスには最小インスタンス数を設定しておきます",
        "GCPの定石は「GKEでないと困る理由を言えないならCloud Runから始める」です。この使い分けはケース45で正面から扱います"
      ],
      pros: [
        "Kubernetes運用スキルが不要で、少人数チームでも回せる",
        "リクエスト連動の課金で、深夜帯など閑散時間のコストが下がる",
        "入口の防御・キャッシュ設計は推奨構成と同等にできる"
      ],
      cons: [
        "常駐ワーカーやWebSocketの常時接続など、リクエスト応答型から外れる処理は苦手",
        "サイドカーやノードレベルの細かいチューニングはGKEに劣る",
        "超大規模ではリクエスト課金がノード常駐より割高になることがある"
      ],
      cost: "<strong>月3万〜10万円程度</strong>。Cloud Runの従量課金（最小インスタンス設定ぶんを含む）が数千円〜数万円、Cloud SQLのHA構成が3〜6万円、LB・Armor・CDNと配信量が数千円〜数万円の概算です。トラフィックの山谷が大きいメディアほど推奨構成との差が出ます。",
      references: [
        { title: "Cloud Runとは", url: "https://cloud.google.com/run/docs/overview/what-is-cloud-run?hl=ja" },
        { title: "Cloud Load Balancingの概要", url: "https://cloud.google.com/load-balancing/docs/load-balancing-overview?hl=ja" }
      ]
    },
    {
      name: "Compute Engine+MIG構成（VM資産を活かす）",
      when: "既存のVMベースのシステムを活かしたい・アプリのコンテナ化がまだの場合",
      diagram: {
        cols: 5, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [4, 1] },
          { type: "vpc", label: "VPCネットワーク", from: [2, 0], to: [4, 1], depth: 1 },
          { type: "mig", label: "MIG自動増減", from: [3, 0], to: [3, 1], depth: 2 }
        ],
        nodes: [
          { id: "users", icon: "client/users", label: "読者", col: 0, row: 0 },
          { id: "lb", icon: "network/cloud-load-balancing", label: "Cloud LB\nグローバル", col: 1, row: 0 },
          { id: "cdn", icon: "network/cloud-cdn", label: "Cloud CDN\nキャッシュ", col: 1, row: 1 },
          { id: "gce1", icon: "compute/compute-engine", label: "Compute Engine\nWebサーバー", col: 3, row: 0 },
          { id: "gce2", icon: "compute/compute-engine", label: "Compute Engine\nWebサーバー", col: 3, row: 1 },
          { id: "nat", icon: "network/cloud-nat", label: "Cloud NAT\n外向き通信", col: 4, row: 0 },
          { id: "sql", icon: "database/cloud-sql", label: "Cloud SQL\nHA構成", col: 4, row: 1 }
        ],
        edges: [
          { from: "users", to: "lb", label: "HTTPS" },
          { from: "lb", to: "gce1", label: "分散" },
          { from: "lb", to: "gce2" },
          { from: "cdn", to: "lb", noArrow: true, dashed: true },
          { from: "gce1", to: "sql", label: "SQL" },
          { from: "gce2", to: "sql" },
          { from: "gce1", to: "nat", dashed: true }
        ]
      },
      flow: [
        "ロードバランサーがMIG（マネージドインスタンスグループ）内の複数VMへリクエストを分散します",
        "負荷が上がるとオートスケーラーがテンプレートから同じ構成のVMを自動で追加し、下がると削減します",
        "各VMはHA構成のCloud SQLを読み書きし、外向き通信はCloud NAT経由で行います"
      ],
      services: [
        { icon: "compute/compute-engine", name: "Compute Engine（MIG）", role: "同じテンプレートから複製されるVM群。台数の増減と障害VMの自動再作成をMIGが担います" },
        { icon: "network/cloud-load-balancing", name: "Cloud Load Balancing", role: "VM群への分散と、ヘルスチェックによる故障VMの切り離しを行います" },
        { icon: "network/cloud-cdn", name: "Cloud CDN", role: "エッジキャッシュ。VMのスケール速度の遅さをキャッシュで補う前提です" },
        { icon: "database/cloud-sql", name: "Cloud SQL（HA構成）", role: "記事データの本体。VM構成でもDBはマネージドに任せます" },
        { icon: "network/cloud-nat", name: "Cloud NAT", role: "外部IPを持たないVM群の外向き通信の出口です" }
      ],
      points: [
        "MIGは「VMを手作業で増やす運用」から卒業するための仕組みです。テンプレート化により、障害VMの自動再作成と負荷連動の増減が手に入ります",
        "VMの起動はコンテナより遅く、分単位かかります。急峻なスパイクはCDNで受け止める前提で、オートスケールは余裕を持たせて設定します",
        "すでにコンテナ化が済んでいるなら、デプロイ速度・集積度の面でGKEやCloud Runの方が有利です。この構成は移行の中間段階と割り切るのが健全です"
      ],
      pros: [
        "既存のVM向け構築手順・ミドルウェア資産をほぼそのまま使える",
        "OSレベルの自由度が高く、特殊なエージェントやチューニングも可能",
        "MIGにより台数運用と故障復旧は自動化できる"
      ],
      cons: [
        "VM起動が遅く、スパイク追従性はコンテナ基盤に劣る",
        "OSパッチ・ミドルウェア更新の運用が台数ぶん残る",
        "コンテナ基盤に比べて集積度が低く、同性能でもコストが高くなりがち"
      ],
      cost: "<strong>月8万〜20万円程度</strong>。e2-standard-2〜4のVMが平常時3〜4台で3〜8万円、Cloud SQLのHA構成が3〜6万円、LB・CDN・NATと配信量が1〜3万円の概算です。ピーク時はオートスケールで一時的に増えます。",
      references: [
        { title: "インスタンスグループ", url: "https://cloud.google.com/compute/docs/instance-groups?hl=ja" },
        { title: "インスタンスのグループの自動スケーリング", url: "https://cloud.google.com/compute/docs/autoscaler?hl=ja" }
      ]
    }
  ],
  cost: "<p>推奨構成（GKE）は<strong>月15万〜30万円程度〜</strong>、Cloud Run案は<strong>月3万〜10万円程度</strong>、MIG案は<strong>月8万〜20万円程度</strong>が目安です（東京リージョン・1USD=150円前後、PV数・配信量で大きく変動）。どの案でも共通して、キャッシュヒット率が上がるほどDBと実行基盤の負荷が減り、コスト曲線全体が下がります。<strong>この規模ではキャッシュ設計こそ最大のコスト対策</strong>です。</p>",
  summary: "<p>大規模な読み取り中心サイトの設計は、突き詰めると<strong>「いかにリクエストをDBまで行かせないか」</strong>です。CDN→Redis→DBの多層キャッシュでリクエストを手前で減衰させ、書き込み系（入稿）は分離して守る。この型はニュースに限らず、ECの商品ページやブログ基盤にも通用します。実行基盤の選択（GKE・Cloud Run・MIG）は要件よりもチームのスキルと資産で決まることが多く、その判断基準はケース45で深掘りします。防御の多層化はケース47も参照してください。</p>",
  quiz: [
    {
      q: "速報時に平常時の数十倍のアクセスが来たとき、最初にトラフィックを受け止めるのはどの層で、それはなぜ成立するのでしょうか。",
      a: "Cloud CDNのエッジです。速報時のアクセスは大多数が同じ記事ページへ集中するため、キャッシュヒット率が極めて高くなり、リクエストの大半はGCPのエッジで応答が完結します。オリジンのGKEやDBに届くのはキャッシュミスぶんだけなので、数十倍のスパイクでもオリジン側の増加は緩やかです。同じ内容を大勢が読むという性質そのものが、この構成の前提になっています。"
    },
    {
      q: "この構成からMemorystore（Redis）を外すと、何が起きるでしょうか。CDNがあるのだから不要では、という意見にどう答えますか。",
      a: "CDNでキャッシュできるのはURL単位で共有できる応答だけです。ログインユーザー向けの出し分け・ランキング・最新記事一覧のような動的な部分はCDNを素通りし、Redisが無ければその全てがCloud SQLへ直撃します。RedisはDBの手前でミリ秒応答の共有キャッシュとして働き、DB接続数の枯渇を防ぐ層です。CDNとRedisは守る対象が違うため、どちらか一方では代わりになりません。"
    },
    {
      q: "同じ要件で、チームにKubernetes経験者が1人もいないとしたら、あなたならどう構成しますか。",
      a: "Cloud Run構成から始めます。入口の防御とキャッシュ（LB+Armor+CDN）は推奨構成と同じにできるため、要件の大半はGKE無しでも満たせます。GKEを選ぶのは、常駐処理・特殊プロトコル・ノードレベルの制御などCloud Runで困る具体的な理由を言語化できたときです。学習コストを払ってでもGKEにする価値があるかを判断するのが設計者の仕事で、この判断はケース45で詳しく扱います。"
    }
  ]
});
