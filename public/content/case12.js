// ケース12：予約システム
registerCase({
  id: 12,
  category: "Webアプリ・EC",
  title: "予約システム",
  scenario: "<p>美容室・クリニックなど数百店舗が使う予約サービスを作りたい。利用者はスマホアプリから空き枠を検索して予約する。人気の時間帯には同じ枠への申し込みが同時に発生し、二重予約は業務上の重大事故になる。また無断キャンセルの削減が事業課題で、予約前日のリマインド通知を確実に届けたい。深夜はアクセスがほぼゼロになる一方、朝の予約開始時刻には集中する。開発・運用は3人の小さなチームです。</p>",
  requirements: [
    "同じ枠への同時申し込みでも二重予約を絶対に起こさない",
    "予約・キャンセルは即時に空き状況へ反映される",
    "予約前日のリマインド通知を送り漏れ・二重送信なく届けたい",
    "夜間の集計や期限切れデータの整理を定時実行したい",
    "アクセスの少ない時間帯のコストを抑えたい"
  ],
  main: {
    name: "Cloud Run+Cloud SQL+Cloud Tasks構成",
    diagram: {
      cols: 4, rows: 3,
      groups: [
        { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [3, 2] }
      ],
      nodes: [
        { id: "fcm", icon: "integration/fcm", label: "FCM\nプッシュ通知", col: 1, row: 0 },
        { id: "notif", icon: "compute/cloud-run", label: "Cloud Run\n通知ワーカー", col: 2, row: 0 },
        { id: "tasks", icon: "integration/cloud-tasks", label: "Cloud Tasks\n時限タスク", col: 3, row: 0 },
        { id: "users", icon: "client/mobile-client", label: "利用者\nスマホアプリ", col: 0, row: 1 },
        { id: "run", icon: "compute/cloud-run", label: "Cloud Run\n予約API", col: 1, row: 1 },
        { id: "sql", icon: "database/cloud-sql", label: "Cloud SQL\n予約/枠データ", col: 2, row: 1 },
        { id: "sched", icon: "integration/cloud-scheduler", label: "Cloud Scheduler\n日次ジョブ起動", col: 2, row: 2 }
      ],
      edges: [
        { from: "users", to: "run", label: "空き照会/予約" },
        { from: "run", to: "sql", label: "トランザクション" },
        { from: "run", to: "tasks", label: "リマインド登録" },
        { from: "tasks", to: "notif", label: "時刻到来でPOST" },
        { from: "notif", to: "fcm", label: "送信指示" },
        { from: "fcm", to: "users", label: "プッシュ通知" },
        { from: "sched", to: "run", dashed: true, label: "毎朝起動" }
      ]
    },
    flow: [
      "利用者のアプリからCloud Runの予約APIに空き照会・予約リクエストが届く。予約の書き込みはCloud SQLのトランザクションと一意制約で保護し、同じ枠の二重予約をデータベースの層で防ぐ",
      "予約が確定したら、Cloud Tasksに「前日20時に実行する」という実行時刻付きのリマインドタスクを登録する",
      "指定時刻が来るとCloud Tasksが通知ワーカー（別のCloud Runサービス）をHTTPで呼び出し、ワーカーがFCM経由で利用者のスマホへプッシュ通知を送る",
      "Cloud Schedulerは毎朝、予約APIの管理用エンドポイントを起動し、日次集計や期限切れ予約の整理といった定型ジョブを実行する"
    ],
    services: [
      { icon: "compute/cloud-run", name: "Cloud Run", role: "予約APIと通知ワーカーの実行基盤。リクエストが無い時間帯はゼロ台までスケールインし、朝の集中時は自動で増える" },
      { icon: "database/cloud-sql", name: "Cloud SQL", role: "予約・枠・会員データを保存するマネージドRDB。トランザクションと一意制約が二重予約防止の最後の砦" },
      { icon: "integration/cloud-tasks", name: "Cloud Tasks", role: "「指定時刻に1回だけHTTP呼び出しを行う」タスクキュー。リマインドのような個別時刻の処理予約に向く" },
      { icon: "integration/cloud-scheduler", name: "Cloud Scheduler", role: "cron形式の定時実行サービス。毎朝の集計など「繰り返しの定時ジョブ」を担当する" },
      { icon: "integration/fcm", name: "Firebase Cloud Messaging", role: "iOS/Android/Webへのプッシュ通知配信基盤。無料で利用できる" }
    ],
    points: [
      "二重予約対策をアプリの「空きチェック」に頼らないのが最重要ポイントです。チェックから書き込みまでの一瞬の隙に別の予約が入るため、枠IDに一意制約を張り、データベースが物理的に2件目を拒否する設計にします",
      "リマインドに「毎分起動して送信対象を探すバッチ」ではなくCloud Tasksを選んだのは、予約確定時に送信予定を登録しておけば、送り漏れも走査の無駄もなくなるためです。実行時刻は最大30日先まで指定でき、それより先の予約はSchedulerの日次ジョブで30日以内に入ったものを登録し直します",
      "通知ワーカーを予約APIと別サービスに分けたのは、通知先の障害やリトライが予約処理のスケーリングや応答時間に影響しないようにするためです",
      "Cloud TasksとCloud Schedulerの使い分けは「個別の時刻に1回」がTasks、「cronの繰り返し」がSchedulerです。この2つの混同は実務でよくあるつまずきです"
    ],
    pros: [
      "二重予約をデータベースの制約で構造的に防げる",
      "リマインドの送り漏れ・二重送信が起きにくい（Tasksが配信を管理しリトライも自動）",
      "深夜はCloud Runがゼロ台になり、従量部分のコストがほぼゼロ",
      "予約・通知・定時ジョブが部品ごとに分かれ、小チームでも見通しよく運用できる"
    ],
    cons: [
      "Cloud SQLは常時起動のため、アクセスゼロの時間帯も固定費がかかる",
      "予約キャンセル時はCloud Tasksに登録済みのリマインドタスクを削除する後始末が必要",
      "コールドスタート（ゼロ台からの起動遅延）が朝一番のリクエストに乗ることがあり、最小インスタンス数の調整が必要になる場合がある"
    ],
    cost: "<strong>月8,000円〜1万5,000円程度</strong>。内訳の目安はCloud SQL（1vCPU/3.75GB相当）約8,000円+Cloud Run数百円〜数千円。Cloud Tasksは月100万操作まで無料、Cloud Schedulerも3ジョブまで無料、FCMは無料のため、通知まわりの費用はほぼゼロです。東京リージョン・1USD=150円前後での概算です。",
    references: [
      { title: "Cloud Tasksの概要", url: "https://cloud.google.com/tasks/docs/dual-overview?hl=ja" },
      { title: "HTTPターゲットタスクの作成", url: "https://cloud.google.com/tasks/docs/creating-http-target-tasks?hl=ja", note: "実行時刻（scheduleTime）付きタスクの登録方法" },
      { title: "Cloud Schedulerの概要", url: "https://cloud.google.com/scheduler/docs/overview?hl=ja" },
      { title: "Firebase Cloud Messaging", url: "https://firebase.google.com/docs/cloud-messaging?hl=ja" },
      { title: "Cloud SQLの高可用性構成", url: "https://cloud.google.com/sql/docs/mysql/high-availability?hl=ja", note: "予約が止められない規模になったら検討する" }
    ]
  },
  alternatives: [
    {
      name: "Firestore中心のサーバーレス構成",
      when: "モバイルアプリ中心で空き状況のリアルタイム反映を重視する場合・データ構造が比較的単純な場合",
      diagram: {
        cols: 3, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [2, 1] }
        ],
        nodes: [
          { id: "fcm", icon: "integration/fcm", label: "FCM\nプッシュ通知", col: 1, row: 0 },
          { id: "tasks", icon: "integration/cloud-tasks", label: "Cloud Tasks\n時限タスク", col: 2, row: 0 },
          { id: "users", icon: "client/mobile-client", label: "利用者\nスマホアプリ", col: 0, row: 1 },
          { id: "run", icon: "compute/cloud-run", label: "Cloud Run\n予約API", col: 1, row: 1 },
          { id: "fstr", icon: "database/firestore", label: "Firestore\n予約/枠データ", col: 2, row: 1 }
        ],
        edges: [
          { from: "users", to: "run", label: "予約" },
          { from: "run", to: "fstr", label: "トランザクション" },
          { from: "run", to: "tasks", label: "リマインド登録" },
          { from: "tasks", to: "fcm", label: "時刻到来で送信指示" },
          { from: "fcm", to: "users", label: "プッシュ通知" }
        ]
      },
      flow: [
        "予約APIはFirestoreのトランザクションで枠ドキュメントを検証しつつ予約を書き込む。同じ枠に同時に書こうとした場合は片方が自動的に再試行・失敗する",
        "アプリはFirestoreのリアルタイムリスナー（データ変更の自動プッシュ通知機能）で空き状況の変化を即座に画面へ反映する",
        "リマインドはCloud TasksのHTTPタスクにOAuthトークンを付けてFCMのAPIを直接呼ばせることで、通知ワーカーを省略している"
      ],
      services: [
        { icon: "database/firestore", name: "Firestore", role: "予約・枠データを保存するサーバーレスNoSQL。リアルタイムリスナーとモバイルSDKが強み" },
        { icon: "compute/cloud-run", name: "Cloud Run", role: "予約ロジックの実行基盤。枠の検証や業務ルールはここに集約する" },
        { icon: "integration/cloud-tasks", name: "Cloud Tasks", role: "リマインドの時限実行。認証トークン付きでGoogleのAPIを直接呼び出せる" },
        { icon: "integration/fcm", name: "Firebase Cloud Messaging", role: "プッシュ通知の配信。空き状況の変化通知にも使える" }
      ],
      points: [
        "Firestoreのトランザクションは楽観的並行制御（衝突したら再試行する方式）で、二重予約はCloud SQL構成と同様に防げます。ただしSQLの集計・結合が使えないため、店舗横断の複雑な検索や管理画面の集計はBigQuery等への持ち出しが必要になります",
        "空き状況がリアルタイムに画面へ届く体験はFirestoreならではで、リロード不要のUIを少ないコードで実現できます。リアルタイム同期の詳細はケース39で扱います",
        "データベースまで完全従量課金になるため、店舗数が少ない立ち上げ期のコストはこちらが圧倒的に有利です"
      ],
      pros: [
        "データベース含め完全従量課金で、利用が少ない期間の固定費がほぼゼロ",
        "空き状況のリアルタイム反映を少ないコードで実現できる",
        "モバイルSDK・オフライン対応などアプリ開発との相性がよい"
      ],
      cons: [
        "SQLの結合・集計が使えず、複雑な検索や帳票は別の仕組みが必要",
        "課金が読み書き回数に比例するため、アクセスが伸びるとCloud SQLより高くなる転換点がある",
        "トランザクションの再試行を前提にした実装作法（べき等な書き込み）に慣れが必要"
      ],
      cost: "<strong>月数百円〜3,000円程度</strong>。Firestoreは1日5万回の読み取り・2万回の書き込みまで無料枠があり、小規模なら大半が枠内に収まります。Cloud Run・Cloud Tasks・FCMもほぼ無料枠内で、固定費が事実上ゼロになるのが最大の特徴です。",
      references: [
        { title: "Firestoreのトランザクション", url: "https://firebase.google.com/docs/firestore/manage-data/transactions?hl=ja", note: "二重予約防止の中核となる仕組み" },
        { title: "FCMサーバー環境の実装", url: "https://firebase.google.com/docs/cloud-messaging/server?hl=ja" },
        { title: "Cloud TasksでCloud Runをトリガーする", url: "https://cloud.google.com/run/docs/triggering/using-tasks?hl=ja" }
      ]
    },
    {
      name: "Pub/Subで受付と確定を分離する構成",
      when: "チケット販売のように発売開始直後に申し込みが殺到し、同期処理では捌ききれない場合",
      diagram: {
        cols: 5, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [4, 1] }
        ],
        nodes: [
          { id: "users", icon: "client/mobile-client", label: "利用者\nスマホアプリ", col: 0, row: 0 },
          { id: "run", icon: "compute/cloud-run", label: "Cloud Run\n受付API", col: 1, row: 0 },
          { id: "ps", icon: "integration/pubsub", label: "Pub/Sub\n申込キュー", col: 2, row: 0 },
          { id: "worker", icon: "compute/cloud-run", label: "Cloud Run\n確定ワーカー", col: 3, row: 0 },
          { id: "sql", icon: "database/cloud-sql", label: "Cloud SQL\n予約/枠データ", col: 4, row: 0 },
          { id: "fcm", icon: "integration/fcm", label: "FCM\nプッシュ通知", col: 3, row: 1 }
        ],
        edges: [
          { from: "users", to: "run", label: "申込殺到" },
          { from: "run", to: "ps", label: "申込を発行" },
          { from: "ps", to: "worker", label: "順次配信" },
          { from: "worker", to: "sql", label: "枠を確定" },
          { from: "worker", to: "fcm", label: "結果" },
          { from: "fcm", to: "users", label: "当落通知" }
        ]
      },
      flow: [
        "受付APIは申し込みを検証してPub/Subに発行し、「受け付けました」を即座に返す。データベースへの書き込みはこの時点では行わない",
        "確定ワーカーがPub/Subからメッセージを受け取り、Cloud SQLのトランザクションで枠を順次確定していく。データベースへの同時書き込み数をワーカー側で制御できる",
        "確定・落選の結果はFCMのプッシュ通知で利用者へ知らせる"
      ],
      services: [
        { icon: "integration/pubsub", name: "Pub/Sub", role: "申し込みを一時的に貯めるメッセージキュー。スパイクを受け止めて後段を守る緩衝材" },
        { icon: "compute/cloud-run", name: "Cloud Run", role: "受付APIと確定ワーカー。受付は軽量な検証のみで大量リクエストを捌く" },
        { icon: "database/cloud-sql", name: "Cloud SQL", role: "枠の確定を行う正となるデータベース。同時書き込みが平準化されるため小さめの構成で耐えられる" },
        { icon: "integration/fcm", name: "Firebase Cloud Messaging", role: "非同期になった結果（当選・落選）を利用者へ届ける通知手段" }
      ],
      points: [
        "「即時に結果を返す」ことを諦める代わりに、データベースを溶かさずスパイクを受け切るのがこの構成の考え方です。ユーザー体験は「申込完了→後で結果通知」に変わるため、事業側との合意が前提になります",
        "受付とデータベース書き込みの間にキューを挟むことで、Cloud SQLをスパイクに合わせて増強する必要がなくなり、コストを平常時基準で設計できます",
        "非同期処理の設計作法（順序・重複・リトライ）はケース15で体系的に扱います。この構成はその予約システムへの応用例です"
      ],
      pros: [
        "発売開始直後の数万件規模のスパイクでも受付を落とさない",
        "データベースへの負荷が平準化され、増強コストを抑えられる",
        "受付済みの申し込みはキューに残るため、ワーカー障害でも取りこぼさない"
      ],
      cons: [
        "「その場で予約確定」の体験ではなくなり、結果待ちのUI・通知設計が必要",
        "同期構成に比べて登場する部品と考えることが増え、実装・運用の難易度が上がる",
        "順番の保証や重複配信への対処など、非同期特有の設計課題を避けて通れない"
      ],
      cost: "<strong>月8,000円〜2万円程度</strong>。基本構成はメイン案と同じでPub/Subが加わりますが、Pub/Subは月10GiBのメッセージ量まで無料のため、費用差はごくわずかです。スパイク対策をデータベース増強で行う場合との比較では大幅に安くなります。",
      references: [
        { title: "Pub/Subの概要", url: "https://cloud.google.com/pubsub/docs/overview?hl=ja" },
        { title: "Pub/Sub pushでCloud Runを起動する", url: "https://cloud.google.com/run/docs/triggering/pubsub-push?hl=ja" }
      ]
    }
  ],
  cost: "<p>推奨構成は<strong>月8,000円〜1万5,000円程度</strong>で、費用の大半はCloud SQLの固定費です。Firestore案は<strong>月数百円〜3,000円程度</strong>と立ち上げ期の圧倒的な低コストが魅力ですが、読み書き量比例のため成長後に逆転が起きえます。Pub/Sub案はメイン案とほぼ同額で、<strong>スパイク対策をデータベース増強ではなく構成の工夫で行う</strong>のがコスト上の要点です（いずれも東京リージョン・1USD=150円前後の目安）。</p>",
  summary: "<p>予約システムの本質は「同時に来た申し込みをどう捌くか」です。<strong>二重予約はアプリのチェックではなくデータベースの制約・トランザクションで防ぐ</strong>のが鉄則で、これはCloud SQLでもFirestoreでも変わりません。もう1つの学びは時限処理の道具選びで、<strong>個別の時刻に1回ならCloud Tasks、cronの繰り返しならCloud Scheduler</strong>という使い分けはGCP設計の頻出パターンです。通知基盤を本格化させたくなったらケース42、非同期化の設計はケース15へ進んでください。</p>",
  quiz: [
    {
      q: "予約APIが「空きを確認してから書き込む」実装になっていれば、二重予約は起きないように思えます。それでもデータベースの一意制約が必要なのはなぜでしょうか。",
      a: "空き確認と書き込みは別々の処理のため、確認した直後・書き込む直前のわずかな間に別のリクエストが同じ枠を取る可能性があるからです。アプリ側のチェックは利用者に早く「埋まっています」と伝えるための補助であり、最後の砦はデータベースの一意制約やトランザクションです。同時実行で壊れない保証はアプリのロジックではなくデータ層に置く、というのが定石です。"
    },
    {
      q: "リマインド通知をCloud Tasksではなく「Cloud Schedulerで毎分起動し、送信時刻を過ぎた予約を検索して送る」方式で作るとどんな問題があるでしょうか。",
      a: "毎分全予約を走査する無駄が常時発生するうえ、バッチの障害や遅延がそのまま送信漏れ・二重送信につながります。走査済みかどうかの管理も自作が必要です。Cloud Tasksなら予約確定時に実行時刻付きタスクを登録するだけで、配信・リトライ・重複抑止をサービス側が管理してくれます。「個別の時刻に1回」はTasks、「繰り返しの定時実行」はSchedulerという役割分担を崩さないことが重要です。"
    },
    {
      q: "人気サロンの初売り予約で、受付開始の1分間に数万件の申し込みが殺到する見込みです。あなたなら現在の構成をどう変えますか。",
      a: "受付とデータベース書き込みの間にPub/Subを挟む非同期構成（代替パターン2）に切り替えます。受付APIは検証と発行だけを行って即応答し、確定ワーカーが順次処理することでCloud SQLを守ります。代わりに「その場で確定」の体験は失われるため、結果をプッシュ通知で知らせるUIへの変更を事業側と合意するのが先決です。データベースを一時的なピークに合わせて増強するより、構成で平準化する方が安全で安価です。"
    }
  ]
});
