// ケース20：データレイク
registerCase({
  id: 20,
  category: "データ・分析",
  title: "データレイク",
  scenario: "<p>中堅の小売企業。基幹システム（オンプレ）の売上データ、ECサイトのアプリログ、広告SaaSからダウンロードするレポートCSVが別々の場所に散らばっている。分析担当は毎月それらを手作業でかき集めてExcelで集計しており、集めるだけで数日かかる。データ量は合計で数TB、今も日々増え続けている。分析の高度化はいったん置いて、まず「全社のデータが1か所に集まっていて、SQLで触れる状態」を作りたい。体制は分析チーム3人と情報システム部門。</p>",
  requirements: [
    "形式がバラバラの生データを、まず失わずに1か所へ集めたい",
    "元データはそのまま残し、加工は何度でもやり直せるようにしたい",
    "集めたデータにSQLで触れるようにしたい",
    "どこに何のデータがあるか探せるようにしたい（データカタログ）",
    "保存コストを抑えたい（古いデータは安く保管）"
  ],
  main: {
    name: "Cloud Storageデータレイク+BigQuery構成",
    diagram: {
      cols: 5, rows: 2,
      groups: [
        { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [3, 1] }
      ],
      nodes: [
        { id: "onprem", icon: "client/onprem-server", label: "オンプレ\nファイルサーバー", col: 0, row: 0 },
        { id: "saas", icon: "client/external-saas", label: "外部SaaS\nレポートCSV", col: 0, row: 1 },
        { id: "sts", icon: "storage/storage-transfer", label: "Storage Transfer\n定期転送", col: 1, row: 0 },
        { id: "gcs", icon: "storage/cloud-storage", label: "Cloud Storage\nデータレイク", col: 2, row: 0 },
        { id: "bq", icon: "analytics/bigquery", label: "BigQuery\nSQL分析", col: 3, row: 0 },
        { id: "dproc", icon: "analytics/dataproc", label: "Dataproc\nSpark変換", col: 2, row: 1 },
        { id: "dplex", icon: "analytics/dataplex", label: "Dataplex\nカタログ・品質", col: 3, row: 1 },
        { id: "analyst", icon: "client/users", label: "分析者\nSQL/ノートブック", col: 4, row: 0 }
      ],
      edges: [
        { from: "onprem", to: "sts", label: "定期転送" },
        { from: "saas", to: "gcs", label: "日次連携" },
        { from: "sts", to: "gcs", label: "rawゾーン格納" },
        { from: "gcs", to: "bq", label: "外部テーブル参照" },
        { from: "dproc", to: "gcs", label: "変換して書き戻し" },
        { from: "analyst", to: "bq", label: "SQLで探索" },
        { from: "dplex", to: "gcs", noArrow: true, dashed: true },
        { from: "dplex", to: "bq", noArrow: true, dashed: true }
      ]
    },
    flow: [
      "オンプレのファイルサーバーからはStorage Transfer Serviceが定期的に差分転送し、外部SaaSの日次レポートもCloud Storageへ集める",
      "Cloud Storageの中はrawゾーン（生データをそのまま）とcuratedゾーン（整形・検証済み）に分けて管理する",
      "大きな整形・変換はDataprocのSparkジョブが担当し、rawから読んでcuratedへ書き戻す",
      "BigQueryは外部テーブルでCloud Storage上のファイルを直接参照するか、よく使うデータはロードして分析する",
      "Dataplexが全ゾーンをカタログ化し、分析者は「どこに何があるか」を検索してからSQLやノートブックで探索する"
    ],
    services: [
      { icon: "storage/cloud-storage", name: "Cloud Storage", role: "データレイクの本体。形式を問わず何でも安く保存でき、ライフサイクル管理で古いデータを自動で安い保存クラスへ移せる" },
      { icon: "storage/storage-transfer", name: "Storage Transfer Service", role: "オンプレ・他クラウド・SaaSからCloud Storageへの大量転送を、スケジュールと差分管理つきで自動化する" },
      { icon: "analytics/dataproc", name: "Dataproc", role: "マネージドのSpark/Hadoop。テラバイト級の整形・変換をクラスタを立てて実行し、終わったら畳む" },
      { icon: "analytics/bigquery", name: "BigQuery", role: "サーバーレスの分析エンジン。GCS上のファイルにも外部テーブルで直接SQLを投げられる" },
      { icon: "analytics/dataplex", name: "Dataplex", role: "レイク全体のカタログとガバナンス。データの検索・品質チェック・アクセス管理を横断的に行う" }
    ],
    points: [
      "最初の設計判断は「とにかく生のまま置く」です。スキーマ（データの構造定義）を決めてから集めると、決め損ねた項目は永久に失われます。生データさえ残っていれば加工は何度でもやり直せる、というELT（先に集めて後で変換する考え方）の思想です",
      "ゾーン分けはデータの信頼度の段階を表します。raw（そのまま）からcurated（整形・検証済み）へ段階的に品質を上げ、分析者には基本的にcurated以降を使ってもらうことで「どの数字が正か」の混乱を防ぎます",
      "BigQueryの外部テーブルを使うと、ロードせずにGCS上のファイルへ直接SQLを投げられます。試し斬りは外部テーブル、毎日使うデータはロードしてネイティブテーブルに、という使い分けで手間と性能のバランスを取ります",
      "保存コストはライフサイクル管理で下げます。たとえば90日アクセスのないrawデータをNearlineやColdlineへ自動で移せば、保存単価を数分の1にできます"
    ],
    pros: [
      "形式を問わず受け入れられ、データを失わない基盤がまずできる",
      "生データが残るので、加工ロジックの誤りを後から何度でも修正できる",
      "ストレージ（GCS）と計算（BigQuery/Dataproc)が分離しており、それぞれ独立に増やせる",
      "分析はBigQueryのサーバーレスな計算力を使え、クラスタ管理なしで数TBに対応できる"
    ],
    cons: [
      "「置き場」を作っただけでは価値は出ない。整形と活用（ケース22のDWH化）まで進めて初めて成果になる",
      "ゾーン規約やカタログ登録を守る運用の規律が必要で、崩れると「何があるか分からない沼」に戻る",
      "誰がどのデータを見てよいかというガバナンス設計（IAM・列レベル制御）を別途詰める必要がある"
    ],
    cost: "<strong>月1万円前後〜</strong>（合計2TB保存・毎日1時間の変換クラスタ・月1TBスキャン想定）。内訳はCloud Storage約7,000円（ライフサイクルで圧縮可）、Dataproc約3,000円、BigQueryスキャン約1,100円など（東京リージョン・1USD=150円換算の目安）。",
    references: [
      { title: "ストレージクラス（Cloud Storage）", url: "https://cloud.google.com/storage/docs/storage-classes?hl=ja", note: "保存コスト設計の基礎" },
      { title: "オブジェクトのライフサイクル管理", url: "https://cloud.google.com/storage/docs/lifecycle?hl=ja", note: "古いデータを自動で安く保管する" },
      { title: "Cloud Storageデータに対する外部テーブル", url: "https://cloud.google.com/bigquery/docs/external-data-cloud-storage?hl=ja", note: "ロードせずにSQLを投げる方法" },
      { title: "Dataplexの概要", url: "https://cloud.google.com/dataplex/docs/introduction?hl=ja" },
      { title: "Storage Transfer Serviceの概要", url: "https://cloud.google.com/storage-transfer/docs/overview?hl=ja" }
    ]
  },
  alternatives: [
    {
      name: "BigQuery直集約構成（小さく始めるレイクハウス）",
      when: "データの大半がCSVやJSONなどの構造化データで、SQL中心の分析で足りる場合",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [2, 1] }
        ],
        nodes: [
          { id: "src", icon: "client/onprem-server", label: "社内システム\nCSV/DBダンプ", col: 0, row: 0 },
          { id: "gcs", icon: "storage/cloud-storage", label: "Cloud Storage\n着地ゾーンのみ", col: 1, row: 0 },
          { id: "bq", icon: "analytics/bigquery", label: "BigQuery\nネイティブ保存", col: 2, row: 0 },
          { id: "ls", icon: "analytics/looker-studio", label: "Looker Studio\n可視化", col: 2, row: 1 },
          { id: "analyst", icon: "client/users", label: "分析者", col: 3, row: 0 }
        ],
        edges: [
          { from: "src", to: "gcs", label: "アップロード" },
          { from: "gcs", to: "bq", label: "定期ロード" },
          { from: "bq", to: "ls", label: "ダッシュボード" },
          { from: "analyst", to: "bq", label: "SQL" }
        ]
      },
      flow: [
        "各システムからのファイルをCloud Storageの着地用バケットへ集める",
        "定期ジョブでBigQueryのネイティブテーブルへロードし、以降の加工はすべてSQLで行う",
        "分析者はBigQueryへ直接SQLを投げ、定型の可視化はLooker Studioのダッシュボードで見る"
      ],
      services: [
        { icon: "storage/cloud-storage", name: "Cloud Storage", role: "ロード前の一時的な着地場所。レイクとしてのゾーン設計は持たない" },
        { icon: "analytics/bigquery", name: "BigQuery", role: "保存も加工も分析もここに集約する。レイクとDWHを兼ねる" },
        { icon: "analytics/looker-studio", name: "Looker Studio", role: "無料で使えるBIツール。BigQueryに直結してダッシュボードを作る" }
      ],
      points: [
        "Sparkもゾーン設計も持たない割り切りです。BigQueryのストレージは十分安く（90日更新のないテーブルは自動で長期保存料金に半額化）、構造化データだけなら「レイク＝BigQuery」で成立します",
        "加工がSQLで完結する規模なら、Dataprocクラスタを管理しない方が総合的に安くて速く、3人のチームには現実的です",
        "画像・音声のような非構造化データや、Sparkでしか動かない既存資産が出てきたら推奨構成へ拡張します。BigLakeのようにGCS上のデータをBigQuery側の統制下に置く仕組みもあり、両者の境界は近年溶けつつあります"
      ],
      pros: [
        "部品が少なく、最短でSQL分析を始められる",
        "運用対象が実質BigQueryだけで、3人チームでも回る"
      ],
      cons: [
        "画像・音声など非構造化データの置き場としては不向き",
        "ロード前の生データを捨てる運用にすると、加工のやり直しが利かなくなる（着地バケットの保持期間設計が重要）"
      ],
      cost: "<strong>月5,000円前後〜</strong>（1TBをBigQueryに保存＋月1TBスキャン想定）。長期保存の自動半額化が効くと保存料はさらに下がる。",
      references: [
        { title: "データの読み込みの概要（BigQuery）", url: "https://cloud.google.com/bigquery/docs/loading-data?hl=ja" },
        { title: "BigLakeテーブルの概要", url: "https://cloud.google.com/bigquery/docs/biglake-intro?hl=ja", note: "レイクとDWHの境界を溶かす仕組み" }
      ]
    },
    {
      name: "Dataproc中心構成（オンプレHadoop資産の移行）",
      when: "オンプレのHadoop/Sparkクラスタと既存ジョブ資産があり、書き換えずにクラウドへ移したい場合",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [3, 1] }
        ],
        nodes: [
          { id: "hdp", icon: "client/onprem-server", label: "オンプレHadoop\n既存ジョブ資産", col: 0, row: 0 },
          { id: "sts", icon: "storage/storage-transfer", label: "Storage Transfer\nHDFSデータ移行", col: 1, row: 0 },
          { id: "gcs", icon: "storage/cloud-storage", label: "Cloud Storage\nHDFSの置き換え", col: 2, row: 0 },
          { id: "dproc", icon: "analytics/dataproc", label: "Dataproc\nSpark/Hive実行", col: 2, row: 1 },
          { id: "bq", icon: "analytics/bigquery", label: "BigQuery\n集計結果の公開先", col: 3, row: 1 }
        ],
        edges: [
          { from: "hdp", to: "sts", label: "初回・差分移行" },
          { from: "sts", to: "gcs", label: "格納" },
          { from: "dproc", to: "gcs", label: "読み書き" },
          { from: "dproc", to: "bq", label: "集計結果を書込" }
        ]
      },
      flow: [
        "HDFS上のデータをStorage Transfer ServiceでCloud Storageへ移行する",
        "既存のSpark/HiveジョブをDataprocでほぼそのまま実行する。読み書き先はHDFSではなくGCSコネクタ経由でCloud Storageを使う",
        "集計結果はBigQueryへ書き込み、分析やBIから参照する"
      ],
      services: [
        { icon: "analytics/dataproc", name: "Dataproc", role: "マネージドHadoop/Spark。既存ジョブの受け皿で、クラスタは数分で作って壊せる" },
        { icon: "storage/cloud-storage", name: "Cloud Storage", role: "HDFSの置き換え。クラスタを消してもデータが残る分離ストレージ" },
        { icon: "storage/storage-transfer", name: "Storage Transfer Service", role: "HDFSからの初回・差分のデータ移行を自動化する" },
        { icon: "analytics/bigquery", name: "BigQuery", role: "集計結果の公開先。SQLユーザーはこちらだけ触ればよい" }
      ],
      points: [
        "最大の変化は「ストレージと計算の分離」です。オンプレHadoopはデータを保持するためにクラスタを24時間動かし続けますが、データをGCSへ置けばクラスタはジョブの間だけ存在すればよくなります",
        "ジョブ実行のたびにクラスタを作って壊すエフェメラルクラスタ運用にすると、費用は実行時間分だけになり、ジョブごとに最適なクラスタサイズも選べます",
        "長期的にはSparkジョブを少しずつBigQueryやDataflowへ寄せていくのが定番の進化です（ケース24のETLパイプラインへつながる話です）"
      ],
      pros: [
        "既存のSpark/Hiveジョブを書き換えずに移行できる",
        "クラスタ費用を実行時間だけに抑えられ、オンプレの維持費・更改費が消える"
      ],
      cons: [
        "Hadoopエコシステムの運用知識が引き続き必要",
        "クラスタのサイズ設計・チューニングは自前で、サーバーレスなBigQueryほどは手離れしない"
      ],
      cost: "<strong>月数千円〜数万円</strong>。ジョブの実行時間×ノード数に比例する。常時起動をやめてエフェメラル運用にすること自体が最大のコスト削減になる。",
      references: [
        { title: "Dataprocの概要", url: "https://cloud.google.com/dataproc/docs/concepts/overview?hl=ja" },
        { title: "Cloud Storageコネクタ（Dataproc）", url: "https://cloud.google.com/dataproc/docs/concepts/connectors/cloud-storage?hl=ja", note: "HDFSの代わりにGCSを使うための仕組み" }
      ]
    }
  ],
  cost: "<p>推奨構成は<strong>月1万円前後〜</strong>、BigQuery直集約なら<strong>月5,000円前後〜</strong>で始められます。データ基盤の費用は「保存」より「スキャンと変換」で膨らむのが常なので、外部テーブルの試し斬りで済ませる・ライフサイクルで古いデータを安い層へ落とす・クラスタは使う間だけ立てる、という3つの習慣が効きます（金額は東京リージョン・1USD=150円換算の目安）。</p>",
  summary: "<p>データレイクの本質は<strong>「スキーマを決める前に、生データを失わない場所を作る」</strong>ことです。学びは3つで、(1)生のまま集めて加工は後からやり直せるようにするELTの思想、(2)raw→curatedのゾーン分けとカタログ（Dataplex）で「何があるか分からない沼」を防ぐ、(3)構造化データ中心ならBigQuery直集約で小さく始めてよい、という規模に応じた割り切りです。集めたデータを経営指標へ整形するDWH構築はケース22、変換ジョブの運行管理はケース24、リアルタイム化はケース21へ続きます。</p>",
  quiz: [
    {
      q: "整形済みデータがあれば分析はできるのに、なぜ整形前の生データをrawゾーンに残し続けるのでしょうか。",
      a: "整形ロジックには必ず誤りや仕様変更が起きるからです。たとえば「税抜金額のつもりが税込だった」と後から分かったとき、生データが残っていれば正しいロジックで全期間を再処理できますが、整形後しか残っていなければ過去は取り戻せません。スキーマを決めた時点で捨てた項目が後から必要になるケースも頻発します。ストレージが安いクラウドでは、生データの保持は保険として極めて割の良い投資です。"
    },
    {
      q: "BigQueryの外部テーブルとネイティブテーブルはどう使い分けますか。毎朝の売上ダッシュボードが参照するデータは、あなたならどちらに置きますか。",
      a: "外部テーブルはGCS上のファイルをロードせずに参照できるため、新しいデータの試し斬りや低頻度アクセスに向きます。一方で性能はネイティブテーブルに劣ります。毎朝の売上ダッシュボードのように毎日確実に読まれるデータは、ロードしてネイティブテーブルに置くべきです。クエリが速く安定するうえ、パーティション分割でスキャン量を絞ればコストも下がります。「まず外部で試し、定着したらロード」が実務の流れです。"
    },
    {
      q: "レイク運用を始めて1年、利用部門から「データはあるらしいが、どこに何があるか分からず結局担当者に聞いている」という声が出ました。何が欠けていたのでしょうか。",
      a: "データカタログとゾーン規約の運用が欠けていました。レイクは置くだけなら簡単ですが、説明のないファイルが積み上がると誰も探せない沼になります。Dataplexでデータを自動カタログ化して検索できるようにし、rawとcuratedのゾーン規約・命名規則・データの説明（オーナーや更新頻度）の登録をデータ追加時の必須手順にします。技術より運用の規律の問題であり、これを最初から仕組みにしておくことがレイク成功の分かれ目です。"
    }
  ]
});
