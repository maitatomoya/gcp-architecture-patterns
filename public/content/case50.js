// ケース50：秘密情報・鍵管理
registerCase({
  id: 50,
  category: "運用・セキュリティ・信頼性",
  title: "秘密情報・鍵管理",
  scenario: "<p>成長中のスタートアップで、セキュリティ監査を受けたところ厳しい指摘を受けました。DBパスワードや外部APIキーが環境変数ファイルとしてリポジトリに直書きされ、CI/CD（ケース43のような構成）にはサービスアカウントキーのJSONファイルが登録されたまま数年放置されています。退職者が過去の認証情報を持ち出せる状態で、漏えいしても誰も気づけません。</p><p>ここで扱う「秘密情報（シークレット）」とはパスワード・APIキー・証明書・暗号鍵など、漏れた瞬間に被害へ直結する情報のことです。コードや設定ファイルから秘密情報を引き剥がし、保管・受け渡し・記録・入れ替えまでを仕組みにするのがこのケースの目標です。</p>",
  requirements: [
    "APIキー・DBパスワードをコードとリポジトリから完全に排除したい",
    "誰がいつどの秘密情報にアクセスしたかを記録したい",
    "CI/CDに長期間有効な鍵ファイルを置くのをやめたい",
    "秘密情報の定期的な入れ替え（ローテーション）を運用に組み込みたい",
    "権限は秘密情報ごとに最小限へ絞りたい"
  ],
  main: {
    name: "Secret Manager+Workload Identity連携によるキーレス構成",
    diagram: {
      cols: 5, rows: 3,
      groups: [
        { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [3, 2] }
      ],
      nodes: [
        { id: "gh", icon: "client/external-saas", label: "GitHub Actions\n外部CI", col: 0, row: 0 },
        { id: "wif", icon: "security/workload-identity", label: "WIF\nキーレス認証", col: 1, row: 0 },
        { id: "iam", icon: "security/iam", label: "IAM\n権限チェック", col: 2, row: 0 },
        { id: "sm", icon: "security/secret-manager", label: "Secret Manager\n秘密情報の金庫", col: 2, row: 1 },
        { id: "kms", icon: "security/cloud-kms", label: "Cloud KMS\n暗号鍵の管理", col: 3, row: 1 },
        { id: "run", icon: "compute/cloud-run", label: "Cloud Run\nアプリ", col: 1, row: 2 },
        { id: "log", icon: "ops/cloud-logging", label: "Cloud Logging\n監査ログ", col: 3, row: 2 }
      ],
      edges: [
        { from: "gh", to: "wif", label: "OIDCトークン" },
        { from: "wif", to: "iam", label: "短命トークン" },
        { from: "iam", to: "sm", label: "許可時のみ" },
        { from: "run", to: "sm", label: "起動時に取得" },
        { from: "kms", to: "sm", label: "暗号化", dashed: true },
        { from: "sm", to: "log", label: "アクセス監査", dashed: true }
      ]
    },
    flow: [
      "DBパスワード・APIキーはすべてSecret Managerに登録する。値はバージョン管理され、入れ替えの履歴が残る",
      "Cloud Runは起動時にSecret Managerの値を環境変数またはファイルとして受け取る。コードとリポジトリには秘密情報が一切残らない",
      "GitHub ActionsはWorkload Identity連携（WIF）を使い、ジョブごとに発行されるOIDCトークン（自分が正当なリポジトリのジョブであることの証明書のようなもの）をGCPの短命なアクセストークンに交換する。長期間有効なサービスアカウントキーのJSONは廃止する",
      "IAMは「このサービスアカウントはこのシークレットだけ読める」という粒度で権限を絞る",
      "シークレットの値はCloud KMS管理の鍵で暗号化されて保存され、誰がいつ読んだかは監査ログに記録される"
    ],
    services: [
      { icon: "security/secret-manager", name: "Secret Manager", role: "秘密情報の専用金庫。バージョン管理・アクセス制御・監査記録・ローテーション通知を備える" },
      { icon: "security/workload-identity", name: "Workload Identity連携", role: "外部CI等のワークロードを鍵ファイルなしで認証する仕組み。長命の鍵を短命のトークンに置き換える" },
      { icon: "security/iam", name: "IAM", role: "シークレット単位・サービスアカウント単位の最小権限を実現するアクセス制御" },
      { icon: "security/cloud-kms", name: "Cloud KMS", role: "保存データを暗号化する鍵の管理。自社統制の鍵（CMEK）に切り替えることもできる" },
      { icon: "compute/cloud-run", name: "Cloud Run", role: "秘密情報の利用者。実行時にだけ値を受け取り、イメージやコードには含めない" },
      { icon: "ops/cloud-logging", name: "Cloud Logging（監査ログ）", role: "秘密情報への全アクセスの証跡。漏えい調査と不正検知の土台" }
    ],
    points: [
      "秘密情報の管理は「隠す場所」ではなく「ライフサイクル」の問題です。登録・配布・記録・ローテーション・失効という一生を仕組みで回せるかで評価します。環境変数ファイルの直書きは配布はできても記録と失効ができません",
      "サービスアカウントキーのJSONが危険なのは、有効期限が実質無期限で、コピーされても気づけず、退職後も使え続けるからです。WIFは認証のたびに短命トークンを発行するため、盗む価値のある長命の鍵がそもそも存在しなくなります",
      "権限は「シークレット全体の閲覧者」ではなく個々のシークレット単位で付与します。アプリAのDBパスワードをアプリBが読める必要はありません",
      "GCPは保存データを標準で暗号化していますが、KMSで自社管理の鍵（CMEK）に切り替えると「鍵を無効化すれば読めなくなる」という統制を自社側に持てます。規制業種で求められる選択肢です"
    ],
    pros: [
      "コード・リポジトリ・CI設定から秘密情報が消え、漏えい経路が大幅に減る",
      "アクセスがすべて監査ログに残り、漏えい時の影響調査ができる",
      "バージョン管理により、ローテーションと切り戻しが安全にできる",
      "長命のサービスアカウントキーを廃止でき、退職者・盗難リスクが構造的に消える"
    ],
    cons: [
      "既存の全アプリ・CI設定の移行作業が必要（直書きからの引き剥がし）",
      "WIFの初期設定（プロバイダ登録・属性マッピング）は概念が新しく学習コストがある",
      "シークレットの値を入れ替えた後、アプリへの反映（再デプロイや再読込）まで設計しないとローテーションが形骸化する",
      "Secret Manager自体への権限管理を誤ると単一の攻撃対象になる（管理者権限は特に厳格に）"
    ],
    cost: "<strong>月数十円〜数百円</strong>が目安（東京リージョン、1USD=150円換算）。Secret Managerはアクティブなシークレットバージョンあたり月約9円＋アクセス1万回あたり約4.5円、Cloud KMSは鍵バージョンあたり月約9円＋暗号化操作1万回あたり約4.5円です。シークレット50個・月100万アクセスでも月1,000円前後で、セキュリティ対策としては最も費用対効果の高い部類です。",
    references: [
      { title: "Secret Managerの概要", url: "https://cloud.google.com/secret-manager/docs/overview?hl=ja" },
      { title: "Secret Managerのベストプラクティス", url: "https://cloud.google.com/secret-manager/docs/best-practices?hl=ja", note: "権限設計・ローテーションの指針" },
      { title: "Workload Identity連携", url: "https://cloud.google.com/iam/docs/workload-identity-federation?hl=ja", note: "キーレス認証の仕組み" },
      { title: "Cloud RunでのSecret Managerの使用", url: "https://cloud.google.com/run/docs/configuring/services/secrets?hl=ja", note: "環境変数・ボリュームでの受け渡し" },
      { title: "サービスアカウント認証情報", url: "https://cloud.google.com/iam/docs/service-account-creds?hl=ja", note: "キーのリスクと代替手段の整理" }
    ]
  },
  alternatives: [
    {
      name: "Cloud KMSによるエンベロープ暗号化構成",
      when: "大量・大容量のデータそのものを暗号化したい場合（Secret Managerは少数の小さな秘密情報向け）",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [3, 1] }
        ],
        nodes: [
          { id: "users", icon: "client/users", label: "ユーザー", col: 0, row: 1 },
          { id: "run", icon: "compute/cloud-run", label: "Cloud Run\nアプリ", col: 1, row: 0 },
          { id: "kms", icon: "security/cloud-kms", label: "Cloud KMS\nKEK（鍵の鍵）", col: 2, row: 0 },
          { id: "gcs", icon: "storage/cloud-storage", label: "Cloud Storage\n暗号化データ", col: 2, row: 1 },
          { id: "iam", icon: "security/iam", label: "IAM\n鍵の利用権限", col: 3, row: 0 },
          { id: "log", icon: "ops/cloud-logging", label: "Cloud Logging\n鍵利用の記録", col: 3, row: 1 }
        ],
        edges: [
          { from: "users", to: "run", label: "HTTPS" },
          { from: "run", to: "kms", label: "DEKの暗号化依頼" },
          { from: "run", to: "gcs", label: "暗号化して保存" },
          { from: "iam", to: "kms", noArrow: true, dashed: true },
          { from: "kms", to: "log", label: "鍵利用を記録", dashed: true }
        ]
      },
      flow: [
        "アプリはデータごとにDEK（データ暗号鍵）をその場で生成し、DEKでデータ本体を暗号化する",
        "DEK自体をCloud KMSに預けたKEK（鍵を暗号化する鍵）で暗号化してもらい、暗号化済みデータと「包んだDEK」をセットでCloud Storage等に保存する",
        "復号時は逆に、包んだDEKをKMSで復号してもらってからデータを開く。KEK本体はKMSの外に一度も出ない",
        "KEKの利用権限はIAMで絞り、利用履歴は監査ログに残る。KEKを無効化すれば全データを一斉に読めなくできる"
      ],
      services: [
        { icon: "security/cloud-kms", name: "Cloud KMS", role: "KEKの保管と暗号化・復号の実行。鍵のローテーション・無効化・破棄を一元管理する" },
        { icon: "compute/cloud-run", name: "Cloud Run", role: "DEKの生成とデータ暗号化を行うアプリ本体" },
        { icon: "storage/cloud-storage", name: "Cloud Storage", role: "暗号化済みデータと包んだDEKの保存先" },
        { icon: "security/iam", name: "IAM", role: "「誰がKEKを使えるか」の制御。データへの権限と鍵への権限を別々に管理できる" }
      ],
      points: [
        "この二段構え（データはDEKで、DEKはKEKで守る）をエンベロープ暗号化と呼びます。巨大なデータをKMSへ送らずに済み、KMS呼び出しは小さなDEKの暗号化・復号だけになるため、性能とコストの両面で効率的です",
        "Secret Managerとの使い分けは量とサイズです。少数のパスワード・APIキーはSecret Manager、数百万件の個人情報ファイルのようなデータ本体の暗号化はKMS＋エンベロープ方式が適します",
        "「データにアクセスできる権限」と「鍵を使える権限」が分かれるのが強みです。ストレージ管理者でも鍵の権限がなければ中身を読めない、という職務分離を作れます",
        "多くのGCPサービスはCMEK対応なので、自前でエンベロープ暗号化を実装する前に、サービス標準のCMEK設定で要件を満たせないかを先に確認します"
      ],
      pros: [
        "大量・大容量データの暗号化を現実的な性能とコストで実現できる",
        "鍵の無効化・破棄で大量データを一括で読めなくできる（暗号学的消去）",
        "データへの権限と鍵への権限を分離した統制を作れる"
      ],
      cons: [
        "アプリに暗号化・復号の実装が入り、鍵の取り回しを誤ると自分のデータを失うリスクがある",
        "DEKの管理（保存形式・世代管理）を自分で設計する必要がある",
        "標準の保存時暗号化やCMEKで足りるケースでは過剰実装になる"
      ],
      cost: "<strong>月数百円程度〜</strong>（東京リージョン、1USD=150円換算）。KMSの鍵バージョンあたり月約9円と、暗号化・復号操作1万回あたり約4.5円が中心です。エンベロープ方式ではKMS呼び出しがDEK単位で済むため、データ量が増えても鍵操作のコストは緩やかにしか増えません。",
      references: [
        { title: "エンベロープ暗号化", url: "https://cloud.google.com/kms/docs/envelope-encryption?hl=ja", note: "この方式そのものの公式解説" },
        { title: "Cloud KMSのドキュメント", url: "https://cloud.google.com/kms/docs?hl=ja" },
        { title: "顧客管理の暗号鍵（CMEK）", url: "https://cloud.google.com/storage/docs/encryption/customer-managed-keys?hl=ja", note: "自前実装の前に検討すべき標準機能" }
      ]
    },
    {
      name: "外部シークレット管理（HashiCorp Vault等）併用構成",
      when: "マルチクラウドやオンプレを含む全社の秘密情報を一元管理したい場合、動的シークレット等の高度な機能が必要な場合",
      diagram: {
        cols: 5, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [0, 0], to: [1, 1] },
          { type: "external", label: "外部の共通基盤", from: [3, 0], to: [4, 1] }
        ],
        nodes: [
          { id: "run", icon: "compute/cloud-run", label: "Cloud Run\nアプリ", col: 0, row: 0 },
          { id: "sql", icon: "database/cloud-sql", label: "Cloud SQL", col: 1, row: 1 },
          { id: "vault", icon: "client/external-saas", label: "Vault等\nシークレット基盤", col: 3, row: 0 },
          { id: "onprem", icon: "client/onprem-server", label: "オンプレ・\n他クラウド", col: 4, row: 1 }
        ],
        edges: [
          { from: "run", to: "vault", label: "シークレット取得" },
          { from: "run", to: "sql", label: "取得した情報で接続" },
          { from: "onprem", to: "vault", label: "同じ金庫を利用" }
        ]
      },
      flow: [
        "秘密情報はGCPの外にある共通のシークレット基盤（HashiCorp Vault等）に集約する",
        "Cloud Runのアプリは、自身のサービスアカウントのIDトークンでVaultに認証し、必要なシークレットを取得する（ここでも鍵ファイルは使わない）",
        "取得したDBパスワード等でCloud SQLに接続する。Vaultの動的シークレット機能を使えば、接続のたびに有効期限つきのDBアカウントを発行させることもできる",
        "オンプレや他クラウドのシステムも同じ基盤を使うため、全社の秘密情報の棚卸し・監査が1か所で完結する"
      ],
      services: [
        { icon: "client/external-saas", name: "HashiCorp Vault等（外部シークレット基盤）", role: "全社共通の秘密情報の金庫。動的シークレットや詳細な失効制御など高度な機能を持つ" },
        { icon: "compute/cloud-run", name: "Cloud Run", role: "シークレットの利用者。サービスアカウントのIDで外部基盤に認証する" },
        { icon: "database/cloud-sql", name: "Cloud SQL", role: "接続情報を受け渡される対象のDB" },
        { icon: "client/onprem-server", name: "オンプレ・他クラウドのシステム", role: "同じ基盤を共有する他環境。この存在がこの構成を選ぶ理由になる" }
      ],
      points: [
        "この構成を選ぶ動機は機能ではなく組織です。AWS・GCP・オンプレが混在する企業では、環境ごとに金庫が分かれると監査も棚卸しも破綻するため、1つの金庫に寄せる価値が生まれます。GCP単独ならSecret Managerで足ります",
        "動的シークレット（要求のたびに短命の認証情報を発行し自動失効させる機能）は「漏れても数分で無効」という強い性質を持ち、Secret Managerにはない差別化点です",
        "外部基盤自体の可用性・運用が新たな課題になります。Vaultが落ちると全システムが起動できない、という単一障害点にしない設計（キャッシュ・冗長化）が必須です",
        "マネージド版（HCP Vault等）を選ぶと運用は軽くなりますが、その分の利用料と、秘密情報を外部SaaSに置くことへの社内承認が必要です"
      ],
      pros: [
        "マルチクラウド・オンプレを含む全社の秘密情報を一元管理・一元監査できる",
        "動的シークレットなど、失効を前提にした高度な運用ができる",
        "クラウド移行や併用が進んでも管理方法を変えずに済む"
      ],
      cons: [
        "基盤自体の構築・運用（または利用料）が重く、小規模には過剰",
        "外部基盤が単一障害点になり得るため、可用性設計が別途必要",
        "GCPサービスとの統合の滑らかさはSecret Managerに劣る場面がある"
      ],
      cost: "<strong>月数万円〜</strong>（1USD=150円換算）。マネージド版Vaultは小規模クラスタでも月数万円からで、自前運用ならVM費用に加えて運用の人件費がかかります。Secret Managerの月数百円と比べて2桁上がるため、マルチクラウド一元管理という明確な必要性があるときに選びます。",
      references: [
        { title: "Workload Identity連携", url: "https://cloud.google.com/iam/docs/workload-identity-federation?hl=ja", note: "外部基盤とGCP間のキーレス認証にも使われる考え方" },
        { title: "Secret Managerのベストプラクティス", url: "https://cloud.google.com/secret-manager/docs/best-practices?hl=ja", note: "GCP内で完結する場合の比較対象" }
      ]
    }
  ],
  cost: "<p>推奨構成は<strong>月数十円〜数百円</strong>と極めて安価で、費用よりも移行の手間が実質のコストです。エンベロープ暗号化の追加は<strong>月数百円程度〜</strong>、外部Vault併用は<strong>月数万円〜</strong>。東京リージョン・1USD=150円前提の目安です。秘密情報の管理は「漏えい1件の損失額」と比べる性質の投資なので、金額での迷いはほぼ生じません。</p>",
  summary: "<p>秘密情報の管理で問うべきは「どこに隠すか」ではなく「<strong>ライフサイクルを回せるか</strong>」です。Secret Managerで登録・配布・監査・ローテーションを仕組みにし、Workload Identity連携で「長命の鍵ファイル」という漏えいの温床を構造ごと消す。これがGCPの定石です。データ本体の暗号化が必要になったらKMSのエンベロープ暗号化、マルチクラウドの一元管理が必要になったら外部Vaultへと、要件に応じて広げます。CI/CDからの利用はケース43、IaCでの一括設定はケース44、環境全体のセキュリティ監視はケース47と組み合わせて完成します。</p>",
  quiz: [
    {
      q: "環境変数ファイルに直書きしたDBパスワードをSecret Managerへ移しました。「置き場所が変わっただけ」ではない本質的な改善は何でしょうか。",
      a: "アクセス制御・記録・入れ替えが可能になったことです。直書きの場合、リポジトリを読める全員が値を知り得て、誰が見たかの記録は残らず、値の変更はコード修正として全環境に手作業で波及させることになります。Secret Manager移行後は、シークレット単位のIAMで読める主体を絞り、全アクセスが監査ログに残り、バージョン管理のもとで安全にローテーションできます。つまり「隠した」のではなく「ライフサイクルを管理下に置いた」ことが本質です。"
    },
    {
      q: "Workload Identity連携は「鍵のない認証」と呼ばれます。鍵ファイルを渡さずに、GCPはなぜGitHub Actionsのジョブを信頼できるのでしょうか。",
      a: "事前に「このGitHubリポジトリのこのブランチのジョブを信頼する」という信頼関係をGCP側に登録しておき、ジョブ実行時にGitHubが発行するOIDCトークン（発行元が署名した身元証明）をGCPが検証して、短命のアクセストークンと交換するからです。認証のたびに新しい短命トークンが発行されるため、保管しておくべき長命の秘密がそもそも存在しません。盗まれる物を無くすという発想が、鍵を上手に隠す発想より一段強い対策になっています。"
    },
    {
      q: "外部の委託先エンジニアに、開発環境のDBを2週間だけ触ってもらうことになりました。あなたなら認証情報をどう渡しますか。",
      a: "パスワードそのものをチャット等で渡すのは、失効の手段がなく記録も残らないため避けます。委託先用のアカウントを個別に発行し、シークレットへのアクセス権をIAMで期限つき（IAM Conditionsの有効期限）に絞って付与し、作業終了時に確実に失効させるのが基本です。Vaultの動的シークレットのような短命認証情報を使えばさらに堅くなります。要点は「渡す」のではなく「期限と記録つきでアクセスさせ、終わったら消す」ことです。"
    }
  ]
});
