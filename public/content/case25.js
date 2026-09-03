// ケース25：サイト内検索・セマンティック検索
registerCase({
  id: 25,
  category: "データ・分析",
  title: "サイト内検索・セマンティック検索",
  scenario: "<p>数万点の商品を扱うECサイト（ケース8のような構成）で、サイト内検索が単純な部分一致のため「白いスニーカー」と検索しても商品名に「ホワイト」と書かれたスニーカーがヒットしない、という不満が多く寄せられています。表記ゆれや言い換えに強い検索へ改善し、検索結果の質で売上を伸ばしたいと考えています。検索エンジンの専任者はおらず、Elasticsearchクラスタを自前運用する体力はありません。</p>",
  requirements: [
    "表記ゆれ・言い換え（意味の近さ）に強い検索にしたい",
    "商品データの更新を検索結果へ自動反映したい",
    "関連度の高い順に並ぶランキング品質を確保したい",
    "検索エンジンのクラスタ運用はしたくない",
    "検索ログを分析して改善サイクルを回したい"
  ],
  main: {
    name: "Vertex AI Searchによるマネージド検索構成",
    diagram: {
      cols: 4, rows: 2,
      groups: [
        { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [3, 1] }
      ],
      nodes: [
        { id: "user", icon: "client/users", label: "ユーザー", col: 0, row: 0 },
        { id: "run", icon: "compute/cloud-run", label: "Cloud Run\n検索API", col: 1, row: 0 },
        { id: "vas", icon: "ai/vertex-ai-search", label: "Vertex AI Search\n検索エンジン", col: 2, row: 0 },
        { id: "bq", icon: "analytics/bigquery", label: "BigQuery\n商品カタログ", col: 2, row: 1 },
        { id: "gcs", icon: "storage/cloud-storage", label: "Cloud Storage\n商品説明文書", col: 3, row: 1 }
      ],
      edges: [
        { from: "user", to: "run", label: "検索" },
        { from: "run", to: "vas", label: "クエリ" },
        { from: "bq", to: "vas", label: "定期インポート" },
        { from: "gcs", to: "vas" }
      ]
    },
    flow: [
      "BigQuery上の商品カタログとCloud Storage上の商品説明文書を、Vertex AI Searchのデータストアへ定期インポートします。インデックス作成（検索用の索引づくり）はサービス側が自動で行います",
      "ユーザーの検索リクエストはCloud Runの検索APIが受け、Vertex AI Searchへクエリを投げます",
      "Vertex AI Searchはキーワード一致と意味の近さ（セマンティック検索）を組み合わせ、関連度順の結果を返します",
      "検索APIは在庫状況や価格など鮮度の高い情報を付け足してアプリへ返します",
      "検索キーワードとクリックのログを貯め、シノニム（同義語）設定やランキング調整の改善に活かします"
    ],
    services: [
      { icon: "ai/vertex-ai-search", name: "Vertex AI Search", role: "マネージドの検索エンジン。Google検索由来の関連度技術で、キーワード検索とセマンティック検索のハイブリッドを標準提供する" },
      { icon: "compute/cloud-run", name: "Cloud Run", role: "検索APIの層。検索エンジンをアプリから隠蔽し、動的情報の合成やアクセス制御を行う" },
      { icon: "analytics/bigquery", name: "BigQuery", role: "商品カタログの正となるデータ置き場で、データストアへのインポート元。検索ログの分析にも使う" },
      { icon: "storage/cloud-storage", name: "Cloud Storage", role: "商品説明などの文書ファイル置き場。非構造化データのインポート元になる" }
    ],
    points: [
      "検索エンジンを自前運用しない選択が出発点です。インデックス設計・形態素解析・シャーディング・クラスタ監視は専門領域で、専任者のいないチームが抱えると本業を圧迫します。その領域を丸ごとマネージドに任せます",
      "セマンティック検索とは、文字の一致ではなく埋め込み（テキストの意味を数値ベクトルに変換したもの）の近さで探す方式です。「白いスニーカー」と「ホワイトのシューズ」のような言い換えに強くなります",
      "検索APIをCloud Runで1枚挟むのは、検索エンジンの差し替えをアプリから隠すためです。将来の乗り換えやA/Bテストが楽になるうえ、在庫・価格のような鮮度の高い情報の合成、認証やレート制御もこの層で行えます",
      "精度改善は導入後が本番です。検索ログとクリックログをBigQueryに貯めて「ヒットゼロの検索語」「クリックされない上位結果」を定期的に見直す改善サイクルを、最初から設計に含めます"
    ],
    pros: [
      "検索クラスタの運用ゼロで、Google検索由来の関連度技術を利用できる",
      "キーワード+セマンティックのハイブリッド検索が追加開発なしで効く",
      "データストアへの取り込みだけで動き、インデックス設計の大部分を省略できる",
      "検索ログの分析基盤（BigQuery）まで同じクラウドで完結する"
    ],
    cons: [
      "クエリ数に応じた課金のため、検索回数が非常に多いサイトでは費用の事前概算が必須",
      "ランキングロジックの細部までは制御できず、ブラックボックスな部分が残る",
      "検索結果への反映はインポート頻度に依存し、秒単位の即時反映には設計の工夫が必要"
    ],
    cost: "<strong>月2万〜8万円程度</strong>が目安（東京リージョン・1USD=150円前後）。中心はVertex AI Searchのクエリ課金（スタンダード版で1,000クエリあたり約225円。月10万クエリなら約22,500円）で、ほかにデータストアのストレージ、Cloud Runが月数百円〜数千円。検索回数に比例するため、月間検索数の見積もりが先決です。",
    references: [
      { title: "Vertex AI Searchの概要", url: "https://cloud.google.com/generative-ai-app-builder/docs/introduction?hl=ja" },
      { title: "データストアの作成とデータ取り込み", url: "https://cloud.google.com/generative-ai-app-builder/docs/create-datastore-ingest?hl=ja", note: "BigQueryやCloud Storageからのインポート手順" },
      { title: "Vertex AI Search製品ページ", url: "https://cloud.google.com/enterprise-search?hl=ja" },
      { title: "Cloud Runとは", url: "https://cloud.google.com/run/docs/overview/what-is-cloud-run?hl=ja" }
    ]
  },
  alternatives: [
    {
      name: "BigQuery検索インデックス構成",
      when: "社内向けのログ・文書探索が主目的で、ランキング品質よりSQLとの一体運用を重視する場合",
      diagram: {
        cols: 3, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [2, 1] }
        ],
        nodes: [
          { id: "user", icon: "client/office", label: "社内ユーザー", col: 0, row: 0 },
          { id: "run", icon: "compute/cloud-run", label: "Cloud Run\n検索画面", col: 1, row: 0 },
          { id: "bq", icon: "analytics/bigquery", label: "BigQuery\n検索インデックス", col: 2, row: 0 },
          { id: "src", icon: "client/client", label: "各システム\nログ・文書", col: 0, row: 1 }
        ],
        edges: [
          { from: "user", to: "run", label: "検索" },
          { from: "run", to: "bq", label: "SEARCH関数" },
          { from: "src", to: "bq", label: "集約" }
        ]
      },
      flow: [
        "各システムのログや文書データをBigQueryに集約し、対象カラムに検索インデックスを作成します",
        "Cloud Runの検索画面からSEARCH関数を使ったSQLを実行します。インデックスにより大量データでも部分一致検索が高速になります",
        "結果は通常のSQL結果として返るため、集計や絞り込みと自由に組み合わせられます"
      ],
      services: [
        { icon: "analytics/bigquery", name: "BigQuery（検索インデックス）", role: "テキスト列に索引を張り、SEARCH関数での大量データの含有検索を高速化する" },
        { icon: "compute/cloud-run", name: "Cloud Run", role: "検索画面と検索SQLの実行を担う薄いアプリ層" }
      ],
      points: [
        "すでにBigQueryへデータが集まっているなら（ケース23のログ基盤など）、追加部品ほぼゼロで検索機能を足せるのが魅力です",
        "これはデータ探索のための検索であり、EC検索のような関連度順のランキングや言い換え対応はありません。ミリ秒応答のユーザー向け検索UXにも向きません",
        "「誰が使う検索か」で道具が変わる好例です。社内の調査用途ならこれで十分で、売上に直結するユーザー向け検索なら推奨構成を選びます"
      ],
      pros: [
        "既存のBigQuery基盤に索引を足すだけで、新サービスの学習・運用が不要",
        "検索と集計・結合を同じSQLで書ける"
      ],
      cons: [
        "関連度ランキングやセマンティック検索はなく、検索UXの品質は上げられない",
        "ユーザー向けの大量同時アクセスやミリ秒応答の用途には不向き"
      ],
      cost: "<strong>月数千円規模〜</strong>が目安。検索インデックスのストレージと、検索クエリのスキャン分がBigQueryの通常料金に加わる形で、専用サービスを立てるより大幅に安く済みます。",
      references: [
        { title: "検索インデックスの概要", url: "https://cloud.google.com/bigquery/docs/search-intro?hl=ja", note: "SEARCH関数と索引の公式解説" }
      ]
    },
    {
      name: "Cloud SQL全文検索+pgvector構成",
      when: "商品数が少ない小規模サイトで、既存のCloud SQLに相乗りしてコストを最小にしたい場合",
      diagram: {
        cols: 3, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [2, 1] }
        ],
        nodes: [
          { id: "user", icon: "client/users", label: "ユーザー", col: 0, row: 0 },
          { id: "run", icon: "compute/cloud-run", label: "Cloud Run\nアプリ兼検索", col: 1, row: 0 },
          { id: "sql", icon: "database/cloud-sql", label: "Cloud SQL\n全文検索+pgvector", col: 2, row: 0 },
          { id: "vertex", icon: "ai/vertex-ai", label: "Vertex AI\n埋め込み生成", col: 2, row: 1 }
        ],
        edges: [
          { from: "user", to: "run", label: "検索" },
          { from: "run", to: "sql", label: "SQL検索" },
          { from: "run", to: "vertex", label: "埋め込み生成", dashed: true }
        ]
      },
      flow: [
        "商品登録・更新時に、アプリがVertex AIの埋め込みAPIで商品説明をベクトル化し、Cloud SQL（PostgreSQL）のpgvector列に保存します",
        "検索時はPostgreSQLの全文検索（キーワード一致）とpgvectorの近傍検索（意味の近さ）を組み合わせたSQLを実行します",
        "結果は既存の商品テーブルとそのまま結合し、在庫や価格と一緒に返します"
      ],
      services: [
        { icon: "database/cloud-sql", name: "Cloud SQL（PostgreSQL）", role: "既存の商品DBに全文検索とpgvector拡張（ベクトル近傍検索）を追加して検索も担わせる" },
        { icon: "ai/vertex-ai", name: "Vertex AI（埋め込みAPI）", role: "テキストを意味ベクトルへ変換するAPI。セマンティック検索の材料を作る" },
        { icon: "compute/cloud-run", name: "Cloud Run", role: "アプリ本体。検索SQLの組み立てと埋め込み生成の呼び出しを行う" }
      ],
      points: [
        "新しい基盤を増やさず既存DBへ相乗りするため、追加コストがほぼゼロで済みます。数千〜数万件規模の商品数なら性能面でも現実的です",
        "同義語辞書・表記ゆれ対応・ランキング調整をすべて自分で作り込む必要があり、検索品質を上げる作業は継続的に発生します",
        "検索負荷はDB本体と資源を奪い合います。検索が増えて本業のトランザクションに影響が出始めたら、検索を推奨構成へ切り出すサインです"
      ],
      pros: [
        "既存Cloud SQLへの相乗りで追加費用が最小",
        "商品テーブルとの結合や絞り込みが1つのSQLで完結する"
      ],
      cons: [
        "辞書整備・ランキング・言い換え対応を自作する必要があり、品質向上の手間が大きい",
        "データ量と検索負荷が増えるとDB本体の性能を圧迫する"
      ],
      cost: "<strong>追加費用ほぼゼロ〜月数千円</strong>が目安。既存のCloud SQLに相乗りし、埋め込みAPIの従量課金（生成する文書量に応じて少額）が加わる程度です。",
      references: [
        { title: "Cloud SQL for PostgreSQL", url: "https://cloud.google.com/sql/docs/postgres?hl=ja" },
        { title: "テキストエンベディングの取得", url: "https://cloud.google.com/vertex-ai/generative-ai/docs/embeddings/get-text-embeddings?hl=ja", note: "埋め込みAPIの公式ドキュメント" }
      ]
    }
  ],
  cost: "<p>推奨構成は<strong>月2万〜8万円程度</strong>（クエリ数に比例）。BigQuery検索インデックス構成は<strong>月数千円規模〜</strong>、Cloud SQL相乗り構成は<strong>追加ほぼゼロ〜月数千円</strong>。検索が売上に直結するユーザー向け機能なのか、社内の探索用途なのかで、かけるべき金額の桁が変わります（東京リージョン・1USD=150円前後の目安）。</p>",
  summary: "<p>検索機能の設計は<strong>「誰のための検索か」で道具が変わる</strong>のが最大の学びです。売上に直結するユーザー向け検索なら、ランキング品質と言い換え対応を持つVertex AI Searchのようなマネージド検索エンジンに任せ、運用の重い自前クラスタは避けます。社内のデータ探索ならBigQueryの検索インデックスで十分ですし、小規模なら既存DBへの相乗りも合理的です。そしてどの構成でも、検索ログを貯めて改善する循環が品質を決めます。セマンティック検索の技術は、ケース26のRAGチャットボットでも中核部品として再登場します。</p>",
  quiz: [
    {
      q: "フロントエンドから直接Vertex AI Searchを呼ばず、Cloud Runの検索APIを1枚挟むのはなぜでしょうか。",
      a: "理由は主に4つあります。認証情報をブラウザに置かずに済むこと、検索エンジンを将来差し替えてもアプリ側の改修を検索API内に閉じ込められること、在庫や価格のような鮮度の高い情報を検索結果に合成できること、そしてレート制御やキャッシュをこの層で実装できることです。外部サービスへの依存をアプリ全体に染み込ませず、1つの層に閉じ込めるのは検索に限らず有効な設計原則です。"
    },
    {
      q: "セマンティック検索があればキーワード検索は不要になるのでしょうか。",
      a: "なりません。セマンティック検索は言い換えや曖昧な表現に強い一方、型番「ABC-1234」や固有名詞のような完全一致が求められる検索では、文字が一致するキーワード検索のほうが確実です。実務ではキーワード検索の正確さとセマンティック検索の柔軟さを組み合わせたハイブリッド検索が定石で、Vertex AI Searchが標準でハイブリッドなのもそのためです。上位互換ではなく相互補完の関係と理解してください。"
    },
    {
      q: "サイトの成長で月間検索数が10倍になり、クエリ課金が予算を超えました。あなたなら何から検討しますか。",
      a: "まず検索ログを分析し、クエリの内訳を把握します。同じ検索語が繰り返されているなら結果のキャッシュ（MemorystoreやCDN）で実クエリ数を減らせますし、入力補完のような1文字ごとの呼び出しが原因なら、サジェスト部分は軽量な別実装に分けて本検索だけをVertex AI Searchに投げる設計にします。それでも足りなければ、エディションや料金体系の見直し、さらには検索基盤の自前化との損益分岐を再計算します。従量課金サービスは、呼び出し方の設計そのものがコスト設計になります。"
    }
  ]
});
