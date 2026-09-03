// ケース32：閉域の社内業務システム
registerCase({
  id: 32,
  category: "社内・閉域・ハイブリッド",
  title: "閉域の社内業務システム",
  scenario: "<p>従業員800人の企業の情報システム部門です。老朽化した経費精算・勤怠管理の内製システムを刷新してGCPへ移します。人事データを含むため、情報セキュリティ規程で「インターネットから到達できないこと」が必須条件です。利用者は社内ネットワークにいる従業員のみで、オフィスとGCPはVPNで接続します。運用担当は情シス3人で、サーバーのOS保守はできるだけ減らしたいと考えています。</p>",
  requirements: [
    "インターネットからいっさい到達できない構成にしたい",
    "社内ネットワーク（オフィス）からだけ使えればよい",
    "アプリはコンテナで動かし、OSの保守はやりたくない",
    "人事データを扱うため通信は閉域・暗号化を徹底したい",
    "誰がいつ使ったかの監査ログを残したい"
  ],
  main: {
    name: "内部ALB+Cloud Runの閉域サーバーレス構成",
    diagram: {
      cols: 5, rows: 3,
      groups: [
        { type: "onpremise", label: "社内ネットワーク", from: [0, 0], to: [0, 2] },
        { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [4, 2] },
        { type: "vpc", label: "VPCネットワーク", from: [1, 1], to: [2, 2], depth: 1 }
      ],
      nodes: [
        { id: "office", icon: "client/office", label: "社内PC\n従業員のみ", col: 0, row: 1 },
        { id: "vpn", icon: "network/cloud-vpn", label: "Cloud VPN\n拠点接続", col: 1, row: 1 },
        { id: "ilb", icon: "network/cloud-load-balancing", label: "内部ALB\n内部IPのみ", col: 2, row: 1 },
        { id: "run", icon: "compute/cloud-run", label: "Cloud Run\n業務アプリ", col: 3, row: 1 },
        { id: "sql", icon: "database/cloud-sql", label: "Cloud SQL\nプライベートIP", col: 4, row: 1 },
        { id: "psc", icon: "network/private-service-connect", label: "PSC\nAPI閉域経路", col: 2, row: 2 },
        { id: "log", icon: "ops/cloud-logging", label: "Cloud Logging\n監査ログ", col: 3, row: 0 }
      ],
      edges: [
        { from: "office", to: "vpn", label: "IPsec暗号化" },
        { from: "vpn", to: "ilb", label: "内部IP宛て" },
        { from: "ilb", to: "run", label: "HTTPS" },
        { from: "run", to: "sql", label: "プライベート接続" },
        { from: "vpn", to: "psc", label: "Google API", dashed: true },
        { from: "run", to: "log", label: "操作ログ", dashed: true }
      ]
    },
    flow: [
      "従業員の社内PCからの通信は、オフィスとGCPを結ぶCloud VPNの暗号化トンネルを通ってVPCに入る",
      "VPC内の内部ALB（内部アプリケーションロードバランサ）が受け付ける。内部ALBは内部IPアドレスしか持たず、インターネット側に入口がそもそも存在しない",
      "内部ALBはCloud Runへ転送する。Cloud Run側もingress（受け入れ経路の設定）を「内部とロードバランサ経由のみ」に絞り、既定の公開URLからのアクセスを遮断する",
      "アプリはCloud SQLへプライベートIPで接続する。DBはパブリックIPを持たない",
      "社内からBigQueryなどのGoogle APIを使う通信もPrivate Service Connect（PSC）の閉域経路を通し、操作の記録はCloud Loggingへ集約する"
    ],
    services: [
      { icon: "network/cloud-vpn", name: "Cloud VPN", role: "オフィスとVPCをIPsecトンネルで結ぶ閉域の入口。通信は暗号化される" },
      { icon: "network/cloud-load-balancing", name: "内部アプリケーションロードバランサ", role: "内部IPだけを持つL7の入口。サーバーレスNEGという仕組みでCloud Runへ転送する" },
      { icon: "compute/cloud-run", name: "Cloud Run", role: "業務アプリ本体。ingress設定で内部からのアクセスのみ許可し、閉域のままサーバーレスで動く" },
      { icon: "database/cloud-sql", name: "Cloud SQL", role: "人事データを保存するマネージドDB。プライベートIPのみで公開されない" },
      { icon: "network/private-service-connect", name: "Private Service Connect", role: "Google APIへインターネットを通らずに到達するための閉域経路" },
      { icon: "ops/cloud-logging", name: "Cloud Logging", role: "アプリログに加え、誰がインフラを操作したかの監査ログも集約する" }
    ],
    points: [
      "「外部ALB+アクセス元制限」ではなく内部ALBを選んだのは、制限のかけ忘れという人為ミスを構造的になくすためです。入口がそもそも存在しない構成は設定ミスに強く、規程の「到達できないこと」に文字どおり応えられます",
      "サーバーレスでも閉域にできるのがGCPの特徴です。Cloud Runのingress設定とVPCへの直接egress（外向き接続）を組み合わせ、VMを1台も持たずに閉域要件とOS保守ゼロを両立しています",
      "この図にCloud NATが無いのは省略ではありません。NATはVPC内のVMが外へ出るための出口で、VMが存在しないこの構成には登場しません（VMを使う代替案2で登場します）",
      "アプリのログとは別に、Cloud Loggingの監査ログ（管理者が構成を変更した記録）も保存します。人事データ系のシステムでは「インフラ操作の記録」まで監査で求められることが多いためです"
    ],
    pros: [
      "インターネット側に攻撃面（アタックサーフェス）が存在しない",
      "OS・ミドルウェアの保守が不要で、情シス3人でも運用が回る",
      "夜間・休日はCloud Runがゼロまで縮み、社内システム特有の利用の波にコストが追随する"
    ],
    cons: [
      "VPNや社内ネットワーク側の障害でシステム全体が使えなくなる（社内経路が単一障害点になりやすい）",
      "内部ALB+サーバーレスNEG+ingress設定と、公開構成より設定項目が多く初回構築の難度は高め",
      "リモートワークの従業員は、まず社内ネットワークへVPN接続しないと使えない"
    ],
    cost: "<strong>月3万〜5万円程度</strong>が目安です。内訳の例：Cloud VPNトンネル2本で月約1.1万円、内部ALBが月約3,000円+処理量、Cloud SQL（2vCPU・8GB・非HA）が月約1.5万円、Cloud Runは社内利用の規模ならごく少額です。※東京リージョン・1USD=150円換算の概算。",
    references: [
      { title: "内部アプリケーションロードバランサの概要", url: "https://cloud.google.com/load-balancing/docs/l7-internal?hl=ja" },
      { title: "Cloud Runの上り（内向き）の制限", url: "https://cloud.google.com/run/docs/securing/ingress?hl=ja", note: "ingressを内部に絞る設定" },
      { title: "Cloud SQLのプライベートIP", url: "https://cloud.google.com/sql/docs/mysql/private-ip?hl=ja" },
      { title: "Private Service Connect", url: "https://cloud.google.com/vpc/docs/private-service-connect?hl=ja" },
      { title: "Cloud監査ログ", url: "https://cloud.google.com/logging/docs/audit?hl=ja", note: "「誰が何をしたか」を記録する仕組み" }
    ]
  },
  alternatives: [
    {
      name: "IAP（Identity-Aware Proxy）によるゼロトラスト構成",
      when: "リモートワークが主体でVPNが逼迫している、または脱VPN（ゼロトラスト）へ移行したい場合",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [3, 1] }
        ],
        nodes: [
          { id: "users", icon: "client/users", label: "従業員\n自宅/外出先", col: 0, row: 1 },
          { id: "lb", icon: "network/cloud-load-balancing", label: "外部ALB\nHTTPS", col: 1, row: 1 },
          { id: "iap", icon: "security/identity-aware-proxy", label: "IAP\n本人確認", col: 1, row: 0 },
          { id: "run", icon: "compute/cloud-run", label: "Cloud Run\n業務アプリ", col: 2, row: 1 },
          { id: "sql", icon: "database/cloud-sql", label: "Cloud SQL\nプライベートIP", col: 3, row: 1 }
        ],
        edges: [
          { from: "users", to: "lb", label: "HTTPS" },
          { from: "iap", to: "lb", noArrow: true, dashed: true },
          { from: "lb", to: "run", label: "認証済みのみ" },
          { from: "run", to: "sql", label: "プライベート接続" }
        ]
      },
      flow: [
        "従業員は自宅や外出先からインターネット経由で外部ALBへHTTPSでアクセスする",
        "ALBに紐づいたIAPが、リクエストを通す前にGoogleアカウントで本人確認し、許可された社員以外をアプリに到達させない。「社内ネットワークにいるか」ではなく「誰か」で守る考え方",
        "認証済みのリクエストだけがCloud Runに届き、アプリはCloud SQLへプライベートIPで接続する"
      ],
      services: [
        { icon: "security/identity-aware-proxy", name: "Identity-Aware Proxy", role: "アプリの手前で認証・認可を行う門番。アプリ側に認証コードを書かなくてよい" },
        { icon: "network/cloud-load-balancing", name: "外部アプリケーションロードバランサ", role: "HTTPSの入口。IAPと組み合わせて認証付きの玄関になる" },
        { icon: "compute/cloud-run", name: "Cloud Run", role: "業務アプリ本体。認証済みリクエストのみを受け取る" },
        { icon: "database/cloud-sql", name: "Cloud SQL", role: "業務データの保存先。プライベートIPのみ" }
      ],
      points: [
        "Googleが自社実践から提唱したBeyondCorp（ゼロトラストモデル）の構成です。ネットワークの場所を信頼の根拠にしません",
        "VPN装置の増強・運用から解放されるため、在宅勤務の拡大した企業で採用が広がっています。ケース11のBtoBポータルも同じ考え方です",
        "ただし「インターネットに到達点が存在する」こと自体を規程が許さない場合は使えません。要件の文言ひとつで推奨構成と分かれます"
      ],
      pros: [
        "場所を問わず安全に使え、リモートワークと相性がよい",
        "VPNのボトルネックと運用負荷が消える",
        "認証をアプリの外に出せるため、アプリ側の実装がシンプルになる"
      ],
      cons: [
        "入口はインターネット上に存在する（認証で守るが、到達不能ではない）",
        "全社員のGoogleアカウント（Cloud IdentityやGoogle Workspace）の整備が前提になる"
      ],
      cost: "VPNが不要になるぶん推奨構成より安く、<strong>月2万〜3.5万円程度</strong>が目安です（外部ALB約3,000円+Cloud SQL約1.5万円+Cloud Run少額）。IAP自体に追加料金はかかりません。",
      references: [
        { title: "IAPの概要", url: "https://cloud.google.com/iap/docs/concepts-overview?hl=ja" },
        { title: "Cloud RunでのIAPの有効化", url: "https://cloud.google.com/iap/docs/enabling-cloud-run?hl=ja" },
        { title: "BeyondCorp", url: "https://cloud.google.com/beyondcorp?hl=ja", note: "ゼロトラストモデルの解説" }
      ]
    },
    {
      name: "Compute Engine+内部ALBの従来型閉域構成",
      when: "コンテナ化できないパッケージ製品や、OS常駐エージェントが前提の業務アプリをそのまま動かす場合",
      diagram: {
        cols: 5, rows: 3,
        groups: [
          { type: "onpremise", label: "社内ネットワーク", from: [0, 0], to: [0, 2] },
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [4, 2] },
          { type: "vpc", label: "VPCネットワーク", from: [1, 1], to: [4, 2], depth: 1 },
          { type: "mig", label: "MIG", from: [3, 1], to: [3, 1], depth: 2 }
        ],
        nodes: [
          { id: "office", icon: "client/office", label: "社内PC\n従業員のみ", col: 0, row: 1 },
          { id: "vpn", icon: "network/cloud-vpn", label: "Cloud VPN\n拠点接続", col: 1, row: 1 },
          { id: "ilb", icon: "network/cloud-load-balancing", label: "内部ALB\n内部IPのみ", col: 2, row: 1 },
          { id: "gce", icon: "compute/compute-engine", label: "GCE\n業務アプリVM", col: 3, row: 1 },
          { id: "sql", icon: "database/cloud-sql", label: "Cloud SQL\nプライベートIP", col: 4, row: 1 },
          { id: "nat", icon: "network/cloud-nat", label: "Cloud NAT\n外向き出口", col: 2, row: 2 },
          { id: "internet", icon: "client/internet", label: "インターネット\nパッチ取得のみ", col: 0, row: 2 }
        ],
        edges: [
          { from: "office", to: "vpn", label: "IPsec暗号化" },
          { from: "vpn", to: "ilb", label: "内部IP宛て" },
          { from: "ilb", to: "gce", label: "HTTP(S)" },
          { from: "gce", to: "sql", label: "SQL" },
          { from: "gce", to: "nat", label: "パッチ取得", dashed: true },
          { from: "nat", to: "internet", label: "外向きのみ", dashed: true }
        ]
      },
      flow: [
        "社内からの通信はVPN、内部ALBを経由してMIG（マネージドインスタンスグループ。VMの自動復旧・スケールの単位）内のVMに届く",
        "VMはプライベートIPのみでパブリックIPを持たない。DB接続もVPC内で完結する",
        "VMがOSパッチの取得などで外向きに通信するときだけ、Cloud NATを経由してインターネットへ出る。NATは中から外への一方通行で、外からの入口にはならない"
      ],
      services: [
        { icon: "compute/compute-engine", name: "Compute Engine", role: "業務アプリが動く仮想マシン。OSから自分で管理する" },
        { icon: "network/cloud-load-balancing", name: "内部アプリケーションロードバランサ", role: "内部IPのみの入口。VMへ負荷分散する" },
        { icon: "network/cloud-nat", name: "Cloud NAT", role: "プライベートなVMのための外向き通信の出口。この構成で初めて登場する" },
        { icon: "database/cloud-sql", name: "Cloud SQL", role: "業務データの保存先" },
        { icon: "network/cloud-vpn", name: "Cloud VPN", role: "オフィスとの閉域接続" }
      ],
      points: [
        "推奨構成に無かったCloud NATがここで登場します。NATが必要になるのは「VPC内にVMがいて、外向き通信が要る」ときだけ、という対応関係を覚えると図が読めるようになります",
        "完全閉域が必須ならNATすら置かず、パッチは社内のミラーサーバー経由にする選択もあります（そのぶん運用負荷は上がります）",
        "OS保守が復活するのが最大のコストです。コンテナ化できる部分は推奨構成へ寄せ、どうしても残るものだけをVMに載せる分け方が現実的です"
      ],
      pros: [
        "既存アプリを改修なしで動かせる",
        "OSレベルの細かな制御やエージェント導入ができる"
      ],
      cons: [
        "パッチ適用・監視などOS運用の負荷が丸ごと残る",
        "夜間や休日もVMが起動していれば課金が続く"
      ],
      cost: "<strong>月5万〜7万円程度</strong>が目安です（e2-standard-2を2台で約1.5万円+VPN約1.1万円+内部ALB約3,000円+Cloud SQL約1.5万円+ディスク等）。※東京リージョン・1USD=150円換算。",
      references: [
        { title: "Cloud NATの概要", url: "https://cloud.google.com/nat/docs/overview?hl=ja" },
        { title: "インスタンスグループ", url: "https://cloud.google.com/compute/docs/instance-groups?hl=ja", note: "MIGの公式解説" }
      ]
    }
  ],
  cost: "<p>推奨構成は<strong>月3万〜5万円程度</strong>、IAP案は<strong>月2万〜3.5万円程度</strong>、VM構成案は<strong>月5万〜7万円程度</strong>が目安です。金額差よりも、IAP案はVPN費用と運用が消える代わりに「インターネット上に入口が存在する」点が本質的な違いです。※東京リージョン・1USD=150円前後の概算。</p>",
  summary: "<p>閉域システムの分かれ目は<strong>「規程の文言」と「働き方」</strong>です。「インターネットから到達できないこと」が必須なら内部ALBの閉域構成、「許可された本人しか使えないこと」が本質でリモートワークが主体ならIAPのゼロトラスト構成が候補になります。GCPではCloud Runのingress設定によりサーバーレスのまま閉域を組めるのが特徴で、Cloud NATは「VPC内のVMの外向き出口」にだけ登場する、という位置づけも本ケースで押さえましょう。オフィスとの接続の作り方そのものはケース33で深掘りします。</p>",
  quiz: [
    {
      q: "推奨構成の図にはCloud NATが描かれていませんが、代替案2（VM構成）には登場します。この違いはなぜ生まれるのでしょうか。",
      a: "Cloud NATはVPC内のプライベートなVMが外向きに通信するための出口だからです。推奨構成はCloud Runのサーバーレス構成でVPC内にVMが存在せず、外向き通信はGoogleの管理する経路で行われるためNATの出番がありません。VMを置いた瞬間にOSパッチ取得などの外向き通信が必要になり、初めてNATが登場します。「NATがあるか」は「VMがいるか」とほぼ対応すると覚えると構成図が読みやすくなります。"
    },
    {
      q: "内部ALBを立てたのに、Cloud Runのingress設定を既定（すべて許可）のままにすると何が起きるでしょうか。",
      a: "Cloud Runには既定でrun.appドメインの公開URLが発行されるため、内部ALBとは無関係にインターネットからアプリへ直接アクセスできてしまい、閉域構成が骨抜きになります。ingressを「内部とロードバランサ経由のみ」に設定して初めて公開URL経由のアクセスが遮断されます。入口を作る設定と裏口を塞ぐ設定はセットで行う必要がある、という閉域構成の典型的な落とし穴です。"
    },
    {
      q: "リモートワークが従業員の5割になり、VPNの帯域が逼迫してきました。「人事データをインターネットに公開しない」という規程は維持したいとき、あなたならどう検討を進めますか。",
      a: "まず規程の文言が「到達不能であること」なのか「許可された社員以外が使えないこと」なのかを確認します。後者ならIAPのゼロトラスト構成が有力で、VPN逼迫も同時に解消できます。前者のまま変えられないなら、VPN増強や、閲覧系の低機密機能だけをIAP側へ分離する段階的な構成も選択肢です。技術より先に要件の言葉を確かめるのが、この種の判断の出発点です。"
    }
  ]
});
