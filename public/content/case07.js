// ケース7：スタートアップMVP
registerCase({
  id: 7,
  category: "Webアプリ・EC",
  title: "スタートアップMVP",
  scenario: "<p>2人のエンジニアが3か月でWebサービスのMVP（Minimum Viable Product：仮説検証のための最小限の製品）を立ち上げます。ユーザー登録・投稿・一覧表示という標準的なWebアプリで、トラフィックはまったく読めません。0かもしれないし、SNSで話題になって突然跳ねるかもしれません。資金は限られており、使われていない時間のサーバー代は1円でも惜しい状況です。GCPの第一定石「Cloud Run中心」の入門ケースです。</p>",
  requirements: [
    "最小の初期コストで始めたい（アイドル時はほぼゼロが理想）",
    "アクセスが突然増えても自動で耐えてほしい",
    "サーバーの構築・パッチ当てに時間を使いたくない",
    "デプロイはgit pushで完結させたい（手作業デプロイは事故のもと）",
    "DBパスワードなどの秘密情報をコードに書き込みたくない",
    "将来の機能追加・スケールに素直に進化できる構成にしたい"
  ],
  main: {
    name: "Cloud Run+Cloud SQL構成（GCPの第一定石）",
    diagram: {
      cols: 5, rows: 3,
      groups: [
        { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [4, 2] }
      ],
      nodes: [
        { id: "dev", icon: "client/developer", label: "開発者", col: 0, row: 0 },
        { id: "users", icon: "client/users", label: "ユーザー", col: 0, row: 1 },
        { id: "build", icon: "devtools/cloud-build", label: "Cloud Build\nCI/CD", col: 1, row: 0 },
        { id: "secret", icon: "security/secret-manager", label: "Secret Manager\nDB接続情報", col: 2, row: 0 },
        { id: "run", icon: "compute/cloud-run", label: "Cloud Run\nアプリ本体", col: 2, row: 1 },
        { id: "log", icon: "ops/cloud-logging", label: "Cloud Logging\nログ自動収集", col: 2, row: 2 },
        { id: "gcs", icon: "storage/cloud-storage", label: "Cloud Storage\n画像・ファイル", col: 3, row: 2 },
        { id: "sql", icon: "database/cloud-sql", label: "Cloud SQL\nPostgreSQL", col: 4, row: 1 }
      ],
      edges: [
        { from: "dev", to: "build", label: "git push" },
        { from: "build", to: "run", label: "自動デプロイ" },
        { from: "users", to: "run", label: "HTTPS" },
        { from: "run", to: "sql", label: "SQL" },
        { from: "run", to: "gcs", label: "ファイル保存" },
        { from: "secret", to: "run", dashed: true },
        { from: "run", to: "log", dashed: true }
      ]
    },
    flow: [
      "開発者がGitリポジトリにpushすると、Cloud Buildが検知してコンテナをビルドし、Cloud Runへ自動デプロイします",
      "ユーザーはCloud Runが標準で発行するHTTPSのURL（独自ドメインも割り当て可能）へ直接アクセスします",
      "Cloud Runはリクエスト量に応じてコンテナを0台から数百台まで自動で増減させます。アクセスがなければ0台になり、課金も止まります",
      "データはCloud SQL（PostgreSQL）へ、ユーザーがアップロードした画像はCloud Storageへ保存します",
      "DBパスワードはSecret Managerから起動時に注入し（図の破線）、アプリのログは何もしなくてもCloud Loggingに集まります"
    ],
    services: [
      { icon: "compute/cloud-run", name: "Cloud Run", role: "コンテナを渡すだけでHTTPS・自動スケール・ゼロスケールまで面倒を見るサーバーレス実行基盤。GCPでWebアプリを作るときの第一候補" },
      { icon: "database/cloud-sql", name: "Cloud SQL", role: "マネージドなリレーショナルDB。バックアップ・パッチはGoogle任せ。最小インスタンスから始めて後で増強できる" },
      { icon: "storage/cloud-storage", name: "Cloud Storage", role: "画像などのファイル置き場。コンテナ内のディスクは再起動で消えるため、ファイルは必ずここに出す" },
      { icon: "devtools/cloud-build", name: "Cloud Build", role: "git push駆動のビルド・デプロイ自動化。無料枠（1日120分）内でMVPには十分" },
      { icon: "security/secret-manager", name: "Secret Manager", role: "DBパスワードやAPIキーの金庫。コードやリポジトリに秘密情報を置かないための部品" },
      { icon: "ops/cloud-logging", name: "Cloud Logging", role: "標準出力に書いたログを自動収集。障害時に「ログがどこにもない」を防ぐ" }
    ],
    points: [
      "ロードバランサが図に無いのは省略ではありません。Cloud Runは単体でHTTPSつきの公開URLを持つため、MVP段階ではLBが不要です。CDNやWAF（ケース8で登場）が必要になったときに前段へ足します",
      "VPCやCloud NATも登場しません。全部品がGoogle運用のマネージドサービスで、自前ネットワークを作る必要がないためです。Cloud SQLへの接続も専用の接続機能で線1本になります",
      "「使った分だけ課金」のCloud Runに対し、Cloud SQLだけは常時起動の固定費です。ここが月額の下限を決めるため、最小インスタンスで始めます。DBまで従量にしたい場合は代替パターンのFirestore案を検討します",
      "コールドスタート（0台からの起動で最初の1リクエストに数秒かかる現象）はMVPでは許容します。困る段階になったら最小インスタンス数を1にして回避できますが、そのぶん固定費が発生します"
    ],
    pros: [
      "アイドル時のコストがほぼCloud SQL分だけ。完全に使われなくても月2,000円前後で維持できる",
      "バズってもCloud Runが自動スケールで受け止める。事前のキャパシティ設計が不要",
      "コンテナベースなので、成長後にGKE移行（ケース45）やマルチリージョン化（ケース6）へ素直に進化できる",
      "CI/CD・秘密情報管理・ログ収集という「後回しにされがちな土台」が最初から入っている"
    ],
    cons: [
      "コールドスタートで初回アクセスが数秒遅れることがある",
      "Cloud SQLの最小インスタンスは性能が低く、同時接続数の上限にも早く当たる（成長したら増強が必要）",
      "WebSocketの長時間接続やバックグラウンド常駐処理はCloud Runの不得意分野（要件に出てきたら構成の見直しを検討）"
    ],
    cost: "<strong>月2,000円〜1万円程度</strong>。内訳はCloud SQLの最小構成（共有コアインスタンス+ストレージで月1,500円前後〜）が土台で、Cloud Runは無料枠（月200万リクエスト等）内に収まることが多く、Cloud Storage・Cloud Build・Secret Managerも小規模なら数十円〜数百円です。ユーザーが増えたらCloud SQLの増強分から費用が伸びていきます。東京リージョン・1USD=150円前後の概算です。",
    references: [
      { title: "Cloud Runとは", url: "https://cloud.google.com/run/docs/overview/what-is-cloud-run?hl=ja", note: "公式のコンセプト解説" },
      { title: "Cloud SQLの概要", url: "https://cloud.google.com/sql/docs/introduction?hl=ja" },
      { title: "Cloud RunからCloud SQLへ接続する", url: "https://cloud.google.com/sql/docs/mysql/connect-run?hl=ja", note: "線1本の裏側にある接続方法の公式ガイド" },
      { title: "Cloud Buildの概要", url: "https://cloud.google.com/build/docs/overview?hl=ja" },
      { title: "Secret Managerの概要", url: "https://cloud.google.com/secret-manager/docs/overview?hl=ja" },
      { title: "Cloud Runで最小インスタンス数を設定する", url: "https://cloud.google.com/run/docs/configuring/min-instances?hl=ja", note: "コールドスタート対策の公式ドキュメント" }
    ]
  },
  alternatives: [
    {
      name: "Firebase中心のBaaS構成",
      when: "リアルタイム同期やソーシャルログインが主役で、フロントエンド中心のチームがバックエンド実装を最小にしたい場合",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [3, 1] }
        ],
        nodes: [
          { id: "client", icon: "client/client", label: "Web/モバイル\nクライアント", col: 0, row: 1 },
          { id: "fbh", icon: "compute/firebase-hosting", label: "Firebase Hosting\n静的配信", col: 1, row: 0 },
          { id: "idp", icon: "security/identity-platform", label: "認証\nFirebase Auth", col: 3, row: 0 },
          { id: "fs", icon: "database/firestore", label: "Firestore\nデータ保存", col: 2, row: 1 },
          { id: "fn", icon: "compute/cloud-functions", label: "Cloud Functions\nサーバー処理", col: 3, row: 1 }
        ],
        edges: [
          { from: "client", to: "fbh", label: "静的配信" },
          { from: "client", to: "idp", label: "ログイン" },
          { from: "client", to: "fs", label: "SDKで直接読み書き" },
          { from: "fs", to: "fn", label: "更新トリガー" }
        ]
      },
      flow: [
        "フロントエンドはFirebase Hostingから配信し、ログインはFirebase Authに任せます（Google・メールなどのログインが設定だけで使えます）",
        "クライアントはSDKでFirestoreを直接読み書きします。APIサーバーを書かない代わりに、アクセス制御はセキュリティルールで宣言します",
        "サーバーでしかできない処理（外部API呼び出しなど）だけを、Firestoreの更新をトリガーに動くCloud Functionsで書きます"
      ],
      services: [
        { icon: "compute/firebase-hosting", name: "Firebase Hosting", role: "静的サイトのホスティング。CDN・HTTPSが最初から込み" },
        { icon: "security/identity-platform", name: "Firebase Authentication", role: "認証機能一式。パスワード管理やソーシャルログインを自前実装せずに済む" },
        { icon: "database/firestore", name: "Firestore", role: "サーバーレスNoSQL DB。クライアントから直接使え、リアルタイム同期とオフライン対応が標準" },
        { icon: "compute/cloud-functions", name: "Cloud Functions", role: "イベント駆動の小さなサーバー処理。現在はCloud Run functionsという名前でCloud Run基盤に統合されている" }
      ],
      points: [
        "「APIサーバーを書かない」ことで開発速度を最大化する構成です。2人チームの時間を全部プロダクトのUIと体験に注げます",
        "DBが従量課金のFirestoreになるため、完全に使われなければ月0円にできます。Cloud SQLの固定費すら惜しいMVPには効きます",
        "その代わりデータはNoSQLです。集計や複雑な検索、テーブル結合はSQLのようにはできず、クエリに合わせたデータ設計が必要です",
        "セキュリティルールの書き漏れは即データ漏洩につながります。ルールのテストを必ず書きます（この構成の詳細はケース10で扱います）"
      ],
      pros: [
        "バックエンド実装がほぼ不要で、立ち上げ速度が最速クラス",
        "完全従量課金で、使われなければ月0円にできる",
        "リアルタイム同期・オフライン対応が標準でついてくる"
      ],
      cons: [
        "SQLでの集計・結合が必要な管理画面や分析に弱い",
        "セキュリティルールの設計・テストという独特のスキルが必要",
        "FirestoreのデータモデルはGCP外へ移行しにくく、ロックインが強め"
      ],
      cost: "<strong>月0円〜数千円</strong>。Firestore（読み取り5万回/日などの無料枠）・Hosting・Authはいずれも無料枠が大きく、MVP検証段階なら0円で収まることも珍しくありません。",
      references: [
        { title: "Firebase Hostingドキュメント", url: "https://firebase.google.com/docs/hosting?hl=ja" },
        { title: "Cloud Firestoreドキュメント", url: "https://firebase.google.com/docs/firestore?hl=ja" }
      ]
    },
    {
      name: "Compute Engine 1台構成",
      when: "毎月の費用を固定額にしたい、Docker Composeなど手元の構成をそのまま持ち込みたい、あるいは学習目的でLinuxサーバー運用も経験したい場合",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [3, 1] }
        ],
        nodes: [
          { id: "users", icon: "client/users", label: "ユーザー", col: 0, row: 0 },
          { id: "gce", icon: "compute/compute-engine", label: "Compute Engine\nアプリ+DB同居", col: 2, row: 0 },
          { id: "gcs", icon: "storage/cloud-storage", label: "Cloud Storage\nバックアップ", col: 3, row: 1 }
        ],
        edges: [
          { from: "users", to: "gce", label: "HTTPS" },
          { from: "gce", to: "gcs", label: "日次バックアップ", dashed: true }
        ]
      },
      flow: [
        "小さな仮想マシン1台にWebアプリとデータベースを同居させ、ユーザーは直接このVMへアクセスします",
        "HTTPS化・プロセス管理・OSアップデートなどはすべて自分でVM内に設定します",
        "DBのダンプを日次でCloud Storageへ送り、VMが壊れても作り直せるようにしておきます"
      ],
      services: [
        { icon: "compute/compute-engine", name: "Compute Engine", role: "仮想マシン。OSから上はすべて自分の責任で管理する、いちばん自由度が高くいちばん手がかかる選択肢" },
        { icon: "storage/cloud-storage", name: "Cloud Storage", role: "バックアップの保管先。VM本体と別の場所にデータの避難先を持つのが鉄則" }
      ],
      points: [
        "費用が完全な固定額で見積もりやすいのが利点です。ただし東京リージョンのe2-microで月1,500円前後かかります。GCPの無料枠のe2-microは米国の特定リージョン限定なので、東京では無料にならない点に注意してください",
        "OSパッチ・ミドルウェア更新・監視・障害対応がすべて自分の仕事になります。2人チームの時間がインフラ保守に流れることが、このケースの要件と最も相性が悪い部分です",
        "アクセス集中には自動では耐えられません。スケールさせたくなった時点で、結局Cloud Run構成への引っ越しが必要になります"
      ],
      pros: [
        "月額が固定で、料金体系の理解が簡単",
        "VMの中は完全に自由。既存のDocker Compose資産や特殊なミドルウェアもそのまま動く",
        "Linuxサーバー運用の学習材料としては最良"
      ],
      cons: [
        "スケールしない。バズったら手動増強しかなく、その間は落ちる",
        "セキュリティパッチや障害対応を怠るとそのまま事故になる（運用責任が重い）",
        "無料にしたい場合は米国リージョン限定で、日本からのアクセスには遅延が乗る"
      ],
      cost: "<strong>月1,500円〜3,000円程度</strong>。e2-micro（東京）+ディスク+ネットワーク転送の固定費です。米国リージョンの無料枠を使えばVM代は0円にできますが、日本のユーザー向けには表示が遅くなります。",
      references: [
        { title: "Google Cloudの無料プログラム", url: "https://cloud.google.com/free/docs/free-cloud-features?hl=ja", note: "e2-micro無料枠の対象リージョンはここで確認" },
        { title: "Compute Engineドキュメント", url: "https://cloud.google.com/compute/docs?hl=ja" }
      ]
    }
  ],
  cost: "<p>推奨構成は<strong>月2,000円〜1万円程度</strong>（下限はCloud SQLの固定費）、Firebase構成は<strong>月0円〜数千円</strong>、Compute Engine 1台構成は<strong>月1,500円〜3,000円程度の固定額</strong>が目安です。MVP段階の差は小さく見えますが、「成長したときに構成ごと作り直しになるか、そのまま増強できるか」が本当の分かれ目です。東京リージョン・1USD=150円前後の概算です。</p>",
  summary: "<p>「迷ったらCloud Run」はGCPの第一定石です。<strong>コンテナを渡せばHTTPS・自動スケール・ゼロスケールまで面倒を見てくれる</strong>ため、トラフィックが読めないMVPと最高に相性が良いのです。判断が分かれるのはデータベースで、SQLの表現力を取るならCloud SQLの固定費を受け入れ、完全従量とリアルタイム同期を取るならFirestoreを選びます。この構成はそのままケース8（EC）やケース14（REST API）の土台になり、CI/CDの深掘りはケース43で扱います。</p>",
  quiz: [
    {
      q: "この構成にはロードバランサもVPCも登場しません。ケース1では「VPCが無いのは省略ではない」と学びましたが、Cloud RunにLBが不要な理由は何でしょうか。",
      a: "Cloud Runはサービスごとに公開HTTPSエンドポイントを標準で持ち、TLS証明書の管理やリクエストの分散をGoogle側が済ませてくれるためです。独自ドメインの割り当てもLBなしで可能です。LBが必要になるのは、Cloud CDNやCloud Armorを前段に挟みたい、複数サービスを1つのドメインで束ねたい、マルチリージョンに振り分けたいといった要件が出たときで、ケース8やケース6がその段階にあたります。"
    },
    {
      q: "サービスがSNSで話題になり、アクセスが平常時の100倍になりました。この構成で最初に悲鳴を上げるのはどの部品で、どう対処しますか。",
      a: "Cloud Runは自動スケールで受け止めるため、先に限界が来るのは固定サイズのCloud SQLです。最小インスタンスは同時接続数もCPUも小さく、接続枯渇やスロークエリが発生します。対処は、インスタンスの増強（垂直スケール）、コネクションプーリングの導入、読み取りが多いならキャッシュ（ケース8のMemorystore）やリードレプリカの追加です。「サーバーレスの後ろにある固定リソースがボトルネックになる」のはクラウド設計の頻出パターンです。"
    },
    {
      q: "あなたのMVPは「友人同士でリアルタイムに位置を共有する」アプリだと分かりました。推奨構成とFirebase構成、どちらで始めますか。理由も考えてください。",
      a: "リアルタイム同期が主役なら、Firestoreのリアルタイムリスナーが標準でついてくるFirebase構成が有力です。Cloud Run+Cloud SQLで同じことをするにはWebSocketサーバーの常駐が必要になり、Cloud Runの不得意分野に踏み込んでしまいます。逆に、決済や複雑な集計が主役ならSQLが使える推奨構成が有利です。「アプリの核となる体験に、どちらの基盤の得意分野が重なるか」で選ぶのが正解で、技術の新旧や流行では選びません。"
    }
  ]
});
