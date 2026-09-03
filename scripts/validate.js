/**
 * 教材データの機械検証スクリプト
 *
 * 使い方:
 *   node scripts/validate.js                        # public/content/case*.js を全件検証
 *   node scripts/validate.js public/content/case02.js  # 指定ファイルのみ検証
 *
 * 検証内容:
 * - パターン必須フィールド（flow/services/points/cost/pros/cons/references）
 * - iconのカタログ登録チェック（diagram.jsのSERVICE_ABBRに登録済みか）
 * - グループ種別のチェック（diagram.jsのGROUP_STYLESに定義済みか）
 * - 図の構造（ノードID重複・エッジ参照・グリッド範囲・セル重複）
 * - 幾何チェック（エッジが他ノードのボックスを貫通していないか、
 *   ラベル付きエッジの中点が近すぎないか、狭い枠のラベル長）
 * - referencesのURL形式（Google公式ドメインか）
 *
 * ケースファイルが1つも無い段階（土台のみの状態）ではスキップして正常終了する。
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const CONTENT = path.join(ROOT, "public", "content");

// 利用可能なicon・グループ種別のカタログはdiagram.jsから取得する（単一の情報源）
const diagram = require(path.join(ROOT, "public", "diagram.js"));
const SERVICE_ABBR = diagram.SERVICE_ABBR;
const GROUP_STYLES = diagram.GROUP_STYLES;

// diagram.jsと同じ座標系
const COL_W = 170, ROW_H = 150, ICON = 56;
const cx = (c) => 40 + c * COL_W + COL_W / 2;
const cy = (r) => 30 + r * ROW_H + ROW_H / 2;

const errors = [];
const warns = [];

function err(file, msg) { errors.push(`[ERROR] ${file}: ${msg}`); }
function warn(file, msg) { warns.push(`[WARN]  ${file}: ${msg}`); }

/** iconが「カテゴリ/スラッグ」形式でカタログに登録済みかを検証する */
function checkIcon(file, label, icon, where) {
  if (!icon) {
    err(file, `${label}: ${where}のiconがない`);
    return;
  }
  if (!SERVICE_ABBR[icon]) {
    err(file, `${label}: iconがカタログ未登録 "${icon}"（${where}）。` +
      "diagram.jsのSERVICE_ABBRと.tmp/content-spec.mdのカタログに追記するか、登録済みのiconを使う");
  }
}

// 線分(x1,y1)-(x2,y2)と矩形の交差判定
function segIntersectsRect(x1, y1, x2, y2, rx, ry, rw, rh) {
  const left = rx, right = rx + rw, top = ry, bottom = ry + rh;
  const inside = (x, y) => x >= left && x <= right && y >= top && y <= bottom;
  if (inside(x1, y1) || inside(x2, y2)) return true;
  const segs = [
    [left, top, right, top], [right, top, right, bottom],
    [right, bottom, left, bottom], [left, bottom, left, top],
  ];
  const ccw = (ax, ay, bx, by, cx2, cy2) => (cy2 - ay) * (bx - ax) > (by - ay) * (cx2 - ax);
  return segs.some(([ax, ay, bx, by]) =>
    ccw(x1, y1, ax, ay, bx, by) !== ccw(x2, y2, ax, ay, bx, by) &&
    ccw(x1, y1, x2, y2, ax, ay) !== ccw(x1, y1, x2, y2, bx, by));
}

function validatePattern(file, p, label) {
  if (!p.name) err(file, `${label}: nameがない`);
  const required = ["flow", "services", "points", "pros", "cons", "cost", "references"];
  required.forEach((k) => {
    if (!p[k] || (Array.isArray(p[k]) && p[k].length === 0)) {
      err(file, `${label}: 必須フィールド ${k} がない/空`);
    }
  });
  (p.references || []).forEach((r) => {
    if (!r.title || !r.url) err(file, `${label}: referenceにtitle/urlがない`);
    else if (!/^https:\/\/(cloud\.google\.com|firebase\.google\.com|developers\.google\.com)\//.test(r.url)) {
      warn(file, `${label}: Google公式以外のURL ${r.url}`);
    }
  });
  (p.services || []).forEach((s) => {
    checkIcon(file, label, s.icon, `services「${s.name || "?"}」`);
  });
  if (p.diagram) validateDiagram(file, p.diagram, label);
  else err(file, `${label}: diagramがない`);
}

function validateDiagram(file, d, label) {
  const cols = d.cols, rows = d.rows;
  const ids = new Set();
  const cellUsed = new Map();
  (d.nodes || []).forEach((n) => {
    if (ids.has(n.id)) err(file, `${label}: ノードID重複 ${n.id}`);
    ids.add(n.id);
    checkIcon(file, label, n.icon, `node ${n.id}`);
    if (n.col >= cols || n.row >= rows || n.col < 0 || n.row < 0) {
      err(file, `${label}: ノード${n.id}がグリッド外 (${n.col},${n.row}) grid=${cols}x${rows}`);
    }
    const key = n.col + "," + n.row;
    if (cellUsed.has(key)) err(file, `${label}: セル(${key})にノードが重複 ${cellUsed.get(key)}と${n.id}`);
    cellUsed.set(key, n.id);
  });
  (d.groups || []).forEach((g) => {
    if (!GROUP_STYLES[g.type]) {
      err(file, `${label}: グループ種別が未定義 "${g.type}"（利用可能: ${Object.keys(GROUP_STYLES).join(", ")}）`);
    }
    if (g.to[0] >= cols || g.to[1] >= rows) {
      err(file, `${label}: グループ${g.label}がグリッド外`);
    }
    // 1セル幅の入れ子グループはラベル11文字まで（レンダラーの自動縮小＋字間詰めの限界）
    const wCells = g.to[0] - g.from[0] + 1;
    if (wCells === 1 && (g.label || "").length > 11) {
      err(file, `${label}: 1セル幅グループのラベルが長すぎる「${g.label}」（11文字まで）`);
    }
  });
  const nodeMap = {};
  (d.nodes || []).forEach((n) => { nodeMap[n.id] = n; });
  const labelMids = [];
  (d.edges || []).forEach((e) => {
    const a = nodeMap[e.from], b = nodeMap[e.to];
    if (!a) { err(file, `${label}: エッジのfrom不明 ${e.from}`); return; }
    if (!b) { err(file, `${label}: エッジのto不明 ${e.to}`); return; }
    const x1 = cx(a.col), y1 = cy(a.row) - 8, x2 = cx(b.col), y2 = cy(b.row) - 8;
    // 他ノードのボックス貫通チェック
    (d.nodes || []).forEach((n) => {
      if (n.id === e.from || n.id === e.to) return;
      const rx = cx(n.col) - ICON / 2 - 4, ry = cy(n.row) - ICON / 2 - 12;
      if (segIntersectsRect(x1, y1, x2, y2, rx, ry, ICON + 8, ICON + 8)) {
        err(file, `${label}: エッジ${e.from}→${e.to}がノード${n.id}のボックスを貫通`);
      }
    });
    if (e.label) labelMids.push({ e, mx: (x1 + x2) / 2, my: (y1 + y2) / 2 });
  });
  // ラベル付きエッジの中点どうしが近すぎないか
  for (let i = 0; i < labelMids.length; i++) {
    for (let j = i + 1; j < labelMids.length; j++) {
      const A = labelMids[i], B = labelMids[j];
      if (Math.abs(A.mx - B.mx) < 90 && Math.abs(A.my - B.my) < 18) {
        err(file, `${label}: エッジラベル「${A.e.label}」と「${B.e.label}」の中点が近すぎる`);
      }
    }
  }
}

function validateQuiz(file, quiz) {
  if (!quiz || !quiz.length) {
    err(file, "quiz（確認問題）がない");
    return;
  }
  if (quiz.length < 2 || quiz.length > 3) {
    err(file, `quizは2〜3問にする（現在${quiz.length}問）`);
  }
  quiz.forEach((item, i) => {
    if (!item.q || !item.a) err(file, `quiz${i + 1}: q/aがない`);
    if (item.a && item.a.length < 40) err(file, `quiz${i + 1}: 答えの解説が短すぎる`);
  });
}

function validateCase(file, c) {
  ["id", "category", "title", "scenario", "requirements", "main", "summary"].forEach((k) => {
    if (c[k] == null) err(file, `必須フィールド ${k} がない`);
  });
  validateQuiz(file, c.quiz);
  if (c.main) validatePattern(file, c.main, "main");
  if (!c.alternatives || c.alternatives.length === 0) {
    err(file, "alternativesがない（代替パターン1つ以上必須）");
  }
  (c.alternatives || []).forEach((alt, i) => {
    if (!alt.when) err(file, `alt${i + 1}: when（いつ選ぶか）がない`);
    validatePattern(file, alt, `alt${i + 1}`);
  });
}

const args = process.argv.slice(2);
const files = args.length
  ? args.map((a) => path.resolve(a))
  : fs.readdirSync(CONTENT).filter((f) => /^case\d+\.js$/.test(f)).map((f) => path.join(CONTENT, f));

// ケース未生成の段階では検証対象なしとして正常終了する（土台のみの状態を許容）
if (files.length === 0) {
  console.log("検証: 0ファイル（ケースファイルがまだ無いためスキップ）");
  console.log("OK: エラー0件 / 警告0件");
  process.exit(0);
}

let count = 0;
files.forEach((fp) => {
  const name = path.basename(fp);
  let registered = null;
  global.registerCase = (c) => { registered = c; };
  try {
    delete require.cache[fp];
    require(fp);
  } catch (e) {
    err(name, `読み込み失敗: ${e.message}`);
    return;
  }
  if (!registered) { err(name, "registerCaseが呼ばれていない"); return; }
  count++;
  validateCase(name, registered);
});

console.log(`検証: ${count}ファイル`);
warns.forEach((w) => console.log(w));
errors.forEach((e) => console.log(e));
if (errors.length) {
  console.log(`NG: エラー${errors.length}件 / 警告${warns.length}件`);
  process.exit(1);
}
console.log(`OK: エラー0件 / 警告${warns.length}件`);
