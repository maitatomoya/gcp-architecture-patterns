// ケース28：帳票OCR・データ化
registerCase({
  id: 28,
  category: "AI・機械学習",
  title: "帳票OCR・データ化",
  scenario: "<p>経理部門では毎月、取引先から届く数千枚の請求書（PDF・スキャン画像・写真）を人手で会計システムに入力しています。入力作業に月100時間以上かかり、転記ミスも毎月発生しています。そこで、アップロードされた帳票から取引先名・金額・日付・品目を自動で読み取り、構造化データ（表形式の整ったデータ）としてデータベースに登録するシステムを作ることになりました。読み取りの信頼度が低いものは人が画面で確認・修正してから登録する運用にします。帳票のレイアウトは取引先ごとにばらばらです。</p>",
  requirements: [
    "請求書から金額・日付・取引先名などの項目を自動抽出したい",
    "取引先ごとにレイアウトが異なる帳票に対応したい",
    "読み取り信頼度が低いものは人の確認を挟みたい（全自動にしない）",
    "抽出結果を蓄積し、集計・検索できるようにしたい",
    "月数千枚を処理しても人手の作業が増えない仕組みにしたい"
  ],
  main: {
    name: "Document AI+イベント駆動のOCRパイプライン",
    diagram: {
      cols: 5, rows: 2,
      groups: [
        { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [4, 1] }
      ],
      nodes: [
        { id: "staff", icon: "client/users", label: "経理担当\n帳票を投入", col: 0, row: 0 },
        { id: "gcs", icon: "storage/cloud-storage", label: "Cloud Storage\n帳票置き場", col: 1, row: 0 },
        { id: "ps", icon: "integration/pubsub", label: "Pub/Sub\n通知キュー", col: 2, row: 0 },
        { id: "run", icon: "compute/cloud-run", label: "Cloud Run\n抽出処理", col: 3, row: 0 },
        { id: "docai", icon: "ai/document-ai", label: "Document AI\n請求書パーサー", col: 4, row: 0 },
        { id: "bq", icon: "analytics/bigquery", label: "BigQuery\n抽出データ", col: 3, row: 1 }
      ],
      edges: [
        { from: "staff", to: "gcs", label: "帳票アップロード" },
        { from: "gcs", to: "ps", label: "追加通知" },
        { from: "ps", to: "run", label: "Push配信" },
        { from: "run", to: "docai", label: "解析リクエスト" },
        { from: "run", to: "bq", label: "抽出データ登録" }
      ]
    },
    flow: [
      "経理担当が届いた請求書（PDF・画像）をCloud Storageへアップロードします。メール添付を自動で保存する仕組みと組み合わせることもできます",
      "Cloud StorageのPub/Sub通知が帳票の追加を知らせ、Cloud Runの抽出処理が起動します",
      "Cloud RunがDocument AIの請求書パーサー（請求書に特化した学習済みモデル）へ解析を依頼し、取引先名・金額・日付などの項目と、項目ごとの信頼度スコアを受け取ります",
      "信頼度が基準以上の帳票はそのままBigQueryへ登録し、基準未満の帳票は確認待ちの状態で登録して担当者へ通知します",
      "担当者は確認画面で原本画像と抽出結果を見比べて修正・承認します。承認済みデータが会計処理や集計の元になります"
    ],
    services: [
      { icon: "ai/document-ai", name: "Document AI", role: "帳票解析の本体。請求書パーサーなど帳票種別ごとの学習済みプロセッサが、レイアウトがばらばらでも項目を抽出し、信頼度スコアを返す" },
      { icon: "storage/cloud-storage", name: "Cloud Storage", role: "帳票原本の置き場。監査対応のため原本は消さずに保管し続ける" },
      { icon: "integration/pubsub", name: "Pub/Sub", role: "帳票追加の通知を受け止めるキュー。月末に一気に届いても取りこぼさない緩衝材" },
      { icon: "compute/cloud-run", name: "Cloud Run", role: "解析の呼び出し・信頼度による振り分け・登録を担う抽出処理。確認画面のWebアプリもここに載せられる" },
      { icon: "analytics/bigquery", name: "BigQuery", role: "抽出データの蓄積先。取引先別の支払い集計や月次推移の分析がSQLで書ける" }
    ],
    points: [
      "汎用OCR（文字を全部読み取るだけ）ではなくDocument AIの請求書パーサーを選んだのは、「どの文字が金額でどれが日付か」という項目の意味づけまで学習済みだからです。レイアウトが取引先ごとに違っても項目単位で抽出できるのが、単なる文字起こしとの決定的な違いです",
      "信頼度スコアで自動登録と人の確認を振り分けるのがこの設計の肝です。全件を人が見るのでは自動化の意味がなく、全件自動では誤読が会計データに混入します。しきい値は運用しながら調整します",
      "帳票の原本をCloud Storageに残し、抽出データと紐づけておくのは監査対応のためです。「このデータの元はどの帳票か」を必ず辿れるようにします",
      "月末に処理が集中する業務特性に対して、Pub/SubとCloud Runの自動スケールで受け止める設計です。ピークに合わせたサーバーを常時抱える必要がありません"
    ],
    pros: [
      "レイアウトの異なる帳票を1つのパーサーで処理でき、取引先ごとの設定作業がいらない",
      "信頼度スコアという判断材料が得られるため、人の確認を必要な帳票だけに絞れる",
      "全体が従量課金で、帳票が少ない月のコストが自然に下がる",
      "抽出結果がBigQueryに貯まるので、入力作業の削減と同時に支払い分析もできるようになる"
    ],
    cons: [
      "専用パーサーの解析単価は汎用OCRより高く、処理量が多いと費用が目立つ（下記コスト参照）",
      "手書き文字や低品質なスキャンは信頼度が下がり、人の確認に回る割合が増える",
      "確認・修正用の画面は自分たちで作り込む必要がある",
      "日本語帳票特有の項目（源泉徴収など）が標準の抽出項目にない場合、カスタム抽出の追加学習が必要になる"
    ],
    cost: "<strong>月1万円〜5万円程度</strong>（月2,000〜3,000ページ・東京リージョン・1USD=150円換算の目安）。中心はDocument AIの解析課金で、請求書パーサーなど特化型プロセッサは1ページあたり十数円、汎用OCRなら1,000ページあたり数百円と単価が大きく異なります。Cloud Storage・Pub/Sub・Cloud Run・BigQueryは合計でも月数千円規模です。月100時間の入力人件費と比べると、処理量が多いほど投資対効果は明確になります。",
    references: [
      { title: "Document AIの概要", url: "https://cloud.google.com/document-ai/docs/overview?hl=ja", note: "帳票解析サービス全体の公式概要" },
      { title: "Document AIプロセッサの一覧", url: "https://cloud.google.com/document-ai/docs/processors-list?hl=ja", note: "請求書パーサーをはじめ帳票種別ごとの学習済みプロセッサの一覧" },
      { title: "処理リクエストの送信", url: "https://cloud.google.com/document-ai/docs/send-request?hl=ja", note: "オンライン処理とバッチ処理の使い分け" },
      { title: "Cloud StorageのPub/Sub通知", url: "https://cloud.google.com/storage/docs/pubsub-notifications?hl=ja" },
      { title: "BigQueryの概要", url: "https://cloud.google.com/bigquery/docs/introduction?hl=ja" }
    ]
  },
  alternatives: [
    {
      name: "夜間一括バッチ構成（Cloud Scheduler+Cloud Run Jobs）",
      when: "リアルタイム性が不要で、月末や毎晩まとめて処理すれば業務が回る場合",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [3, 1] }
        ],
        nodes: [
          { id: "sched", icon: "integration/cloud-scheduler", label: "Cloud Scheduler\n定時トリガー", col: 1, row: 0 },
          { id: "jobs", icon: "compute/cloud-run-jobs", label: "Cloud Run Jobs\n一括処理", col: 2, row: 0 },
          { id: "docai", icon: "ai/document-ai", label: "Document AI\nバッチ解析", col: 3, row: 0 },
          { id: "staff", icon: "client/users", label: "経理担当", col: 0, row: 1 },
          { id: "gcs", icon: "storage/cloud-storage", label: "Cloud Storage\n帳票置き場", col: 1, row: 1 },
          { id: "bq", icon: "analytics/bigquery", label: "BigQuery\n抽出データ", col: 3, row: 1 }
        ],
        edges: [
          { from: "staff", to: "gcs", label: "日中アップロード" },
          { from: "sched", to: "jobs", label: "毎晩起動" },
          { from: "jobs", to: "gcs", label: "夜間一括読込" },
          { from: "jobs", to: "docai", label: "バッチ解析" },
          { from: "jobs", to: "bq", label: "結果登録" }
        ]
      },
      flow: [
        "日中は帳票をCloud Storageにためるだけで、処理は行いません",
        "Cloud Schedulerが毎晩決まった時刻にCloud Run Jobsを起動します",
        "ジョブがその日にたまった帳票をまとめて読み込み、Document AIのバッチ処理（複数文書を一括で非同期解析する方式）へ渡します",
        "解析結果を信頼度で振り分けてBigQueryへ登録し、確認が必要な件数を担当者へ朝までに通知します"
      ],
      services: [
        { icon: "integration/cloud-scheduler", name: "Cloud Scheduler", role: "cron形式で毎晩ジョブを起動する定時トリガー" },
        { icon: "compute/cloud-run-jobs", name: "Cloud Run Jobs", role: "リクエスト応答ではなく「始まって終わる」一括処理の実行環境。HTTPサーバーを書かずに済む" },
        { icon: "ai/document-ai", name: "Document AI", role: "バッチ処理モードで大量の帳票を一括解析する。1件ずつのオンライン処理より大量処理に向く" },
        { icon: "storage/cloud-storage", name: "Cloud Storage", role: "日中の帳票のため場所と、バッチ解析の入出力の受け渡し場所" },
        { icon: "analytics/bigquery", name: "BigQuery", role: "抽出データの蓄積先。役割は推奨構成と同じ" }
      ],
      points: [
        "「請求書の処理は翌朝までに終わっていればよい」という業務なら、1件ずつ即時処理する必要はありません。要件のリアルタイム性を疑うことがコストと複雑さを下げる第一歩です",
        "Pub/Subの通知連携やPush配信の設定が丸ごと不要になり、構成要素が減って運用も理解も楽になります",
        "Document AIのバッチ処理は大量文書の一括解析に向いた方式で、結果はCloud Storage経由で受け取ります。1件あたりの解析単価はオンラインと同水準ですが、呼び出し回りの作りが単純になります",
        "夜間ジョブが失敗した場合に朝一で気づける監視（ケース16と同じ考え方）だけは必ず入れておきます"
      ],
      pros: [
        "構成が単純で、イベント駆動の知識がなくても作れて運用しやすい",
        "処理が夜間に寄るため、日中の業務システムやネットワークに影響を与えない"
      ],
      cons: [
        "アップロードから結果が出るまで最大1日待つことになる",
        "1回のジョブにまとまるため、失敗時の再実行の影響範囲が大きい（途中から再開できる作りにしておく必要がある）"
      ],
      cost: "<strong>月1万円〜4万円程度</strong>（月2,000〜3,000ページ・東京リージョン・1USD=150円換算の目安）。Document AIの解析課金は推奨構成と同水準で、Cloud RunのCPU時間が夜間の実行時間分だけに減ります。差は主に構築・運用の手間です。",
      references: [
        { title: "処理リクエストの送信（バッチ処理）", url: "https://cloud.google.com/document-ai/docs/send-request?hl=ja", note: "バッチ処理の公式手順" },
        { title: "Cloud Run Jobsの作成", url: "https://cloud.google.com/run/docs/create-jobs?hl=ja" },
        { title: "Cloud Schedulerドキュメント", url: "https://cloud.google.com/scheduler/docs?hl=ja" }
      ]
    },
    {
      name: "Geminiのマルチモーダル抽出構成",
      when: "請求書以外の多様な帳票（独自レイアウトの申込書・報告書など）を扱う場合や、抽出項目を柔軟に変えながら試行したい場合",
      diagram: {
        cols: 5, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [4, 1] }
        ],
        nodes: [
          { id: "staff", icon: "client/users", label: "担当者\n帳票を投入", col: 0, row: 0 },
          { id: "gcs", icon: "storage/cloud-storage", label: "Cloud Storage\n帳票置き場", col: 1, row: 0 },
          { id: "ps", icon: "integration/pubsub", label: "Pub/Sub\n通知キュー", col: 2, row: 0 },
          { id: "run", icon: "compute/cloud-run", label: "Cloud Run\n抽出処理", col: 3, row: 0 },
          { id: "gemini", icon: "ai/gemini", label: "Gemini\n項目抽出", col: 4, row: 0 },
          { id: "bq", icon: "analytics/bigquery", label: "BigQuery\n抽出データ", col: 3, row: 1 }
        ],
        edges: [
          { from: "staff", to: "gcs", label: "帳票アップロード" },
          { from: "gcs", to: "ps", label: "追加通知" },
          { from: "ps", to: "run", label: "Push配信" },
          { from: "run", to: "gemini", label: "抽出指示" },
          { from: "run", to: "bq", label: "結果登録" }
        ]
      },
      flow: [
        "パイプラインの形は推奨構成と同じで、抽出エンジンだけDocument AIからGeminiに差し替えます",
        "Cloud Runが帳票の画像やPDFをGeminiへ渡し、「この帳票から取引先名・金額・日付をJSON形式で抜き出してください」という指示（プロンプト）で抽出させます",
        "Geminiは画像を直接理解できる（マルチモーダル）ため、事前の学習なしで多様なレイアウトの帳票に対応できます",
        "抽出結果の形式チェックをCloud Runで行い、BigQueryへ登録します"
      ],
      services: [
        { icon: "ai/gemini", name: "Gemini（Vertex AI）", role: "帳票画像を直接読んで指示どおりの項目を抽出する。抽出項目の変更はプロンプトの書き換えだけで済む" },
        { icon: "compute/cloud-run", name: "Cloud Run", role: "プロンプトの組み立てと、抽出結果の形式検証（数値が数値か・日付が妥当かなど）を担う" },
        { icon: "storage/cloud-storage", name: "Cloud Storage", role: "帳票原本の置き場。役割は推奨構成と同じ" },
        { icon: "integration/pubsub", name: "Pub/Sub", role: "通知キュー。役割は推奨構成と同じ" },
        { icon: "analytics/bigquery", name: "BigQuery", role: "抽出データの蓄積先。役割は推奨構成と同じ" }
      ],
      points: [
        "Document AIのプロセッサにない帳票種別でも、プロンプトを書くだけで抽出を始められる柔軟さが最大の理由です。「来月から様式が変わる」にもプロンプト修正だけで追従できます",
        "一方でDocument AIのような項目ごとの信頼度スコアは返ってこないため、人の確認へ回す基準を自分で設計する必要があります（金額の再計算チェック、必須項目の欠落検出など）",
        "生成AIは出力形式が揺れることがあるため、構造化出力の指定とCloud Run側での形式検証を必ずセットにします",
        "請求書のような定型帳票の精度と信頼度管理はDocument AI、多様な帳票への柔軟対応はGemini、と使い分けるのが現在の判断軸です。両方を併用し帳票種別で振り分ける構成も実務ではよくあります"
      ],
      pros: [
        "学習済みプロセッサがない独自帳票にもすぐ対応でき、抽出項目の変更が速い",
        "解析単価が特化型プロセッサより安く済むことが多い",
        "抽出と同時に要約や分類など別のタスクも1回の呼び出しで頼める"
      ],
      cons: [
        "項目ごとの信頼度スコアがなく、確認へ回す判定ロジックを自作する必要がある",
        "出力形式の揺れや読み間違いに備えた検証処理が必須で、精度評価も自分たちで行うことになる"
      ],
      cost: "<strong>月数千円〜2万円程度</strong>（月2,000〜3,000ページ・東京リージョン・1USD=150円換算の目安）。Gemini Flash系モデルなら1ページあたり1円未満〜数円で、特化型プロセッサより安くなるケースが多いです。ただし再試行やプロンプト改善の試行錯誤分も課金されます。",
      references: [
        { title: "Geminiによるドキュメント理解", url: "https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/document-understanding?hl=ja", note: "PDFや画像から情報抽出する公式ガイド" },
        { title: "Vertex AIの生成AIの概要", url: "https://cloud.google.com/vertex-ai/generative-ai/docs/overview?hl=ja" }
      ]
    }
  ],
  cost: "<p>月2,000〜3,000ページの想定で、推奨構成（Document AI）は<strong>月1万円〜5万円程度</strong>、Gemini抽出構成は<strong>月数千円〜2万円程度</strong>、夜間バッチ化してもDocument AIの解析課金自体は変わりません。この規模なら月100時間の入力人件費（数十万円相当）に対して十分に元が取れる計算です。いずれも東京リージョン・1USD=150円換算の目安で、プロセッサ種別ごとの単価は料金表で必ず確認してください。</p>",
  summary: "<p>帳票のデータ化は「文字を読む」ではなく<strong>「項目の意味を理解して抜き出し、信頼度で人の確認へ振り分ける」</strong>仕組みとして設計します。定型帳票の精度と信頼度管理ならDocument AI、多様な帳票への柔軟対応ならGeminiという使い分けが現在の判断軸です。また、即時処理が本当に必要かを疑い、夜間バッチで十分なら構成を簡素にするのも大事な判断です。イベント駆動パイプラインの基本形はケース17、定期バッチの組み方はケース16で学べます。</p>",
  quiz: [
    {
      q: "汎用OCR（画像から文字を全部読み取るAPI）でも請求書の文字は読み取れます。それでもこのケースでDocument AIの請求書パーサーを選んだのはなぜでしょうか。",
      a: "汎用OCRの出力は「どこに何という文字があるか」の羅列で、どの文字が金額でどれが日付かという意味づけがありません。取引先ごとにレイアウトが違う帳票から項目を取り出すには、文字の位置ルールを自分で書くことになり、レイアウトの数だけ実装が増えます。請求書パーサーは項目の意味づけまで学習済みで、さらに項目ごとの信頼度スコアを返すため、人の確認へ振り分ける運用まで含めて成立させられます。"
    },
    {
      q: "「読み取り精度は100%ではない」という前提で、この構成は誤読が会計データへ混入するのをどう防いでいますか。仕組みを2つ挙げてください。",
      a: "1つ目は信頼度スコアによる振り分けで、基準未満の帳票は自動登録せず人の確認・修正を挟みます。2つ目は原本との紐づけで、帳票原本をCloud Storageに保管し抽出データから必ず辿れるようにしておくことで、確認時や監査時に原本と突き合わせられます。精度を100%に近づける努力よりも、間違いが混入しにくく発見しやすい業務フローを設計することが実務では重要です。"
    },
    {
      q: "経理から「請求書に加えて、取引先ごとに様式が違う納品書と検収書も読み取りたい。様式は今後も増える」と言われました。あなたなら構成をどう発展させますか。",
      a: "帳票種別で抽出エンジンを振り分けるハイブリッド構成にします。定型性が高く専用プロセッサがある請求書はDocument AIのまま残して信頼度管理を活かし、様式が多様で今後も増える納品書・検収書はGeminiのマルチモーダル抽出で受けます。パイプライン（Cloud Storage+Pub/Sub+Cloud Run）は共通なので、Cloud Runの振り分けロジックを足すだけで拡張できます。全部を一方に寄せるより、帳票の性質ごとに得意なエンジンを使い分けるのが現実的です。"
    }
  ]
});
