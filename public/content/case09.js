// ケース9：SaaSマルチテナント
registerCase({
  id: 9,
  category: "Webアプリ・EC",
  title: "SaaSマルチテナント",
  scenario: "<p>数百社が利用するBtoBの勤怠管理SaaSを構築します。マルチテナント（1つのシステムを複数の顧客企業＝テナントで共用する方式）で、各社数十〜数百人の従業員が毎日使います。他社のデータが1件でも見えたら契約解除につながるため、テナント分離は契約上の必須要件です。また、顧客企業からは自社の人事システムと連携するためのAPI公開も求められています。エンジニアは8人です。</p>",
  requirements: [
    "数百テナントを1つのシステムで支え、テナント追加は設定だけで完了させたい",
    "テナント間のデータ分離を確実に保証したい（他社データの混入は契約違反）",
    "顧客企業ごとのSSO（自社の認証基盤でログインする仕組み）要求に応えたい",
    "外部連携用のAPIを公開し、テナントごとに利用量制限をかけたい",
    "特定テナントの大量アクセスが他テナントの性能を落とさないようにしたい",
    "月末の勤怠締めなど全テナント一斉の負荷ピークに耐えたい"
  ],
  main: {
    name: "Cloud Run+Spanner+Identity Platformマルチテナント構成",
    diagram: {
      cols: 4, rows: 2,
      groups: [
        { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [3, 1] }
      ],
      nodes: [
        { id: "users", icon: "client/office", label: "テナント企業の\n利用者", col: 0, row: 1 },
        { id: "armor", icon: "network/cloud-armor", label: "Cloud Armor\nWAF", col: 1, row: 0 },
        { id: "apigee", icon: "integration/apigee", label: "Apigee\nAPI管理", col: 1, row: 1 },
        { id: "idp", icon: "security/identity-platform", label: "Identity Platform\nテナント別認証", col: 2, row: 0 },
        { id: "run", icon: "compute/cloud-run", label: "Cloud Run\nSaaS本体", col: 2, row: 1 },
        { id: "spanner", icon: "database/spanner", label: "Spanner\n全テナントデータ", col: 3, row: 1 }
      ],
      edges: [
        { from: "users", to: "apigee", label: "APIリクエスト" },
        { from: "users", to: "idp", label: "ログインしトークン取得" },
        { from: "armor", to: "apigee", noArrow: true, dashed: true },
        { from: "apigee", to: "run", label: "検証済みリクエスト" },
        { from: "run", to: "spanner", label: "読み書き" },
        { from: "idp", to: "run", noArrow: true, dashed: true }
      ]
    },
    flow: [
      "利用者はまずIdentity Platformで自社テナントにログインします。Identity Platformのマルチテナント機能により、テナントごとに独立したユーザー管理と認証設定を持てます",
      "ログイン成功でテナントIDを含むトークン（JWT：署名つきの本人証明データ）が発行され、以後のAPIリクエストに添えられます",
      "リクエストはCloud Armorを通ってApigeeに届き、Apigeeがトークンの検証・テナントごとのレート制限・API利用量の記録を行います",
      "Cloud RunのアプリはトークンのテナントIDを使い、すべてのデータアクセスを自テナントの範囲に絞ります",
      "データはSpannerに全テナント分を格納します。主キーの先頭にテナントIDを置く設計で、分離とスケールを両立します"
    ],
    services: [
      { icon: "security/identity-platform", name: "Identity Platform", role: "認証基盤。テナント単位の分離機能を持ち、テナントごとにSAML/OIDC（顧客企業のSSO方式）を個別設定できる" },
      { icon: "integration/apigee", name: "Apigee", role: "API管理基盤。認可・テナント別クォータ（利用量上限）・APIキー発行・利用分析・開発者ポータルまでを担う" },
      { icon: "network/cloud-armor", name: "Cloud Armor", role: "WAF。攻撃パターンの遮断とレート制限を入口で行う" },
      { icon: "compute/cloud-run", name: "Cloud Run", role: "SaaS本体。全テナント共通のアプリを1系統で動かし、負荷に応じて自動スケールする" },
      { icon: "database/spanner", name: "Spanner", role: "全テナントのデータを1つで支えるリレーショナルDB。テナント数が増えても処理ユニット追加で無停止スケールする" }
    ],
    points: [
      "テナント分離には「テナントごとにDBを分ける」「スキーマを分ける」「同じテーブルで行を分ける」の3段階があります。数百テナントでは行分離以外は運用が破綻しやすく（スキーマ変更を数百回適用するなど）、行分離+アプリでの強制を選びました。分離をコードの規約だけに頼らず、全クエリにテナント条件を強制する共通層を設けます",
      "認証を自作せずIdentity Platformに寄せた最大の理由はSSO要求です。BtoBでは「自社のMicrosoft/Googleアカウントでログインさせたい」という要求が必ず来ます。テナントごとにSAML/OIDC設定を持てる基盤を最初から選ぶと、営業案件ごとの個別対応が設定作業になります",
      "Apigeeは「ただの入口」ではなくAPI管理の製品です。テナント別クォータでノイジーネイバー（1社の暴走が全体を巻き込む問題）をAPI層で抑え、利用量の計測は従量課金プランの請求根拠にもなります。この機能群が不要ならAPI Gateway（代替パターン）で十分です",
      "DBにSpannerを選んだのは、全テナント合算の負荷が読めない（営業次第で数倍になる）ためです。月末締めの一斉ピークにも処理ユニットの追加で無停止対応できます"
    ],
    pros: [
      "テナントが増えても運用は1系統のまま。テナント追加はデータと設定の追加だけで済む",
      "顧客ごとのSSO・API利用量制限という「BtoBで必ず来る要求」に設計段階から応えられる",
      "Spannerの無停止スケールで、成長やピークのたびのDB移行作業から解放される",
      "API利用量の計測・制限が請求やプラン設計（API従量課金）にそのまま使える"
    ],
    cons: [
      "Apigeeが高価（月10万円規模〜）。SaaSの売上が小さいうちは重い固定費になる",
      "行分離はアプリのバグが即情報漏洩につながるため、共通層の設計・テスト・レビュー体制が必須",
      "SpannerとApigeeはどちらも学習コストが高く、8人チームでも立ち上げに時間がかかる",
      "「このテナントだけ専用環境に」という要求には別途設計が必要になる"
    ],
    cost: "<strong>月15万円〜30万円規模</strong>が目安です。最大の費目はApigee（従量課金でも月10万円規模から）で、Spannerは100処理ユニット（月1.5万円前後）から必要に応じて増やします。Cloud Runは月数千円〜数万円、Identity Platformは月間アクティブユーザー数に応じた従量課金（無料枠あり）です。売上と連動して伸びる構造なので、SaaSの料金設計とセットで考えます。東京リージョン・1USD=150円前後の概算です。",
    references: [
      { title: "Identity Platformのマルチテナンシー", url: "https://cloud.google.com/identity-platform/docs/multi-tenancy?hl=ja", note: "テナント別認証の公式解説" },
      { title: "Apigeeとは", url: "https://cloud.google.com/apigee/docs/api-platform/get-started/what-apigee?hl=ja" },
      { title: "Spannerのスキーマとデータモデル", url: "https://cloud.google.com/spanner/docs/schema-and-data-model?hl=ja", note: "テナントIDを含む主キー設計の参考" },
      { title: "Cloud Armorの概要", url: "https://cloud.google.com/armor/docs/cloud-armor-overview?hl=ja" }
    ]
  },
  alternatives: [
    {
      name: "Cloud Run+Cloud SQL（テナント別スキーマ）構成",
      when: "テナント数が数十社規模までで、ApigeeほどのAPI管理機能もSpannerほどのスケールもまだ必要ない場合",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [3, 1] }
        ],
        nodes: [
          { id: "users", icon: "client/office", label: "テナント企業の\n利用者", col: 0, row: 1 },
          { id: "armor", icon: "network/cloud-armor", label: "Cloud Armor\nWAF", col: 1, row: 0 },
          { id: "lb", icon: "network/cloud-load-balancing", label: "Cloud LB\nHTTPS終端", col: 1, row: 1 },
          { id: "idp", icon: "security/identity-platform", label: "Identity Platform\nテナント別認証", col: 2, row: 0 },
          { id: "run", icon: "compute/cloud-run", label: "Cloud Run\nSaaS本体", col: 2, row: 1 },
          { id: "sql", icon: "database/cloud-sql", label: "Cloud SQL\nテナント別スキーマ", col: 3, row: 1 }
        ],
        edges: [
          { from: "users", to: "lb", label: "HTTPS" },
          { from: "users", to: "idp", label: "ログイン" },
          { from: "armor", to: "lb", noArrow: true, dashed: true },
          { from: "lb", to: "run", label: "リクエスト" },
          { from: "run", to: "sql", label: "スキーマを切替" },
          { from: "idp", to: "run", noArrow: true, dashed: true }
        ]
      },
      flow: [
        "認証は推奨構成と同じIdentity Platformで行い、入口はApigeeの代わりにロードバランサ+Cloud Armorだけにします",
        "Cloud SQLの中にテナントごとのスキーマ（データベース内の独立した区画）を作り、アプリはログインしたテナントのスキーマだけに接続します",
        "テナント別のレート制限のような細かい制御は、必要になった範囲だけアプリ内で実装します"
      ],
      services: [
        { icon: "database/cloud-sql", name: "Cloud SQL", role: "テナントごとにスキーマを分けたリレーショナルDB。行分離より分離が明確で、クエリのテナント条件漏れが他社データに届かない" },
        { icon: "security/identity-platform", name: "Identity Platform", role: "テナント別認証。推奨構成と共通で、後からの移行でも作り直しにならない" },
        { icon: "compute/cloud-run", name: "Cloud Run", role: "SaaS本体。推奨構成と共通" },
        { icon: "network/cloud-load-balancing", name: "Cloud Load Balancing", role: "入口。Cloud Armorの紐づけ先" },
        { icon: "network/cloud-armor", name: "Cloud Armor", role: "WAF。入口の防御は規模によらず必須" }
      ],
      points: [
        "スキーマ分離は「クエリの書き間違いが他社データに届かない」という構造的な安心を買える方式です。行分離よりバグへの耐性が高く、テナント数十社まではよく使われます",
        "弱点はテナント数の増加です。スキーマのマイグレーション（変更適用）をテナント数だけ繰り返すため、数百社規模ではリリース作業が長時間化します。この限界が見えたら推奨構成への移行を検討します",
        "認証だけは最初からIdentity Platformにしておくのが移行を軽くするコツです。認証の作り直しはユーザー全員に影響するため、後から差し替える痛みが最も大きい部分です"
      ],
      pros: [
        "月数万円で始められ、Cloud SQLの運用知識がそのまま使える",
        "スキーマ分離でテナント間の事故が構造的に起きにくい",
        "推奨構成への進化パス（認証・アプリはそのまま、DBと入口だけ差し替え）が明確"
      ],
      cons: [
        "テナント数が増えるとスキーマ管理・マイグレーションが破綻しやすい",
        "テナント別のAPIクォータや利用量計測は自前実装になる",
        "全テナント合算の負荷がCloud SQL1台の限界を超えたらスケールの壁に当たる"
      ],
      cost: "<strong>月3万円〜8万円程度</strong>。Cloud SQL（HA構成推奨で月3万円〜6万円）+Cloud Run+Cloud Armorという内訳で、Apigeeが無いぶん推奨構成より1桁近く安く始められます。",
      references: [
        { title: "Cloud SQLの概要", url: "https://cloud.google.com/sql/docs/introduction?hl=ja" },
        { title: "Identity Platformドキュメント", url: "https://cloud.google.com/identity-platform/docs?hl=ja" }
      ]
    },
    {
      name: "API Gateway構成（Apigee代替）",
      when: "APIの認証とルーティングだけできればよく、開発者ポータル・利用量分析・API収益化までは不要な場合",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [3, 1] }
        ],
        nodes: [
          { id: "users", icon: "client/office", label: "テナント企業の\n利用者", col: 0, row: 1 },
          { id: "apigw", icon: "integration/api-gateway", label: "API Gateway\n認証・中継", col: 1, row: 1 },
          { id: "idp", icon: "security/identity-platform", label: "Identity Platform\nテナント別認証", col: 2, row: 0 },
          { id: "run", icon: "compute/cloud-run", label: "Cloud Run\nSaaS本体", col: 2, row: 1 },
          { id: "spanner", icon: "database/spanner", label: "Spanner\n全テナントデータ", col: 3, row: 1 }
        ],
        edges: [
          { from: "users", to: "apigw", label: "APIキー+JWT" },
          { from: "users", to: "idp", label: "ログイン" },
          { from: "apigw", to: "run", label: "認証済みリクエスト" },
          { from: "run", to: "spanner", label: "読み書き" },
          { from: "idp", to: "apigw", noArrow: true, dashed: true }
        ]
      },
      flow: [
        "利用者や連携システムはAPIキーとJWTを添えてAPI Gatewayへリクエストします",
        "API GatewayがJWTの検証とAPIキーの確認を行い、正当なリクエストだけをCloud Runへ中継します",
        "テナント別の細かいクォータ制御や利用量ダッシュボードは持たないため、必要な分だけアプリ側で実装します"
      ],
      services: [
        { icon: "integration/api-gateway", name: "API Gateway", role: "軽量なAPI入口。JWT検証・APIキー・OpenAPI定義ベースのルーティングを従量課金で提供する" },
        { icon: "security/identity-platform", name: "Identity Platform", role: "テナント別認証。推奨構成と共通" },
        { icon: "compute/cloud-run", name: "Cloud Run", role: "SaaS本体。推奨構成と共通" },
        { icon: "database/spanner", name: "Spanner", role: "全テナントデータ。推奨構成と共通" }
      ],
      points: [
        "ApigeeとAPI Gatewayの違いは「API管理製品」か「API入口部品」かです。認証つきの入口が欲しいだけなら、API Gatewayは100万コールあたり数百円の従量課金で、Apigeeとの価格差は月10万円前後になります",
        "一方で、テナント別クォータ・利用量分析・開発者ポータル・APIのバージョン管理ポリシーなどを自前実装し始めると、Apigeeを買ったほうが安かったという逆転が起きます。実装予定の管理機能を書き出してから選ぶのが確実です",
        "この構成から推奨構成への移行は入口の差し替えだけで済むため、「まずAPI Gatewayで公開し、API事業が育ったらApigee」という段階論も現実的です"
      ],
      pros: [
        "Apigee比で月10万円前後安く、完全従量課金で小さく始められる",
        "OpenAPI定義でAPIの入口を宣言的に管理できる",
        "アプリ・DB・認証は推奨構成と同じため、後からApigeeへ差し替えやすい"
      ],
      cons: [
        "テナント別クォータや利用量分析は自前実装になる",
        "開発者ポータルが無く、API公開の体裁（ドキュメント・キー発行フロー）を自分で用意する必要がある",
        "API収益化（従量課金請求）の仕組みは持たない"
      ],
      cost: "<strong>月3万円〜10万円程度</strong>。API Gatewayは月200万コールまでの無料枠+超過分は100万コールあたり450円前後と安価で、費用の中心はSpanner（100処理ユニットで月1.5万円前後〜）とCloud Runになります。",
      references: [
        { title: "API Gatewayドキュメント", url: "https://cloud.google.com/api-gateway/docs?hl=ja" },
        { title: "Identity Platformのマルチテナンシー", url: "https://cloud.google.com/identity-platform/docs/multi-tenancy?hl=ja" }
      ]
    }
  ],
  cost: "<p>推奨構成は<strong>月15万円〜30万円規模</strong>で、最大費目はApigeeです。API Gateway構成なら<strong>月3万円〜10万円程度</strong>、Cloud SQLスキーマ分離構成なら<strong>月3万円〜8万円程度</strong>まで下がります。SaaSではインフラ費を「テナント単価いくらか」に換算して料金プランと突き合わせるのが定石です。いずれも東京リージョン・1USD=150円前後の概算です。</p>",
  summary: "<p>マルチテナントSaaSの設計は<strong>「分離をどの層で保証するか」</strong>の積み重ねです。認証はIdentity Platformのテナント機能で、APIの利用量はApigeeのクォータで、データは主キー設計とアプリの共通層で、それぞれ分離を担わせます。DB分離・スキーマ分離・行分離の選択はテナント数と運用体制で決まり、正解は成長段階で移り変わります。認証だけは最初から差し替えの痛みが大きい部分なので、将来要件（SSO）を見据えて選びましょう。認証つきAPIの基本形はケース14、社外向けポータルの守り方はケース11も参考になります。</p>",
  quiz: [
    {
      q: "この構成では全テナントのデータを同じテーブルに入れ、行のテナントIDで分離しています。テナントごとにデータベースを分けなかったのはなぜでしょうか。",
      a: "数百テナントでDBを分けると、スキーマ変更を数百のDBに適用し、バックアップや監視も数百系統管理することになり、運用が破綻するためです。行分離なら運用は1系統のままテナント追加もデータ追加だけで済みます。その代わりクエリのテナント条件漏れが即漏洩事故になるため、全クエリにテナントIDを強制する共通層とテストで守ります。分離の強さと運用のスケールは交換関係にある、というのがこの問題の本質です。"
    },
    {
      q: "ApigeeとAPI Gatewayは価格が月10万円前後も違います。あなたはどんな条件が揃ったらApigeeを選びますか。",
      a: "APIそのものが商品になる段階が判断基準です。具体的には、テナント別のクォータや従量課金の根拠となる利用量計測、外部開発者向けのポータルとキー発行、プランごとのアクセス制御などを提供する必要が出たときです。これらを自前実装する工数はエンジニア数か月分になりやすく、月10万円の価格差を超えます。逆に「認証つきの入口」だけが必要な段階でApigeeを選ぶのは過剰投資で、API Gatewayで始めて後から差し替えるのが合理的です。"
    },
    {
      q: "大口見込み客から「自社のデータだけは専用データベースに格納してほしい」という契約条件を提示されました。行分離で設計済みのこのSaaSで、あなたはどう対応しますか。",
      a: "全体を作り直すのではなく、その顧客専用のDBインスタンス（またはSpannerの別データベース）を用意し、アプリの接続先解決層で「このテナントIDは専用DBへ」と振り分けるハイブリッド分離が現実的です。共通層でテナントIDから接続先を引く設計にしておけば、少数の特別対応と多数の行分離を共存させられます。ただし専用環境ぶんの運用・費用は増えるため、その差額を専用プランの価格に反映させる、という事業側の判断もセットで必要です。"
    }
  ]
});
