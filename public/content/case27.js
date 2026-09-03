// ケース27：画像認識・検品システム
registerCase({
  id: 27,
  category: "AI・機械学習",
  title: "画像認識・検品システム",
  scenario: "<p>製造業の工場で、製品の外観検査（傷・欠け・印字ズレの検出）を目視で行っています。検査員の負担が大きく、疲労による見逃しも課題です。そこで検査ラインにカメラを設置し、撮影画像から不良品を自動で判定するシステムを作ることになりました。1日あたりの撮影は数万枚、判定は数秒以内に返したい。ただしAIの判定を全面的に信用するのではなく、不良と判定されたものと確信度の低いものは人が最終確認する運用にします。機械学習エンジニアは社内におらず、モデル作りに何年もかけられません。</p>",
  requirements: [
    "自社製品特有の不良（傷・欠け・印字ズレ）を画像から判定したい",
    "1日数万枚の画像を取りこぼしなく処理したい",
    "判定は数秒以内。ラインの流れを止めない",
    "不良判定と低確信度のものは人が最終確認する（AI任せにしない）",
    "機械学習の専任者なしで作れる方法にしたい",
    "判定結果を蓄積し、不良率の推移分析とモデル改善に使いたい"
  ],
  main: {
    name: "Vertex AIカスタムモデル+イベント駆動の検品パイプライン",
    diagram: {
      cols: 5, rows: 2,
      groups: [
        { type: "onpremise", label: "工場・検査ライン", from: [0, 0], to: [0, 0] },
        { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [4, 1] }
      ],
      nodes: [
        { id: "cam", icon: "client/iot-device", label: "検査カメラ\n撮影端末", col: 0, row: 0 },
        { id: "gcs", icon: "storage/cloud-storage", label: "Cloud Storage\n検査画像", col: 1, row: 0 },
        { id: "ps", icon: "integration/pubsub", label: "Pub/Sub\n通知キュー", col: 2, row: 0 },
        { id: "run", icon: "compute/cloud-run", label: "Cloud Run\n判定処理", col: 3, row: 0 },
        { id: "vertex", icon: "ai/vertex-ai", label: "Vertex AI\n画像分類モデル", col: 4, row: 0 },
        { id: "bq", icon: "analytics/bigquery", label: "BigQuery\n判定結果の蓄積", col: 3, row: 1 }
      ],
      edges: [
        { from: "cam", to: "gcs", label: "画像アップロード" },
        { from: "gcs", to: "ps", label: "アップロード通知" },
        { from: "ps", to: "run", label: "Push配信" },
        { from: "run", to: "vertex", label: "推論" },
        { from: "run", to: "bq", label: "判定結果を記録" }
      ]
    },
    flow: [
      "検査ラインのカメラ端末が撮影画像をCloud Storageへアップロードします",
      "Cloud StorageのPub/Sub通知機能が、画像の追加をPub/Subトピックへ自動で知らせます",
      "Pub/SubがCloud RunへPush配信（HTTPで処理先を呼び出す方式）し、判定処理が起動します",
      "Cloud RunがVertex AIにデプロイした画像分類モデルへ推論リクエストを送り、良品・不良品と確信度（モデルがどれだけ自信を持っているかの数値）を受け取ります",
      "判定結果をBigQueryへ記録します。不良判定と低確信度のものは確認担当者へ通知し、人の最終判断を仰ぎます"
    ],
    services: [
      { icon: "client/iot-device", name: "検査カメラ・撮影端末", role: "ライン上の製品を撮影してクラウドへ送る現場側の装置。サービスアカウントの認証情報で安全にアップロードする" },
      { icon: "storage/cloud-storage", name: "Cloud Storage", role: "検査画像の置き場。あとからモデルを再学習するときの教師データ置き場も兼ねる" },
      { icon: "integration/pubsub", name: "Pub/Sub", role: "画像追加の通知を受け止めるキュー。処理が詰まってもメッセージを保持し、取りこぼしを防ぐ" },
      { icon: "compute/cloud-run", name: "Cloud Run", role: "推論の呼び出し・確信度による振り分け・結果記録を担う判定処理。流量に応じて自動スケールする" },
      { icon: "ai/vertex-ai", name: "Vertex AI", role: "AutoMLで学習した自社製品専用の画像分類モデルをホスティングし、オンライン予測として推論APIを提供する" },
      { icon: "analytics/bigquery", name: "BigQuery", role: "判定結果と確信度の蓄積先。不良率の推移分析と、モデル改善用の正解データ管理に使う" }
    ],
    points: [
      "既製のVision APIではなくVertex AIのAutoML（自分のデータを渡すだけでモデルを自動構築してくれる仕組み）を選んだのは、「自社製品の傷」という汎用モデルにない判定基準を学習させる必要があるからです。コードを書かずに良品・不良品のラベル付き画像から専用モデルを作れます",
      "カメラとCloud Runを直接つながず、Cloud Storage+Pub/Subを挟んだのは取りこぼし対策です。判定処理が一時的に詰まってもキューが画像通知を保持し、ラインを止めずに後から処理できます",
      "確信度によって「自動判定で通す・人が確認する」を振り分けるのがこの設計の肝です。AIを全自動の判定者ではなく一次スクリーニング係と位置づけることで、導入初期の精度でも実運用に載せられます",
      "判定結果と人の最終判断をBigQueryに貯めるのは、そのままモデル再学習の教師データになるからです。「人が直した結果を次の学習に回す」ループを最初から設計に入れておきます。学習の自動化はケース31で扱います"
    ],
    pros: [
      "機械学習の専任者なしでも、ラベル付き画像を用意すれば自社専用モデルを作れる",
      "Pub/Subが緩衝材になり、流量の波や一時障害でも画像を取りこぼさない",
      "判定・確認・蓄積・再学習のループが最初から回る構成になっている",
      "判定処理（Cloud Run)は従量課金で、ラインが動いていない夜間・休日のコストが小さい"
    ],
    cons: [
      "Vertex AIのオンライン予測はモデルをデプロイしている間ノード課金が続くため、使い方によっては費用が大きい（下記コスト参照）",
      "AutoMLは手軽な反面、モデルの内部を細かく調整することはできない",
      "良品・不良品のラベル付き画像を数百枚以上、偏りなく集める準備作業が必要",
      "クラウドへの通信が前提のため、ネットワーク障害時の縮退運転（ためて後で処理する等）を決めておく必要がある"
    ],
    cost: "<strong>月5万円〜15万円程度</strong>（1日数万枚・東京リージョン・1USD=150円換算の目安）。最大の要素はVertex AIオンライン予測のノード課金で、常時デプロイだと1ノードで月10万円を超えることがあります。ラインの稼働時間帯だけデプロイする運用にすれば大きく圧縮できます。学習（AutoML）は1回あたり数千円〜数万円、Cloud Storage・Pub/Sub・Cloud Run・BigQueryは合計でも月数千円規模です。",
    references: [
      { title: "Vertex AIのトレーニング方法の概要", url: "https://cloud.google.com/vertex-ai/docs/training-overview?hl=ja", note: "AutoMLとカスタムトレーニングの使い分けの公式解説" },
      { title: "Vertex AIの予測の概要", url: "https://cloud.google.com/vertex-ai/docs/predictions/overview?hl=ja", note: "オンライン予測とバッチ予測の違い" },
      { title: "Cloud StorageのPub/Sub通知", url: "https://cloud.google.com/storage/docs/pubsub-notifications?hl=ja" },
      { title: "Pub/SubのPushサブスクリプション", url: "https://cloud.google.com/pubsub/docs/push?hl=ja" },
      { title: "BigQueryの概要", url: "https://cloud.google.com/bigquery/docs/introduction?hl=ja" }
    ]
  },
  alternatives: [
    {
      name: "Vision APIで既製モデルを使う構成",
      when: "判定したい内容がラベル検出・文字読み取り・不適切画像検出などの汎用タスクで足り、自社専用の学習が不要な場合",
      diagram: {
        cols: 3, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [2, 1] }
        ],
        nodes: [
          { id: "app", icon: "client/client", label: "業務アプリ\n画像を送信", col: 0, row: 0 },
          { id: "run", icon: "compute/cloud-run", label: "Cloud Run\n判定API", col: 1, row: 0 },
          { id: "vision", icon: "ai/vision-api", label: "Vision API\n既製モデル", col: 2, row: 0 },
          { id: "gcs", icon: "storage/cloud-storage", label: "Cloud Storage\n画像保管", col: 2, row: 1 }
        ],
        edges: [
          { from: "app", to: "run", label: "画像送信" },
          { from: "run", to: "vision", label: "解析リクエスト" },
          { from: "run", to: "gcs", label: "画像保存" }
        ]
      },
      flow: [
        "業務アプリが画像をCloud Runの判定APIへ送ります",
        "Cloud RunがVision APIへ解析を依頼し、ラベル・文字・不適切コンテンツ判定などの結果を受け取ります",
        "結果をアプリへ返し、画像はCloud Storageへ保管します。学習もモデル管理も一切ありません"
      ],
      services: [
        { icon: "ai/vision-api", name: "Vision API", role: "Googleが学習済みの汎用画像認識API。ラベル検出・文字読み取り（OCR）・顔検出・不適切画像検出などを呼び出すだけで使える" },
        { icon: "compute/cloud-run", name: "Cloud Run", role: "アプリとVision APIの間で結果の整形・しきい値判定を行う薄いAPI" },
        { icon: "storage/cloud-storage", name: "Cloud Storage", role: "解析済み画像の保管先。あとで専用モデルを作ることになった場合の学習データにもなる" }
      ],
      points: [
        "「学習済みモデルで足りるなら学習しない」が機械学習システムの鉄則です。ECサイトの商品画像チェックや投稿画像の健全性チェックのような汎用タスクなら、この構成が最速・最安です",
        "呼び出すだけの従量課金でノード常時課金がなく、流量が少ないうちは推奨構成より桁違いに安く済みます",
        "ただし「自社製品の傷」のような固有の判定基準は汎用モデルでは学習されていないため、このケースの本題である外観検査には力不足です。まずVision APIで試し、精度が出なければAutoMLへ進む順序が無駄がありません"
      ],
      pros: [
        "学習・ラベル付け・モデル運用が一切不要で、数日で組み込める",
        "呼び出し回数の従量課金のみで、少量ならほぼ無料枠に収まる"
      ],
      cons: [
        "自社固有の判定基準（製品特有の不良など）は判定できない",
        "精度をこちらで改善する手段がほぼない（Googleのモデル更新待ち）"
      ],
      cost: "<strong>月数百円〜3万円程度</strong>（東京リージョン・1USD=150円換算の目安）。ラベル検出は1,000枚あたり約225円で、月10万枚なら約22,500円。月1,000枚までの無料枠があるため、小規模なら実質無料で試せます。",
      references: [
        { title: "Vision APIドキュメント", url: "https://cloud.google.com/vision/docs?hl=ja", note: "検出できる内容の一覧と使い方" },
        { title: "Cloud Runドキュメント", url: "https://cloud.google.com/run/docs?hl=ja" }
      ]
    },
    {
      name: "エッジ推論構成（現場で判定・クラウドで学習）",
      when: "ネットワーク断でもラインを止められない場合や、判定を数十ミリ秒で返す必要がある場合",
      diagram: {
        cols: 5, rows: 2,
        groups: [
          { type: "onpremise", label: "工場・現場", from: [0, 0], to: [0, 1] },
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [4, 1] }
        ],
        nodes: [
          { id: "cam", icon: "client/iot-device", label: "検査カメラ", col: 0, row: 0 },
          { id: "svr", icon: "client/onprem-server", label: "推論サーバー\n現場で判定", col: 0, row: 1 },
          { id: "gcs", icon: "storage/cloud-storage", label: "Cloud Storage\n学習用画像", col: 1, row: 0 },
          { id: "vertex", icon: "ai/vertex-ai", label: "Vertex AI\nモデル学習", col: 2, row: 0 },
          { id: "ps", icon: "integration/pubsub", label: "Pub/Sub\n結果キュー", col: 2, row: 1 },
          { id: "run", icon: "compute/cloud-run", label: "Cloud Run\n集計処理", col: 3, row: 1 },
          { id: "bq", icon: "analytics/bigquery", label: "BigQuery\n不良率分析", col: 4, row: 1 }
        ],
        edges: [
          { from: "cam", to: "svr", label: "撮影画像" },
          { from: "svr", to: "gcs", dashed: true },
          { from: "gcs", to: "vertex", label: "再学習" },
          { from: "vertex", to: "svr", label: "モデル配布" },
          { from: "svr", to: "ps", label: "判定結果" },
          { from: "ps", to: "run", label: "Push配信" },
          { from: "run", to: "bq", label: "蓄積" }
        ]
      },
      flow: [
        "推論は現場の推論サーバーで完結させます。カメラの画像をその場で判定するため、応答は数十ミリ秒でネットワーク障害の影響も受けません",
        "判定結果はPub/Sub経由でクラウドへ送り、Cloud Runが集計してBigQueryへ蓄積します。回線断のあいだは現場にためて復旧後に送ります",
        "学習用の画像は破線の経路で定期的にCloud Storageへアップロードし、Vertex AIで再学習します",
        "AutoMLにはエッジ用にモデルを書き出す機能があり、新しいモデルを現場の推論サーバーへ配布して入れ替えます"
      ],
      services: [
        { icon: "client/onprem-server", name: "現場の推論サーバー", role: "書き出したモデルを動かして画像判定する現場側の機器。GPU搭載の小型PCなどを使う" },
        { icon: "ai/vertex-ai", name: "Vertex AI", role: "クラウド側でのモデル学習と、エッジ用モデルの書き出しを担う。推論はしない" },
        { icon: "storage/cloud-storage", name: "Cloud Storage", role: "学習用画像の集約先" },
        { icon: "integration/pubsub", name: "Pub/Sub", role: "現場からの判定結果を受けるキュー。回線復旧後のまとめ送りも受け止める" },
        { icon: "compute/cloud-run", name: "Cloud Run", role: "判定結果の集計とBigQueryへの書き込み" },
        { icon: "analytics/bigquery", name: "BigQuery", role: "全ラインの不良率を横断分析する蓄積先" }
      ],
      points: [
        "「推論を現場、学習をクラウド」と分けるのがエッジAIの定石です。ラインは1秒止まるだけで損失が出るため、判定経路からネットワークを排除します",
        "クラウド側の役割は学習・集計・モデル配布に絞られ、オンライン予測のノード課金が不要になります。推論の固定費が現場ハードウェアの購入費に置き換わる、と捉えると比較しやすいです",
        "モデルの配布と入れ替えという運用が新たに発生します。どのラインにどのバージョンのモデルが載っているかの管理は、台数が増えるほど重要になります"
      ],
      pros: [
        "判定が数十ミリ秒で返り、ネットワーク障害でもラインが止まらない",
        "画像をクラウドへ送らずに済むため、通信量と機密性の懸念が減る",
        "クラウド側は学習時と集計のみの課金で、推論の常時課金がない"
      ],
      cons: [
        "現場ハードウェアの調達・設置・故障対応という物理的な運用が発生する",
        "モデル配布とバージョン管理の仕組みを自分で作る必要がある",
        "エッジ用に軽量化したモデルは、クラウドのフルサイズモデルより精度がやや落ちることがある"
      ],
      cost: "<strong>クラウド側は月数千円〜1万円程度</strong>（学習を月1回・判定結果の集計のみの想定、東京リージョン・1USD=150円換算の目安）。別途、現場の推論サーバーの購入費（1台数万円〜数十万円）と保守費がかかります。",
      references: [
        { title: "AutoML Edgeモデルのエクスポート", url: "https://cloud.google.com/vertex-ai/docs/export/export-edge-model?hl=ja", note: "エッジ用にモデルを書き出す公式手順" },
        { title: "Pub/Subドキュメント", url: "https://cloud.google.com/pubsub/docs?hl=ja" }
      ]
    }
  ],
  cost: "<p>推奨構成は<strong>月5万円〜15万円程度</strong>で、支配的なのはVertex AIオンライン予測のノード課金です。汎用タスクで足りるならVision API構成が<strong>月数百円〜</strong>と圧倒的に安く、逆に応答速度と回線独立性を突き詰めるならエッジ構成でクラウド費を<strong>月1万円以下</strong>に抑えて現場ハードウェアに投資します。いずれも東京リージョン・1USD=150円換算の目安です。</p>",
  summary: "<p>画像認識システムの分かれ目は<strong>「既製モデルで足りるか・専用の学習が必要か」と「推論をクラウドと現場のどちらでやるか」</strong>の2軸です。まずVision APIで試して力不足ならAutoMLへ、応答速度と回線独立性が最優先ならエッジへ、という段階的な判断が無駄のない進め方です。また、AIを全自動の判定者にせず確信度で人の確認へ振り分ける設計は、精度が完璧でなくても実運用に載せるための現実的な知恵です。イベント駆動の画像処理の基本形はケース17、判定結果を学習へ回す自動化はケース31で深掘りします。</p>",
  quiz: [
    {
      q: "推奨構成では、カメラからCloud Runへ直接画像を送らず、Cloud StorageとPub/Subを間に挟んでいます。この2つを挟むことで何が守られるのでしょうか。",
      a: "取りこぼしの防止です。判定処理が一時的に詰まったり障害で止まったりしても、画像はCloud Storageに残り、通知はPub/Subが保持し続けるため、復旧後に未処理分を順に処理できます。直接送る方式では受け側が止まった瞬間の画像が失われます。1日数万枚を確実に処理するという要件は、処理速度ではなく「消えない中継点」で満たすのがイベント駆動設計の考え方です。"
    },
    {
      q: "「AIの精度が90%しかないなら導入できない」という現場の声があります。この構成では精度が完璧でなくても実運用に載せられる工夫があります。何でしょうか。",
      a: "確信度による振り分けです。モデルが自信を持って良品と判定したものだけ自動で通し、不良判定と確信度の低いものは人が最終確認します。AIの役割を「全自動の判定者」から「一次スクリーニング係」に変えることで、見逃しリスクを人の確認で抑えつつ、目視の量を大幅に減らせます。さらに人の判断結果をBigQueryに蓄積して再学習に回せば、運用しながら精度を上げていけます。"
    },
    {
      q: "工場の回線が不安定で、月に数回・数分の切断が起きることが分かりました。あなたなら推奨構成のままにしますか、エッジ構成に変えますか。判断基準も述べてください。",
      a: "判断基準は「切断中にラインを止められるか」です。数分の切断中も検査を続けなければならないなら、推論を現場で完結させるエッジ構成に変えるべきです。一方、切断中は画像を現場にためて復旧後にまとめて判定する運用が許されるなら、推奨構成のままPub/Subの再送に任せる方が、ハードウェア管理もモデル配布運用も不要で安く済みます。技術の優劣ではなく、業務がどこまでの遅延を許容するかで決まる問題です。"
    }
  ]
});
