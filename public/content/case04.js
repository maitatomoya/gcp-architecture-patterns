// ケース4：動画配信サービス（VOD）
registerCase({
  id: 4,
  category: "Webサイト・配信",
  title: "動画配信サービス（VOD）",
  scenario: "<p>オンライン講座の動画配信サービスを作りたい。講師が録画済みの動画をアップロードし、受講者はスマホやPCから好きなときに視聴する（VOD：ビデオオンデマンド）。動画は将来数万本、同時視聴は数千を想定。スマホの回線状況に応じて画質が自動で切り替わる再生が必須で、運用チームは小さいため変換サーバーの面倒は見たくない。</p>",
  requirements: [
    "アップロードされた動画を複数画質へ自動変換したい",
    "回線状況に応じて画質が切り替わるストリーミング配信（HLS/DASH）",
    "人気講座の公開直後など、視聴の急増に耐えたい",
    "変換の進み具合や動画情報をアプリから参照したい",
    "変換・配信サーバーの運用はできる限り持ちたくない"
  ],
  main: {
    name: "Transcoder API+Media CDN構成",
    diagram: {
      cols: 5, rows: 3,
      groups: [
        { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [4, 2] }
      ],
      nodes: [
        { id: "creator", icon: "client/client", label: "投稿者\nアップロード", col: 0, row: 0 },
        { id: "viewer", icon: "client/users", label: "視聴者", col: 0, row: 2 },
        { id: "gcssrc", icon: "storage/cloud-storage", label: "Cloud Storage\n元動画", col: 1, row: 0 },
        { id: "evarc", icon: "integration/eventarc", label: "Eventarc\nイベント検知", col: 2, row: 0 },
        { id: "api", icon: "compute/cloud-run", label: "Cloud Run\n管理API", col: 3, row: 0 },
        { id: "fstr", icon: "database/firestore", label: "Firestore\nメタデータ", col: 4, row: 0 },
        { id: "tc", icon: "compute/transcoder-api", label: "Transcoder API\n形式変換", col: 2, row: 1 },
        { id: "gcsout", icon: "storage/cloud-storage", label: "Cloud Storage\n配信用HLS", col: 1, row: 1 },
        { id: "mcdn", icon: "network/media-cdn", label: "Media CDN\n動画配信", col: 1, row: 2 }
      ],
      edges: [
        { from: "creator", to: "gcssrc", label: "アップロード" },
        { from: "gcssrc", to: "evarc", label: "作成イベント" },
        { from: "evarc", to: "api", label: "起動" },
        { from: "api", to: "fstr", label: "状態保存" },
        { from: "api", to: "tc", label: "ジョブ作成" },
        { from: "tc", to: "gcssrc", label: "元動画読込", dashed: true },
        { from: "tc", to: "gcsout", label: "HLS/DASH出力" },
        { from: "mcdn", to: "gcsout", label: "オリジン取得" },
        { from: "viewer", to: "mcdn", label: "HTTPS視聴" }
      ]
    },
    flow: [
      "投稿者はCloud Runの管理APIが発行した署名付きURL（期限付きのアップロード許可URL）を使い、元動画をCloud Storageへ直接アップロードします",
      "アップロード完了をEventarcが検知し、Cloud Runの管理APIを起動します",
      "管理APIがTranscoder APIの変換ジョブを作成します。Transcoder APIは元動画を読み込み、複数画質のHLS/DASH形式へ変換して配信用バケットへ出力します",
      "管理APIはFirestoreへ動画のメタデータと変換状態を保存し、アプリはこれを参照して「変換中」「公開済み」を表示します",
      "視聴者はMedia CDN経由で配信用バケットの動画セグメントを取得し、回線状況に応じた画質で再生します"
    ],
    services: [
      { icon: "storage/cloud-storage", name: "Cloud Storage", role: "元動画と変換後の配信用ファイルの置き場。動画基盤の土台となるオブジェクトストレージです" },
      { icon: "integration/eventarc", name: "Eventarc", role: "ファイル作成などのイベントを検知してCloud Runを起動する配線役です" },
      { icon: "compute/cloud-run", name: "Cloud Run", role: "管理API。アップロードURLの発行・変換ジョブの作成・メタデータ更新を担います" },
      { icon: "compute/transcoder-api", name: "Transcoder API", role: "動画変換のマネージドサービス。複数画質のHLS/DASHへの変換をジョブ単位で実行します" },
      { icon: "database/firestore", name: "Firestore", role: "動画タイトル・変換状態などメタデータの保存先。アプリからリアルタイムに参照できます" },
      { icon: "network/media-cdn", name: "Media CDN", role: "動画配信に特化したCDN。世界中のエッジからセグメントを配信し、視聴急増を吸収します" }
    ],
    points: [
      "動画本体をCloud Run経由で受け取らず、署名付きURLでCloud Storageへ直接アップロードさせます。数GBのファイルをAPIサーバーに通すとリクエストサイズや時間の制限に当たりやすく、コストも無駄になるためです",
      "変換をTranscoder APIへ任せることで、FFmpegサーバー群の維持・キュー管理・スケール設計が丸ごと不要になります。小さい運用チームという制約に効く選択です",
      "配信にCloud CDNではなくMedia CDNを使うのは、動画のような大容量セグメント配信に特化していて配信単価も抑えやすいからです。Webページの配信とはCDNを使い分けます",
      "会員限定動画にする場合は、Media CDNの署名付きリクエストで視聴権限のない直リンクを防ぎます。認可の判断は管理API側で行い、配信の入口で強制します"
    ],
    pros: [
      "変換も配信もマネージドで、視聴・投稿がどれだけ増えてもサーバー管理が発生しない",
      "従量課金のため、動画が少ない立ち上げ期のコストが小さい",
      "画質自動切替（アダプティブビットレート）が標準的な形式（HLS/DASH）で手に入る",
      "イベント駆動なので投稿の同時多発にも自然に並列処理できる"
    ],
    cons: [
      "Transcoder APIの変換メニューは用意された範囲に限られ、特殊な加工は自前実装（代替パターン2）が必要",
      "イベント駆動の非同期処理はデバッグや障害追跡に慣れが要る",
      "視聴が伸びるほどCDN配信費用が支配的になり、料金設計との整合が重要になる"
    ],
    cost: "<strong>月1万〜2万円程度〜</strong>。目安として、変換1,000分/月（HD、1分あたり約0.03USD＝約4.5円）で約4,500円、動画保存1TBで約3,500円、配信1TBで数千円、Cloud Run・Eventarc・Firestoreは小規模なら数百円です。東京リージョン・1USD=150円前後の概算で、視聴量（配信TB数）にほぼ比例して増えます。",
    references: [
      { title: "Transcoder APIドキュメント", url: "https://cloud.google.com/transcoder/docs?hl=ja" },
      { title: "Transcoder APIの概要", url: "https://cloud.google.com/transcoder/docs/concepts/overview?hl=ja", note: "ジョブ・ジョブテンプレートの考え方" },
      { title: "Media CDNの概要", url: "https://cloud.google.com/media-cdn/docs/overview?hl=ja" },
      { title: "署名付きURL", url: "https://cloud.google.com/storage/docs/access-control/signed-urls?hl=ja", note: "直接アップロードの鍵となる仕組み" },
      { title: "Eventarcの概要", url: "https://cloud.google.com/eventarc/docs/overview?hl=ja" }
    ]
  },
  alternatives: [
    {
      name: "Cloud Storage+Cloud CDNの簡易配信",
      when: "動画本数が少ない・短い動画中心で画質切替が不要・まず小さく始めたい場合",
      diagram: {
        cols: 3, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [2, 1] }
        ],
        nodes: [
          { id: "creator", icon: "client/client", label: "投稿者\nアップロード", col: 0, row: 0 },
          { id: "viewer", icon: "client/users", label: "視聴者", col: 0, row: 1 },
          { id: "cdn", icon: "network/cloud-cdn", label: "Cloud CDN\nキャッシュ", col: 1, row: 0 },
          { id: "lb", icon: "network/cloud-load-balancing", label: "Cloud LB\nHTTPS終端", col: 1, row: 1 },
          { id: "gcs", icon: "storage/cloud-storage", label: "Cloud Storage\n動画MP4", col: 2, row: 1 }
        ],
        edges: [
          { from: "creator", to: "gcs", label: "MP4アップロード" },
          { from: "viewer", to: "lb", label: "HTTPS" },
          { from: "lb", to: "gcs", label: "配信" },
          { from: "cdn", to: "lb", noArrow: true, dashed: true }
        ]
      },
      flow: [
        "投稿者は手元で書き出したMP4をそのままCloud Storageへアップロードします",
        "視聴者はロードバランサー+Cloud CDN経由でMP4を取得し、頭から順に読み込みながら再生します（プログレッシブダウンロード）",
        "本数や視聴者が増えてきたら、URL設計を保ったまま推奨構成へ移行します"
      ],
      services: [
        { icon: "storage/cloud-storage", name: "Cloud Storage", role: "MP4ファイルの置き場。バックエンドバケットとしてLBに紐付けます" },
        { icon: "network/cloud-load-balancing", name: "Cloud Load Balancing", role: "HTTPSの終端とCDNの紐付け。構成はケース1の静的配信と同じ型です" },
        { icon: "network/cloud-cdn", name: "Cloud CDN", role: "動画ファイルのエッジキャッシュ。同じ動画への集中アクセスを吸収します" }
      ],
      points: [
        "プログレッシブダウンロードは仕組みが単純な代わりに、画質の自動切替ができず、長い動画では途中へのシークも苦手です。短い動画を少人数が見る用途と割り切ります",
        "構成はケース1の静的サイト配信と同じ型で、動画は単なる大きなファイルとして扱います。学習コストが低いのが最大の利点です",
        "あとで推奨構成へ移行することを見越し、動画IDとURLの設計だけは最初に決めておくと移行が楽になります"
      ],
      pros: [
        "構成が最少で、今日から始められる",
        "変換費用がゼロ（投稿者の書き出しに任せる）"
      ],
      cons: [
        "画質自動切替ができず、モバイル回線の視聴体験が悪い",
        "1ファイルが大きいままなので、視聴されなかった部分の転送が無駄になりやすい",
        "アクセス制御が粗く、有料コンテンツの保護には向かない"
      ],
      cost: "<strong>月3,000円前後〜+配信量</strong>。ロードバランサーの固定費約2,700円に、保存と配信の従量課金が加わります。配信1TBあたり数千円〜1万円強が目安です（東京リージョン・1USD=150円前後）。",
      references: [
        { title: "バックエンドバケットの設定", url: "https://cloud.google.com/load-balancing/docs/backend-bucket?hl=ja" },
        { title: "Cloud CDNの概要", url: "https://cloud.google.com/cdn/docs/overview?hl=ja" }
      ]
    },
    {
      name: "Compute Engine+FFmpeg自前変換",
      when: "特殊な合成・独自コーデックなどTranscoder APIのメニューに無い加工が必要な場合",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [3, 1] },
          { type: "vpc", label: "VPC", from: [2, 0], to: [2, 0], depth: 1 }
        ],
        nodes: [
          { id: "creator", icon: "client/client", label: "投稿者\nアップロード", col: 0, row: 0 },
          { id: "gcssrc", icon: "storage/cloud-storage", label: "Cloud Storage\n元動画", col: 1, row: 0 },
          { id: "gce", icon: "compute/compute-engine", label: "Compute Engine\nFFmpeg変換", col: 2, row: 0 },
          { id: "gcsout", icon: "storage/cloud-storage", label: "Cloud Storage\n配信用", col: 3, row: 0 },
          { id: "viewer", icon: "client/users", label: "視聴者", col: 0, row: 1 },
          { id: "lb", icon: "network/cloud-load-balancing", label: "Cloud LB\nHTTPS終端", col: 1, row: 1 },
          { id: "cdn", icon: "network/cloud-cdn", label: "Cloud CDN\nキャッシュ", col: 2, row: 1 }
        ],
        edges: [
          { from: "creator", to: "gcssrc", label: "アップロード" },
          { from: "gcssrc", to: "gce", label: "元動画取得" },
          { from: "gce", to: "gcsout", label: "変換結果保存" },
          { from: "viewer", to: "lb", label: "HTTPS" },
          { from: "lb", to: "gcsout", label: "配信取得" },
          { from: "cdn", to: "lb", noArrow: true, dashed: true }
        ]
      },
      flow: [
        "元動画がアップロードされたら、FFmpegを載せたCompute Engineが変換ジョブとして処理します",
        "変換結果（HLSや加工済みMP4）を配信用バケットへ保存します",
        "視聴者への配信はロードバランサー+CDN経由で行います（Media CDNへの差し替えも可能です）"
      ],
      services: [
        { icon: "compute/compute-engine", name: "Compute Engine", role: "FFmpegによる変換処理を実行するVM。処理内容を完全に自由に組めます" },
        { icon: "storage/cloud-storage", name: "Cloud Storage", role: "元動画と変換結果の置き場。役割は推奨構成と同じです" },
        { icon: "network/cloud-load-balancing", name: "Cloud Load Balancing", role: "配信の入口。バックエンドバケットから配信します" },
        { icon: "network/cloud-cdn", name: "Cloud CDN", role: "変換済みファイルのエッジ配信を担います" }
      ],
      points: [
        "FFmpegは透かし合成・フィルタ・独自コーデックまで何でもできますが、ジョブのキュー管理・失敗時のリトライ・並列スケールを自作することになります。自由の代償は運用です",
        "変換VMは常時起動にせず、ジョブがあるときだけ起動する、または中断されてよい処理なので割安なSpot VMを使うとコストを大きく抑えられます",
        "まずTranscoder APIの機能で要件を満たせないかを確認し、明確に足りない場合だけこの構成を選ぶ、という順番が健全です"
      ],
      pros: [
        "変換処理の内容を完全に制御できる",
        "既存のFFmpegノウハウ・スクリプト資産を活かせる",
        "工夫次第（都度起動・Spot VM）で変換コストを抑えられる"
      ],
      cons: [
        "キュー・リトライ・スケールの仕組みを自作する必要がある",
        "VMのOS・FFmpegの更新運用が発生する",
        "投稿が集中したときの並列化設計が自分の責任になる"
      ],
      cost: "<strong>月1,000円前後〜（都度起動の場合）</strong>。e2-standard-2を1日2時間だけ動かす想定で月1,000円強、常時起動なら月1万円前後です。配信側の費用（LB約2,700円+従量）が別途かかります（東京リージョン・1USD=150円前後）。",
      references: [
        { title: "Compute Engineの概要", url: "https://cloud.google.com/compute/docs/overview?hl=ja" },
        { title: "Transcoder APIドキュメント", url: "https://cloud.google.com/transcoder/docs?hl=ja", note: "まず標準機能で足りるかの確認用" }
      ]
    }
  ],
  cost: "<p>推奨構成は<strong>月1万〜2万円程度〜</strong>（変換1,000分+保存1TB+配信1TBの想定）で、視聴量に比例して増えます。簡易配信案は<strong>月3,000円前後〜+配信量</strong>、自前変換案は変換部分だけなら<strong>月1,000円前後〜</strong>です（いずれも東京リージョン・1USD=150円前後の目安）。動画サービスの費用は最終的に<strong>配信量（何TB視聴されたか）が支配</strong>するため、料金プラン設計とセットで考える必要があります。</p>",
  summary: "<p>動画配信は<strong>「変換」と「配信」を分けて考える</strong>のが出発点です。変換はTranscoder API、配信はMedia CDNと、どちらもマネージドに任せるのがGCPの定石で、アプリ側はメタデータ管理（Firestore）と配線（Eventarc+Cloud Run）に集中できます。アップロードを署名付きURLで直接ストレージへ流す設計は、動画に限らず大容量ファイルを扱うすべてのサービスで使える型です。ライブ配信はケース5、このケースの背骨であるイベント駆動処理の基礎はケース17で扱います。</p>",
  quiz: [
    {
      q: "投稿者の動画を、なぜCloud Runの管理APIで受け取らず、署名付きURLでCloud Storageへ直接アップロードさせるのでしょうか。",
      a: "数GBになり得る動画をAPIサーバー経由にすると、リクエストサイズや処理時間の制限に当たりやすく、転送のためだけにインスタンスが長時間占有されて費用も膨らむからです。署名付きURLなら、管理APIは期限付きの許可証を発行するだけで、重いデータ転送はCloud Storageが直接受け持ちます。権限チェックはURL発行時に済んでいるため、安全性も保てます。"
    },
    {
      q: "人気講座の公開直後、視聴が普段の10倍になりました。この構成で最初に心配すべきはサーバーの負荷ではありません。何でしょうか。",
      a: "費用です。配信はMedia CDNとCloud Storageが自動で受け止めるため、性能面のボトルネックは基本的に生じません。一方でCDNの配信量課金は視聴量に正比例するので、想定外のヒットはそのまま想定外の請求になります。予算アラートの設定と、売上（受講料）が配信費用を上回る料金設計になっているかの確認が、この構成における実質的なキャパシティプランニングです。"
    },
    {
      q: "無料公開だった動画を有料会員限定に変えることになりました。あなたなら配信経路のどこで視聴を制限しますか。",
      a: "配信の入口であるMedia CDN側で署名付きリクエストを必須にし、URLを知っているだけでは再生できないようにします。会員かどうかの判断は管理APIが行い、有効期限付きの視聴トークンを発行する分担です。アプリ画面で再生ボタンを隠すだけでは、セグメントのURLを直接叩かれると防げません。認可の判断と配信での強制を分けて設計するのが要点です。"
    }
  ]
});
