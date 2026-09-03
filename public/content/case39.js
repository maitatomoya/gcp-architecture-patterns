// ケース39：リアルタイムチャット
registerCase({
  id: 39,
  category: "IoT・リアルタイム",
  title: "リアルタイムチャット",
  scenario: "<p>習い事のマッチングサービスに、生徒と講師の1対1チャット機能を追加します。メッセージは相手の画面に1秒以内で反映され、既読マークや「入力中…」の表示もリアルタイムに更新したい要件です。アプリを閉じている相手にはプッシュ通知を届けます。ユーザーは現在3万人で、同時接続は数百〜数千の見込みです。開発はモバイルエンジニア2人だけで、チャットサーバーの常時運用に人を割く余裕はありません。</p>",
  requirements: [
    "メッセージが相手の画面に1秒以内に反映されること",
    "既読・入力中表示などの状態変化もリアルタイムに同期したい",
    "アプリを閉じている相手にはプッシュ通知を届けたい",
    "認証済みユーザーが自分の参加する会話だけを読めるように制御したい",
    "少人数チームのため、常時稼働サーバーの運用は最小にしたい"
  ],
  main: {
    name: "Firestoreリアルタイムリスナー構成",
    diagram: {
      cols: 5, rows: 2,
      groups: [
        { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [4, 1] }
      ],
      nodes: [
        { id: "idp", icon: "security/identity-platform", label: "Identity Platform\nログイン認証", col: 1, row: 0 },
        { id: "fcm", icon: "integration/fcm", label: "FCM\nプッシュ配信", col: 4, row: 0 },
        { id: "mobile", icon: "client/mobile-client", label: "チャット\nアプリ", col: 0, row: 1 },
        { id: "fstr", icon: "database/firestore", label: "Firestore\n会話データ", col: 2, row: 1 },
        { id: "evarc", icon: "integration/eventarc", label: "Eventarc\n書き込み検知", col: 3, row: 1 },
        { id: "run", icon: "compute/cloud-run", label: "Cloud Run\n通知判定", col: 4, row: 1 }
      ],
      edges: [
        { from: "mobile", to: "idp", label: "ログイン" },
        { from: "mobile", to: "fstr", label: "リアルタイム同期" },
        { from: "idp", to: "fstr", noArrow: true, dashed: true },
        { from: "fstr", to: "evarc", label: "書き込みイベント" },
        { from: "evarc", to: "run", label: "起動" },
        { from: "run", to: "fcm", label: "通知依頼" },
        { from: "fcm", to: "mobile", label: "プッシュ通知" }
      ]
    },
    flow: [
      "アプリはIdentity Platformでログインし、本人であることを示すIDトークンを受け取ります",
      "アプリはFirestoreに直接接続し、参加中の会話ドキュメントにリアルタイムリスナー（データの変化をサーバーから自動で押し届けてもらう購読の仕組み）を張ります。新着メッセージや既読状態の変化は、サーバーを介さず1秒以内に全参加者の画面へ届きます",
      "アクセス制御はFirestoreセキュリティルールで行い、IDトークンを検証して「会話の参加者だけが読み書きできる」ように絞ります",
      "メッセージの書き込みイベントはEventarcが検知し、Cloud Runの通知判定サービスを起動します",
      "Cloud Runは相手がその会話を開いていなければFCMへ通知を依頼し、FCMが相手の端末へプッシュ通知を配信します"
    ],
    services: [
      { icon: "database/firestore", name: "Firestore", role: "会話・メッセージ・既読状態を保存するNoSQLデータベース。リアルタイムリスナーで変更をクライアントへ自動配信する" },
      { icon: "security/identity-platform", name: "Identity Platform", role: "メール・SNSログインなどの認証基盤。発行するIDトークンがセキュリティルールの判定材料になる" },
      { icon: "integration/eventarc", name: "Eventarc", role: "Firestoreへの書き込みをイベントとして受け取り、Cloud Runへ配送する接着剤" },
      { icon: "compute/cloud-run", name: "Cloud Run", role: "通知の要否判定や迷惑メッセージ対策など、サーバー側で確実に実行したいロジックの置き場" },
      { icon: "integration/fcm", name: "Firebase Cloud Messaging", role: "iOS/Androidへのプッシュ通知配信サービス。無料で利用できる" }
    ],
    points: [
      "この構成の核心は「クライアントがデータベースに直接つなぐ」という、通常のWeb開発では禁じ手に見える設計です。これが成立するのは、IDトークンによる本人確認とセキュリティルールによるアクセス制御をFirestore自身が備えているからです。おかげで自前のWebSocketサーバーを1台も運用せずにリアルタイム同期が手に入ります",
      "既読や入力中表示は、ドキュメントのフィールド更新をリスナーで受けるだけで実装できます。ただし入力中表示は打鍵のたびに書き込むと課金と負荷が跳ねるため、数秒に1回へ間引く（スロットリング）のが定石です",
      "Firestoreは読み取り回数に課金されるため、リスナーの張り方が料金を左右します。開いている会話だけに張る・会話一覧はページングして必要な分だけ読む、といった設計をアプリ側で行います",
      "プッシュ通知の送信をクライアントに任せず、Eventarc+Cloud Runへ寄せています。通知の送信権限を端末側に配ると悪用リスクがあるうえ、送信漏れの検知もできないためです。サーバーが関与すべき処理と、クライアント直結でよい処理の切り分けがこの構成の設計判断です"
    ],
    pros: [
      "リアルタイム同期・オフラインキャッシュ・再接続処理をFirestoreが標準で面倒を見てくれる",
      "常時稼働のサーバーがゼロで、2人チームでも運用が回る",
      "同時接続が増えてもマネージド側がスケールし、キャパシティ設計が不要",
      "利用が少ない時間帯の費用がほぼゼロになる従量課金"
    ],
    cons: [
      "読み取り課金がユーザー数×閲覧量に比例して伸びるため、リスナー設計を誤ると料金が跳ねる",
      "全文検索や複雑な集計は苦手で、必要なら別サービスとの組み合わせになる",
      "セキュリティルールの記述ミスがそのまま情報漏えいになるため、ルールのテストが必須",
      "メッセージ配信の細かい制御（優先度制御や配信順の作り込みなど）はマネージドの挙動に従うことになる"
    ],
    cost: "<strong>月数百円〜数千円程度</strong>（東京リージョン・1USD=150円前後、数千DAU規模の概算）。Firestoreは読み取り10万回あたり約5円で、チャットの規模なら月数千円に収まることが多いです。Identity Platformは約5万MAUまで無料枠があり、FCMは無料、Cloud Runも微額です。ユーザー数が10倍になると読み取り課金もほぼ10倍になる、伸び方が読みやすい料金構造です。",
    references: [
      { title: "Cloud Firestoreでリアルタイムアップデートを入手する", url: "https://firebase.google.com/docs/firestore/query-data/listen?hl=ja", note: "リアルタイムリスナーの公式ガイド" },
      { title: "Firestoreセキュリティルールを使ってみる", url: "https://cloud.google.com/firestore/docs/security/get-started?hl=ja", note: "直接接続を安全にする要の仕組み" },
      { title: "Identity Platformのコンセプト", url: "https://cloud.google.com/identity-platform/docs/concepts?hl=ja" },
      { title: "Firebase Cloud Messaging", url: "https://firebase.google.com/docs/cloud-messaging?hl=ja" },
      { title: "Eventarcの概要", url: "https://cloud.google.com/eventarc/docs/overview?hl=ja" }
    ]
  },
  alternatives: [
    {
      name: "Cloud Run WebSocket自前構成",
      when: "配信制御や既読集計などサーバー主導のロジックが多い場合や、大規模化で読み取り課金より接続時間課金の方が安くなる場合",
      diagram: {
        cols: 3, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [2, 1] }
        ],
        nodes: [
          { id: "client", icon: "client/client", label: "チャット\nクライアント", col: 0, row: 0 },
          { id: "run", icon: "compute/cloud-run", label: "Cloud Run\nWebSocketサーバー", col: 1, row: 0 },
          { id: "mem", icon: "database/memorystore", label: "Memorystore\nインスタンス間中継", col: 2, row: 0 },
          { id: "fstr", icon: "database/firestore", label: "Firestore\n履歴保存", col: 1, row: 1 }
        ],
        edges: [
          { from: "client", to: "run", label: "WebSocket" },
          { from: "run", to: "mem", label: "配信の共有" },
          { from: "run", to: "fstr", label: "履歴保存" }
        ]
      },
      flow: [
        "クライアントはCloud Run上の自作WebSocketサーバーへ常時接続し、メッセージの送受信はこの接続上で行います",
        "Cloud Runは複数インスタンスに分かれるため、別インスタンスにつながる相手への配信はMemorystore（Redis）のPub/Sub機能で中継します",
        "メッセージ履歴はFirestoreへ保存し、再接続時や過去ログの取得はここから読み出します"
      ],
      services: [
        { icon: "compute/cloud-run", name: "Cloud Run", role: "WebSocketサーバーの実行基盤。WebSocketに対応しており、接続数に応じてインスタンスが増える" },
        { icon: "database/memorystore", name: "Memorystore（Redis）", role: "インスタンスをまたぐメッセージ配信の中継役。RedisのPub/Sub機能を使う" },
        { icon: "database/firestore", name: "Firestore", role: "メッセージ履歴の永続化。リアルタイム配信はWebSocketが担うため、ここは保存専用" }
      ],
      points: [
        "リアルタイム配信の主導権をすべて自分のコードが握るのがこの構成の価値です。配信の優先順位・独自プロトコル・サーバー側での既読集計など、マネージドの枠を超える要件に応えられます",
        "引き換えに、再接続・順序保証・未達検知といったFirestoreが標準でくれていたものを全部自作することになります。この開発量を2人チームで抱えられるかが採用判断の分かれ目です",
        "Cloud RunのWebSocketにはリクエストタイムアウト（最大60分）があり、定期的な切断と再接続をクライアント側で前提にした設計が必須です。また接続を維持する間はインスタンスが起き続けるため、課金は接続時間ベースで考えます"
      ],
      pros: [
        "配信ロジック・プロトコルを完全に制御でき、複雑な要件に対応できる",
        "大規模では接続時間ベースの費用が読み取り課金より安くなる場合がある"
      ],
      cons: [
        "再接続・順序保証・オフライン対応をすべて自作する開発コストがかかる",
        "Memorystoreは常時稼働の固定費（最小構成で月数千円）がある",
        "スケールや障害時の挙動の面倒を自分で見る運用負担が戻ってくる"
      ],
      cost: "<strong>月1万円〜数万円程度</strong>（東京リージョン・1USD=150円前後の概算）。常時接続を受けるCloud Runインスタンス（最小台数を確保）とMemorystoreの固定費が中心です。接続数が増えるとインスタンス数に比例して伸びます。",
      references: [
        { title: "Cloud RunでのWebSocketの使用", url: "https://cloud.google.com/run/docs/triggering/websockets?hl=ja", note: "タイムアウトや複数インスタンスの注意点" },
        { title: "Memorystore for Redisの概要", url: "https://cloud.google.com/memorystore/docs/redis/redis-overview?hl=ja" }
      ]
    },
    {
      name: "Firebaseスタック全振り構成",
      when: "個人開発や超少人数で、管理するものを極限まで減らして最速でリリースしたい場合",
      diagram: {
        cols: 3, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [2, 1] }
        ],
        nodes: [
          { id: "mobile", icon: "client/mobile-client", label: "チャット\nアプリ", col: 0, row: 0 },
          { id: "fstr", icon: "database/firestore", label: "Firestore\n会話データ", col: 1, row: 0 },
          { id: "fn", icon: "compute/cloud-functions", label: "Cloud Functions\n書き込みトリガー", col: 2, row: 0 },
          { id: "fcm", icon: "integration/fcm", label: "FCM\nプッシュ配信", col: 1, row: 1 }
        ],
        edges: [
          { from: "mobile", to: "fstr", label: "リアルタイム同期" },
          { from: "fstr", to: "fn", label: "書き込みイベント" },
          { from: "fn", to: "fcm", label: "通知依頼" },
          { from: "fcm", to: "mobile", label: "プッシュ通知" }
        ]
      },
      flow: [
        "アプリとFirestoreの関係は推奨構成と同じで、リアルタイムリスナーによる直接同期です（認証はFirebase Authentication＝Identity Platformの同等機能を使います）",
        "メッセージ書き込みをきっかけにCloud Functions（イベントに反応して動く小さな関数）が起動し、通知の要否を判定します",
        "通知が必要ならFCMへ依頼し、相手の端末へプッシュ通知が届きます"
      ],
      services: [
        { icon: "database/firestore", name: "Firestore", role: "推奨構成と同じ、リアルタイム同期の中核" },
        { icon: "compute/cloud-functions", name: "Cloud Functions（Cloud Run functions）", role: "書き込みトリガーで動く通知処理。コンテナのビルドすら不要で、関数のコードだけ書けばよい" },
        { icon: "integration/fcm", name: "Firebase Cloud Messaging", role: "プッシュ通知の配信" }
      ],
      points: [
        "推奨構成との違いはEventarc+Cloud RunをCloud Functionsに置き換えた点だけで、書くコードが「イベントに反応する関数」だけになります。インフラの登場人物を1つでも減らしたい段階では合理的な選択です",
        "Firebaseコンソールに認証・DB・通知・関数が集約されるため、モバイル開発者だけのチームでも全体を見渡せます",
        "REST APIの提供や外部サービス連携など「関数の集まり」では散らかる規模になってきたら、通知以外のバックエンドをCloud Runへ移すのが自然な成長経路です（ケース10）"
      ],
      pros: [
        "学ぶこと・管理するものが最少で、リリースまでが最速",
        "小規模なら無料枠内に収まりやすい"
      ],
      cons: [
        "複雑なバックエンド処理を関数の集まりで作ると見通しが悪くなりがち",
        "実行時間やメモリなど関数の制約に収まらない処理には向かない"
      ],
      cost: "<strong>月0円〜数百円程度</strong>（東京リージョン・1USD=150円前後、小規模の概算）。Firestore・Cloud Functionsとも無料枠があり、個人開発の規模なら無料枠内で運用できることも珍しくありません。",
      references: [
        { title: "Cloud Functions for Firebase", url: "https://firebase.google.com/docs/functions?hl=ja" },
        { title: "Firebase Cloud Messaging", url: "https://firebase.google.com/docs/cloud-messaging?hl=ja" }
      ]
    }
  ],
  cost: "<p>推奨構成は<strong>月数百円〜数千円</strong>（数千DAU規模）で、読み取り回数に比例して伸びます。自前WebSocketの代替1は<strong>月1万円〜</strong>の固定費に加えて開発工数が本体のコストです。代替2は<strong>ほぼ無料枠内</strong>から始められます。ユーザー数と要件の複雑さが増えるにつれて、右の構成から左の構成へ移っていくイメージです。いずれも東京リージョン・1USD=150円前後の目安です。</p>",
  summary: "<p>リアルタイムチャットの最大の学びは、<strong>「クライアントがDBへ直接つなぐ」設計が認証（IDトークン）とセキュリティルールの2つで成立している</strong>ことです。この2つが揃うからこそ、WebSocketサーバーの運用なしにリアルタイム同期が手に入ります。一方で、Firestoreの読み取り課金はリスナーの張り方次第で大きく変わるため、料金モデルの理解が設計スキルそのものになります。サーバー主導の複雑な配信制御が必要になったときが自前WebSocket構成への乗り換え時で、それまではマネージドに寄せるのが少人数チームの正解です。モバイルバックエンド全体の設計はケース10、大規模プッシュ通知の配信基盤はケース42で扱います。</p>",
  quiz: [
    {
      q: "この構成には自前のチャットサーバー（WebSocketサーバー）が存在しないのに、リアルタイム同期とアクセス制御が両立できています。それを成立させている2つの仕組みは何でしょうか。",
      a: "Identity Platformが発行するIDトークンによる本人確認と、Firestoreセキュリティルールによるアクセス制御です。クライアントは正規のIDトークンを持ってFirestoreへ直接つなぎ、ルールが「この会話の参加者か」をサーバー側で検証してから読み書きを許可します。配信の仕組み（リスナー）はFirestoreが標準で持っているため、認証と認可さえ揃えばサーバーのリレーが不要になる、という構造です。"
    },
    {
      q: "「入力中…」の表示を素直に実装すると、キーを打つたびにFirestoreへ書き込むことになります。この実装の問題点と対策を説明してください。",
      a: "打鍵のたびの書き込みは、書き込み課金と相手側の読み取り課金の両方を跳ね上げ、無駄な負荷にもなります。対策はスロットリング（間引き）で、例えば入力開始時と数秒おきにだけ状態を更新し、一定時間入力がなければ自動で解除します。リアルタイム系の機能では「どこまで細かく同期する価値があるか」を課金モデルと突き合わせて決めることが、機能仕様そのものの設計判断になります。"
    },
    {
      q: "サービスが成長し、1,000人が参加するグループチャット機能を求められました。推奨構成のままで作るとどんな問題が起き、あなたならどう対応しますか。",
      a: "1通の書き込みが1,000人のリスナーへの配信と1,000回の読み取り課金になり、活発な部屋では料金と負荷が急増します。プッシュ通知も1書き込みごとに1,000件の判定が走ります。対応としては、開いていない部屋のリスナーを外して未読数だけ別ドキュメントで同期する、通知はトピック配信にまとめる、といった読み取りを減らす設計をまず尽くします。それでも配信制御が複雑になるなら、大人数の部屋だけ代替1のWebSocket構成へ切り出す判断も現実的です。規模が変わると同じ機能でも正解の構成が変わる、という典型例です。"
    }
  ]
});
