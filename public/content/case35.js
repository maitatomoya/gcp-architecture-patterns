// ケース35：社内向け生成AI活用基盤
registerCase({
  id: 35,
  category: "社内・閉域・ハイブリッド",
  title: "社内向け生成AI活用基盤",
  scenario: "<p>従業員2,000人の中堅企業です。個人契約の生成AIサービスに業務情報を貼り付ける「野良利用」（シャドーIT）が発覚し、いったん全面禁止にしたところ、今度は業務効率が目に見えて落ちました。情報システム部門は方針を転換し、「安全な公式ルート」として全社員に生成AIを開放することにします。条件は、入力した業務データが外部モデルの学習に使われないこと、社員以外は使えないこと、そして利用状況を監査できることです。</p>",
  requirements: [
    "入力した業務データがAIモデルの学習に使われないこと",
    "社員だけが使え、退職者は即座に使えなくなること",
    "誰が・いつ・どれだけ使ったかを監査できること",
    "誤設定や漏えいした認証情報によるデータ持ち出しを技術的に防ぎたい",
    "全社員に開放しても費用が予測できること"
  ],
  main: {
    name: "IAP+Cloud Run+Vertex AI Geminiの社内AI基盤",
    diagram: {
      cols: 4, rows: 3,
      groups: [
        { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [3, 2] },
        { type: "generic", label: "VPC Service Controls境界", from: [2, 0], to: [3, 2], depth: 1 }
      ],
      nodes: [
        { id: "users", icon: "client/users", label: "従業員\n2,000人", col: 0, row: 1 },
        { id: "lb", icon: "network/cloud-load-balancing", label: "外部ALB\nHTTPS", col: 1, row: 1 },
        { id: "iap", icon: "security/identity-aware-proxy", label: "IAP\n社員のみ許可", col: 1, row: 0 },
        { id: "run", icon: "compute/cloud-run", label: "Cloud Run\nチャットUI", col: 2, row: 1 },
        { id: "gemini", icon: "ai/gemini", label: "Gemini\nVertex AI", col: 3, row: 1 },
        { id: "fs", icon: "database/firestore", label: "Firestore\n会話履歴", col: 2, row: 0 },
        { id: "log", icon: "ops/cloud-logging", label: "Cloud Logging\n利用監査", col: 3, row: 2 }
      ],
      edges: [
        { from: "users", to: "lb", label: "HTTPS" },
        { from: "iap", to: "lb", noArrow: true, dashed: true },
        { from: "lb", to: "run", label: "認証済みのみ" },
        { from: "run", to: "gemini", label: "プロンプト" },
        { from: "run", to: "fs", label: "履歴保存" },
        { from: "run", to: "log", label: "監査ログ", dashed: true }
      ]
    },
    flow: [
      "従業員は社内ポータルからチャットUIへアクセスする。外部ALBに紐づいたIAPがGoogleアカウント（Google Workspace等）で本人確認し、社員以外を遮断する。退職者はアカウント停止と同時に使えなくなる",
      "Cloud Run上のチャットUIが、プロンプトをVertex AIのGemini APIへ送って回答を受け取る。Vertex AI経由の入力データは基盤モデルの学習に使われない",
      "会話履歴はFirestoreに保存し、続きからの会話や社内ナレッジの分析に使う",
      "VPC Service Controls（VPC-SC）の境界がプロジェクトのAPI群を囲み、境界の外へのデータ持ち出しをAPIレベルで遮断する",
      "誰が・いつ・どれだけ使ったかはCloud Loggingへ集約し、監査に備える"
    ],
    services: [
      { icon: "ai/gemini", name: "Vertex AI（Gemini）", role: "回答を生成するLLM。Vertex AI経由の利用では入力・出力が基盤モデルの学習に使われない" },
      { icon: "compute/cloud-run", name: "Cloud Run", role: "社内チャットUIとAPI。利用量に応じて自動でスケールする" },
      { icon: "security/identity-aware-proxy", name: "Identity-Aware Proxy", role: "アプリの手前で社員認証を行う門番。アプリに認証コードを書かずに済む" },
      { icon: "network/cloud-load-balancing", name: "外部アプリケーションロードバランサ", role: "HTTPSの入口。IAPと組み合わせて認証付きの玄関になる" },
      { icon: "security/vpc-service-controls", name: "VPC Service Controls", role: "プロジェクトのAPIを境界で囲み、境界外へのデータ持ち出しを遮断する防壁" },
      { icon: "database/firestore", name: "Firestore", role: "会話履歴の保存先。サーバーレスで運用の手間がない" },
      { icon: "ops/cloud-logging", name: "Cloud Logging", role: "利用ログと監査ログの集約先。「誰が何を使ったか」に答える" }
    ],
    points: [
      "シャドーIT対策の本丸は「禁止」ではなく「公式の安全な手段の提供」です。禁止だけでは利用が地下化して統制がさらに効かなくなるため、便利な公式ルートで需要を吸収します",
      "Vertex AI経由のGemini利用では、入力したプロンプトが基盤モデルの学習に使われないことが公式に明示されています。個人向けの無料AIサービスとの決定的な違いで、要件の1つ目に直接応えます",
      "VPC-SCはIAMとは別レイヤの防御です。IAMが「誰に何を許すか」なら、VPC-SCは「どこからAPIに触れるか」を制限します。認証情報が漏れても、境界の外からのAPI呼び出しやデータ持ち出しを遮断できます",
      "認証をIAPでアプリの外に出したため、チャットUI側は認証処理を持ちません。社内システムを増やすときも同じ型で守れる、横展開しやすい構成です"
    ],
    pros: [
      "データが学習に使われない・社員限定・監査可能というガバナンス3点を仕組みで担保できる",
      "API従量課金なので、利用の少ない社員が多くても無駄な固定費がかからない",
      "サーバーレス中心で、少人数の情シスでも運用できる"
    ],
    cons: [
      "モデルの進化が速く、モデル更新や料金改定への追従が継続的に必要",
      "VPC-SCは影響範囲が広く設定難度が高い（ドライラン機能で影響を確認してから有効化する）",
      "使い勝手が悪いと野良利用が再発するため、UI改善や社内広報といった非技術面の努力も必要"
    ],
    cost: "<strong>月5万〜15万円程度</strong>（利用量次第）が目安です。中心はGemini APIの従量課金で、たとえば社員500人が1日20回・平均1,500トークン規模で使っても月数万円程度に収まる計算です。ほかに外部ALB約3,000円、Cloud Run・Firestore・Loggingは少額です。モデル単価は改定が多いため、必ず最新の料金表で確認してください。※東京リージョン・1USD=150円換算の概算。",
    references: [
      { title: "Vertex AIの生成AIの概要", url: "https://cloud.google.com/vertex-ai/generative-ai/docs/overview?hl=ja" },
      { title: "生成AIとデータガバナンス", url: "https://cloud.google.com/vertex-ai/generative-ai/docs/data-governance?hl=ja", note: "入力データが学習に使われないことの公式説明" },
      { title: "VPC Service Controlsの概要", url: "https://cloud.google.com/vpc-service-controls/docs/overview?hl=ja" },
      { title: "Vertex AIとVPC Service Controls", url: "https://cloud.google.com/vertex-ai/docs/general/vpc-service-controls?hl=ja", note: "AI基盤を境界で守る設定" },
      { title: "IAPの概要", url: "https://cloud.google.com/iap/docs/concepts-overview?hl=ja" }
    ]
  },
  alternatives: [
    {
      name: "内部ALB+PSCの完全閉域AI基盤",
      when: "金融・医療など規制の厳しい業種で、インターネット経由のアクセス自体を許可できない場合",
      diagram: {
        cols: 5, rows: 3,
        groups: [
          { type: "onpremise", label: "社内ネットワーク", from: [0, 0], to: [0, 2] },
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [4, 2] },
          { type: "vpc", label: "VPCネットワーク", from: [1, 1], to: [2, 2], depth: 1 }
        ],
        nodes: [
          { id: "office", icon: "client/office", label: "社内PC\n従業員のみ", col: 0, row: 1 },
          { id: "vpn", icon: "network/cloud-vpn", label: "Cloud VPN\n閉域接続", col: 1, row: 1 },
          { id: "ilb", icon: "network/cloud-load-balancing", label: "内部ALB\n内部IPのみ", col: 2, row: 1 },
          { id: "run", icon: "compute/cloud-run", label: "Cloud Run\nチャットUI", col: 3, row: 1 },
          { id: "psc", icon: "network/private-service-connect", label: "PSC\nAPI閉域経路", col: 2, row: 2 },
          { id: "gemini", icon: "ai/gemini", label: "Gemini\nVertex AI", col: 4, row: 1 }
        ],
        edges: [
          { from: "office", to: "vpn", label: "閉域接続" },
          { from: "vpn", to: "ilb", label: "内部IP宛て" },
          { from: "ilb", to: "run", label: "HTTPS" },
          { from: "run", to: "psc" },
          { from: "psc", to: "gemini", label: "閉域で到達" }
        ]
      },
      flow: [
        "従業員は社内ネットワークからVPN経由でアクセスする。入口は内部ALBのみで、インターネット側に到達点が存在しない（ケース32と同じ閉域の型）",
        "Cloud RunはVPCへの直接egressでVPC内に出て、Private Service Connectのエンドポイント経由でVertex AIのAPIへ到達する",
        "プロンプトも回答もインターネットを通らず、Googleの内部ネットワークだけを流れる"
      ],
      services: [
        { icon: "network/cloud-load-balancing", name: "内部アプリケーションロードバランサ", role: "内部IPのみの入口。インターネットに到達点を作らない" },
        { icon: "network/private-service-connect", name: "Private Service Connect", role: "VPCからVertex AIなどのGoogle APIへ閉域で到達する経路" },
        { icon: "compute/cloud-run", name: "Cloud Run", role: "チャットUI。ingressを内部に絞り、egressはVPC経由に固定する" },
        { icon: "network/cloud-vpn", name: "Cloud VPN", role: "オフィスとの閉域接続" },
        { icon: "ai/gemini", name: "Vertex AI（Gemini）", role: "回答を生成するLLM。閉域経路の先で応答する" }
      ],
      points: [
        "推奨構成との違いは入口だけではなく出口です。Cloud RunからGemini APIへの呼び出しもPSC経由の閉域にすることで、往復ともインターネットに出ない経路が完成します",
        "ケース32の閉域業務システムとケース33の接続設計を、生成AIに適用した応用形です。閉域の型を一度作れば他のAIサービスにも流用できます",
        "リモートワークの社員はVPN経由でしか使えなくなるため、利便性と規制要件のバランスを事前に合意しておくことが重要です"
      ],
      pros: [
        "インターネットに一切出ない経路で生成AIを使え、最も厳しい規制要件に応えられる",
        "閉域の型を他の社内AIサービスにも横展開できる"
      ],
      cons: [
        "VPN・内部ALB・PSCと構成要素が増え、構築・運用の難度が上がる",
        "社外からの利用にはVPN接続が必須になり、利便性が下がる"
      ],
      cost: "推奨構成に<strong>VPN約1.1万円とPSC・内部ALBの費用を上乗せ</strong>した月6万〜17万円程度が目安です。Gemini APIの従量課金部分は推奨構成と変わりません。",
      references: [
        { title: "Private Service Connect", url: "https://cloud.google.com/vpc/docs/private-service-connect?hl=ja" },
        { title: "Cloud RunのダイレクトVPC下り（外向き）", url: "https://cloud.google.com/run/docs/configuring/vpc-direct-vpc?hl=ja", note: "Cloud RunをVPC経由で通信させる設定" },
        { title: "Vertex AIとVPC Service Controls", url: "https://cloud.google.com/vertex-ai/docs/general/vpc-service-controls?hl=ja" }
      ]
    },
    {
      name: "法人向け生成AI SaaSを契約して使う",
      when: "開発リソースが確保できない、またはまず一部の部署で価値検証だけを早く始めたい場合",
      diagram: {
        cols: 3, rows: 2,
        groups: [
          { type: "external", label: "外部SaaS", from: [2, 0], to: [2, 0] }
        ],
        nodes: [
          { id: "users", icon: "client/users", label: "従業員", col: 0, row: 0 },
          { id: "saas", icon: "client/external-saas", label: "生成AI SaaS\n法人契約", col: 2, row: 0 },
          { id: "admin", icon: "client/office", label: "情シス\n契約・監査管理", col: 0, row: 1 }
        ],
        edges: [
          { from: "users", to: "saas", label: "HTTPS" },
          { from: "admin", to: "saas", label: "利用ログ確認", dashed: true }
        ]
      },
      flow: [
        "法人プランの生成AI SaaSを契約し、従業員はSaaSのUIをそのまま使う",
        "「入力を学習に使わない」「SSO連携」「監査ログ」は契約プランの機能と規約で担保する",
        "情シスはSaaSの管理画面で利用状況を確認し、アカウントの発行・停止を管理する"
      ],
      services: [
        { icon: "client/external-saas", name: "法人向け生成AI SaaS", role: "UI・モデル・運用込みの完成品。開発ゼロで導入できる" },
        { icon: "client/office", name: "情シス部門", role: "契約条件の精査、アカウント管理、利用ログの監査を担う" }
      ],
      points: [
        "自前開発と違い、ガバナンスの担保が「構成」ではなく「契約と設定」になります。学習利用の有無・データ保管場所・ログ提供の範囲を契約書レベルで確認するのが情シスの仕事になります",
        "1ユーザーあたり月額の定額制が主流のため、全社2,000人に配ると費用が跳ね上がります。利用頻度の低い社員が多い段階では、API従量課金の自前基盤が大幅に安くなりやすい構造です",
        "自社データとの連携（社内文書に基づく回答など）を深めたくなった時が、自前基盤（推奨構成やケース26のRAG）へ移行する典型的なタイミングです"
      ],
      pros: [
        "開発ゼロで即日導入でき、UIの完成度も高い",
        "モデル更新や運用をベンダーに任せられる"
      ],
      cons: [
        "1ユーザー月額の定額制では全社展開の費用が大きい（2,000人なら月数百万円規模になりうる）",
        "監査ログの粒度やデータの扱いがベンダー仕様に縛られ、社内システムとの連携も限定的"
      ],
      cost: "法人プランは<strong>1ユーザー月3,000〜4,500円程度</strong>が相場です。500人に配れば月150万〜225万円、全社2,000人なら月600万円規模になり、自前基盤のAPI従量課金（月数万〜十数万円）との差は歴然です。少人数の検証には向き、全社展開ではコスト構造の見直しが必要になります。",
      references: [
        { title: "生成AIとデータガバナンス", url: "https://cloud.google.com/vertex-ai/generative-ai/docs/data-governance?hl=ja", note: "SaaSの契約条件を精査する際の比較基準になる観点" },
        { title: "Vertex AIの生成AIの概要", url: "https://cloud.google.com/vertex-ai/generative-ai/docs/overview?hl=ja", note: "自前基盤へ移行する場合の出発点" }
      ]
    }
  ],
  cost: "<p>推奨構成は<strong>月5万〜15万円程度</strong>（API従量課金が中心）、完全閉域案はそこへ閉域ネットワーク費用を上乗せ、SaaS案は<strong>1ユーザー月3,000円前後×人数の定額</strong>です。全社展開ほど従量課金の自前基盤が有利になり、少人数の検証ほどSaaSが速い、という費用構造の違いが選択の軸になります。※東京リージョン・1USD=150円前後の概算目安。</p>",
  summary: "<p>社内生成AI基盤の本体は、モデル選びではなく<strong>ガバナンス設計</strong>です。認証（IAP）・データの学習利用なし（Vertex AI）・持ち出し防止（VPC Service Controls）・監査（Cloud Logging）の4点セットで「禁止ではなく安全に開放する」を実現します。判断の分かれ目は、規制の強さ（インターネット経由が許されないなら閉域案）と開発リソース（無ければSaaSで検証から）です。社内文書に基づいて回答させたくなったら、ケース26のRAG構成をこの基盤の上に載せるのが次の一歩です。</p>",
  quiz: [
    {
      q: "生成AIの野良利用が見つかったとき、「全面禁止」だけで済ませるとかえってリスクが高まることがあります。なぜでしょうか。",
      a: "需要そのものは消えないため、禁止すると利用が個人スマホや私物PCへ地下化し、会社の目が届かない場所で業務データが入力され続けるからです。禁止は統制が効いているように見えて、実際は可視性を失っているだけになりがちです。だからこそ「学習に使われない・社員限定・監査可能」を仕組みで担保した公式ルートを提供し、便利さで需要を吸収するのが本ケースの戦略です。"
    },
    {
      q: "IAMで権限を最小化しているのに、さらにVPC Service Controlsを重ねるのはなぜでしょうか。この構成でVPC-SCは何を防いでいますか。",
      a: "IAMは「誰に何を許すか」の制御であり、認証情報が漏えいすると正規の権限として突破されてしまいます。VPC-SCは「どこからAPIに触れるか」を制限する別レイヤの防御で、境界の外からのAPI呼び出しや、境界内データの外部プロジェクトへのコピーを遮断します。この構成では、盗まれたキーによる社外からのアクセスや、誤設定による会話履歴・業務データの持ち出しを防ぐ最後の砦になっています。"
    },
    {
      q: "経営層から「社内規程や過去の議事録に基づいて答えるAIにしてほしい」と要望が来ました。あなたならこの基盤をどう拡張しますか。",
      a: "ケース26のRAG構成を組み込みます。社内文書をCloud Storageに集約してVertex AI Searchで検索できるようにし、チャットAPIが質問に関連する文書を検索してからGeminiに渡して、出典つきで回答させる形です。認証・閉域・監査の土台は本ケースのものをそのまま使えるため、変更はアプリ層に閉じます。ガバナンス基盤を先に固めておくと、この種の拡張要望に安全に応えられるのが利点です。"
    }
  ]
});
