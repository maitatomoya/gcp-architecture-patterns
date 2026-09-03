// ケース26：RAGチャットボット（社内ナレッジ回答）
registerCase({
  id: 26,
  category: "AI・機械学習",
  title: "RAGチャットボット（社内ナレッジ回答）",
  scenario: "<p>従業員500人の企業で、就業規則・経費精算マニュアル・社内システムの手順書などがCloud StorageやファイルサーバーにPDFやスライドとして散在しています。総務や情シスへの「これどこに書いてありますか」という問い合わせが月数百件あり、回答に多くの時間が取られています。そこで、社内文書の内容に基づいて出典つきで回答する生成AIチャットボットを作ることになりました。運用できるのは情シス2人で、機械学習の専任者はいません。もっともらしい嘘（ハルシネーション）で誤った規程を案内してしまうことは絶対に避けたい、という強い要件があります。</p>",
  requirements: [
    "回答は社内文書の内容に基づき、根拠となった文書（出典）を必ず示したい",
    "文書は日々追加・更新される。反映作業を自動化したい",
    "社内文書を外部に出さない。入力がAIモデルの学習に使われないこと",
    "機械学習の専任者なし。ベクトルデータベース等の運用はしたくない",
    "利用は社員のみ。認証と利用量の制限をかけたい"
  ],
  main: {
    name: "Vertex AI Search+GeminiのマネージドRAG構成",
    diagram: {
      cols: 5, rows: 2,
      groups: [
        { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [4, 1] }
      ],
      nodes: [
        { id: "users", icon: "client/users", label: "社員\nチャット画面", col: 0, row: 0 },
        { id: "apigw", icon: "integration/api-gateway", label: "API Gateway\n認証・入口", col: 1, row: 0 },
        { id: "run", icon: "compute/cloud-run", label: "Cloud Run\nチャットAPI", col: 2, row: 0 },
        { id: "search", icon: "ai/vertex-ai-search", label: "Vertex AI Search\n文書検索", col: 3, row: 0 },
        { id: "gcs", icon: "storage/cloud-storage", label: "Cloud Storage\n社内文書", col: 4, row: 0 },
        { id: "gemini", icon: "ai/gemini", label: "Gemini\n回答生成", col: 3, row: 1 }
      ],
      edges: [
        { from: "users", to: "apigw", label: "質問" },
        { from: "apigw", to: "run" },
        { from: "run", to: "search", label: "文書検索" },
        { from: "gcs", to: "search", label: "自動取り込み" },
        { from: "run", to: "gemini", label: "回答生成" }
      ]
    },
    flow: [
      "社員がチャット画面から質問すると、API Gatewayが認証とAPIキーを確認してCloud Runへ渡します",
      "Cloud RunのチャットAPIが質問文をVertex AI Searchに投げ、関連する社内文書の断片（チャンク）と出典情報を検索します",
      "検索で得た文書の断片を質問文と一緒にGeminiへ渡し、「この文書に基づいて答えてください」という形で回答を生成させます",
      "Cloud Runは回答本文と出典（文書名・該当箇所）を組み立てて社員に返します",
      "Cloud Storageに文書を追加・更新すると、Vertex AI Searchが取り込んでインデックス（検索用の索引）を更新します"
    ],
    services: [
      { icon: "ai/vertex-ai-search", name: "Vertex AI Search", role: "文書の取り込み・チャンク分割・ベクトル化・検索までをまとめて面倒を見るマネージド検索サービス。ベクトルデータベースを自前で運用せずに済む" },
      { icon: "ai/gemini", name: "Gemini（Vertex AI）", role: "検索結果の文書を根拠として回答文を生成する大規模言語モデル。Vertex AI経由の入出力は基盤モデルの学習に使われない" },
      { icon: "compute/cloud-run", name: "Cloud Run", role: "検索と生成をつなぐチャットAPI。プロンプトの組み立てと出典の整形を担い、利用がない時間はゼロまで縮む" },
      { icon: "storage/cloud-storage", name: "Cloud Storage", role: "社内文書（PDF・HTML等）の置き場。ここに置くだけが文書更新の運用になる" },
      { icon: "integration/api-gateway", name: "API Gateway", role: "APIの入口。認証・APIキー・利用量制限を一手に引き受け、LLM APIの無制限公開を防ぐ" }
    ],
    points: [
      "モデルの再学習（ファインチューニング）ではなくRAG（検索拡張生成：回答のたびに文書を検索してモデルに渡す方式）を選んだのは、文書の日次更新に追従でき、出典を示せてハルシネーション対策になるためです",
      "検索部分にVertex AI Searchを選んだのは、チャンク分割・埋め込み生成・ベクトルデータベース運用という一番手間のかかる部分を丸ごと任せられるからです。細かい精度チューニングの自由度は下がりますが、専任者なしで運用する要件に合います",
      "Vertex AI経由のGeminiは入力・出力が基盤モデルの学習に使われないことをGoogleが明記しており、社内文書を扱う前提条件を満たします。プロンプトに個人情報を入れない等のルール整備は別途必要です",
      "生成AIのAPIは1回ごとの従量課金なので、API Gatewayで認証と利用量制限をかけて入口を1つに絞ります。作り自体はケース14のサーバーレスAPI構成と同じ発想です"
    ],
    pros: [
      "ベクトルデータベースの構築・運用が不要で、情シス2人でも回せる",
      "回答に出典を添えられるため、利用者が原文を確認でき、ハルシネーションの実害を抑えられる",
      "文書の追加・更新はCloud Storageに置くだけで検索対象に反映される",
      "Cloud RunとAPI Gatewayは従量課金で、利用が少ない時期のコストが小さい"
    ],
    cons: [
      "チャンク分割の粒度や検索ロジックの細かい制御はマネージドゆえにしにくい",
      "Vertex AI Searchは検索回数課金のため、利用が急増した場合の費用を見積もっておく必要がある",
      "回答品質の評価（正しく答えられたか）と改善のサイクルは自分たちで回す必要がある",
      "スキャン画像だけのPDFなど、テキストを取り出せない文書は事前の変換が必要になる"
    ],
    cost: "<strong>月5,000円〜2万円程度</strong>（社員500人・月1万質問・文書数GBの想定、東京リージョン・1USD=150円換算の目安）。内訳はVertex AI Searchの検索課金（1,000クエリあたり約225円で月約2,250円）とインデックス保存料、Gemini（Flash系モデルなら1質問あたり1円未満〜数円）、Cloud RunとAPI Gatewayの少額の従量課金です。質問数と文書量に比例して増えるため、最新の料金表での確認が前提です。",
    references: [
      { title: "Vertex AI Searchの概要", url: "https://cloud.google.com/generative-ai-app-builder/docs/introduction?hl=ja", note: "文書検索とRAGの中核となるサービスの公式概要" },
      { title: "Vertex AIの生成AIの概要", url: "https://cloud.google.com/vertex-ai/generative-ai/docs/overview?hl=ja" },
      { title: "生成AIとデータガバナンス", url: "https://cloud.google.com/vertex-ai/generative-ai/docs/data-governance?hl=ja", note: "入力データが基盤モデルの学習に使われないことの公式説明" },
      { title: "API Gatewayドキュメント", url: "https://cloud.google.com/api-gateway/docs?hl=ja" },
      { title: "Cloud Runドキュメント", url: "https://cloud.google.com/run/docs?hl=ja" }
    ]
  },
  alternatives: [
    {
      name: "自前RAG構成（Embeddings API+AlloyDBのpgvector）",
      when: "チャンク分割や検索ロジックを自分で制御して精度を追い込みたい場合や、既にPostgreSQLの運用経験があり検索対象データがDB内にもある場合",
      diagram: {
        cols: 5, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [4, 1] },
          { type: "vpc", label: "VPC", from: [2, 0], to: [2, 0], depth: 1 }
        ],
        nodes: [
          { id: "users", icon: "client/users", label: "社員", col: 0, row: 0 },
          { id: "run", icon: "compute/cloud-run", label: "Cloud Run\nチャットAPI", col: 1, row: 0 },
          { id: "alloy", icon: "database/alloydb", label: "AlloyDB\npgvector", col: 2, row: 0 },
          { id: "jobs", icon: "compute/cloud-run-jobs", label: "Cloud Run Jobs\n取り込みジョブ", col: 3, row: 0 },
          { id: "gcs", icon: "storage/cloud-storage", label: "Cloud Storage\n社内文書", col: 4, row: 0 },
          { id: "gemini", icon: "ai/gemini", label: "Gemini\n回答生成", col: 1, row: 1 },
          { id: "emb", icon: "ai/vertex-ai", label: "Vertex AI\nEmbeddings", col: 3, row: 1 }
        ],
        edges: [
          { from: "users", to: "run", label: "質問" },
          { from: "run", to: "alloy", label: "ベクトル検索" },
          { from: "run", to: "gemini", label: "回答生成" },
          { from: "gcs", to: "jobs", label: "文書取得" },
          { from: "jobs", to: "emb", label: "ベクトル化" },
          { from: "emb", to: "alloy" }
        ]
      },
      flow: [
        "取り込みジョブ（Cloud Run Jobs）が文書を読み込み、自作のルールでチャンクに分割します",
        "各チャンクをVertex AIのEmbeddings APIで数値ベクトルに変換し、AlloyDBのpgvector拡張（PostgreSQLでベクトル検索を可能にする拡張機能）に保存します",
        "質問が来ると、Cloud Runが質問文も同じ方法でベクトル化し、AlloyDBで意味の近いチャンクを検索します",
        "検索したチャンクをGeminiに渡して回答を生成する流れは推奨構成と同じです"
      ],
      services: [
        { icon: "database/alloydb", name: "AlloyDB for PostgreSQL", role: "pgvector拡張でベクトル検索を担うマネージドPostgreSQL。通常のSQL条件（部署・文書種別での絞り込み等）とベクトル検索を組み合わせられる" },
        { icon: "ai/vertex-ai", name: "Vertex AI Embeddings API", role: "テキストを意味を表す数値ベクトルに変換するAPI。取り込み時と質問時の両方で使う" },
        { icon: "compute/cloud-run-jobs", name: "Cloud Run Jobs", role: "文書の分割とベクトル登録を行う取り込みバッチ。文書更新時に実行する" },
        { icon: "ai/gemini", name: "Gemini（Vertex AI）", role: "検索結果を根拠に回答を生成する。役割は推奨構成と同じ" },
        { icon: "compute/cloud-run", name: "Cloud Run", role: "質問のベクトル化・検索・生成をつなぐチャットAPI" },
        { icon: "storage/cloud-storage", name: "Cloud Storage", role: "元文書の置き場" }
      ],
      points: [
        "チャンクの切り方（見出し単位か固定長か）や検索の重み付けを自分で決められるのが最大の理由です。RAGの回答品質はチャンク分割の質に大きく左右されるため、精度を追い込む段階で効きます",
        "AlloyDBはVPC内のプライベートIPで動くため、Cloud Runからの接続経路（コネクタ設定）が必要です。図では線1本に省略しています",
        "検索対象が文書だけでなく業務DBのレコードにも及ぶ場合、SQLの絞り込みとベクトル検索を1つのクエリで書けるのはpgvector方式の強みです",
        "小さく始めるならAlloyDBの代わりにCloud SQLのpgvectorでも同じ構成が組めます。性能とコストのバランスで選びます"
      ],
      pros: [
        "チャンク分割・検索ロジック・ランキングを完全に制御でき、精度改善の打ち手が多い",
        "業務データベースの構造化データと文書を横断した検索を1つのSQLで書ける",
        "検索部分の課金がDBインスタンス費中心になり、質問数が非常に多い場合は割安になることがある"
      ],
      cons: [
        "チャンク分割・取り込みパイプライン・インデックス設計を自分で作り込む必要があり、開発と運用の負担が重い",
        "AlloyDBは常時起動の固定費がかかる（ゼロスケールしない）",
        "検索精度の評価と改善をすべて自分たちで担うため、専任者なしの体制には向かない"
      ],
      cost: "<strong>月3万円〜6万円程度</strong>（AlloyDB最小クラスの常時起動が中心。東京リージョン・1USD=150円換算の目安）。Embeddings APIとGeminiの従量課金が少額で加わります。Cloud SQLのpgvectorに代えると月数千円台から始められますが、検索性能は下がります。",
      references: [
        { title: "AlloyDBでベクトル埋め込みを扱う", url: "https://cloud.google.com/alloydb/docs/ai/work-with-embeddings?hl=ja", note: "pgvectorによるベクトル検索の公式ガイド" },
        { title: "テキストエンベディングの取得", url: "https://cloud.google.com/vertex-ai/generative-ai/docs/embeddings/get-text-embeddings?hl=ja" },
        { title: "Cloud Run Jobsの作成", url: "https://cloud.google.com/run/docs/create-jobs?hl=ja" }
      ]
    },
    {
      name: "Geminiの長文コンテキストに文書を直接渡す小規模構成",
      when: "対象文書が少なく（数十ファイル・合計数百ページ以下）、検索の仕組みを作る前にまず効果を試したい場合",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [2, 1] }
        ],
        nodes: [
          { id: "users", icon: "client/users", label: "社員", col: 0, row: 0 },
          { id: "run", icon: "compute/cloud-run", label: "Cloud Run\nチャットAPI", col: 1, row: 0 },
          { id: "gemini", icon: "ai/gemini", label: "Gemini\n回答生成", col: 2, row: 0 },
          { id: "gcs", icon: "storage/cloud-storage", label: "Cloud Storage\n社内文書", col: 2, row: 1 }
        ],
        edges: [
          { from: "users", to: "run", label: "質問" },
          { from: "run", to: "gemini", label: "文書ごと渡す" },
          { from: "run", to: "gcs", label: "文書読込" }
        ]
      },
      flow: [
        "Cloud RunがCloud Storageから対象文書一式を読み込みます",
        "質問文と文書全体をまとめてGeminiに渡し、文書に基づいた回答を生成させます",
        "Geminiは100万トークン級の長文コンテキスト（一度に読める入力の長さ）を持つため、少量の文書なら検索なしで全部渡せます"
      ],
      services: [
        { icon: "ai/gemini", name: "Gemini（Vertex AI）", role: "文書全体を入力として受け取り回答する。検索を省略できるのは長文コンテキストがあるから" },
        { icon: "compute/cloud-run", name: "Cloud Run", role: "文書の読み込みとプロンプト組み立てを行う薄いAPI" },
        { icon: "storage/cloud-storage", name: "Cloud Storage", role: "文書の置き場。更新すれば次の質問から反映される" }
      ],
      points: [
        "RAGは常に必要なわけではありません。文書が少なければ「全部渡す」のが最も単純で、チャンク分割による文脈の切断も起きません",
        "毎回同じ文書を渡すとその分の入力トークン課金が繰り返し発生するため、コンテキストキャッシュ（同じ入力の再利用割引）を使って費用を抑えます",
        "文書が増えて入力上限や費用が苦しくなったら推奨構成へ移行します。チャットAPI側の作りはほぼ流用できます"
      ],
      pros: [
        "構成要素が最少で、数日で動くものを作れる",
        "検索漏れという概念がなく、文書間をまたぐ質問にも強い"
      ],
      cons: [
        "文書量が増えると入力トークン費用と応答時間が比例して悪化する",
        "出典の提示はプロンプトの工夫頼みになり、検索方式より不正確になりやすい"
      ],
      cost: "<strong>月数百円〜5,000円程度</strong>（文書数百ページ・月数千質問の想定、東京リージョン・1USD=150円換算の目安）。入力トークン量に比例するため、コンテキストキャッシュの有無で大きく変わります。",
      references: [
        { title: "長いコンテキストの概要", url: "https://cloud.google.com/vertex-ai/generative-ai/docs/long-context?hl=ja", note: "長文コンテキストとコンテキストキャッシュの公式解説" },
        { title: "Vertex AIの生成AIの概要", url: "https://cloud.google.com/vertex-ai/generative-ai/docs/overview?hl=ja" }
      ]
    }
  ],
  cost: "<p>推奨構成は<strong>月5,000円〜2万円程度</strong>で、検索回数と文書量に比例します。自前RAG構成はAlloyDBの固定費で<strong>月3万円〜</strong>となる代わりに精度改善の自由度を得ます。文書が少ないうちは長文コンテキスト構成なら<strong>月数百円〜</strong>で試せます。いずれも目安であり、生成AI系は料金改定が頻繁なため見積もり時に最新の料金表を確認してください。</p>",
  summary: "<p>社内ナレッジ回答は「モデルに覚えさせる」のではなく「回答のたびに検索して渡す」RAGが定石です。分かれ目は<strong>検索部分をどこまで自分で持つか</strong>で、専任者がいなければVertex AI Searchに任せ、精度を追い込む段階になったらpgvector等の自前検索を検討します。そもそも文書が少なければ長文コンテキストで検索自体を省略できる、という逆方向の判断も重要です。検索基盤そのものの設計はケース25で、APIの認証や公開の作りはケース14で詳しく学べます。</p>",
  quiz: [
    {
      q: "このケースではモデルのファインチューニング（再学習）ではなくRAGを選びました。社内文書への質問回答という用途で、RAGが有利になる理由を2つ挙げてください。",
      a: "1つ目は更新への追従です。文書は日々変わるため、再学習では反映のたびに学習コストと時間がかかりますが、RAGは文書置き場を更新するだけで次の質問から反映されます。2つ目は出典を示せることです。回答の根拠となった文書を提示できるため、利用者が原文を確認でき、ハルシネーションの実害を抑えられます。再学習ではモデルが何を根拠に答えたかを示せません。"
    },
    {
      q: "利用が想定を超えて増え、Vertex AI Searchの検索課金が予算を圧迫し始めました。あなたなら何から手を打ちますか。",
      a: "まずAPI Gatewayの利用量制限とキャッシュで無駄な検索を減らします。同じ質問が繰り返されるなら、よくある質問と回答の組をCloud Runの手前で返すだけでも検索回数は大きく減ります。それでも足りなければ、検索部分を自前RAG構成（pgvector）へ移す損益分岐を検討します。自前化は固定費と運用負荷が増えるため、検索回数課金がインスタンス費を明確に上回ってから踏み切るのが順序です。"
    },
    {
      q: "経営層から「回答の間違いをゼロにできるのか」と問われました。この構成でできること・できないことをどう説明しますか。",
      a: "間違いをゼロにする保証はできません。できるのは、回答を社内文書に基づかせて出典を必ず添えること、根拠が見つからない場合は「答えられない」と返すよう設計すること、回答ログを蓄積して品質を継続的に評価・改善することです。そのうえで、規程の最終確認は原文で行う運用ルールとセットで導入するのが誠実な説明です。生成AIの導入判断は技術だけでなく運用ルールの設計を含みます。"
    }
  ]
});
