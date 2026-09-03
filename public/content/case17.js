// ケース17：画像処理パイプライン
registerCase({
  id: 17,
  category: "サーバーレス・イベント駆動",
  title: "画像処理パイプライン",
  scenario: "<p>フリマアプリの出品画像を扱う。ユーザーが撮影した写真をそのまま配信すると重すぎるため、アップロードのたびにサムネイル3サイズへのリサイズとWebP形式（同じ画質でファイルサイズを小さくできる画像形式）への変換を自動で行いたい。投稿は1日数千〜数万枚だが、テレビ紹介やキャンペーンで数十倍に跳ねることがある。アプリ本体はケース7のようなCloud Run構成で動いており、画像変換の担当は兼任エンジニア1人。変換に失敗した画像を放置すると商品ページが壊れるので、取りこぼしは避けたい。</p>",
  requirements: [
    "アップロードされたら自動で即時に変換したい（定期実行や人手ではなく）",
    "投稿数の急増に自動で追従したい",
    "変換に失敗した画像を取りこぼしたくない（再試行がほしい）",
    "アプリ本体のコードに変換処理を混ぜたくない",
    "使った分だけの課金にしたい"
  ],
  main: {
    name: "Cloud Storage+Eventarc+Cloud Run構成",
    diagram: {
      cols: 5, rows: 2,
      groups: [
        { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [4, 1] }
      ],
      nodes: [
        { id: "user", icon: "client/users", label: "ユーザー\n画像投稿", col: 0, row: 0 },
        { id: "src", icon: "storage/cloud-storage", label: "Cloud Storage\n原本バケット", col: 1, row: 0 },
        { id: "ea", icon: "integration/eventarc", label: "Eventarc\nGCSトリガー", col: 2, row: 1 },
        { id: "run", icon: "compute/cloud-run", label: "Cloud Run\n画像変換サービス", col: 3, row: 0 },
        { id: "dst", icon: "storage/cloud-storage", label: "Cloud Storage\n配信用バケット", col: 4, row: 0 },
        { id: "ps", icon: "integration/pubsub", label: "Pub/Sub\n内部トランスポート", col: 1, row: 1 }
      ],
      edges: [
        { from: "user", to: "src", label: "アップロード" },
        { from: "src", to: "ea", label: "作成イベント" },
        { from: "ea", to: "run", label: "push起動" },
        { from: "run", to: "src", label: "原本を取得" },
        { from: "run", to: "dst", label: "変換保存" },
        { from: "ea", to: "ps", noArrow: true, dashed: true }
      ]
    },
    flow: [
      "ユーザーが原本バケットへ画像をアップロードする（アプリが発行する署名付きURL経由が定石）",
      "オブジェクト作成イベントをEventarcが検知し、Cloud Runの画像変換サービスをpushで起動する",
      "変換サービスはイベントに含まれるバケット名とオブジェクト名を頼りに原本を取得し、リサイズとWebP変換を行う",
      "変換結果を配信用バケットへ保存する。商品ページやCDNは配信用バケットだけを参照する",
      "Eventarcは内部的にPub/Subで配送しており、変換サービスがエラーを返した場合は自動で再試行される"
    ],
    services: [
      { icon: "storage/cloud-storage", name: "Cloud Storage（原本/配信用）", role: "アップロード先と変換結果の置き場。役割の異なる2つのバケットに分ける" },
      { icon: "integration/eventarc", name: "Eventarc", role: "「オブジェクトが作られた」というイベントを検知してCloud Runへ届ける配線役" },
      { icon: "compute/cloud-run", name: "Cloud Run", role: "画像変換サービス。イベント量に応じて0台からN台まで自動スケールする" },
      { icon: "integration/pubsub", name: "Pub/Sub", role: "Eventarcが内部で使う配送路。バッファリングと再試行を担う" }
    ],
    points: [
      "原本と配信用でバケットを分けました。同じバケットに変換結果を書き込むと、その書き込みがまた作成イベントを発火させて無限ループになるためです。イベント駆動で最も有名な事故を、構成そのもので防いでいます",
      "同じイベントが2回届いても壊れないよう、出力は「同じ名前への上書き」で冪等（べきとう。何度実行しても結果が同じになる性質）にしています。Pub/Subの配信保証は「少なくとも1回」で、重複は異常ではなく仕様です",
      "アプリ本体と変換サービスを分けたので、変換の失敗や遅延がアプリのレスポンスに影響しません。変換ロジックだけを独立してデプロイ・差し替えできるのも利点です",
      "pushで起動されるCloud Runには応答までの時間制限があります。数秒で終わる画像変換には最適ですが、動画変換のような長時間処理はこの型ではなく、ケース15のようなワーカー型やCloud Run Jobsに切り替えます"
    ],
    pros: [
      "投稿ゼロの時間帯は0円、スパイク時は自動でスケールする",
      "再試行の仕組みが標準で付いてくる（自前のリトライ実装が不要）",
      "アプリ本体と疎結合で、変換処理だけを独立に開発・デプロイできる",
      "同じ骨格を帳票OCR（ケース28）や音声文字起こし（ケース29）にも流用できる"
    ],
    cons: [
      "イベントの重複配信を前提にした冪等設計が必須",
      "処理時間の長い変換（動画など）には応答時間制限の関係で不向き",
      "過去にアップロード済みの画像はイベントが発生しないため処理されない（過去分は別途バッチが必要）",
      "ローカルでの動作確認にはイベント形式（CloudEvents）の理解が必要で、最初のデバッグに戸惑いやすい"
    ],
    cost: "<strong>月1,000円前後〜</strong>。1日1万枚・1枚あたり1vCPUで0.5秒の変換ならCloud Runは月540円程度、画像の保存料は150GBで約520円。EventarcとPub/Subはこの規模なら無料枠内（東京リージョン・1USD=150円換算の目安）。",
    references: [
      { title: "Eventarcの概要", url: "https://cloud.google.com/eventarc/docs/overview?hl=ja" },
      { title: "Cloud Storageのデータを処理する画像処理チュートリアル", url: "https://cloud.google.com/run/docs/tutorials/image-processing?hl=ja", note: "この構成そのものの公式ハンズオン" },
      { title: "Cloud Storageトリガーの作成（Eventarc）", url: "https://cloud.google.com/eventarc/docs/run/route-trigger-cloud-storage?hl=ja" },
      { title: "Cloud StorageのPub/Sub通知", url: "https://cloud.google.com/storage/docs/pubsub-notifications?hl=ja", note: "イベント通知の仕組みの理解に" }
    ]
  },
  alternatives: [
    {
      name: "Cloud Storageトリガー+Cloud Run functions構成",
      when: "変換が1種類・数秒で終わる軽い処理で、最小の手数で作りたい場合",
      diagram: {
        cols: 4, rows: 1,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [3, 0] }
        ],
        nodes: [
          { id: "user", icon: "client/users", label: "ユーザー\n画像投稿", col: 0, row: 0 },
          { id: "src", icon: "storage/cloud-storage", label: "Cloud Storage\n原本バケット", col: 1, row: 0 },
          { id: "fn", icon: "compute/cloud-functions", label: "Cloud Run functions\nリサイズ関数", col: 2, row: 0 },
          { id: "dst", icon: "storage/cloud-storage", label: "Cloud Storage\n配信用バケット", col: 3, row: 0 }
        ],
        edges: [
          { from: "user", to: "src", label: "アップロード" },
          { from: "src", to: "fn", label: "作成イベントで起動" },
          { from: "fn", to: "dst", label: "サムネイル保存" }
        ]
      },
      flow: [
        "原本バケットへのアップロードをトリガーに、Cloud Run functionsが直接起動する",
        "関数が画像をリサイズし、配信用バケットへ保存する",
        "処理がエラーになった場合はイベントの再配信によって再試行される"
      ],
      services: [
        { icon: "storage/cloud-storage", name: "Cloud Storage", role: "アップロード先と保存先。バケットを分ける原則は推奨構成と同じ" },
        { icon: "compute/cloud-functions", name: "Cloud Run functions", role: "ソースコードを置くだけで動く関数実行環境。トリガー設定も数クリックで済む" }
      ],
      points: [
        "ソースコードをデプロイするだけで動き、コンテナのビルドすら不要です。イベント駆動の入門として最短の構成です",
        "現行世代の関数は内部的にCloud RunとEventarcの上で動いています。つまりこの構成は推奨構成の簡易包装であり、細かい制御（同時実行数・リトライ条件・複数トリガー）が必要になったら自然に推奨構成へ移行できます",
        "ImageMagickでサムネイルを生成する公式チュートリアルがあり、写経から始めやすいのも利点です"
      ],
      pros: [
        "最小の手数で構築でき、無料枠も大きい",
        "推奨構成と同じイベント駆動の考え方をそのまま学べる"
      ],
      cons: [
        "実行時間・メモリの上限が厳しめで、重い変換には育てられない",
        "3サイズ生成やWebP変換など処理が増えてくると、関数1本のコード管理が手狭になる"
      ],
      cost: "<strong>月0円〜数百円</strong>。1日数百〜数千枚程度なら呼び出し回数・実行時間ともに無料枠内に収まることが多い。",
      references: [
        { title: "Cloud Storageトリガー（Cloud Run functions）", url: "https://cloud.google.com/functions/docs/calling/storage?hl=ja" },
        { title: "画像を処理するチュートリアル（ImageMagick）", url: "https://cloud.google.com/functions/docs/tutorials/imagemagick?hl=ja", note: "サムネイル生成の公式サンプル" }
      ]
    },
    {
      name: "Cloud Run Jobsによる一括再処理構成",
      when: "サムネイル仕様の変更などで、アップロード済みの全画像をまとめて再変換したい場合",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [3, 1] }
        ],
        nodes: [
          { id: "dev", icon: "client/developer", label: "開発者\n再変換の指示", col: 0, row: 0 },
          { id: "job", icon: "compute/cloud-run-jobs", label: "Cloud Run Jobs\n一括再変換", col: 1, row: 0 },
          { id: "src", icon: "storage/cloud-storage", label: "Cloud Storage\n原本バケット", col: 2, row: 0 },
          { id: "dst", icon: "storage/cloud-storage", label: "Cloud Storage\n配信用バケット", col: 2, row: 1 }
        ],
        edges: [
          { from: "dev", to: "job", label: "手動/定時実行" },
          { from: "job", to: "src", label: "一覧・原本取得" },
          { from: "job", to: "dst", label: "変換して上書き" }
        ]
      },
      flow: [
        "開発者が再変換ジョブを実行する（負荷を避けたければCloud Schedulerで夜間に実行してもよい）",
        "ジョブが原本バケットのオブジェクト一覧を取得し、タスクを分割して並列に変換する",
        "変換結果を配信用バケットへ同じ名前で上書き保存する"
      ],
      services: [
        { icon: "compute/cloud-run-jobs", name: "Cloud Run Jobs", role: "全件を舐めるバッチの実行環境。タスク分割と並列実行、失敗タスクの再試行が組み込み" },
        { icon: "storage/cloud-storage", name: "Cloud Storage", role: "原本の読み出し元と変換結果の書き込み先。日常のイベント駆動と同じバケットを使う" }
      ],
      points: [
        "イベント駆動は「これから起きること」にしか反応しません。過去分の一括処理はバッチという別の道具で解く、という使い分けがこのケースの核心です",
        "Run Jobsのタスク並列数を上げれば数百万枚でも現実的な時間で処理できます。ただし並列を一気に上げるとCloud Storageや後続システムへの負荷が跳ねるので、少しずつ上げて様子を見ます",
        "出力が上書きで冪等になっていれば、一括バッチの実行中に日常のイベント駆動が同じ画像を処理しても結果は矛盾しません。推奨構成の冪等設計がここでも効いてきます"
      ],
      pros: [
        "過去分を確実に処理でき、進捗と失敗をジョブ単位で管理できる",
        "日常のイベント駆動と同じ変換コードを流用できる"
      ],
      cons: [
        "実行のたびに全件スキャンのコストと時間がかかる",
        "一括処理とイベント駆動が一時的に二重処理になる瞬間がある（冪等なら実害はない）"
      ],
      cost: "<strong>1回あたり数百円〜数千円</strong>。100万枚を1枚0.5秒（1vCPU）で処理すると約1,800円。実行した分だけの支払いで済む。",
      references: [
        { title: "Cloud Run jobsの作成", url: "https://cloud.google.com/run/docs/create-jobs?hl=ja", note: "タスク分割・並列実行の設定もここで分かる" },
        { title: "スケジュールに沿ってジョブを実行する", url: "https://cloud.google.com/run/docs/execute/jobs-on-schedule?hl=ja", note: "夜間実行にする場合" }
      ]
    }
  ],
  cost: "<p>推奨構成は<strong>月1,000円前後〜</strong>で、投稿量に比例してなだらかに増えます。関数版はさらに安く始められますが、上限に当たったら推奨構成へ移行することになるため、伸びるサービスなら最初からEventarc+Cloud Runで組む判断もあります。一括再処理は<strong>実行1回あたり数百円〜数千円</strong>の都度払いです（いずれも東京リージョン・1USD=150円換算の目安）。</p>",
  summary: "<p>「ファイルが置かれたら自動で動く」は、GCPのイベント駆動の最も基本的な型です。学びは3つで、(1)<strong>原本と出力のバケットを分けて無限ループを防ぐ</strong>、(2)「少なくとも1回」配信を前提に<strong>冪等に作る</strong>、(3)イベント駆動が担うのは今後の分だけで、<strong>過去分はバッチで解く</strong>、です。この骨格は画像に限らず、帳票OCR（ケース28）や音声文字起こし（ケース29）でもそのまま登場します。処理をキューで受けるワーカー型との違いはケース15と見比べると理解が深まります。</p>",
  quiz: [
    {
      q: "変換結果を原本と同じバケットに保存する設計にすると、何が起きるでしょうか。",
      a: "変換結果の書き込み自体が新しいオブジェクト作成イベントを発火させ、変換サービスが自分の出力を再び変換する無限ループに陥ります。イベントと課金が雪だるま式に増える典型的な事故です。出力先のバケットを分けるのが最も確実な対策で、どうしても同一バケットに置きたい場合もプレフィックスでトリガー対象を絞るなど、出力がトリガーに引っかからない工夫が必須です。"
    },
    {
      q: "同じ画像の作成イベントが2回届き、変換サービスが2回実行されました。これは障害でしょうか。どう備えるべきでしょうか。",
      a: "障害ではなく仕様です。Pub/Subをはじめとするメッセージ配送は「少なくとも1回」の配信を保証する設計で、ネットワークの揺らぎや再試行によって重複は普通に起こります。備えとしては処理を冪等にすること、つまり変換結果を毎回同じ名前へ上書きし、2回実行されても最終状態が変わらないようにします。重複を止めようとするのではなく、重複しても壊れない側に倒すのがイベント駆動の作法です。"
    },
    {
      q: "サービスが成長し、画像に加えて動画（1本の変換に10分以上かかる）も扱うことになりました。あなたならこの構成のままいきますか。",
      a: "動画はこの構成のままでは扱いません。Eventarcからのpush起動には応答時間の制限があり、10分級の処理はタイムアウトや再試行の多重起動を招きます。イベントを受けたらPub/Subのキューに積み、ケース15のようなワーカーが自分のペースで取り出して処理する型に切り替えるか、動画変換自体はケース4で学ぶTranscoder APIのようなマネージドサービスへ任せるのが現実的です。軽い画像は現行のまま、重い動画だけ別経路にする併用が定石です。"
    }
  ]
});
