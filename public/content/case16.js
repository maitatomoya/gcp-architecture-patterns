// ケース16：定期バッチ処理
registerCase({
  id: 16,
  category: "サーバーレス・イベント駆動",
  title: "定期バッチ処理",
  scenario: "<p>ECサイトの受注データとアクセスログを毎晩集計し、翌朝までに日次レポートを作りたい。日中はケース7のようなWebサービスが動いていて、集計処理は毎晩30分ほど、月末の締め処理では数時間になることもある。担当エンジニアは2人で、夜間バッチのためだけに常時起動のサーバーを持ちたくない。cron（クーロン。決まった時刻にコマンドを自動実行するUNIXの仕組み）で動かしていた頃の「朝来たら失敗していた」を卒業したい。</p>",
  requirements: [
    "毎晩決まった時刻に自動実行したい（実行のたびに人手をかけない）",
    "実行していない時間帯の料金はゼロにしたい",
    "処理は数十分かかる（HTTPリクエストのタイムアウトには収まらない）",
    "失敗したら翌朝までに気づける仕組みがほしい",
    "データ量が増えても作り直しになりにくい構成にしたい"
  ],
  main: {
    name: "Cloud Scheduler+Cloud Run Jobs構成",
    diagram: {
      cols: 5, rows: 2,
      groups: [
        { type: "gcp-cloud", label: "Google Cloud", from: [0, 0], to: [3, 1] }
      ],
      nodes: [
        { id: "sched", icon: "integration/cloud-scheduler", label: "Cloud Scheduler\n毎晩2時に発火", col: 0, row: 0 },
        { id: "job", icon: "compute/cloud-run-jobs", label: "Cloud Run Jobs\n集計バッチ", col: 1, row: 0 },
        { id: "bq", icon: "analytics/bigquery", label: "BigQuery\nロード先・集計", col: 3, row: 0 },
        { id: "gcs", icon: "storage/cloud-storage", label: "Cloud Storage\n生データ/レポート", col: 2, row: 1 },
        { id: "mon", icon: "ops/cloud-monitoring", label: "Cloud Monitoring\n失敗検知", col: 3, row: 1 },
        { id: "ops", icon: "client/email", label: "運用者\nメール通知", col: 4, row: 0 }
      ],
      edges: [
        { from: "sched", to: "job", label: "定時起動" },
        { from: "job", to: "bq", label: "ロード・集計SQL" },
        { from: "job", to: "gcs", label: "レポート出力" },
        { from: "gcs", to: "bq", label: "生データ読込" },
        { from: "job", to: "mon", dashed: true },
        { from: "mon", to: "ops", label: "アラート" }
      ]
    },
    flow: [
      "Cloud Schedulerがcron式のスケジュールに従い、毎晩2時にCloud Run Jobsの実行を呼び出す",
      "Cloud Run Jobsのコンテナが起動し、日中にCloud Storageへ蓄積された生データをBigQueryへロードする",
      "BigQueryで集計SQLを実行して日次の集計テーブルを更新する",
      "集計結果をCSVレポートとしてCloud Storageへ書き出し、ジョブは正常終了してコンテナは消える",
      "ジョブの失敗はCloud Monitoringのアラートポリシーが検知し、運用者へメールで通知する"
    ],
    services: [
      { icon: "integration/cloud-scheduler", name: "Cloud Scheduler", role: "フルマネージドのcron。決まった時刻にジョブの実行を呼び出す係で、3ジョブまで無料" },
      { icon: "compute/cloud-run-jobs", name: "Cloud Run Jobs", role: "バッチ処理専用のコンテナ実行環境。起動して、処理して、終わる。動いた時間だけ課金" },
      { icon: "storage/cloud-storage", name: "Cloud Storage", role: "日中に溜まる生データの置き場と、完成したレポートの保存先" },
      { icon: "analytics/bigquery", name: "BigQuery", role: "サーバーレスのデータ分析基盤。重い集計はSQLとしてここに任せる" },
      { icon: "ops/cloud-monitoring", name: "Cloud Monitoring", role: "ジョブの失敗を検知してアラートを飛ばす。バッチは「失敗に朝まで気づかない」が最大の敵" }
    ],
    points: [
      "Webサービス用のCloud Run（サービス）ではなくCloud Run Jobsを選びました。サービスはHTTPリクエストに応答する形式でタイムアウトの制約を受けますが、Jobsは「起動して、やり切って、終わる」というバッチの形にそのまま合い、HTTPサーバーのコードも不要です",
      "重い集計はコンテナの中で頑張らず、BigQueryのSQLへ寄せました。バッチ側で大量データを読み込むとメモリと時間が際限なく必要になりますが、BigQueryなら計算はサーバーレスに分散され、ジョブ本体は「指示を出す係」で済みます",
      "再実行しても壊れない冪等（べきとう。同じ処理を何度実行しても結果が同じになる性質）な作りにしました。日付単位でテーブルを洗い替えるので、失敗した日はもう一度実行すればよいだけです",
      "Cloud Run Jobsの自動再試行に加えて、Monitoringで「失敗した」だけでなく「朝までに結果ができていない」ことも監視します。cron式の設定ミスなどで実行自体がされなかった事故は、失敗の監視だけでは捕まえられないためです"
    ],
    pros: [
      "実行した時間分だけの課金で、アイドル時の費用がゼロ",
      "コンテナなので言語もライブラリも自由で、ローカルと同じ環境で動作確認できる",
      "タスク分割と並列実行が設定だけででき、データ量の増加に追従しやすい",
      "サーバーが存在しないため、OSパッチなどの保守作業が不要"
    ],
    cons: [
      "1タスクの実行は最長24時間。超える見込みならタスク分割やBatchの検討が必要",
      "cron式やタイムゾーンの設定を誤ると静かに実行されない。「実行されなかったこと」の検知は自分で仕込む必要がある",
      "毎回コンテナを起動するため数秒〜数十秒のオーバーヘッドがある（30分のバッチでは誤差だが、秒単位の頻発ジョブには不向き）"
    ],
    cost: "<strong>月数百円程度</strong>。Cloud Schedulerは3ジョブまで無料、Cloud Run Jobsは2vCPU・1GiBを毎晩30分動かして月400円前後、BigQueryはオンデマンド課金で月100GBスキャンなら約110円、Cloud Storageは50GBで約170円（東京リージョン・1USD=150円換算の目安）。",
    references: [
      { title: "Cloud Run jobsの作成", url: "https://cloud.google.com/run/docs/create-jobs?hl=ja", note: "ジョブとサービスの違いもここで分かる" },
      { title: "スケジュールに沿ってジョブを実行する", url: "https://cloud.google.com/run/docs/execute/jobs-on-schedule?hl=ja", note: "この構成そのものの公式手順" },
      { title: "Cloud Schedulerの概要", url: "https://cloud.google.com/scheduler/docs/overview?hl=ja" },
      { title: "データのバッチ読み込み", url: "https://cloud.google.com/bigquery/docs/batch-loading-data?hl=ja", note: "Cloud StorageからBigQueryへのロード方法" },
      { title: "アラートの概要（Cloud Monitoring）", url: "https://cloud.google.com/monitoring/alerts?hl=ja" }
    ]
  },
  alternatives: [
    {
      name: "Cloud Scheduler+Pub/Sub+Cloud Run functions構成",
      when: "処理が数分で終わる軽さで、コンテナを用意するほどでもない場合",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [0, 0], to: [3, 1] }
        ],
        nodes: [
          { id: "sched", icon: "integration/cloud-scheduler", label: "Cloud Scheduler\n定時発火", col: 0, row: 0 },
          { id: "ps", icon: "integration/pubsub", label: "Pub/Sub\n起動トピック", col: 1, row: 0 },
          { id: "fn", icon: "compute/cloud-functions", label: "Cloud Run functions\n軽量バッチ", col: 2, row: 0 },
          { id: "bq", icon: "analytics/bigquery", label: "BigQuery\n集計", col: 3, row: 0 },
          { id: "gcs", icon: "storage/cloud-storage", label: "Cloud Storage\n結果保存", col: 2, row: 1 }
        ],
        edges: [
          { from: "sched", to: "ps", label: "定時メッセージ" },
          { from: "ps", to: "fn", label: "push起動" },
          { from: "fn", to: "bq", label: "集計クエリ" },
          { from: "fn", to: "gcs", label: "結果保存" }
        ]
      },
      flow: [
        "Cloud Schedulerが定時にPub/Subトピックへメッセージを発行する",
        "トピックを購読するCloud Run functionsが起動し、集計処理を実行する",
        "集計結果をBigQueryとCloud Storageへ書き込む"
      ],
      services: [
        { icon: "integration/cloud-scheduler", name: "Cloud Scheduler", role: "定時にメッセージを発行するだけの係。推奨構成と同じ" },
        { icon: "integration/pubsub", name: "Pub/Sub", role: "SchedulerとFunctionsをつなぐメッセージ基盤。公式チュートリアルの定番の型" },
        { icon: "compute/cloud-functions", name: "Cloud Run functions", role: "ソースコードを置くだけで動く関数実行環境。Dockerfile不要で最小の手数" },
        { icon: "analytics/bigquery", name: "BigQuery", role: "集計の実行役。重い処理をSQLへ寄せる方針は推奨構成と同じ" }
      ],
      points: [
        "関数のソースをデプロイするだけで定期実行が組めるので、学習コストが最小です。Dockerfileやコンテナレジストリの知識がまだなくても始められます",
        "SchedulerからHTTPで関数を直接叩くこともできますが、Pub/Subを挟む型は認証設定が単純で、公式チュートリアルでも採用されている定番です",
        "イベント駆動の関数には実行時間の上限（最長9分など世代・構成により異なる）があります。処理時間が上限に近づいてきたら、推奨構成のCloud Run Jobsへ移行するサインです"
      ],
      pros: [
        "構築が最速で、コンテナの知識が不要",
        "無料枠が大きく、小さな処理ならほぼ0円で運用できる"
      ],
      cons: [
        "実行時間・リソースの上限が厳しく、重いバッチには育てられない",
        "OSレベルの依存ライブラリを使う処理はコンテナ（Run Jobs）の方が扱いやすい"
      ],
      cost: "<strong>月0円〜数百円</strong>。呼び出し回数の無料枠（月200万回）と実行時間の無料枠に、毎晩1回のバッチなら余裕で収まる。",
      references: [
        { title: "Pub/Subを使用してCloud Functionsをトリガーする（Schedulerチュートリアル）", url: "https://cloud.google.com/scheduler/docs/tut-pub-sub?hl=ja", note: "この構成そのものの公式チュートリアル" },
        { title: "Pub/Subトリガー（Cloud Run functions）", url: "https://cloud.google.com/functions/docs/calling/pubsub?hl=ja" }
      ]
    },
    {
      name: "Compute Engine+cron構成（既存スクリプト資産の移設）",
      when: "オンプレのcronで動いている既存スクリプトをまず書き換えずに動かしたい場合や、常時稼働のVMが既にある場合",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [3, 1] },
          { type: "vpc", label: "VPC", from: [1, 1], to: [1, 1], depth: 1 }
        ],
        nodes: [
          { id: "dev", icon: "client/developer", label: "運用者\ncron設定・保守", col: 0, row: 1 },
          { id: "gce", icon: "compute/compute-engine", label: "Compute Engine\ncron+スクリプト", col: 1, row: 1 },
          { id: "bq", icon: "analytics/bigquery", label: "BigQuery\n集計", col: 2, row: 0 },
          { id: "gcs", icon: "storage/cloud-storage", label: "Cloud Storage\n結果保存", col: 2, row: 1 },
          { id: "mon", icon: "ops/cloud-monitoring", label: "Cloud Monitoring\n死活・失敗監視", col: 3, row: 0 }
        ],
        edges: [
          { from: "dev", to: "gce", label: "保守作業" },
          { from: "gce", to: "bq", label: "集計クエリ" },
          { from: "gce", to: "gcs", label: "結果保存" },
          { from: "gce", to: "mon", dashed: true }
        ]
      },
      flow: [
        "VPC内のCompute Engine上で、cronが毎晩スクリプトを起動する",
        "スクリプトがBigQueryへ集計クエリを投げ、結果をCloud Storageへ保存する",
        "Cloud MonitoringのエージェントでVMの死活とジョブの失敗ログを監視する"
      ],
      services: [
        { icon: "compute/compute-engine", name: "Compute Engine", role: "cronと既存スクリプトがそのまま動く仮想マシン。OSから自分で管理する" },
        { icon: "analytics/bigquery", name: "BigQuery", role: "集計の実行役。VMからでもSQLを投げる構図は変わらない" },
        { icon: "storage/cloud-storage", name: "Cloud Storage", role: "レポートの保存先" },
        { icon: "ops/cloud-monitoring", name: "Cloud Monitoring", role: "VM自体の死活監視も必要になる点がサーバーレスとの違い" }
      ],
      points: [
        "既存のcron・シェルスクリプト資産を一切書き換えずに動かせるのが唯一にして最大の利点です。移行プロジェクトの第一歩としては合理的な選択です",
        "VMはVPCの中にいます。BigQueryやCloud StorageなどGoogleのAPIへのアクセスだけなら限定公開のGoogleアクセスで足り、外部サイトへ出る必要が出たらCloud NATを追加します。推奨構成（サーバーレス）にVPCもNATも登場しないのと対照的です",
        "毎晩30分のためにVMを常時起動するのは無駄が大きい構成です。インスタンススケジュールで夜だけ起動する手もありますが、そこまで作り込むならCloud Run Jobs化した方が早い、という判断が実務では多いです",
        "GPUや数百vCPU規模の並列計算が必要な重量級バッチなら、VMを自前管理するのではなくBatch（ジョブに応じてVM群を自動確保・解放するサービス）を検討します"
      ],
      pros: [
        "既存資産の移行の手間が最小",
        "OSレベルまで自由が利き、どんなツールでも動かせる"
      ],
      cons: [
        "アイドル時間も含めて固定費がかかり続ける",
        "OSパッチ・cron自体の死活監視など、運用負荷が最も重い",
        "データ量が増えたときのスケールは自力で設計し直しになる"
      ],
      cost: "<strong>月3,000円前後〜</strong>（e2-small常時起動＋ディスク30GB）。インスタンススケジュールで夜間だけの起動にすれば数百円まで下がるが、管理の手間は増える。",
      references: [
        { title: "VMインスタンスの起動と停止のスケジュール設定", url: "https://cloud.google.com/compute/docs/instances/schedule-instance-start-stop?hl=ja", note: "常時起動の無駄を減らす方法" },
        { title: "Batchの利用開始", url: "https://cloud.google.com/batch/docs/get-started?hl=ja", note: "重量級バッチの受け皿。points参照" }
      ]
    }
  ],
  cost: "<p>推奨構成は<strong>月数百円程度</strong>で、動いた時間しか課金されません。Compute Engine案は<strong>月3,000円前後〜</strong>の固定費で、1日30分しか働かないサーバーに残りの23時間半分も払い続けることになります。定期バッチはサーバーレスの従量課金が最も効く場面のひとつです（いずれも東京リージョン・1USD=150円換算の目安）。</p>",
  summary: "<p>GCPの定期バッチの定石は<strong>「Cloud Scheduler+Cloud Run Jobs」</strong>です。判断の軸は3つで、(1)リクエストに応答するサービスとやり切るジョブを区別する、(2)重い集計はBigQueryへ寄せてジョブを薄く保つ、(3)失敗検知と冪等な再実行を最初から設計する、です。処理をリクエストから切り離す非同期処理の考え方はケース15、ジョブ同士の依存関係が複雑になってきたらケース24のワークフロー基盤が次の学びです。</p>",
  quiz: [
    {
      q: "「Webサービスで使っているCloud Run（サービス）にバッチ用のHTTPエンドポイントを追加し、Schedulerからそこを叩けばよいのでは」という案が出ました。Cloud Run Jobsを選ぶ理由を説明できますか。",
      a: "サービスはHTTPリクエストに応答する実行モデルのため、リクエストのタイムアウト制約を受け、数十分かかるバッチには不向きです。Cloud Run Jobsは起動して処理してそのまま終了するモデルで、HTTPサーバーのコードが不要なうえ、タスク分割・並列実行・自動再試行というバッチに必要な機能が組み込みです。「応答を返す仕事」と「やり切る仕事」で部品を分けるのがGCP流の使い分けです。"
    },
    {
      q: "ある朝、バッチが夜中に失敗したまま誰も気づいていませんでした。あなたなら再発防止のために何を仕込みますか。",
      a: "まずCloud Run Jobsの失敗をCloud Monitoringのアラートポリシーで検知し、メールやチャットへ通知します。あわせてジョブの自動再試行を設定し、同じ日付で何度実行しても結果が壊れない冪等な作り（日付単位の洗い替え）にしておけば、通知後の手動再実行も安全です。さらに、cron設定ミスなどで実行自体がされなかった事故に備えて「朝の時点でレポートが存在するか」という結果側の監視も足すと、失敗と未実行の両方を捕まえられます。"
    },
    {
      q: "データ量が10倍になり、バッチが数時間かかるようになりました。構成をどう見直しますか。",
      a: "最初にやるべきは、コンテナ内で処理しているデータ加工をBigQueryのSQLへ寄せられないかの見直しです。ロードと集計をBigQueryに任せればジョブ自体は指示役になり、実行時間はデータ量に対して伸びにくくなります。それでも長い場合はRun Jobsのタスク分割・並列実行で短縮し、GPUや数百vCPU級の並列が必要な計算になったらBatchへの乗り換えを検討します。作り直しではなく段階的に強化できるのがこの構成の利点です。"
    }
  ]
});
