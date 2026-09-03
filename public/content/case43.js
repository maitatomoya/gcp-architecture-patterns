// ケース43：CI/CDパイプライン
registerCase({
  id: 43,
  category: "運用・セキュリティ・信頼性",
  title: "CI/CDパイプライン",
  scenario: "<p>5人チームで運営するWebサービス。これまで各自の手元からコマンドで本番へ直接デプロイしており、テスト漏れのコードが金曜夜に本番へ出て障害になったことがあります。<strong>コミットからリリースまでを自動化</strong>し、テストを通ったものだけが、検証環境での確認と承認を経て本番に出る流れを仕組みで強制したい。あわせて、APIキーなどの秘密情報がリポジトリに直書きされている状態も解消します。CI（継続的インテグレーション：テストとビルドの自動化）とCD（継続的デリバリー：リリースの自動化）の定石構成です。</p>",
  requirements: [
    "pushを起点にテストとビルドが自動で走ること",
    "コンテナイメージにバージョンが付き、脆弱性スキャンされること",
    "検証環境で確認し、承認してから本番へ出る順序を強制したい",
    "APIキーなどのシークレットをGitに置かない",
    "問題発生時に1つ前のバージョンへすぐ戻せること"
  ],
  main: {
    name: "Cloud Build+Cloud Deployによる段階的リリース構成",
    diagram: {
      cols: 5, rows: 2,
      groups: [
        { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [4, 1] }
      ],
      nodes: [
        { id: "dev", icon: "client/developer", label: "開発者\nGit push", col: 0, row: 1 },
        { id: "secret", icon: "security/secret-manager", label: "Secret Manager\n認証情報", col: 2, row: 0 },
        { id: "build", icon: "devtools/cloud-build", label: "Cloud Build\nテスト/ビルド", col: 1, row: 1 },
        { id: "ar", icon: "devtools/artifact-registry", label: "Artifact Registry\nイメージ保管", col: 2, row: 1 },
        { id: "deploy", icon: "devtools/cloud-deploy", label: "Cloud Deploy\n段階リリース", col: 3, row: 0 },
        { id: "runStg", icon: "compute/cloud-run", label: "Cloud Run\n検証環境", col: 4, row: 0 },
        { id: "runProd", icon: "compute/cloud-run", label: "Cloud Run\n本番環境", col: 4, row: 1 }
      ],
      edges: [
        { from: "dev", to: "build", label: "pushで自動起動" },
        { from: "build", to: "ar", label: "イメージ登録" },
        { from: "build", to: "deploy", label: "リリース作成" },
        { from: "deploy", to: "runStg", label: "まず検証へ" },
        { from: "deploy", to: "runProd", label: "承認後に本番へ" },
        { from: "ar", to: "deploy", noArrow: true, dashed: true },
        { from: "secret", to: "build", noArrow: true, dashed: true }
      ]
    },
    flow: [
      "開発者がmainブランチへマージすると、Cloud Buildのトリガーが起動し、テストとコンテナイメージのビルドを実行する",
      "ビルドされたイメージはArtifact Registryへコミットハッシュ付きのタグで登録され、自動で脆弱性スキャンにかけられる",
      "Cloud Buildが続けてCloud Deployのリリースを作成する。ここでCIの仕事は終わり、以降の配布はCloud Deployの担当になる",
      "Cloud Deployはまず検証環境のCloud Runへデプロイする。動作確認後に承認操作をすると、同じイメージがそのまま本番環境へ昇格する",
      "ビルドや実行に必要な認証情報はSecret Managerから実行時にだけ渡し、リポジトリには一切置かない"
    ],
    services: [
      { icon: "devtools/cloud-build", name: "Cloud Build", role: "CIの本体。Gitのpushをトリガーにテスト・ビルドをサーバーレスで実行する。ビルド手順はcloudbuild.yamlでコード管理する" },
      { icon: "devtools/artifact-registry", name: "Artifact Registry", role: "コンテナイメージの保管庫。バージョン管理と脆弱性スキャンを担い、パイプライン全体の受け渡し地点になる" },
      { icon: "devtools/cloud-deploy", name: "Cloud Deploy", role: "CDの本体。検証から本番への昇格順序・承認・ロールバックを宣言的に管理するデリバリーパイプライン" },
      { icon: "compute/cloud-run", name: "Cloud Run", role: "デプロイ先の実行環境。検証と本番を別サービスとして分け、リビジョン機能でロールバックを支える" },
      { icon: "security/secret-manager", name: "Secret Manager", role: "APIキーやDBパスワードの金庫。コードと秘密情報を分離し、IAMで読める相手を制限する" }
    ],
    points: [
      "CI（作る）とCD（配る）を別サービスに分けたのは責務分離のため。作る工程は全自動でよいが、配る工程には「本番だけ承認制」のような人の判断を挟みたい。この違いをCloud Deployのパイプライン定義で表現する",
      "検証で動いたイメージをビルドし直さずそのまま本番へ昇格させる。環境ごとに再ビルドすると依存ライブラリの差などで「検証では動いたのに」が起きるため、同一イメージの昇格が鉄則",
      "イメージのタグはlatestでなくコミットハッシュにする。どのコードがどの環境で動いているかが常に特定でき、ロールバックも正確になる",
      "パイプライン定義（cloudbuild.yamlとclouddeploy.yaml）自体もリポジトリで管理する。インフラをコードにする発想はケース44のIaCへつながる"
    ],
    pros: [
      "人手デプロイが廃止され、手順ミス・テスト漏れによる事故が構造的に減る",
      "検証を経ずに本番へ出る経路が存在しなくなり、順序が仕組みで強制される",
      "ロールバックが1操作で済む（前のリビジョン・リリースへ切り戻し）",
      "誰が何をいつリリースしたかの履歴が自動で残り、障害調査が速くなる"
    ],
    cons: [
      "cloudbuild.yamlやclouddeploy.yamlの初期整備に学習コストがかかる",
      "ビルド時間が積み上がると費用と待ち時間が増える（キャッシュ活用などの改善が必要）",
      "緊急修正でも同じ順序を踏む必要があり、緊急時の運用ルールを別途決めておく必要がある"
    ],
    cost: "<strong>月数百円〜数千円程度</strong>（小規模チームの目安。東京リージョン・1USD=150円換算）。Cloud Buildはビルド時間の従量課金で無料枠あり。Artifact Registryは保存容量課金（無料枠0.5GB）、Cloud Deployはパイプラインの利用に応じた課金。デプロイ回数が多くても大きな額にはなりにくい。",
    references: [
      { title: "Cloud Buildの概要", url: "https://cloud.google.com/build/docs/overview?hl=ja" },
      { title: "Cloud Deployの概要", url: "https://cloud.google.com/deploy/docs/overview?hl=ja" },
      { title: "Artifact Registryの概要", url: "https://cloud.google.com/artifact-registry/docs/overview?hl=ja" },
      { title: "Secret Managerの概要", url: "https://cloud.google.com/secret-manager/docs/overview?hl=ja" },
      { title: "Cloud DeployでCloud Runへデプロイする", url: "https://cloud.google.com/deploy/docs/deploy-app-run?hl=ja", note: "この構成の公式チュートリアル" }
    ]
  },
  alternatives: [
    {
      name: "GitHub Actions+Workload Identity連携",
      when: "チームが既にGitHub Actionsに習熟しており、CI資産や運用ノウハウを活かしたい場合",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "external", label: "GitHub", from: [1, 1], to: [1, 1] },
          { type: "gcp-cloud", label: "Google Cloud", from: [2, 0], to: [3, 1] }
        ],
        nodes: [
          { id: "dev", icon: "client/developer", label: "開発者\nGit push", col: 0, row: 1 },
          { id: "gha", icon: "client/external-saas", label: "GitHub Actions\nテスト/ビルド", col: 1, row: 1 },
          { id: "wif", icon: "security/workload-identity", label: "Workload\nIdentity連携", col: 2, row: 0 },
          { id: "ar", icon: "devtools/artifact-registry", label: "Artifact Registry\nイメージ保管", col: 2, row: 1 },
          { id: "run", icon: "compute/cloud-run", label: "Cloud Run\n本番環境", col: 3, row: 1 }
        ],
        edges: [
          { from: "dev", to: "gha", label: "push" },
          { from: "gha", to: "wif", label: "一時認証", dashed: true },
          { from: "gha", to: "ar", label: "イメージpush" },
          { from: "ar", to: "run", label: "新リビジョン配備" }
        ]
      },
      flow: [
        "pushを起点にGitHub Actionsがテストとビルドを実行する",
        "ActionsはWorkload Identity連携でGCPの一時的な認証情報を取得する。サービスアカウントキーの発行・保管は不要",
        "イメージをArtifact Registryへpushし、続けてgcloudコマンドでCloud Runの新リビジョンをデプロイする",
        "検証環境と本番環境の切り替えは、ブランチやworkflowの条件分岐で表現する"
      ],
      services: [
        { icon: "client/external-saas", name: "GitHub Actions", role: "GitHub内蔵のCI/CD。リポジトリと同じ場所でワークフローを管理できる" },
        { icon: "security/workload-identity", name: "Workload Identity連携", role: "外部CIにサービスアカウントキーを渡さず、GitHubのOIDCトークンをGCP権限に交換する仕組み。キー漏えいリスクを根絶する" },
        { icon: "devtools/artifact-registry", name: "Artifact Registry", role: "イメージ保管と脆弱性スキャン。ここはGCP側に置く" },
        { icon: "compute/cloud-run", name: "Cloud Run", role: "デプロイ先の実行環境" }
      ],
      points: [
        "最重要ポイントはWorkload Identity連携。サービスアカウントのキーファイルをGitHubのシークレットに保存する方式は漏えい事故の定番なので、キーレス認証を最初から使う",
        "PR連携やマーケットプレイスの豊富なアクションなど、GitHubに閉じた開発体験の良さが強み",
        "承認付きの段階リリースはGitHubのenvironment保護ルールで代用できるが、複数環境の昇格管理が複雑になってきたらCloud Deployの併用を検討する"
      ],
      pros: [
        "既存のGitHub Actions資産と知識をそのまま活かせる",
        "コードレビューからCIまでGitHub内で完結し開発体験が良い"
      ],
      cons: [
        "承認付きの段階的リリース管理はCloud Deployより作り込みが必要",
        "GCPの外に認証の起点があるため、Workload Identity連携の設定を正しく理解する必要がある",
        "ビルド分数の課金体系はGitHub側のプランに依存する"
      ],
      cost: "<strong>月0円〜数千円</strong>。GitHub Actionsは無料枠（パブリックは無料、プライベートも月2,000分）が大きい。GCP側はArtifact Registryの保存量とCloud Runの従量のみ。",
      references: [
        { title: "Workload Identity連携", url: "https://cloud.google.com/iam/docs/workload-identity-federation?hl=ja", note: "キーレス認証の公式解説" },
        { title: "Artifact Registryの概要", url: "https://cloud.google.com/artifact-registry/docs/overview?hl=ja" }
      ]
    },
    {
      name: "Cloud Runソースデプロイ（最小構成）",
      when: "個人開発や環境が1つだけの立ち上げ期で、とにかく最短でデプロイの自動化を始めたい場合",
      diagram: {
        cols: 3, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [2, 1] }
        ],
        nodes: [
          { id: "dev", icon: "client/developer", label: "開発者", col: 0, row: 1 },
          { id: "ar", icon: "devtools/artifact-registry", label: "Artifact Registry\n自動で利用", col: 1, row: 0 },
          { id: "build", icon: "devtools/cloud-build", label: "Cloud Build\n自動ビルド", col: 1, row: 1 },
          { id: "run", icon: "compute/cloud-run", label: "Cloud Run\n本番環境", col: 2, row: 1 }
        ],
        edges: [
          { from: "dev", to: "build", label: "ソースを送信" },
          { from: "build", to: "run", label: "そのままデプロイ" },
          { from: "build", to: "ar", noArrow: true, dashed: true }
        ]
      },
      flow: [
        "開発者がソースデプロイのコマンドを1回実行すると、ソースコードがCloud Buildへ送られる",
        "Dockerfileが無くてもBuildpacks（言語を自動判別してコンテナ化する仕組み）がイメージを作り、Artifact Registryへ自動で格納される",
        "ビルドされたイメージがそのままCloud Runへデプロイされる。リポジトリ連携のトリガーを設定すればpush起点の自動化もできる"
      ],
      services: [
        { icon: "devtools/cloud-build", name: "Cloud Build", role: "コマンドの裏で自動的に動くビルド役。利用者はyamlを書かずに済む" },
        { icon: "devtools/artifact-registry", name: "Artifact Registry", role: "自動作成されるイメージの置き場。意識せずに使われる" },
        { icon: "compute/cloud-run", name: "Cloud Run", role: "デプロイ先。リビジョンが残るためロールバックは可能" }
      ],
      points: [
        "コマンド1つの裏で「ビルド→保管→デプロイ」という推奨構成と同じ流れが動いている。仕組みが隠れているだけで、部品は同じ",
        "テストの強制や承認フローは無い。人が増えてレビューや検証が必要になった時点で、トリガー化とCloud Deploy導入へ段階的に育てる",
        "最初からこの形で始めておけば、後からの本格化はcloudbuild.yamlを書き足すだけで済む"
      ],
      pros: [
        "コマンド1つで今日から使え、覚えることが最少",
        "Dockerfileすら不要で言語ランタイムの知識だけで始められる"
      ],
      cons: [
        "テスト実行や承認の強制が無く、品質は運用者の自制に依存する",
        "環境が増えると管理しきれず、結局パイプラインの整備が必要になる"
      ],
      cost: "<strong>月0円〜数百円</strong>。ビルド時間とイメージ保存量の従量課金のみで、無料枠内に収まることが多い。",
      references: [
        { title: "ソースコードからのデプロイ", url: "https://cloud.google.com/run/docs/deploying-source-code?hl=ja" },
        { title: "Cloud Buildによる継続的デプロイ", url: "https://cloud.google.com/run/docs/continuous-deployment-with-cloud-build?hl=ja", note: "リポジトリ連携で自動化する次の一歩" }
      ]
    }
  ],
  cost: "<p>推奨構成でも<strong>月数百円〜数千円程度</strong>と、CI/CDはGCPの中でも特に安い領域です。GitHub Actions案は無料枠が大きく<strong>月0円〜数千円</strong>、ソースデプロイは<strong>ほぼ0円</strong>。費用よりも「チームの習熟」と「承認フローの必要性」で選ぶ判断になります。</p>",
  summary: "<p>CI/CDの本質は自動化そのものより、<strong>テストを通ったものだけが決まった順序で本番に出ることを仕組みで強制する</strong>点にあります。作る工程（Cloud Build）と配る工程（Cloud Deploy）を分けるのは、後者にだけ承認という人の判断を挟むため。検証で動いた同一イメージをそのまま昇格させる原則と、シークレットをコードから分離する原則は、どのCIツールを選んでも変わりません。パイプライン定義をコードで持つ発想は、ケース44のIaCへそのままつながります。</p>",
  quiz: [
    {
      q: "検証環境で動作確認したあと、本番用にもう一度ビルドし直すのではなく「同じイメージをそのまま昇格」させるのはなぜでしょうか。",
      a: "再ビルドすると、依存ライブラリの新バージョン混入やビルド環境の差で、検証したものと微妙に違う成果物が本番へ出るリスクがあるからです。検証の目的は「このイメージなら安全」と確認することなので、確認済みのイメージ自体を昇格させて初めて検証に意味が出ます。これを支えるのがコミットハッシュ付きの不変タグで、latestタグ運用ではどの検証がどのイメージに対応するか追えなくなります。"
    },
    {
      q: "APIキーを暗号化してGitリポジトリに置く方式や、CIの環境変数に直接書く方式と比べて、Secret Managerを使う利点は何でしょうか。",
      a: "アクセス制御と監査と更新の3点で優れています。IAMで「どのサービスアカウントがどの秘密を読めるか」を細かく制限でき、いつ誰が読んだかのログも残ります。またキーのローテーション（定期更新）をバージョン管理付きで行え、アプリ側は最新バージョン参照のままで済みます。リポジトリに置く方式は複製が無限に増えて回収不能になり、漏えい時の影響範囲も特定できません。"
    },
    {
      q: "本番リリース直後に障害が発生し、直近のリリースが原因と疑われます。あなたはまず何をしますか。",
      a: "まずCloud Deployで1つ前のリリースへロールバックし、サービスを復旧させます。Cloud Runはリビジョンが残っているため切り戻しは数分で完了します。原因調査は復旧後に、残っているイメージとコミットハッシュから該当変更を特定して行います。復旧より先に原因調査を始めて障害時間を延ばすのが典型的な失敗パターンで、即座に戻せる仕組みを平時に作っておくことこそCI/CDを整備する最大の理由です。"
    }
  ]
});
