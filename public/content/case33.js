// ケース33：ハイブリッド接続（オンプレ併用）
registerCase({
  id: 33,
  category: "社内・閉域・ハイブリッド",
  title: "ハイブリッド接続（オンプレ併用）",
  scenario: "<p>全国に工場を持つ製造業です。基幹システム（生産管理）は当面オンプレミスのデータセンターに残し、分析基盤と新規システムをGCPに構築します。オンプレとGCPの間では毎日数百GBのデータ連携に加え、業務時間中は基幹システムへの常時参照が発生します。帯域と遅延の安定、そして経路の冗長化が必須です。ネットワーク担当は専任2人で、障害時に手作業で経路を切り替える運用は避けたいと考えています。</p>",
  requirements: [
    "オンプレとGCPの間で安定した帯域（数Gbps）と低遅延を確保したい",
    "経路は冗長化し、片方が落ちても通信を継続したい",
    "障害時の経路切替は自動で行いたい（手動の経路書き換えはしない）",
    "オンプレとクラウドで相互に名前解決できるようにしたい",
    "回線の使用率・死活を常時監視したい"
  ],
  main: {
    name: "Dedicated Interconnect+HA VPN予備経路のハイブリッド接続",
    diagram: {
      cols: 5, rows: 3,
      groups: [
        { type: "onpremise", label: "オンプレDC", from: [0, 0], to: [0, 2] },
        { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [4, 2] },
        { type: "vpc", label: "VPCネットワーク", from: [2, 1], to: [4, 2], depth: 1 }
      ],
      nodes: [
        { id: "erp", icon: "client/onprem-server", label: "基幹システム\n生産管理", col: 0, row: 1 },
        { id: "ic", icon: "network/interconnect", label: "Interconnect\n専用線", col: 1, row: 1 },
        { id: "vpn", icon: "network/cloud-vpn", label: "HA VPN\n予備経路", col: 1, row: 2 },
        { id: "mon", icon: "ops/cloud-monitoring", label: "Monitoring\n回線監視", col: 2, row: 0 },
        { id: "router", icon: "network/cloud-router", label: "Cloud Router\nBGP経路交換", col: 2, row: 1 },
        { id: "dns", icon: "network/cloud-dns", label: "Cloud DNS\n名前解決連携", col: 3, row: 0 },
        { id: "gce", icon: "compute/compute-engine", label: "GCE\n連携システム", col: 3, row: 1 },
        { id: "sql", icon: "database/cloud-sql", label: "Cloud SQL\n移行済みDB", col: 4, row: 1 }
      ],
      edges: [
        { from: "erp", to: "ic", label: "主経路" },
        { from: "erp", to: "vpn", label: "予備" },
        { from: "ic", to: "router", label: "BGP" },
        { from: "vpn", to: "router", label: "BGP(予備)" },
        { from: "router", to: "gce", label: "相互通信" },
        { from: "gce", to: "sql", label: "SQL" },
        { from: "gce", to: "dns", label: "名前解決", dashed: true },
        { from: "mon", to: "router", label: "リンク監視", dashed: true }
      ]
    },
    flow: [
      "主経路はDedicated Interconnect。オンプレDCとGoogleの接続拠点を物理の専用線で結び、安定した帯域と低遅延を確保する",
      "予備経路としてHA VPNを敷く。普段は使わず、専用線の障害時だけ通信を引き受ける",
      "経路の使い分けはCloud RouterがBGP（経路情報を自動交換するプロトコル）で制御する。専用線側の経路を優先度高で広報しておき、障害時はVPN側へ自動で切り替わる",
      "VPC内のシステムはオンプレの基幹システムと相互に通信する。名前解決はCloud DNSの転送ゾーンでオンプレのDNSと連携し、双方向に名前で引けるようにする",
      "接続の使用率やトンネル状態はCloud Monitoringで監視し、帯域逼迫や断を検知したら通知する"
    ],
    services: [
      { icon: "network/interconnect", name: "Cloud Interconnect（Dedicated）", role: "オンプレとGCPを結ぶ物理専用線。安定した帯域・低遅延・割引された転送単価を提供する" },
      { icon: "network/cloud-vpn", name: "Cloud VPN（HA VPN）", role: "インターネット上に張る暗号化トンネル。ここでは専用線障害時の予備経路" },
      { icon: "network/cloud-router", name: "Cloud Router", role: "BGPでオンプレと経路情報を自動交換する頭脳。障害時の自動切替を実現する" },
      { icon: "network/cloud-dns", name: "Cloud DNS", role: "転送ゾーン等でオンプレDNSと連携し、ハイブリッド環境の名前解決を成立させる" },
      { icon: "ops/cloud-monitoring", name: "Cloud Monitoring", role: "回線使用率・トンネル状態・BGPセッションの監視と通知" },
      { icon: "compute/compute-engine", name: "Compute Engine", role: "オンプレと連携するGCP側システムの例" },
      { icon: "database/cloud-sql", name: "Cloud SQL", role: "GCP側へ移行済みのデータベースの例" }
    ],
    points: [
      "専用線1本で満足しないのが定石です。物理回線は工事事故や災害で落ちる前提で考え、性質の異なる予備経路（インターネット経由のVPN）を組み合わせて共倒れを防ぎます",
      "静的ルートではなくBGPによる動的経路制御にしたのは、障害時に人手で経路を書き換える運用では切替が間に合わないからです。Cloud Routerがこの構成の要になります",
      "DNSを後回しにしないこと。IPアドレス直書きの連携は移行や障害切替のたびに破綻します。GCP→オンプレ、オンプレ→GCPの双方向の名前解決を最初に設計します",
      "帯域は「平均」ではなく「日次バッチのピーク」で見積もります。平均転送量で決めると、夜間バッチが朝までに終わらない事故につながります"
    ],
    pros: [
      "帯域・遅延が安定し、SLA（稼働率の保証）のある接続になる",
      "障害時の経路切替がBGPで自動化される",
      "外向きデータ転送の単価がインターネット経由より安くなり、大量連携ほど効果が大きい"
    ],
    cons: [
      "物理工事を伴うため、開通まで数週間〜数か月かかる",
      "月額コストが高い（10Gbpsポートで月26万円前後+設備側費用）",
      "接続拠点までの回線手配やオンプレ側ルーターの運用など、オンプレ側にもネットワークの専門知識が必要"
    ],
    cost: "<strong>月30万円前後から</strong>が目安です。内訳の例：Dedicated Interconnectの10Gbpsポートが月約26万円+VLANアタッチメント料、予備のHA VPNが月約1.1万円、これにオンプレ側の回線・機器費が加わります。専用線経由の外向き転送は割引単価が適用されるため、転送量が多いほどインターネット経由との差が縮まります。※東京リージョン・1USD=150円換算の概算。",
    references: [
      { title: "Dedicated Interconnectの概要", url: "https://cloud.google.com/network-connectivity/docs/interconnect/concepts/dedicated-overview?hl=ja" },
      { title: "Cloud VPNの概要", url: "https://cloud.google.com/network-connectivity/docs/vpn/concepts/overview?hl=ja" },
      { title: "Cloud Routerの概要", url: "https://cloud.google.com/network-connectivity/docs/router/concepts/overview?hl=ja", note: "BGPによる動的経路制御の仕組み" },
      { title: "DNS転送ゾーン", url: "https://cloud.google.com/dns/docs/zones/forwarding-zones?hl=ja", note: "オンプレDNSとの連携方法" },
      { title: "ネットワーク接続プロダクトの選択", url: "https://cloud.google.com/network-connectivity/docs/how-to/choose-product?hl=ja", note: "接続方式の公式な選び方ガイド" }
    ]
  },
  alternatives: [
    {
      name: "HA VPNのみで始める構成",
      when: "帯域が1Gbps程度までで足り、数日〜数週間で接続を作りたい・専用線のコストがまだ出せない場合",
      diagram: {
        cols: 4, rows: 1,
        groups: [
          { type: "onpremise", label: "オンプレDC", from: [0, 0], to: [0, 0] },
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [3, 0] },
          { type: "vpc", label: "VPC", from: [2, 0], to: [3, 0], depth: 1 }
        ],
        nodes: [
          { id: "erp", icon: "client/onprem-server", label: "基幹システム\n生産管理", col: 0, row: 0 },
          { id: "vpn", icon: "network/cloud-vpn", label: "HA VPN\nトンネル2本", col: 1, row: 0 },
          { id: "router", icon: "network/cloud-router", label: "Cloud Router\nBGP", col: 2, row: 0 },
          { id: "gce", icon: "compute/compute-engine", label: "GCE\n連携システム", col: 3, row: 0 }
        ],
        edges: [
          { from: "erp", to: "vpn", label: "IPsec×2本" },
          { from: "vpn", to: "router", label: "BGP" },
          { from: "router", to: "gce", label: "相互通信" }
        ]
      },
      flow: [
        "オンプレのVPN装置とGCPのHA VPNゲートウェイの間で、IPsecの暗号化トンネルを2本張る",
        "2本のトンネルそれぞれにBGPセッションを張り、片方の断でもう片方へ自動で切り替わる（構成要件を満たせば稼働率99.99%のSLA）",
        "VPC内のシステムとオンプレが、暗号化トンネル越しに相互通信する"
      ],
      services: [
        { icon: "network/cloud-vpn", name: "Cloud VPN（HA VPN）", role: "インターネット上の暗号化トンネル。2本構成が前提の高可用版VPN" },
        { icon: "network/cloud-router", name: "Cloud Router", role: "トンネルごとのBGPセッションを管理し、断時の自動切替を担う" },
        { icon: "compute/compute-engine", name: "Compute Engine", role: "オンプレと連携するGCP側システムの例" }
      ],
      points: [
        "インターネット越しのIPsecなので、遅延と実効帯域は経路品質に左右されます。「安定性が業務要件になった時」が専用線へ移行するタイミングです",
        "HA VPNはトンネル2本+BGPが前提の設計です。1本だけの構成で済ませると、SLAも自動切替も成立しません",
        "物理工事が無いため開通が速いのが最大の利点です。PoCや移行初期はここから始め、連携が太くなったらInterconnectを追加してVPNを予備に回す、という段階的な進め方がGCPでは一般的です"
      ],
      pros: [
        "月1万円台から使え、数日で開通できる",
        "IPsecによる暗号化が標準でかかる"
      ],
      cons: [
        "帯域はトンネルあたり最大3Gbps程度で、インターネットの混雑に影響される",
        "遅延が安定せず、常時参照の多い業務にはストレスが出ることがある"
      ],
      cost: "<strong>月1万〜2万円程度</strong>が目安です（トンネル2本で月約1.1万円+外向きデータ転送量）。※東京リージョン・1USD=150円換算。",
      references: [
        { title: "HA VPNのトポロジ", url: "https://cloud.google.com/network-connectivity/docs/vpn/concepts/topologies?hl=ja", note: "99.99%SLAを満たす構成パターン" },
        { title: "Cloud VPNの概要", url: "https://cloud.google.com/network-connectivity/docs/vpn/concepts/overview?hl=ja" }
      ]
    },
    {
      name: "Partner Interconnectで事業者経由の接続",
      when: "専用線の安定性は欲しいが10Gbpsも要らない（50Mbps〜数Gbps）、またはDCがGoogleの接続拠点から遠い場合",
      diagram: {
        cols: 5, rows: 1,
        groups: [
          { type: "onpremise", label: "オンプレDC", from: [0, 0], to: [0, 0] },
          { type: "external", label: "事業者網", from: [1, 0], to: [1, 0] },
          { type: "gcp-cloud", label: "Google Cloud", from: [2, 0], to: [4, 0] },
          { type: "vpc", label: "VPC", from: [3, 0], to: [4, 0], depth: 1 }
        ],
        nodes: [
          { id: "erp", icon: "client/onprem-server", label: "基幹システム\n生産管理", col: 0, row: 0 },
          { id: "partner", icon: "client/external-saas", label: "接続事業者\nの網", col: 1, row: 0 },
          { id: "ic", icon: "network/interconnect", label: "Partner\nInterconnect", col: 2, row: 0 },
          { id: "router", icon: "network/cloud-router", label: "Cloud Router\nBGP", col: 3, row: 0 },
          { id: "gce", icon: "compute/compute-engine", label: "GCE\n連携システム", col: 4, row: 0 }
        ],
        edges: [
          { from: "erp", to: "partner", label: "拠点接続" },
          { from: "partner", to: "ic", label: "既設の接続" },
          { from: "ic", to: "router", label: "BGP" },
          { from: "router", to: "gce", label: "相互通信" }
        ]
      },
      flow: [
        "オンプレDCから通信事業者（パートナー）の網へ接続する。多くのDCは事業者網への接続が容易",
        "事業者網とGoogleの間は事業者が既に敷設済みのため、必要な帯域のVLANアタッチメントを申し込むだけで専用線品質の経路が使える",
        "経路制御は推奨構成と同じくCloud RouterのBGPで自動化する"
      ],
      services: [
        { icon: "network/interconnect", name: "Cloud Interconnect（Partner）", role: "事業者経由でGCPへつなぐ専用線サービス。帯域を50Mbps〜と小さく選べる" },
        { icon: "client/external-saas", name: "接続事業者", role: "オンプレとGoogleの間を仲介する通信事業者。物理接続の大半を肩代わりする" },
        { icon: "network/cloud-router", name: "Cloud Router", role: "BGPによる経路の自動交換" },
        { icon: "compute/compute-engine", name: "Compute Engine", role: "オンプレと連携するGCP側システムの例" }
      ],
      points: [
        "Dedicatedは10Gbps/100Gbps単位ですが、Partnerは50Mbpsから帯域を刻んで契約でき、必要量とのミスマッチを避けられます",
        "物理工事の大半を事業者が肩代わりするため、Dedicatedより開通が速いことが多いです",
        "事業者網を挟むぶん責任分界点が増えます。障害時にどこへ問い合わせるか、切り分けの窓口を契約時に確認しておきます"
      ],
      pros: [
        "帯域を必要なぶんだけ契約でき、小さく始めて増速できる",
        "専用線品質を比較的速く・安く手に入れられる"
      ],
      cons: [
        "事業者の利用料が上乗せされる",
        "エンドツーエンドの品質と障害対応が事業者に依存する"
      ],
      cost: "帯域によって<strong>月数万円〜十数万円</strong>が目安です（GCP側のVLANアタッチメント料+事業者側の回線費）。同じ帯域ならHA VPNより高くDedicatedより安い、中間の位置づけです。",
      references: [
        { title: "Partner Interconnectの概要", url: "https://cloud.google.com/network-connectivity/docs/interconnect/concepts/partner-overview?hl=ja" },
        { title: "ネットワーク接続プロダクトの選択", url: "https://cloud.google.com/network-connectivity/docs/how-to/choose-product?hl=ja" }
      ]
    }
  ],
  cost: "<p>HA VPNのみなら<strong>月1万〜2万円程度</strong>、Partner Interconnectは帯域に応じて<strong>月数万円〜十数万円</strong>、Dedicated Interconnect（10Gbps）+予備VPNは<strong>月30万円前後から</strong>が目安です。転送量が大きい場合、専用線系は外向き転送の割引単価によって実質差が縮まる点も比較に入れましょう。※東京リージョン・1USD=150円前後の概算。</p>",
  summary: "<p>ハイブリッド接続は<strong>帯域・安定性・開通スピード・費用の4軸のトレードオフ</strong>で選びます。判断の型は「HA VPNで始める、本番連携が太くなったらPartner、基幹級の安定が要るならDedicated+VPN予備」という段階的な進め方です。どの方式を選んでも、Cloud RouterによるBGPの自動経路制御と、双方向DNSの設計は共通の土台になります。この接続の上で動く閉域システムはケース32、この経路を使った移行はケース34で扱います。</p>",
  quiz: [
    {
      q: "月26万円も払って専用線を引いたのに、さらに予備のVPNまで敷くのはなぜでしょうか。また、VPNが「予備」として機能するために欠かせない仕組みは何でしょうか。",
      a: "専用線は物理設備なので、工事事故や災害、機器故障で落ちることがある前提で設計するためです。インターネット経由のVPNは専用線と障害の性質が異なるため、共倒れしにくい予備になります。そして切替を成立させるのがCloud RouterのBGPです。専用線側の経路を優先度高で広報しておくことで、障害時には人手を介さずVPN経路へ自動で切り替わります。予備経路は自動切替とセットで初めて意味を持ちます。"
    },
    {
      q: "接続帯域を「1日の平均転送量」から計算して契約すると、どんな問題が起きやすいでしょうか。",
      a: "データ連携は一日に均等に流れるのではなく、夜間バッチなど特定の時間帯に集中します。平均で見積もると、ピーク時に帯域が足りず夜間バッチが朝までに終わらない、業務時間の参照が遅くなる、といった形で破綻します。見積もりは「最大のバッチが許容時間内に転送し終わる帯域」を基準にし、Cloud Monitoringで実際の使用率を見ながら増速を判断するのが実務的な進め方です。"
    },
    {
      q: "要件が「帯域200Mbps・開通は1か月以内・回線予算は月10万円まで」だったら、あなたならどの接続方式を選びますか。",
      a: "Partner Interconnectが本命です。200MbpsはDedicatedの10Gbps単位には小さすぎ、事業者経由なら帯域を刻んで契約でき、物理工事の大半を事業者が担うため1か月以内の開通も現実的です。予算面でも帯域次第で月数万円台に収まります。もし安定性の要件が緩く費用を最小にしたいならHA VPNも比較対象になりますが、200Mbpsを常時安定して使いたいなら専用線品質のPartnerに分があります。"
    }
  ]
});
