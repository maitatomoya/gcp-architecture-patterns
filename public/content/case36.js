// ケース36：ファイル転送・共有基盤
registerCase({
  id: 36,
  category: "社内・閉域・ハイブリッド",
  title: "ファイル転送・共有基盤",
  scenario: "<p>製造業の会社で、取引先と設計データ（CADファイル）や検査結果などの大容量ファイルを日常的にやりとりしています。1ファイルが数GB〜数十GBになることも珍しくありません。これまではメール添付・USBメモリ・無料のファイル転送サービスが混在しており、セキュリティ監査で「誰が・いつ・何を渡したか追跡できない」「暗号化の管理主体が不明」と指摘を受けました。取引先は数十社あり、相手ごとにITリテラシーも使えるツールもバラバラです。専任のインフラエンジニアはおらず、情シス2人が兼任で面倒を見ます。</p>",
  requirements: [
    "数GB〜数十GBの大容量ファイルを取引先と安全に授受したい",
    "誰が・いつ・何を送受信したかの監査ログを確実に残したい",
    "受領後のウイルススキャンや振り分けなど社内処理を自動化したい",
    "暗号鍵を自社で管理し、必要になったらアクセスを即座に断ちたい",
    "無料転送サービスの利用をやめ、監査指摘に対応したい",
    "専任者なしで回るよう、サーバーの常時運用は避けたい"
  ],
  main: {
    name: "Cloud Storage+署名付きURL構成",
    diagram: {
      cols: 5, rows: 3,
      groups: [
        { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [3, 2] }
      ],
      nodes: [
        { id: "partner", icon: "client/users", label: "取引先\n担当者", col: 0, row: 0 },
        { id: "api", icon: "compute/cloud-run", label: "Cloud Run\n受付API", col: 1, row: 0 },
        { id: "pubsub", icon: "integration/pubsub", label: "Pub/Sub\n完了イベント", col: 2, row: 0 },
        { id: "worker", icon: "compute/cloud-run", label: "Cloud Run\n後処理", col: 3, row: 0 },
        { id: "office", icon: "client/office", label: "社内\n担当者", col: 4, row: 0 },
        { id: "gcs", icon: "storage/cloud-storage", label: "Cloud Storage\n授受バケット", col: 1, row: 1 },
        { id: "sts", icon: "storage/storage-transfer", label: "Storage Transfer\n定期取り込み", col: 1, row: 2 },
        { id: "kms", icon: "security/cloud-kms", label: "Cloud KMS\nCMEK鍵", col: 2, row: 2 },
        { id: "s3ext", icon: "client/external-saas", label: "取引先の\nS3バケット等", col: 0, row: 2 }
      ],
      edges: [
        { from: "partner", to: "api", label: "認証・URL発行" },
        { from: "partner", to: "gcs", label: "直接アップロード" },
        { from: "gcs", to: "pubsub", label: "完了通知" },
        { from: "pubsub", to: "worker", label: "push配信" },
        { from: "worker", to: "office", label: "受領を通知" },
        { from: "s3ext", to: "sts", label: "定期転送" },
        { from: "sts", to: "gcs", label: "取り込み" },
        { from: "kms", to: "gcs", noArrow: true, dashed: true }
      ]
    },
    flow: [
      "取引先の担当者がCloud Runの受付APIにアクセスすると、認証を通過した相手にだけ、有効期限つきの「署名付きURL」（そのURLを知っている人だけが期限内に指定の操作をできる特殊なURL）が発行されます",
      "ファイル本体は署名付きURLを使ってCloud Storageへ直接アップロードします。数十GBのファイルでもCloud Runを経由しないため、タイムアウトやサイズ制限を気にせず転送できます",
      "アップロード完了はCloud StorageのPub/Sub通知で検知され、後処理のCloud Runがpush配信（Pub/Subが自動でHTTPリクエストを送る方式）で起動します",
      "後処理サービスはファイルの検証と記録を行い、社内担当者へ受領を通知します。ダウンロード側も同じ仕組みで、社内から取引先へ渡すファイルには読み取り専用の署名付きURLを発行します",
      "取引先がS3等のクラウドストレージを持つ定常連携は、Storage Transfer Serviceのスケジュール転送で毎日自動取り込みします。バケット全体はCloud KMSで管理する自社鍵（CMEK）で暗号化します"
    ],
    services: [
      { icon: "storage/cloud-storage", name: "Cloud Storage", role: "ファイルの置き場。1ファイル最大5TiBまで扱え、署名付きURLで期限つきのアクセスを外部に許可できる" },
      { icon: "compute/cloud-run", name: "Cloud Run", role: "署名付きURLの発行と、受領後の検証・通知を担う小さなAPI。リクエストがない時間は課金されない" },
      { icon: "integration/pubsub", name: "Pub/Sub", role: "アップロード完了イベントの通知役。後処理が一時的に落ちていてもメッセージを保持し、再配信してくれる" },
      { icon: "storage/storage-transfer", name: "Storage Transfer Service", role: "S3等の他クラウドやオンプレからのファイル取り込みを、スケジュール実行と差分転送で自動化するマネージドサービス" },
      { icon: "security/cloud-kms", name: "Cloud KMS", role: "暗号鍵の管理サービス。バケットの暗号化に自社管理の鍵（CMEK）を使い、鍵の無効化でアクセスを一括遮断できる" }
    ],
    points: [
      "ファイル本体をCloud Run経由にせず、署名付きURLでCloud Storageと直接やりとりさせています。アプリサーバーを大容量データが通過しない設計にすると、サイズ制限・タイムアウト・転送コストの問題がまとめて消えます。取引先にGoogleアカウントを配る必要がないのも実務では大きな利点です",
      "Cloud Storageは何もしなくても保存時に暗号化されますが、あえてCMEK（顧客管理の暗号鍵）にしています。契約終了や漏えい疑いの際に鍵を無効化すれば全データへのアクセスを即座に断てること、監査に対して「鍵の管理主体は自社」と示せることが理由です",
      "授受バケットにはライフサイクル管理を設定し、受け渡しから30日で自動削除します。転送基盤に古いファイルが溜まり続けると、それ自体が漏えいリスクの在庫になるからです",
      "監査要件に応えるため、Cloud Storageのデータアクセス監査ログを有効化します。誰がいつどのファイルを取得したかがすべて記録に残り、「追跡できない」という指摘に正面から答えられます"
    ],
    pros: [
      "サーバーレス中心で固定費が小さく、使わない月はほぼ保管料だけになる",
      "署名付きURLは有効期限と操作（読み取り専用・書き込み専用）を細かく絞れる",
      "大容量ファイルでも転送が安定し、事前のキャパシティ設計が要らない",
      "すべての授受が監査ログに残り、セキュリティ監査に耐える"
    ],
    cons: [
      "署名付きURLの発行API（認証を含む）は自作が必要で、認証設計を誤ると穴になる",
      "URLが漏れると期限内は誰でもアクセスできてしまうため、有効期限は分単位に短くする運用が前提",
      "取引先のツールやブラウザ事情によっては、アップロード手順の案内資料づくりが必要"
    ],
    cost: "<strong>月5,000円〜15,000円程度</strong>（東京リージョン・1USD=150円前後の概算）。内訳の目安は、保管1TBで約3,500円、取引先への下り転送100GBで約2,000円、Cloud Run・Pub/Subが数百円、KMS鍵が数十円。授受量と保管量にほぼ比例し、アイドル時の固定費はごく小さいのが特徴です。",
    references: [
      { title: "署名付きURLの概要", url: "https://cloud.google.com/storage/docs/access-control/signed-urls?hl=ja", note: "この構成の中核となる仕組み" },
      { title: "Cloud StorageのPub/Sub通知", url: "https://cloud.google.com/storage/docs/pubsub-notifications?hl=ja", note: "アップロード完了を検知する仕組み" },
      { title: "Storage Transfer Serviceの概要", url: "https://cloud.google.com/storage-transfer/docs/overview?hl=ja" },
      { title: "顧客管理の暗号鍵（CMEK）", url: "https://cloud.google.com/kms/docs/cmek?hl=ja" },
      { title: "オブジェクトのライフサイクル管理", url: "https://cloud.google.com/storage/docs/lifecycle?hl=ja", note: "30日自動削除の設定方法" }
    ]
  },
  alternatives: [
    {
      name: "Storage Transfer Serviceだけの定期転送構成",
      when: "取引先もS3等のクラウドストレージを運用しており、都度のやりとりではなく日次などの定期バッチ転送で十分な場合",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [2, 1] }
        ],
        nodes: [
          { id: "s3", icon: "client/external-saas", label: "取引先の\nS3バケット", col: 0, row: 0 },
          { id: "sts", icon: "storage/storage-transfer", label: "Storage Transfer\nスケジュール実行", col: 1, row: 0 },
          { id: "gcs", icon: "storage/cloud-storage", label: "Cloud Storage\n受領バケット", col: 2, row: 0 },
          { id: "office", icon: "client/office", label: "社内\nシステム", col: 3, row: 0 },
          { id: "kms", icon: "security/cloud-kms", label: "Cloud KMS\nCMEK鍵", col: 2, row: 1 }
        ],
        edges: [
          { from: "s3", to: "sts", label: "差分転送" },
          { from: "sts", to: "gcs", label: "書き込み" },
          { from: "gcs", to: "office", label: "取得" },
          { from: "kms", to: "gcs", noArrow: true, dashed: true }
        ]
      },
      flow: [
        "Storage Transfer Serviceにスケジュール（例：毎日午前2時）と転送元・転送先を登録しておきます",
        "実行時刻になるとStorage Transfer Serviceが取引先のS3バケットへ接続し、前回からの差分だけを受領バケットへ転送します",
        "受領バケットはCMEKで暗号化され、社内システムが処理対象として取得します"
      ],
      services: [
        { icon: "storage/storage-transfer", name: "Storage Transfer Service", role: "クラウド間転送の本体。スケジュール・差分検出・リトライをすべて肩代わりする" },
        { icon: "storage/cloud-storage", name: "Cloud Storage", role: "受領ファイルの保存先。ライフサイクル管理で保持期間も自動制御する" },
        { icon: "security/cloud-kms", name: "Cloud KMS", role: "受領バケットの暗号鍵を自社管理にする" }
      ],
      points: [
        "アプリケーション開発がゼロで済むのが最大の魅力です。受付APIも署名付きURLの発行も作らず、マネージドサービスの設定だけで転送が回ります",
        "差分転送のため、2回目以降は変更のあったファイルしか流れず、転送量とコストを自然に節約できます",
        "設計の中心は転送そのものより「取引先側の認証情報をどう受け取るか」です。S3のアクセスキーを長期保管するのではなく、必要最小限の権限のIAMロールを用意してもらう調整が肝になります"
      ],
      pros: [
        "コードを書かずに運用でき、少人数の情シスでも維持しやすい",
        "差分転送・リトライ・整合性チェックをサービスが引き受けてくれる"
      ],
      cons: [
        "リアルタイム性はなく、次回スケジュールまでファイルは届かない",
        "取引先がクラウドストレージを持っていることが前提で、担当者が手動で渡したい相手には使えない"
      ],
      cost: "<strong>月数千円程度</strong>（東京リージョン・1USD=150円前後の概算）。クラウド間転送ではStorage Transfer Service自体の追加料金は基本かからず、Cloud Storageの保管料と、転送元クラウド側で発生する下り転送料（通常は取引先負担）が主なコストです。",
      references: [
        { title: "Storage Transfer Serviceの概要", url: "https://cloud.google.com/storage-transfer/docs/overview?hl=ja", note: "対応する転送元と料金の考え方" },
        { title: "顧客管理の暗号鍵（CMEK）", url: "https://cloud.google.com/kms/docs/cmek?hl=ja" }
      ]
    },
    {
      name: "Compute EngineのSFTPサーバー構成",
      when: "取引先の社内規程や既存ツールの都合で、SFTP（SSH経由のファイル転送プロトコル）しか使えない場合",
      diagram: {
        cols: 5, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [4, 1] },
          { type: "vpc", label: "VPC", from: [2, 0], to: [2, 0], depth: 1 }
        ],
        nodes: [
          { id: "partner", icon: "client/users", label: "取引先\nSFTPクライアント", col: 0, row: 0 },
          { id: "gce", icon: "compute/compute-engine", label: "Compute Engine\nSFTPサーバー", col: 2, row: 0 },
          { id: "gcs", icon: "storage/cloud-storage", label: "Cloud Storage\n授受バケット", col: 3, row: 1 },
          { id: "kms", icon: "security/cloud-kms", label: "Cloud KMS\nCMEK鍵", col: 4, row: 1 }
        ],
        edges: [
          { from: "partner", to: "gce", label: "SFTP" },
          { from: "gce", to: "gcs", label: "定期同期" },
          { from: "kms", to: "gcs", noArrow: true, dashed: true }
        ]
      },
      flow: [
        "取引先は使い慣れたSFTPクライアントで、Compute Engine上のSFTPサーバーへ鍵認証で接続しファイルを送ります",
        "サーバー上の受信ディレクトリは定期ジョブでCloud Storageへ同期し、以降の後処理は推奨構成と同じ流れに乗せます",
        "接続元はファイアウォールルールで取引先の固定IPに限定し、パスワード認証は無効化して公開鍵認証のみにします"
      ],
      services: [
        { icon: "compute/compute-engine", name: "Compute Engine", role: "SFTPサーバーが動く仮想マシン。OSからsshdの設定まで自分で管理する" },
        { icon: "storage/cloud-storage", name: "Cloud Storage", role: "受信ファイルの最終的な置き場。VM上に溜め込まず、正本はこちらに置く" },
        { icon: "security/cloud-kms", name: "Cloud KMS", role: "バケット暗号化の自社鍵。推奨構成と同じ統制を維持する" }
      ],
      points: [
        "この構成の本質は「取引先の互換性のための橋」です。ファイルの正本は必ずCloud Storageへ寄せ、VMはいつ作り直してもよい状態を保つと、サーバー障害がデータ喪失に直結しません",
        "OSとsshdのパッチ適用というセキュリティ責任を自社で持つことになります。推奨構成に無かった運用負担がここで復活する点は、選定時に正直に伝えるべきトレードオフです",
        "VMからCloud Storageへの同期は、外部IPを使わず限定公開のGoogleアクセス（VPC内からGoogleサービスへ内部経路で届く仕組み）を使うと、経路をインターネットに出さずに済みます"
      ],
      pros: [
        "取引先は既存のSFTP運用を一切変えずに済み、導入の合意形成が早い",
        "ほぼすべてのファイル転送ツールと互換性がある"
      ],
      cons: [
        "VMが常時起動のため、授受がない月も固定費がかかる",
        "OS・sshdの脆弱性対応を自社で背負う（推奨構成には無い負担）",
        "取引先が増えてもスケールしにくく、アカウント管理が煩雑になる"
      ],
      cost: "<strong>月5,000円〜8,000円程度</strong>（東京リージョン・1USD=150円前後の概算）。e2-small相当のVM常時起動で約3,000円、ディスクと外部IPで約1,000円、これにCloud Storageの保管料が加わります。授受量が少なくても固定費がかかる点が推奨構成との最大の違いです。",
      references: [
        { title: "Compute Engineドキュメント", url: "https://cloud.google.com/compute/docs?hl=ja" },
        { title: "限定公開のGoogleアクセス", url: "https://cloud.google.com/vpc/docs/private-google-access?hl=ja", note: "VMから内部経路でCloud Storageへ届ける仕組み" }
      ]
    }
  ],
  cost: "<p>推奨構成は<strong>月5,000円〜15,000円程度</strong>で、授受量に比例するためスモールスタートに向きます。定期転送だけで足りるなら代替1は<strong>月数千円</strong>まで下がり、開発もほぼ不要です。SFTP互換のための代替2は<strong>月5,000円〜8,000円程度</strong>の固定費に加え、OS運用の人的コストが乗ります。いずれも東京リージョン・1USD=150円前後の目安であり、実際の構築時は公式の料金計算ツールで確認してください。</p>",
  summary: "<p>ファイル授受基盤の設計の核心は、<strong>ファイル本体をアプリサーバーに通さないこと</strong>です。署名付きURLでCloud Storageと直接やりとりさせれば、大容量・監査・コストの問題が同時に解決します。その上で、鍵を自社管理するCMEK・30日で消すライフサイクル・データアクセス監査ログという3点セットが「監査に耐える基盤」を作ります。一方で、正解は取引先の事情で変わります。相手がクラウドストレージ運用ならStorage Transfer Serviceの定期転送だけで済み、SFTPしか使えない相手にはVMの橋を架けることになります。自社の理想ではなく<strong>相手の制約から逆算する</strong>のが、対外接続の設計の分かれ目です。イベント駆動の後処理はケース17、閉域での社内公開はケース32も参考になります。</p>",
  quiz: [
    {
      q: "推奨構成では、ファイル本体をCloud Runの受付APIに通さず、署名付きURLでCloud Storageへ直接アップロードさせています。なぜこの設計にするのでしょうか。",
      a: "数十GBのファイルがアプリサーバーを通過すると、リクエストサイズの制限やタイムアウト、転送のためのインスタンス稼働コストがすべて問題になるからです。署名付きURLなら重いデータ転送はCloud Storageが直接受け止め、Cloud Runは「誰に・どの操作を・いつまで許可するか」という判断だけに専念できます。認証と転送の役割分担を分ける、この種の基盤の定石です。"
    },
    {
      q: "Cloud Storageは既定でも保存時に暗号化されます。それでもこのケースでCMEK（顧客管理の暗号鍵）をあえて使うのはなぜでしょうか。",
      a: "暗号化の有無ではなく、鍵の主導権が理由です。既定の暗号化では鍵の管理はGoogle任せですが、CMEKなら契約終了や漏えい疑いの際に自社の判断で鍵を無効化し、全データへのアクセスを即座に断てます。また監査に対して「暗号鍵の管理主体は自社である」と説明できることが、監査指摘への回答として重要になります。"
    },
    {
      q: "新しい取引先から「当社の規程でSFTP以外は使えません」と言われました。あなたならどう対応しますか。",
      a: "代替2のようにCompute EngineでSFTPサーバーを用意して橋を架けるのが現実解ですが、無条件に受けるのではなく範囲を絞るのが設計判断です。SFTP経由はその取引先専用とし、接続元IP制限と公開鍵認証を必須にした上で、ファイルの正本と後処理は推奨構成のCloud Storage側に一本化します。こうすれば互換性のための例外を許しつつ、監査ログや暗号化の統制は全取引先で同じに保てます。相手の制約に合わせる部分と、譲らない統制部分を切り分けることが重要です。"
    }
  ]
});
