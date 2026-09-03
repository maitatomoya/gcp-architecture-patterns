// ケース47：セキュリティ監視・防御
registerCase({
  id: 47,
  category: "運用・セキュリティ・信頼性",
  title: "セキュリティ監視・防御",
  scenario: "<p>会員10万人のECサイト（ケース8のような構成）を運用しています。公開から半年、ログイン画面への総当たり攻撃、botによる大量アクセス、海外からの不審なスキャンが目に見えて増えてきました。セキュリティ専任者はおらず、開発チーム5人が兼任で対応しています。攻撃を入口で防ぐ仕組みと、設定ミスや侵害の兆候に気づける監視を、運用しきれる範囲で多層に組み込みたいという状況です。</p><p>セキュリティ設計の基本は「多層防御」です。1つの対策が破られても次の層で止められるよう、境界（WAF）・入口（bot対策）・権限（IAM）・検知（監査ログと継続監視）を重ねて構えます。</p>",
  requirements: [
    "SQLインジェクション等のWeb攻撃とDDoSを入口でブロックしたい",
    "ログインや購入をbotの悪用から守りたい",
    "「誰がいつ何を変更したか」を後から追跡できるようにしたい",
    "公開設定ミスや過剰権限などの構成リスクに自動で気づきたい",
    "専任者なしで回る運用負荷に抑えたい"
  ],
  main: {
    name: "多層防御構成（Cloud Armor+reCAPTCHA+監査ログ+SCC）",
    diagram: {
      cols: 5, rows: 2,
      groups: [
        { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [4, 1] }
      ],
      nodes: [
        { id: "users", icon: "client/users", label: "ユーザー\n（攻撃者も混在）", col: 0, row: 1 },
        { id: "armor", icon: "network/cloud-armor", label: "Cloud Armor\nWAF・DDoS対策", col: 1, row: 0 },
        { id: "lb", icon: "network/cloud-load-balancing", label: "Cloud LB\nHTTPS終端", col: 1, row: 1 },
        { id: "recap", icon: "security/recaptcha", label: "reCAPTCHA\nbot判定", col: 2, row: 0 },
        { id: "run", icon: "compute/cloud-run", label: "Cloud Run\nアプリ", col: 2, row: 1 },
        { id: "iam", icon: "security/iam", label: "IAM\n最小権限", col: 3, row: 0 },
        { id: "log", icon: "ops/cloud-logging", label: "Cloud Logging\n監査ログ", col: 3, row: 1 },
        { id: "scc", icon: "security/security-command-center", label: "SCC\nリスクの継続監視", col: 4, row: 1 }
      ],
      edges: [
        { from: "users", to: "lb", label: "HTTPS" },
        { from: "armor", to: "lb", label: "WAFポリシー適用", noArrow: true, dashed: true },
        { from: "lb", to: "run", label: "通過した通信のみ" },
        { from: "run", to: "recap", label: "トークン検証" },
        { from: "run", to: "log", label: "アプリログ" },
        { from: "iam", to: "run", noArrow: true, dashed: true },
        { from: "log", to: "scc", label: "脅威検知の材料" },
        { from: "scc", to: "iam", label: "設定を点検", noArrow: true, dashed: true }
      ]
    },
    flow: [
      "すべてのリクエストはグローバルなCloud Load Balancingで受け、紐づけたCloud ArmorのポリシーがSQLインジェクション・XSS（クロスサイトスクリプティング）などの攻撃パターンや不審な送信元を評価してブロックする",
      "通過したリクエストだけがCloud Runに届く。Cloud Run側は直接アクセスを禁止（内部とLB経由のみ許可）し、WAFを迂回する裏口を塞ぐ",
      "ログイン・購入などの重要操作では、ブラウザで取得したreCAPTCHAトークンをアプリが検証APIに問い合わせ、botらしさのスコアで通すか判断する",
      "GCP上の管理操作（設定変更・権限付与など）は監査ログとしてCloud Loggingに自動記録され、後から「誰がいつ何をしたか」を追跡できる",
      "Security Command Center（SCC）が公開バケットや過剰権限などの構成リスクを継続的に洗い出し、監査ログを材料に不審な挙動（脅威）も検知する"
    ],
    services: [
      { icon: "network/cloud-armor", name: "Cloud Armor", role: "LBに取り付けるWAF（Webアプリケーションファイアウォール）。攻撃パターンの遮断・国別制限・レート制限を入口で行う" },
      { icon: "network/cloud-load-balancing", name: "Cloud Load Balancing", role: "全リクエストの玄関。ここに通信を集約するからこそWAFを一括適用できる" },
      { icon: "security/recaptcha", name: "reCAPTCHA", role: "人間かbotかをスコアで判定する。ログイン・購入などの操作単位で組み込む" },
      { icon: "compute/cloud-run", name: "Cloud Run", role: "保護対象のアプリ本体。LB経由以外の直接アクセスを設定で禁止する" },
      { icon: "security/iam", name: "IAM", role: "人とサービスの権限管理。必要最小限の権限だけを付与し、侵害時の被害範囲を狭める" },
      { icon: "ops/cloud-logging", name: "Cloud Logging（監査ログ）", role: "管理操作の証跡。改ざん・削除への備えとして保持設計もここで行う" },
      { icon: "security/security-command-center", name: "Security Command Center", role: "構成リスクと脅威を一覧化する司令塔。無料のスタンダード階層から始められる" }
    ],
    points: [
      "防御を1製品に頼らず4つの層に分けています。WAFが誤検知で緩めた穴はbot判定が、権限の奪取はIAMの最小権限が、それでも起きた侵害は監査ログとSCCが受け止める、という重ね着の設計です",
      "Cloud ArmorはグローバルLBに紐づける方式なので、バックエンドがサーバーレス（Cloud Run）でもVMでも同じポリシーで守れます。そのためLBを入口に一本化することがWAF導入の前提条件になります",
      "管理アクティビティ監査ログはデフォルトで有効・無料です。まず「見られる状態にある」ことを知り、データの読み書きまで記録するデータアクセスログは量と課金を見て選択的に有効化します",
      "SCCはスタンダード階層なら無料で構成チェックができます。有料階層を検討する前に、まず無料の範囲で公開バケットや過剰権限の検出を有効にするのが費用対効果の高い一歩です"
    ],
    pros: [
      "攻撃の大半（既知パターン・bot・DDoS）をアプリに届く前に落とせる",
      "サーバーレス構成でもWAF・DDoS対策を後付けできる",
      "監査ログとSCCで「防げなかった事象に気づく」検知の層まで揃う",
      "各層が独立しているため、段階的に導入・強化できる"
    ],
    cons: [
      "Cloud ArmorのWAFルールは誤検知（正常リクエストの遮断）が起こり得るため、プレビューモードでの検証とチューニングの手間がかかる",
      "reCAPTCHAはスコアの閾値設計を誤ると正規ユーザーの体験を損なう",
      "SCCの脅威検知や組織全体の高度な機能は有料階層で、組織規模によっては費用が大きい",
      "多層になるぶん「どの層で落ちたか」の調査手順を整えておかないと障害対応が混乱する"
    ],
    cost: "<strong>月2,000円〜1万円程度</strong>が目安（東京リージョン、1USD=150円換算）。Cloud Armorはポリシー1つ月約750円＋ルール1本月約150円＋100万リクエストあたり約110円。reCAPTCHAは月1万回の判定まで無料で、超過は1,000回あたり約150円。管理アクティビティ監査ログとSCCスタンダードは無料です。SCCの有料階層は組織規模に応じた見積もりで、月数万円以上になることもあります。",
    references: [
      { title: "Cloud Armorの概要", url: "https://cloud.google.com/armor/docs/cloud-armor-overview?hl=ja", note: "WAF・DDoS対策の仕組み" },
      { title: "reCAPTCHAの概要", url: "https://cloud.google.com/recaptcha/docs/overview?hl=ja", note: "スコアベースのbot判定" },
      { title: "Cloud監査ログの概要", url: "https://cloud.google.com/logging/docs/audit?hl=ja", note: "何がデフォルトで記録されるか" },
      { title: "Security Command Centerのドキュメント", url: "https://cloud.google.com/security-command-center/docs?hl=ja", note: "階層ごとの機能差も確認できる" },
      { title: "Cloud Runの上り（内向き）の制限", url: "https://cloud.google.com/run/docs/securing/ingress?hl=ja", note: "WAF迂回の裏口を塞ぐ設定" }
    ]
  },
  alternatives: [
    {
      name: "無料の防御から始めるスモールスタート構成",
      when: "予算がほぼ取れない立ち上げ期に、まず費用ゼロでできる対策から着手する場合",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [3, 1] }
        ],
        nodes: [
          { id: "users", icon: "client/users", label: "ユーザー", col: 0, row: 1 },
          { id: "iam", icon: "security/iam", label: "IAM\n最小権限の整理", col: 2, row: 0 },
          { id: "run", icon: "compute/cloud-run", label: "Cloud Run\nアプリ", col: 1, row: 1 },
          { id: "log", icon: "ops/cloud-logging", label: "Cloud Logging\n監査ログ確認", col: 2, row: 1 },
          { id: "scc", icon: "security/security-command-center", label: "SCC\n無料の構成チェック", col: 3, row: 1 }
        ],
        edges: [
          { from: "users", to: "run", label: "HTTPS" },
          { from: "run", to: "log", label: "監査ログ・アプリログ" },
          { from: "log", to: "scc", label: "検出の材料" },
          { from: "iam", to: "run", noArrow: true, dashed: true }
        ]
      },
      flow: [
        "IAMを棚卸しし、オーナー権限の乱用をやめてロールを最小権限に絞る（費用ゼロで効果が最大の対策）",
        "デフォルトで記録されている管理アクティビティ監査ログの見方をチームで確認し、権限変更の通知アラートを設定する",
        "SCCスタンダード（無料）を有効化し、公開バケット・過剰権限などの構成リスク検出を自動化する",
        "WAFやbot対策は、攻撃の実害やアクセス規模が閾値を超えた時点で推奨構成へ段階的に追加する"
      ],
      services: [
        { icon: "security/iam", name: "IAM", role: "最小権限の徹底。無料でできる中で最も費用対効果が高い防御" },
        { icon: "ops/cloud-logging", name: "Cloud Logging（監査ログ）", role: "デフォルト有効の証跡。まず「見る習慣」を作る対象" },
        { icon: "security/security-command-center", name: "Security Command Center（スタンダード）", role: "無料階層での構成リスクの自動検出" },
        { icon: "compute/cloud-run", name: "Cloud Run", role: "アプリ本体。HTTPSと自動パッチ適用は基盤側が最初から担っている" }
      ],
      points: [
        "セキュリティ対策は「高い製品を買う」より先にやることがあります。最小権限・監査ログ・無料の構成チェックは費用ゼロで、実際のインシデントの多くを占める設定ミス・権限の緩みに直接効きます",
        "GCPはHTTPS化・基盤のパッチ適用・保存データの暗号化が標準で済んでいるため、責任共有モデルの「利用者側の宿題」に集中できます",
        "この構成の弱点はWeb攻撃とbotへの備えが薄いことです。ログイン機能や決済を持つなら、推奨構成への移行条件（攻撃検知数など）をあらかじめ決めておきます"
      ],
      pros: [
        "追加費用ゼロで今日から始められる",
        "設定ミス・過剰権限という最頻出のリスクに直接効く",
        "推奨構成への段階的な拡張がそのままできる"
      ],
      cons: [
        "WAFがないためWeb攻撃はアプリの実装だけで受け止めることになる",
        "botによる不正ログイン・買い占めへの備えがない",
        "検知しても対応する人の運用（誰がいつ見るか）を決めないと形骸化する"
      ],
      cost: "<strong>月0円</strong>。IAM・管理アクティビティ監査ログ・SCCスタンダードはいずれも無料です。ログの保存量が増えた場合のLogging課金（無料枠50GiB/月超過分）だけ注意します。",
      references: [
        { title: "IAMをセキュアに使用する", url: "https://cloud.google.com/iam/docs/using-iam-securely?hl=ja", note: "最小権限の実践ガイド" },
        { title: "Cloud監査ログの概要", url: "https://cloud.google.com/logging/docs/audit?hl=ja" },
        { title: "Security Command Centerのドキュメント", url: "https://cloud.google.com/security-command-center/docs?hl=ja" }
      ]
    },
    {
      name: "IAPで入口を閉じるゼロトラスト構成",
      when: "管理画面や社内システムなど、そもそも全世界に公開する必要がないものを守る場合",
      diagram: {
        cols: 5, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [4, 1] }
        ],
        nodes: [
          { id: "office", icon: "client/office", label: "社内利用者", col: 0, row: 1 },
          { id: "lb", icon: "network/cloud-load-balancing", label: "Cloud LB", col: 1, row: 1 },
          { id: "iam", icon: "security/iam", label: "IAM\n誰を通すか", col: 2, row: 0 },
          { id: "iap", icon: "security/identity-aware-proxy", label: "IAP\n認証ゲート", col: 2, row: 1 },
          { id: "run", icon: "compute/cloud-run", label: "Cloud Run\n管理画面", col: 3, row: 1 },
          { id: "log", icon: "ops/cloud-logging", label: "Cloud Logging\nアクセス記録", col: 4, row: 1 }
        ],
        edges: [
          { from: "office", to: "lb", label: "HTTPS" },
          { from: "lb", to: "iap", label: "認証確認" },
          { from: "iap", to: "run", label: "許可された人のみ" },
          { from: "run", to: "log", label: "ログ" },
          { from: "iam", to: "iap", label: "アクセス権限", noArrow: true, dashed: true }
        ]
      },
      flow: [
        "利用者はLB経由でアクセスすると、まずIdentity-Aware Proxy（IAP）によるGoogleアカウント認証を求められる",
        "IAPはIAMで許可されたユーザー・グループかを確認し、通過した人のリクエストだけをCloud Runへ転送する",
        "アプリに届く時点で「認証済みの誰か」が確定しているため、アプリ側は認可（役割ごとの権限制御）に集中できる",
        "誰がいつアクセスしたかはログに記録され、退職者の遮断はIAMからの削除だけで完了する"
      ],
      services: [
        { icon: "security/identity-aware-proxy", name: "Identity-Aware Proxy", role: "アプリの手前に立つ認証ゲート。VPNなしでゼロトラスト型のアクセス制御を実現する" },
        { icon: "security/iam", name: "IAM", role: "IAPを通れる人の一覧を管理する。アクセス権の付与・剥奪がここに一元化される" },
        { icon: "network/cloud-load-balancing", name: "Cloud Load Balancing", role: "IAPを有効化する場所。HTTPSの終端も担う" },
        { icon: "compute/cloud-run", name: "Cloud Run", role: "守られる対象の管理画面・社内アプリ" }
      ],
      points: [
        "最強の防御は「攻撃面を消す」ことです。全世界に公開しなければWAFで攻撃をさばく必要自体がなくなるため、公開が不要なシステムではIAP化が第一候補になります",
        "従来のVPN方式と違い、社内ネットワークにいるかではなく「誰であるか」で通すため、在宅勤務や外部委託者にもIAMの設定だけで安全に開放できます",
        "総当たり攻撃はGoogleの認証基盤が受け止めるので、アプリにログイン画面を実装するより安全側に倒れます",
        "一般公開するECサイト本体には使えません。公開部分は推奨構成、管理画面はIAP、と対象ごとに使い分けます"
      ],
      pros: [
        "公開をやめることで攻撃面そのものを消せる",
        "VPN機器の構築・運用なしでゼロトラスト型のアクセス制御ができる",
        "アクセス権の管理がIAMに一元化され、退職・異動対応が確実になる"
      ],
      cons: [
        "一般公開サービスには適用できない（利用者全員のGoogleアカウント等が前提）",
        "LB経由の構成が前提になるため、小規模でもLBの固定費がかかる",
        "IAPを迂回する直接アクセスを塞ぐ設定を忘れると防御が成立しない"
      ],
      cost: "<strong>月3,000円程度〜</strong>（東京リージョン、1USD=150円換算）。IAP自体は無料で、LBの固定費（月約2,700円〜）と転送量が中心です。VPN機器の購入・保守と比べると大幅に安く済むことが多いです。",
      references: [
        { title: "Identity-Aware Proxyのドキュメント", url: "https://cloud.google.com/iap/docs?hl=ja", note: "ゼロトラスト型アクセス制御の中核" },
        { title: "Cloud Runの上り（内向き）の制限", url: "https://cloud.google.com/run/docs/securing/ingress?hl=ja", note: "IAP迂回の直接アクセスを塞ぐ" }
      ]
    }
  ],
  cost: "<p>推奨構成は<strong>月2,000円〜1万円程度</strong>（Cloud Armor＋reCAPTCHA超過分。SCC有料階層は別途）。スモールスタート構成は<strong>月0円</strong>、IAP構成は<strong>月3,000円程度〜</strong>（LB固定費が中心）。東京リージョン・1USD=150円前提の目安です。守る対象の価値（会員情報・決済）と攻撃の実態に対して、どの層から投資するかを決めます。</p>",
  summary: "<p>セキュリティは1つの製品ではなく<strong>層の重ね方</strong>で考えます。入口のWAF（Cloud Armor）、操作単位のbot判定（reCAPTCHA）、権限の最小化（IAM）、そして防げなかったものに気づく検知（監査ログ・SCC）という4層です。予算がなければ無料の層（IAM・監査ログ・SCCスタンダード）から始められ、公開不要なシステムなら攻撃面を消すIAPが最も強力です。DDoSや大規模攻撃への備えはケース3、社内向けゼロトラストの本格構成はケース32とケース35も参照してください。</p>",
  quiz: [
    {
      q: "Cloud Armorを導入したのに、Cloud Runの発行するデフォルトURL（run.appドメイン）へ直接アクセスすると攻撃が素通りしてしまいました。何が起きているのでしょうか。",
      a: "Cloud ArmorのポリシーはLBに紐づいて評価されるため、LBを通らない経路には一切効きません。Cloud Runのデフォルトドメインが公開のままだと、攻撃者はそこを直接叩いてWAFを迂回できます。Cloud Runの上り制限を「内部とCloud Load Balancingのみ」に設定して裏口を塞ぐことが、WAF導入とセットで必須の作業です。多層防御は迂回路を塞いで初めて成立します。"
    },
    {
      q: "社内メンバーだけが使う管理画面への総当たり攻撃が続いています。あなたならどの層で対処しますか。",
      a: "管理画面は全世界に公開する必要がないため、IAPで入口自体を閉じるのが本命です。認証はGoogleの基盤が受け、IAMで許可した人しか到達できなくなるので、総当たり攻撃は成立しなくなります。WAFのレート制限やreCAPTCHAでも軽減はできますが、それらは「公開したまま守る」ための道具であり、公開が不要なら攻撃面そのものを消す選択が最も強力で運用も軽くなります。"
    },
    {
      q: "SCCが「誰でも読める公開状態のCloud Storageバケット」を検出しました。検出を確認して閉じるだけで運用として十分でしょうか。",
      a: "その場の修正だけでは不十分です。まず監査ログで「誰がいつ公開設定にしたか」「公開期間中にアクセスがあったか」を確認し、情報漏えいの有無を評価します。そのうえで、同じミスを繰り返さないための再発防止（公開設定を組織ポリシーで禁止する、変更時にアラートを飛ばす）まで行うのが検知を活かす運用です。検知・調査・封じ込め・再発防止までを一連の流れとして扱うことが重要です。"
    }
  ]
});
