// ケース40：位置情報トラッキング
registerCase({
  id: 40,
  category: "IoT・リアルタイム",
  title: "位置情報トラッキング",
  scenario: "<p>運送会社で、配送車両300台の現在地をリアルタイムに把握する管制システムを作ります。各車両の車載端末は5秒ごとにGPS位置（車両ID・緯度経度・時刻）を送信します。管制室のオペレーターは地図上で全車両の現在位置を監視し、特定の車両の直近の走行ルート（軌跡）もすぐに呼び出したい要件です。さらに蓄積した走行データは、将来の配送ルート最適化や到着予測の分析に使う計画があります。車両は数年で1,000台まで増える見込みです。</p>",
  requirements: [
    "車両300台×5秒間隔の位置更新を安定して取り込みたい",
    "管制室の地図上で現在位置が数秒以内に更新されてほしい",
    "特定車両の直近ルート（軌跡）をすぐに呼び出したい",
    "走行履歴を全量蓄積し、ルート最適化の分析に使いたい",
    "車両が1,000台に増えても構成を変えずにスケールしたい"
  ],
  main: {
    name: "Pub/Sub+Dataflow+Bigtable構成",
    diagram: {
      cols: 5, rows: 3,
      groups: [
        { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [3, 2] }
      ],
      nodes: [
        { id: "run", icon: "compute/cloud-run", label: "Cloud Run\n管制API", col: 3, row: 0 },
        { id: "ops", icon: "client/users", label: "管制室\nオペレーター", col: 4, row: 0 },
        { id: "vehicle", icon: "client/iot-device", label: "車載端末\nGPS", col: 0, row: 1 },
        { id: "pubsub", icon: "integration/pubsub", label: "Pub/Sub\n位置の受け口", col: 1, row: 1 },
        { id: "dataflow", icon: "analytics/dataflow", label: "Dataflow\nストリーム処理", col: 2, row: 1 },
        { id: "bt", icon: "database/bigtable", label: "Bigtable\n最新位置・軌跡", col: 3, row: 1 },
        { id: "maps", icon: "integration/maps-platform", label: "Maps Platform\n地図描画", col: 4, row: 1 },
        { id: "bq", icon: "analytics/bigquery", label: "BigQuery\n走行履歴の分析", col: 2, row: 2 }
      ],
      edges: [
        { from: "vehicle", to: "pubsub", label: "現在地を送信" },
        { from: "pubsub", to: "dataflow", label: "pull" },
        { from: "dataflow", to: "bt", label: "位置を更新" },
        { from: "dataflow", to: "bq", label: "履歴を蓄積" },
        { from: "run", to: "bt", label: "参照" },
        { from: "ops", to: "run", label: "監視画面" },
        { from: "ops", to: "maps", label: "地図描画", dashed: true }
      ]
    },
    flow: [
      "車載端末は5秒ごとに現在地（車両ID・緯度経度・時刻）をPub/Subへ送信します。300台×5秒間隔＝毎秒60件程度で、Pub/Subには余裕の流量です",
      "Dataflowがストリーム処理で受け取り、通信の遅延で順番が入れ替わったデータの整列・重複排除・速度や停車状態の判定を行います",
      "車両ごとの最新位置と軌跡はBigtableへ書き込みます。行キーを「車両ID+時刻」にすることで、特定車両の直近ルートを1回の範囲読み取りで取り出せます",
      "並行して全履歴をBigQueryへ蓄積し、ルート最適化や到着予測の分析に備えます",
      "管制室の画面はCloud Runの管制APIから全車両の最新位置を数秒間隔で取得し、Maps Platformの地図に重ねて描画します"
    ],
    services: [
      { icon: "integration/pubsub", name: "Pub/Sub", role: "位置データの受け口。車両が増えても受信側の変更なしにスケールする緩衝材" },
      { icon: "analytics/dataflow", name: "Dataflow", role: "順序の乱れや重複の整理、停車判定などの加工を行うストリーム処理エンジン" },
      { icon: "database/bigtable", name: "Bigtable", role: "最新位置と軌跡の保存先。車両ID指定の点参照と時刻範囲の読み取りをミリ秒級で返す" },
      { icon: "analytics/bigquery", name: "BigQuery", role: "走行履歴の全量蓄積と分析。地理空間関数でルートや滞在の分析ができる" },
      { icon: "compute/cloud-run", name: "Cloud Run", role: "管制画面へ最新位置を返すAPI。認証や表示用の整形もここで行う" },
      { icon: "integration/maps-platform", name: "Google Maps Platform", role: "地図の描画・ジオコーディングを提供する地図サービス。管制画面のフロントエンドから利用する" }
    ],
    points: [
      "骨格はケース38のIoT収集と同じ「Pub/Sub→Dataflow→2系統書き込み」です。扱うのが温度でも位置でも、時系列データを取りこぼさず集める定石は変わりません。ドメインが違っても同じ型が使えると知っていることが設計力になります",
      "Bigtableの行キーを「車両ID+時刻」の順にしたのが軌跡要件への答えです。車両IDが先頭にあるため特定車両のデータがディスク上で連続して並び、「この車両の直近30分」を1回の範囲読み取りで取れます。逆に時刻を先頭にすると全車両の書き込みが同じ場所へ集中し、ホットスポットになります",
      "地図の描画はMaps Platformにフロントエンドから直接任せ、GCP側は位置データを返すAPIに徹しています。地図タイルをGCP経由で中継する必要はなく、責務を分けることで管制APIは小さく保てます",
      "画面更新は数秒間隔のポーリング（定期的な取得）で十分としました。1秒未満の即時性が要件になったときに初めて、WebSocketやFirestoreリスナー（代替1）を検討します。要件に対して過剰なリアルタイム性を作り込まないのも設計判断です"
    ],
    pros: [
      "車両が1,000台に増えてもPub/SubとDataflowが吸収し、構成変更が不要",
      "最新位置の監視と軌跡の呼び出しがどちらもミリ秒級で安定する",
      "走行履歴が最初から分析可能な形でBigQueryに揃い、次の投資（最適化）につながる",
      "通信断の多い車載環境でも、Pub/Subの再送と保持で取りこぼしに強い"
    ],
    cons: [
      "Bigtableの固定費が重く、300台規模では過剰性能気味になる",
      "Dataflowの開発・運用に学習コストがかかる",
      "Maps Platformの地図読み込みは従量課金のため、管制画面の同時利用者数もコスト要因になる"
    ],
    cost: "<strong>月10万円前後から+Maps Platform利用料</strong>（東京リージョン・1USD=150円前後の概算）。Bigtable1ノードで約7万円、Dataflowストリーミングで約2〜3万円、Pub/SubとBigQueryは この流量なら数千円です。Maps Platformは地図読み込み回数の従量課金（無料枠あり）で、管制室の画面数が少なければ小さく収まります。車両数十台の段階なら代替構成で10分の1以下から始められます。",
    references: [
      { title: "Bigtableの時系列スキーマ設計", url: "https://cloud.google.com/bigtable/docs/schema-design-time-series?hl=ja", note: "行キー設計の公式ガイド。このケースの肝" },
      { title: "Pub/Subの概要", url: "https://cloud.google.com/pubsub/docs/overview?hl=ja" },
      { title: "Dataflowの概要", url: "https://cloud.google.com/dataflow/docs/overview?hl=ja" },
      { title: "Maps JavaScript APIの概要", url: "https://developers.google.com/maps/documentation/javascript/overview?hl=ja", note: "管制画面の地図描画に使う" }
    ]
  },
  alternatives: [
    {
      name: "Firestoreリアルタイム反映の小規模構成",
      when: "車両が数十台規模で、位置更新を管制画面へそのまま自動反映させたい場合",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [2, 1] }
        ],
        nodes: [
          { id: "vehicle", icon: "client/iot-device", label: "車載端末\nGPS", col: 0, row: 0 },
          { id: "run", icon: "compute/cloud-run", label: "Cloud Run\n受信API", col: 1, row: 0 },
          { id: "fstr", icon: "database/firestore", label: "Firestore\n車両ドキュメント", col: 2, row: 0 },
          { id: "dash", icon: "client/client", label: "管制画面\nブラウザ", col: 3, row: 0 },
          { id: "maps", icon: "integration/maps-platform", label: "Maps Platform\n地図描画", col: 3, row: 1 }
        ],
        edges: [
          { from: "vehicle", to: "run", label: "位置送信" },
          { from: "run", to: "fstr", label: "書き込み" },
          { from: "fstr", to: "dash", label: "リアルタイム反映" },
          { from: "dash", to: "maps", label: "地図描画", dashed: true }
        ]
      },
      flow: [
        "車載端末はHTTPSでCloud Runの受信APIへ位置を送り、Cloud Runが認証・検証して車両ごとのFirestoreドキュメントを更新します",
        "管制画面は車両ドキュメントにリアルタイムリスナーを張っており、位置の更新が自動でブラウザへ届きます（ポーリング処理の実装が不要になります）",
        "画面はMaps Platformの地図上でマーカーを動かして表示します"
      ],
      services: [
        { icon: "compute/cloud-run", name: "Cloud Run", role: "位置の受信・認証・検証。端末とFirestoreの間に立つ薄いAPI" },
        { icon: "database/firestore", name: "Firestore", role: "車両ごとの最新位置の置き場。リアルタイムリスナーで画面へ自動配信する" },
        { icon: "integration/maps-platform", name: "Google Maps Platform", role: "管制画面の地図描画" }
      ],
      points: [
        "Firestoreのリアルタイムリスナー（ケース39と同じ仕組み）を使うと、画面側の更新処理を書かずに位置が動きます。小規模の管制システムでは開発の速さが際立つ構成です",
        "Firestoreは1ドキュメントあたり毎秒1回程度の更新が目安のため、車両ごとにドキュメントを分ければ5秒間隔の更新は余裕です。ただし数百台×高頻度になると書き込み課金がかさみ、軌跡の大量読み出しも割高になります",
        "軌跡や分析の要件が育ってきたら、書き込みの流れにPub/Subを挟んで推奨構成へ寄せていくのが自然な移行路です"
      ],
      pros: [
        "リアルタイムな画面反映が最小の実装で手に入る",
        "月数千円から始められ、固定費がほぼない"
      ],
      cons: [
        "高頻度・大量車両では書き込み課金と性能の限界が来る",
        "長期間の軌跡分析には向かず、別途蓄積先が必要になる"
      ],
      cost: "<strong>月数千円程度</strong>（東京リージョン・1USD=150円前後、車両50台・5秒間隔の概算）。Firestoreの書き込みは10万回あたり約28円で、50台×5秒間隔なら月2,600万回＝約7,000円強。台数と送信間隔にそのまま比例するため、見積もりが立てやすい構成です。",
      references: [
        { title: "Cloud Firestoreでリアルタイムアップデートを入手する", url: "https://firebase.google.com/docs/firestore/query-data/listen?hl=ja" },
        { title: "Cloud Runとは", url: "https://cloud.google.com/run/docs/overview/what-is-cloud-run?hl=ja" }
      ]
    },
    {
      name: "Pub/Sub直結BigQueryの分析特化構成",
      when: "リアルタイムの地図監視は不要で、走行データの事後分析やレポートが主目的の場合",
      diagram: {
        cols: 4, rows: 1,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [3, 0] }
        ],
        nodes: [
          { id: "vehicle", icon: "client/iot-device", label: "車載端末\nGPS", col: 0, row: 0 },
          { id: "pubsub", icon: "integration/pubsub", label: "Pub/Sub\nBigQuery直結", col: 1, row: 0 },
          { id: "bq", icon: "analytics/bigquery", label: "BigQuery\n地理空間分析", col: 2, row: 0 },
          { id: "ls", icon: "analytics/looker-studio", label: "Looker Studio\n走行レポート", col: 3, row: 0 }
        ],
        edges: [
          { from: "vehicle", to: "pubsub", label: "走行ログ" },
          { from: "pubsub", to: "bq", label: "直結配信" },
          { from: "bq", to: "ls", label: "レポート" }
        ]
      },
      flow: [
        "車載端末はPub/Subへ走行ログを送信します（送信側は推奨構成と同じです）",
        "Pub/SubのBigQueryサブスクリプション（コードを書かずにメッセージを直接BigQueryのテーブルへ流し込む機能）で、走行ログがそのまま蓄積されます",
        "BigQueryの地理空間関数（GEOGRAPHY型とST_系関数）で走行距離・滞在時間・エリア分析を行い、Looker Studioで日次レポートにします"
      ],
      services: [
        { icon: "integration/pubsub", name: "Pub/Sub", role: "受け口。BigQueryサブスクリプションで後段のコードを不要にする" },
        { icon: "analytics/bigquery", name: "BigQuery", role: "蓄積と地理空間分析。緯度経度をGEOGRAPHY型として扱い、距離やエリア判定をSQLで計算できる" },
        { icon: "analytics/looker-studio", name: "Looker Studio", role: "走行実績レポートの可視化。無料で使える" }
      ],
      points: [
        "DataflowもBigtableも管制APIも持たず、「Pub/Subの設定だけ」でパイプラインが完成します。変換処理が不要ならDataflowを省くのが最も安くて壊れにくい、という判断です",
        "取り込み時に変換ができないぶん、クレンジングや停車判定はBigQuery上のSQL（後処理）で行います。ELT（先に入れて後で変換する流儀）の典型です",
        "送信側を推奨構成と同じPub/Subにしてあるため、後からリアルタイム監視が必要になってもサブスクリプションを追加するだけでDataflow系統を並走させられます。入口を共通化しておくと将来の拡張が差し替えではなく追加で済みます"
      ],
      pros: [
        "ほぼノーコードで構築でき、運用対象が実質BigQueryだけになる",
        "月数千円で全量蓄積と分析が手に入る"
      ],
      cons: [
        "リアルタイムの地図監視はできない（要件が変わったら系統の追加が必要）",
        "取り込み時の変換ができず、データ品質の担保が後段のSQL頼みになる"
      ],
      cost: "<strong>月数千円程度</strong>（東京リージョン・1USD=150円前後の概算）。Pub/SubのBigQueryサブスクリプションの配信料とBigQueryの保管・クエリ費用だけで、300台規模の走行ログなら数千円に収まります。DataflowとBigtableを持たないことがそのまま費用差になります。",
      references: [
        { title: "BigQueryサブスクリプション", url: "https://cloud.google.com/pubsub/docs/bigquery?hl=ja", note: "Pub/SubからBigQueryへの直結機能" },
        { title: "地理空間データの操作", url: "https://cloud.google.com/bigquery/docs/geospatial-data?hl=ja", note: "GEOGRAPHY型とST_関数の公式ガイド" }
      ]
    }
  ],
  cost: "<p>推奨構成は<strong>月10万円前後+Maps Platform利用料</strong>で、リアルタイム監視・軌跡・分析のすべてを満たす代わりにBigtableの固定費が乗ります。監視をリアルタイムリスナーで済ませる代替1は<strong>月数千円〜</strong>、分析に絞る代替2も<strong>月数千円</strong>で、要件を絞るほど1桁安くなります。「今すぐ全部必要か」を問い直すことが最大のコスト最適化です。いずれも東京リージョン・1USD=150円前後の目安です。</p>",
  summary: "<p>位置情報トラッキングは、ケース38のセンサー収集と同じ<strong>時系列データ収集の定石（Pub/Sub→Dataflow→用途別2系統書き込み）</strong>がそのまま使える題材です。このケース固有の学びは2つあります。1つはBigtableの行キー設計で、「車両ID+時刻」の順にすることで軌跡の範囲読み取りとホットスポット回避を同時に達成しています。もう1つは責務の分離で、地図描画はMaps Platform、位置データはGCPと役割を切り分けることでAPIを小さく保てます。リアルタイム性・軌跡・分析という3つの要件のうちどれを本当に使うかで、月数千円から10万円超まで構成が大きく変わることも覚えておきましょう。リアルタイム同期の仕組みはケース39、ストリーム分析の基盤はケース21が隣接テーマです。</p>",
  quiz: [
    {
      q: "Bigtableの行キーを「時刻+車両ID」ではなく「車両ID+時刻」の順にしています。逆にするとどんな問題が起きるでしょうか。",
      a: "時刻を先頭にすると、全車両の新着データがキー順で常に末尾の同じ領域へ集中し、書き込み負荷が特定のノードに偏るホットスポットが発生します。また特定車両の軌跡を取るにも全車両のデータが時刻順で混ざっているため、範囲読み取りで効率よく取れません。車両IDを先頭にすれば書き込みが車両ごとに分散し、「この車両の直近30分」が連続した範囲として1回で読めます。行キー設計はBigtableの性能をほぼ決める最重要ポイントです。"
    },
    {
      q: "管制画面の位置更新は数秒間隔のポーリングで実装しています。リアルタイムリスナーやWebSocketを最初から使わなかったのはなぜだと思いますか。",
      a: "要件が「数秒以内の更新」であり、5秒間隔でしか位置が送られてこない以上、それより細かい即時性を作り込んでも意味がないからです。ポーリングは実装が単純で障害点も少なく、Cloud RunのステートレスなAPIと相性が良い方式です。1秒未満の反映が本当に必要になったときに初めて、複雑さと引き換えにリスナーやWebSocketを導入します。要件を超えるリアルタイム性は複雑さという負債になる、という判断の例です。"
    },
    {
      q: "経営陣から「リアルタイム監視は当面いらないから、まず配送実績の分析レポートだけ早く欲しい」と言われました。あなたならどの構成から始め、どう育てますか。",
      a: "代替2のPub/Sub直結BigQuery構成から始めます。ほぼ設定だけで走行ログの全量蓄積と地理空間分析が月数千円で手に入り、レポート要求に最速で応えられます。重要なのは送信の入口をPub/Subにしておくことで、後からリアルタイム監視が必要になってもサブスクリプションを追加してDataflow+Bigtable系統を並走させるだけで推奨構成へ育てられます。最小構成でも将来の拡張点（共通の入口）を確保しておくのが、作り直しを避ける設計判断です。"
    }
  ]
});
