// ケース14：サーバーレスREST API
registerCase({
  id: 14,
  category: "サーバーレス・イベント駆動",
  title: "サーバーレスREST API",
  scenario: "<p>自社サービスのWeb版とモバイルアプリの両方から呼び出す会員向けREST APIを構築したい。将来は一部のAPIを外部パートナーにも開放する計画がある。トラフィックは日中に偏り、深夜はほぼゼロ。専任のインフラ担当はおらず、アプリエンジニアだけで運用できる完全従量課金の構成にしたい、という状況です。</p>",
  requirements: [
    "Web・モバイルの両クライアントから同じAPIを使いたい",
    "認証（ログインユーザーの識別）を全エンドポイントに強制したい",
    "APIキー発行や流量制限など、将来の外部開放に備えたい",
    "使った分だけの課金にして、深夜帯のコストをゼロに近づけたい",
    "インフラ専任者なしで運用できること"
  ],
  main: {
    name: "API Gateway+Cloud Run+Firestore構成",
    diagram: {
      cols: 5, rows: 2,
      groups: [
        { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [4, 1] }
      ],
      nodes: [
        { id: "idp", icon: "security/identity-platform", label: "Identity Platform\n認証基盤", col: 1, row: 0 },
        { id: "log", icon: "ops/cloud-logging", label: "Cloud Logging\nログ集約", col: 3, row: 0 },
        { id: "client", icon: "client/client", label: "Web/モバイル\nクライアント", col: 0, row: 1 },
        { id: "gw", icon: "integration/api-gateway", label: "API Gateway\n認証/流量制御", col: 2, row: 1 },
        { id: "run", icon: "compute/cloud-run", label: "Cloud Run\nAPI実装", col: 3, row: 1 },
        { id: "fstr", icon: "database/firestore", label: "Firestore\nデータ保存", col: 4, row: 1 }
      ],
      edges: [
        { from: "client", to: "idp", label: "ログイン" },
        { from: "idp", to: "gw", dashed: true, label: "JWT検証" },
        { from: "client", to: "gw", label: "API呼び出し" },
        { from: "gw", to: "run", label: "認証済みのみ" },
        { from: "run", to: "fstr", label: "読み書き" },
        { from: "run", to: "log", dashed: true, label: "ログ送信" }
      ]
    },
    flow: [
      "クライアントはIdentity Platformでログインし、IDトークン（JWT：本人性を証明する署名付きトークン）を受け取る",
      "API呼び出しにはJWTを添えて送る。API GatewayがOpenAPI定義に基づいてJWTの署名・有効期限を検証し、不正なリクエストはCloud Runに届く前に拒否する",
      "検証を通過したリクエストだけがCloud Runに転送され、ビジネスロジックを実行してFirestoreを読み書きする",
      "アクセスログ・アプリログはCloud Loggingに自動集約され、調査やアラートの起点になる"
    ],
    services: [
      { icon: "integration/api-gateway", name: "API Gateway", role: "APIの玄関。JWT検証・APIキー・流量制限（クォータ）を宣言的な設定で肩代わりする" },
      { icon: "compute/cloud-run", name: "Cloud Run", role: "APIのビジネスロジックを実装するコンテナ実行基盤。リクエスト数に応じてゼロから自動スケールする" },
      { icon: "database/firestore", name: "Firestore", role: "会員データ等の保存先。サーバーレスNoSQLで運用作業ゼロ・完全従量課金" },
      { icon: "security/identity-platform", name: "Identity Platform", role: "ログインとJWT発行を担う認証基盤。メール+パスワード・SNSログイン等に対応" },
      { icon: "ops/cloud-logging", name: "Cloud Logging", role: "ゲートウェイとアプリのログ集約。障害調査と監査の土台" }
    ],
    points: [
      "認証・APIキー・流量制限という「どのAPIにも共通で必要な処理」をゲートウェイに寄せるのがこの構成の考え方です。Cloud Run側のコードはJWTが検証済みである前提で書け、ビジネスロジックに集中できます",
      "JWT検証はOpenAPI定義（API仕様を記述する標準形式）にセキュリティ設定として宣言するだけで、検証コードを書きません。仕様書とゲートウェイ設定が同じファイルで管理される利点もあります",
      "全部品が従量課金のため、深夜のコストはほぼゼロになります。逆に一定以上のトラフィックが常時あるなら、常時起動構成との比較が必要になります",
      "図にVPCやNATが登場しないのは、全部品がVPC外のマネージドサービスだからです。データベースにCloud SQLを選ぶとVPCとの接続を考え始める必要があり、この身軽さはFirestore採用の隠れた利点です"
    ],
    pros: [
      "深夜・休日のコストがほぼゼロになる完全従量課金",
      "認証・流量制限をコードでなく設定で実現でき、実装漏れが起きにくい",
      "APIキー発行とクォータ設定が最初から備わっており、外部開放にそのまま対応できる",
      "サーバー・データベースともに運用作業がほぼゼロ"
    ],
    cons: [
      "コールドスタート（ゼロ台からの起動遅延）が最初のリクエストに乗ることがある",
      "API Gatewayの設定はOpenAPI定義ファイルの管理が前提で、慣れるまで手間に感じる",
      "Firestoreは結合・集計が苦手で、複雑な検索要件には向かない",
      "ゲートウェイを挟むぶん、わずかながら応答時間が増える"
    ],
    cost: "<strong>月0円〜3,000円程度</strong>。API Gatewayは月200万コールまで無料（以降100万コールあたり約450円）、Cloud Run・Firestore・Cloud Loggingにも大きな無料枠があり、小規模なら無料枠内に収まることも多いです。Identity Platformも数万アクティブユーザーまで無料。東京リージョン・1USD=150円前後での概算です。",
    references: [
      { title: "API Gatewayについて", url: "https://cloud.google.com/api-gateway/docs/about-api-gateway?hl=ja" },
      { title: "Firebase認証でユーザーを認証する", url: "https://cloud.google.com/api-gateway/docs/authenticating-users-firebase?hl=ja", note: "JWT検証をOpenAPI定義に書く具体例" },
      { title: "クォータ（流量制限）の概要", url: "https://cloud.google.com/api-gateway/docs/quotas-overview?hl=ja" },
      { title: "Cloud Runとは", url: "https://cloud.google.com/run/docs/overview/what-is-cloud-run?hl=ja" },
      { title: "Cloud Loggingの概要", url: "https://cloud.google.com/logging/docs/overview?hl=ja" }
    ]
  },
  alternatives: [
    {
      name: "Cloud Run直公開構成",
      when: "エンドポイントが少なく、APIキー管理や流量制限がまだ不要な立ち上げ期の場合",
      diagram: {
        cols: 3, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [2, 1] }
        ],
        nodes: [
          { id: "client", icon: "client/client", label: "Web/モバイル\nクライアント", col: 0, row: 0 },
          { id: "run", icon: "compute/cloud-run", label: "Cloud Run\nAPI実装", col: 1, row: 0 },
          { id: "fstr", icon: "database/firestore", label: "Firestore\nデータ保存", col: 2, row: 0 },
          { id: "idp", icon: "security/identity-platform", label: "Identity Platform\n認証基盤", col: 2, row: 1 }
        ],
        edges: [
          { from: "client", to: "run", label: "API呼び出し" },
          { from: "run", to: "fstr", label: "読み書き" },
          { from: "client", to: "idp", label: "ログイン" },
          { from: "idp", to: "run", dashed: true }
        ]
      },
      flow: [
        "クライアントはIdentity Platformでログインし、JWTを添えてCloud Runの公開URLを直接呼び出す",
        "Cloud Runのアプリがミドルウェア（全リクエスト共通の前処理）でJWTを検証し、通過したものだけ処理する",
        "データはFirestoreに読み書きする。構成部品はこれだけで完結する"
      ],
      services: [
        { icon: "compute/cloud-run", name: "Cloud Run", role: "APIの実装と公開を1つで担う。JWT検証もアプリ内のミドルウェアで行う" },
        { icon: "database/firestore", name: "Firestore", role: "データ保存。メイン構成と同じ役割" },
        { icon: "security/identity-platform", name: "Identity Platform", role: "ログインとJWT発行。検証する場所がゲートウェイからアプリに移るだけで、発行側は同じ" }
      ],
      points: [
        "部品が少ないほど理解も運用も楽です。認証の検証をアプリのミドルウェアに1箇所で実装できるなら、立ち上げ期はゲートウェイなしで十分成立します",
        "後からAPI Gatewayを前段に足す移行は比較的容易です。その際はCloud Runのingress設定を絞り、ゲートウェイを迂回する直接アクセスを塞ぐのを忘れないようにします",
        "流量制限が無いため、悪意ある大量リクエストがそのままCloud Runの課金増につながる点は把握しておきます。Cloud Runの最大インスタンス数設定が事実上の安全弁になります"
      ],
      pros: [
        "構成が最小で、学習・構築・運用のコストが最も低い",
        "ゲートウェイの通過が無いぶん応答が速く、課金要素も1つ減る",
        "後からゲートウェイ追加へ発展させられる"
      ],
      cons: [
        "流量制限・APIキー管理が無く、外部開放には不向き",
        "JWT検証の実装漏れがそのまま脆弱性になる（全ルートへの強制を自分で保証する必要がある）",
        "エンドポイントが増えるほど共通処理の管理が煩雑になる"
      ],
      cost: "<strong>月0円〜2,000円程度</strong>。API Gatewayのコール課金が無くなるぶんメイン構成よりわずかに安く、小規模ならCloud RunとFirestoreの無料枠内に収まります。",
      references: [
        { title: "Firestoreのドキュメント", url: "https://firebase.google.com/docs/firestore?hl=ja" },
        { title: "Identity Platformのドキュメント", url: "https://cloud.google.com/identity-platform/docs?hl=ja" },
        { title: "Cloud Runのingress設定", url: "https://cloud.google.com/run/docs/securing/ingress?hl=ja", note: "後からゲートウェイを足すときに必要になる" }
      ]
    },
    {
      name: "Apigee+Cloud Run構成",
      when: "APIそのものを商品として外部提供する場合（開発者ポータル・収益化・高度な分析が必要な場合）",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [3, 1] }
        ],
        nodes: [
          { id: "client", icon: "client/client", label: "外部の\n利用アプリ", col: 0, row: 0 },
          { id: "apigee", icon: "integration/apigee", label: "Apigee\nAPI管理基盤", col: 1, row: 0 },
          { id: "run", icon: "compute/cloud-run", label: "Cloud Run\nAPI実装", col: 2, row: 0 },
          { id: "fstr", icon: "database/firestore", label: "Firestore\nデータ保存", col: 3, row: 0 },
          { id: "dev", icon: "client/developer", label: "外部開発者", col: 0, row: 1 }
        ],
        edges: [
          { from: "client", to: "apigee", label: "API呼び出し" },
          { from: "apigee", to: "run", label: "ポリシー適用後" },
          { from: "run", to: "fstr", label: "読み書き" },
          { from: "dev", to: "apigee", dashed: true, label: "開発者ポータル" }
        ]
      },
      flow: [
        "外部開発者は開発者ポータルでAPIの仕様確認・利用申請・APIキー取得をセルフサービスで行う",
        "利用アプリからの呼び出しはApigeeが受け、認証・流量制限・変換・課金プランなどのポリシーを適用してからCloud Runへ転送する",
        "利用状況の分析・収益化レポートはApigeeの管理画面で確認できる"
      ],
      services: [
        { icon: "integration/apigee", name: "Apigee", role: "エンタープライズ向けAPI管理基盤。開発者ポータル・収益化・詳細分析・高度なポリシー制御を提供する" },
        { icon: "compute/cloud-run", name: "Cloud Run", role: "APIの実装。管理の複雑さはApigeeが引き受けるため実装は変わらない" },
        { icon: "database/firestore", name: "Firestore", role: "データ保存。メイン構成と同じ役割" }
      ],
      points: [
        "API GatewayとApigeeの違いは「APIを守る道具」か「APIを事業にする道具」かです。ポータルでの申請受付・利用プラン別の課金・詳細な利用分析が必要になった時点がApigeeの出番です",
        "費用が桁で変わるため、要件が「認証と流量制限だけ」ならAPI Gatewayに留まるのが正解です。導入判断は機能ではなく事業要件から行います",
        "既存APIの前段に置く形で導入できるため、API Gatewayから始めて成長後にApigeeへ移行する段階的な進み方が現実的です"
      ],
      pros: [
        "開発者ポータル・収益化・分析までAPI事業に必要な機能が揃う",
        "リクエスト変換・キャッシュ・脅威対策など高度なポリシーを設定で適用できる",
        "大企業のAPI公開基盤としての実績が豊富"
      ],
      cons: [
        "費用が高く、小規模利用ではAPI Gatewayの数十倍以上になりうる",
        "機能が多いぶん学習・設計・運用の負担が大きい",
        "小さなチームの社内APIには明確に過剰"
      ],
      cost: "<strong>月数万円〜数十万円規模</strong>。従量課金モデルでも環境の稼働時間とAPI呼び出し量に応じた課金が発生し、API Gateway（月数百円規模）とは桁が異なります。API自体が収益を生む事業向けの投資と考えるべき価格帯です。",
      references: [
        { title: "Apigeeのドキュメント", url: "https://cloud.google.com/apigee/docs?hl=ja" }
      ]
    }
  ],
  cost: "<p>推奨構成は<strong>月0円〜3,000円程度</strong>で、小規模なら無料枠にほぼ収まります。Cloud Run直公開ならさらに一段安く、Apigee案は<strong>月数万円〜数十万円規模</strong>と桁が変わります（東京リージョン・1USD=150円前後の目安）。ゲートウェイ層は<strong>「無し→API Gateway→Apigee」の3段階があり、事業要件が上がるたびに1段ずつ上げる</strong>のがコスト効率のよい進み方です。</p>",
  summary: "<p>REST APIの設計では、ビジネスロジック（Cloud Run）と共通処理（認証・流量制限）を分けて考えるのが出発点です。<strong>共通処理をゲートウェイの設定に寄せると、実装漏れによる事故が構造的に減ります</strong>。一方で部品を増やすこと自体にもコストがあるため、立ち上げ期はCloud Run直公開で始めて、外部開放のタイミングでAPI Gatewayを足す判断も十分合理的です。Cloud Run中心の基本形はケース7、外部からのWebhook受信はケース18で扱います。</p>",
  quiz: [
    {
      q: "Cloud Runのアプリ内でJWT検証を実装すれば、API Gatewayが無くても認証は成立します。それでもゲートウェイで検証する構成が推奨されるのはなぜでしょうか。",
      a: "検証がアプリのコードに依存すると、エンドポイントの追加時に検証を通し忘れる・特定ルートだけ例外にしたつもりが本番に残る、といった実装漏れの余地が生まれるからです。ゲートウェイならOpenAPI定義で全ルートに宣言的に強制され、不正なリクエストはアプリに届く前に落ちます。さらに大量リクエストがCloud Runの課金に到達する前に弾かれるという金銭面の防御も兼ねています。"
    },
    {
      q: "外部パートナー1社に「このAPIを1日1万回まで使わせたい」という要件が来ました。この構成ではどう実現しますか。",
      a: "API Gatewayでパートナー用のAPIキーを発行し、OpenAPI定義にクォータ（流量制限）を設定します。キーごとに呼び出し回数が計測され、上限を超えたリクエストはゲートウェイが自動的に429エラーで拒否するため、アプリ側の実装は不要です。認証・キー・クォータという外部開放の3点セットを設定だけで済ませられることが、ゲートウェイを最初から挟んでおく利点です。"
    },
    {
      q: "このAPIが成長し、「複数条件での横断検索」や「月次の集計レポート」の要件が増えてきました。Firestoreのままで進めるべきか、あなたならどう判断しますか。",
      a: "Firestoreは単純なキー・条件での読み書きは得意ですが、結合や集計を伴う検索は苦手です。まず検索・集計の頻度と複雑さを見極め、限定的ならFirestoreのデータをBigQueryへ連携して分析系だけ逃がす構成が第一候補です。アプリの中核的な検索要件そのものが複雑化しているなら、Cloud SQLへの移行を検討します。データベースは「今のアクセスパターン」だけでなく「増えつつある要件の方向」で選び直す、という判断の典型例です。"
    }
  ]
});
