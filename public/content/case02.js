// ケース2：WordPressメディアサイト
registerCase({
  id: 2,
  category: "Webサイト・配信",
  title: "WordPressメディアサイト",
  scenario: "<p>中堅企業のオウンドメディアをGCPで運用したい。記事を書くのは編集部の5人で、全員非エンジニア。WordPressの管理画面から毎日入稿する。月間数十万PVで、記事公開直後やSNSで話題になったときにアクセスが集中する。インフラを見られるエンジニアは1人だけなので、データベースの面倒までは見たくない。</p>",
  requirements: [
    "非エンジニアがWordPressの管理画面から記事を更新できること",
    "月間数十万PV程度のアクセスを安定してさばく",
    "記事公開直後のアクセス増をキャッシュで吸収したい",
    "データベースのバックアップ・パッチ運用は任せたい",
    "サーバー障害時に復旧しやすい構成にしたい"
  ],
  main: {
    name: "Compute Engine+Cloud SQL構成",
    diagram: {
      cols: 6, rows: 2,
      groups: [
        { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [5, 1] },
        { type: "vpc", label: "VPCネットワーク", from: [2, 0], to: [4, 1], depth: 1 }
      ],
      nodes: [
        { id: "users", icon: "client/users", label: "ユーザー", col: 0, row: 0 },
        { id: "lb", icon: "network/cloud-load-balancing", label: "Cloud LB\nHTTPS終端", col: 1, row: 0 },
        { id: "cdn", icon: "network/cloud-cdn", label: "Cloud CDN\nキャッシュ", col: 1, row: 1 },
        { id: "gce", icon: "compute/compute-engine", label: "Compute Engine\nWordPress", col: 3, row: 0 },
        { id: "nat", icon: "network/cloud-nat", label: "Cloud NAT\n外向き通信", col: 4, row: 0 },
        { id: "sql", icon: "database/cloud-sql", label: "Cloud SQL\nMySQL", col: 3, row: 1 },
        { id: "gcs", icon: "storage/cloud-storage", label: "Cloud Storage\nメディア画像", col: 5, row: 1 }
      ],
      edges: [
        { from: "users", to: "lb", label: "HTTPS" },
        { from: "lb", to: "gce", label: "転送" },
        { from: "cdn", to: "lb", noArrow: true, dashed: true },
        { from: "gce", to: "sql", label: "SQL接続" },
        { from: "gce", to: "gcs", label: "メディア保存" },
        { from: "gce", to: "nat", label: "更新取得", dashed: true }
      ]
    },
    flow: [
      "ユーザーのリクエストはCloud Load Balancingが受け、Cloud CDNが画像・CSS・キャッシュ可能なページをエッジから配信します",
      "キャッシュに無いリクエストだけがVPC内のCompute Engine上のWordPressへ届きます",
      "WordPressは記事データをCloud SQL（MySQL）へプライベートIPで読み書きします",
      "アップロードされた画像はプラグイン経由でVPCの外にあるCloud Storageへ保存します",
      "WordPress本体やプラグインの更新など、VMからの外向き通信はCloud NAT経由で行います"
    ],
    services: [
      { icon: "compute/compute-engine", name: "Compute Engine", role: "WordPress本体（PHP+Webサーバー）が動く仮想マシン。OSから自分で管理します" },
      { icon: "database/cloud-sql", name: "Cloud SQL（MySQL）", role: "記事・設定を保存するマネージドデータベース。バックアップ・パッチ・冗長化をGoogleに任せられます" },
      { icon: "network/cloud-load-balancing", name: "Cloud Load Balancing", role: "HTTPSの終端と入口の一本化。Cloud CDNやHTTPS証明書はここに紐付きます" },
      { icon: "network/cloud-cdn", name: "Cloud CDN", role: "画像やページをエッジでキャッシュし、記事公開直後のアクセス集中からVMを守ります" },
      { icon: "storage/cloud-storage", name: "Cloud Storage", role: "アップロード画像の保存先。VMのディスクに置かないことでVMを使い捨てにできます" },
      { icon: "network/cloud-nat", name: "Cloud NAT", role: "外部IPを持たないVMがインターネットへ出るための出口。更新ファイルの取得などに使います" }
    ],
    points: [
      "画像はCloud Storageへ、データはCloud SQLへ逃がし、VMを「いつ作り直してもよい状態」に保ちます。障害復旧もスケールアップも、VMの再作成だけで済むようになります",
      "VMには外部IPを付けず、入口はロードバランサー、出口はCloud NATに一本化します。VMへ直接届く経路を無くすことで攻撃される面を減らせます",
      "Cloud SQLはプライベートIPのみで運用し、インターネットへ公開しません。管理画面のあるWordPressではDBの露出を最小にする価値が特に大きいです",
      "Cloud CDNでは管理画面（ログインCookieのあるリクエスト）をキャッシュ対象から外し、記事ページと静的ファイルを積極的にキャッシュする設計にします"
    ],
    pros: [
      "WordPressのテーマ・プラグイン資産と編集部の使い慣れた入稿フローをそのまま活かせる",
      "データベース運用（バックアップ・パッチ・障害時復旧）をGoogleに任せられる",
      "CDNが記事公開直後のスパイクを吸収し、VM1台でも数十万PVをさばける",
      "メディアとデータを外部化してあるため、VM障害時は再作成で復旧できる"
    ],
    cons: [
      "OS・WordPress本体・プラグインの更新は自分の仕事として残る（セキュリティ責任が重い）",
      "VMとCloud SQLは常時起動で、アクセスが無い時間帯も固定費がかかる",
      "VM1台構成のため、障害からの復旧作業中は停止時間が発生する"
    ],
    cost: "<strong>月8,000円〜1万5,000円程度</strong>。内訳の目安はVM（e2-small〜e2-medium）が2,500〜5,000円、Cloud SQL最小構成が2,000円前後〜、ロードバランサー固定費が約2,700円、Cloud StorageとCDN配信が数百円です。東京リージョン・1USD=150円前後の概算です。",
    references: [
      { title: "Compute Engineの概要", url: "https://cloud.google.com/compute/docs/overview?hl=ja" },
      { title: "Cloud SQL for MySQLの概要", url: "https://cloud.google.com/sql/docs/mysql/introduction?hl=ja" },
      { title: "プライベートIPの概要", url: "https://cloud.google.com/sql/docs/mysql/private-ip?hl=ja", note: "DBを公開しない接続方式" },
      { title: "Cloud NATの概要", url: "https://cloud.google.com/nat/docs/overview?hl=ja" },
      { title: "Cloud CDNのキャッシュの仕組み", url: "https://cloud.google.com/cdn/docs/caching?hl=ja", note: "何がキャッシュされるかの公式解説" }
    ]
  },
  alternatives: [
    {
      name: "Cloud Run+Cloud SQL構成（OS管理をなくす）",
      when: "コンテナ運用に慣れていて、OSパッチ当てから解放されたい場合",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [3, 1] }
        ],
        nodes: [
          { id: "users", icon: "client/users", label: "ユーザー", col: 0, row: 0 },
          { id: "lb", icon: "network/cloud-load-balancing", label: "Cloud LB\nHTTPS終端", col: 1, row: 0 },
          { id: "cdn", icon: "network/cloud-cdn", label: "Cloud CDN\nキャッシュ", col: 1, row: 1 },
          { id: "run", icon: "compute/cloud-run", label: "Cloud Run\nWordPress", col: 2, row: 0 },
          { id: "sql", icon: "database/cloud-sql", label: "Cloud SQL\nMySQL", col: 3, row: 0 },
          { id: "gcs", icon: "storage/cloud-storage", label: "Cloud Storage\nメディア画像", col: 2, row: 1 }
        ],
        edges: [
          { from: "users", to: "lb", label: "HTTPS" },
          { from: "lb", to: "run", label: "転送" },
          { from: "cdn", to: "lb", noArrow: true, dashed: true },
          { from: "run", to: "sql", label: "SQL接続" },
          { from: "run", to: "gcs", label: "メディア保存" }
        ]
      },
      flow: [
        "入口はロードバランサー+Cloud CDNで推奨構成と同じです",
        "WordPressはコンテナ化してCloud Runで動かし、負荷に応じてインスタンスが自動で増減します",
        "記事データはCloud SQLへ接続して読み書きします（図では線1本ですが、実際はCloud SQL接続の仕組みを使います）",
        "コンテナは書き込み不可の使い捨てなので、画像は必ずCloud Storageへ保存します"
      ],
      services: [
        { icon: "compute/cloud-run", name: "Cloud Run", role: "WordPressコンテナのサーバーレス実行環境。OS管理が不要で、リビジョン単位のロールバックもできます" },
        { icon: "database/cloud-sql", name: "Cloud SQL（MySQL）", role: "記事データの保存先。推奨構成と同じくマネージドで運用します" },
        { icon: "storage/cloud-storage", name: "Cloud Storage", role: "画像の保存先。コンテナのローカルディスクは消える前提のため必須です" },
        { icon: "network/cloud-load-balancing", name: "Cloud Load Balancing", role: "HTTPS終端とCDNの紐付け。入口の役割は推奨構成と同じです" },
        { icon: "network/cloud-cdn", name: "Cloud CDN", role: "キャッシュ配信でCloud Runへのリクエスト数そのものを減らします" }
      ],
      points: [
        "WordPressはローカルディスクへの書き込みを前提とした作りのため、コンテナ化にはメディアの外部化やプラグイン更新方法の見直しが必要です。移行のハードルは正直に見込んでおきます",
        "OSパッチ当てが不要になり、デプロイはイメージの差し替えだけになります。壊れたら1つ前のリビジョンへ戻すだけです",
        "0台までスケールインさせると管理画面が起動待ちで重くなるため、最小インスタンス数を1にするのが現実的です。その場合は常駐ぶんの費用がかかります"
      ],
      pros: [
        "OS・ミドルウェアのパッチ運用から解放される",
        "アクセス増には自動スケールで追従できる",
        "リビジョン管理により切り戻しが容易"
      ],
      cons: [
        "WordPressのコンテナ化には設計の見直しが必要で、初期の手数が多い",
        "最小インスタンス1で常駐させると、VM構成とコスト差が縮む",
        "プラグインを管理画面から直接インストールする運用とは相性が悪い（イメージ更新で配る形が基本）"
      ],
      cost: "<strong>月5,000円〜1万円程度</strong>。Cloud Run（最小インスタンス1で常駐）が1,000〜3,000円、Cloud SQLが2,000円前後〜、ロードバランサーが約2,700円の概算です。アクセスが少ないサイトほど推奨構成より安くなります。",
      references: [
        { title: "Cloud RunからCloud SQLに接続する", url: "https://cloud.google.com/sql/docs/mysql/connect-run?hl=ja" },
        { title: "Cloud Runとは", url: "https://cloud.google.com/run/docs/overview/what-is-cloud-run?hl=ja" }
      ]
    },
    {
      name: "1台のVMに全部入り（最小コスト）",
      when: "アクセスが少ない・とにかく安く始めたい・多少の停止リスクを許容できる場合",
      diagram: {
        cols: 4, rows: 1,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [3, 0] },
          { type: "vpc", label: "VPC", from: [2, 0], to: [2, 0], depth: 1 }
        ],
        nodes: [
          { id: "users", icon: "client/users", label: "ユーザー", col: 0, row: 0 },
          { id: "gce", icon: "compute/compute-engine", label: "Compute Engine\nWP+DB同居", col: 2, row: 0 },
          { id: "pd", icon: "storage/persistent-disk", label: "永続ディスク\nスナップショット", col: 3, row: 0 }
        ],
        edges: [
          { from: "users", to: "gce", label: "HTTPS" },
          { from: "gce", to: "pd", noArrow: true, dashed: true }
        ]
      },
      flow: [
        "ユーザーは独自ドメインからVMの外部IPへ直接アクセスします",
        "WordPressとMySQLを同じVMの中で動かします",
        "永続ディスクの定期スナップショットを設定し、日次でバックアップを取ります"
      ],
      services: [
        { icon: "compute/compute-engine", name: "Compute Engine", role: "WordPressとMySQLを両方載せる仮想マシン。この構成の唯一のサーバーです" },
        { icon: "storage/persistent-disk", name: "永続ディスク", role: "VMのディスク。スケジュール設定で定期スナップショットを自動取得できます" }
      ],
      points: [
        "DBまで同居しているため、VM障害がデータ喪失に直結し得ます。スナップショットのスケジュール設定だけは最初に必ず入れます",
        "HTTPS証明書はVM内で取得・更新ツールを動かして自前運用します。マネージドに任せられない作業が増える点は割り切りです",
        "成長したときの最初の一手はDBのCloud SQLへの分離です。そこから推奨構成へ段階的に近づけられます"
      ],
      pros: [
        "月3,000円前後から始められ、構成要素が最少で学習コストも低い",
        "小規模ならこれで十分動く"
      ],
      cons: [
        "VM障害＝サイト全停止で、復旧はスナップショットからの手作業",
        "DBのバックアップ・チューニングも自分の仕事になる",
        "アクセス集中に耐える仕組みが無い（キャッシュプラグイン頼み）"
      ],
      cost: "<strong>月3,000円前後</strong>。e2-smallのVMが約2,500円、永続ディスク30GBとスナップショットが数百円の概算です。固定費を最小にできる代わりに、運用の手間と停止リスクを自分で持つ構成です。",
      references: [
        { title: "ディスクスナップショットの概要", url: "https://cloud.google.com/compute/docs/disks/snapshots?hl=ja", note: "この構成の生命線となるバックアップ" },
        { title: "Compute Engineの概要", url: "https://cloud.google.com/compute/docs/overview?hl=ja" }
      ]
    }
  ],
  cost: "<p>推奨構成は<strong>月8,000円〜1万5,000円程度</strong>、Cloud Run案は<strong>月5,000円〜1万円程度</strong>、全部入り1台VM案は<strong>月3,000円前後</strong>が目安です（東京リージョン・1USD=150円前後）。静的サイトのケース1と違い、CMSは常時動くサーバーとデータベースを持つため、アイドル時も固定費がかかり続けるのが特徴です。</p>",
  summary: "<p>このケースの分かれ目は技術ではなく<strong>「誰が何を運用するか」</strong>です。非エンジニアが毎日更新するという要件がWordPressを選ばせ、エンジニア1人という制約がデータベースをCloud SQLへ任せる判断につながります。3つの構成は「運用をどこまで手放すか」の段階の違いで、全部入りVM→VM+Cloud SQL→Cloud Run化と、成長に応じて段階的に移行できます。アクセス規模が桁で増えたらケース3の多層キャッシュ構成、WordPressにこだわらない新規サイトならケース7のCloud Run構成も検討しましょう。</p>",
  quiz: [
    {
      q: "推奨構成ではVMに外部IPを付けず、わざわざCloud NATを置いています。外部IPを付ければNATは不要なのに、なぜこうするのでしょうか。",
      a: "外部IPを付けるとVMへインターネットから直接到達できる経路が生まれ、SSHやWordPressの脆弱性を狙った攻撃に常時さらされます。入口をロードバランサーに一本化し、外向き通信だけをCloud NATに任せれば、VMに直接届く経路を消したまま更新ファイルの取得などができます。入口と出口を分けて管理するのはVPC構成の基本形です。"
    },
    {
      q: "記事がSNSでバズってVMのCPUが張り付きました。あなたなら次の一手として何を試しますか。",
      a: "まずCloud CDNのキャッシュヒット率を上げるのが先です。記事ページ自体がキャッシュ対象になっているか、TTLが短すぎないかを確認すれば、VMに届くリクエストそのものを大きく減らせます。それでも足りなければVMのスペックを上げ、恒常的に足りないならケース3で学ぶ複数台構成やキャッシュ多層化を検討します。増強の前にキャッシュ、が読み取り中心サイトの定石です。"
    },
    {
      q: "WordPressをCloud Runへ載せ替えるとき、VM構成のままでは通用しない前提が1つあります。何でしょうか。",
      a: "コンテナのローカルディスクへの書き込みが残らないという前提です。Cloud Runのインスタンスは増減のたびに作り直されるため、アップロード画像をローカルに保存すると消えます。画像はCloud Storageへ外部化し、プラグインの追加も管理画面からではなくコンテナイメージの更新で配る運用に変える必要があります。"
    }
  ]
});
