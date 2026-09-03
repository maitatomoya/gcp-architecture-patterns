// ケース10：モバイルアプリバックエンド
registerCase({
  id: 10,
  category: "Webアプリ・EC",
  title: "モバイルアプリバックエンド",
  scenario: "<p>ランニング仲間と記録を共有するiOS/Androidアプリを作ります。機能はユーザー登録、走行記録の保存、仲間のタイムラインへの反映、写真の添付、「いいね」がついたときのプッシュ通知です。チームはモバイルエンジニア2人だけで、サーバー担当はいません。複数端末を使うユーザーも多く、端末間でデータが即座に同期されることが体験の要になります。</p>",
  requirements: [
    "認証・データ保存・通知というモバイル定番機能を最小工数で用意したい",
    "端末間・仲間間でデータが数秒で同期されてほしい",
    "電波の悪い屋外（ランニング中）でも動き、復帰時に自動で同期してほしい",
    "プッシュ通知をiOS/Android両方へ同じ仕組みで送りたい",
    "サーバー専任がいなくても運用できること",
    "ユーザー数が読めないため、コストは利用量に比例してほしい"
  ],
  main: {
    name: "Firestore直結のサーバーレスBaaS構成",
    diagram: {
      cols: 4, rows: 3,
      groups: [
        { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [3, 2] }
      ],
      nodes: [
        { id: "mobile", icon: "client/mobile-client", label: "iOS/Android\nアプリ", col: 0, row: 1 },
        { id: "idp", icon: "security/identity-platform", label: "Identity Platform\nログイン認証", col: 1, row: 0 },
        { id: "fs", icon: "database/firestore", label: "Firestore\nデータ同期", col: 2, row: 1 },
        { id: "gcs", icon: "storage/cloud-storage", label: "Cloud Storage\n写真保存", col: 1, row: 2 },
        { id: "fn", icon: "compute/cloud-functions", label: "Cloud Functions\nトリガー処理", col: 3, row: 1 },
        { id: "fcm", icon: "integration/fcm", label: "FCM\nプッシュ通知", col: 3, row: 0 }
      ],
      edges: [
        { from: "mobile", to: "idp", label: "ログイン" },
        { from: "mobile", to: "fs", label: "SDKで直接読み書き" },
        { from: "mobile", to: "gcs", label: "写真アップロード" },
        { from: "fs", to: "fn", label: "更新トリガー" },
        { from: "fn", to: "fcm", label: "通知依頼" },
        { from: "fcm", to: "mobile", label: "プッシュ通知" }
      ]
    },
    flow: [
      "アプリはIdentity Platformでログインします。メール・Google・Appleサインインなどが設定だけで使え、以後の通信はこのユーザーIDに紐づきます",
      "走行記録はアプリからFirestoreへSDKで直接読み書きします。APIサーバーを経由しない代わりに、「自分の記録しか書けない」「仲間の記録だけ読める」といった制御はセキュリティルールで宣言します",
      "仲間の端末はFirestoreのリアルタイムリスナー（データ変更を待ち受ける仕組み）で更新を数秒以内に受け取ります。オフライン時はSDKが端末内にキャッシュし、電波復帰時に自動同期します",
      "「いいね」の書き込みをCloud Functionsが検知し、通知対象のユーザーを判定してFCMへ通知を依頼します",
      "FCMがiOS（APNs経由）とAndroidの両方へプッシュ通知を届けます。写真はCloud Storageへアプリから直接アップロードします"
    ],
    services: [
      { icon: "database/firestore", name: "Firestore", role: "サーバーレスNoSQLデータベース。モバイルSDK・リアルタイムリスナー・オフラインキャッシュを標準装備し、この構成の背骨になる" },
      { icon: "security/identity-platform", name: "Identity Platform", role: "認証基盤（Firebase Authenticationの企業向け版）。パスワード管理やソーシャルログインを自前実装せずに済ませる" },
      { icon: "compute/cloud-functions", name: "Cloud Functions", role: "Firestoreの更新などをきっかけに動く小さなサーバー処理。現在はCloud Run functionsという名前でCloud Run基盤に統合されている" },
      { icon: "integration/fcm", name: "Firebase Cloud Messaging", role: "iOS/Android共通のプッシュ通知基盤。端末トークンの管理と配送を無料で担う" },
      { icon: "storage/cloud-storage", name: "Cloud Storage", role: "写真の保存先。Firebase SDK経由でアプリから直接アップロードでき、アクセス制御もセキュリティルールで書ける" }
    ],
    points: [
      "この構成の最大の判断は「APIサーバーを書かない」ことです。2人の工数をすべてアプリ体験に注げます。その代わり、通常はサーバーが担う入力検証とアクセス制御をセキュリティルールが引き受けるため、ルールは本番コードと同格に扱い、必ずテストを書いてからデプロイします",
      "リアルタイム同期とオフライン対応を自前で作ると、WebSocketサーバーの常駐運用と同期の競合解決という難問を抱え込みます。FirestoreのSDKに任せることが、サーバー担当ゼロという制約への直接の回答です",
      "FirestoreはNoSQLです。「タイムラインに必要な形のままデータを持つ」など、読み取りクエリに合わせた非正規化設計（同じデータを複数の場所に持つ設計）が基本になり、SQLの発想のままだと行き詰まります。月間ランキングのような集計はCloud Functionsで事前計算して別の場所に保存します",
      "通知の判定ロジックをアプリ側でなくCloud Functionsに置いたのは、悪意ある改造クライアントから通知送信を守るためです。FCMのサーバーキーをアプリに埋め込んではいけません"
    ],
    pros: [
      "サーバーの構築・運用が不要で、モバイルエンジニアだけでフルスタックの体験を作れる",
      "リアルタイム同期・オフライン対応という難しい機能が標準でついてくる",
      "認証からDB・通知まで完全従量課金+大きな無料枠で、ユーザーが少ないうちはほぼ0円",
      "Firestoreは利用量に応じて自動スケールし、キャパシティ管理が不要"
    ],
    cons: [
      "セキュリティルールが複雑化しやすく、書き漏れが即データ漏洩につながる",
      "SQL的な集計・横断検索・複雑なトランザクションは苦手（設計の工夫か別サービスの併用が必要）",
      "クライアント直結ゆえ、サーバーでしか守れない処理（課金・不正検知など）が増えると構成の見直しが必要になる",
      "FirestoreのデータモデルはGCP外へ移行しにくく、ロックインは強め"
    ],
    cost: "<strong>月0円〜1万円程度</strong>。Firestoreは読み取り5万回/日・書き込み2万回/日などの無料枠があり、FCMは無料、Cloud FunctionsとCloud Storageも無料枠が大きいため、検証期は0円で収まることが多いです。ユーザー数万人規模でも月数千円〜という水準で、コストが利用量に比例するという要件そのものの料金構造です。東京リージョン・1USD=150円前後の概算です。",
    references: [
      { title: "Cloud Firestoreドキュメント", url: "https://firebase.google.com/docs/firestore?hl=ja", note: "リアルタイムリスナー・オフライン対応の公式解説" },
      { title: "Firebase Cloud Messagingドキュメント", url: "https://firebase.google.com/docs/cloud-messaging?hl=ja" },
      { title: "Identity Platformドキュメント", url: "https://cloud.google.com/identity-platform/docs?hl=ja" },
      { title: "Cloud Functionsドキュメント", url: "https://cloud.google.com/functions/docs?hl=ja" },
      { title: "Cloud Storage for Firebaseドキュメント", url: "https://firebase.google.com/docs/storage?hl=ja" }
    ]
  },
  alternatives: [
    {
      name: "Cloud Run+Cloud SQLのAPI型構成",
      when: "決済や在庫のような強い整合性・SQLでの集計が必要、またはバックエンドエンジニアがいて既存のRDB資産を活かしたい場合",
      diagram: {
        cols: 3, rows: 3,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [2, 2] }
        ],
        nodes: [
          { id: "mobile", icon: "client/mobile-client", label: "iOS/Android\nアプリ", col: 0, row: 1 },
          { id: "idp", icon: "security/identity-platform", label: "Identity Platform\nログイン認証", col: 1, row: 0 },
          { id: "run", icon: "compute/cloud-run", label: "Cloud Run\nREST API", col: 1, row: 1 },
          { id: "fcm", icon: "integration/fcm", label: "FCM\nプッシュ通知", col: 1, row: 2 },
          { id: "gcs", icon: "storage/cloud-storage", label: "Cloud Storage\n写真保存", col: 2, row: 0 },
          { id: "sql", icon: "database/cloud-sql", label: "Cloud SQL\nリレーショナルDB", col: 2, row: 1 }
        ],
        edges: [
          { from: "mobile", to: "idp", label: "ログイン" },
          { from: "mobile", to: "run", label: "REST API" },
          { from: "run", to: "sql", label: "SQL" },
          { from: "run", to: "gcs", label: "ファイル保存" },
          { from: "run", to: "fcm" },
          { from: "fcm", to: "mobile", label: "プッシュ通知" }
        ]
      },
      flow: [
        "アプリはIdentity Platformでログインしてトークンを取得し、Cloud RunのREST APIへ添えて送ります",
        "Cloud RunのAPIがトークンを検証し、ビジネスロジックと入力チェックを実行してCloud SQLを読み書きします",
        "通知が必要なイベントはAPI側で判定し、FCM経由でプッシュ通知を送ります",
        "リアルタイム同期が必要な画面は、ポーリング（定期的な再取得）や後述のFirestore併用で補います"
      ],
      services: [
        { icon: "compute/cloud-run", name: "Cloud Run", role: "REST APIサーバー。検証・認可・ビジネスロジックをサーバー側に集約する、ケース7と同じ定石構成" },
        { icon: "database/cloud-sql", name: "Cloud SQL", role: "リレーショナルDB。集計・結合・トランザクションが得意で、管理画面や分析にも強い" },
        { icon: "security/identity-platform", name: "Identity Platform", role: "認証。推奨構成と同じ部品を使い、検証だけAPI側で行う" },
        { icon: "integration/fcm", name: "Firebase Cloud Messaging", role: "プッシュ通知。API構成でも通知だけはFCMを使うのが定石" },
        { icon: "storage/cloud-storage", name: "Cloud Storage", role: "写真の保存先。APIが発行する署名付きURLでアプリから直接アップロードさせる" }
      ],
      points: [
        "検証・認可・整合性の守りをすべてサーバー側コードに集約できるのがAPI型の本質的な強みです。セキュリティルールの表現力に縛られず、複雑な業務ロジックも普通のプログラムとして書けます",
        "リアルタイム同期は自前になります。WebSocketの常時接続はCloud Runの課金・タイムアウトと相性が悪いため、要件次第でFirestore併用（次の代替案）や専用の仕組み（ケース39）を検討します",
        "モバイル2人だけのチームには、API設計・実装・運用という継続的な仕事が増える点が最大の負担です。バックエンド経験者の有無で現実性が変わります"
      ],
      pros: [
        "SQLの集計・結合・トランザクションが使え、管理画面や将来の分析要件に強い",
        "検証と認可をサーバーに集約でき、クライアントを信用しない設計を素直に作れる",
        "WebやパートナーAPIなどモバイル以外のクライアント追加が容易"
      ],
      cons: [
        "APIサーバーの設計・実装・運用という継続的な工数が発生する",
        "リアルタイム同期・オフライン対応を自前で解決する必要がある",
        "Cloud SQLの固定費がかかり、完全従量にはならない"
      ],
      cost: "<strong>月2,000円〜1.5万円程度</strong>。Cloud SQLの最小構成（月1,500円前後〜）が下限を決め、Cloud Runは無料枠内に収まりやすい構造です。ケース7と同じ費用感になります。",
      references: [
        { title: "Cloud RunからCloud SQLへ接続する", url: "https://cloud.google.com/sql/docs/mysql/connect-run?hl=ja" },
        { title: "Cloud Runドキュメント", url: "https://cloud.google.com/run/docs?hl=ja" }
      ]
    },
    {
      name: "Firestore+Cloud Run BFFのハイブリッド構成",
      when: "リアルタイム同期は残したいが、課金処理や実績集計などサーバーでしか守れない・計算できない処理が増えてきた場合",
      diagram: {
        cols: 3, rows: 3,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [2, 2] }
        ],
        nodes: [
          { id: "mobile", icon: "client/mobile-client", label: "iOS/Android\nアプリ", col: 0, row: 1 },
          { id: "run", icon: "compute/cloud-run", label: "Cloud Run\n書き込みAPI（BFF）", col: 1, row: 0 },
          { id: "fs", icon: "database/firestore", label: "Firestore\nデータ同期", col: 2, row: 1 },
          { id: "idp", icon: "security/identity-platform", label: "Identity Platform\nログイン認証", col: 1, row: 2 }
        ],
        edges: [
          { from: "mobile", to: "run", label: "書き込みはAPI経由" },
          { from: "run", to: "fs", label: "検証して書き込み" },
          { from: "fs", to: "mobile", label: "リアルタイム同期" },
          { from: "mobile", to: "idp", label: "ログイン" }
        ]
      },
      flow: [
        "読み取りは推奨構成のまま、アプリがFirestoreのリアルタイムリスナーで直接受け取ります（同期の速さとオフライン対応を維持）",
        "書き込みだけをCloud RunのAPI（BFF：Backend For Frontend、クライアント専用の窓口サーバー）経由に変更します",
        "BFFがトークン検証・入力チェック・不正判定・ポイント計算などを行ってからFirestoreへ書き込み、結果はリスナー経由で各端末に配られます",
        "Firestoreのセキュリティルールは「クライアントからの直接書き込みは禁止、読み取りは自分と仲間の範囲のみ」と単純化します"
      ],
      services: [
        { icon: "compute/cloud-run", name: "Cloud Run（BFF）", role: "書き込みの検証と業務ロジックを担う窓口API。クライアントを信用せずにデータの整合性を守る" },
        { icon: "database/firestore", name: "Firestore", role: "データ本体と同期配信。リアルタイムリスナーとオフラインキャッシュはそのまま活かす" },
        { icon: "security/identity-platform", name: "Identity Platform", role: "認証。BFFでのトークン検証とセキュリティルールの両方で同じIDを使う" }
      ],
      points: [
        "「読みは直結・書きはAPI」という非対称な分担がこの構成の要です。読み取りの速さと同期体験は落とさず、事故が起きやすい書き込みだけをサーバーの検証下に置きます",
        "セキュリティルールは「直接書き込み禁止」の宣言だけに単純化され、複雑なルールのメンテナンスから解放されます。推奨構成でルールが肥大化してきたときの現実的な逃がし先です",
        "推奨構成からの移行は書き込み経路の切り替えだけで済み、データ移行が発生しません。「Firestore直結で始めて、守るべきものが増えたらBFFを挟む」という成長パスを最初から想定しておくと安心です"
      ],
      pros: [
        "リアルタイム同期・オフライン対応を維持したまま、サーバー側の検証と業務ロジックを導入できる",
        "セキュリティルールが単純になり、漏れのリスクが下がる",
        "推奨構成からデータ移行なしで段階的に移行できる"
      ],
      cons: [
        "書き込みの往復が1段増え、書き込みだけはわずかに遅くなる",
        "BFFという運用対象が増える（ただしフルAPI型よりは小さい）",
        "読み取りルールの管理は残るため、ルールのテストは引き続き必要"
      ],
      cost: "<strong>月数百円〜1.5万円程度</strong>。推奨構成の費用にCloud Run（書き込み分のみの従量課金で小規模なら無料枠内）が加わる程度で、Cloud SQLを持たないぶんAPI型より下限が低くなります。",
      references: [
        { title: "Cloud Firestoreセキュリティルールを使ってみる", url: "https://firebase.google.com/docs/firestore/security/get-started?hl=ja" },
        { title: "Cloud Runとは", url: "https://cloud.google.com/run/docs/overview/what-is-cloud-run?hl=ja" }
      ]
    }
  ],
  cost: "<p>推奨構成は<strong>月0円〜1万円程度</strong>と、無料枠の大きさが際立ちます。API型構成は<strong>月2,000円〜1.5万円程度</strong>（Cloud SQLの固定費が下限）、ハイブリッド構成は<strong>月数百円〜1.5万円程度</strong>です。モバイルアプリはユーザー数が読めないことが多いため、「使われなければほぼ0円」という料金構造自体が構成選定の大きな判断材料になります。東京リージョン・1USD=150円前後の概算です。</p>",
  summary: "<p>モバイルバックエンドの分かれ目は<strong>「サーバーを書くか、書かずにルールで守るか」</strong>です。リアルタイム同期・オフライン対応・通知という「モバイルの三種の神器」はFirestoreとFCMが標準装備しており、サーバー担当ゼロのチームならBaaS直結が最速です。一方で課金や複雑な集計などクライアントを信用できない処理が主役になるほどAPI型が正解に近づき、その中間に「読みは直結・書きはBFF」というハイブリッドがあります。リアルタイム機能の深掘りはケース39、通知基盤の大規模化はケース42、写真の自動処理はケース17で扱います。</p>",
  quiz: [
    {
      q: "この構成にはAPIサーバーがなく、アプリがFirestoreを直接読み書きします。「他人の走行記録を勝手に書き換える」攻撃は何によって防がれているのでしょうか。",
      a: "Firestoreのセキュリティルールです。すべての読み書きはGoogleのサーバー側でルールと照合され、「認証済みユーザーは自分のIDに紐づく記録だけ書ける」といった条件を満たさない操作は拒否されます。アプリ内のチェックは改造クライアントで無効化できるため、防御として数えられません。ルールが唯一の防壁である以上、本番コードと同じ水準でレビューとテストを行う必要があります。"
    },
    {
      q: "「月間走行距離ランキング」機能を追加したくなりました。FirestoreにはSQLのような集計クエリがありません。あなたならどう実現しますか。",
      a: "読み取り時に全員の記録を集計するのではなく、事前に集計結果を作っておく設計にします。たとえば記録の書き込みをトリガーにCloud Functionsで月間合計を更新し、ランキング用のコレクションに保存しておけば、アプリはそれを読むだけで済みます。大規模で複雑な分析が必要になったら、FirestoreのデータをBigQueryへ連携して分析側で計算する方法もあります。NoSQLでは「読みたい形で先に作っておく」が集計の基本戦略です。"
    },
    {
      q: "アプリに有料プラン（アプリ内課金）を追加することになりました。課金状態の管理をこれまで通りクライアントからのFirestore直接書き込みで行ってよいでしょうか。あなたの判断と構成変更案を考えてください。",
      a: "直接書き込みは不可です。課金状態をクライアントが書ける設計だと、改造クライアントが自分を有料会員に書き換えられてしまいます。課金処理はストアのレシート検証を含めてサーバー側で行う必要があるため、ハイブリッド構成（BFF）へ進化させ、課金状態の書き込みはBFFだけに許可し、セキュリティルールでクライアントからの書き込みを禁止します。「クライアントを信用できない処理が現れたらサーバーを挟む」という、この構成の成長パスの典型例です。"
    }
  ]
});
