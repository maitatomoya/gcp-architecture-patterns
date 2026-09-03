// 用語集：ケースをつまみ食いで読んでも初出の説明に出会えるようにするための索引
// 各用語のcasesは、その用語が実際に登場・解説されているケース番号（1〜50）。
// ケース教材の生成が進んだら、後続エージェントがcasesの番号と用語を追記・調整すること
registerGlossary({
  tocTitle: "用語集",
  groups: [
    {
      name: "GCPの基本",
      terms: [
        {
          term: "プロジェクト",
          full: "Project",
          desc: "GCPのリソース・IAM・請求をまとめる入れ物です。AWSのアカウントに近い役割を1つの組織の中で気軽に増やせるのが特徴で、本番・検証・開発をプロジェクトごと分けるのがGCP流の環境分離です。構成図ではグレーの実線枠で描きます。",
          cases: [37, 44]
        },
        {
          term: "リージョンとゾーン",
          full: "Region / Zone",
          desc: "リージョンは地理的な拠点（例：東京=asia-northeast1）、ゾーンはその中の独立した区画です。ゾーン障害に耐えるにはマルチゾーン、リージョン障害に耐えるにはマルチリージョンに分散します。構成図ではそれぞれ青・薄青の破線枠で描きます。",
          cases: [49]
        },
        {
          term: "マネージドサービス",
          full: "Managed Service",
          desc: "サーバーの保守・パッチ当て・バックアップといった運用をGoogleが代わりに引き受けてくれるサービス形態です。運用人員が少ないほどマネージド度の高いサービスを選ぶのが定石で、この教材の全ケースを貫く判断軸のひとつです。",
          cases: [7, 14]
        },
        {
          term: "サーバーレス",
          full: "Serverless",
          desc: "リクエストが来たときだけ動き、使った分だけ課金される実行形態です。GCPではCloud Run・Cloud Functions・BigQueryなどが代表で、アイドル時のコストをほぼゼロにできます。常時起動のVM（Compute Engine）と対になる概念です。",
          cases: [7, 14, 16]
        }
      ]
    },
    {
      name: "ネットワーク",
      terms: [
        {
          term: "VPCネットワーク",
          full: "Virtual Private Cloud",
          desc: "GCPの中に作る自分専用の仮想ネットワークです。AWSと違いリージョンをまたいで1つのVPCを張れる（グローバルVPC）のが大きな特徴で、サブネットはリージョン単位で切ります。構成図では緑の実線枠で描きます。",
          cases: [32, 33]
        },
        {
          term: "Cloud NAT",
          full: "Cloud NAT",
          desc: "外部IPを持たないVMやGKEノードから、外向きの通信だけをインターネットへ出すためのマネージドNATです。外から中への接続は通せない片道通行なので、内部リソースを隠したまま外部APIやパッケージ取得が使えます。",
          cases: [32]
        },
        {
          term: "Cloud Load Balancing",
          full: "Cloud Load Balancing",
          desc: "リクエストを複数のサーバーへ振り分ける仕組みです。GCPの外部アプリケーションロードバランサは単一のグローバルIPで世界中から受けられるのが特徴で、Cloud CDNやCloud Armorと組み合わせて入口を固めます。",
          cases: [3, 49]
        },
        {
          term: "限定公開アクセス",
          full: "Private Google Access / Private Service Connect",
          desc: "VPC内のリソースが、インターネットを経由せずGoogleのAPIやマネージドサービスへ届くための仕組みです。閉域要件のある社内システムで「外に出ないままCloud StorageやBigQueryを使う」ために登場します。",
          cases: [32, 35]
        }
      ]
    },
    {
      name: "コンピュート",
      terms: [
        {
          term: "Cloud Run",
          full: "Cloud Run",
          desc: "コンテナを渡すだけでHTTPSの公開・自動スケール・ゼロ台への縮退までやってくれるサーバーレス実行環境です。GCPでWebアプリやAPIを作るときの第一候補で、この教材でも多くのケースの主役になります。",
          cases: [7, 14]
        },
        {
          term: "GKE",
          full: "Google Kubernetes Engine",
          desc: "マネージドのKubernetesです。Cloud Runより自由度が高い分、運用の手間も増えます。ノード管理まで任せられるAutopilotモードと、自分で制御するStandardモードがあります。常時接続や特殊なワークロードで選択肢に上がります。",
          cases: [13, 45]
        },
        {
          term: "コールドスタート",
          full: "Cold Start",
          desc: "サーバーレス環境で、しばらくアクセスがなかったあとの最初のリクエストに起動時間ぶんの遅延が乗る現象です。Cloud Runでは最小インスタンス数を設定して回避できますが、そのぶんアイドル課金が発生するというトレードオフがあります。",
          cases: [14]
        }
      ]
    },
    {
      name: "データ",
      terms: [
        {
          term: "BigQuery",
          full: "BigQuery",
          desc: "サーバーレスのデータウェアハウスです。インフラ管理なしでペタバイト級のSQL分析ができ、GCPを選ぶ最大の理由になることも多い看板サービスです。保存とクエリ処理が分離しており、スキャンした量に応じて課金されます。",
          cases: [20, 21, 22]
        },
        {
          term: "Cloud SQLとSpannerの使い分け",
          full: "Cloud SQL / Spanner",
          desc: "どちらもリレーショナルDBですが、Cloud SQLは「1リージョンで動くマネージドなMySQL/PostgreSQL」、Spannerは「世界規模で分散しても強整合を保つGoogle独自DB」です。規模と可用性要件が小さいうちはCloud SQL、無停止の水平スケールが必須になったらSpannerが定石です。",
          cases: [8, 9]
        },
        {
          term: "Pub/Sub",
          full: "Cloud Pub/Sub",
          desc: "送り手と受け手を疎結合にするメッセージングサービスです。送り手はトピックへ発行するだけ、受け手はサブスクリプション経由で受け取るだけで、お互いを知る必要がありません。イベント駆動・ストリーミング処理・IoT収集の背骨になります。",
          cases: [15, 19, 38]
        }
      ]
    },
    {
      name: "セキュリティ・ID",
      terms: [
        {
          term: "IAM",
          full: "Identity and Access Management",
          desc: "「誰が・どのリソースに・何をできるか」を定義する権限管理の仕組みです。GCPでは組織→フォルダ→プロジェクト→リソースの階層に沿って権限が継承されます。最小権限の原則（必要な権限だけ与える）が全ケース共通の前提です。",
          cases: [37, 50]
        },
        {
          term: "IAP",
          full: "Identity-Aware Proxy",
          desc: "VPNを使わずに、Googleアカウントの認証とIAMの権限チェックで社内システムへのアクセスを制御する仕組みです。「ネットワークの場所」ではなく「誰か」で守るゼロトラストの入口として、社内向けシステムのケースで登場します。",
          cases: [11, 32, 35]
        },
        {
          term: "サービスアカウント",
          full: "Service Account",
          desc: "人間ではなくプログラムやサービスに与えるIDです。Cloud RunからCloud SQLへ接続する、といったサービス間のアクセスはサービスアカウントの権限で制御します。鍵ファイルの発行は漏えいリスクがあるため、GCP内ではIDの紐付けだけで済ませるのが定石です。",
          cases: [50]
        }
      ]
    }
  ]
});
