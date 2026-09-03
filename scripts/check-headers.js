/**
 * グループヘッダー衝突チェック
 *
 * 入れ子グループが同じ角付近から始まると、ヘッダー（グループラベル）同士や
 * ヘッダーと中のノードボックスが重なる。diagram.jsと同じ座標系で全図を機械検査する。
 * GCP版はグループアイコンを使わないため、ヘッダー幅はラベル文字数のみで概算する。
 *
 * 使い方: node scripts/check-headers.js [caseNN.js ...]（省略時は全ケース）
 * ケースファイルが1つも無い段階ではスキップして正常終了する。
 */
const fs = require("fs");
const path = require("path");

const CONTENT = path.join(__dirname, "..", "public", "content");
const COL_W = 170, ROW_H = 150, INSET = 14, PAD = 26;

const issues = [];
const args = process.argv.slice(2);
const files = args.length
  ? args.map((a) => path.basename(a))
  : fs.readdirSync(CONTENT).filter((f) => /^case\d+\.js$/.test(f)).sort();

if (files.length === 0) {
  console.log("検査: 0ファイル（ケースファイルがまだ無いためスキップ）");
  console.log("OK: ヘッダー衝突0件");
  process.exit(0);
}

files.forEach((f) => {
  let c = null;
  global.registerCase = (x) => { c = x; };
  delete require.cache[path.join(CONTENT, f)];
  require(path.join(CONTENT, f));
  [["main", c.main], ...(c.alternatives || []).map((a, i) => ["alt" + (i + 1), a])].forEach(([label, p]) => {
    const gs = (p.diagram.groups || []).map((g) => {
      const d = g.depth || 0;
      return {
        g, d,
        hx: 40 + g.from[0] * COL_W + d * INSET - PAD,
        hy: 30 + g.from[1] * ROW_H + d * INSET - PAD + 14,
      };
    });
    // ヘッダー同士の衝突（ラベル幅は全角換算で概算。アイコンは無いのでラベル幅のみ）
    for (let i = 0; i < gs.length; i++) {
      for (let j = i + 1; j < gs.length; j++) {
        const a = gs[i], b = gs[j];
        const wA = 8 + (a.g.label || "").length * 12;
        const wB = 8 + (b.g.label || "").length * 12;
        if (a.hx < b.hx + wB && b.hx < a.hx + wA && Math.abs(a.hy - b.hy) < 22) {
          issues.push(`${f} ${label}: ヘッダー衝突 「${a.g.label}」×「${b.g.label}」`);
        }
      }
    }
    // ヘッダーがノードボックスと重なる（深い入れ子で起きる）
    gs.forEach((gr) => {
      (p.diagram.nodes || []).forEach((n) => {
        const ix = 40 + n.col * COL_W + COL_W / 2 - 28;
        const iy = 30 + n.row * ROW_H + ROW_H / 2 - 28 - 8;
        const wG = 8 + (gr.g.label || "").length * 11;
        if (gr.hx < ix + 56 && ix < gr.hx + wG && gr.hy + 20 > iy && gr.hy < iy + 56) {
          issues.push(`${f} ${label}: ヘッダー×ノード 「${gr.g.label}」×${n.id}`);
        }
      });
    });
  });
});

console.log(`検査: ${files.length}ファイル`);
issues.forEach((i) => console.log("[ERROR] " + i));
if (issues.length) {
  console.log(`NG: ${issues.length}件`);
  process.exit(1);
}
console.log("OK: ヘッダー衝突0件");
