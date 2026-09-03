// ケース1：コーポレートサイト・LP（静的サイト）
registerCase({
  id: 1,
  category: "Webサイト・配信",
  title: "コーポレートサイト・LP（静的サイト）",
  scenario: "<p>中小企業のコーポレートサイトや、キャンペーン用のランディングページを公開したい。ページはHTML/CSS/JS/画像だけの静的な構成で、更新は月に数回。アクセスは普段少ないものの、テレビやSNSで紹介された瞬間だけ跳ね上がる可能性がある。担当エンジニアは1人で、他業務と兼任している。</p>",
  requirements: [
    "静的コンテンツ（HTML/CSS/JS/画像）が中心",
    "テレビ・SNS紹介による急なアクセス集中に耐えたい（バズ耐性）",
    "サーバーの保守・パッチ当てはやりたくない",
    "独自ドメイン＋HTTPSは必須",
    "月額コストはできるだけ小さくしたい"
  ],
  main: {
    name: "Cloud Storage+Cloud CDN静的配信",
    diagram: {
      cols: 4, rows: 2,
      groups: [
        { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [3, 1] }
      ],
      nodes: [
        { id: "users", icon: "client/users", label: "ユーザー", col: 0, row: 1 },
        { id: "dns", icon: "network/cloud-dns", label: "Cloud DNS\n名前解決", col: 1, row: 0 },
        { id: "cdn", icon: "network/cloud-cdn", label: "Cloud CDN\nキャッシュ", col: 2, row: 0 },
        { id: "cert", icon: "security/certificate-manager", label: "Certificate Manager\nSSL証明書", col: 3, row: 0 },
        { id: "lb", icon: "network/cloud-load-balancing", label: "Cloud LB\nHTTPS終端", col: 1, row: 1 },
        { id: "gcs", icon: "storage/cloud-storage", label: "Cloud Storage\n静的ファイル", col: 3, row: 1 }
      ],
      edges: [
        { from: "users", to: "dns", label: "名前解決", dashed: true },
        { from: "users", to: "lb", label: "HTTPS" },
        { from: "lb", to: "gcs", label: "キャッシュミス時取得" },
        { from: "cdn", to: "lb", noArrow: true, dashed: true },
        { from: "cert", to: "lb", noArrow: true, dashed: true }
      ]
    },
    flow: [
      "ユーザーが独自ドメインへアクセスすると、Cloud DNSが名前解決してCloud Load Balancingのグローバルな公開IPへ誘導します",
      "Cloud Load BalancingがHTTPSを終端します。証明書はCertificate Managerが発行し、期限切れ前に自動更新します",
      "Cloud CDNが世界中のエッジ拠点でコンテンツをキャッシュ配信します。キャッシュにあれば、Cloud Storageまでリクエストは届きません",
      "キャッシュにない場合だけ、バックエンドバケットとして登録したCloud Storageからファイルを取得します"
    ],
    services: [
      { icon: "storage/cloud-storage", name: "Cloud Storage", role: "HTML・画像などのファイル置き場。サーバー不要で高耐久のオブジェクトストレージです" },
      { icon: "network/cloud-cdn", name: "Cloud CDN", role: "CDN（コンテンツ配信網）。世界中のエッジでキャッシュ配信し、表示を高速化しつつオリジンの負荷を減らします" },
      { icon: "network/cloud-load-balancing", name: "Cloud Load Balancing", role: "グローバルな入口。HTTPS終端とCloud CDN・バックエンドバケットの紐付けを担います" },
      { icon: "network/cloud-dns", name: "Cloud DNS", role: "DNS。独自ドメインをロードバランサーの公開IPへ向けます" },
      { icon: "security/certificate-manager", name: "Certificate Manager", role: "SSL/TLS証明書を無料で発行・自動更新し、HTTPS化の手間をなくします" }
    ],
    points: [
      "バケットを直接公開するのではなく、ロードバランサーのバックエンドバケットとして配信します。独自ドメインのHTTPSとCDNを両立できるのがこの形だからです",
      "CDNのキャッシュ保持期間（TTL）は長めに設定し、サイト更新時はデプロイと一緒にキャッシュ無効化を実行する運用にすると、配信コストと表示速度の両方で有利です",
      "バズってもCDNとCloud Storageが自動で受け止めるため、事前のキャパシティ設計は不要です",
      "この図にVPCやCloud NATが無いのは省略ではありません。登場する部品はすべてVPCの外にあるマネージドサービスで、自前のネットワークを作る必要がそもそも無い構成です"
    ],
    pros: [
      "サーバー管理ゼロ（OSパッチ・スケーリングの心配がない）",
      "急なアクセス集中に自動で耐える",
      "Googleのグローバルネットワークで世界中どこからでも速い",
      "構成が単純で、兼任1人でも運用できる"
    ],
    cons: [
      "ロードバランサーに固定費（月2,700円前後）がかかり、超小規模サイトには割高",
      "サーバー側の動的処理はできない（問い合わせフォームは別途APIが必要）",
      "キャッシュ無効化の運用を知らないと「更新が反映されない」と混乱しがち",
      "DNS・LB・証明書・CDN・バケットと登場人物が多く、初回設定はそれなりに手数がある"
    ],
    cost: "<strong>月3,000円前後〜</strong>。大半はCloud Load Balancingの固定費（約18USD＝約2,700円/月）で、Cloud Storageの保存料とCloud CDNの配信量は小規模サイトなら数十円〜数百円です。東京リージョン・1USD=150円前後での目安であり、料金改定や為替で変わります。",
    references: [
      { title: "静的ウェブサイトをホストする", url: "https://cloud.google.com/storage/docs/hosting-static-website?hl=ja", note: "この構成そのものの公式ガイド" },
      { title: "バックエンドバケットの設定", url: "https://cloud.google.com/load-balancing/docs/backend-bucket?hl=ja", note: "LBとCloud Storageの紐付け方" },
      { title: "Cloud CDNの概要", url: "https://cloud.google.com/cdn/docs/overview?hl=ja" },
      { title: "Certificate Managerの概要", url: "https://cloud.google.com/certificate-manager/docs/overview?hl=ja" },
      { title: "Cloud DNSの概要", url: "https://cloud.google.com/dns/docs/overview?hl=ja" }
    ]
  },
  alternatives: [
    {
      name: "Firebase Hosting（最小コスト・最小手数）",
      when: "コストを最小にしたい・コマンド1つでHTTPS配信まで済ませたい場合",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [2, 0], to: [3, 1] }
        ],
        nodes: [
          { id: "dev", icon: "client/developer", label: "開発者\nfirebase deploy", col: 0, row: 0 },
          { id: "users", icon: "client/users", label: "ユーザー", col: 0, row: 1 },
          { id: "fbh", icon: "compute/firebase-hosting", label: "Firebase\nHosting", col: 2, row: 0 }
        ],
        edges: [
          { from: "dev", to: "fbh", label: "デプロイ" },
          { from: "users", to: "fbh", label: "HTTPS" }
        ]
      },
      flow: [
        "開発者がfirebase deployコマンドを実行すると、ビルド済みファイルがFirebase Hostingへアップロードされます",
        "ユーザーはFirebase Hosting内蔵のグローバルCDN経由でHTTPS配信を受けます",
        "独自ドメインの設定とSSL証明書の発行・更新はFirebase Hostingが自動で面倒を見ます"
      ],
      services: [
        { icon: "compute/firebase-hosting", name: "Firebase Hosting", role: "静的サイト向けのホスティング。CDN・HTTPS・独自ドメイン・ロールバックまでを一体で提供します" }
      ],
      points: [
        "ロードバランサーの固定費が無く、無料枠（保存10GB・転送360MB/日程度）も大きいため、小規模サイトでは実質最安の選択肢です",
        "プレビューチャンネル機能で公開前の確認用URLを発行でき、レビューの仕組みを自作しなくて済みます",
        "FirebaseはGoogle Cloudと同じ基盤・同じプロジェクトで動きます。ブランドが違うだけで別クラウドではありません",
        "細かいキャッシュ制御や他のGCPサービスとの高度な連携が必要になったら、推奨構成（LB+Cloud Storage）への移行を検討します"
      ],
      pros: [
        "コマンド1つでデプロイからHTTPS配信まで完結し、設定の手数が最小",
        "固定費ゼロ。無料枠内なら月0円で運用できる",
        "ロールバックが管理画面から1クリックでできる"
      ],
      cons: [
        "推奨構成に比べてキャッシュやルーティングの細かい制御はしにくい",
        "Cloud LoggingやCloud Armorなど、GCP側の運用・防御機能との統合は限定的"
      ],
      cost: "<strong>月0円〜数百円</strong>。無料枠（保存10GB・転送360MB/日程度）を超えたぶんだけの従量課金で、小規模なコーポレートサイトならほぼ無料枠内に収まります。",
      references: [
        { title: "Firebase Hostingの紹介", url: "https://firebase.google.com/docs/hosting?hl=ja", note: "公式ドキュメントの入口" },
        { title: "カスタムドメインを接続する", url: "https://firebase.google.com/docs/hosting/custom-domain?hl=ja" }
      ]
    },
    {
      name: "Cloud Run配信（動的化を見据える）",
      when: "近い将来フォーム処理やサーバーサイド描画などの動的処理を同居させたい場合",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [2, 0], to: [3, 1] }
        ],
        nodes: [
          { id: "dev", icon: "client/developer", label: "開発者\ngit push", col: 0, row: 0 },
          { id: "users", icon: "client/users", label: "ユーザー", col: 0, row: 1 },
          { id: "build", icon: "devtools/cloud-build", label: "Cloud Build\n自動ビルド", col: 2, row: 0 },
          { id: "run", icon: "compute/cloud-run", label: "Cloud Run\nWeb配信", col: 2, row: 1 }
        ],
        edges: [
          { from: "dev", to: "build", label: "push検知" },
          { from: "build", to: "run", label: "デプロイ" },
          { from: "users", to: "run", label: "HTTPS" }
        ]
      },
      flow: [
        "開発者がGitリポジトリへpushすると、Cloud Buildが検知してコンテナイメージをビルドします",
        "ビルドしたイメージをCloud Runへ自動デプロイします",
        "ユーザーはCloud RunへHTTPSでアクセスします。リクエスト数に応じてインスタンスが0台から自動で増減します"
      ],
      services: [
        { icon: "compute/cloud-run", name: "Cloud Run", role: "コンテナを動かすサーバーレス実行環境。Webサーバーのコンテナを置けば静的配信も動的処理もできます" },
        { icon: "devtools/cloud-build", name: "Cloud Build", role: "Git連携のCI/CD。pushをきっかけにビルドとデプロイを自動化します" }
      ],
      points: [
        "静的配信だけなら過剰ですが、フォーム処理・ログイン・サーバーサイド描画をあとから同じ場所に足せる拡張余地が最大の価値です",
        "アイドル時は0台までスケールインするため固定費がほぼゼロです。代わりに、しばらくアクセスが無いあとの初回リクエストは起動待ち（コールドスタート：停止中のインスタンスが立ち上がるまでの数秒の遅延）が発生します",
        "独自ドメインは簡易にはドメインマッピング機能、本番品質ではロードバランサー経由（Cloud CDNやCloud Armorも併用可能）を使い分けます"
      ],
      pros: [
        "動的処理へ段階的に拡張できる（作り直しが不要）",
        "アイドル時のコストがほぼゼロ",
        "push起点の自動デプロイで更新作業が楽"
      ],
      cons: [
        "静的サイト用途としてはコンテナ作成・CI/CD整備のぶん初期の手数が多い",
        "コールドスタートで稀に初回表示が遅れる",
        "CDNを効かせるにはロードバランサー追加（固定費約2,700円/月）が必要"
      ],
      cost: "<strong>月0円〜数百円</strong>。リクエスト数とCPU稼働時間の従量課金で、無料枠が大きく小規模なら実質無料です。Cloud CDN併用時はロードバランサーの固定費（約2,700円/月）が加わります。",
      references: [
        { title: "Cloud Runとは", url: "https://cloud.google.com/run/docs/overview/what-is-cloud-run?hl=ja" },
        { title: "カスタムドメインのマッピング", url: "https://cloud.google.com/run/docs/mapping-custom-domains?hl=ja" },
        { title: "Cloud Buildの概要", url: "https://cloud.google.com/build/docs/overview?hl=ja" }
      ]
    }
  ],
  cost: "<p>推奨構成は<strong>月3,000円前後〜</strong>で、その大半がロードバランサーの固定費です。Firebase Hosting案なら<strong>月0円〜数百円</strong>、Cloud Run案も<strong>月0円〜数百円</strong>（CDNを足すと+2,700円前後）が目安です。いずれも東京リージョン・1USD=150円前後の概算で、GCPでは「静的サイトの最安はFirebase Hosting、拡張性の本命はLB+Cloud Storage」という関係になります。</p>",
  summary: "<p>静的サイト配信はクラウドの入門にして最頻出のパターンです。GCPで特徴的なのは、<strong>Cloud CDNを使うにはグローバルロードバランサーが必要で、そこに固定費がかかる</strong>という点です。だからこそ超小規模ではFirebase Hostingが定石になり、企業サイトとして他のGCPサービスと統合していくならLB+Cloud Storage構成が本命になります。動的処理が必要になったらケース7のCloud Run構成へ、非エンジニアが更新する要件が入ったらケース2のCMS構成へ、と要件の変化で答えが変わる感覚をつかみましょう。</p>",
  quiz: [
    {
      q: "推奨構成の図にはVPCもCloud NATも描かれていません。これはなぜでしょうか。",
      a: "Cloud Storage・Cloud CDN・Cloud Load Balancing・Cloud DNSはいずれもVPCの外にあるマネージドサービスで、利用者はGoogleが運用する公開エンドポイントへ直接アクセスするためです。VPCやNATは自分のネットワーク内にVMなどを置く構成で初めて登場します。省略ではなく、存在しないのが正しい描写です。"
    },
    {
      q: "月間数千PVの個人サイトをこの推奨構成で見積もったら月3,000円でした。費用の大半はどこで、あなたならどうしますか。",
      a: "支配的なのはロードバランサーの固定費（約2,700円/月）で、保存や転送は数十円規模です。この規模ならFirebase Hostingへ切り替えれば無料枠内に収まる可能性が高く、HTTPSやCDNも内蔵されているため失うものがほとんどありません。規模と固定費のバランスで構成を選び直すのは典型的な判断です。"
    },
    {
      q: "サイトを更新したのに、ユーザーから「前のページのままだ」と連絡が来ました。何が起きていて、どう運用すべきでしょうか。",
      a: "Cloud CDNのエッジに古いキャッシュが残っていて、TTLが切れるまで旧ファイルが配信され続けている状態です。デプロイ手順の最後にキャッシュ無効化を組み込むか、ファイル名にハッシュを付けて更新のたびにURLが変わるようにすれば解決します。CDNを使う構成では「配信されるのはキャッシュ」という前提で運用を設計します。"
    }
  ]
});
