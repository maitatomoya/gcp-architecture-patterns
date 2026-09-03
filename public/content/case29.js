// ケース29：音声文字起こし・議事録作成
registerCase({
  id: 29,
  category: "AI・機械学習",
  title: "音声文字起こし・議事録作成",
  scenario: "<p>社内の定例会議や顧客との打ち合わせについて、録音はしているものの議事録の作成が追いつかず、担当者が毎回30分〜1時間かけて聞き直しながら書き起こしています。そこで、録音ファイルをアップロードすると自動で文字起こしされ、さらに要約・決定事項・宿題（アクションアイテム）まで整理された議事録の下書きができるシステムを作ることになりました。会議は週数十件、1件あたり30分〜2時間。誰が発言したかの区別（話者分離）も欲しいという要望があります。議事録の最終確認は人が行います。</p>",
  requirements: [
    "録音ファイルをアップロードするだけで文字起こしが動いてほしい",
    "1〜2時間の長い音声を安定して処理したい",
    "誰の発言かを区別したい（話者分離）",
    "全文だけでなく、要約・決定事項・宿題を整理した議事録の下書きが欲しい",
    "会議データを外部に出さない。入力がAIモデルの学習に使われないこと"
  ],
  main: {
    name: "Speech-to-Text+Geminiの文字起こし・要約パイプライン",
    diagram: {
      cols: 5, rows: 2,
      groups: [
        { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [4, 1] }
      ],
      nodes: [
        { id: "user", icon: "client/users", label: "社員\n録音を投入", col: 0, row: 0 },
        { id: "gcs", icon: "storage/cloud-storage", label: "Cloud Storage\n録音ファイル", col: 1, row: 0 },
        { id: "evarc", icon: "integration/eventarc", label: "Eventarc\nイベント検知", col: 2, row: 0 },
        { id: "run", icon: "compute/cloud-run", label: "Cloud Run\n進行役の処理", col: 3, row: 0 },
        { id: "stt", icon: "ai/speech-to-text", label: "Speech-to-Text\n音声認識", col: 4, row: 0 },
        { id: "gemini", icon: "ai/gemini", label: "Gemini\n議事録生成", col: 4, row: 1 },
        { id: "fstr", icon: "database/firestore", label: "Firestore\n議事録の保存", col: 2, row: 1 }
      ],
      edges: [
        { from: "user", to: "gcs", label: "録音アップロード" },
        { from: "gcs", to: "evarc", label: "作成イベント" },
        { from: "evarc", to: "run", label: "起動" },
        { from: "run", to: "stt", label: "文字起こし" },
        { from: "run", to: "gemini", label: "要約生成" },
        { from: "run", to: "fstr", label: "議事録保存" }
      ]
    },
    flow: [
      "社員が会議の録音ファイルをCloud Storageへアップロードします",
      "Eventarcがファイル作成イベントを検知し、Cloud Runの処理を起動します。GCSのイベントをCloud Runへつなぐ配線役がEventarcです",
      "Cloud RunがSpeech-to-Textのバッチ認識（長時間音声向けの非同期処理）を開始します。話者分離を有効にすると「話者1・話者2」のラベルつきで全文が返ります",
      "文字起こし全文をGeminiへ渡し、要約・決定事項・宿題を項目別に整理した議事録の下書きを生成させます",
      "全文と議事録をFirestoreへ保存し、担当者へ完成通知を送ります。担当者は下書きを確認・修正して完成させます"
    ],
    services: [
      { icon: "ai/speech-to-text", name: "Speech-to-Text", role: "音声認識の本体。長時間音声のバッチ認識、話者分離、句読点の自動挿入に対応する" },
      { icon: "ai/gemini", name: "Gemini（Vertex AI）", role: "文字起こし全文から要約・決定事項・宿題を整理した議事録を生成する。Vertex AI経由の入出力は基盤モデルの学習に使われない" },
      { icon: "compute/cloud-run", name: "Cloud Run", role: "認識の開始・完了待ち・要約依頼・保存という一連の流れを進める進行役。処理がない時間はゼロまで縮む" },
      { icon: "integration/eventarc", name: "Eventarc", role: "Cloud Storageのファイル作成イベントをCloud Runへ届ける配線。アップロードだけで処理が始まる仕組みの要" },
      { icon: "storage/cloud-storage", name: "Cloud Storage", role: "録音ファイルの置き場。認識処理も音声をここから直接読む" },
      { icon: "database/firestore", name: "Firestore", role: "文字起こし全文と議事録の保存先。会議一覧や検索画面のバックエンドにそのまま使える" }
    ],
    points: [
      "文字起こしと要約を1つのAIにまとめず、Speech-to-TextとGeminiの2段に分けたのは役割が違うからです。話者分離・単語ごとのタイムスタンプ・専門用語の認識調整（モデル適応）は音声認識専用サービスの領分で、その出力を材料に文章を整えるのが言語モデルの領分です",
      "1〜2時間の音声を同期APIで待つとタイムアウトするため、バッチ認識（ジョブを投げて完了を待つ方式）を使います。Cloud Run側も「開始と完了確認を分ける」作りにして、長い処理を安定させます",
      "アップロードを起点にEventarcで全自動化したのは、「担当者が操作を覚える必要がない」ことが社内ツール定着の鍵だからです。置けば動く、が最強の使い勝手です",
      "要約は必ず「下書き」と位置づけ、人の確認を挟みます。決定事項の言い間違いや聞き取りミスがそのまま公式議事録になる事故を防ぐためです"
    ],
    pros: [
      "アップロードするだけで全文と議事録下書きまで自動で届く",
      "話者分離・タイムスタンプなど音声認識専用の機能が使える",
      "完全従量課金で、会議が少ない週はコストも下がる",
      "全文がFirestoreに残るため、過去の会議の発言検索という副産物も得られる"
    ],
    cons: [
      "録音品質（マイク距離・雑音・同時発話）が悪いと認識精度が大きく落ちる",
      "話者分離は「話者1・話者2」の区別までで、名前の特定は別途対応づけが必要",
      "社内用語・製品名は誤認識しやすく、モデル適応（用語登録）の育成が必要",
      "要約の品質は文字起こしの精度に引きずられる（誤認識はGeminiでは直せないことが多い）"
    ],
    cost: "<strong>月3,000円〜1万円程度</strong>（週10件・月40時間の音声の想定、東京リージョン・1USD=150円換算の目安）。Speech-to-Textが1時間あたり150円前後（認識モードにより数十円〜）で月6,000円程度、Geminiの要約は1会議あたり数円、Cloud Run・Eventarc・Firestoreは合計でも月数百円規模です。音声の総時間にほぼ比例します。",
    references: [
      { title: "Speech-to-Textドキュメント", url: "https://cloud.google.com/speech-to-text/docs?hl=ja" },
      { title: "音声ファイルのバッチ認識", url: "https://cloud.google.com/speech-to-text/v2/docs/batch-recognize?hl=ja", note: "長時間音声の非同期認識の公式手順" },
      { title: "話者ダイアライゼーション（話者分離）", url: "https://cloud.google.com/speech-to-text/docs/multiple-voices?hl=ja" },
      { title: "Eventarcドキュメント", url: "https://cloud.google.com/eventarc/docs?hl=ja" },
      { title: "Cloud Storageトリガーの作成", url: "https://cloud.google.com/eventarc/docs/run/route-trigger-cloud-storage?hl=ja", note: "GCSイベントでCloud Runを起動するこの構成そのものの手順" }
    ]
  },
  alternatives: [
    {
      name: "Geminiに音声を直接渡す一段構成",
      when: "話者分離やタイムスタンプが不要で、とにかく手軽に要約議事録だけ欲しい場合",
      diagram: {
        cols: 5, rows: 1,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [4, 0] }
        ],
        nodes: [
          { id: "user", icon: "client/users", label: "社員", col: 0, row: 0 },
          { id: "gcs", icon: "storage/cloud-storage", label: "Cloud Storage\n録音ファイル", col: 1, row: 0 },
          { id: "evarc", icon: "integration/eventarc", label: "Eventarc\nイベント検知", col: 2, row: 0 },
          { id: "run", icon: "compute/cloud-run", label: "Cloud Run\n呼び出し役", col: 3, row: 0 },
          { id: "gemini", icon: "ai/gemini", label: "Gemini\n音声理解・要約", col: 4, row: 0 }
        ],
        edges: [
          { from: "user", to: "gcs", label: "アップロード" },
          { from: "gcs", to: "evarc", label: "作成イベント" },
          { from: "evarc", to: "run", label: "起動" },
          { from: "run", to: "gemini", label: "音声ごと渡す" }
        ]
      },
      flow: [
        "アップロード〜起動までは推奨構成と同じで、Speech-to-Textの段を丸ごと省略します",
        "Cloud Runが音声ファイルをそのままGeminiへ渡します。Geminiは音声を直接理解できる（マルチモーダル）ため、文字起こしと要約を1回の呼び出しでこなせます",
        "生成された議事録の下書きを保存し、担当者へ通知します"
      ],
      services: [
        { icon: "ai/gemini", name: "Gemini（Vertex AI）", role: "音声を直接入力として受け取り、内容理解と議事録生成を一度に行う" },
        { icon: "compute/cloud-run", name: "Cloud Run", role: "音声の受け渡しとプロンプト組み立てだけの薄い呼び出し役" },
        { icon: "storage/cloud-storage", name: "Cloud Storage", role: "録音ファイルの置き場" },
        { icon: "integration/eventarc", name: "Eventarc", role: "アップロードを起点に処理を起動する配線" }
      ],
      points: [
        "構成要素が1つ減り、実装もプロンプト1本になるため、最短で動くものを作れます。まずこれで効果を確かめてから推奨構成へ進む順序も十分ありです",
        "音声認識専用サービスの強み（話者分離・単語タイムスタンプ・用語のモデル適応）は失われます。「誰が言ったか」が要件にある場合はこの構成では満たせません",
        "長時間音声は入力上限や処理時間の制約に当たることがあるため、長い会議は分割して渡す工夫が必要になります"
      ],
      pros: [
        "構成も実装も最少で、数日で試せる",
        "文字起こしと要約が1回の呼び出しで済み、費用も小さいことが多い"
      ],
      cons: [
        "話者分離・タイムスタンプ・用語適応といった音声専用機能が使えない",
        "正確な逐語の全文記録が必要な用途（コールセンターの応対記録など）には向かない"
      ],
      cost: "<strong>月1,000円〜5,000円程度</strong>（月40時間の音声の想定、東京リージョン・1USD=150円換算の目安）。音声入力のトークン課金が中心で、モデルと音声時間に比例します。",
      references: [
        { title: "Geminiによる音声理解", url: "https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/audio-understanding?hl=ja", note: "音声を直接入力するマルチモーダル機能の公式ガイド" },
        { title: "Vertex AIの生成AIの概要", url: "https://cloud.google.com/vertex-ai/generative-ai/docs/overview?hl=ja" }
      ]
    },
    {
      name: "リアルタイム字幕構成（ストリーミング認識）",
      when: "会議が終わってからではなく、会議中にその場で字幕・文字起こしを表示したい場合",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [3, 1] }
        ],
        nodes: [
          { id: "client", icon: "client/client", label: "会議アプリ\nマイク音声", col: 0, row: 0 },
          { id: "run", icon: "compute/cloud-run", label: "Cloud Run\n中継サーバー", col: 1, row: 0 },
          { id: "stt", icon: "ai/speech-to-text", label: "Speech-to-Text\nストリーミング認識", col: 2, row: 0 },
          { id: "gcs", icon: "storage/cloud-storage", label: "Cloud Storage\n全文の保存", col: 1, row: 1 },
          { id: "gemini", icon: "ai/gemini", label: "Gemini\n議事録生成", col: 3, row: 1 }
        ],
        edges: [
          { from: "client", to: "run", label: "音声ストリーム" },
          { from: "run", to: "stt", label: "逐次認識" },
          { from: "run", to: "gcs", label: "全文保存" },
          { from: "run", to: "gemini", label: "終了後に要約" }
        ]
      },
      flow: [
        "会議アプリがマイク音声をWebSocket（双方向の常時接続）でCloud Runの中継サーバーへ送り続けます",
        "中継サーバーは音声をSpeech-to-Textのストリーミング認識へ流し、数秒以内に返る認識結果を字幕として参加者の画面へ届けます",
        "会議終了後、たまった全文をCloud Storageへ保存し、Geminiで議事録の下書きを生成します",
        "「その場の字幕」と「後からの議事録」を1つの構成で両立させる形です"
      ],
      services: [
        { icon: "ai/speech-to-text", name: "Speech-to-Text（ストリーミング）", role: "音声を流しながら逐次認識結果を返すモード。字幕のようなリアルタイム用途向け" },
        { icon: "compute/cloud-run", name: "Cloud Run", role: "WebSocketで音声を受けて認識へ中継するサーバー。Cloud RunはWebSocketに対応している" },
        { icon: "ai/gemini", name: "Gemini（Vertex AI）", role: "会議終了後の議事録生成。役割は推奨構成と同じ" },
        { icon: "storage/cloud-storage", name: "Cloud Storage", role: "全文と録音の保存先" }
      ],
      points: [
        "「会議後の議事録」と「会議中の字幕」は要件がまったく別物で、後者には常時接続と低遅延という設計上の重い制約が加わります。要件を混ぜずに分けて考えることが大事です",
        "ストリーミング認識には1接続あたりの時間制限があるため、長い会議では接続の張り直しを自動で行う実装が必要です",
        "中継サーバーは接続中ずっと稼働し続けるため、リクエスト単位で縮むバッチ型と違いCPU割り当てを常時確保する設定が要ります。従量課金の旨みは薄れます",
        "聴覚に障がいのある参加者への情報保障（アクセシビリティ）としても価値があり、社内導入の合意を得やすい構成です"
      ],
      pros: [
        "会議中に字幕が出るため、聞き逃しの確認や情報保障にその場で役立つ",
        "終了直後には全文がそろっており、議事録生成までの待ち時間がほぼゼロ"
      ],
      cons: [
        "WebSocket中継・接続の張り直し・音声品質の担保など、実装難度が3構成の中で最も高い",
        "接続時間ぶんの認識課金とサーバー稼働費がかかり、録音一括方式より割高になりやすい"
      ],
      cost: "<strong>月1万円〜3万円程度</strong>（月40時間の会議をリアルタイム認識する想定、東京リージョン・1USD=150円換算の目安）。ストリーミング認識の時間課金に加え、会議中は中継サーバーのCPU確保分が乗ります。",
      references: [
        { title: "ストリーミング音声の文字変換", url: "https://cloud.google.com/speech-to-text/docs/transcribe-streaming-audio?hl=ja", note: "ストリーミング認識の公式ガイド" },
        { title: "Cloud RunでのWebSocketの使用", url: "https://cloud.google.com/run/docs/triggering/websockets?hl=ja" }
      ]
    }
  ],
  cost: "<p>月40時間の会議音声の想定で、推奨構成は<strong>月3,000円〜1万円程度</strong>、Gemini一段構成なら<strong>月1,000円〜5,000円程度</strong>、リアルタイム字幕構成は<strong>月1万円〜3万円程度</strong>が目安です（東京リージョン・1USD=150円換算）。毎回30分〜1時間かけていた議事録作成の人件費と比べれば、どの構成でも投資対効果は出やすい領域です。</p>",
  summary: "<p>議事録の自動化は<strong>「音を文字にする」と「文字を文書に整える」を分けて考える</strong>のが設計の出発点です。話者分離や用語適応が要るなら音声認識専用サービス+Geminiの二段構成、手軽さ最優先ならGemini一段、会議中の字幕という別要件が加わるならストリーミング構成、と要件が構成を決めます。共通するのは、AIの出力を「下書き」と位置づけて人の確認で仕上げる運用設計です。アップロード起点のイベント駆動処理はケース17、生成AI活用を全社に広げる話はケース35につながります。</p>",
  quiz: [
    {
      q: "Geminiは音声を直接理解できるのに、推奨構成ではわざわざSpeech-to-TextとGeminiの二段に分けています。どんな要件があるときに二段構成を選ぶべきでしょうか。",
      a: "話者分離（誰の発言かの区別）、単語ごとのタイムスタンプ、社内用語のモデル適応といった、音声認識専用サービスにしかない機能が要件に入っているときです。このケースでは話者分離の要望があるため二段構成を選びました。逆にそれらが不要で要約だけ欲しいなら、Gemini一段の方が構成も費用も小さくて済みます。機能の有無で構成を選ぶ、要件駆動の典型例です。"
    },
    {
      q: "この構成では1〜2時間の音声を同期API（呼び出してその場で結果を待つ方式）で処理していません。なぜでしょうか。また、どんな作りにしていますか。",
      a: "1〜2時間の音声認識には数分以上かかることがあり、同期呼び出しではHTTPのタイムアウトに当たって処理が失敗するためです。そこでバッチ認識でジョブとして投げ、完了を待って結果を取りに行く非同期の作りにしています。「時間のかかる処理はリクエストから切り離す」はケース15で学ぶ非同期処理の基本で、AI系の重い処理ではとくに頻出する設計判断です。"
    },
    {
      q: "経営会議での利用を打診されましたが、「機密性の高い議論を録音してAIに渡すのは不安だ」という声があります。あなたはどんな対策と説明をしますか。",
      a: "技術面では、Vertex AI経由の入出力は基盤モデルの学習に使われないというGoogleの公式方針を示し、録音とデータへのアクセス権をIAMで役員と担当者のみに絞り、保存期間を決めて自動削除するライフサイクル設定を入れます。運用面では、対象にする会議の基準を決め、参加者への録音の事前周知をルール化します。そのうえで、要約は下書きであり公式議事録は人が確定する運用を説明します。不安への回答は技術設定と運用ルールの両方で構成するのが実務です。"
    }
  ]
});
