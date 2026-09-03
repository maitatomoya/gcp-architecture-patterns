// ケース18：Webhook受信基盤
registerCase({
  id: 18,
  category: "サーバーレス・イベント駆動",
  title: "Webhook受信基盤",
  scenario: "<p>決済代行・ECモール・チャットツールなど複数の外部SaaSから、Webhook（イベント発生時に外部サービスがこちらのURLへHTTPで通知してくる仕組み）を受けて自社のデータベースへ反映したい。決済完了の通知を取りこぼすと売上の計上漏れという事故になる。セール日には通知が集中し、送信元のSaaSは数秒以内に応答がないと同じ通知を再送してくる。チームは3人で、通知の種類はこれからも増えていく見込み。</p>",
  requirements: [
    "通知を一件も取りこぼしたくない（受信した証拠を残す）",
    "送信元のタイムアウト（数秒）以内に必ず応答したい",
    "同じ通知が複数回届いても二重処理しない",
    "急増時も受信だけは止めない",
    "送信元が本物かを検証したい（署名検証）"
  ],
  main: {
    name: "Cloud Run受信+Pub/Subバッファ構成",
    diagram: {
      cols: 5, rows: 2,
      groups: [
        { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [4, 1] }
      ],
      nodes: [
        { id: "saas", icon: "client/external-saas", label: "外部SaaS\nWebhook送信元", col: 0, row: 0 },
        { id: "rcv", icon: "compute/cloud-run", label: "Cloud Run\n受信・署名検証", col: 1, row: 0 },
        { id: "ps", icon: "integration/pubsub", label: "Pub/Sub\nバッファ", col: 2, row: 0 },
        { id: "wrk", icon: "compute/cloud-run", label: "Cloud Run\n処理ワーカー", col: 3, row: 0 },
        { id: "fs", icon: "database/firestore", label: "Firestore\n結果・処理済み台帳", col: 4, row: 0 },
        { id: "dlq", icon: "integration/pubsub", label: "Pub/Sub\nデッドレター", col: 3, row: 1 }
      ],
      edges: [
        { from: "saas", to: "rcv", label: "HTTPS POST" },
        { from: "rcv", to: "ps", label: "即時発行" },
        { from: "ps", to: "wrk", label: "push配信" },
        { from: "wrk", to: "fs", label: "冪等に書き込み" },
        { from: "ps", to: "dlq", label: "再試行超過", dashed: true }
      ]
    },
    flow: [
      "外部SaaSがWebhookをHTTPS POSTで受信サービスへ送ってくる",
      "受信サービス（Cloud Run）は署名を検証し、ペイロードをそのままPub/Subへ発行して即座に200を返す。業務処理はここでは一切しない",
      "Pub/Subのpushサブスクリプションがワーカー（Cloud Run）へ配信し、ワーカーが業務処理を行ってFirestoreへ書き込む",
      "ワーカーは通知に含まれるイベントIDをFirestoreの台帳と照合し、処理済みならスキップする（冪等化）",
      "何度再試行しても失敗するメッセージはデッドレタートピックへ退避し、アラートを上げて後から人が調べる"
    ],
    services: [
      { icon: "compute/cloud-run", name: "Cloud Run（受信）", role: "署名検証とPub/Subへの発行だけを行う薄い入口。数十ミリ秒で応答を返す" },
      { icon: "integration/pubsub", name: "Pub/Sub", role: "受信と処理を切り離すバッファ。スパイクを吸収し、失敗時の再試行を担う" },
      { icon: "compute/cloud-run", name: "Cloud Run（ワーカー）", role: "業務処理の本体。処理量に応じて自動スケールする" },
      { icon: "database/firestore", name: "Firestore", role: "処理結果と処理済みイベントIDの台帳。二重処理の防止に使う" },
      { icon: "integration/pubsub", name: "Pub/Sub（デッドレター）", role: "何度やっても失敗するメッセージの退避先。問題の切り分けを助ける" }
    ],
    points: [
      "「受けること」と「処理すること」を分けました。受信サービスが重い処理を抱えると送信元のタイムアウトに間に合わず、SaaS側の再送が積み重なってかえって負荷が増えます。Pub/Subに入った時点で「受信の証拠」が残るのも重要です",
      "二重処理はイベントIDによる冪等（べきとう。同じ処理を繰り返しても結果が同じになる性質）化で防ぎます。送信元SaaSの再送とPub/Subの再配信という二重の理由で、同じ通知は「複数回来る」前提で設計します",
      "デッドレター（既定回数再試行しても処理できないメッセージの退避先）を用意したのは、壊れたペイロード1件が無限に再試行され続けて後続を巻き込むのを防ぐためです。退避されたら人が中身を見て判断します",
      "署名検証に使うシークレットはコードに埋め込まず、Secret Managerに置いて実行時に参照します（ケース50で深掘り）"
    ],
    pros: [
      "バッファ+自動再試行+デッドレターの三段構えで取りこぼしに強い",
      "スパイク時もPub/Subが受け止め、ワーカーは自分のペースで処理できる",
      "受信と処理を独立にスケール・デプロイでき、通知の種類の追加にも強い",
      "全体がサーバーレスで、通知が来ない時間帯の費用がほぼゼロ"
    ],
    cons: [
      "部品が増えるぶん「今どこまで進んだか」の追跡が複雑になる（ログの相関やトレースで補う）",
      "冪等化の台帳管理は自前実装が必要",
      "メッセージの順序は既定では保証されない（順序が必須の処理には順序指定キーの利用や設計上の工夫が要る）"
    ],
    cost: "<strong>月1,000円〜3,000円程度</strong>（月100万件・1件1KB・処理100ms想定）。Pub/Subは月10GiBまで無料でこの規模なら実質0円、Cloud Run2サービス分とFirestoreの書き込み課金が中心（東京リージョン・1USD=150円換算の目安）。",
    references: [
      { title: "Pub/Subの概要", url: "https://cloud.google.com/pubsub/docs/overview?hl=ja" },
      { title: "Pub/Sub pushでCloud Runを起動する", url: "https://cloud.google.com/run/docs/triggering/pubsub-push?hl=ja", note: "ワーカー起動部分の公式手順" },
      { title: "メッセージエラーの処理（再試行とデッドレター）", url: "https://cloud.google.com/pubsub/docs/handling-failures?hl=ja", note: "デッドレター設計の根拠" },
      { title: "メッセージの順序指定", url: "https://cloud.google.com/pubsub/docs/ordering?hl=ja", note: "順序が必要になったときに読む" },
      { title: "Firestoreドキュメント", url: "https://cloud.google.com/firestore/docs?hl=ja" }
    ]
  },
  alternatives: [
    {
      name: "Cloud Tasksでレート制御する構成",
      when: "処理の先に呼び出し回数制限のある外部APIがあり、配信の速さを細かく制御したい場合",
      diagram: {
        cols: 5, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [3, 1] }
        ],
        nodes: [
          { id: "saas", icon: "client/external-saas", label: "外部SaaS\nWebhook送信元", col: 0, row: 0 },
          { id: "rcv", icon: "compute/cloud-run", label: "Cloud Run\n受信・署名検証", col: 1, row: 0 },
          { id: "tasks", icon: "integration/cloud-tasks", label: "Cloud Tasks\nキュー", col: 2, row: 0 },
          { id: "wrk", icon: "compute/cloud-run", label: "Cloud Run\nワーカー", col: 3, row: 0 },
          { id: "fs", icon: "database/firestore", label: "Firestore\n結果保存", col: 3, row: 1 },
          { id: "ext", icon: "client/external-saas", label: "外部API\nレート制限あり", col: 4, row: 0 }
        ],
        edges: [
          { from: "saas", to: "rcv", label: "HTTPS POST" },
          { from: "rcv", to: "tasks", label: "タスク登録" },
          { from: "tasks", to: "wrk", label: "速度を制御して配信" },
          { from: "wrk", to: "ext", label: "外部API呼出" },
          { from: "wrk", to: "fs", label: "結果保存" }
        ]
      },
      flow: [
        "受信サービスがWebhookを検証し、Cloud Tasksのキューへタスクとして登録して即応答する",
        "Cloud Tasksがキューに設定したレート（例：秒10件）でワーカーへHTTP配信する",
        "ワーカーがレート制限のある外部APIを呼び出し、結果をFirestoreへ保存する"
      ],
      services: [
        { icon: "compute/cloud-run", name: "Cloud Run（受信/ワーカー）", role: "入口と処理本体。推奨構成と同じ役割分担" },
        { icon: "integration/cloud-tasks", name: "Cloud Tasks", role: "タスクキュー。配信レート・再試行回数・遅延実行をキュー設定で制御できる" },
        { icon: "database/firestore", name: "Firestore", role: "処理結果の保存先" }
      ],
      points: [
        "Pub/SubとCloud Tasksは似て非なる道具です。Pub/Subは「起きたこと」を複数の購読者へ広く配るためのもの、Tasksは「やるべきこと」を1つの宛先へ制御しながら届けるためのものです。配信レートの制御や個別タスクの遅延実行が要るならTasksを選びます",
        "キューのレート設定だけで外部APIの制限に合わせられるため、ワーカー側にレート制御のコードを書かずに済みます",
        "タスクごとに実行予定時刻を指定できるので、「30分後にリマインドを送る」のような使い方も同じ仕組みでできます（ケース12の予約リマインドが好例）"
      ],
      pros: [
        "配信レート・再試行上限・遅延実行をキューの設定だけで制御できる",
        "タスク単位で状態を確認でき、個別の再実行もしやすい"
      ],
      cons: [
        "同じイベントを複数のシステムへ同時に配るのは苦手（それはPub/Subの守備範囲）",
        "用途ごとにキューを設計する必要があり、通知の種類が増えると管理対象も増える"
      ],
      cost: "<strong>月1,000円前後〜</strong>。Cloud Tasksは100万オペレーションあたり約60円で、全体感は推奨構成とほぼ同じ。",
      references: [
        { title: "Cloud TasksとPub/Subの選択", url: "https://cloud.google.com/tasks/docs/comp-pub-sub?hl=ja", note: "使い分けの公式比較。このケースの核心" },
        { title: "Cloud Tasksの概要", url: "https://cloud.google.com/tasks/docs/dual-overview?hl=ja" }
      ]
    },
    {
      name: "Cloud Run単体の同期処理構成",
      when: "通知量が少なく処理が数百ミリ秒で終わる、社内ツール程度の規模の場合",
      diagram: {
        cols: 3, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [2, 1] }
        ],
        nodes: [
          { id: "saas", icon: "client/external-saas", label: "外部SaaS\nWebhook送信元", col: 0, row: 0 },
          { id: "run", icon: "compute/cloud-run", label: "Cloud Run\n受信して同期処理", col: 1, row: 0 },
          { id: "fs", icon: "database/firestore", label: "Firestore\n結果保存", col: 2, row: 0 },
          { id: "log", icon: "ops/cloud-logging", label: "Cloud Logging\n処理記録", col: 1, row: 1 }
        ],
        edges: [
          { from: "saas", to: "run", label: "HTTPS POST" },
          { from: "run", to: "fs", label: "その場で書き込み" },
          { from: "run", to: "log", dashed: true }
        ]
      },
      flow: [
        "WebhookをCloud Runが受け、その場で署名検証から業務処理、Firestoreへの書き込みまで行う",
        "処理が成功したら200を返す。失敗時は5xxを返し、送信元SaaSの再送に期待する",
        "処理の記録はCloud Loggingで確認する"
      ],
      services: [
        { icon: "compute/cloud-run", name: "Cloud Run", role: "受信から処理まで1サービスで完結させる" },
        { icon: "database/firestore", name: "Firestore", role: "処理結果の保存先" },
        { icon: "ops/cloud-logging", name: "Cloud Logging", role: "受信と処理の記録。障害時に唯一の手がかりになる" }
      ],
      points: [
        "部品が少なく理解も運用も簡単です。まずこの形で始めて、量や重要度が上がったら推奨構成へ育てるのは正しい順序です",
        "取りこぼし耐性は送信元SaaSの再送仕様に完全に依存します。再送してくれない・再送回数が少ないSaaSが相手なら、最初からバッファを挟むべきです",
        "処理時間が送信元のタイムアウトに近づいてきたら、この構成の限界のサインです。処理を切り離す先としてPub/Sub（推奨構成）を挟みます"
      ],
      pros: [
        "最小構成で、ほぼ無料枠内で動く",
        "同期処理なのでデバッグが単純"
      ],
      cons: [
        "スパイクや自サービス障害の間の通知は、送信元が再送してくれなければ失われる",
        "重い処理を足すと送信元タイムアウトに間に合わなくなる"
      ],
      cost: "<strong>月0円〜数百円</strong>。通知が少なければCloud Run・Firestoreとも無料枠内が中心。",
      references: [
        { title: "Cloud Runドキュメント", url: "https://cloud.google.com/run/docs?hl=ja" },
        { title: "Cloud Loggingドキュメント", url: "https://cloud.google.com/logging/docs?hl=ja" }
      ]
    }
  ],
  cost: "<p>推奨構成は<strong>月1,000円〜3,000円程度</strong>（月100万件想定）で、通知量が10分の1なら費用もほぼ10分の1になります。Cloud Tasks案もほぼ同水準です。単体構成は<strong>ほぼ0円</strong>で済みますが、取りこぼしのリスクを送信元の再送仕様に預けることになります。「決済のように落とせない通知か」がお金より先に来る判断軸です（金額は東京リージョン・1USD=150円換算の目安）。</p>",
  summary: "<p>Webhook受信の定石は<strong>「薄い受信サービスで即応答し、Pub/Subに積んでから処理する」</strong>です。学びは3つで、(1)受信と処理の分離が取りこぼしと再送の嵐を防ぐ、(2)同じ通知は複数回来る前提でイベントIDにより冪等化する、(3)広く配るならPub/Sub・制御して届けるならCloud Tasksという使い分け、です。この「キューを挟んで切り離す」考え方はケース15の非同期ジョブ処理と同じ骨格で、イベントが複数サービスへ広がっていく発展形はケース19で学びます。</p>",
  quiz: [
    {
      q: "受信サービスはなぜ業務処理をせず、Pub/Subへ発行してすぐ200を返すのでしょうか。「その場で処理した方が単純では」という意見にどう答えますか。",
      a: "送信元SaaSは数秒で応答がないと失敗とみなして再送してくるため、重い処理を抱えるとタイムアウトと再送が繰り返され、負荷が雪だるま式に増えるからです。即応答すれば再送は起きず、Pub/Subに入った時点で受信の証拠も残ります。処理はワーカーが自分のペースで行い、失敗してもPub/Subの再試行に任せられます。その場処理が許されるのは、量が少なく処理が確実に軽い場合に限られます。"
    },
    {
      q: "同じ決済完了Webhookが3回届き、売上が3回計上されそうになりました。どこで防ぐのが正解でしょうか。",
      a: "ワーカーが処理の冒頭でイベントIDをFirestoreの処理済み台帳と照合し、既に処理済みならスキップする冪等化で防ぎます。重複は送信元の再送とPub/Subの再配信の両方で正常に発生するため、「重複を来なくする」ことは原理的にできず、「重複しても1回しか効かない」側に倒すのが正解です。決済のような金額が絡む処理では、台帳への記録と業務処理を同一トランザクションで行うことまで検討します。"
    },
    {
      q: "新しい要件で、受信したWebhookの内容を秒5件までしか受け付けない会計SaaSのAPIへ転記することになりました。あなたなら構成をどう変えますか。",
      a: "会計SaaSへの転記経路にはPub/SubではなくCloud Tasksを使います。キューに秒5件の配信レートを設定すれば、ワーカー側にレート制御のコードを書かずに相手の制限へ正確に合わせられ、超過分はキューが待たせてくれます。既存のFirestore反映はPub/Subのままでよいので、同じWebhookをPub/Subで受けた後、転記用のタスクをTasksへ積む二段構えにします。広く配る仕事と制御して届ける仕事で道具を分けるのがポイントです。"
    }
  ]
});
