// ケース42：プッシュ通知基盤
registerCase({
  id: 42,
  category: "IoT・リアルタイム",
  title: "プッシュ通知基盤",
  scenario: "<p>数百万MAUのECアプリで、セール告知やカート放棄リマインドのプッシュ通知を運用したい。マーケティング担当者が管理画面から「直近30日に購入したユーザー」のような<strong>セグメントを指定して配信予約</strong>し、到達数・開封数を測定して次の施策につなげます。全ユーザーへの一斉配信もあれば、数千人だけへの絞り込み配信もあります。大量送信で自社のAPIやデータベースを巻き込んで倒してしまった過去があり、流量の制御も重要な要件です。</p>",
  requirements: [
    "iOS/Android両対応でプッシュ通知を配信したい",
    "行動履歴に基づくセグメント抽出をして配信対象を絞りたい",
    "数百万件を送っても自社APIやDBが過負荷にならない流量制御",
    "到達・開封をデータとして蓄積し効果測定したい",
    "アンインストール済み端末の無効トークンを掃除し続けたい"
  ],
  main: {
    name: "FCM+Cloud Tasksによるセグメント配信構成",
    diagram: {
      cols: 6, rows: 2,
      groups: [
        { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [4, 1] }
      ],
      nodes: [
        { id: "admin", icon: "client/office", label: "配信担当者\n管理画面", col: 0, row: 1 },
        { id: "runAdmin", icon: "compute/cloud-run", label: "Cloud Run\n配信管理API", col: 1, row: 1 },
        { id: "bq", icon: "analytics/bigquery", label: "BigQuery\n抽出/効果測定", col: 2, row: 0 },
        { id: "tasks", icon: "integration/cloud-tasks", label: "Cloud Tasks\n送信キュー", col: 2, row: 1 },
        { id: "runWorker", icon: "compute/cloud-run", label: "Cloud Run\n送信ワーカー", col: 3, row: 1 },
        { id: "fs", icon: "database/firestore", label: "Firestore\nトークン台帳", col: 4, row: 0 },
        { id: "fcm", icon: "integration/fcm", label: "FCM\n配信基盤", col: 4, row: 1 },
        { id: "mobile", icon: "client/mobile-client", label: "モバイル\nアプリ", col: 5, row: 1 }
      ],
      edges: [
        { from: "admin", to: "runAdmin", label: "配信を登録" },
        { from: "runAdmin", to: "bq", label: "対象を抽出" },
        { from: "runAdmin", to: "tasks", label: "タスク投入" },
        { from: "tasks", to: "runWorker", label: "レート制御" },
        { from: "runWorker", to: "fs", label: "トークン参照" },
        { from: "runWorker", to: "fcm", label: "送信要求" },
        { from: "fcm", to: "mobile", label: "プッシュ配信" },
        { from: "runWorker", to: "bq", label: "結果を記録" },
        { from: "mobile", to: "fs", label: "トークン登録", dashed: true }
      ]
    },
    flow: [
      "アプリは起動時にFCMからデバイストークン（端末を識別する配送先住所のような文字列）を取得し、API経由でFirestoreの台帳に登録する",
      "配信担当者が管理画面からセグメント・文面・配信時刻を登録すると、Cloud RunがBigQueryで対象ユーザーを抽出する",
      "抽出結果を数百件ずつの送信タスクに分割してCloud Tasksへ投入する。Cloud Tasksは設定したレート（毎秒の実行数）を守って送信ワーカーを起動する",
      "送信ワーカーはFirestoreからトークンを取り出してFCMへ送信要求を出し、FCMがAppleのAPNsやAndroid端末への実際の配送を担う",
      "送信結果（成功・無効トークンなど）をBigQueryへ記録し、無効と判明したトークンはFirestoreから削除する。開封イベントもアプリからAPI経由で記録し効果測定に使う"
    ],
    services: [
      { icon: "integration/fcm", name: "Firebase Cloud Messaging", role: "プッシュ通知の配送基盤。iOSのAPNsとの連携も含めた端末への実配送を無料で担う" },
      { icon: "integration/cloud-tasks", name: "Cloud Tasks", role: "送信ジョブのキュー。実行レートの上限・リトライ・個別タスクの管理ができ、下流を過負荷から守る" },
      { icon: "compute/cloud-run", name: "Cloud Run", role: "配信管理APIと送信ワーカー。どちらもリクエスト応答型なのでサーバーレスが適任" },
      { icon: "database/firestore", name: "Firestore", role: "ユーザーとデバイストークンの対応台帳。登録・失効の頻繁な更新に強い" },
      { icon: "analytics/bigquery", name: "BigQuery", role: "入口（セグメント抽出）と出口（到達・開封の効果測定）の両方を担う分析基盤" }
    ],
    points: [
      "配送そのものはFCMに任せる。APNs証明書の管理や端末との接続維持といった重い部分をGoogleが無料で肩代わりしてくれるのがこの構成の土台",
      "Cloud Tasksを挟むのは流量制御のため。毎秒の実行数を指定でき、送信処理が自社DBやAPIを参照しても過負荷にならない。スループット最優先ならPub/Sub（代替パターン参照）と使い分ける",
      "BigQueryを抽出と測定の両方に使うことで「配信した結果を次のセグメント条件に使う」ループが同じ基盤で回る",
      "この図にVPCもNATも無いのは、全部品がマネージド・サーバーレスでVPCを作る必要がないため。GCPらしいサーバーレス構成の典型例"
    ],
    pros: [
      "FCMの配送が無料のため、数百万規模でも配信自体のコストがほぼかからない",
      "レートを自分で制御でき、周辺システムを巻き込む事故を防げる",
      "サーバーレス構成でアイドル時の費用がほぼゼロ",
      "抽出から効果測定まで一気通貫でデータが残る"
    ],
    cons: [
      "トークンの失効・更新などFCM固有の仕様の理解と掃除の運用が必要",
      "レートを絞るほど全件送信の所要時間は延びる（制御と速度のトレードオフ）",
      "iOSでの表示可否は最終的にAPNsと端末設定に依存し、完全な到達保証はできない"
    ],
    cost: "<strong>月数千円〜2万円程度</strong>（100万通/日規模の目安。東京リージョン・1USD=150円換算）。FCMの配信は無料。Cloud Tasksは100万タスクあたり約60円、ほかはCloud Run・Firestore・BigQueryの従量課金が中心です。規模が10倍になっても線形にしか増えないのがこの構成の強みです。",
    references: [
      { title: "Firebase Cloud Messaging", url: "https://firebase.google.com/docs/cloud-messaging?hl=ja", note: "FCM公式ドキュメントの入口" },
      { title: "FCM登録トークンの管理のベストプラクティス", url: "https://firebase.google.com/docs/cloud-messaging/manage-tokens?hl=ja", note: "トークン台帳と無効トークン掃除の公式ガイド" },
      { title: "Cloud Tasksドキュメント", url: "https://cloud.google.com/tasks/docs?hl=ja" },
      { title: "Cloud TasksとPub/Subの比較", url: "https://cloud.google.com/tasks/docs/comp-pub-sub?hl=ja", note: "工夫点で触れた使い分けの公式解説" },
      { title: "BigQueryの概要", url: "https://cloud.google.com/bigquery/docs/introduction?hl=ja" }
    ]
  },
  alternatives: [
    {
      name: "FCMトピック配信+コンソール運用",
      when: "配信対象が「お知らせ購読者」のような静的な区分で表現でき、開発工数を最小にしたい初期フェーズの場合",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [2, 1] }
        ],
        nodes: [
          { id: "admin", icon: "client/office", label: "担当者\nコンソール操作", col: 0, row: 0 },
          { id: "sched", icon: "integration/cloud-scheduler", label: "Cloud Scheduler\n定期実行", col: 1, row: 1 },
          { id: "fn", icon: "compute/cloud-functions", label: "Cloud Functions\n配信処理", col: 2, row: 1 },
          { id: "fcm", icon: "integration/fcm", label: "FCM\nトピック配信", col: 2, row: 0 },
          { id: "mobile", icon: "client/mobile-client", label: "モバイル\nアプリ", col: 3, row: 0 }
        ],
        edges: [
          { from: "admin", to: "fcm", label: "トピックへ配信" },
          { from: "sched", to: "fn", label: "定時トリガー" },
          { from: "fn", to: "fcm", label: "APIで配信" },
          { from: "fcm", to: "mobile", label: "購読者へ一斉配信" }
        ]
      },
      flow: [
        "アプリが興味のあるトピック（新着セール、お気に入り店舗など）をSDKで購読する",
        "担当者はFirebaseコンソールからトピック宛てに通知を作成して配信する。対象者の管理はFCMが行うため台帳が不要",
        "毎朝の定期配信などはCloud SchedulerがCloud Functionsを起動し、FCMのAPIを呼んで送る",
        "開封などの基本的な計測はFirebaseコンソールのレポートで確認する"
      ],
      services: [
        { icon: "integration/fcm", name: "Firebase Cloud Messaging", role: "トピック購読者への一斉配信を担う。購読者リストの管理も内包する" },
        { icon: "integration/cloud-scheduler", name: "Cloud Scheduler", role: "cron形式で定期配信のきっかけを作るマネージドスケジューラ" },
        { icon: "compute/cloud-functions", name: "Cloud Functions", role: "定期配信時にFCMのAPIを呼ぶ小さな処理。管理画面を作らずに自動化できる" }
      ],
      points: [
        "トークン台帳もキューも持たない最小構成。トピックという「購読ベースの静的な区分」で足りるうちはこれで十分",
        "行動履歴からの動的なセグメント（直近30日購入者など）はトピックでは表現できない。この要件が出た時が推奨構成へ進む分かれ目",
        "レート制御ができないため、通知タップで自社APIへ一斉アクセスが来るスパイクには別途対策が必要"
      ],
      pros: [
        "実装がSDKの購読数行とコンソール操作だけで済み、その日から使える",
        "費用がほぼゼロ（FCM無料+Functions/Schedulerの無料枠）"
      ],
      cons: [
        "動的セグメント配信ができない",
        "配信の流量制御ができず、タップ後の自社システムへのスパイク対策は別途必要",
        "効果測定はコンソールのレポート機能の範囲に限られる"
      ],
      cost: "<strong>月0円〜数百円</strong>。FCMは無料、Cloud SchedulerとCloud Functionsは無料枠内に収まることがほとんど。",
      references: [
        { title: "トピックメッセージング", url: "https://firebase.google.com/docs/cloud-messaging/android/topic-messaging?hl=ja" },
        { title: "Cloud Schedulerドキュメント", url: "https://cloud.google.com/scheduler/docs?hl=ja" }
      ]
    },
    {
      name: "Pub/Subファンアウトによる大規模一斉配信",
      when: "数千万規模の端末へ短時間で一斉配信したい、スループット最優先の場合",
      diagram: {
        cols: 6, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [4, 1] }
        ],
        nodes: [
          { id: "admin", icon: "client/office", label: "配信担当者", col: 0, row: 1 },
          { id: "runAdmin", icon: "compute/cloud-run", label: "Cloud Run\n配信API", col: 1, row: 1 },
          { id: "pubsub", icon: "integration/pubsub", label: "Pub/Sub\nジョブ分配", col: 2, row: 1 },
          { id: "bq", icon: "analytics/bigquery", label: "BigQuery\n到達ログ", col: 3, row: 0 },
          { id: "runWorker", icon: "compute/cloud-run", label: "Cloud Run\n並列ワーカー", col: 3, row: 1 },
          { id: "fcm", icon: "integration/fcm", label: "FCM\n配信基盤", col: 4, row: 1 },
          { id: "mobile", icon: "client/mobile-client", label: "モバイル\nアプリ", col: 5, row: 1 }
        ],
        edges: [
          { from: "admin", to: "runAdmin", label: "一斉配信を指示" },
          { from: "runAdmin", to: "pubsub", label: "宛先を分割発行" },
          { from: "pubsub", to: "runWorker", label: "pushで並列起動" },
          { from: "runWorker", to: "fcm", label: "送信要求" },
          { from: "fcm", to: "mobile", label: "プッシュ配信" },
          { from: "runWorker", to: "bq", label: "結果を記録" }
        ]
      },
      flow: [
        "配信APIが宛先リストを数百件単位のメッセージに分割し、Pub/Subへまとめて発行する",
        "Pub/SubのpushサブスクリプションがCloud Runワーカーを起動し、Cloud Runは負荷に応じて自動で並列数を増やす",
        "各ワーカーが担当分をFCMへ送信し、結果をBigQueryへ記録する",
        "ワーカーの暴走を防ぐため、Cloud Runの最大インスタンス数で並列の上限を抑える"
      ],
      services: [
        { icon: "integration/pubsub", name: "Pub/Sub", role: "配信ジョブの分配役。秒間数十万メッセージ級のスループットで一斉配信の起爆剤になる" },
        { icon: "compute/cloud-run", name: "Cloud Run", role: "並列送信ワーカー。Pub/Subのpush配信を受けて自動スケールする" },
        { icon: "integration/fcm", name: "Firebase Cloud Messaging", role: "端末への実配送" },
        { icon: "analytics/bigquery", name: "BigQuery", role: "送信結果の記録と分析" }
      ],
      points: [
        "Cloud Tasksがレート制御に強いのに対し、Pub/Subはスループットに強い。速報ニュースのような「全員に今すぐ」はこちらが向く",
        "Pub/Subは最低1回配信（同じメッセージが稀に2回届く）なので、配信IDで重複送信を排除する冪等な実装が必須",
        "個別タスクの完了追跡や実行時刻指定はTasksより弱い。要件が混在するならトピックを分けて両方式を併用してもよい"
      ],
      pros: [
        "数千万件でも短時間で送り切れるスループット",
        "並列数はCloud Runが自動調整し、キャパシティ設計が不要"
      ],
      cons: [
        "細かいレート制御ができず、下流保護は最大インスタンス数などで間接的に行うしかない",
        "最低1回配信のため重複配信対策（冪等化）が必須",
        "1件ずつのキャンセルや実行時刻指定はできない"
      ],
      cost: "<strong>月1万円〜5万円程度</strong>（月数千万通規模の目安）。Pub/Subはデータ量課金（1TiBあたり約6,000円）だが通知は小さいので安く、Cloud Runの並列実行分が主な費用になる。",
      references: [
        { title: "Pub/Subの概要", url: "https://cloud.google.com/pubsub/docs/overview?hl=ja" },
        { title: "Cloud TasksとPub/Subの比較", url: "https://cloud.google.com/tasks/docs/comp-pub-sub?hl=ja", note: "公式の使い分け解説" }
      ]
    }
  ],
  cost: "<p>推奨構成は<strong>月数千円〜2万円程度</strong>（100万通/日規模）。トピック配信だけなら<strong>ほぼ0円</strong>、Pub/Subファンアウトは<strong>月1万円〜5万円程度</strong>（数千万通規模）が目安です。どの構成でも配送そのもの（FCM）が無料なため、費用は抽出・キュー・ワーカー・分析という周辺部分で決まります。</p>",
  summary: "<p>プッシュ通知基盤の設計は「配送はFCMに任せる」が大前提で、腕の見せどころは<strong>その手前のジョブ管理</strong>にあります。レート制御と個別管理が要るならCloud Tasks、スループット最優先ならPub/Sub、という使い分けはケース15の非同期処理とも共通するGCPの頻出判断です。トークン台帳の掃除と効果測定のデータ蓄積という地味な運用要件まで最初から設計に含めることが、数百万規模で破綻しない基盤の条件です。</p>",
  quiz: [
    {
      q: "送信ジョブの分配にPub/SubでなくCloud Tasksを選んだ理由は何でしょうか。逆にPub/Subを選ぶべきなのはどんなときですか。",
      a: "Cloud Tasksは実行レートの上限を指定でき、送信処理が参照する自社DBやAPIを過負荷から守れるからです。個別タスクのリトライや実行時刻指定もできます。一方Pub/Subはレート制御が苦手な代わりにスループットが桁違いなので、速報のように数千万件を今すぐ送り切りたい場合に向きます。制御のTasks、速度のPub/Subという対比で覚えておくと他のケースにも応用できます。"
    },
    {
      q: "FCMの配信は無料なのに、なぜトークンの台帳をFirestoreに自前で持ち、無効トークンを削除し続ける必要があるのでしょうか。",
      a: "デバイストークンは機種変更やアンインストール、再インストールで頻繁に失効・更新されるからです。ユーザーIDとトークンの対応は自社にしか分からないため、セグメント配信をするなら台帳の自前管理が避けられません。無効トークンへ送り続けると送信処理の無駄が積み上がり、FCM側からの評価にも影響します。送信結果で返る無効通知を拾って削除する掃除のループを最初から組み込むのが公式のベストプラクティスです。"
    },
    {
      q: "「明日の朝7時に全ユーザー500万人へセール開始通知を送りたい」と依頼されました。あなたはこの基盤で何に気をつけて設計しますか。",
      a: "まずレート設定と所要時間の逆算です。毎秒1,000件なら500万件に約83分かかるため、7時に届き切りたいなら前倒しで開始する必要があります。次に通知タップで自社サイトへ同時アクセスが集中するので、CDNやCloud Runの最大インスタンス数など受け側の備えも合わせて確認します。さらにオプトアウト設定の尊重と、深夜帯にかからない時刻設計も必要です。配信基盤単体でなく、その後のトラフィックまで含めて考えるのが実務の設計です。"
    }
  ]
});
