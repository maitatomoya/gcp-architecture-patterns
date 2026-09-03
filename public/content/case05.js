// ケース5：ライブ配信
registerCase({
  id: 5,
  category: "Webサイト・配信",
  title: "ライブ配信",
  scenario: "<p>セミナーやカンファレンスのライブ配信サービスを作りたい。配信は月に数回、1回あたり2時間程度で、同時視聴者は数百人のときもあれば、注目イベントでは数万人に達する。配信当日以外はほぼ稼働しない。終了後はアーカイブを自動でVOD公開したい。視聴は一方向で、数十秒程度の遅延は許容できる。</p>",
  requirements: [
    "配信当日だけ大きなキャパシティが必要（普段はほぼゼロ）",
    "視聴者数が事前に読めなくても映像を途切れさせない",
    "配信終了後は自動でアーカイブをVOD化したい",
    "配信の開始・終了をアプリから制御し、状態変化を通知したい",
    "遅延は数十秒まで許容（超低遅延は必須ではない）"
  ],
  main: {
    name: "Live Stream API+Media CDN構成",
    diagram: {
      cols: 4, rows: 3,
      groups: [
        { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [3, 2] }
      ],
      nodes: [
        { id: "streamer", icon: "client/client", label: "配信者\nエンコーダー", col: 0, row: 0 },
        { id: "live", icon: "compute/live-stream-api", label: "Live Stream API\nHLS変換", col: 1, row: 0 },
        { id: "gcs", icon: "storage/cloud-storage", label: "Cloud Storage\n配信セグメント", col: 3, row: 0 },
        { id: "ps", icon: "integration/pubsub", label: "Pub/Sub\n運用イベント", col: 1, row: 1 },
        { id: "run", icon: "compute/cloud-run", label: "Cloud Run\n管理・通知", col: 2, row: 1 },
        { id: "viewer", icon: "client/users", label: "視聴者", col: 0, row: 2 },
        { id: "mcdn", icon: "network/media-cdn", label: "Media CDN\nライブ配信", col: 3, row: 2 }
      ],
      edges: [
        { from: "streamer", to: "live", label: "RTMP/SRT送信" },
        { from: "live", to: "gcs", label: "HLS書き出し" },
        { from: "live", to: "ps" },
        { from: "ps", to: "run", label: "プッシュ" },
        { from: "run", to: "live", label: "チャンネル制御", dashed: true },
        { from: "mcdn", to: "gcs", label: "オリジン取得" },
        { from: "viewer", to: "mcdn", label: "HTTPS視聴" }
      ]
    },
    flow: [
      "配信者はOBSなどのエンコーダーから、RTMP/SRTプロトコルでLive Stream APIのチャンネルへ映像を送ります",
      "Live Stream APIが映像を複数画質のHLSセグメント（数秒ごとの細切れファイル）へ変換し、Cloud Storageへ書き出し続けます",
      "視聴者はMedia CDN経由でセグメントを取得して再生します。視聴者が何万人に増えても、オリジンへの負荷はほぼ一定です",
      "チャンネルの状態変化などの運用イベントはPub/Subへ発行され、Cloud Runが受け取って管理画面の更新や通知を行います",
      "Cloud Runの管理APIがチャンネルの作成・開始・停止を制御します。終了後はCloud Storageに残ったセグメントがそのままアーカイブになり、VOD公開に使えます"
    ],
    services: [
      { icon: "compute/live-stream-api", name: "Live Stream API", role: "ライブ映像の受信と変換のマネージドサービス。RTMP/SRTを受けて複数画質のHLS/DASHへ変換します" },
      { icon: "network/media-cdn", name: "Media CDN", role: "動画配信特化のCDN。ライブのセグメントを世界中のエッジから配信し、視聴急増を吸収します" },
      { icon: "storage/cloud-storage", name: "Cloud Storage", role: "変換されたセグメントの置き場で、配信のオリジン。終了後はそのままアーカイブ保管庫になります" },
      { icon: "integration/pubsub", name: "Pub/Sub", role: "チャンネルの状態変化などのイベントを運ぶメッセージ基盤。管理系との疎結合な連携役です" },
      { icon: "compute/cloud-run", name: "Cloud Run", role: "管理API。チャンネルの制御・イベント処理・視聴ページ向けの情報提供を担います" }
    ],
    points: [
      "HLSのようなセグメント方式は、ライブ映像を「小さなファイルの連続配信」に変換する仕組みです。ファイル配信になった時点でCDNの得意分野になり、視聴者数の増加はCDNが受け止めてくれます",
      "その代償が数十秒の遅延です。セグメントの長さ×バッファぶんの遅れは原理的に避けられないため、遅延要件が1秒未満なら仕組みごと変える必要があります（代替パターン1）",
      "チャンネルは配信のたびに起動し、終了したら止めます。使った時間だけの課金なので、月数回のイベント型という利用パターンと相性が良い構成です",
      "イベント通知をPub/Sub経由にするのは、Live Stream APIと管理アプリを疎結合に保つためです。通知先を増やしたくなっても、購読を足すだけで配信側に手を入れずに済みます"
    ],
    pros: [
      "配信サーバーの容量計画が不要で、視聴者数が読めないイベントに強い",
      "チャンネル稼働時間ぶんの従量課金で、配信が無い日はコストがほぼゼロ",
      "アーカイブが自動的に残り、そのままVOD資産になる",
      "変換・配信ともマネージドで、当日の運用負荷が小さい"
    ],
    cons: [
      "遅延が数十秒あり、オークションやクイズなどリアルタイム対話型には不向き",
      "エンコーダー設定や回線品質など、配信者側（送出側)の知識と準備は必要",
      "視聴者数に比例してCDN配信費用が増える"
    ],
    cost: "<strong>月1万円前後〜</strong>。目安として、チャンネル稼働（HD入力）1時間あたり入力と変換で数十円〜百数十円、配信はMedia CDNの従量課金（1GBあたり数円程度）です。月4回×2時間の配信で延べ視聴5,000時間（約2TB配信）なら月1万円前後の規模感ですが、視聴者数でほぼ決まります（東京リージョン・1USD=150円前後の概算）。",
    references: [
      { title: "Live Stream APIドキュメント", url: "https://cloud.google.com/livestream/docs?hl=ja" },
      { title: "Live Stream APIの概要", url: "https://cloud.google.com/livestream/docs/overview?hl=ja" },
      { title: "Media CDNの概要", url: "https://cloud.google.com/media-cdn/docs/overview?hl=ja" },
      { title: "Pub/Subの概要", url: "https://cloud.google.com/pubsub/docs/overview?hl=ja" }
    ]
  },
  alternatives: [
    {
      name: "GKE+WebRTC（超低遅延・双方向）",
      when: "1秒未満の超低遅延や、視聴者との双方向のやり取りが必要な場合",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [3, 1] },
          { type: "vpc", label: "VPCネットワーク", from: [2, 0], to: [3, 1], depth: 1 },
          { type: "gke-cluster", label: "GKEクラスタ", from: [3, 0], to: [3, 0], depth: 2 }
        ],
        nodes: [
          { id: "streamer", icon: "client/client", label: "配信者", col: 0, row: 0 },
          { id: "viewer", icon: "client/users", label: "視聴者", col: 0, row: 1 },
          { id: "lb", icon: "network/cloud-load-balancing", label: "Cloud LB\nパススルー", col: 1, row: 0 },
          { id: "gke", icon: "compute/gke", label: "GKE\nSFUサーバー", col: 3, row: 0 },
          { id: "mem", icon: "database/memorystore", label: "Memorystore\nセッション状態", col: 2, row: 1 },
          { id: "nat", icon: "network/cloud-nat", label: "Cloud NAT\n外向き通信", col: 3, row: 1 }
        ],
        edges: [
          { from: "streamer", to: "lb", label: "WebRTC配信" },
          { from: "viewer", to: "lb", label: "WebRTC視聴" },
          { from: "lb", to: "gke", label: "転送" },
          { from: "gke", to: "mem", label: "状態共有" },
          { from: "gke", to: "nat", noArrow: true, dashed: true }
        ]
      },
      flow: [
        "配信者と視聴者は、パススルー型のCloud Load Balancing経由でGKE上のSFUへWebRTC接続します",
        "SFU（Selective Forwarding Unit：受け取った映像を各視聴者へ振り分け中継するサーバー）のポッドが映像を中継し、視聴者数に応じてHPAでスケールします",
        "どの視聴者がどのポッドに接続しているかなどのセッション状態はMemorystoreで共有します"
      ],
      services: [
        { icon: "compute/gke", name: "GKE", role: "SFUサーバー群の実行基盤。ポッドの水平スケールで視聴者増に追従します" },
        { icon: "network/cloud-load-balancing", name: "Cloud Load Balancing（パススルー型）", role: "WebRTCのUDPトラフィックを終端せずにSFUへ届ける入口です" },
        { icon: "database/memorystore", name: "Memorystore（Redis）", role: "複数のSFUポッドをまたぐセッション情報の共有役です" },
        { icon: "network/cloud-nat", name: "Cloud NAT", role: "プライベートなGKEノードの外向き通信の出口です" }
      ],
      points: [
        "WebRTCはUDP中心のプロトコルでCDNのキャッシュが効きません。低遅延の代わりに、視聴者数に比例したサーバー帯域とCPUを自分で用意することになります",
        "推奨構成とはコスト構造が逆転します。CDN任せにできない分、数万人規模の一方向配信ではむしろ不利で、少人数の双方向・超低遅延でこそ選ぶ構成です",
        "SFUソフトウェアの選定・チューニング・スケール検証はすべて自前です。GKEの運用スキルに加えて配信ドメインの知識が要求される、難易度の高い構成だと認識しておきます"
      ],
      pros: [
        "遅延を1秒未満にでき、双方向のやり取りが成立する",
        "映像の流し方や品質制御を完全にカスタマイズできる"
      ],
      cons: [
        "サーバー帯域・CPUが視聴者数に比例し、大規模一方向配信ではコストが跳ねる",
        "SFUの運用・スケール設計の難易度が高い",
        "配信が無い期間もクラスタ維持費がかかる（都度構築するなら運用が複雑になる）"
      ],
      cost: "<strong>月10万円程度〜（常設の場合）</strong>。SFUノード数台とMemorystore・LBの常時稼働ぶんが基本で、同時視聴者数に応じてノードを積み増します。イベント時だけ環境を作る運用ならコストは下がりますが、構築・検証の手間と引き換えです（東京リージョン・1USD=150円前後の目安）。",
      references: [
        { title: "GKEの概要", url: "https://cloud.google.com/kubernetes-engine/docs/concepts/kubernetes-engine-overview?hl=ja" },
        { title: "Cloud Load Balancingの概要", url: "https://cloud.google.com/load-balancing/docs/load-balancing-overview?hl=ja", note: "パススルー型を含むLBの種類の整理" },
        { title: "Memorystore for Redisの概要", url: "https://cloud.google.com/memorystore/docs/redis/redis-overview?hl=ja" }
      ]
    },
    {
      name: "Compute Engine1台の簡易配信",
      when: "社内向けなど小規模・単発の配信で、コストと手軽さを最優先する場合",
      diagram: {
        cols: 5, rows: 2,
        groups: [
          { type: "gcp-cloud", label: "Google Cloud", from: [1, 0], to: [4, 1] },
          { type: "vpc", label: "VPC", from: [3, 0], to: [3, 0], depth: 1 }
        ],
        nodes: [
          { id: "streamer", icon: "client/client", label: "配信者\nエンコーダー", col: 0, row: 0 },
          { id: "viewer", icon: "client/users", label: "視聴者", col: 0, row: 1 },
          { id: "lb", icon: "network/cloud-load-balancing", label: "Cloud LB\nHTTPS終端", col: 1, row: 1 },
          { id: "gce", icon: "compute/compute-engine", label: "Compute Engine\n配信サーバー", col: 3, row: 0 },
          { id: "gcs", icon: "storage/cloud-storage", label: "Cloud Storage\nアーカイブ", col: 4, row: 1 }
        ],
        edges: [
          { from: "streamer", to: "gce", label: "RTMP送信" },
          { from: "viewer", to: "lb", label: "HTTPS" },
          { from: "lb", to: "gce", label: "転送" },
          { from: "gce", to: "gcs", label: "アーカイブ保存" }
        ]
      },
      flow: [
        "配信者はVMの外部IPへ直接RTMPで送出します（Nginx+RTMPモジュールなどの配信サーバーを使用）",
        "VMが映像をHLSへ変換し、視聴者はロードバランサー経由でセグメントを取得して再生します",
        "配信終了後、録画ファイルをCloud Storageへ保存してアーカイブにします"
      ],
      services: [
        { icon: "compute/compute-engine", name: "Compute Engine", role: "受信・変換・配信を1台でこなす配信サーバー。イベントのときだけ起動します" },
        { icon: "network/cloud-load-balancing", name: "Cloud Load Balancing", role: "視聴側のHTTPS終端。視聴者が増える見込みならCloud CDNをここに足します" },
        { icon: "storage/cloud-storage", name: "Cloud Storage", role: "録画アーカイブの保存先です" }
      ],
      points: [
        "上限はVM1台の帯域とCPUです。同時視聴が数百人を超える見込みや、失敗できない本番イベントには使いません",
        "このVMはRTMPを直接受ける公開サーバーとして外部IPを持たせるため、Cloud NATは登場しません。ファイアウォールで送出元を絞るのが防御の要です",
        "イベントのときだけVMを起動すれば1回数百円で済みます。まず小さく試し、視聴者が読めなくなってきたら推奨構成へ移行する入口として優秀です"
      ],
      pros: [
        "圧倒的に安く、構成の全体を自分で理解できる",
        "OBSやNginxなど使い慣れたツールをそのまま使える"
      ],
      cons: [
        "VM1台が単一障害点で、落ちれば配信は即停止",
        "視聴者数のスケールに自動では追従できない",
        "配信ソフトの構築・運用・セキュリティ対策が自前"
      ],
      cost: "<strong>1回数百円程度（都度起動）</strong>。e2-standard-2を配信前後の数時間だけ起動する想定です。常時起動でも月1万円前後ですが、ロードバランサーの固定費約2,700円/月が別途かかります（東京リージョン・1USD=150円前後の目安）。",
      references: [
        { title: "Compute Engineの概要", url: "https://cloud.google.com/compute/docs/overview?hl=ja" },
        { title: "Cloud Storageのライフサイクル管理", url: "https://cloud.google.com/storage/docs/lifecycle?hl=ja", note: "アーカイブの保管コスト最適化に" }
      ]
    }
  ],
  cost: "<p>推奨構成は<strong>月1万円前後〜</strong>（月4回×2時間の配信+延べ視聴5,000時間の想定）で、費用は配信時間よりも視聴量に大きく依存します。GKE+WebRTC案は<strong>月10万円程度〜</strong>と桁が変わり、簡易VM案は<strong>1回数百円</strong>で済みます（いずれも東京リージョン・1USD=150円前後の目安）。イベント型の負荷に対して「使うときだけ動く」構成を選べているかが、コスト差の正体です。</p>",
  summary: "<p>ライブ配信の構成は<strong>遅延要件がすべてを決めます</strong>。数十秒許容ならHLS+CDNという「ファイル配信の連続」に変換でき、スケールをCDNへ丸投げできるマネージド構成（Live Stream API+Media CDN）が定石です。1秒未満が必須になった瞬間、CDNが使えないWebRTCの世界に変わり、コストも運用難易度も跳ね上がります。要件を安易に「低遅延」と書かず、本当に必要な遅延を確かめるのが設計の第一歩です。アーカイブのVOD化はケース4、イベント通知の型はケース15とつながっています。</p>",
  quiz: [
    {
      q: "視聴者が想定の10倍の3万人になっても、この推奨構成では配信サーバーの増強が要りません。なぜでしょうか。",
      a: "ライブ映像がHLSセグメントという小さなファイルの連続に変換され、視聴者への配信はすべてMedia CDNのエッジが受け持つからです。オリジンのCloud Storageへ取りに来るのはエッジのキャッシュミスぶんだけなので、視聴者が10倍になってもオリジン負荷はほぼ一定です。Live Stream API側の仕事は入力映像の変換であり、視聴者数の影響を受けません。"
    },
    {
      q: "要件が変わり「遅延1秒未満」が必須になりました。あなたなら構成をどう変え、その前に何を確認しますか。",
      a: "HLS+CDNではセグメント方式の原理上数十秒の遅延が残るため、WebRTC（GKE+SFU）の構成へ切り替えることになります。ただしCDNが使えなくなり、コストと運用難易度が桁で上がるため、その前に「なぜ1秒未満が必要か」を確認します。実は視聴者コメントへの反応速度の話で、映像は数十秒遅れでよいと分かるケースも多く、要件の妥当性確認自体が最も費用対効果の高い設計行為です。"
    },
    {
      q: "Live Stream APIの状態変化を、Cloud Runの管理APIが直接ポーリングするのではなくPub/Sub経由で受けるのはなぜでしょうか。",
      a: "配信基盤と管理アプリを疎結合に保つためです。Pub/Subが間にあれば、通知先を増やしたいときも新しい購読を足すだけで済み、管理API側が一時的に落ちていてもメッセージは保持されて取りこぼしを防げます。ポーリングは実装が単純に見えて、間隔ぶんの検知遅れと無駄なリクエストが常に発生します。イベント駆動の型はケース15やケース19で本格的に扱います。"
    }
  ]
});
