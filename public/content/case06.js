// ケース6：グローバル・多言語サイト
registerCase({
  id: 6,
  category: "Webサイト・配信",
  title: "グローバル・多言語サイト",
  scenario: "<p>日本発のコンテンツサイト（技術情報メディア）を英語圏・アジア圏へ展開します。会員登録・ブックマーク・コメントなどの動的機能があり、記事は日本語で入稿して多言語で公開します。ユーザーは北米・欧州・アジアに分散し、今後も地域が増える見込みです。エンジニアは5人で、地域ごとに別システムを運用する余力はありません。</p>",
  requirements: [
    "北米・欧州・アジアのユーザーに現地語でコンテンツを届けたい",
    "どの地域からもページ表示が速いこと（海外からの表示遅延を最小にする）",
    "URLは世界共通の1つに保ちたい（地域別ドメインを乱立させない）",
    "会員情報やブックマークは全世界で一貫して見えること",
    "特定リージョンの障害時も閲覧を継続したい",
    "運用チームは日本の1チームのみ。構成は1系統に保ちたい"
  ],
  main: {
    name: "グローバルLB+マルチリージョンCloud Run+Spanner構成",
    diagram: {
      cols: 5, rows: 3,
      groups: [
        { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [4, 2] },
        { type: "region", label: "東京リージョン", from: [2, 0], to: [2, 0], depth: 1 },
        { type: "region", label: "米国リージョン", from: [2, 2], to: [2, 2], depth: 1 }
      ],
      nodes: [
        { id: "users", icon: "client/users", label: "世界中の\nユーザー", col: 0, row: 1 },
        { id: "cdn", icon: "network/cloud-cdn", label: "Cloud CDN\nエッジキャッシュ", col: 1, row: 0 },
        { id: "lb", icon: "network/cloud-load-balancing", label: "Cloud LB\nグローバル", col: 1, row: 1 },
        { id: "runjp", icon: "compute/cloud-run", label: "Cloud Run\n東京", col: 2, row: 0 },
        { id: "runus", icon: "compute/cloud-run", label: "Cloud Run\n米国", col: 2, row: 2 },
        { id: "spanner", icon: "database/spanner", label: "Spanner\nマルチリージョン", col: 3, row: 1 },
        { id: "translate", icon: "ai/translation", label: "Translation API\n機械翻訳", col: 4, row: 0 }
      ],
      edges: [
        { from: "users", to: "lb", label: "HTTPS" },
        { from: "cdn", to: "lb", noArrow: true, dashed: true },
        { from: "lb", to: "runjp", label: "最寄りリージョンへ" },
        { from: "lb", to: "runus" },
        { from: "runjp", to: "spanner", label: "読み書き" },
        { from: "runus", to: "spanner" },
        { from: "runjp", to: "translate", label: "下訳の生成" }
      ]
    },
    flow: [
      "ユーザーは世界共通の1つのURLにアクセスします。GCPのグローバル外部ロードバランサは世界で1つのIPアドレス（エニーキャストIP）を持ち、ユーザーは自動的に最寄りのGoogleエッジ拠点に着地します",
      "画像やCSSなどの静的コンテンツはCloud CDNがエッジでキャッシュ応答し、リージョンまでリクエストが届く前に返します",
      "動的リクエストは、ロードバランサがユーザーに近いリージョン（東京または米国）のCloud Runへ転送します",
      "どのリージョンのCloud Runも同じSpanner（マルチリージョン構成）を読み書きするため、会員情報やブックマークの見え方が世界中で一致します",
      "記事の入稿時にはTranslation APIで各言語の下訳を生成してSpannerに保存し、公開前に人がレビューします。閲覧のたびに翻訳するのではなく、事前に翻訳して配信します"
    ],
    services: [
      { icon: "network/cloud-load-balancing", name: "Cloud Load Balancing（グローバル外部ALB）", role: "世界で1つのIPアドレスでリクエストを受け、最寄りリージョンのバックエンドへ振り分ける入口。リージョン障害時は自動で健全なリージョンへ迂回する" },
      { icon: "network/cloud-cdn", name: "Cloud CDN", role: "ロードバランサに紐づくCDN。静的コンテンツを世界中のエッジでキャッシュし、海外からの表示を高速化する" },
      { icon: "compute/cloud-run", name: "Cloud Run", role: "アプリ本体。同じコンテナを東京と米国の両リージョンにデプロイし、それぞれ自動スケールする" },
      { icon: "database/spanner", name: "Spanner", role: "複数リージョンにデータを自動複製するリレーショナルデータベース。世界中から読み書きしても強い整合性（どこから見ても同じ最新データ）を保つ" },
      { icon: "ai/translation", name: "Translation API", role: "記事入稿時に多言語の下訳を機械翻訳で生成する。用語集（グロッサリ）で固有名詞の訳語を固定できる" }
    ],
    points: [
      "ロードバランサを1つ置くだけで世界中を受けられるのはGCPの大きな特徴です。リージョンごとにロードバランサを立ててDNSで振り分ける方式に比べ、単一IP・単一設定で済み、リージョン追加も「バックエンドを増やす」だけで完了します",
      "データベースをリージョンごとに分けると同期の仕組みを自作することになり、これが最大の運用負担になります。Spannerに一元化して「複製と整合性はデータベースに任せる」判断をしました",
      "翻訳をリクエスト時ではなく入稿時に行うのは、翻訳コストを記事数に比例させる（閲覧数に比例させない）ためと、公開前に人が訳文を確認できるようにするためです",
      "サーバーレス構成のためVPCやCloud NATが図にありません。Cloud Run・Spanner・CDNはいずれもGoogleが運用するマネージドサービスで、自前のネットワークを作る必要がないためです"
    ],
    pros: [
      "世界中どこからでも低遅延。リージョン追加は同じ構成の横展開で済む",
      "リージョン障害時もロードバランサが自動で別リージョンへ迂回し、閲覧を継続できる",
      "データが1系統なので、会員情報の不整合や同期ずれに悩まされない",
      "アプリ・DB・配信のすべてがマネージドで、5人のチームでも世界展開を運用できる"
    ],
    cons: [
      "Spannerのマルチリージョン構成は高価。小規模サイトには過剰投資になりやすい",
      "Spannerは通常のMySQL/PostgreSQLと設計の勘所が異なり（主キー設計など）、学習コストがかかる",
      "機械翻訳の品質チェック体制（レビューフロー）を別途用意する必要がある",
      "リージョン間のレイテンシを意識した設計（書き込み頻度の高い処理の配置など）が必要になる場面がある"
    ],
    cost: "<strong>月20万円〜50万円規模</strong>が目安です。大半はSpannerのマルチリージョン構成で、1ノード（1,000処理ユニット）相当で月数十万円規模になります。ただし100処理ユニット単位で約10分の1から始められます。Cloud Runは2リージョン分でも従量課金で月数千円〜数万円、CDNとロードバランサ、Translation API（月50万文字までの無料枠あり）が続きます。東京リージョン・1USD=150円前後の概算であり、規模と為替で大きく変わります。",
    references: [
      { title: "外部アプリケーションロードバランサの概要", url: "https://cloud.google.com/load-balancing/docs/application-load-balancer?hl=ja", note: "グローバルLBの仕組みの公式解説" },
      { title: "複数のリージョンからのトラフィック配信（Cloud Run）", url: "https://cloud.google.com/run/docs/multiple-regions?hl=ja", note: "この構成そのものの公式ガイド" },
      { title: "Spannerのインスタンス構成（リージョン・マルチリージョン）", url: "https://cloud.google.com/spanner/docs/instance-configurations?hl=ja" },
      { title: "Cloud Translationの概要", url: "https://cloud.google.com/translate/docs/overview?hl=ja" },
      { title: "Cloud CDNの概要", url: "https://cloud.google.com/cdn/docs/overview?hl=ja" }
    ]
  },
  alternatives: [
    {
      name: "単一リージョン+Cloud CDN構成",
      when: "海外アクセスの大半が記事閲覧（静的コンテンツ中心）で、まず低コストに世界配信を始めたい場合",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [3, 1] },
          { type: "region", label: "東京リージョン", from: [2, 1], to: [3, 1], depth: 1 }
        ],
        nodes: [
          { id: "users", icon: "client/users", label: "世界中の\nユーザー", col: 0, row: 1 },
          { id: "cdn", icon: "network/cloud-cdn", label: "Cloud CDN\nエッジキャッシュ", col: 1, row: 0 },
          { id: "lb", icon: "network/cloud-load-balancing", label: "Cloud LB\nグローバル", col: 1, row: 1 },
          { id: "run", icon: "compute/cloud-run", label: "Cloud Run\nアプリ", col: 2, row: 1 },
          { id: "sql", icon: "database/cloud-sql", label: "Cloud SQL\n会員・記事DB", col: 3, row: 1 }
        ],
        edges: [
          { from: "users", to: "lb", label: "HTTPS" },
          { from: "cdn", to: "lb", noArrow: true, dashed: true },
          { from: "lb", to: "run", label: "キャッシュミス時のみ" },
          { from: "run", to: "sql", label: "SQL" }
        ]
      },
      flow: [
        "ユーザーはグローバルロードバランサ経由でアクセスし、記事ページや画像はCloud CDNが世界中のエッジから返します",
        "キャッシュにない動的リクエスト（ログイン、ブックマーク操作など）だけが東京リージョンのCloud Runまで届きます",
        "データは東京のCloud SQLに保存します。海外ユーザーの動的操作には太平洋往復ぶんの遅延（100〜200ミリ秒程度）が乗ります"
      ],
      services: [
        { icon: "network/cloud-cdn", name: "Cloud CDN", role: "この構成の主役。閲覧トラフィックの大半をエッジで処理し、東京までの遅延を隠す" },
        { icon: "network/cloud-load-balancing", name: "Cloud Load Balancing", role: "グローバルな入口。この構成でもLB自体は世界中で低遅延に受けられる" },
        { icon: "compute/cloud-run", name: "Cloud Run", role: "アプリ本体。東京リージョンのみにデプロイする" },
        { icon: "database/cloud-sql", name: "Cloud SQL", role: "会員情報・記事データを保存するリレーショナルDB。単一リージョンなら安価で運用も枯れている" }
      ],
      points: [
        "閲覧が9割のメディアサイトなら、CDNのキャッシュヒット率を上げるだけで海外の体感速度はかなり改善します。動的機能の遅延が許容できるかが判断の分かれ目です",
        "キャッシュのTTL設計（記事は長め、一覧は短め）とデプロイ時のキャッシュ無効化の運用をセットで決めておきます",
        "この構成のまま記事の多言語化は可能です（Translation APIでの事前翻訳は推奨構成と同じやり方が使えます）",
        "東京リージョンに障害が起きると動的機能は全世界で止まります。閲覧はCDNキャッシュが生きている間は継続できます"
      ],
      pros: [
        "月数万円以内に収まりやすく、構成もケース2やケース7の延長で理解しやすい",
        "DBが普通のCloud SQLなので、既存のMySQL/PostgreSQLの知識がそのまま使える"
      ],
      cons: [
        "ログインやコメントなど動的操作は海外から遅い（太平洋往復の遅延が構造的に残る）",
        "東京リージョン障害時は動的機能が全停止する",
        "海外ユーザーが増えて「遅い」という声が大きくなったら、結局マルチリージョン化の作り直しが必要になる"
      ],
      cost: "<strong>月1万円〜3万円程度</strong>。Cloud Run（従量課金）+Cloud SQLの小規模インスタンス（月5,000円前後〜）+CDN・LBの従量課金という内訳です。推奨構成の10分の1以下で始められます。",
      references: [
        { title: "Cloud CDNの概要", url: "https://cloud.google.com/cdn/docs/overview?hl=ja" },
        { title: "Cloud Runドキュメント", url: "https://cloud.google.com/run/docs?hl=ja" },
        { title: "Cloud RunからCloud SQLへ接続する", url: "https://cloud.google.com/sql/docs/mysql/connect-run?hl=ja" }
      ]
    },
    {
      name: "マルチリージョンCloud Run+Cloud SQLリードレプリカ構成",
      when: "読み取りが大半で書き込みは限定的、Spannerの費用は出せないが海外の読み取り低遅延とリージョン障害への備えは欲しい場合",
      diagram: {
        cols: 5, rows: 3,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [4, 2] },
          { type: "region", label: "東京リージョン", from: [2, 0], to: [3, 0], depth: 1 },
          { type: "region", label: "米国リージョン", from: [2, 2], to: [4, 2], depth: 1 }
        ],
        nodes: [
          { id: "users", icon: "client/users", label: "世界中の\nユーザー", col: 0, row: 1 },
          { id: "lb", icon: "network/cloud-load-balancing", label: "Cloud LB\nグローバル", col: 1, row: 1 },
          { id: "runjp", icon: "compute/cloud-run", label: "Cloud Run\n東京", col: 2, row: 0 },
          { id: "sqlp", icon: "database/cloud-sql", label: "Cloud SQL\nプライマリ", col: 3, row: 0 },
          { id: "runus", icon: "compute/cloud-run", label: "Cloud Run\n米国", col: 2, row: 2 },
          { id: "sqlr", icon: "database/cloud-sql", label: "Cloud SQL\nリードレプリカ", col: 4, row: 2 }
        ],
        edges: [
          { from: "users", to: "lb", label: "HTTPS" },
          { from: "lb", to: "runjp", label: "最寄りリージョンへ" },
          { from: "lb", to: "runus" },
          { from: "runjp", to: "sqlp", label: "読み書き" },
          { from: "runus", to: "sqlr", label: "読み取り" },
          { from: "runus", to: "sqlp", label: "書き込みのみ" },
          { from: "sqlp", to: "sqlr", label: "非同期レプリケーション", dashed: true }
        ]
      },
      flow: [
        "入口は推奨構成と同じグローバルロードバランサで、ユーザーに近いリージョンのCloud Runへ振り分けます",
        "東京のCloud SQLプライマリだけが書き込みを受け付け、米国にはリードレプリカ（読み取り専用の複製）を置きます",
        "米国のCloud Runは、記事表示などの読み取りは手元のレプリカから、会員登録などの書き込みは東京のプライマリへ、と接続先を使い分けます",
        "プライマリからレプリカへの複製は非同期のため、書き込み直後のデータがレプリカに反映されるまで数秒の遅れ（レプリケーションラグ）が生じえます"
      ],
      services: [
        { icon: "network/cloud-load-balancing", name: "Cloud Load Balancing", role: "グローバルな入口。推奨構成と同じ役割" },
        { icon: "compute/cloud-run", name: "Cloud Run", role: "アプリ本体。読み取りと書き込みで接続先DBを切り替える実装を持つ" },
        { icon: "database/cloud-sql", name: "Cloud SQL（プライマリ+クロスリージョンリードレプリカ）", role: "書き込みは東京に集約し、読み取りを各リージョンへ分散する。レプリカはプライマリ障害時の昇格先にもなる" }
      ],
      points: [
        "Spannerとの最大の違いは整合性です。この構成は「少し古いデータを読む可能性」を受け入れる代わりに、DB費用を大きく下げています。ブックマーク一覧が数秒古くても困らない、という業務判断が前提です",
        "書き込みはどこから来ても東京へ届くため、海外ユーザーの書き込みだけは遅いままです。読み取り中心のサイトだから成立する構成です",
        "アプリ側に「読み書きの接続先分離」の実装が必要になります。ORMやフレームワークのリードレプリカ対応を確認してから採用します",
        "東京リージョン障害時はレプリカをプライマリに昇格して復旧します。自動ではなく手順の整備と訓練が必要です"
      ],
      pros: [
        "海外の読み取りが速くなり、DB費用はSpannerマルチリージョンの数分の1に収まる",
        "MySQL/PostgreSQL互換のまま世界展開でき、既存の知識と資産を活かせる",
        "リージョン障害時もレプリカ昇格で復旧できる（DR構成を兼ねる）"
      ],
      cons: [
        "レプリケーションラグによる「書いたはずのデータが見えない」問題への対処をアプリで設計する必要がある",
        "書き込みのグローバル低遅延は実現できない",
        "レプリカ昇格の手順整備・訓練という運用課題が残る（詳しくはケース49で学びます）"
      ],
      cost: "<strong>月5万円〜15万円程度</strong>。Cloud SQLインスタンス2台分（プライマリ+レプリカ）とリージョン間のデータ転送料が推奨構成との主な差分です。Spannerマルチリージョンより大幅に安く、単一リージョン構成よりは高い中間の選択肢です。",
      references: [
        { title: "Cloud SQLのレプリケーションについて", url: "https://cloud.google.com/sql/docs/mysql/replication?hl=ja", note: "クロスリージョンリードレプリカの公式解説" },
        { title: "複数のリージョンからのトラフィック配信（Cloud Run）", url: "https://cloud.google.com/run/docs/multiple-regions?hl=ja" }
      ]
    }
  ],
  cost: "<p>推奨構成（Spannerマルチリージョン）は<strong>月20万円〜50万円規模</strong>、リードレプリカ構成は<strong>月5万円〜15万円程度</strong>、単一リージョン+CDN構成は<strong>月1万円〜3万円程度</strong>が目安です。世界中での書き込み整合性という要件に値段がついていく構造で、「本当に世界中から書き込むのか」「古い読み取りを許容できるか」の見極めがコストを1桁変えます。いずれも東京リージョン・1USD=150円前後の概算です。</p>",
  summary: "<p>グローバル展開の要点は<strong>「配信」「計算」「データ」のどこまでを世界に分散するか</strong>という段階の見極めです。配信だけならCDNで足ります。計算まで分散するならCloud Runを各リージョンへ。データまで分散するならSpannerかリードレプリカかで整合性とコストを天秤にかけます。GCPはグローバルLBという世界共通の入口を最初から持っているため、この段階を後から引き上げやすいのが強みです。リージョン障害への備えとしての多重化はケース49でさらに深掘りします。</p>",
  quiz: [
    {
      q: "この構成ではロードバランサが世界に1つしかありません。地域ごとにロードバランサを立てなくてよいのはなぜでしょうか。",
      a: "GCPのグローバル外部ロードバランサはエニーキャストIPという仕組みで、世界中のGoogleエッジ拠点が同じIPアドレスでリクエストを受けるためです。ユーザーは自動的に最寄りの拠点に着地し、そこからGoogleの内部ネットワークで最適なリージョンへ運ばれます。リージョンごとにLBとDNS振り分けを組む方式に比べ、設定が1系統で済みリージョン追加も容易になります。"
    },
    {
      q: "翻訳処理を「ページ閲覧のたび」ではなく「記事の入稿時」に行うのはなぜでしょうか。閲覧時翻訳にすると何が起きますか。",
      a: "閲覧時に翻訳すると、翻訳コストが閲覧数に比例して膨らみ、毎回の応答に翻訳の待ち時間が乗り、さらに機械翻訳の誤りが未確認のまま公開されてしまいます。入稿時の事前翻訳なら、コストは記事数に比例するだけで済み、訳文をキャッシュ・配信でき、公開前に人がレビューする工程も挟めます。生成系APIを使う設計全般に通じる「前処理に寄せる」考え方です。"
    },
    {
      q: "あなたのサイトは記事閲覧が95%で、海外からの書き込みはごくわずかだと分かりました。それでもSpannerマルチリージョン構成を選びますか。月20万円以上の差額を踏まえて考えてください。",
      a: "この条件なら、まず単一リージョン+CDN構成か、リードレプリカ構成を選ぶのが合理的です。読み取り中心ならCDNとレプリカで海外の体感速度は十分改善でき、わずかな書き込みの遅延は許容できる可能性が高いためです。Spannerが効くのは、世界各地から高頻度の書き込みがあり、かつ強い整合性が必要な場合です。要件の実態を数字で確かめてから高い構成に進む、という順番が設計判断の基本です。"
    }
  ]
});
