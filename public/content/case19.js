// ケース19：マイクロサービスのイベント連携
registerCase({
  id: 19,
  category: "サーバーレス・イベント駆動",
  title: "マイクロサービスのイベント連携",
  scenario: "<p>成長中のECサイト。注文が確定するたびに、在庫の引き当て・決済の確定・ユーザーへの通知・分析基盤への記録が必要になる。現在は注文サービスが各サービスをHTTPで順番に同期呼び出ししており、先日は通知サービスの障害に巻き込まれて注文そのものが失敗する事故が起きた。サービスは5個、開発チームは3つに分かれており、これからもサービスは増える。サービス間のつなぎ方を、増築に耐える形へ作り直したい。</p>",
  requirements: [
    "一部のサービスが落ちても注文の受付は止めたくない",
    "サービスを追加するときに既存サービスの改修を不要にしたい",
    "決済のような順序と結果確認が必要な処理はきちんと制御したい",
    "1つの注文がどこまで処理されたかを追跡できるようにしたい"
  ],
  main: {
    name: "Pub/Sub+Eventarcによるコレオグラフィ構成",
    diagram: {
      cols: 5, rows: 2,
      groups: [
        { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [4, 1] }
      ],
      nodes: [
        { id: "user", icon: "client/users", label: "ユーザー\n注文", col: 0, row: 0 },
        { id: "order", icon: "compute/cloud-run", label: "Cloud Run\n注文サービス", col: 1, row: 0 },
        { id: "ps", icon: "integration/pubsub", label: "Pub/Sub\n注文イベント", col: 2, row: 0 },
        { id: "ea", icon: "integration/eventarc", label: "Eventarc\nトリガー管理", col: 3, row: 0 },
        { id: "inv", icon: "compute/cloud-run", label: "Cloud Run\n在庫サービス", col: 4, row: 0 },
        { id: "ntf", icon: "compute/cloud-run", label: "Cloud Run\n通知サービス", col: 4, row: 1 },
        { id: "trc", icon: "ops/cloud-trace", label: "Cloud Trace\n分散トレース", col: 2, row: 1 }
      ],
      edges: [
        { from: "user", to: "order", label: "注文リクエスト" },
        { from: "order", to: "ps", label: "イベント発行" },
        { from: "ps", to: "ea", label: "トリガー" },
        { from: "ea", to: "inv", label: "push配信" },
        { from: "ea", to: "ntf", label: "push配信" },
        { from: "order", to: "trc", dashed: true },
        { from: "inv", to: "trc", dashed: true },
        { from: "ntf", to: "trc", dashed: true }
      ]
    },
    flow: [
      "ユーザーの注文を注文サービスが受け付け、注文データを保存して「注文確定」イベントをPub/Subへ発行する",
      "発行した時点で注文サービスの仕事は完了し、ユーザーへ応答を返す。後段のサービスの状態には引きずられない",
      "EventarcのPub/Subトリガーが、イベントを在庫サービスと通知サービスのCloud Runへそれぞれpush配信する",
      "各サービスは自分の仕事だけを行い、必要なら次のイベント（在庫引当済みなど）を発行して連鎖させる",
      "一連の処理はCloud Traceの分散トレースでつながり、1つの注文がどこまで進んだかを追跡できる"
    ],
    services: [
      { icon: "compute/cloud-run", name: "Cloud Run（各サービス）", role: "注文・在庫・通知などの各マイクロサービス。チームごとに独立して開発・デプロイする" },
      { icon: "integration/pubsub", name: "Pub/Sub", role: "イベントの配送基盤。1つのイベントを複数の購読者へ同時に配り、スパイクも吸収する" },
      { icon: "integration/eventarc", name: "Eventarc", role: "Pub/SubやGoogleサービスのイベントをCloud Runへ届けるトリガーの管理役。配線を宣言的に管理できる" },
      { icon: "ops/cloud-trace", name: "Cloud Trace", role: "サービスをまたぐ処理の流れを1本のトレースとして可視化する。イベント駆動の弱点である追跡性を補う" }
    ],
    points: [
      "この方式はコレオグラフィ（中央の指揮者を置かず、各サービスがイベントを見て自律的に動く方式）と呼ばれます。同期呼び出しの連鎖は「全員が生きていないと動かない」構成で、可用性が掛け算で下がります。イベントに置き換えると後段の障害は「処理の遅延」に変わり、注文の受付が守られます",
      "新サービス（例：ポイント付与）の追加は、同じトピックへの購読を足すだけです。注文サービスは変更もデプロイも不要で、これが疎結合の実利です",
      "イベントは「少なくとも1回」届くため、各サービスは冪等（同じイベントを2回受けても結果が変わらない作り）にします。ケース18と同じ原則です",
      "全体の流れがコードのどこにも書かれていないのがコレオグラフィの弱点です。だからこそトレースIDをイベントに載せて伝搬し、Cloud Traceとログで横断的に追える仕込みを最初から入れます"
    ],
    pros: [
      "後段サービスの障害が注文の受付まで波及しない（障害の分離）",
      "サービス追加時に既存側の改修が不要で、増築に強い",
      "チームごとに独立してデプロイでき、開発の並行性が上がる",
      "スパイク時はPub/Subがバッファとなり、各サービスは自分のペースで処理できる"
    ],
    cons: [
      "処理全体の流れがコード上に現れず、把握・デバッグに慣れが必要",
      "処理が完了するまでの一瞬、データが不整合に見える結果整合（最終的に整合すればよいとする考え方）を受け入れる必要がある",
      "順序保証や失敗時の取り消しが必要な業務フローには不向き（その部分は代替案のWorkflowsで解く）"
    ],
    cost: "<strong>月数百円〜数千円</strong>。Pub/SubとEventarcはこの規模なら無料枠内が中心で、費用の主体はCloud Run数サービス分の従量課金。イベント量が10倍になっても線形にしか増えない（東京リージョン・1USD=150円換算の目安）。",
    references: [
      { title: "Eventarcの概要", url: "https://cloud.google.com/eventarc/docs/overview?hl=ja" },
      { title: "イベントドリブンアーキテクチャ", url: "https://cloud.google.com/eventarc/docs/event-driven-architectures?hl=ja", note: "この構成の考え方の公式解説" },
      { title: "Pub/Subの基礎", url: "https://cloud.google.com/pubsub/docs/pubsub-basics?hl=ja" },
      { title: "Cloud Traceドキュメント", url: "https://cloud.google.com/trace/docs?hl=ja", note: "分散トレースの入門" }
    ]
  },
  alternatives: [
    {
      name: "Workflowsによるオーケストレーション構成",
      when: "決済確定から在庫引当のように、実行順序・失敗時の取り消し（補償処理）・進行状況の見える化が必要な業務フローの場合",
      diagram: {
        cols: 4, rows: 3,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [3, 2] }
        ],
        nodes: [
          { id: "user", icon: "client/users", label: "ユーザー\n注文", col: 0, row: 1 },
          { id: "order", icon: "compute/cloud-run", label: "Cloud Run\n注文サービス", col: 1, row: 1 },
          { id: "wf", icon: "integration/workflows", label: "Workflows\n注文フロー定義", col: 2, row: 1 },
          { id: "pay", icon: "compute/cloud-run", label: "Cloud Run\n決済サービス", col: 3, row: 0 },
          { id: "inv", icon: "compute/cloud-run", label: "Cloud Run\n在庫サービス", col: 3, row: 1 },
          { id: "ntf", icon: "compute/cloud-run", label: "Cloud Run\n通知サービス", col: 3, row: 2 }
        ],
        edges: [
          { from: "user", to: "order", label: "注文" },
          { from: "order", to: "wf", label: "フロー起動" },
          { from: "wf", to: "pay", label: "決済確定" },
          { from: "wf", to: "inv", label: "在庫引当" },
          { from: "wf", to: "ntf", label: "完了通知" }
        ]
      },
      flow: [
        "注文サービスがWorkflowsの実行を開始する",
        "WorkflowsがYAMLで定義した手順どおりに、決済・在庫・通知の各Cloud Runを順に呼び出す",
        "途中のステップが失敗したら、定義済みのリトライや補償処理（決済の取り消しなど）を実行する",
        "実行履歴が1件ずつ残り、どのステップで止まったかをコンソールで確認できる"
      ],
      services: [
        { icon: "integration/workflows", name: "Workflows", role: "複数サービスの呼び出し順序・分岐・リトライをYAMLで定義するオーケストレーター（指揮者）" },
        { icon: "compute/cloud-run", name: "Cloud Run（各サービス）", role: "呼び出される側の各サービス。役割はコレオグラフィ構成と同じ" }
      ],
      points: [
        "フロー全体が1つのYAML定義に書かれるため、業務の流れがコードとして見えます。「全体像がどこにもない」というコレオグラフィの弱点への正面からの答えです",
        "途中で失敗したら以降を止めて決済を取り消す、といった補償処理を宣言的に書けます。お金が絡む「途中半端が許されない」処理と相性が良い方式です",
        "課金はステップ実行数に対してで、待ち時間そのものには課金されません。人の承認待ちのような長い待ちを含むフローでも安く動かせます",
        "実務では推奨構成との併用が定番です。厳密さが必要な決済まわりだけWorkflowsで指揮し、完了後の周辺への波及（通知・分析・ポイント）はイベントで広げます"
      ],
      pros: [
        "実行順序・リトライ・補償処理を宣言的に制御できる",
        "実行履歴が残り、どこで止まったかが一目で分かる",
        "待ち時間に課金されないため、長時間のフローも安い"
      ],
      cons: [
        "フローの変更がすべて中央の定義に集まり、チーム間の調整が増えやすい",
        "1秒間に大量に発生するイベントをばらまく用途には向かない（それはPub/Subの守備範囲）"
      ],
      cost: "<strong>月数百円〜</strong>。月10万注文×5ステップで約750円＋各Cloud Runの従量課金。",
      references: [
        { title: "Workflowsの概要", url: "https://cloud.google.com/workflows/docs/overview?hl=ja" },
        { title: "Workflowsのチュートリアル", url: "https://cloud.google.com/workflows/docs/tutorials?hl=ja", note: "サービスを順に呼び出す実例" }
      ]
    },
    {
      name: "同期HTTP直接呼び出し構成",
      when: "サービスが2〜3個で、呼び出し先の結果を確認してからユーザーへ応答する必要がある場合",
      diagram: {
        cols: 3, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [2, 1] }
        ],
        nodes: [
          { id: "user", icon: "client/users", label: "ユーザー\n注文", col: 0, row: 0 },
          { id: "order", icon: "compute/cloud-run", label: "Cloud Run\n注文サービス", col: 1, row: 0 },
          { id: "pay", icon: "compute/cloud-run", label: "Cloud Run\n決済サービス", col: 2, row: 0 },
          { id: "inv", icon: "compute/cloud-run", label: "Cloud Run\n在庫サービス", col: 2, row: 1 }
        ],
        edges: [
          { from: "user", to: "order", label: "注文" },
          { from: "order", to: "pay", label: "決済API" },
          { from: "order", to: "inv", label: "在庫API" }
        ]
      },
      flow: [
        "注文サービスが決済サービスをHTTPで呼び、結果を確認してから在庫サービスを呼ぶ",
        "すべて成功したらユーザーへ注文完了を返す",
        "どこかで失敗したらその場でエラーを返し、ユーザーに再操作してもらう"
      ],
      services: [
        { icon: "compute/cloud-run", name: "Cloud Run（各サービス）", role: "サービス間はIAM認証つきのHTTPで直接呼び合う" }
      ],
      points: [
        "小規模なら最も単純で、処理の流れもコードを上から読めば分かります。イベント駆動は道具が増えるぶんの複雑さを常に伴うので、小さいうちから無理に導入しない判断も正しい設計です",
        "「決済の結果を見てから応答したい」ような要件は同期呼び出しが自然です。すべてをイベントにする必要はありません",
        "サービス間の呼び出しはCloud RunのIAM認証（サービス間認証）で保護し、誰でも叩ける状態にしないのが基本です",
        "呼び出し先が4つ5つと増える、他サービスの障害に巻き込まれ始める、が推奨構成へ移行するサインです"
      ],
      pros: [
        "構成が単純で、結果を即座にユーザーへ返せる",
        "処理の流れがコードにそのまま現れ、デバッグしやすい"
      ],
      cons: [
        "1つのサービスの障害が呼び出し元へ連鎖する（可用性が掛け算で下がる）",
        "応答時間が呼び出し先の合計になり、サービスが増えるほど遅くなる",
        "サービス追加のたびに呼び出し元の改修とデプロイが必要"
      ],
      cost: "<strong>Cloud Runの従量課金のみ</strong>で月数百円規模から。中間部品がないぶん最安だが、その差は月数百円程度でしかない。",
      references: [
        { title: "サービス間認証（Cloud Run）", url: "https://cloud.google.com/run/docs/authenticating/service-to-service?hl=ja", note: "同期呼び出しを守る必須設定" },
        { title: "Cloud Runドキュメント", url: "https://cloud.google.com/run/docs?hl=ja" }
      ]
    }
  ],
  cost: "<p>3案とも費用の主体はCloud Runの従量課金で、つなぎ方による差は月数百円程度しかありません。つまりこのケースの選択は<strong>コストではなく、障害の波及・増築のしやすさ・流れの見えやすさをどう取るか</strong>の判断です。迷ったら「結果を即返す必要があるか」「途中半端が許されない処理か」「購読者は増えていくか」の3問で切り分けます（金額は東京リージョン・1USD=150円換算の目安）。</p>",
  summary: "<p>サービス間連携には<strong>コレオグラフィ（イベントで自律連携）とオーケストレーション（指揮者が順に呼ぶ）</strong>の2つの型があり、GCPでは前者をPub/Sub+Eventarc、後者をWorkflowsが担います。広く波及させる連携はイベントで疎結合に、順序と補償が必要な業務フローは指揮者で厳密に、と<strong>1つのシステムの中で使い分ける</strong>のが実務の答えです。イベントを受ける各サービスの作り方はケース18の冪等設計が土台になり、追跡性を支える監視の全体像はケース46で扱います。</p>",
  quiz: [
    {
      q: "通知サービスの障害で注文そのものが失敗した事故の根本原因は何でしょうか。イベント駆動にするとこの事故はどう変わりますか。",
      a: "根本原因は同期呼び出しの連鎖により、注文の成立が通知サービスの生存に依存していたことです。全員が生きていないと動かない構成では、可用性は各サービスの掛け算でどんどん下がります。イベント駆動では注文サービスはイベントを発行した時点で応答を返すため、通知サービスが落ちていても注文は成立し、障害は「通知が遅れて届く」という影響に格下げされます。復旧後はPub/Subに溜まったイベントから処理が再開されます。"
    },
    {
      q: "「ポイント付与サービス」を新しく追加することになりました。推奨構成では何をすればよいでしょうか。注文サービスの改修は必要ですか。",
      a: "注文確定イベントのトピックに対して、ポイント付与サービス向けの購読とEventarcトリガーを追加するだけです。注文サービスはイベントを発行しているだけで購読者が誰かを知らないため、コードの変更もデプロイも不要です。これが同期呼び出しとの決定的な違いで、同期方式なら注文サービスにポイントサービスの呼び出し処理を追加して再デプロイする必要があり、追加のたびに既存機能へのリスクが生じます。"
    },
    {
      q: "チームから「決済確定と在庫引当だけは、失敗したら決済を取り消すところまで確実に制御したい」という要望が出ました。あなたなら全体をどう設計しますか。",
      a: "決済確定と在庫引当の一連だけをWorkflowsのオーケストレーションで組み、失敗時の補償処理（決済の取り消し）をフロー定義に明記します。順序と取り消しが必要な業務はコレオグラフィでは追いにくいためです。そのうえでフロー完了後に「注文処理完了」イベントをPub/Subへ発行し、通知・分析・ポイントなど波及先はイベント購読で疎結合に受けます。厳密さが必要な芯はオーケストレーション、広がる周辺はコレオグラフィという併用が実務の定石です。"
    }
  ]
});
