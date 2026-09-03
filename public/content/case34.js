// ケース34：オンプレからのリフト移行
registerCase({
  id: 34,
  category: "社内・閉域・ハイブリッド",
  title: "オンプレからのリフト移行",
  scenario: "<p>創業20年の企業で、データセンターの契約が1年後に満了します。更新はせず、クラウドへ全面移行する方針が決まりました。オンプレのVMware上にはWebサーバー・業務アプリ・ファイル連携などのVMが20台あり、DBはMySQLです。アプリを保守するベンダーは改修に消極的で、作り直している時間もありません。まず「動いているまま」GCPへ引っ越すこと（リフト&シフト）が最優先です。</p>",
  requirements: [
    "1年以内に全システムをデータセンターから退去させる（期限厳守）",
    "アプリの改修はしない・最小限にとどめる",
    "移行作業中も業務は止めない（切替時の停止は数時間まで）",
    "DBだけは運用負荷を下げたい（パッチ・バックアップの自動化）",
    "移行後にクラウド最適化を進められる下地は残したい"
  ],
  main: {
    name: "Migrate to Virtual Machinesによる無停止リフト移行",
    diagram: {
      cols: 5, rows: 3,
      groups: [
        { type: "onpremise", label: "オンプレDC", from: [0, 0], to: [0, 2] },
        { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [4, 2] },
        { type: "vpc", label: "VPCネットワーク", from: [3, 1], to: [4, 2], depth: 1 }
      ],
      nodes: [
        { id: "vmw", icon: "client/onprem-server", label: "既存VM群\n20台", col: 0, row: 1 },
        { id: "dbsrc", icon: "client/onprem-server", label: "オンプレDB\nMySQL", col: 0, row: 2 },
        { id: "vpn", icon: "network/cloud-vpn", label: "Cloud VPN\n移行経路", col: 1, row: 1 },
        { id: "m2vm", icon: "compute/migrate-to-vms", label: "M2VM\n継続レプリケート", col: 2, row: 1 },
        { id: "gce", icon: "compute/compute-engine", label: "GCE\n移行先VM", col: 3, row: 1 },
        { id: "nat", icon: "network/cloud-nat", label: "Cloud NAT\n外向き出口", col: 4, row: 1 },
        { id: "sql", icon: "database/cloud-sql", label: "Cloud SQL\n移行先DB", col: 3, row: 2 },
        { id: "gcs", icon: "storage/cloud-storage", label: "GCS\nバックアップ", col: 2, row: 0 }
      ],
      edges: [
        { from: "vmw", to: "vpn", label: "複製データ" },
        { from: "vpn", to: "m2vm", label: "差分転送" },
        { from: "m2vm", to: "gce", label: "カットオーバー" },
        { from: "dbsrc", to: "sql", label: "DBは個別移行" },
        { from: "gce", to: "sql", label: "接続先切替" },
        { from: "gce", to: "nat", label: "パッチ取得", dashed: true },
        { from: "gce", to: "gcs", label: "バックアップ", dashed: true }
      ]
    },
    flow: [
      "Cloud VPNで移行用の閉域経路を作り、Migrate to Virtual Machines（M2VM）がオンプレのVMを検出してGCPへのレプリケーション（複製）を開始する",
      "複製はVMを稼働させたまま続く。初回のフル転送のあとは差分だけが流れ続け、業務は止まらない",
      "本番切替の前にテストクローンを起動し、GCP上で正しく動くかを本番に影響なく確認する",
      "切替日はカットオーバーを実行する。最終差分を反映してGCE上でVMを起動し、短い停止時間で移行が完了する",
      "DBはVMごと移行せずCloud SQLへ移す。移行後のVMはパブリックIPを持たせず、外向き通信はCloud NAT経由、バックアップはCloud Storageへ取る"
    ],
    services: [
      { icon: "compute/migrate-to-vms", name: "Migrate to Virtual Machines", role: "オンプレやVMware上のVMを稼働したままGCEへ複製・移行するサービス。利用料は無料" },
      { icon: "compute/compute-engine", name: "Compute Engine", role: "移行先の仮想マシン。オンプレのVMがほぼそのままの姿で動く" },
      { icon: "database/cloud-sql", name: "Cloud SQL", role: "MySQLの移行先。バックアップ・パッチ・フェイルオーバーの自動化で運用負荷を下げる" },
      { icon: "network/cloud-vpn", name: "Cloud VPN", role: "移行データを流す閉域経路。移行後もオンプレ側拠点との接続に使える" },
      { icon: "network/cloud-nat", name: "Cloud NAT", role: "パブリックIPを持たない移行後VMの外向き通信（OSパッチ取得など）の出口" },
      { icon: "storage/cloud-storage", name: "Cloud Storage", role: "移行後VMのバックアップやファイルの退避先" }
    ],
    points: [
      "「改修しながら移行」を選ばなかったのは期限が固定だからです。移行とアプリ改修は失敗の原因が別物で、同時に行うと問題の切り分けができなくなります。動かす変数は一度に1つずつが原則です",
      "例外としてDBだけCloud SQLへ寄せたのは、互換性リスクが小さい割に効果（バックアップ・パッチの自動化）が大きいからです。「全部そのまま」と「全部作り直し」の間に現実解があります",
      "テストクローンでのリハーサルを移行計画に必ず入れます。リフト移行の失敗の多くは「動くと思っていたものが環境差異で動かない」ことが原因で、本番切替当日に初めて気づくのが最悪のパターンです",
      "移行完了はゴールではなくスタートです。VMのままではクラウドの旨味が薄いため、使用率を見た縮小（右サイジング）、確定利用割引、コンテナ化（ケース45）へと段階的に最適化します"
    ],
    pros: [
      "アプリ改修ゼロで移行でき、スケジュールが読みやすい",
      "継続レプリケーションにより切替時の停止が短い",
      "M2VM自体は無料で、移行ツールのコストがかからない"
    ],
    cons: [
      "移行しただけではコストも運用負荷もあまり下がらない（OS保守は続く）",
      "オンプレの過剰なスペックをそのまま持ち込むと割高になる（移行後の右サイジングが必須）",
      "特殊なハードウェアやOSに依存したVMは移行できないことがあり、事前評価が欠かせない"
    ],
    cost: "<strong>VM1台あたり月約7,500円から</strong>（e2-standard-2相当）が目安で、20台なら月15万円前後+ディスク代です。これにCloud SQL（2vCPU）月約1.5万円、Cloud VPN月約1.1万円が加わります。移行後に右サイジングと確定利用割引（CUD）を適用すると2〜4割の削減余地があるのが一般的です。※東京リージョン・1USD=150円換算の概算。M2VMの利用自体は無料。",
    references: [
      { title: "Migrate to Virtual Machinesのドキュメント", url: "https://cloud.google.com/migrate/virtual-machines/docs?hl=ja" },
      { title: "移行の仕組み（M2VM）", url: "https://cloud.google.com/migrate/virtual-machines/docs/5.0/get-started/how-migration-works?hl=ja", note: "レプリケーション〜カットオーバーの流れ" },
      { title: "Google Cloudへの移行スタートガイド", url: "https://cloud.google.com/architecture/migration-to-gcp-getting-started?hl=ja", note: "評価・計画・移行・最適化の4フェーズ" },
      { title: "Cloud SQLのインポート/エクスポート", url: "https://cloud.google.com/sql/docs/mysql/import-export?hl=ja", note: "DB移行の基本手段" },
      { title: "Cloud NATの概要", url: "https://cloud.google.com/nat/docs/overview?hl=ja" }
    ]
  },
  alternatives: [
    {
      name: "コンテナ化して載せ替えるモダナイズ移行",
      when: "対象が自社開発のLinuxアプリで、コンテナ化の改修余力があり、移行を機に運用負荷を下げたい場合",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [3, 1] }
        ],
        nodes: [
          { id: "dev", icon: "client/developer", label: "開発者\nコンテナ化改修", col: 0, row: 0 },
          { id: "build", icon: "devtools/cloud-build", label: "Cloud Build\n自動ビルド", col: 1, row: 0 },
          { id: "ar", icon: "devtools/artifact-registry", label: "Artifact Registry\nイメージ保管", col: 2, row: 0 },
          { id: "run", icon: "compute/cloud-run", label: "Cloud Run\n移行先アプリ", col: 3, row: 0 },
          { id: "sql", icon: "database/cloud-sql", label: "Cloud SQL\n移行先DB", col: 3, row: 1 }
        ],
        edges: [
          { from: "dev", to: "build", label: "push" },
          { from: "build", to: "ar", label: "イメージ" },
          { from: "ar", to: "run", label: "デプロイ" },
          { from: "run", to: "sql", label: "接続" }
        ]
      },
      flow: [
        "アプリをコンテナ化（Dockerfile化）し、Cloud Buildでビルドとデプロイを自動化する",
        "イメージをArtifact Registryに置き、Cloud Runへデプロイする",
        "DBはCloud SQLへ移行し、OSの運用そのものをなくす"
      ],
      services: [
        { icon: "devtools/cloud-build", name: "Cloud Build", role: "コンテナ化したアプリのビルド・デプロイの自動化" },
        { icon: "devtools/artifact-registry", name: "Artifact Registry", role: "コンテナイメージの保管庫" },
        { icon: "compute/cloud-run", name: "Cloud Run", role: "移行先の実行環境。OS保守が不要になり、アイドル時はゼロまで縮む" },
        { icon: "database/cloud-sql", name: "Cloud SQL", role: "DBの移行先" }
      ],
      points: [
        "リフトに比べて移行後の運用費・保守負荷が大きく下がりますが、1システムごとに改修とテストが必要で、期限リスクと引き換えです",
        "全システム一括ではなく「相性の良いものだけ先にモダナイズし、残りはリフト」という混合戦略が現実的です",
        "移行後の姿はケース7で学ぶCloud Run中心の定石構成に合流するイメージです"
      ],
      pros: [
        "OS保守が消え、運用負荷とアイドルコストが大きく下がる",
        "CI/CDやオートスケールなどクラウドの利点をすぐ享受できる"
      ],
      cons: [
        "改修・テストの工数がかかり、期限厳守の移行では危険",
        "コンテナ化できないアプリ（Windows GUI・特殊ミドルウェア依存など）には使えない"
      ],
      cost: "稼働後は<strong>月数千円〜</strong>とリフトより大幅に安くなります。ただしコンテナ化の改修にかかる人件費が別途必要で、総額は「何を先にモダナイズするか」の選別で決まります。",
      references: [
        { title: "Cloud Runとは", url: "https://cloud.google.com/run/docs/overview/what-is-cloud-run?hl=ja" },
        { title: "Cloud Buildの概要", url: "https://cloud.google.com/build/docs/overview?hl=ja" }
      ]
    },
    {
      name: "DBもGCEに載せる完全リフト",
      when: "Cloud SQLが対応していないDBエンジンや、バージョン・設定を一切変えられない事情（ベンダーサポート条件など）がある場合",
      diagram: {
        cols: 5, rows: 1,
        groups: [
          { type: "onpremise", label: "オンプレDC", from: [0, 0], to: [0, 0] },
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [4, 0] },
          { type: "vpc", label: "VPC", from: [3, 0], to: [4, 0], depth: 1 }
        ],
        nodes: [
          { id: "vmw", icon: "client/onprem-server", label: "既存VM群\nアプリ+DB", col: 0, row: 0 },
          { id: "vpn", icon: "network/cloud-vpn", label: "Cloud VPN\n移行経路", col: 1, row: 0 },
          { id: "m2vm", icon: "compute/migrate-to-vms", label: "M2VM\n継続レプリケート", col: 2, row: 0 },
          { id: "gce", icon: "compute/compute-engine", label: "GCE\nアプリVM", col: 3, row: 0 },
          { id: "dbvm", icon: "compute/compute-engine", label: "GCE\nDBもVMのまま", col: 4, row: 0 }
        ],
        edges: [
          { from: "vmw", to: "vpn", label: "複製データ" },
          { from: "vpn", to: "m2vm", label: "差分転送" },
          { from: "m2vm", to: "gce", label: "カットオーバー" },
          { from: "gce", to: "dbvm", label: "SQL" }
        ]
      },
      flow: [
        "アプリVMと同じように、DBサーバーもM2VMでGCEへ複製してカットオーバーする",
        "移行後もDBはVM上で動き続け、バックアップ・パッチ・冗長化は自前で運用する",
        "アプリからの接続先はVPC内のDB VMの内部IPに切り替える"
      ],
      services: [
        { icon: "compute/migrate-to-vms", name: "Migrate to Virtual Machines", role: "アプリVMもDB VMもまとめて複製・移行する" },
        { icon: "compute/compute-engine", name: "Compute Engine", role: "アプリとDBの両方の移行先。DBのメモリ要件に合わせた機種を選ぶ" },
        { icon: "network/cloud-vpn", name: "Cloud VPN", role: "移行データを流す閉域経路" }
      ],
      points: [
        "「動くこと」を最優先する判断です。DBの動作条件を一切変えないため、移行そのもののリスクは最小になります",
        "引き換えに、バックアップ・HA・パッチをすべて自前で組むことになります。Cloud SQLが標準でやってくれることの価値を、移行後の運用で実感しがちです",
        "落ち着いた後にCloud SQLやAlloyDBへ移す2段階目の計画を、最初からロードマップに残しておくのがおすすめです"
      ],
      pros: [
        "DBの互換性リスクがゼロで、ベンダーサポートの条件も維持できる",
        "移行の段取りがアプリVMと共通化でき、計画が単純になる"
      ],
      cons: [
        "DB運用（バックアップ・HA・パッチ）の負荷が丸ごと残る",
        "自前でCloud SQL相当の自動運用を組むと、その構築・維持の人件費が隠れコストになる"
      ],
      cost: "DB用VM（メモリ重視のe2-highmem-2相当）で<strong>月約1.3万円から</strong>+ディスク代が目安です。アプリVMのコストは推奨構成と同じで、差は「DB運用を人手で担う」運用コストに現れます。",
      references: [
        { title: "Migrate to Virtual Machinesのドキュメント", url: "https://cloud.google.com/migrate/virtual-machines/docs?hl=ja" },
        { title: "Compute Engineの概要", url: "https://cloud.google.com/compute/docs/overview?hl=ja" }
      ]
    }
  ],
  cost: "<p>推奨構成は<strong>VM20台+Cloud SQLで月17万〜20万円前後</strong>が目安です。完全リフト案はCloud SQL分がDB VM代に置き換わりほぼ同額ですが、DB運用の人件費が加わります。モダナイズ案は稼働後のインフラ費が最も安いものの、改修工数が先行投資になります。どの案でも移行後の右サイジングと確定利用割引で2〜4割の削減余地が残っています。※東京リージョン・1USD=150円前後の概算。</p>",
  summary: "<p>リフト移行の本質は<strong>「スコープを削る勇気」</strong>です。期限が固定なら動かす変数を減らし、まず動く状態でクラウドへ移り、最適化は移行後に段階的に進めます。判断の分かれ目は、DBがCloud SQLに乗るか（乗るなら運用自動化の効果が大きいDBだけは寄せる）、アプリに改修余力があるか（あるものだけモダナイズ）です。移行経路の設計はケース33、移行後にCloud RunとGKEのどちらへ進むかの判断はケース45で扱います。</p>",
  quiz: [
    {
      q: "「せっかく移行するなら、ついでにアプリもコンテナ化して作り直そう」という提案が社内から出ました。期限1年の本ケースでこの提案に乗るべきでしょうか。",
      a: "原則として乗るべきではありません。移行の失敗要因（環境差異・ネットワーク）と改修の失敗要因（バグ・仕様漏れ）は別物で、同時に変えると問題の切り分けができず、期限リスクが跳ね上がります。まず動いているままリフトして退去期限を確実に守り、モダナイズは移行後に相性の良いシステムから段階的に行うのが定石です。どうしても改修したいものがあるなら、全体ではなく少数に絞って混合戦略にします。"
    },
    {
      q: "M2VMの「継続レプリケーション」と「テストクローン」は、それぞれ移行のどんなリスクを下げているのでしょうか。",
      a: "継続レプリケーションは、稼働中のVMの差分を転送し続けることで、切替時の停止時間を数時間規模から最小限に抑え、「業務を止めない」要件に応えます。テストクローンは、本番へ影響を与えずにGCP上で複製VMを起動して動作確認できる仕組みで、「移行してみたら動かなかった」という環境差異の問題をカットオーバー前に洗い出せます。停止時間のリスクと動作互換のリスクを、別々の仕組みで潰しているのがポイントです。"
    },
    {
      q: "移行が無事完了しました。あなたなら最初の3か月でどんなクラウド最適化に着手しますか。",
      a: "まず監視データを根拠にした右サイジングです。オンプレの余裕を見込んだ過剰スペックを実際の使用率に合わせて縮めるのが、リスクが小さく効果の大きい第一手です。あわせて稼働が読めるVMに確定利用割引を適用し、バックアップと監視の整備を確認します。そのうえでコンテナ化しやすいアプリを選び、ケース45の判断軸でCloud RunやGKEへの段階的なモダナイズを計画します。移行直後のVM構成は「仮の姿」と捉えるのが大切です。"
    }
  ]
});
