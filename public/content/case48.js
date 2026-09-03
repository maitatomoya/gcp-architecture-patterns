// ケース48：バックアップ・データ保護
registerCase({
  id: 48,
  category: "運用・セキュリティ・信頼性",
  title: "バックアップ・データ保護",
  scenario: "<p>中堅企業の業務システムをGCPで運用しています。構成はCompute Engine上の業務サーバー数台、Cloud SQLの基幹データベース、Cloud Storageの帳票・ファイル置き場です。先日、運用メンバーの誤操作で本番テーブルを消しかけるヒヤリハットが起き、さらにランサムウェア（データを暗号化して身代金を要求する攻撃）の報道を受けて、経営層から「確実に戻せるバックアップ体制を作れ」と指示が出ました。</p><p>バックアップ設計では2つの指標を使います。<strong>RPO</strong>（目標復旧時点：どこまでのデータ損失を許容するか）と<strong>RTO</strong>（目標復旧時間：どれだけの停止を許容するか）です。この2つを決めてから手段を選ぶのが正しい順序です。</p>",
  requirements: [
    "誤削除・誤更新から数分前の状態に戻せるようにしたい（RPOを短く）",
    "VM・データベース・ファイルのそれぞれに合った方法で守りたい",
    "ランサムウェアに暗号化・削除されない置き場にバックアップを残したい",
    "バックアップの取得を人手に頼らず自動化したい",
    "保管コストは用途に応じて最適化したい"
  ],
  main: {
    name: "3層バックアップ体系（Backup and DR+Cloud SQL自動バックアップ+GCSバージョニング）",
    diagram: {
      cols: 4, rows: 3,
      groups: [
        { type: "gcp-cloud", label: "Google Cloud", from: [0, 0], to: [3, 2] }
      ],
      nodes: [
        { id: "gce", icon: "compute/compute-engine", label: "Compute Engine\n業務サーバー", col: 0, row: 0 },
        { id: "sql", icon: "database/cloud-sql", label: "Cloud SQL\n基幹DB", col: 0, row: 1 },
        { id: "gcs", icon: "storage/cloud-storage", label: "Cloud Storage\n帳票・ファイル", col: 0, row: 2 },
        { id: "bdr", icon: "storage/backup-dr", label: "Backup and DR\nバックアップ保管庫", col: 2, row: 0 },
        { id: "gcsx", icon: "storage/cloud-storage", label: "Cloud Storage\n長期エクスポート", col: 2, row: 1 },
        { id: "arch", icon: "storage/cloud-storage", label: "アーカイブクラス\n低頻度保管", col: 2, row: 2 },
        { id: "kms", icon: "security/cloud-kms", label: "Cloud KMS\n暗号鍵の管理", col: 3, row: 1 }
      ],
      edges: [
        { from: "gce", to: "bdr", label: "日次バックアップ" },
        { from: "sql", to: "gcsx", label: "定期エクスポート" },
        { from: "gcs", to: "arch", label: "ライフサイクル移行" },
        { from: "kms", to: "bdr", noArrow: true, dashed: true },
        { from: "kms", to: "gcsx", noArrow: true, dashed: true },
        { from: "kms", to: "arch", noArrow: true, dashed: true }
      ]
    },
    flow: [
      "Compute EngineのVMはBackup and DRサービスが日次でバックアップし、専用の保管庫（バックアップボールト）に保存する。保管庫は本番側の認証情報では削除できないよう保護されている",
      "Cloud SQLは組み込みの自動バックアップとPITR（ポイントインタイムリカバリ：任意の時点へ巻き戻す機能）を有効化する。これで誤削除の数分前に戻れる。図の矢印は加えて行う長期保存用の論理エクスポート",
      "Cloud Storageのバケットはバージョニングを有効化し、上書き・削除しても旧世代が残るようにする。古い世代はライフサイクルルールで低価格なアーカイブクラスへ自動移行する",
      "バックアップデータはすべて暗号化される。鍵の管理をCloud KMSに寄せると、鍵の無効化で全体を読めなくする、といった統制も効かせられる"
    ],
    services: [
      { icon: "storage/backup-dr", name: "Backup and DR Service", role: "VMなどのバックアップを一元管理するマネージドサービス。スケジュール・保持期間・保管庫の保護までを担う" },
      { icon: "database/cloud-sql", name: "Cloud SQL（自動バックアップ+PITR）", role: "DB自身が持つ復旧機能。日次バックアップとトランザクションログで任意時点へ戻せる" },
      { icon: "storage/cloud-storage", name: "Cloud Storage（バージョニング/ライフサイクル）", role: "オブジェクトの世代管理と、古い世代の低コストクラスへの自動移行" },
      { icon: "security/cloud-kms", name: "Cloud KMS", role: "暗号鍵の生成・保管・権限管理。バックアップの暗号化と鍵の統制を担う" },
      { icon: "compute/compute-engine", name: "Compute Engine", role: "保護対象の業務サーバー。ディスクの中身ごとバックアップされる" }
    ],
    points: [
      "対象ごとに最適な手段が違うのが要点です。VMは丸ごと（Backup and DR）、DBはトランザクションを壊さない専用機能（自動バックアップ+PITR）、ファイルは世代管理（バージョニング）と、性質に合わせて使い分けます",
      "ランサムウェア対策の核心は「本番を消せる権限ではバックアップを消せない」分離です。Backup and DRの保管庫が別管理になっているのはこのためで、バックアップを本番と同じ場所・同じ権限の下に置くのは対策になりません",
      "バックアップは「取れていること」ではなく「戻せること」が目的です。リストア手順を文書化し、年に数回は実際に復元してみる訓練までを設計に含めます",
      "PITRと日次バックアップの違いを理解しておきます。日次だけならRPOは最大24時間ですが、PITRを有効にすればRPOは数分になります。基幹DBでは原則PITRを有効にします"
    ],
    pros: [
      "3種類のデータすべてを自動・無人でバックアップできる",
      "PITRとバージョニングにより誤操作から数分前の状態へ戻れる（RPOが短い）",
      "保管庫の削除保護によりランサムウェア・内部不正への耐性がある",
      "ライフサイクル管理で長期保管のコストを自動で最適化できる"
    ],
    cons: [
      "バックアップの保管容量に応じた継続コストがかかる（保持期間×容量の設計が必要）",
      "Backup and DRやPITRを有効にするだけでは復旧はできない。リストア手順の整備と訓練という運用の仕事が残る",
      "PITRはトランザクションログの保存分だけ追加コストとストレージを消費する",
      "リージョン障害への備えはこの構成だけでは不十分（ケース49のDR設計が別途必要）"
    ],
    cost: "<strong>月数千円〜数万円</strong>が目安（東京リージョン、1USD=150円換算）。支配的なのは保管容量で、例えばVMバックアップ500GiB＋DBバックアップ100GiB＋GCS旧世代200GiB程度なら月1万円前後に収まることが多いです。Cloud Storageはクラスで単価が大きく変わり、Standardが1GiBあたり月約3.5円に対しArchiveは約0.4円です。保持期間を伸ばすほど線形に増えるため、「何世代・何日分残すか」がコスト設計そのものになります。",
    references: [
      { title: "Backup and DR Serviceのドキュメント", url: "https://cloud.google.com/backup-disaster-recovery/docs?hl=ja", note: "保管庫の保護機能もここで確認できる" },
      { title: "Cloud SQLのバックアップの概要", url: "https://cloud.google.com/sql/docs/mysql/backup-recovery/backups?hl=ja" },
      { title: "ポイントインタイムリカバリ（PITR）", url: "https://cloud.google.com/sql/docs/mysql/backup-recovery/pitr?hl=ja", note: "任意時点への復旧の仕組み" },
      { title: "オブジェクトのバージョニング", url: "https://cloud.google.com/storage/docs/object-versioning?hl=ja" },
      { title: "オブジェクトのライフサイクル管理", url: "https://cloud.google.com/storage/docs/lifecycle?hl=ja", note: "旧世代の自動アーカイブ設定" }
    ]
  },
  alternatives: [
    {
      name: "内蔵機能だけで組む最小構成",
      when: "小規模でコストを最優先する場合や、専用サービスの導入前にまず土台を固める場合",
      diagram: {
        cols: 3, rows: 3,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [0, 0], to: [2, 2] }
        ],
        nodes: [
          { id: "gce", icon: "compute/compute-engine", label: "Compute Engine", col: 0, row: 0 },
          { id: "pd", icon: "storage/persistent-disk", label: "Persistent Disk\nデータディスク", col: 1, row: 0 },
          { id: "snap", icon: "storage/persistent-disk", label: "スナップショット\n自動保管", col: 2, row: 0 },
          { id: "sql", icon: "database/cloud-sql", label: "Cloud SQL", col: 0, row: 1 },
          { id: "sqlbk", icon: "database/cloud-sql", label: "自動バックアップ\n7世代保持", col: 2, row: 1 },
          { id: "gcsv", icon: "storage/cloud-storage", label: "Cloud Storage\nバージョニング", col: 0, row: 2 },
          { id: "old", icon: "storage/cloud-storage", label: "旧バージョン\n世代管理", col: 2, row: 2 }
        ],
        edges: [
          { from: "gce", to: "pd", noArrow: true, dashed: true },
          { from: "pd", to: "snap", label: "定時スナップショット" },
          { from: "sql", to: "sqlbk", label: "毎日自動取得" },
          { from: "gcsv", to: "old", label: "上書き時に世代保持" }
        ]
      },
      flow: [
        "Compute Engineのディスクにスナップショットスケジュールを設定し、日次で差分スナップショットを自動取得する（差分方式なので2回目以降は容量効率がよい）",
        "Cloud SQLの自動バックアップを有効化し、日次バックアップを7世代程度保持する",
        "Cloud Storageのバケットでバージョニングを有効化し、削除・上書き時に旧世代が自動で残るようにする",
        "いずれもサービスの設定画面（またはIaC）で有効化するだけで、追加のサーバーやジョブは不要"
      ],
      services: [
        { icon: "storage/persistent-disk", name: "Persistent Disk（スナップショットスケジュール）", role: "ディスクの定時スナップショット。Compute Engineに組み込みの機能で追加サービス不要" },
        { icon: "database/cloud-sql", name: "Cloud SQL（自動バックアップ）", role: "設定1つで有効になる日次バックアップ。まず最初に有効化すべき機能" },
        { icon: "storage/cloud-storage", name: "Cloud Storage（バージョニング）", role: "オブジェクト単位の世代管理。誤削除対策の基本" },
        { icon: "compute/compute-engine", name: "Compute Engine", role: "保護対象のサーバー。ディスク単位で守る" }
      ],
      points: [
        "各サービスの内蔵機能だけなら、追加の管理コンポーネントなしで「自動で取れている」状態を今日作れます。バックアップが一切ない状態からの第一歩として最優先です",
        "この構成の弱点は統制の弱さです。バックアップの成否や保持状況がサービスごとにばらけ、本番を操作できる権限でバックアップも消せてしまいます。ランサムウェア耐性が要件になった時点で推奨構成や隔離構成へ進みます",
        "PITRを有効にしていなければRPOは最大24時間です。基幹DBなら最小構成でもPITRだけは有効化する判断が現実的です",
        "バージョニングは放置すると旧世代が無限に溜まります。ライフサイクルルールで世代数や日数の上限を必ずセットにします"
      ],
      pros: [
        "追加サービスなし・設定のみで即日導入できる",
        "コストが最小（差分スナップショットと保持世代分のみ）",
        "IaC（ケース44）に数行足すだけで全環境へ展開できる"
      ],
      cons: [
        "バックアップの管理・監視が対象ごとに分散し、取得失敗に気づきにくい",
        "本番の権限を奪われるとバックアップごと削除され得る（ランサム耐性が低い）",
        "VMの復旧はディスク復元＋再構築の手順が必要で、RTOが読みにくい"
      ],
      cost: "<strong>月数百円〜数千円</strong>（東京リージョン、1USD=150円換算）。スナップショットは1GiBあたり月約4〜7円で差分保存、Cloud SQLバックアップは1GiBあたり月十数円程度、GCS旧世代は選んだクラスの単価に従います。同じデータ量なら推奨構成より安く済みますが、守れる範囲も狭いことを理解して選びます。",
      references: [
        { title: "スケジュールされたスナップショット", url: "https://cloud.google.com/compute/docs/disks/scheduled-snapshots?hl=ja", note: "ディスクの定時自動バックアップ" },
        { title: "Cloud SQLのバックアップの概要", url: "https://cloud.google.com/sql/docs/mysql/backup-recovery/backups?hl=ja" },
        { title: "オブジェクトのライフサイクル管理", url: "https://cloud.google.com/storage/docs/lifecycle?hl=ja", note: "旧世代の上限設定に必須" }
      ]
    },
    {
      name: "別プロジェクト隔離バックアップ構成",
      when: "ランサムウェアや内部不正への耐性を最大化したい場合、規制で本番と分離した保管が求められる場合",
      diagram: {
        cols: 5, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [4, 1] },
          { type: "project", label: "本番プロジェクト", from: [2, 0], to: [2, 1], depth: 1 },
          { type: "project", label: "バックアップ専用", from: [4, 0], to: [4, 1], depth: 1 }
        ],
        nodes: [
          { id: "threat", icon: "client/internet", label: "誤削除・攻撃\n（脅威）", col: 0, row: 0 },
          { id: "sql", icon: "database/cloud-sql", label: "Cloud SQL\n本番DB", col: 2, row: 0 },
          { id: "gcs", icon: "storage/cloud-storage", label: "Cloud Storage\n本番データ", col: 2, row: 1 },
          { id: "bkt", icon: "storage/cloud-storage", label: "Cloud Storage\n隔離バックアップ", col: 4, row: 0 },
          { id: "kms", icon: "security/cloud-kms", label: "Cloud KMS\n別管理の鍵", col: 4, row: 1 }
        ],
        edges: [
          { from: "threat", to: "sql", label: "誤削除・侵害", dashed: true },
          { from: "sql", to: "gcs", label: "エクスポート" },
          { from: "gcs", to: "bkt", label: "日次プル転送" },
          { from: "kms", to: "bkt", noArrow: true, dashed: true }
        ]
      },
      flow: [
        "本番プロジェクトでは、Cloud SQLのデータを定期的にCloud Storageの本番バケットへエクスポートする",
        "バックアップ専用プロジェクト側からStorage Transfer Serviceで日次のプル型転送を行い、隔離バケットへ複製する。本番側にはバックアップ先への書き込み・削除権限を一切与えない",
        "隔離バケットには保持ポリシー（一定期間は誰も削除できないロック）を設定し、鍵も別管理のCloud KMSで統制する",
        "本番が侵害・暗号化されても、攻撃者の手にある認証情報では隔離側に到達できないため、バックアップから復旧できる"
      ],
      services: [
        { icon: "ops/resource-manager", name: "プロジェクト分離（Resource Manager）", role: "本番とバックアップでIAMの境界を分ける土台。GCPではプロジェクトが権限分離の基本単位" },
        { icon: "storage/storage-transfer", name: "Storage Transfer Service", role: "バケット間の大量データ転送をマネージドに実行する。プル型にすることで本番側へ権限を渡さない" },
        { icon: "storage/cloud-storage", name: "Cloud Storage（保持ポリシー）", role: "隔離バックアップの保管先。保持ポリシーのロックで期間内の削除を不可能にする" },
        { icon: "security/cloud-kms", name: "Cloud KMS", role: "隔離側専用の鍵管理。本番の管理者とは別の管理者が握る" }
      ],
      points: [
        "バックアップの3-2-1ルール（3コピー・2種類の媒体・1つは別の場所）の「別の場所」を、GCPではプロジェクト分離＋別リージョンで実現します。物理的な距離だけでなく権限の距離を取るのが要点です",
        "転送をプッシュ型（本番→隔離へ書き込む）にすると、本番の認証情報が隔離側への入口になってしまいます。プル型（隔離側が取りに行く）にする方向の違いが、そのままランサム耐性の違いになります",
        "保持ポリシーをロックすると、管理者でも期間内は削除できなくなります。強力な保護である反面、設定ミスも取り消せないため、期間は慎重に決めます",
        "この隔離構成は最重要データに絞って適用し、全データは推奨構成で守る、という組み合わせがコストと安全のバランスとして現実的です"
      ],
      pros: [
        "本番の全権限を奪われてもバックアップが生き残る（ランサム耐性が最も高い）",
        "保持ポリシーのロックで内部不正・操作ミスによる削除も防げる",
        "監査・規制対応で「分離された保管」を明確に説明できる"
      ],
      cons: [
        "プロジェクト・権限・転送ジョブの設計と運用が増え、構成が複雑になる",
        "データが二重三重に保管されるため、容量コストも複数倍になる",
        "復旧時はプロジェクトをまたいだリストア手順になり、訓練なしではRTOが伸びやすい"
      ],
      cost: "<strong>月数千円〜数万円の上乗せ</strong>（東京リージョン、1USD=150円換算）。隔離側の保管容量が主で、リージョン内の転送であれば転送料は小さく抑えられます。隔離側をNearline等の低頻度クラスにすれば、例えば1TiBの隔離保管でも月2,000円前後からに収まります。最重要データに絞るほど効率が上がります。",
      references: [
        { title: "Storage Transfer Serviceの概要", url: "https://cloud.google.com/storage-transfer/docs/overview?hl=ja", note: "プル型転送の実現手段" },
        { title: "バケットロックと保持ポリシー", url: "https://cloud.google.com/storage/docs/bucket-lock?hl=ja", note: "期間内削除を不可能にする仕組み" },
        { title: "顧客管理の暗号鍵（CMEK）", url: "https://cloud.google.com/storage/docs/encryption/customer-managed-keys?hl=ja", note: "鍵を自分で統制する方法" }
      ]
    }
  ],
  cost: "<p>推奨構成は<strong>月数千円〜数万円</strong>（保管容量×保持期間が支配的）。内蔵機能のみの最小構成は<strong>月数百円〜数千円</strong>、別プロジェクト隔離は最重要データ分の<strong>上乗せ数千円〜</strong>。東京リージョン・1USD=150円前提の目安です。コストは「何をどこまで守るか」の意思決定そのものなので、データを重要度で分類してから金額を見積もります。</p>",
  summary: "<p>バックアップ設計の順序は、まずRPO・RTOを決め、次に対象ごとの手段（VMは保管庫へ、DBは自動バックアップ+PITR、ファイルはバージョニング）を選び、最後にランサム耐性のための<strong>権限の分離</strong>（消せる人とバックアップを守る人を分ける）を組み込む、という3段階です。そして忘れてはならないのが「戻せることの確認」で、リストア訓練までがバックアップです。誤削除対策のこのケースに対し、リージョン障害でも止めない構成はケース49、暗号鍵そのものの管理はケース50で扱います。</p>",
  quiz: [
    {
      q: "Cloud Storageのバージョニングを有効にしていれば誤削除には対応できます。それでもなお、別プロジェクトへの隔離バックアップが必要になるのはどんな脅威を想定したときでしょうか。",
      a: "本番プロジェクトの管理者権限そのものが奪われる、または悪用される脅威です。バージョニングの旧世代は同じバケット・同じ権限の中にあるため、権限を握った攻撃者や悪意ある内部者はバケットごと削除できます。別プロジェクトに権限を分離し、プル型転送と保持ポリシーのロックを組み合わせて初めて「本番の全権限を失ってもバックアップは残る」状態になります。守る相手が操作ミスなのか権限の侵害なのかで、必要な構えが変わるのです。"
    },
    {
      q: "基幹DBのバックアップを「日次の自動バックアップのみ」で運用した場合、最悪でどれだけのデータを失いますか。またPITRを有効にすると何が変わるでしょうか。",
      a: "日次のみの場合、障害の直前まで丸1日分の更新が失われ得るため、RPOは最大24時間です。PITRを有効にするとトランザクションログが継続的に保存され、たとえば「誤削除の1分前」のような任意の時点へ巻き戻せるようになり、RPOは数分まで縮みます。基幹DBのように更新を失えない用途では、追加のログ保存コストを払ってでもPITRを有効にする判断が定石です。"
    },
    {
      q: "あなたのチームはバックアップを毎日自動取得しており、監視でも成功が確認できています。それでも本番障害の当日に復旧できないとしたら、何が欠けていた可能性が高いでしょうか。",
      a: "リストアの検証と手順の整備です。バックアップが成功していても、いざ戻す段になると、手順が文書化されていない、リストア先の環境が用意できない、世代の選び方が分からない、想定よりリストアに時間がかかる、といった問題が当日に噴出しがちです。定期的に実際の復元訓練を行い、RTOを実測して手順を磨いておくことまでがバックアップ設計の範囲です。「取れている」と「戻せる」の間には運用の溝があります。"
    }
  ]
});
