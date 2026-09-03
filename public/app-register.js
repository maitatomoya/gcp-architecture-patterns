/**
 * 教材データ登録用のグローバル関数。
 * 各content/caseNN.jsがregisterCase()を呼んでケースを登録する。
 */
window.GCP_CASES = [];
window.GCP_INTRO = null;
window.GCP_RESOURCES = null;
window.GCP_GLOSSARY = null;

function registerCase(c) {
  window.GCP_CASES.push(c);
}

function registerIntro(intro) {
  window.GCP_INTRO = intro;
}

function registerResources(r) {
  window.GCP_RESOURCES = r;
}

function registerGlossary(g) {
  window.GCP_GLOSSARY = g;
}
