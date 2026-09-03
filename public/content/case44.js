// ケース44：IaCと環境分離
registerCase({
  id: 44,
  category: "運用・セキュリティ・信頼性",
  title: "IaCと環境分離",
  scenario: "<p>事業の拡大でGCPの利用が増え、開発・検証・本番の3環境をコンソールの手作業で構築してきた会社。「本番だけ設定が微妙に違う」ことが原因の障害が起き、新メンバー向け環境の払い出しにも数日かかっています。インフラをコードで管理するIaC（Infrastructure as Code）を導入し、<strong>同じコードから3環境を再現できる状態</strong>と、<strong>本番への変更はレビューと承認を経る流れ</strong>を作ります。ツールは業界標準のTerraform（インフラをコードで宣言するOSS）を使います。</p>",
  requirements: [
    "開発・検証・本番の3環境を同じコードから再現できること",
    "環境ごとの差分は変数（マシンサイズ・台数など）だけに閉じ込めたい",
    "本番への適用はレビューと承認を経ること",
    "環境ごとに触れる人とサービスアカウントの権限を分けたい",
    "手作業変更によるコードと実態のずれ（ドリフト）を検出したい"
  ],
  main: {
    name: "Infrastructure Manager+環境別プロジェクト構成",
    diagram: {
      cols: 5, rows: 3,
      groups: [
        { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [4, 2] },
        { type: "project", label: "開発プロジェクト", from: [4, 0], to: [4, 0], depth: 1 },
        { type: "project", label: "検証プロジェクト", from: [4, 1], to: [4, 1], depth: 1 },
        { type: "project", label: "本番プロジェクト", from: [4, 2], to: [4, 2], depth: 1 }
      ],
      nodes: [
        { id: "dev", icon: "client/developer", label: "開発者\nTerraformを記述", col: 0, row: 1 },
        { id: "rm", icon: "ops/resource-manager", label: "Resource Manager\n階層管理", col: 1, row: 0 },
        { id: "build", icon: "devtools/cloud-build", label: "Cloud Build\nCIで実行", col: 1, row: 1 },
        { id: "gcs", icon: "storage/cloud-storage", label: "Cloud Storage\nstate保管", col: 2, row: 0 },
        { id: "im", icon: "devtools/infra-manager", label: "Infrastructure\nManager", col: 2, row: 1 },
        { id: "iam", icon: "security/iam", label: "IAM\n環境別の権限", col: 3, row: 0 },
        { id: "resDev", icon: "compute/cloud-run", label: "開発環境\nリソース一式", col: 4, row: 0 },
        { id: "resStg", icon: "compute/cloud-run", label: "検証環境\nリソース一式", col: 4, row: 1 },
        { id: "resProd", icon: "compute/cloud-run", label: "本番環境\nリソース一式", col: 4, row: 2 }
      ],
      edges: [
        { from: "dev", to: "build", label: "PRマージで実行" },
        { from: "build", to: "im", label: "適用を依頼" },
        { from: "im", to: "resDev", label: "開発へapply" },
        { from: "im", to: "resStg", label: "検証へapply" },
        { from: "im", to: "resProd", label: "承認後に本番へ" },
        { from: "gcs", to: "im", noArrow: true, dashed: true },
        { from: "rm", to: "im", noArrow: true, dashed: true },
        { from: "iam", to: "im", noArrow: true, dashed: true }
      ]
    },
    flow: [
      "開発者がTerraformコードを修正してPull Requestを作る。CIが適用予定の差分（plan）を自動でコメントし、レビュアーは差分を見て承認する",
      "マージされるとCloud BuildがInfrastructure Managerへ適用を依頼する",
      "Infrastructure ManagerがマネージドなTerraform実行環境でapplyを行い、環境ごとのプロジェクトにリソースを作成・更新する。stateファイルはCloud Storageに保管される",
      "本番プロジェクトへの適用だけは、追加の承認ステップを挟んでから実行する",
      "IAMで環境ごとに操作できる人とサービスアカウントを分け、人が直接コンソールで変更しない運用に寄せる"
    ],
    services: [
      { icon: "devtools/infra-manager", name: "Infrastructure Manager", role: "Terraformの実行環境とstate管理をマネージドで提供するサービス。自前でTerraformを動かす場合の実行基盤運用を肩代わりする" },
      { icon: "ops/resource-manager", name: "Resource Manager", role: "組織・フォルダ・プロジェクトの階層を管理する。環境をプロジェクト単位で分ける土台" },
      { icon: "devtools/cloud-build", name: "Cloud Build", role: "PRのplan実行とマージ後のapply依頼を担うCI。人の手元からのapplyを廃止する要" },
      { icon: "storage/cloud-storage", name: "Cloud Storage", role: "stateファイル（コードと実際のリソースの対応表）の保管庫。バージョニングで誤消去にも備える" },
      { icon: "security/iam", name: "IAM", role: "環境ごとに人とサービスアカウントの権限を分離する。開発者は本番を直接触れない構成にする" },
      { icon: "compute/cloud-run", name: "各環境のリソース一式", role: "Terraformが作る中身の代表例。Cloud RunやCloud SQL、VPCなどアプリに必要な一式が同じコードから生成される" }
    ],
    points: [
      "環境をプロジェクト単位で分けるのがGCPの定石。プロジェクトは課金・IAM・クォータの境界なので、開発環境の事故や課金暴走が本番へ波及しない最も強い分離になる。ケース37の組織統制の土台でもある",
      "Infrastructure Managerを使うと、Terraformの実行環境・stateの置き場所・実行履歴の管理をマネージドに任せられる。自前運用（代替パターン参照）との違いは運用責任の所在",
      "環境差分はtfvars（変数ファイル）だけに閉じ込め、リソース定義本体は3環境で共通にする。ここが崩れると「本番だけ違う」問題が再発する",
      "定期的にplanを実行して差分ゼロを確認する。手作業変更（ドリフト）を見つけたら、コードへ取り込むか巻き戻すかを必ず判断し、放置しない"
    ],
    pros: [
      "環境の再現がコマンド1つになり、新環境の払い出しが数日から数十分になる",
      "インフラ変更がPRでレビュー可能になり、設定ミスの事故が減る",
      "本番と検証の構成ずれが構造的に起きにくくなる",
      "変更履歴がGitに残り、監査や障害調査に強くなる"
    ],
    cons: [
      "TerraformとHCL（その記述言語）の学習コストが高く、チーム全員への展開に時間がかかる",
      "既存の手作業リソースをコード管理へ取り込む作業（import）が地道で根気が要る",
      "stateやモジュールの設計を誤ると、かえって変更が怖い資産になる"
    ],
    cost: "<strong>月数百円〜数千円程度</strong>（東京リージョン・1USD=150円換算）。Infrastructure Managerは適用実行時間に応じた少額の従量課金、Cloud Buildはビルド時間の従量で無料枠あり、stateのCloud Storageは数円規模。プロジェクトの作成自体は無料で、費用の本体は各環境の中で動かすリソース次第です。",
    references: [
      { title: "Infrastructure Managerの概要", url: "https://cloud.google.com/infrastructure-manager/docs/overview?hl=ja" },
      { title: "Google CloudでのTerraform", url: "https://cloud.google.com/docs/terraform?hl=ja" },
      { title: "Terraformのベストプラクティス", url: "https://cloud.google.com/docs/terraform/best-practices-for-terraform?hl=ja", note: "環境分離やstate管理の公式指針" },
      { title: "リソース階層", url: "https://cloud.google.com/resource-manager/docs/cloud-platform-resource-hierarchy?hl=ja", note: "組織・フォルダ・プロジェクトの考え方" },
      { title: "IAMの概要", url: "https://cloud.google.com/iam/docs/overview?hl=ja" }
    ]
  },
  alternatives: [
    {
      name: "Cloud BuildでTerraformを直接実行",
      when: "Terraformのバージョンや実行ワークフローを細かく制御したい、既存のTerraform資産とCI設定が大きい場合",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [3, 1] },
          { type: "project", label: "開発プロジェクト", from: [3, 0], to: [3, 0], depth: 1 },
          { type: "project", label: "本番プロジェクト", from: [3, 1], to: [3, 1], depth: 1 }
        ],
        nodes: [
          { id: "dev", icon: "client/developer", label: "開発者", col: 0, row: 1 },
          { id: "gcs", icon: "storage/cloud-storage", label: "Cloud Storage\nstateバケット", col: 1, row: 0 },
          { id: "build", icon: "devtools/cloud-build", label: "Cloud Build\nterraform実行", col: 1, row: 1 },
          { id: "resDev", icon: "compute/cloud-run", label: "開発環境一式", col: 3, row: 0 },
          { id: "resProd", icon: "compute/cloud-run", label: "本番環境一式", col: 3, row: 1 }
        ],
        edges: [
          { from: "dev", to: "build", label: "PRマージで実行" },
          { from: "build", to: "resDev", label: "開発へapply" },
          { from: "build", to: "resProd", label: "承認後に本番へ" },
          { from: "gcs", to: "build", noArrow: true, dashed: true }
        ]
      },
      flow: [
        "Cloud Buildのビルドステップ内でterraformコマンドを直接実行する",
        "stateは自前で用意したCloud Storageバケットに保存する。バージョニングを有効化し、ロック設定も自分で管理する",
        "PRでplan、マージでapplyという流れは推奨構成と同じ。本番向けは承認付きトリガーで分ける"
      ],
      services: [
        { icon: "devtools/cloud-build", name: "Cloud Build", role: "Terraformの実行環境そのもの。バージョン固定やツール追加を自由に構成できる" },
        { icon: "storage/cloud-storage", name: "Cloud Storage", role: "自前管理のstateバケット。権限設計・バージョニング・ロックの面倒を自分で見る" },
        { icon: "compute/cloud-run", name: "各環境のリソース一式", role: "Terraformが管理する対象" }
      ],
      points: [
        "実行環境を自分で持つぶん自由度が高く、tflintやポリシーチェックなどOSSツールをパイプラインに組み込みやすい",
        "その代わりstateバケットの権限設計・ロック・Terraform本体の更新をすべて自分で運用する責任が生じる",
        "Infrastructure Managerも内部ではTerraformを使うため、この方式から推奨構成への移行は後からでも可能"
      ],
      pros: [
        "ワークフローを完全に制御でき、OSSエコシステムを活かせる",
        "既存のTerraform資産・CI設定をほぼそのまま流用できる"
      ],
      cons: [
        "state管理と実行環境の運用責任をすべて自分で負う",
        "強い権限を持つサービスアカウントをCIに渡すため、権限設計をより慎重にする必要がある"
      ],
      cost: "<strong>月数百円程度</strong>。Cloud Buildのビルド時間とstateバケットの保存料のみ。",
      references: [
        { title: "Google CloudでのTerraform", url: "https://cloud.google.com/docs/terraform?hl=ja" },
        { title: "Terraformのベストプラクティス", url: "https://cloud.google.com/docs/terraform/best-practices-for-terraform?hl=ja" },
        { title: "Cloud Storageの概要", url: "https://cloud.google.com/storage/docs/introduction?hl=ja" }
      ]
    },
    {
      name: "単一プロジェクト+命名による環境分離",
      when: "個人開発〜2人規模で、プロジェクト分割の管理負荷をまだ払いたくない場合",
      diagram: {
        cols: 3, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [2, 1] }
        ],
        nodes: [
          { id: "dev", icon: "client/developer", label: "開発者", col: 0, row: 1 },
          { id: "build", icon: "devtools/cloud-build", label: "Cloud Build\nデプロイ", col: 1, row: 1 },
          { id: "runDev", icon: "compute/cloud-run", label: "app-dev\n開発用サービス", col: 2, row: 0 },
          { id: "runProd", icon: "compute/cloud-run", label: "app-prod\n本番サービス", col: 2, row: 1 }
        ],
        edges: [
          { from: "dev", to: "build", label: "push" },
          { from: "build", to: "runDev", label: "開発用へ" },
          { from: "build", to: "runProd", label: "本番へ" }
        ]
      },
      flow: [
        "1つのプロジェクト内に、サービス名のサフィックス（-devと-prod）で開発用と本番用のリソースを並べる",
        "デプロイはCloud Buildで自動化し、対象サービス名を切り替えるだけにする",
        "課金の内訳はリソースのラベルで区別する"
      ],
      services: [
        { icon: "devtools/cloud-build", name: "Cloud Build", role: "両環境へのデプロイ役" },
        { icon: "compute/cloud-run", name: "Cloud Run（命名で分離）", role: "同一プロジェクト内に環境別の名前で並ぶサービス群" }
      ],
      points: [
        "IAM・課金・クォータの境界が無い分離であることを自覚して使う。開発用リソースの事故が本番に波及しうるトレードオフを受け入れる判断",
        "この段階でもIaC化だけは先にやっておくと、後のプロジェクト分離がコードの変数変更で済む",
        "メンバーが増えて権限を分けたくなった瞬間が、プロジェクト分離（推奨構成）へ移行するタイミング"
      ],
      pros: [
        "管理対象が1プロジェクトで身軽。設定も課金確認も1か所",
        "追加費用ゼロで今すぐ始められる"
      ],
      cons: [
        "権限・課金・クォータが混ざり、本番の保護が弱い",
        "開発用の負荷試験が本番のクォータを食い潰すような事故が起こりうる"
      ],
      cost: "<strong>追加費用なし</strong>。リソース自体の費用のみ。プロジェクト分割してもプロジェクト自体は無料なので、費用面の差はほぼない。",
      references: [
        { title: "リソース階層", url: "https://cloud.google.com/resource-manager/docs/cloud-platform-resource-hierarchy?hl=ja" },
        { title: "IAMの概要", url: "https://cloud.google.com/iam/docs/overview?hl=ja" }
      ]
    }
  ],
  cost: "<p>IaCの仕組み自体の費用は<strong>どの構成でも月数百円〜数千円程度</strong>とごく小さく、費用の本体は各環境で動かすリソースです。プロジェクト分割も無料。つまりこのケースの選択は費用ではなく、<strong>運用責任をどこまでマネージドに任せるか</strong>（Infrastructure Manager対自前Terraform）と、<strong>分離の強さをどこまで求めるか</strong>（プロジェクト分離対命名分離）の2軸で決まります。</p>",
  summary: "<p>IaCの価値は自動化そのものより、<strong>インフラの変更がレビューできるようになる</strong>ことと、<strong>環境を同じコードから再現できる</strong>ことにあります。GCPで環境分離といえばプロジェクト分割が定石で、課金・IAM・クォータの境界という強い分離が無料で手に入ります。stateファイルは実態とコードの対応表であり、これを安全に保管し人の手作業を排除していく設計が成否を分けます。組織全体の統制はケース37、アプリのCI/CDはケース43と地続きの内容です。</p>",
  quiz: [
    {
      q: "開発・検証・本番を同一プロジェクト内の命名で分けず、プロジェクトごと分けるのはなぜでしょうか。GCPならではの理由を挙げてください。",
      a: "GCPではプロジェクトが課金・IAM・クォータの境界だからです。プロジェクトを分ければ、開発者に本番プロジェクトの権限を与えない、開発の負荷試験が本番のクォータを消費しない、環境ごとの費用が請求書レベルで分かれる、といった分離が構造的に手に入ります。同一プロジェクト内の命名分離ではこれらがすべて運用ルール頼みになり、ミス1つで本番に波及します。プロジェクト自体は無料なので、分けない理由は管理の手間だけです。"
    },
    {
      q: "Terraformのstateファイルをローカルパソコンに置いたまま複数人で運用すると、どんな問題が起きるでしょうか。",
      a: "stateはコードと実リソースの対応表なので、各自のローカルにあると他人の適用結果を知らないまま古い対応表でapplyしてしまい、リソースの二重作成や意図しない削除が起きます。同時実行の衝突を防ぐロックも効きません。またstateには接続情報などの機微な値が含まれることがあり、紛失・漏えいのリスクも大きい。だからバージョニング付きのCloud Storageなど共有バケットに置き、CI経由でのみ触るのが原則です。"
    },
    {
      q: "定期実行しているplanで、本番環境に「コードに無いファイアウォール規則」が見つかりました。誰かがコンソールで直接追加したようです。あなたならどう対処しますか。",
      a: "まず規則の意図を確認します。障害対応など正当な理由の緊急変更なら、その内容をコードへ取り込んでPRにし、正史をコード側に戻します。意図が不明または不要なら、コードからapplyして巻き戻します。放置するとコードと実態のずれが拡大し、IaCへの信頼が崩れていきます。あわせて、コンソールで直接変更できる権限を絞る、緊急変更時は事後PRを必須にするなど、再発を仕組みで防ぐところまでが対処です。"
    }
  ]
});
