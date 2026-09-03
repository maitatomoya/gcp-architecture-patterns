// ケース49：災害対策（DR）・マルチリージョン
registerCase({
  id: 49,
  category: "運用・セキュリティ・信頼性",
  title: "災害対策（DR）・マルチリージョン",
  scenario: "<p>会員30万人向けのWebサービスを東京リージョンで運用しています。マルチゾーン構成（同一リージョン内の複数ゾーンへの分散）は済んでいるため単発のハードウェア障害には耐えられますが、大規模災害やリージョン全体の障害が起きればサービスは丸ごと止まります。経営層から「東日本で大地震が起きてもサービスを継続できるのか」と問われ、DR（Disaster Recovery：災害復旧）計画の策定を任されました。</p><p>DRはケース48でも登場したRTO（どれだけの停止を許すか）とRPO（どこまでのデータ損失を許すか）で要件を数値化し、それに見合う段階の構成を選びます。短くするほど費用は増えるため、DRは技術選定である以上に経営判断です。</p>",
  requirements: [
    "東京リージョン全体の障害でもサービスを継続または早期復旧したい",
    "RTO・RPOの目標を明確にし、それに見合うコストで構成したい",
    "データベースのデータをフェイルオーバー先でも失わないようにしたい",
    "切り替えの手順が複雑すぎて訓練できない、という事態を避けたい",
    "平常時のコスト増をできるだけ抑えたい"
  ],
  main: {
    name: "ウォームスタンバイ構成（東京+大阪、グローバルLB+クロスリージョンレプリカ）",
    diagram: {
      cols: 5, rows: 3,
      groups: [
        { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [4, 2] },
        { type: "region", label: "東京リージョン", from: [2, 0], to: [3, 0], depth: 1 },
        { type: "region", label: "大阪リージョン", from: [2, 2], to: [3, 2], depth: 1 }
      ],
      nodes: [
        { id: "users", icon: "client/users", label: "ユーザー", col: 0, row: 1 },
        { id: "dns", icon: "network/cloud-dns", label: "Cloud DNS", col: 1, row: 0 },
        { id: "lb", icon: "network/cloud-load-balancing", label: "Cloud LB\nグローバル", col: 1, row: 1 },
        { id: "runa", icon: "compute/cloud-run", label: "Cloud Run\n本番稼働", col: 2, row: 0 },
        { id: "sqla", icon: "database/cloud-sql", label: "Cloud SQL\nプライマリ", col: 3, row: 0 },
        { id: "runb", icon: "compute/cloud-run", label: "Cloud Run\n縮小して待機", col: 2, row: 2 },
        { id: "sqlb", icon: "database/cloud-sql", label: "Cloud SQL\nリードレプリカ", col: 3, row: 2 },
        { id: "gcs", icon: "storage/cloud-storage", label: "Cloud Storage\nデュアルリージョン", col: 4, row: 1 }
      ],
      edges: [
        { from: "users", to: "dns", label: "名前解決", dashed: true },
        { from: "users", to: "lb", label: "HTTPS" },
        { from: "lb", to: "runa", label: "通常時" },
        { from: "lb", to: "runb", label: "障害時に切替" },
        { from: "runa", to: "sqla", label: "読み書き" },
        { from: "sqla", to: "sqlb", label: "レプリケーション" },
        { from: "runb", to: "sqlb", label: "昇格後に接続", dashed: true },
        { from: "runa", to: "gcs", label: "画像・ファイル" },
        { from: "runb", to: "gcs", noArrow: true, dashed: true }
      ]
    },
    flow: [
      "平常時、ユーザーのリクエストはグローバルなCloud Load Balancingが受け、東京リージョンのCloud Runへ届ける。大阪側のCloud Runは最小インスタンス数を絞って安価に待機させる",
      "Cloud SQLは東京のプライマリから大阪のクロスリージョンリードレプリカへ非同期でデータを複製し続ける",
      "画像などのファイルはデュアルリージョンのCloud Storageに置き、両リージョンから同じバケットとして読める状態にしておく",
      "東京リージョンの障害時、LBのヘルスチェックが東京側の異常を検知し、トラフィックを大阪のCloud Runへ振り向ける",
      "大阪のレプリカをプライマリへ昇格（レプリカを書き込み可能なDBに切り替える操作）し、アプリの接続先を切り替えてサービスを再開する"
    ],
    services: [
      { icon: "network/cloud-load-balancing", name: "Cloud Load Balancing（グローバル）", role: "世界共通の1つのIPで受け、健全なリージョンへ振り分ける。DNS切替なしのフェイルオーバーを可能にする要" },
      { icon: "compute/cloud-run", name: "Cloud Run（2リージョン）", role: "アプリ実行基盤。ステートレスなら同じコンテナを両リージョンへ配備するだけでよい" },
      { icon: "database/cloud-sql", name: "Cloud SQL（クロスリージョンレプリカ）", role: "リージョンをまたいでデータを複製する。障害時はレプリカを昇格させて書き込みを引き継ぐ" },
      { icon: "storage/cloud-storage", name: "Cloud Storage（デュアルリージョン）", role: "東京・大阪の2リージョンへ自動複製されるバケット。ファイルのDRを設定だけで済ませる" },
      { icon: "network/cloud-dns", name: "Cloud DNS", role: "ドメインの名前解決。グローバルLB方式では障害時のDNS変更が不要になる" }
    ],
    points: [
      "GCPのグローバルLBは世界共通のエニーキャストIP（どこから接続しても最寄りの拠点に届く方式）を持つため、リージョン切替をDNSの書き換えなしで行えます。DNS切替方式で問題になるキャッシュの残留（切替が浸透するまでの待ち時間）を構造ごと回避できるのがGCPらしい設計です",
      "アプリをステートレス（サーバー内に状態を持たない作り）にしておくことがDRの前提条件です。セッションや一時ファイルをサーバー内に持っていると、リージョン切替の瞬間にそれらは失われます",
      "非同期レプリケーションのため、障害の瞬間に複製が追いついていなかった数秒〜数十秒分の更新は失われ得ます（これがこの構成のRPO）。ゼロにしたければ代替案のSpanner型を検討します",
      "切替の最後の砦であるレプリカ昇格を自動にするか手動にするかは重要な判断です。自動は速い一方、誤検知で切り替わるリスク（スプリットブレイン）があるため、月1回程度の訓練とセットで手動起点にする選択も堅実です"
    ],
    pros: [
      "リージョン障害時もRTO数分〜数十分での継続・復旧が狙える",
      "DNSキャッシュに依存しない即時のトラフィック切替ができる",
      "待機側を縮小して運用するため、完全二重化より平常時コストが低い",
      "切替の大部分（LBの経路変更）が自動で、人手の手順が少ない"
    ],
    cons: [
      "DBレプリカと待機環境のぶん、平常時コストがシングルリージョンの1.5〜2倍程度になる",
      "非同期複製の遅延分だけデータ損失があり得る（RPOゼロではない）",
      "レプリカ昇格・接続切替の手順は訓練しておかないと本番で必ず詰まる",
      "DBのスキーマ変更やバージョン管理を2リージョン前提で考える運用負荷が増える"
    ],
    cost: "<strong>月3万円〜10万円程度</strong>が目安（東京リージョン・大阪リージョン、1USD=150円換算。元の構成規模に依存）。内訳は、クロスリージョンレプリカでDB費用がほぼ2倍（例：月2万円のインスタンスなら+2万円）、大阪側Cloud Runの最小インスタンスで月数千円、グローバルLBが月約2,700円〜、デュアルリージョンGCSはシングルリージョン比で保存単価が約2割増＋リージョン間複製の転送費です。おおまかには「現行インフラ費の1.5〜2倍」と見積もると外しません。",
    references: [
      { title: "障害復旧計画ガイド", url: "https://cloud.google.com/architecture/dr-scenarios-planning-guide?hl=ja", note: "RTO/RPOと段階別DRパターンの公式ガイド" },
      { title: "Cloud SQLのリードレプリカ（クロスリージョン）", url: "https://cloud.google.com/sql/docs/mysql/replication?hl=ja" },
      { title: "Cloud SQLの障害復旧の概要", url: "https://cloud.google.com/sql/docs/mysql/intro-to-cloud-sql-disaster-recovery?hl=ja", note: "レプリカ昇格によるDRの考え方" },
      { title: "Cloud Load Balancingの概要", url: "https://cloud.google.com/load-balancing/docs/load-balancing-overview?hl=ja", note: "グローバルLBとリージョンLBの違い" },
      { title: "Cloud Storageのバケットのロケーション", url: "https://cloud.google.com/storage/docs/locations?hl=ja", note: "デュアルリージョンの説明" }
    ]
  },
  alternatives: [
    {
      name: "バックアップ&リストア構成（コールドDR）",
      when: "RTOが数時間〜1日でも許容される場合や、DR予算を最小に抑えたい場合",
      diagram: {
        cols: 5, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [4, 1] },
          { type: "region", label: "東京リージョン", from: [2, 0], to: [3, 0], depth: 1 },
          { type: "region", label: "大阪リージョン", from: [2, 1], to: [3, 1], depth: 1 }
        ],
        nodes: [
          { id: "users", icon: "client/users", label: "ユーザー", col: 0, row: 0 },
          { id: "dns", icon: "network/cloud-dns", label: "Cloud DNS\n切替先を変更", col: 1, row: 1 },
          { id: "runa", icon: "compute/cloud-run", label: "Cloud Run\n本番", col: 2, row: 0 },
          { id: "sqla", icon: "database/cloud-sql", label: "Cloud SQL\n本番DB", col: 3, row: 0 },
          { id: "runb", icon: "compute/cloud-run", label: "Cloud Run\n障害時に構築", col: 2, row: 1 },
          { id: "sqlb", icon: "database/cloud-sql", label: "Cloud SQL\nリストアで復旧", col: 3, row: 1 },
          { id: "gcs", icon: "storage/cloud-storage", label: "Cloud Storage\nバックアップ保管", col: 4, row: 0 }
        ],
        edges: [
          { from: "users", to: "runa", label: "HTTPS" },
          { from: "users", to: "dns", label: "障害時に切替", dashed: true },
          { from: "dns", to: "runb", label: "切替後の宛先", dashed: true },
          { from: "runa", to: "sqla", label: "読み書き" },
          { from: "sqla", to: "gcs", label: "日次バックアップ" },
          { from: "gcs", to: "sqlb", label: "リストア", dashed: true },
          { from: "runb", to: "sqlb", noArrow: true, dashed: true }
        ]
      },
      flow: [
        "平常時は東京リージョンのみで運用し、DBのバックアップをデュアルリージョンのCloud Storageへ日次で保管する。インフラ構成はIaC（ケース44）でコード化しておく",
        "東京リージョンの障害時、IaCを使って大阪リージョンにCloud RunとCloud SQLを新規構築する",
        "最新のバックアップからDBをリストアし、動作確認する",
        "Cloud DNSでドメインの向き先を大阪の環境へ切り替え、サービスを再開する（DNSキャッシュの浸透待ちが発生する）"
      ],
      services: [
        { icon: "storage/cloud-storage", name: "Cloud Storage（デュアルリージョン）", role: "バックアップの保管先。東京が失われてもバックアップは大阪から読める" },
        { icon: "network/cloud-dns", name: "Cloud DNS", role: "障害時の切替手段。TTL（キャッシュの有効期間）を短めにして切替の浸透を早める" },
        { icon: "compute/cloud-run", name: "Cloud Run", role: "障害時に大阪へ新規デプロイする。平常時は大阪側に存在せず費用ゼロ" },
        { icon: "database/cloud-sql", name: "Cloud SQL", role: "障害時にバックアップからリストアして再建する" }
      ],
      points: [
        "平常時の追加費用がほぼバックアップ保管料だけという圧倒的な安さがこの構成の存在理由です。DRに割ける予算が小さいなら、まず「バックアップが別リージョンから読める」状態を作ることが第一歩です",
        "RTOはリストアと構築の実測時間で決まります。IaCがなければ当日に手作業で環境を組むことになりRTOが読めなくなるため、この構成はIaC化とセットで初めて成立します",
        "RPOは最後のバックアップ取得時点までです。日次なら最大24時間分の更新を失います。許容できないならバックアップ頻度を上げるか、推奨構成へ進みます",
        "年に1〜2回、実際に大阪へ環境を建ててリストアする訓練を行い、RTOを実測しておくと経営層への説明が具体的になります"
      ],
      pros: [
        "平常時の追加費用がバックアップ保管料程度でほぼゼロ",
        "構成がシンプルで理解しやすく、小さなチームでも維持できる",
        "IaCと訓練さえあれば確実に復旧できる"
      ],
      cons: [
        "RTOが数時間〜1日と長い（構築＋リストア＋DNS浸透の合計）",
        "RPOも最大でバックアップ間隔分（日次なら24時間）と大きい",
        "DNS切替はキャッシュの残留で一部ユーザーの復帰が遅れる"
      ],
      cost: "<strong>月数百円〜数千円の上乗せ</strong>（1USD=150円換算）。デュアルリージョンGCSのバックアップ保管料が中心です。障害時のみ大阪側の環境費用が一時的に発生します。DR訓練の際の一時環境費用（数時間分）も年間予算に入れておくと運用が回ります。",
      references: [
        { title: "障害復旧計画ガイド", url: "https://cloud.google.com/architecture/dr-scenarios-planning-guide?hl=ja", note: "コールド/ウォーム/ホットの段階の整理" },
        { title: "Cloud SQLのバックアップの概要", url: "https://cloud.google.com/sql/docs/mysql/backup-recovery/backups?hl=ja" },
        { title: "Cloud DNSのドキュメント", url: "https://cloud.google.com/dns/docs?hl=ja" }
      ]
    },
    {
      name: "アクティブ/アクティブ構成（Spanner）",
      when: "RTO・RPOをほぼゼロにしたい場合や、決済・金融のように停止もデータ損失も許されない場合",
      diagram: {
        cols: 4, rows: 3,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [3, 2] },
          { type: "region", label: "東京リージョン", from: [2, 0], to: [2, 0], depth: 1 },
          { type: "region", label: "大阪リージョン", from: [2, 2], to: [2, 2], depth: 1 }
        ],
        nodes: [
          { id: "users", icon: "client/users", label: "ユーザー", col: 0, row: 1 },
          { id: "lb", icon: "network/cloud-load-balancing", label: "Cloud LB\nグローバル", col: 1, row: 1 },
          { id: "runa", icon: "compute/cloud-run", label: "Cloud Run\n常時稼働", col: 2, row: 0 },
          { id: "runb", icon: "compute/cloud-run", label: "Cloud Run\n常時稼働", col: 2, row: 2 },
          { id: "spn", icon: "database/spanner", label: "Spanner\nマルチリージョン", col: 3, row: 1 }
        ],
        edges: [
          { from: "users", to: "lb", label: "HTTPS" },
          { from: "lb", to: "runa", label: "東京圏から" },
          { from: "lb", to: "runb", label: "関西圏から" },
          { from: "runa", to: "spn", label: "読み書き" },
          { from: "runb", to: "spn", label: "読み書き" }
        ]
      },
      flow: [
        "両リージョンのCloud Runが常時本番トラフィックを処理し、グローバルLBがユーザーの近い側へ振り分ける",
        "DBはマルチリージョン構成のSpannerを使う。書き込みは複数リージョンへ同期的に複製されてから確定するため、リージョンが1つ失われてもデータは失われない",
        "リージョン障害時はLBが自動で健全な側へ全トラフィックを寄せる。DBの昇格作業も接続切替も不要",
        "利用者から見ると「少し遅くなったが止まらなかった」という体験になる"
      ],
      services: [
        { icon: "database/spanner", name: "Spanner（マルチリージョン構成）", role: "同期複製で強整合性を保つ分散DB。リージョン障害でもRPOゼロ・自動継続を実現する要" },
        { icon: "compute/cloud-run", name: "Cloud Run（両リージョン常時稼働）", role: "どちらのリージョンも本番として動く。待機系という概念がなくなる" },
        { icon: "network/cloud-load-balancing", name: "Cloud Load Balancing（グローバル）", role: "近接ルーティングと自動フェイルオーバー。単一のIPで両リージョンを束ねる" }
      ],
      points: [
        "この構成の本質は「切り替える」のではなく「最初から両方で動いている」ことです。フェイルオーバーの手順・訓練・昇格の判断が不要になり、DRが特別なイベントでなくなります",
        "Spannerの同期複製は書き込み確定に複数リージョンの合意を待つため、書き込みレイテンシは単一リージョンDBより増えます。性能特性が変わることをアプリ設計の段階から織り込みます",
        "Cloud SQLからSpannerへは互換の移行ではなく、スキーマ・クエリの書き直しを伴う載せ替えです。DR目的だけでの移行は重い決断なので、スケーラビリティ要件（ケース9やケース13）と合わせて判断します",
        "コストは段違いに上がります。「止まると1時間あたりいくら失うか」を数字にし、それと比べて初めて妥当性を判断できます"
      ],
      pros: [
        "RPOほぼゼロ・RTOほぼゼロ（データを失わず、切替作業も自動）",
        "フェイルオーバー手順や昇格判断という人間の作業が構造的に不要",
        "平常時から両リージョンが稼働するため、DR構成が「使われていないのに壊れている」事態が起きない"
      ],
      cons: [
        "Spannerマルチリージョン構成は高価で、小規模サービスには過剰投資になりやすい",
        "Cloud SQLからの移行はアプリの書き直しを伴う大工事",
        "同期複製のぶん書き込みレイテンシが増える"
      ],
      cost: "<strong>月十数万円〜</strong>（1USD=150円換算）。Spannerのマルチリージョン構成は最小規模でも月10万円を超え、性能を確保するノード数に応じて増えます。両リージョンのCloud RunとグローバルLBが加わります。決済停止の損失が時間あたり数百万円というようなサービスで初めて割に合う水準です。",
      references: [
        { title: "Spannerのインスタンス構成", url: "https://cloud.google.com/spanner/docs/instance-configurations?hl=ja", note: "マルチリージョン構成の説明" },
        { title: "Spannerのドキュメント", url: "https://cloud.google.com/spanner/docs?hl=ja" },
        { title: "障害復旧計画ガイド", url: "https://cloud.google.com/architecture/dr-scenarios-planning-guide?hl=ja" }
      ]
    }
  ],
  cost: "<p>コールドDRは<strong>月数百円〜数千円</strong>、ウォームスタンバイ（推奨）は<strong>月3万円〜10万円程度（現行の1.5〜2倍）</strong>、アクティブ/アクティブは<strong>月十数万円〜</strong>。東京・大阪リージョン、1USD=150円前提の目安です。RTO・RPOを1桁縮めるごとにコストも1桁近く増える、という比例関係を経営層と共有することがDR計画の出発点になります。</p>",
  summary: "<p>DRは「やる・やらない」ではなく<strong>段階の選択</strong>です。バックアップを別リージョンに置くだけのコールド、待機系を絞って持つウォーム、両方が本番のアクティブ/アクティブと、RTO・RPOの要件に応じて階段を上ります。GCPではグローバルLB（DNS切替不要のフェイルオーバー）とSpanner（同期複製でRPOゼロ）という独自の武器が上位の段を支えています。どの段でも共通する成功条件は、IaC化（ケース44）と定期的な切替訓練です。バックアップ体系そのものはケース48、世界展開でのマルチリージョンはケース6を参照してください。</p>",
  quiz: [
    {
      q: "DNSの切り替えでフェイルオーバーする方式に比べ、GCPのグローバルLBによる切替には構造的な利点があります。それは何でしょうか。",
      a: "グローバルLBは世界共通のエニーキャストIPで受けており、リージョンの切替はLBの内側の経路変更として行われるため、ユーザー側やDNSキャッシュには何の変更も見えないことです。DNS切替方式では、レコードを書き換えても各地のリゾルバがキャッシュを保持している間は古い宛先へ向かい続け、TTLを短くしてもなお切替の浸透に時間差が残ります。切替を「自分の管理下にある層」で行えるかどうかが、両者の本質的な違いです。"
    },
    {
      q: "ウォームスタンバイ構成で東京リージョンの障害が起きたとき、失われる可能性があるデータはどの部分でしょうか。またそれを完全になくすには何が必要でしょうか。",
      a: "Cloud SQLのクロスリージョンレプリケーションは非同期のため、障害の瞬間にまだ大阪へ複製されていなかった直近数秒〜数十秒分の書き込みが失われ得ます。これがこの構成のRPOです。完全になくすには書き込みの確定時点で複数リージョンへの複製を待つ同期複製が必要で、GCPではSpannerのマルチリージョン構成がそれにあたります。ただしコストと書き込みレイテンシが大きく増えるため、失われる数十秒に見合う価値があるかで判断します。"
    },
    {
      q: "あなたは月商500万円のECサイトの担当者で、DR予算はほとんどありません。まず何から始めますか。",
      a: "最初の一歩は、バックアップをデュアルリージョンのCloud Storageに置き、インフラをIaCでコード化することです。これで費用は月数千円のまま「東京が失われてもデータと構成情報は生きている」状態になり、コールドDRが成立します。次に大阪でのリストア訓練を行いRTOを実測し、その数字（例えば復旧まで8時間＝機会損失いくら）を経営層に示して、ウォームスタンバイへ投資するかを事業の数字で判断してもらいます。技術で先に答えを出さず、段階と金額の対応表を示すのが担当者の仕事です。"
    }
  ]
});
