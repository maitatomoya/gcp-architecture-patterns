// ケース15：非同期ジョブ処理
registerCase({
  id: 15,
  category: "サーバーレス・イベント駆動",
  title: "非同期ジョブ処理",
  scenario: "<p>業務システムに、数十万行のCSV取り込み・PDF帳票の一括生成・外部APIへの大量データ連携など、1件あたり数十秒〜数分かかる処理がある。画面のリクエストの中で実行するとタイムアウトし、ユーザーを待たせてしまう。処理は多少遅れてもよいが、取りこぼしは絶対に許されない。日中に依頼が集中し、夜間はほぼゼロという波もある。リクエストから処理を切り離し、確実に完了させる仕組みを作りたい状況です。</p>",
  requirements: [
    "時間のかかる処理を画面のリクエストから切り離したい",
    "依頼された処理は障害があっても取りこぼさない（最終的に必ず実行）",
    "失敗した処理を検知して原因調査・再実行できるようにしたい",
    "依頼が集中しても後段の処理を詰まらせない",
    "処理が無い時間帯はコストをゼロに近づけたい"
  ],
  main: {
    name: "Pub/Sub+Cloud Runワーカー構成",
    diagram: {
      cols: 5, rows: 2,
      groups: [
        { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [4, 1] }
      ],
      nodes: [
        { id: "dlq", icon: "integration/pubsub", label: "Pub/Sub\nデッドレター", col: 2, row: 0 },
        { id: "mon", icon: "ops/cloud-monitoring", label: "Cloud Monitoring\n滞留監視", col: 4, row: 0 },
        { id: "users", icon: "client/users", label: "ユーザー", col: 0, row: 1 },
        { id: "api", icon: "compute/cloud-run", label: "Cloud Run\n受付API", col: 1, row: 1 },
        { id: "ps", icon: "integration/pubsub", label: "Pub/Sub\nジョブキュー", col: 2, row: 1 },
        { id: "worker", icon: "compute/cloud-run", label: "Cloud Run\nワーカー", col: 3, row: 1 },
        { id: "gcs", icon: "storage/cloud-storage", label: "Cloud Storage\n成果物", col: 4, row: 1 }
      ],
      edges: [
        { from: "users", to: "api", label: "処理依頼" },
        { from: "api", to: "ps", label: "ジョブ発行" },
        { from: "ps", to: "worker", label: "push配信" },
        { from: "worker", to: "gcs", label: "成果物保存" },
        { from: "ps", to: "dlq", dashed: true, label: "規定回数失敗で退避" },
        { from: "ps", to: "mon", dashed: true, label: "メトリクス送信" }
      ]
    },
    flow: [
      "受付APIは依頼内容を検証してPub/Subのトピックへ発行し、受付IDを即座に返す。ユーザーの待ち時間はここで終わる",
      "Pub/Subのpushサブスクリプションが、認証トークン付きのHTTPリクエストでワーカー（別のCloud Runサービス）へメッセージを配信する",
      "ワーカーは処理を実行し、成果物をCloud Storageへ保存して成功応答（ACK）を返す。エラー応答や無応答の場合はPub/Subが自動で再配信する",
      "規定回数失敗したメッセージはデッドレタートピック（失敗メッセージの退避先）へ移され、無限リトライを防ぎつつ原因調査に回せる",
      "Cloud Monitoringが未処理メッセージ数や最古の未確認メッセージの経過時間を監視し、滞留したらアラートを飛ばす"
    ],
    services: [
      { icon: "integration/pubsub", name: "Pub/Sub", role: "ジョブの依頼を貯めるメッセージキュー。受付と実行を切り離し、スパイクの緩衝材にもなる" },
      { icon: "compute/cloud-run", name: "Cloud Run", role: "受付APIとワーカーの実行基盤。ワーカーは配信量に応じて自動スケールし、ゼロ件ならゼロ台になる" },
      { icon: "storage/cloud-storage", name: "Cloud Storage", role: "生成した帳票・変換結果など成果物の置き場。ユーザーへのダウンロード提供にも使う" },
      { icon: "ops/cloud-monitoring", name: "Cloud Monitoring", role: "キューの滞留を監視する目。ワーカーが黙って止まる障害を検知する要" }
    ],
    points: [
      "受付と実行を分ける利点は3つあります。ユーザーへの応答が即時になる、実行がリトライ付きで確実になる、スパイクがキューで平準化され後段が守られる、の3点セットです",
      "Pub/Subの配信保証はat-least-once（少なくとも1回：同じメッセージが2回届くことがある）です。そのためワーカーは冪等（同じ入力で何度実行しても結果が同じ）に作るのが鉄則で、ジョブIDでの処理済みチェックや上書き保存で実現します",
      "デッドレタートピックを必ず設定します。壊れた入力データによる失敗は何度リトライしても失敗するため、退避先が無いとリトライが無限に続き、正常なジョブの処理まで巻き込みます",
      "監視対象は「ワーカーが動いているか」ではなく「キューが滞留していないか」です。最古の未確認メッセージの経過時間を見れば、ワーカーが静かに死んでいても、処理能力が追いついていなくても、同じ指標で気づけます"
    ],
    pros: [
      "ユーザーを待たせず、重い処理を確実に完了させられる",
      "障害時もメッセージがキューに残り、復旧後に自動で処理が再開される",
      "依頼の波をキューが吸収し、ワーカーは自分のペースで処理できる",
      "処理が無い時間はワーカーがゼロ台になり、ほぼ従量課金だけになる"
    ],
    cons: [
      "at-least-once配信のため、冪等性の設計を避けて通れない",
      "「今どこまで進んだか」の進捗表示は、ジョブ状態の保存を自分で設計する必要がある",
      "Cloud Runのリクエストタイムアウト（最大60分）を超える処理はこの構成では扱えない",
      "同期処理に比べてデバッグ・追跡の難易度が上がる（分散トレースの整備が効く）"
    ],
    cost: "<strong>月1,000円〜1万円程度</strong>。Pub/Subは月10GiBのメッセージ量まで無料（以降1TiBあたり約6,000円）、Cloud Runは処理実行時間分のみ、Cloud Storageは保存量に応じて数百円〜。夜間ゼロならワーカー費用もゼロに近づきます。東京リージョン・1USD=150円前後での概算です。",
    references: [
      { title: "Pub/Subの概要", url: "https://cloud.google.com/pubsub/docs/overview?hl=ja" },
      { title: "pushサブスクリプション", url: "https://cloud.google.com/pubsub/docs/push?hl=ja", note: "Cloud Runへの配信で使う方式" },
      { title: "Pub/Sub pushでCloud Runを起動する", url: "https://cloud.google.com/run/docs/triggering/pubsub-push?hl=ja" },
      { title: "デッドレタートピック", url: "https://cloud.google.com/pubsub/docs/dead-letter-topics?hl=ja", note: "失敗メッセージの退避と再処理" },
      { title: "exactly-once配信", url: "https://cloud.google.com/pubsub/docs/exactly-once-delivery?hl=ja", note: "重複配信を減らしたい場合の選択肢（pullのみ）" }
    ]
  },
  alternatives: [
    {
      name: "Cloud Tasks構成",
      when: "実行レートの上限制御・個別ジョブの実行時刻指定・呼び出し先の明示的な指定をきめ細かく行いたい場合",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [3, 1] }
        ],
        nodes: [
          { id: "users", icon: "client/users", label: "ユーザー", col: 0, row: 0 },
          { id: "api", icon: "compute/cloud-run", label: "Cloud Run\n受付API", col: 1, row: 0 },
          { id: "tasks", icon: "integration/cloud-tasks", label: "Cloud Tasks\nタスクキュー", col: 2, row: 0 },
          { id: "worker", icon: "compute/cloud-run", label: "Cloud Run\nワーカー", col: 3, row: 0 },
          { id: "gcs", icon: "storage/cloud-storage", label: "Cloud Storage\n成果物", col: 3, row: 1 }
        ],
        edges: [
          { from: "users", to: "api", label: "処理依頼" },
          { from: "api", to: "tasks", label: "タスク登録" },
          { from: "tasks", to: "worker", label: "レート制御しつつPOST" },
          { from: "worker", to: "gcs", label: "成果物保存" }
        ]
      },
      flow: [
        "受付APIは依頼をCloud Tasksのキューへタスクとして登録する。タスクには呼び出し先URL・実行時刻・ペイロードを個別に指定できる",
        "Cloud Tasksはキューに設定した最大レート・最大同時実行数を守りながらワーカーへHTTPリクエストを送る",
        "ワーカーの失敗時はキューのリトライ設定（回数・間隔）に従って再実行される"
      ],
      services: [
        { icon: "integration/cloud-tasks", name: "Cloud Tasks", role: "配信レートや同時実行数を発行側が制御できるタスクキュー。個別タスクの実行時刻指定・キャンセルも可能" },
        { icon: "compute/cloud-run", name: "Cloud Run", role: "受付APIとワーカー。構成上の役割はPub/Sub案と同じ" },
        { icon: "storage/cloud-storage", name: "Cloud Storage", role: "成果物の保存先" }
      ],
      points: [
        "Pub/Subとの使い分けは公式ドキュメントにも整理があり、要点は制御の主導権です。Pub/Subは受け取る側が処理ペースを決める疎結合な放送、Cloud Tasksは送る側が「どこへ・いつ・どのペースで」を決める指示書です",
        "外部APIへの連携ジョブのように「相手の秒間リクエスト上限を絶対に超えられない」場合、キューの最大レート設定で確実に守れるCloud Tasksが適任です",
        "1つのメッセージを複数のシステムが同時に受け取る使い方（ファンアウト）はできません。その要件が出たらPub/Subに切り替えます"
      ],
      pros: [
        "秒間実行数・同時実行数を発行側が確実に制御できる",
        "タスク単位の実行時刻指定・重複排除・キャンセルなど、個別ジョブの管理機能が豊富",
        "呼び出し先を明示するモデルのため、挙動が追いやすく初心者にも直感的"
      ],
      cons: [
        "1メッセージを複数購読者へ届けるファンアウトができない",
        "地域リソースのため、複数リージョンにまたがる配送はPub/Subより不得意",
        "ストリーム的な大量イベント処理には向かない"
      ],
      cost: "<strong>月0円〜数千円程度</strong>。Cloud Tasksは月100万操作まで無料（以降100万操作あたり約60円）で、キュー自体の維持費はありません。全体の費用感はPub/Sub案とほぼ同じです。",
      references: [
        { title: "Cloud TasksとPub/Subの選択", url: "https://cloud.google.com/tasks/docs/comp-pub-sub?hl=ja", note: "使い分けの公式比較。このケースの核心的な参考資料" },
        { title: "Cloud Tasksの概要", url: "https://cloud.google.com/tasks/docs/dual-overview?hl=ja" }
      ]
    },
    {
      name: "Batch構成（重量級ジョブ向け）",
      when: "1件あたり数十分〜数時間かかる、または大量CPU・GPUを使う重量級ジョブの場合",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [3, 1] }
        ],
        nodes: [
          { id: "users", icon: "client/users", label: "ユーザー", col: 0, row: 0 },
          { id: "api", icon: "compute/cloud-run", label: "Cloud Run\n受付API", col: 1, row: 0 },
          { id: "batch", icon: "compute/batch", label: "Batch\nVMでジョブ実行", col: 2, row: 0 },
          { id: "gcs", icon: "storage/cloud-storage", label: "Cloud Storage\n入出力データ", col: 3, row: 0 },
          { id: "mon", icon: "ops/cloud-monitoring", label: "Cloud Monitoring\nジョブ監視", col: 2, row: 1 }
        ],
        edges: [
          { from: "users", to: "api", label: "処理依頼" },
          { from: "api", to: "batch", label: "ジョブ投入" },
          { from: "batch", to: "gcs", label: "結果保存" },
          { from: "batch", to: "mon", noArrow: true, dashed: true }
        ]
      },
      flow: [
        "受付APIはBatchのAPIへジョブ定義（コンテナイメージ・必要なCPU/メモリ・並列数）を投入する",
        "BatchがCompute EngineのVMを自動で確保してジョブを実行し、完了後はVMを自動で削除する",
        "入力データの読み込みと結果の保存はCloud Storageを介して行い、実行状況はCloud Monitoringで監視する"
      ],
      services: [
        { icon: "compute/batch", name: "Batch", role: "ジョブ定義を渡すとVMの確保・実行・後片付けまでを自動で行うバッチ実行サービス。時間制限が実質なく、GPUも使える" },
        { icon: "compute/cloud-run", name: "Cloud Run", role: "ジョブ投入の受付API。重い処理自体はBatchへ委譲する" },
        { icon: "storage/cloud-storage", name: "Cloud Storage", role: "ジョブの入出力データの受け渡し場所" },
        { icon: "ops/cloud-monitoring", name: "Cloud Monitoring", role: "ジョブの成否・実行時間の監視" }
      ],
      points: [
        "Cloud Runにはリクエスト最大60分のタイムアウトがあり、それを超える処理は土俵が変わります。動画のエンコード・機械学習の前処理・科学計算のような重量級はBatchの領域です",
        "VMはジョブ実行中しか課金されないため、サーバーレスに近い費用感で重量級の計算資源を使えます。さらにSpot VM（空きリソースを格安で使う代わりに中断されうるVM）を使うと大幅に安くなります",
        "定時実行の軽めのバッチであればCloud Run Jobsという中間の選択肢もあります。ケース16で扱うので、処理時間と資源要件で使い分けてください"
      ],
      pros: [
        "実行時間の制限を気にせず数時間規模のジョブを回せる",
        "GPU・大量CPU・大容量メモリなど資源要件の自由度が高い",
        "実行中のみ課金でアイドル費用ゼロ。Spot VMでさらに削減できる"
      ],
      cons: [
        "VMの起動を伴うため、処理開始までに数分のオーバーヘッドがある",
        "数秒で終わる小さなジョブを大量に捌く用途には不向き",
        "ジョブ定義（マシンタイプ・並列度の設計）にインフラ寄りの知識が必要"
      ],
      cost: "<strong>月数千円〜数万円程度（実行量次第）</strong>。Batch自体は無料で、実行に使ったVMの料金のみ課金されます。e2-standard-4（4vCPU）で1時間約20円が目安で、毎日2時間動かしても月1,200円程度。Spot VMなら同じ計算量を3分の1前後の費用で回せます。",
      references: [
        { title: "Batchのドキュメント", url: "https://cloud.google.com/batch/docs?hl=ja" },
        { title: "Batchの使ってみる", url: "https://cloud.google.com/batch/docs/get-started?hl=ja" },
        { title: "Cloud Runのリクエストタイムアウト", url: "https://cloud.google.com/run/docs/configuring/request-timeout?hl=ja", note: "60分の壁がBatchへの切り替え判断の起点" }
      ]
    }
  ],
  cost: "<p>Pub/Sub案・Cloud Tasks案はいずれも<strong>月1,000円〜1万円程度</strong>で、キュー自体の費用はほぼ無料枠内、費用の主体はワーカーの実行時間です。Batch案は<strong>実行したVM時間に比例</strong>し、重量級を毎日回しても月数千円〜に収まることが多いです（東京リージョン・1USD=150円前後の目安）。3案とも<strong>処理が無い時間の費用がほぼゼロ</strong>という点が共通で、常時起動のワーカーサーバーを持つ従来型と比べた最大の節約ポイントです。</p>",
  summary: "<p>非同期ジョブ処理は「受付と実行を分け、間にキューを挟む」という1つの型で、予約のスパイク対策（ケース12）からIoTデータ収集（ケース38)まで応用が利きます。設計の鍵は<strong>冪等性・デッドレター・滞留監視の3点セット</strong>で、これを外すと「たまに二重実行される」「失敗が静かに積もる」システムになります。道具選びは<strong>疎結合な配送はPub/Sub、配信の制御はCloud Tasks、重量級はBatch</strong>と覚えましょう。イベント駆動の発展形はケース17とケース19、定時バッチはケース16へ進んでください。</p>",
  quiz: [
    {
      q: "Pub/Subは「同じメッセージが2回届くことがある」仕様です。CSV取り込みジョブのワーカーは、これにどう備えるべきでしょうか。",
      a: "ワーカーを冪等に作ります。具体的にはジョブにIDを持たせ、処理開始時に処理済み記録を確認して二重実行を弾く、あるいは取り込み結果を毎回同じキーへの上書きにして2回実行しても結果が変わらないようにします。「重複は起きない前提で作る」のではなく「重複しても壊れない形で作る」のが非同期処理の基本姿勢で、これはPub/Subに限らずリトライのある仕組み全てに当てはまります。"
    },
    {
      q: "ワーカーのプロセスが不具合で静かに処理できなくなった場合、この構成ではどうやって気づけるでしょうか。監視対象の選び方も含めて考えてください。",
      a: "キューの滞留を監視しているため、最古の未確認メッセージの経過時間や未処理メッセージ数が伸びることでアラートが飛びます。ワーカーの死活そのものを監視する方式だと、プロセスは生きているのに処理だけ失敗しているケースを見逃します。「部品が動いているか」ではなく「仕事が流れているか」を監視するのが非同期システムの定石で、原因が何であれ同じ指標で検知できるのが利点です。"
    },
    {
      q: "新しく「1件あたり3時間かかる動画の一括変換」の要件が来ました。あなたなら今のPub/Sub+Cloud Runワーカー構成をどうしますか。",
      a: "Cloud Runのリクエストタイムアウトは最大60分のため、この構成のままでは実行できません。重量級ジョブだけBatchに逃がすのが現実的で、受付APIとキューの考え方は活かしつつ、ワーカーの代わりにBatchへジョブを投入する経路を追加します。既存の軽量ジョブはそのままCloud Runで処理し、ジョブの重さで実行基盤を使い分ける二本立てにします。処理時間と資源要件が実行基盤の選定条件になる、という判断の典型例です。"
    }
  ]
});
