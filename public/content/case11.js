// ケース11：BtoB会員制ポータル
registerCase({
  id: 11,
  category: "Webアプリ・EC",
  title: "BtoB会員制ポータル",
  scenario: "<p>製造業の企業が、数十社の取引先向けに見積確認・納期照会・請求書ダウンロードができる会員制ポータルを公開したい。利用者は取引先ごとに数名の担当者で、合計数百人規模。インターネットに公開はするが、取引先以外には一切見せてはいけない情報を扱う。開発チームは2〜3人で、ログイン機能やパスワード管理の仕組みを自作する余裕はなく、セキュリティ事故だけは絶対に避けたいという状況です。</p>",
  requirements: [
    "取引先の担当者だけがログインできること（一般公開は禁止）",
    "認証・パスワード管理の仕組みを自作したくない",
    "不正アクセスやDDoS攻撃への防御を入り口で行いたい",
    "サーバーの保守・パッチ当てはやりたくない",
    "取引先が増えてもユーザー管理の手間が増えにくいこと"
  ],
  main: {
    name: "Cloud LB+IAP+Cloud Run+Cloud SQL構成",
    diagram: {
      cols: 5, rows: 2,
      groups: [
        { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [4, 1] }
      ],
      nodes: [
        { id: "users", icon: "client/users", label: "取引先\n担当者", col: 0, row: 1 },
        { id: "armor", icon: "network/cloud-armor", label: "Cloud Armor\nWAF/DDoS対策", col: 1, row: 0 },
        { id: "idp", icon: "security/identity-platform", label: "Identity Platform\n外部ID管理", col: 2, row: 0 },
        { id: "lb", icon: "network/cloud-load-balancing", label: "Cloud LB\nHTTPS終端", col: 1, row: 1 },
        { id: "iap", icon: "security/identity-aware-proxy", label: "IAP\n認証ゲート", col: 2, row: 1 },
        { id: "run", icon: "compute/cloud-run", label: "Cloud Run\nポータル本体", col: 3, row: 1 },
        { id: "sql", icon: "database/cloud-sql", label: "Cloud SQL\n会員/取引データ", col: 4, row: 1 }
      ],
      edges: [
        { from: "users", to: "lb", label: "HTTPS" },
        { from: "armor", to: "lb", noArrow: true, dashed: true },
        { from: "lb", to: "iap", label: "全リクエスト" },
        { from: "idp", to: "iap", noArrow: true, dashed: true, label: "外部ID連携" },
        { from: "iap", to: "run", label: "認証済みのみ" },
        { from: "run", to: "sql", label: "SQL" }
      ]
    },
    flow: [
      "取引先の担当者がHTTPSでCloud Load Balancingにアクセスし、紐づけられたCloud Armorが攻撃的なリクエストを入り口で検査・遮断する",
      "IAP（Identity-Aware Proxy：アプリの手前で認証を行う門番サービス）が未ログインのユーザーをログイン画面へ誘導する",
      "ログインはIdentity Platformに登録された取引先ユーザーのID（メール+パスワードやSAML）で行う。IAPは認証済みのリクエストだけをCloud Runへ通す",
      "Cloud Runのポータルアプリは、IAPが付与するヘッダーから「誰がアクセスしているか」を受け取り、Cloud SQLの会員・取引データを読み書きする"
    ],
    services: [
      { icon: "security/identity-aware-proxy", name: "Identity-Aware Proxy（IAP）", role: "アプリの手前でログインを強制する門番。認証を通らないリクエストはアプリに一切届かない" },
      { icon: "security/identity-platform", name: "Identity Platform", role: "取引先ユーザーのID基盤。メール+パスワード、SAML/OIDCでの企業SSOに対応し、パスワード管理を肩代わりする" },
      { icon: "network/cloud-load-balancing", name: "Cloud Load Balancing", role: "HTTPSの入り口。IAPとCloud Armorはこの上で有効化する" },
      { icon: "network/cloud-armor", name: "Cloud Armor", role: "WAF（Webアプリケーションファイアウォール）。SQLインジェクション等の攻撃パターンやDDoSを入り口で防ぐ" },
      { icon: "compute/cloud-run", name: "Cloud Run", role: "ポータル本体のコンテナを動かすサーバーレス基盤。アクセスに応じて自動スケールする" },
      { icon: "database/cloud-sql", name: "Cloud SQL", role: "会員情報・見積・請求データを保存するマネージドRDB" }
    ],
    points: [
      "認証をアプリの中ではなく手前（IAP）で行うのがこの構成の核心です。アプリの実装ミスで認証が破られる事故を構造的に防ぎ、アプリはビジネスロジックに集中できます",
      "IAPは本来Googleアカウント向けですが、Identity Platformとの外部ID連携を使うと、Googleアカウントを持たない取引先ユーザーもメール+パスワードや自社SSOでログインできます",
      "Cloud Runのingress（受け付ける通信経路の設定）を「内部とCloud Load Balancingのみ」に絞ることが必須です。これを忘れるとCloud Runの直接URLがIAPを迂回する裏口になります",
      "図にVPCやNATが無いのは省略ではなく、全部品がサーバーレス・マネージドでVPCを必要としないためです。Cloud SQLへはCloud SQLコネクタ経由で安全に接続します"
    ],
    pros: [
      "認証・認可の実装をほぼ書かずに「社外の特定ユーザーだけに公開」を実現できる",
      "IAP・Cloud Armorで多層防御になり、アプリまで攻撃が届きにくい",
      "サーバー管理が不要で、2〜3人のチームでも運用できる",
      "取引先の追加はIdentity Platformへのユーザー登録だけで済む"
    ],
    cons: [
      "IAPを使うには外部アプリケーションロードバランサが必要で、小規模でもLBの固定費がかかる",
      "ログイン画面のデザイン自由度は低め。作り込みたい場合はアプリ内認証（代替パターン）が向く",
      "IAP・LB・ingress設定の組み合わせを正しく理解しないと、裏口が残る事故が起きうる",
      "画面の一部だけ権限を変えるような細かい認可はアプリ側の実装が必要"
    ],
    cost: "<strong>月1万3,000円〜2万円程度</strong>。内訳の目安はLB約3,000円+Cloud Armor約1,000円+Cloud Run数百円〜数千円+Cloud SQL（1vCPU/3.75GB相当）約8,000円。IAPは追加料金なし、Identity Platformは数万アクティブユーザーまで無料枠内。東京リージョン・1USD=150円前後での概算です。",
    references: [
      { title: "IAPの概要", url: "https://cloud.google.com/iap/docs/concepts-overview?hl=ja", note: "アプリの手前で認証する仕組みの公式解説" },
      { title: "Cloud RunでIAPを有効にする", url: "https://cloud.google.com/iap/docs/enabling-cloud-run?hl=ja" },
      { title: "IAPの外部ID（Identity Platform連携）", url: "https://cloud.google.com/iap/docs/external-identities?hl=ja", note: "Googleアカウント以外のユーザーをIAPで認証する方法" },
      { title: "Cloud Armorの概要", url: "https://cloud.google.com/armor/docs/cloud-armor-overview?hl=ja" },
      { title: "Cloud RunからCloud SQLへ接続する", url: "https://cloud.google.com/sql/docs/mysql/connect-run?hl=ja" }
    ]
  },
  alternatives: [
    {
      name: "Identity Platform+アプリ内認証構成",
      when: "ログイン画面を自社ブランドで作り込みたい・招待やパスワードリセットなど会員管理UIをアプリに組み込みたい場合",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [3, 1] }
        ],
        nodes: [
          { id: "users", icon: "client/users", label: "取引先\n担当者", col: 0, row: 1 },
          { id: "armor", icon: "network/cloud-armor", label: "Cloud Armor\nWAF", col: 1, row: 0 },
          { id: "idp", icon: "security/identity-platform", label: "Identity Platform\n認証SDK", col: 2, row: 0 },
          { id: "lb", icon: "network/cloud-load-balancing", label: "Cloud LB\nHTTPS終端", col: 1, row: 1 },
          { id: "run", icon: "compute/cloud-run", label: "Cloud Run\nポータル本体", col: 2, row: 1 },
          { id: "sql", icon: "database/cloud-sql", label: "Cloud SQL\n会員/取引データ", col: 3, row: 1 }
        ],
        edges: [
          { from: "users", to: "idp", label: "ログイン" },
          { from: "users", to: "lb", label: "APIとトークン" },
          { from: "armor", to: "lb", noArrow: true, dashed: true },
          { from: "lb", to: "run" },
          { from: "idp", to: "run", dashed: true, label: "トークン検証" },
          { from: "run", to: "sql", label: "SQL" }
        ]
      },
      flow: [
        "ユーザーはアプリに組み込んだIdentity PlatformのSDKでログインし、IDトークン（本人であることを証明する署名付きデータ）を受け取る",
        "以降のリクエストにはIDトークンを添えて送り、Cloud Run側がIdentity Platformの公開鍵でトークンを検証する",
        "検証済みユーザーの権限に応じて、Cloud SQLのデータを読み書きして画面を返す"
      ],
      services: [
        { icon: "security/identity-platform", name: "Identity Platform", role: "認証の本体。ログインUI部品やSDK、パスワードリセットのメール送信までを提供する" },
        { icon: "compute/cloud-run", name: "Cloud Run", role: "ポータル本体。受け取ったIDトークンの検証と、画面ごとの細かい認可を実装する" },
        { icon: "network/cloud-load-balancing", name: "Cloud Load Balancing", role: "HTTPSの入り口。Cloud Armorを紐づけるために使う" },
        { icon: "network/cloud-armor", name: "Cloud Armor", role: "WAF。ログイン画面への攻撃や総当たりの試行を入り口で減らす" },
        { icon: "database/cloud-sql", name: "Cloud SQL", role: "会員・取引データの保存先" }
      ],
      points: [
        "IAP構成との最大の違いは「認証の場所」です。門番を置くのではなく、アプリ自身がトークンを検証するため、画面・API単位の細かい認可を実装しやすくなります",
        "そのぶん検証漏れのエンドポイントが1つでもあると即事故になります。ミドルウェアで全ルートに検証を強制する実装にします",
        "ログイン画面・会員招待・パスワードリセットの体験を完全に自社デザインにできるのはこの構成の強みです"
      ],
      pros: [
        "ログインや会員管理のUI/UXを自由に作り込める",
        "画面・API単位の細かい認可をアプリのコードで表現できる",
        "モバイルアプリ化など将来のクライアント追加にも同じトークン方式で対応できる"
      ],
      cons: [
        "認証まわりの実装責任がアプリ側に移り、検証漏れが即事故につながる",
        "セッション管理・CSRF対策など、IAPなら不要だった考慮事項が増える"
      ],
      cost: "<strong>月1万2,000円〜2万円程度</strong>。構成要素はほぼ同じでIAPの有無だけの違いのため、費用感は推奨構成と同水準。Cloud Armorが不要ならLBを省いてCloud Run直公開とし、月8,000円前後まで下げる選択もあります。",
      references: [
        { title: "Identity Platformの認証の概要", url: "https://cloud.google.com/identity-platform/docs/concepts-authentication?hl=ja" },
        { title: "Cloud Runのingress設定", url: "https://cloud.google.com/run/docs/securing/ingress?hl=ja", note: "LB経由のみに絞る設定はこの構成でも重要" }
      ]
    },
    {
      name: "Cloud ArmorのIPアローリスト構成",
      when: "取引先が少数で全社が固定IPを持ち、ユーザー単位の認証よりネットワーク単位の制限で十分な場合",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [3, 1] }
        ],
        nodes: [
          { id: "net", icon: "client/internet", label: "その他の\nアクセス", col: 0, row: 0 },
          { id: "office", icon: "client/office", label: "取引先オフィス\n固定IP", col: 0, row: 1 },
          { id: "armor", icon: "network/cloud-armor", label: "Cloud Armor\nIP制限", col: 1, row: 0 },
          { id: "lb", icon: "network/cloud-load-balancing", label: "Cloud LB\nHTTPS終端", col: 1, row: 1 },
          { id: "run", icon: "compute/cloud-run", label: "Cloud Run\nポータル本体", col: 2, row: 1 },
          { id: "sql", icon: "database/cloud-sql", label: "Cloud SQL\n会員/取引データ", col: 3, row: 1 }
        ],
        edges: [
          { from: "office", to: "lb", label: "許可IPのみ通過" },
          { from: "net", to: "lb", dashed: true, label: "遮断" },
          { from: "armor", to: "lb", noArrow: true, dashed: true },
          { from: "lb", to: "run" },
          { from: "run", to: "sql", label: "SQL" }
        ]
      },
      flow: [
        "Cloud Armorのセキュリティポリシーに取引先オフィスの固定IPアドレスを許可リストとして登録する",
        "許可リスト外からのアクセスはLBの段階で拒否され、アプリには一切届かない",
        "許可されたネットワークからのユーザーは、アプリの簡易ログインを経てCloud SQLのデータを閲覧する"
      ],
      services: [
        { icon: "network/cloud-armor", name: "Cloud Armor", role: "IPアドレスベースのアクセス制御。許可リスト外を優先度付きルールで拒否する" },
        { icon: "network/cloud-load-balancing", name: "Cloud Load Balancing", role: "HTTPSの入り口。Cloud Armorのポリシーを適用する場所" },
        { icon: "compute/cloud-run", name: "Cloud Run", role: "ポータル本体。ネットワークで守られている前提でも最低限のログインは実装する" },
        { icon: "database/cloud-sql", name: "Cloud SQL", role: "会員・取引データの保存先" }
      ],
      points: [
        "古典的ですが実務では今も多い方式です。「誰が」ではなく「どこから」で制御するため、リモートワークやスマホからのアクセスには弱い点を理解して選びます",
        "取引先のIPアドレス変更のたびに連絡を受けてポリシーを更新する運用が発生します。社数が増えるほど破綻しやすい方式です",
        "IP制限だけに頼らず、アプリ側の簡易認証と併用する多層防御にしておくと、IP設定ミスの事故に耐えられます"
      ],
      pros: [
        "仕組みが単純で説明しやすく、監査でも理解されやすい",
        "許可リスト外の攻撃トラフィックが一切アプリに届かないため、攻撃面が最小になる"
      ],
      cons: [
        "外出先・在宅・モバイル回線からのアクセスに対応できない",
        "取引先のIP変更のたびに運用作業が発生し、社数が増えると破綻しやすい",
        "「どの担当者が操作したか」の記録・制御はこの方式単体では実現できない"
      ],
      cost: "<strong>月1万2,000円〜1万8,000円程度</strong>。LB約3,000円+Cloud Armor約1,000円+Cloud Run数百円〜+Cloud SQL約8,000円。Identity Platformを使わないぶん構成は最小ですが、費用の大半はLBとCloud SQLのため推奨構成と大差はありません。",
      references: [
        { title: "Cloud Armorセキュリティポリシーの概要", url: "https://cloud.google.com/armor/docs/security-policy-overview?hl=ja", note: "IP許可・拒否ルールの書き方" },
        { title: "外部アプリケーションロードバランサの概要", url: "https://cloud.google.com/load-balancing/docs/https?hl=ja" }
      ]
    }
  ],
  cost: "<p>3案とも費用の骨格は同じで、<strong>LB約3,000円+Cloud SQL約8,000円が固定費の中心</strong>、合計月1万2,000円〜2万円程度です（東京リージョン・1USD=150円前後の目安）。IAPは追加料金なし、Identity Platformも数万ユーザー規模までは無料枠内のため、<strong>認証方式の選択でコストはほぼ変わりません</strong>。差が出るのはお金ではなく「認証の実装責任を誰が持つか」と「運用の手間」です。</p>",
  summary: "<p>社外の特定ユーザーだけに見せるサイトでは、<strong>認証をアプリの手前（IAP）に置くか、アプリの中に置くかが最大の分かれ目</strong>です。作り込み不要で事故りにくいのがIAP、UIと細かい認可の自由度を取るならアプリ内認証、と覚えましょう。どちらの場合もCloud Runのingressを絞って裏口を塞ぐことを忘れないでください。社内向けの閉域構成はケース32、全社員向け生成AI基盤への応用はケース35で扱います。</p>",
  quiz: [
    {
      q: "この構成では、ログイン機能をアプリに実装せずIAPという「門番」に任せています。アプリ内に実装する場合と比べて、セキュリティ上どんな利点があるのでしょうか。",
      a: "認証がアプリのコードから分離されるため、アプリ側の実装ミス（検証漏れのエンドポイント、セッション管理のバグなど）があっても、未認証のリクエストはそもそもアプリに届きません。守りが一枚岩ではなく手前で完結しているので、事故の影響範囲が構造的に小さくなります。チームに認証の専門知識がなくても、Googleが運用する認証基盤の品質に乗れる点も実務では大きな利点です。"
    },
    {
      q: "IAPとLBを正しく設定したのに、Cloud Runサービスの直接URL（run.appドメイン）を知っている人がアクセスできてしまいました。何を見落としたのでしょうか。",
      a: "Cloud Runのingress設定です。既定ではCloud Runはインターネットから直接アクセスできるURLを持つため、LB+IAPをどれだけ固めても直接URLが裏口として残ります。ingressを「内部とCloud Load Balancingのみ」に設定し、必ずLB（=IAPの検査）を通らないと届かないようにするのがセットの作法です。門番を置いたら裏口を塞ぐ、と覚えましょう。"
    },
    {
      q: "取引先が1万社に増え、各社から「自社のSSO（シングルサインオン）でログインさせたい」と要望が来ました。あなたなら構成をどう発展させますか。",
      a: "Identity PlatformはSAML/OIDCの外部IDプロバイダ連携とテナント分割に対応しているため、認証基盤はそのままに各社のSSO設定を追加していくのが第一手です。ただし社数が増えるとログイン画面の出し分けや企業ごとの管理画面が必要になり、IAPの標準画面では収まらなくなるため、代替パターンのアプリ内認証へ寄せていく判断が現実的になります。規模の変化が認証の置き場所の再検討を迫る、という典型例です。"
    }
  ]
});
