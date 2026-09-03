/**
 * GCP構成図レンダラー
 *
 * JSON仕様（nodes/groups/edges）からGCP風のSVG構成図を生成する。
 * - GCP公式アイコンは再配布条件の関係で同梱しない。ノードは
 *   「カテゴリ色の角丸ボックス＋略称＋サービス名ラベル」で描画する
 * - ボックスの色はサービスカテゴリ（コンピュート・ストレージ等）ごとに固定
 * - 座標はグリッド指定（1セル=colW x rowH）で、教材データ側の記述を簡単にする
 * - nodes/groups/edgesの仕様はAWS版と同一。iconは「カテゴリ/サービススラッグ」形式
 *
 * 仕様例：
 * {
 *   cols: 6, rows: 3,
 *   nodes: [{id:"users", icon:"client/users", label:"ユーザー", col:0, row:1}],
 *   groups: [{type:"gcp-cloud", from:[1,0], to:[5,2], label:"Google Cloud"}],
 *   edges: [{from:"users", to:"lb", label:"HTTPS"}]
 * }
 */
(function () {
  "use strict";

  var COL_W = 170;
  var ROW_H = 150;
  var ICON = 56;
  var PAD = 26; // グループ枠のグリッドからの内側余白の基準
  var INSET_STEP = 14; // 入れ子1段ごとに枠を内側へ寄せる量

  /**
   * サービスカテゴリの配色（GCPブランド系の色を基準にした本教材独自の凡例）。
   * intro.js（はじめに）の凡例表と同期させること。
   */
  var CATEGORY_COLORS = {
    compute:     { color: "#4285F4", name: "コンピュート" },
    storage:     { color: "#F9AB00", name: "ストレージ" },
    database:    { color: "#EA4335", name: "データベース" },
    network:     { color: "#34A853", name: "ネットワーク" },
    analytics:   { color: "#9334E6", name: "データ分析" },
    integration: { color: "#00897B", name: "連携・メッセージング" },
    ai:          { color: "#E52592", name: "AI・機械学習" },
    ops:         { color: "#5F6368", name: "運用・監視" },
    security:    { color: "#174EA6", name: "セキュリティ・ID" },
    devtools:    { color: "#FA7B17", name: "開発・CI/CD" },
    client:      { color: "#202124", name: "利用者・外部" },
  };

  /**
   * サービススラッグ→ボックス内に表示する略称。
   * ここにあるスラッグだけがiconとして使える（scripts/validate.jsが検証する）。
   * 新しいサービスを使う場合は、このマップとcontent-spec.mdのカタログに追記する。
   */
  var SERVICE_ABBR = {
    // client（利用者・外部）
    "client/users": "User",
    "client/client": "App",
    "client/mobile-client": "Mob",
    "client/internet": "Net",
    "client/office": "Ofc",
    "client/developer": "Dev",
    "client/iot-device": "IoT",
    "client/external-saas": "Ext",
    "client/email": "Mail",
    "client/onprem-server": "Svr",
    // compute（コンピュート）
    "compute/cloud-run": "Run",
    "compute/cloud-run-jobs": "Jobs",
    "compute/compute-engine": "GCE",
    "compute/gke": "GKE",
    "compute/gke-autopilot": "GKE-A",
    "compute/cloud-functions": "Fn",
    "compute/app-engine": "GAE",
    "compute/batch": "Batch",
    "compute/firebase-hosting": "FbH",
    "compute/migrate-to-vms": "M2VM",
    "compute/transcoder-api": "TC",
    "compute/live-stream-api": "Live",
    // storage（ストレージ）
    "storage/cloud-storage": "GCS",
    "storage/filestore": "File",
    "storage/backup-dr": "BDR",
    "storage/storage-transfer": "STS",
    "storage/persistent-disk": "PD",
    // database（データベース）
    "database/cloud-sql": "SQL",
    "database/spanner": "Spnr",
    "database/firestore": "FStr",
    "database/bigtable": "BT",
    "database/alloydb": "Alloy",
    "database/memorystore": "Mem",
    // network（ネットワーク）
    "network/cloud-load-balancing": "LB",
    "network/cloud-cdn": "CDN",
    "network/media-cdn": "MCDN",
    "network/cloud-dns": "DNS",
    "network/cloud-armor": "Armor",
    "network/cloud-nat": "NAT",
    "network/cloud-vpn": "VPN",
    "network/interconnect": "IC",
    "network/cloud-router": "Rtr",
    "network/private-service-connect": "PSC",
    // analytics（データ分析）
    "analytics/bigquery": "BQ",
    "analytics/dataflow": "DFlow",
    "analytics/dataproc": "DProc",
    "analytics/looker": "Look",
    "analytics/looker-studio": "LS",
    "analytics/composer": "Cmp",
    "analytics/dataform": "DFrm",
    "analytics/datastream": "DStr",
    "analytics/dataplex": "DPlex",
    // integration（連携・メッセージング）
    "integration/pubsub": "PubSub",
    "integration/eventarc": "EvArc",
    "integration/cloud-tasks": "Tasks",
    "integration/cloud-scheduler": "Sched",
    "integration/workflows": "Flows",
    "integration/api-gateway": "APIGW",
    "integration/apigee": "Apigee",
    "integration/fcm": "FCM",
    "integration/maps-platform": "Maps",
    // ai（AI・機械学習）
    "ai/vertex-ai": "Vertex",
    "ai/gemini": "Gemini",
    "ai/vertex-ai-search": "Search",
    "ai/vision-api": "Vision",
    "ai/speech-to-text": "STT",
    "ai/text-to-speech": "TTS",
    "ai/translation": "Trnsl",
    "ai/document-ai": "DocAI",
    // ops（運用・監視）
    "ops/cloud-monitoring": "Mon",
    "ops/cloud-logging": "Log",
    "ops/cloud-trace": "Trace",
    "ops/error-reporting": "ErrR",
    "ops/cloud-profiler": "Prof",
    "ops/cloud-billing": "Bill",
    "ops/resource-manager": "ResM",
    // security（セキュリティ・ID）
    "security/iam": "IAM",
    "security/secret-manager": "Secret",
    "security/cloud-kms": "KMS",
    "security/identity-platform": "IdP",
    "security/identity-aware-proxy": "IAP",
    "security/recaptcha": "reCAP",
    "security/security-command-center": "SCC",
    "security/certificate-manager": "Cert",
    "security/vpc-service-controls": "VPCSC",
    "security/workload-identity": "WIF",
    // devtools（開発・CI/CD）
    "devtools/cloud-build": "Build",
    "devtools/artifact-registry": "AR",
    "devtools/cloud-deploy": "Deploy",
    "devtools/infra-manager": "InfM",
  };

  /**
   * グループ枠のスタイル。GCPには公式のグループ描画規定がないため、
   * 本教材独自の配色ルール（intro.jsの凡例と同期）で統一する。
   */
  var GROUP_STYLES = {
    "gcp-cloud":   { color: "#4285F4", dash: null,  fill: "none" },
    "project":     { color: "#5F6368", dash: null,  fill: "none" },
    "region":      { color: "#1A73E8", dash: "6 3", fill: "none" },
    "zone":        { color: "#669DF6", dash: "6 3", fill: "none" },
    "vpc":         { color: "#34A853", dash: null,  fill: "none" },
    "subnet":      { color: "#34A853", dash: null,  fill: "rgba(52,168,83,0.06)" },
    "gke-cluster": { color: "#326CE5", dash: "6 3", fill: "none" },
    "mig":         { color: "#FA7B17", dash: "6 3", fill: "none" },
    "onpremise":   { color: "#7D8998", dash: null,  fill: "none" },
    "external":    { color: "#9AA0A6", dash: "4 3", fill: "none" },
    "generic":     { color: "#7D8998", dash: "4 3", fill: "none" },
  };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /** "#RRGGBB"をrgba()文字列に変換する（ボックスの薄い背景色用） */
  function rgba(hex, alpha) {
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
  }

  /** icon（"カテゴリ/スラッグ"）からカテゴリ定義を引く。不明ならopsのグレーに落とす */
  function categoryOf(icon) {
    var cat = String(icon || "").split("/")[0];
    return CATEGORY_COLORS[cat] || CATEGORY_COLORS.ops;
  }

  /**
   * ボックス内に出す略称。カタログ未登録のスラッグは
   * 単語の頭文字（最大4文字）を大文字で並べた仮の略称で描く。
   */
  function abbrOf(icon) {
    if (SERVICE_ABBR[icon]) return SERVICE_ABBR[icon];
    var slug = String(icon || "").split("/")[1] || "?";
    var words = slug.split("-").filter(Boolean);
    if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
    return words.map(function (w) { return w[0].toUpperCase(); }).join("").slice(0, 4);
  }

  /** 略称の長さに応じたフォントサイズ（56pxボックスに収める） */
  function abbrFont(abbr) {
    if (abbr.length <= 3) return 14;
    if (abbr.length <= 5) return 11.5;
    return 9.5;
  }

  // ノード中心座標（グリッド→px）
  function cx(col) { return 40 + col * COL_W + COL_W / 2; }
  function cy(row) { return 30 + row * ROW_H + ROW_H / 2; }

  /**
   * ノードのシンボル（カテゴリ色の角丸ボックス＋略称）を描く。
   * アイコン画像が使えない前提のフォールバックが標準の描画方式。
   */
  function symbolSvg(icon, x, y, size) {
    var cat = categoryOf(icon);
    var abbr = abbrOf(icon);
    var font = abbrFont(abbr) * (size / ICON);
    return (
      '<rect x="' + x + '" y="' + y + '" width="' + size + '" height="' + size +
      '" rx="' + size * 0.18 + '" fill="' + rgba(cat.color, 0.1) +
      '" stroke="' + cat.color + '" stroke-width="1.8"/>' +
      '<text x="' + (x + size / 2) + '" y="' + (y + size / 2) +
      '" text-anchor="middle" dominant-baseline="central"' +
      ' style="font-size:' + font + 'px;font-weight:700" fill="' + cat.color + '">' +
      esc(abbr) + "</text>"
    );
  }

  function nodeSvg(n) {
    var x = cx(n.col) - ICON / 2;
    var y = cy(n.row) - ICON / 2 - 8;
    var lines = String(n.label || "").split("\n");
    var label = lines.map(function (line, i) {
      return '<tspan x="' + cx(n.col) + '" dy="' + (i === 0 ? 0 : 13) + '">' + esc(line) + "</tspan>";
    }).join("");
    return (
      symbolSvg(n.icon, x, y, ICON) +
      '<text class="dg-label" x="' + cx(n.col) + '" y="' + (y + ICON + 16) +
      '" text-anchor="middle">' + label + "</text>"
    );
  }

  function groupSvg(g, depth) {
    var st = GROUP_STYLES[g.type] || GROUP_STYLES.generic;
    var inset = depth * INSET_STEP;
    var x = 40 + g.from[0] * COL_W + inset - PAD;
    var y = 30 + g.from[1] * ROW_H + inset - PAD + 14;
    var w = (g.to[0] - g.from[0] + 1) * COL_W - inset * 2 + PAD * 2 - 20;
    var h = (g.to[1] - g.from[1] + 1) * ROW_H - inset * 2 + PAD * 2 - 34;
    // GCP版はグループアイコンを使わないため、ヘッダーは色付きラベルのみ
    var labelX = x + 8;
    // ラベルが枠幅に収まるようフォントを段階的に縮小し、
    // それでも収まらない場合はtextLengthで字間を詰めて枠外へのはみ出しを防ぐ
    // （全角文字の幅はほぼフォントサイズと同じとみなして概算する）
    var label = String(g.label || "");
    var avail = w - 16;
    var font = 12;
    if (label.length * font > avail) font = 11;
    if (label.length * font > avail) font = 10;
    var fit = "";
    if (avail > 0 && label.length * font > avail) {
      fit = ' textLength="' + avail + '" lengthAdjust="spacingAndGlyphs"';
    }
    return (
      '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h +
      '" fill="' + (st.fill || "none") + '" stroke="' + st.color + '" stroke-width="1.6"' +
      (st.dash ? ' stroke-dasharray="' + st.dash + '"' : "") + ' rx="2"/>' +
      '<text class="dg-group-label" x="' + labelX + '" y="' + (y + 18) +
      '" style="font-size:' + font + 'px;font-weight:700" fill="' + st.color + '"' + fit + ">" +
      esc(label) + "</text>"
    );
  }

  function edgeSvg(e, nodeMap) {
    var a = nodeMap[e.from];
    var b = nodeMap[e.to];
    if (!a || !b) return "";
    var x1 = cx(a.col), y1 = cy(a.row) - 8;
    var x2 = cx(b.col), y2 = cy(b.row) - 8;
    // ボックスの縁から矢印を出す（中心間ベクトルを縮める）
    var dx = x2 - x1, dy = y2 - y1;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var off = ICON / 2 + 8;
    var sx = x1 + (dx / len) * off, sy = y1 + (dy / len) * off;
    var ex = x2 - (dx / len) * (off + 4), ey = y2 - (dy / len) * (off + 4);
    var mx = (sx + ex) / 2, my = (sy + ey) / 2;
    var dashed = e.dashed ? ' stroke-dasharray="5 4"' : "";
    var marker = e.noArrow ? "" : ' marker-end="url(#dg-arrow)"';
    // 縦向きのエッジはラベルを線の真上に置くと下段ノードのラベルと重なるため、
    // 線の右横に出す。横・斜めのエッジは中点の少し上に置く
    var vertical = Math.abs(dx) < 20;
    var label = "";
    if (e.label) {
      label = vertical
        ? '<text class="dg-edge-label" x="' + (mx + 10) + '" y="' + (my + 4) + '" text-anchor="start">' + esc(e.label) + "</text>"
        : '<text class="dg-edge-label" x="' + mx + '" y="' + (my - 6) + '" text-anchor="middle">' + esc(e.label) + "</text>";
    }
    return (
      '<line x1="' + sx + '" y1="' + sy + '" x2="' + ex + '" y2="' + ey +
      '" stroke="#545B64" stroke-width="1.4"' + dashed + marker + "/>" + label
    );
  }

  /**
   * 構成図SVGを生成する。
   * @param {Object} spec 図のJSON仕様（nodes/groups/edges）
   * @param {string} [title] パターン名。SVGの代替テキスト（aria-label）に使う
   */
  function render(spec, title) {
    var cols = spec.cols || (Math.max.apply(null, spec.nodes.map(function (n) { return n.col; })) + 1);
    var rows = spec.rows || (Math.max.apply(null, spec.nodes.map(function (n) { return n.row; })) + 1);
    var width = 80 + cols * COL_W;
    var height = 70 + rows * ROW_H;

    var nodeMap = {};
    spec.nodes.forEach(function (n) { nodeMap[n.id] = n; });

    var groups = (spec.groups || []).map(function (g, i) {
      return groupSvg(g, g.depth != null ? g.depth : 0);
    }).join("");
    var edges = (spec.edges || []).map(function (e) { return edgeSvg(e, nodeMap); }).join("");
    var nodes = spec.nodes.map(nodeSvg).join("");

    return (
      '<svg class="dg" viewBox="0 0 ' + width + " " + height + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' +
      esc(title ? "構成図：" + title : "GCP構成図") + '">' +
      '<defs><marker id="dg-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">' +
      '<path d="M 0 0 L 10 5 L 0 10 z" fill="#545B64"/></marker></defs>' +
      groups + edges + nodes +
      "</svg>"
    );
  }

  /**
   * 「使うサービス」一覧などで使う小さなバッジSVGを生成する。
   * @param {string} icon "カテゴリ/スラッグ"形式
   * @param {number} [size] 1辺のpx（既定40）
   */
  function badge(icon, size) {
    var s = size || 40;
    return (
      '<svg width="' + s + '" height="' + s + '" viewBox="0 0 ' + s + " " + s +
      '" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      symbolSvg(icon, 0, 0, s) + "</svg>"
    );
  }

  var api = {
    render: render,
    badge: badge,
    CATEGORY_COLORS: CATEGORY_COLORS,
    SERVICE_ABBR: SERVICE_ABBR,
    GROUP_STYLES: GROUP_STYLES,
  };

  if (typeof window !== "undefined") {
    window.GcpDiagram = api;
  }
  // scripts/validate.jsがカタログ（利用可能なicon・グループ種別）を参照するためのエクスポート
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})();
