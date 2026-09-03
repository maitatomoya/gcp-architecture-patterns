// ケース37：マルチプロジェクト統制（組織管理）
registerCase({
  id: 37,
  category: "社内・閉域・ハイブリッド",
  title: "マルチプロジェクト統制（組織管理）",
  scenario: "<p>従業員1,000人の企業で、各事業部が思い思いにGCPを使い始めた結果、誰も全体を把握していないプロジェクトが30個を超えました。請求は部門ごとにクレジットカード払いだったり会社契約だったりバラバラで、退職者のアカウントが権限を持ったまま残っているプロジェクトも見つかっています。公開設定のCloud Storageバケットがないか、危険な設定が放置されていないかを確認する手段もありません。情報システム部が全社のGCP利用を統制することになりましたが、各部門の開発スピードを落とす重い承認プロセスは避けたいと考えています。</p>",
  requirements: [
    "野良プロジェクトをなくし、全プロジェクトを組織として一元把握したい",
    "請求を部門別に見える化し、予算超過を早期に検知したい",
    "退職・異動時の権限剥奪を確実かつ即座に行いたい",
    "全プロジェクトの監査ログを、各部門では消せない形で保管したい",
    "公開バケット等の危険な設定を組織横断で自動検知したい",
    "部門の開発スピードを落とす重い承認プロセスは入れたくない"
  ],
  main: {
    name: "組織階層+集約ガバナンス構成",
    diagram: {
      cols: 4, rows: 3,
      groups: [
        { type: "gcp-cloud", label: "Google Cloud（組織）", from: [1, 0], to: [3, 2] },
        { type: "project", label: "部門Aプロジェクト", from: [1, 1], to: [1, 1], depth: 1 },
        { type: "project", label: "部門Bプロジェクト", from: [2, 1], to: [2, 1], depth: 1 }
      ],
      nodes: [
        { id: "iam", icon: "security/iam", label: "IAM\n組織ポリシー", col: 1, row: 0 },
        { id: "resm", icon: "ops/resource-manager", label: "Resource Manager\n組織・フォルダ階層", col: 2, row: 0 },
        { id: "billing", icon: "ops/cloud-billing", label: "Cloud Billing\n予算アラート", col: 3, row: 0 },
        { id: "admin", icon: "client/users", label: "情シス\n管理者", col: 0, row: 1 },
        { id: "workA", icon: "compute/cloud-run", label: "部門Aの\nワークロード", col: 1, row: 1 },
        { id: "workB", icon: "compute/compute-engine", label: "部門Bの\nワークロード", col: 2, row: 1 },
        { id: "scc", icon: "security/security-command-center", label: "SCC\n構成ミス検知", col: 3, row: 1 },
        { id: "logging", icon: "ops/cloud-logging", label: "Cloud Logging\n集約シンク", col: 2, row: 2 },
        { id: "bq", icon: "analytics/bigquery", label: "BigQuery\n監査ログ分析", col: 3, row: 2 }
      ],
      edges: [
        { from: "admin", to: "resm", label: "階層と権限を設計" },
        { from: "resm", to: "workA" },
        { from: "resm", to: "workB" },
        { from: "iam", to: "resm", noArrow: true, dashed: true },
        { from: "billing", to: "resm", noArrow: true, dashed: true },
        { from: "scc", to: "resm", label: "組織全体を監視", dashed: true },
        { from: "workA", to: "logging", label: "監査ログ" },
        { from: "workB", to: "logging" },
        { from: "logging", to: "bq", label: "エクスポート" }
      ]
    },
    flow: [
      "Resource Managerで「組織→フォルダ（部門）→プロジェクト」の階層を作り、既存の野良プロジェクトもすべて組織配下へ移動します。以後の新規プロジェクトは必ずこの階層の中に作られます",
      "IAMの権限は個人ではなくGoogleグループに付与し、組織ポリシー（公開バケット禁止・外部IP禁止などの組織全体ルール）を階層の上位に設定して配下の全プロジェクトへ継承させます",
      "請求は会社契約のCloud Billingアカウントに一本化し、部門フォルダやプロジェクト単位で予算アラートを設定して超過の予兆を通知します",
      "各プロジェクトの監査ログは、組織レベルの集約シンク（配下全プロジェクトのログを自動で1か所に集める仕組み）でログ専用プロジェクトのBigQueryへ転送します",
      "Security Command Center（SCC）が組織全体の公開バケット・過剰権限・脆弱性を継続的にスキャンし、情シスへ通知します"
    ],
    services: [
      { icon: "ops/resource-manager", name: "Resource Manager", role: "組織・フォルダ・プロジェクトの階層を管理する土台。GCPの統制はこの階層構造の上に成り立つ" },
      { icon: "security/iam", name: "IAM", role: "誰が何をできるかの権限管理。階層の上位で付与した権限と組織ポリシーは配下へ自動継承される" },
      { icon: "ops/cloud-billing", name: "Cloud Billing", role: "請求の一元化と予算アラート。プロジェクト・ラベル単位でコストの内訳を追える" },
      { icon: "security/security-command-center", name: "Security Command Center", role: "組織全体のセキュリティ状態を可視化し、公開バケットや過剰権限などの危険な構成を自動検知する" },
      { icon: "ops/cloud-logging", name: "Cloud Logging", role: "監査ログの記録と集約シンクによる転送。誰が何をしたかの証跡を組織横断で残す" },
      { icon: "analytics/bigquery", name: "BigQuery", role: "集約した監査ログの長期保管と分析。不審な操作の調査をSQLで行える" }
    ],
    points: [
      "GCPでは「プロジェクト」が権限・請求・リソースの自然な境界です。部門やシステムごとにプロジェクトを分けるのはGCP流の正攻法なので、乱立自体は悪ではありません。問題は階層の外に野良で存在することで、統制の答えは数を減らすことではなく組織配下に集めることです",
      "IAMを個人でなくグループに付与するのは、退職・異動対応を確実にするためです。グループから外せば全プロジェクトの権限が同時に消えるため、30個のプロジェクトを1つずつ棚卸しする作業がなくなります",
      "集約シンクの出力先を独立したログ専用プロジェクトにしたのは、各部門の管理者権限では監査ログを消せないようにするためです。証跡は「操作した本人が消せない場所」に置いて初めて監査に耐えます",
      "統制の基本方針を「ガードレール」（危険な操作を機械的に禁止・検知する）にし、人による事前承認ゲートを最小限にしています。組織ポリシーとSCCが自動で守ってくれるので、部門は日常の開発で情シスの承認を待つ必要がありません"
    ],
    pros: [
      "統制と部門の自律を両立できる。部門は自分のフォルダ配下で自由に開発できる",
      "後から作られたプロジェクトにも組織ポリシーと集約シンクが自動で効く",
      "退職・異動対応がグループ操作1回で完結し、漏れがなくなる",
      "請求が部門別に見える化され、コスト意識が部門に生まれる"
    ],
    cons: [
      "組織リソースの利用にはCloud Identity（またはGoogle Workspace）のセットアップが前提になる",
      "階層とポリシーの初期設計を誤ると、後からの再編は全部門に影響する大工事になる",
      "組織ポリシーが厳しすぎると部門の反発を招く。例外手続きの設計もセットで必要",
      "SCCの高機能な有料枠は組織規模に応じた費用がかかり、小さな組織には過剰なことがある"
    ],
    cost: "<strong>月数千円〜（ログ量次第）</strong>（東京リージョン・1USD=150円前後の概算）。Resource Manager・IAM・組織ポリシー・予算アラートは無料です。主なコストはCloud Loggingのログ取り込み（無料枠超過分は1GiBあたり約75円）とBigQueryの保管・クエリで、組織の規模とログ量に比例します。SCCは無料で使える範囲があり、脅威検知まで含む有料枠は組織規模に応じた見積もりになります。",
    references: [
      { title: "リソース階層の概要", url: "https://cloud.google.com/resource-manager/docs/cloud-platform-resource-hierarchy?hl=ja", note: "組織・フォルダ・プロジェクトの考え方" },
      { title: "組織ポリシーの概要", url: "https://cloud.google.com/resource-manager/docs/organization-policy/overview?hl=ja", note: "ガードレールの中核機能" },
      { title: "予算と予算アラートの設定", url: "https://cloud.google.com/billing/docs/how-to/budgets?hl=ja" },
      { title: "Security Command Centerの概要", url: "https://cloud.google.com/security-command-center/docs/security-command-center-overview?hl=ja" },
      { title: "集約シンクによるログの照合", url: "https://cloud.google.com/logging/docs/export/aggregated_sinks?hl=ja", note: "組織全体のログを1か所へ集める仕組み" },
      { title: "ランディングゾーンの設計", url: "https://cloud.google.com/architecture/landing-zones?hl=ja", note: "この構成全体の公式設計ガイド" }
    ]
  },
  alternatives: [
    {
      name: "単一プロジェクト+ラベル運用",
      when: "個人開発や数人のチームで、組織アカウントを用意するほどの規模ではない場合",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [3, 1] },
          { type: "project", label: "共用プロジェクト", from: [2, 0], to: [3, 1], depth: 1 }
        ],
        nodes: [
          { id: "billing", icon: "ops/cloud-billing", label: "Cloud Billing\n予算アラート", col: 1, row: 0 },
          { id: "prod", icon: "compute/cloud-run", label: "本番リソース\nラベルで区別", col: 2, row: 0 },
          { id: "dev", icon: "compute/cloud-run", label: "検証リソース\nラベルで区別", col: 3, row: 0 },
          { id: "admin", icon: "client/users", label: "開発者\n兼管理者", col: 0, row: 1 },
          { id: "sql", icon: "database/cloud-sql", label: "共用DB", col: 2, row: 1 },
          { id: "iam", icon: "security/iam", label: "IAM\n個人に直接付与", col: 3, row: 1 }
        ],
        edges: [
          { from: "billing", to: "admin", label: "予算超過を通知", dashed: true },
          { from: "admin", to: "prod" },
          { from: "prod", to: "sql" },
          { from: "dev", to: "sql", label: "本番と同居" },
          { from: "iam", to: "dev", noArrow: true, dashed: true }
        ]
      },
      flow: [
        "本番も検証も1つのプロジェクトに置き、リソースのラベル（env:prodのような目印タグ）で区別します",
        "請求の内訳はラベル別のレポートで把握し、プロジェクト全体に予算アラートを設定します",
        "権限は少人数の個人アカウントへ直接付与し、メンバーの出入りのたびに手作業で見直します"
      ],
      services: [
        { icon: "ops/cloud-billing", name: "Cloud Billing", role: "唯一の統制装置。予算アラートで使いすぎだけは検知する" },
        { icon: "security/iam", name: "IAM", role: "プロジェクト単位の権限管理。人数が少ないうちは個人直付与でも回る" },
        { icon: "compute/cloud-run", name: "Cloud Run（各リソース）", role: "本番・検証のワークロード。ラベルで区別するが物理的には同居している" },
        { icon: "database/cloud-sql", name: "Cloud SQL", role: "共用のデータベース。検証作業の事故が本番データに届き得る位置にある" }
      ],
      points: [
        "始めたばかりの段階では、この形が最も早くて安いのは事実です。統制のためのコストがゼロで、迷う要素もありません",
        "ただしラベルは「目印」であって「壁」ではありません。検証のつもりの削除コマンドが本番リソースに届く事故を、仕組みでは防げていない点を自覚しておく必要があります",
        "人が増えたときの最初の一歩は、本番と検証のプロジェクト分離です。GCPでは環境分離をプロジェクト単位で行うのが定石で、請求も権限も自然に分かれます（ケース44）"
      ],
      pros: [
        "統制のための追加コスト・設定がゼロで、すぐ開発を始められる",
        "少人数なら把握すべきものが1プロジェクトに収まり、見通しがよい"
      ],
      cons: [
        "権限・請求・障害の境界がなく、検証の事故が本番へ波及し得る",
        "メンバー増加後にプロジェクトを分け直す移行作業は重い",
        "監査ログを操作者自身が消せてしまい、証跡として弱い"
      ],
      cost: "<strong>統制部分の追加費用は0円</strong>。かかるのはワークロード自体の費用だけです。ただし本番・検証同居による事故のリスクという見えないコストを抱えている点に注意してください。",
      references: [
        { title: "IAMの概要", url: "https://cloud.google.com/iam/docs/overview?hl=ja" },
        { title: "予算と予算アラートの設定", url: "https://cloud.google.com/billing/docs/how-to/budgets?hl=ja" }
      ]
    },
    {
      name: "IaCによるプロジェクトファクトリー構成",
      when: "プロジェクトが数十個を超え、払い出し（新規作成と初期設定）を申請ベースで自動化したい場合",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [3, 1] },
          { type: "project", label: "新プロジェクト", from: [3, 1], to: [3, 1], depth: 1 }
        ],
        nodes: [
          { id: "dev", icon: "client/developer", label: "申請者\nテンプレートへPR", col: 0, row: 0 },
          { id: "build", icon: "devtools/cloud-build", label: "Cloud Build\nレビュー後に実行", col: 1, row: 0 },
          { id: "infm", icon: "devtools/infra-manager", label: "Infrastructure\nManager", col: 2, row: 0 },
          { id: "resm", icon: "ops/resource-manager", label: "Resource Manager\nAPI", col: 3, row: 0 },
          { id: "newproj", icon: "compute/cloud-run", label: "初期設定済み\nリソース一式", col: 3, row: 1 }
        ],
        edges: [
          { from: "dev", to: "build", label: "申請PR" },
          { from: "build", to: "infm", label: "Terraform適用" },
          { from: "infm", to: "resm", label: "作成指示" },
          { from: "resm", to: "newproj", label: "自動作成" }
        ]
      },
      flow: [
        "プロジェクトが欲しい部門は、Terraformテンプレートのリポジトリに設定ファイルの追加PR（プルリクエスト）を出します",
        "情シスがPRをレビューして承認すると、Cloud BuildがInfrastructure Manager経由でTerraformを適用します",
        "Resource Manager APIで新プロジェクトが作成され、IAMグループ・ログの集約シンク・予算アラート・組織ポリシー例外などの初期設定がテンプレートどおり自動で入ります"
      ],
      services: [
        { icon: "devtools/infra-manager", name: "Infrastructure Manager", role: "TerraformをマネージドでGCP上で実行するサービス。状態ファイルの管理も引き受ける" },
        { icon: "devtools/cloud-build", name: "Cloud Build", role: "PRの承認を起点にTerraform適用を実行するCI/CDの実行役" },
        { icon: "ops/resource-manager", name: "Resource Manager", role: "プロジェクト作成と階層配置のAPI。ファクトリーの最終的な実体" },
        { icon: "compute/cloud-run", name: "初期リソース一式", role: "テンプレートが配る標準装備。ログ設定・予算・IAMが最初から揃った状態で部門へ渡す" }
      ],
      points: [
        "手作業の払い出しは「設定漏れ」が必ず起きます。テンプレート経由の作成に一本化すると、監査ログや予算アラートの入れ忘れが構造的に起きなくなります",
        "承認プロセスをPRレビューに一本化しているのが肝です。申請書や承認ワークフローシステムを別に作らず、変更履歴と承認記録がGitに自然に残ります",
        "推奨構成のガードレールができた後の次の一手であり、いきなりここから始めるものではありません。Terraformを書ける人材の確保が前提になります（IaC自体の学び方はケース44）"
      ],
      pros: [
        "払い出しが数分で完了し、初期設定の品質が均一になる",
        "誰が承認したかの証跡がGit履歴として自動的に残る",
        "プロジェクトが100個に増えても運用の手間が増えにくい"
      ],
      cons: [
        "Terraformのスキルとテンプレートの初期整備コストが必要",
        "テンプレート自体のバグが全プロジェクトへ波及するため、テンプレートのレビュー体制が重要になる"
      ],
      cost: "<strong>月数百円〜数千円程度</strong>（東京リージョン・1USD=150円前後の概算）。Cloud Buildは無料枠が大きく、Infrastructure Managerの実行費用もわずかです。実質のコストはツールよりテンプレートを整備・維持する人件費です。",
      references: [
        { title: "Infrastructure Managerの概要", url: "https://cloud.google.com/infrastructure-manager/docs/overview?hl=ja" },
        { title: "ランディングゾーンの設計", url: "https://cloud.google.com/architecture/landing-zones?hl=ja", note: "ファクトリー化を含む段階的な統制の指針" }
      ]
    }
  ],
  cost: "<p>統制そのものはGCPでは驚くほど安く、推奨構成でも<strong>月数千円〜</strong>（ログ量次第）です。Resource Manager・IAM・組織ポリシーが無料なので、統制のコストの実体はツール代ではなく設計と運用の人件費だと分かります。代替1は追加費用0円ですが事故リスクを抱え、代替2はツール費用より<strong>Terraform人材の確保</strong>が実質のコストです。いずれも東京リージョン・1USD=150円前後の目安です。</p>",
  summary: "<p>マルチプロジェクト統制の要点は、<strong>プロジェクトの乱立を止めることではなく、すべてを組織階層の中に置くこと</strong>です。階層に置きさえすれば、組織ポリシーもIAMも集約シンクも上位から自動継承され、後から増えるプロジェクトにも統制が効き続けます。もう1つの分かれ目は「ゲート（事前承認）よりガードレール（自動的な禁止と検知）」という方針です。人の承認で守ろうとすると開発速度と安全のトレードオフになりますが、機械のガードレールなら両立できます。環境分離とIaCの実践はケース44、セキュリティ検知の深掘りはケース47、監査ログの分析基盤はケース23で扱います。</p>",
  quiz: [
    {
      q: "この構成では、IAMの権限を個人アカウントではなくGoogleグループに付与しています。プロジェクトが30個ある状況で、この違いが最も効くのはどんな場面でしょうか。",
      a: "退職や異動の場面です。個人に直接付与していると、30個のプロジェクトを1つずつ調べて権限を剥がす棚卸し作業が必要になり、漏れが必ず起きます。グループ付与ならグループからメンバーを外す操作1回で、全プロジェクトの権限が同時に消えます。「権限は人にではなく役割（グループ）に与える」は、クラウドに限らないアクセス管理の基本原則です。"
    },
    {
      q: "監査ログの集約シンクの出力先を、各部門のプロジェクトではなく独立したログ専用プロジェクトにするのはなぜでしょうか。",
      a: "各部門の管理者が自分の操作の証跡を消せてしまうと、監査ログとしての価値がなくなるからです。ログ専用プロジェクトを情シスだけが管理する場所として分離すれば、部門プロジェクトで強い権限を持つ人でも組織の証跡には手が出せません。証跡は「操作した本人が消せない場所」に置くのが原則で、これはGCPのプロジェクト分離が権限の壁として機能する好例です。"
    },
    {
      q: "ある部門から「組織ポリシーで外部IPが禁止されていて、検証用のVMが立てられない。開発が止まるので何とかしてほしい」と要望が来ました。あなたならどう対応しますか。",
      a: "組織ポリシーの継承の仕組みを使い、組織全体の禁止は維持したまま、その部門の検証用フォルダまたは特定プロジェクトに限って例外を明示的に設定するのが良い対応です。全社の原則を崩さず、例外の範囲と理由が記録に残ります。加えてSCCの検知は例外先にも効かせておけば、緩めた場所の危険な設定も見逃しません。統制は「全部禁止か全部許可か」の二択ではなく、階層を使って例外を管理できることが組織ポリシーの強みです。"
    }
  ]
});
