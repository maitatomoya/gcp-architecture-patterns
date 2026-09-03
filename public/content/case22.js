// ケース22：DWH＋BIダッシュボード
registerCase({
  id: 22,
  category: "データ・分析",
  title: "DWH＋BIダッシュボード",
  scenario: "<p>従業員300人の企業で、販売管理システムのDB（MySQL）・会計SaaS・広告データ・スプレッドシートに情報が散らばっています。経営会議のたびに各部門が手作業でExcel集計しており、数字の食い違いもたびたび起きています。全社のデータをBigQueryに集約したDWH（データウェアハウス：分析専用に整えたデータの保管庫）を作り、毎朝の会議までに前日分が反映される経営ダッシュボードを整備します。データエンジニアは専任1人と兼任1人です。</p>",
  requirements: [
    "業務DB・SaaS・スプレッドシートなど複数ソースを1か所に統合したい",
    "売上・粗利など経営指標の定義を全社で統一したい",
    "毎朝の会議までに前日分が反映されていればよい（秒単位の鮮度は不要）",
    "業務DBに分析クエリの負荷をかけたくない",
    "変換ロジックをSQLで管理し、変更履歴を残したい"
  ],
  main: {
    name: "BigQuery+Datastream+DataformのELT構成",
    diagram: {
      cols: 6, rows: 2,
      groups: [
        { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [4, 1] }
      ],
      nodes: [
        { id: "db", icon: "client/onprem-server", label: "業務DB\nMySQL", col: 0, row: 0 },
        { id: "saas", icon: "client/external-saas", label: "会計SaaS\n広告データ等", col: 0, row: 1 },
        { id: "dstr", icon: "analytics/datastream", label: "Datastream\nCDC取り込み", col: 1, row: 0 },
        { id: "bqraw", icon: "analytics/bigquery", label: "BigQuery\n生データ層", col: 2, row: 0 },
        { id: "dform", icon: "analytics/dataform", label: "Dataform\nSQL変換管理", col: 3, row: 0 },
        { id: "bqmart", icon: "analytics/bigquery", label: "BigQuery\nマート層", col: 4, row: 0 },
        { id: "composer", icon: "analytics/composer", label: "Cloud Composer\nジョブ統括", col: 2, row: 1 },
        { id: "ls", icon: "analytics/looker-studio", label: "Looker Studio\nダッシュボード", col: 5, row: 0 },
        { id: "exec", icon: "client/users", label: "経営層・現場", col: 5, row: 1 }
      ],
      edges: [
        { from: "db", to: "dstr", label: "変更ログ" },
        { from: "dstr", to: "bqraw", label: "継続反映" },
        { from: "bqraw", to: "dform", label: "参照" },
        { from: "dform", to: "bqmart", label: "変換SQL" },
        { from: "bqmart", to: "ls", label: "接続" },
        { from: "saas", to: "bqraw", label: "定期ロード" },
        { from: "composer", to: "dform", label: "実行指示", dashed: true },
        { from: "exec", to: "ls", label: "閲覧" }
      ]
    },
    flow: [
      "Datastreamが業務DBの変更ログ（CDC：データの変更差分だけを読み取る方式）を取り込み、BigQueryの生データ層へ継続的に反映します。分析のために業務DBへ重いSQLを打つ必要がなくなります",
      "会計SaaSや広告データなどDB以外のソースは、定期ジョブで生データ層へロードします",
      "Dataformが生データ層に対して指標定義のSQL変換を実行し、マート層（集計済みの分析用テーブル群）を作ります。変換SQLはGitで版管理されます",
      "取り込みと変換の実行順序・失敗時の再実行は、ジョブが増えてきたらCloud Composerが統括します",
      "Looker Studioはマート層だけを参照し、経営層や現場はブラウザでダッシュボードを見ます"
    ],
    services: [
      { icon: "analytics/datastream", name: "Datastream", role: "業務DBの変更差分（CDC)をサーバーレスでBigQueryへ流し込むサービス。全件エクスポートに比べDB負荷と遅延が小さい" },
      { icon: "analytics/bigquery", name: "BigQuery", role: "DWH本体。サーバーレスでデータが増えてもインフラ増強作業が不要。生データ層とマート層を同居させる" },
      { icon: "analytics/dataform", name: "Dataform", role: "BigQuery内のSQL変換をコードとして管理するサービス。依存関係の解決・テスト・Git連携を提供し、追加費用なしで使える" },
      { icon: "analytics/composer", name: "Cloud Composer", role: "マネージドなApache Airflow。取り込みや変換など複数ジョブの実行順序・リトライを統括する司令塔" },
      { icon: "analytics/looker-studio", name: "Looker Studio", role: "無料のBIツール。マート層に接続し、経営ダッシュボードを全社に共有する" }
    ],
    points: [
      "生データ層とマート層を分けるのはELT（先に貯めて後で変換）の考え方です。生のまま貯めておけば、指標定義を変えたときに過去へ遡って再計算できます。変換してから貯めるETLだと、失敗時や定義変更時の作り直しが難しくなります",
      "CDCを選んだのは、日次の全件エクスポートはDBに負荷がかかり、データが増えると夜間の時間内に終わらなくなるためです。変更分だけを流すCDCなら負荷も遅延も小さく済みます",
      "指標の計算式はDataformのSQLに一元化します。ダッシュボード側で各自が計算すると「会議で数字が合わない」事故が再発します。BIは表示に徹し、定義はDWH側に持たせるのが定石です",
      "Cloud Composerは最初からは入れません。取り込み経路が少ないうちはDataform内蔵のスケジュール実行で足り、ジョブの本数と依存関係が増えた段階で導入します（運行管理の詳細はケース24）"
    ],
    pros: [
      "BigQueryはサーバーレスで、データ量が増えても運用作業がほぼ増えない",
      "業務DBへの分析負荷がゼロになり、本業のシステムに影響を与えない",
      "変換ロジックがSQL+Gitで管理され、指標変更の経緯を追跡できる",
      "Looker Studioは無料のため、閲覧者が増えてもライセンス費がかからない"
    ],
    cons: [
      "Cloud Composerは常時起動の環境費が高め。小規模のうちは過剰投資になる",
      "Datastreamが対応しないソース（SaaSのAPIなど）は取り込みジョブの自作が必要",
      "層の設計（データモデリング）のスキルは結局必要で、ツールが設計を代行してくれるわけではない"
    ],
    cost: "<strong>月2万〜15万円程度</strong>が目安（東京リージョン・1USD=150円前後）。Datastreamは処理量の従量課金、BigQueryはストレージ+クエリで中規模なら月1万〜5万円、Dataform自体は無料（実行するクエリ代のみ）、Looker Studioも無料。Cloud Composerを導入すると小構成でも月5万円前後が加わるため、導入タイミングがコストの分かれ目です。",
    references: [
      { title: "BigQueryの概要", url: "https://cloud.google.com/bigquery/docs/introduction?hl=ja" },
      { title: "Dataformの概要", url: "https://cloud.google.com/dataform/docs/overview?hl=ja", note: "SQL変換をコード管理する中核サービス" },
      { title: "Datastreamの概要", url: "https://cloud.google.com/datastream/docs/overview?hl=ja", note: "CDC取り込みの公式解説" },
      { title: "Cloud Composerの概要", url: "https://cloud.google.com/composer/docs/composer-3/composer-overview?hl=ja" },
      { title: "Dataformのワークフロー構成", url: "https://cloud.google.com/dataform/docs/workflow-configurations?hl=ja", note: "Composerなしで定期実行する方法" }
    ]
  },
  alternatives: [
    {
      name: "スモールスタート構成（日次エクスポート+スケジュールクエリ）",
      when: "ソースが少なく日次更新で十分、専任のデータエンジニアがいない場合",
      diagram: {
        cols: 5, rows: 1,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [2, 0] }
        ],
        nodes: [
          { id: "db", icon: "client/onprem-server", label: "業務DB", col: 0, row: 0 },
          { id: "gcs", icon: "storage/cloud-storage", label: "Cloud Storage\n日次CSV", col: 1, row: 0 },
          { id: "bq", icon: "analytics/bigquery", label: "BigQuery\n取り込み+変換", col: 2, row: 0 },
          { id: "ls", icon: "analytics/looker-studio", label: "Looker Studio", col: 3, row: 0 },
          { id: "viewer", icon: "client/users", label: "閲覧者", col: 4, row: 0 }
        ],
        edges: [
          { from: "db", to: "gcs", label: "夜間エクスポート" },
          { from: "gcs", to: "bq", label: "定期ロード" },
          { from: "bq", to: "ls", label: "接続" },
          { from: "viewer", to: "ls", label: "閲覧" }
        ]
      },
      flow: [
        "業務DBから夜間バッチでCSVをCloud Storageへエクスポートします",
        "BigQueryが毎朝ファイルをロードし、スケジュールクエリ（BigQuery内蔵の定期実行機能）で集計テーブルを作ります",
        "Looker Studioが集計テーブルに接続してダッシュボードを表示します"
      ],
      services: [
        { icon: "storage/cloud-storage", name: "Cloud Storage", role: "エクスポートファイルの受け渡し場所。バッチロードの起点" },
        { icon: "analytics/bigquery", name: "BigQuery", role: "ロードも変換もスケジュールクエリで完結させる。バッチロード自体は無料" },
        { icon: "analytics/looker-studio", name: "Looker Studio", role: "無料のダッシュボード" }
      ],
      points: [
        "専用ツールを増やさず、BigQuery内蔵機能だけで回すのが狙いです。学ぶことが少なく、兼任1人でも維持できます",
        "全件エクスポートはデータが増えると夜間に終わらなくなり、DB負荷も大きくなります。その兆候が出たら推奨構成のCDCへ移行します",
        "スケジュールクエリはSQLの版管理や依存関係の定義ができません。変換が10本を超えたあたりからDataformへの移行を検討します"
      ],
      pros: [
        "月数千円レベルの低コストで、覚えるサービスも最少",
        "バッチロードは無料のため、取り込みコストがほぼゼロ"
      ],
      cons: [
        "全件エクスポートはデータ増加とともに破綻しやすい",
        "SQLの版管理・依存管理・テストがなく、変換が増えると属人化する"
      ],
      cost: "<strong>月数千円〜1万円程度</strong>が目安。BigQueryのストレージとクエリの従量課金が中心で、バッチロードとLooker Studioは無料です。",
      references: [
        { title: "データのバッチ読み込み", url: "https://cloud.google.com/bigquery/docs/batch-loading-data?hl=ja" },
        { title: "クエリのスケジューリング", url: "https://cloud.google.com/bigquery/docs/scheduling-queries?hl=ja", note: "スケジュールクエリの公式ドキュメント" }
      ]
    },
    {
      name: "Looker本格BI構成",
      when: "数百人規模で使い、指標のガバナンスや行レベルの閲覧権限制御が必要な場合",
      diagram: {
        cols: 5, rows: 1,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [3, 0] }
        ],
        nodes: [
          { id: "db", icon: "client/onprem-server", label: "業務DB", col: 0, row: 0 },
          { id: "dstr", icon: "analytics/datastream", label: "Datastream\nCDC取り込み", col: 1, row: 0 },
          { id: "bq", icon: "analytics/bigquery", label: "BigQuery\nDWH", col: 2, row: 0 },
          { id: "looker", icon: "analytics/looker", label: "Looker\nBI基盤", col: 3, row: 0 },
          { id: "users", icon: "client/users", label: "全社ユーザー", col: 4, row: 0 }
        ],
        edges: [
          { from: "db", to: "dstr", label: "変更ログ" },
          { from: "dstr", to: "bq", label: "継続反映" },
          { from: "bq", to: "looker", label: "クエリ" },
          { from: "users", to: "looker", label: "閲覧・探索" }
        ]
      },
      flow: [
        "データの取り込みは推奨構成と同じくDatastreamでBigQueryへ集約します",
        "Lookerが指標定義（LookML）を一元管理し、ユーザーのダッシュボード操作をSQLに変換してBigQueryへ投げます",
        "部門や役職に応じた行レベルの閲覧制御・指標の再利用・変更管理をLookerが担います"
      ],
      services: [
        { icon: "analytics/looker", name: "Looker", role: "有償のエンタープライズBI。LookMLというコードで指標を定義し、全ダッシュボードに同じ定義を強制できる" },
        { icon: "analytics/bigquery", name: "BigQuery", role: "DWH本体。Lookerからのクエリを受ける" },
        { icon: "analytics/datastream", name: "Datastream", role: "業務DBからのCDC取り込み" }
      ],
      points: [
        "Looker StudioとLookerは別物です。Studioは無料の可視化ツール、Lookerは指標定義の統制・権限管理・監査まで含む有償のBI基盤です",
        "指標定義をLookMLのコードで持つため、ダッシュボードが何百枚に増えても全社で同じ計算式が保証されます。推奨構成でDataformが担っていた役割の一部をBI側に寄せる設計です",
        "ライセンス費が大きいため、閲覧者数と統制要件がそれに見合うか（数百人規模・監査要件あり）が導入判断の軸になります"
      ],
      pros: [
        "指標定義・権限・監査を一元管理でき、大組織でも数字のブレが起きにくい",
        "ユーザー自身がダッシュボードを探索的に操作でき、分析チームへの依頼が減る"
      ],
      cons: [
        "ライセンス費が高額（一般に月数十万円規模〜）で、小規模組織には見合わない",
        "LookMLの学習・モデル管理という新しい専門スキルが必要になる"
      ],
      cost: "<strong>月数十万円規模〜</strong>が目安。Lookerのライセンスは規模・契約により大きく変わるため見積もりが必要です。基盤側（BigQuery+Datastream）は推奨構成と同等です。",
      references: [
        { title: "Lookerの概要", url: "https://cloud.google.com/looker/docs/intro?hl=ja" },
        { title: "Lookerドキュメント", url: "https://cloud.google.com/looker/docs?hl=ja" }
      ]
    }
  ],
  cost: "<p>スモールスタート構成なら<strong>月数千円〜1万円程度</strong>、推奨構成は<strong>月2万〜15万円程度</strong>（Composer導入時に月5万円前後が加算）、Looker本格構成は<strong>月数十万円規模〜</strong>。データ量よりも「どこまでの統制・自動化を買うか」で費用が階段状に変わるのがDWH領域の特徴です。いずれも東京リージョン・1USD=150円前後の目安です。</p>",
  summary: "<p>DWH構築の定石は<strong>BigQueryに生データのまま集め、変換は後からSQLで行うELT</strong>です。取り込みはCDC（Datastream）で業務DBに負荷をかけず、指標定義はDataformのコードに一元化して「数字が合わない」問題を仕組みで断ちます。ツールは組織の成長に合わせて段階導入するのが現実的で、スケジュールクエリ→Dataform→Composer→Lookerと、統制の必要性が増すたびに部品を足していきます。データの集め方はケース20、リアルタイム化はケース21、パイプラインの運行管理はケース24で深掘りします。</p>",
  quiz: [
    {
      q: "なぜBigQueryの中を生データ層とマート層に分けるのでしょうか。最初から集計済みの形で取り込めば1層で済むはずです。",
      a: "指標の定義変更や変換の失敗に備えるためです。生データが残っていれば、粗利の計算式が変わっても過去にさかのぼって再計算できますが、集計済みの形でしか持っていないと元の情報が失われており作り直せません。また変換処理にバグがあった場合も、生データ層から再実行するだけで復旧できます。先に貯めて後で変換するELTは、BigQueryのように安価で強力なDWHがあって初めて成立する現代的な定石です。"
    },
    {
      q: "日次の全件エクスポートからCDC（Datastream）へ切り替えるべきサインには、どんなものがあるでしょうか。",
      a: "代表的なサインは3つあります。第一に夜間のエクスポートが時間内に終わらなくなること、第二にエクスポート処理が業務DBの性能を圧迫し本業のシステムに影響が出ること、第三に「前日分では遅い」という鮮度要件の変化です。CDCは変更差分だけを流すためDB負荷も遅延も小さく、データ量が増えるほど全件方式との差が開きます。逆に言えば、小規模のうちは単純な全件エクスポートで十分という判断も正しいのです。"
    },
    {
      q: "経営会議で「ダッシュボードの売上と営業部のExcelの売上が合わない」と指摘されました。あなたなら何から確認しますか。",
      a: "まず両者の指標定義の差を確認します。集計期間（受注日か計上日か）、キャンセルや返品の扱い、税込みか税抜きかなど、定義のズレが原因のことがほとんどです。その上で、再発防止として指標の計算式をDataformのSQLに一元化し、ダッシュボードやExcel側では独自に計算しない運用へ寄せます。数字の不一致はツールの不具合ではなく定義の二重管理から生まれる、というのがDWH運用の重要な教訓です。"
    }
  ]
});
