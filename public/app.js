/**
 * GCP Architecture Patterns フロントエンド
 *
 * サイドバーにカテゴリ別のケース一覧、メインにケース解説を表示する。
 * 構成図はdiagram.jsがJSON仕様からSVGを生成する。
 * 読了チェックはlocalStorageに保存する。
 * 複数タブ対策として、保存時は常にlocalStorageの最新値とマージする。
 */
(function () {
  "use strict";

  var STORAGE_KEY = "gcparchi.state.v1";
  var SITE_TITLE = "GCP Architecture Patterns";
  var cases = (window.GCP_CASES || []).slice().sort(function (a, b) { return a.id - b.id; });
  var caseById = {};
  cases.forEach(function (c) { caseById[c.id] = c; });

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          return { done: parsed.done || {}, lastCase: parsed.lastCase || null };
        }
      }
    } catch (e) { /* 壊れた保存データは無視 */ }
    return { done: {}, lastCase: null };
  }
  var state = loadState();

  function persist(obj) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(obj)); } catch (e) { /* 無視 */ }
  }

  /**
   * 通常保存。他タブが先に保存した読了チェックを消さないよう、
   * localStorageの最新値を再読込し、doneは「最新とメモリの和集合」、
   * lastCaseはメモリ側を採用して保存する。
   */
  function saveState() {
    var latest = loadState();
    var merged = {};
    Object.keys(latest.done).forEach(function (k) { merged[k] = true; });
    Object.keys(state.done).forEach(function (k) { merged[k] = true; });
    state.done = merged;
    persist({ done: merged, lastCase: state.lastCase });
  }

  /**
   * 読了チェックの変更専用の保存。
   * 和集合マージだとチェックを外す操作が他タブの値で復活してしまうため、
   * 最新値を読み込んだ上で該当idのみを確定的に更新し、メモリへ反映して保存する。
   */
  function setDone(id, checked) {
    var latest = loadState();
    var done = latest.done;
    // メモリ側にだけあるチェックも失わないようマージしてから該当idを確定する
    Object.keys(state.done).forEach(function (k) { done[k] = true; });
    if (checked) done[id] = true; else delete done[id];
    state.done = done;
    persist({ done: done, lastCase: state.lastCase });
  }

  var $ = function (id) { return document.getElementById(id); };
  var elToc = $("toc");
  var elView = $("case-view");
  var elWelcome = $("welcome");
  var elSearch = $("toc-search");
  var current = null;
  var introShown = false;
  var resourcesShown = false;
  var glossaryShown = false;

  // カテゴリ名 → 開閉状態。renderTocの全再構築後も開閉状態を引き継ぐ。
  // toggleイベントは非同期発火で検索中の自動オープンを誤記録するレースがあるため、
  // 再構築の直前に現在のDOMから同期的に取り込む方式にする
  var tocOpen = {};
  var tocForceOpen = null; // 次回描画で必ず開くカテゴリ（ケース遷移先の現在地表示用）
  var tocLastFiltered = false; // 前回描画が検索フィルタ中だったか

  // 検索インデックス（ケースid → 小文字化した検索対象テキスト）。
  // タイトル・カテゴリに加え、推奨・代替パターンのservices[].nameでも検索できるようにする
  var searchIndex = {};
  cases.forEach(function (c) {
    var parts = [c.title || "", c.category || ""];
    var patterns = [c.main].concat(c.alternatives || []);
    patterns.forEach(function (p) {
      if (p && p.services) {
        p.services.forEach(function (s) { if (s.name) parts.push(s.name); });
      }
    });
    searchIndex[c.id] = parts.join(" ").toLowerCase();
  });

  function doneCount() {
    return cases.filter(function (c) { return state.done[c.id]; }).length;
  }

  function renderProgress() {
    $("progress-label").textContent = doneCount() + " / " + cases.length;
    $("progress-fill").style.width = (cases.length ? (doneCount() / cases.length) * 100 : 0) + "%";
    var bar = $("progress-bar");
    if (bar) {
      bar.setAttribute("aria-valuemax", String(cases.length));
      bar.setAttribute("aria-valuenow", String(doneCount()));
    }
  }

  function setTitle(prefix) {
    document.title = prefix ? prefix + "｜" + SITE_TITLE : SITE_TITLE;
  }

  /** 遷移後にメイン見出しへフォーカスを移し、スクリーンリーダーに画面の変化を伝える */
  function focusHeading(container) {
    var heading = container.querySelector("h2");
    if (heading) {
      heading.setAttribute("tabindex", "-1");
      try { heading.focus({ preventScroll: true }); } catch (e) { heading.focus(); }
    }
  }

  function renderToc() {
    var query = elSearch ? elSearch.value.trim().toLowerCase() : "";
    var filtering = query !== "";
    var visible = filtering
      ? cases.filter(function (c) { return searchIndex[c.id].indexOf(query) !== -1; })
      : cases;

    // 前回が通常表示のときだけ、ユーザーの開閉状態を現在のDOMから引き継ぐ
    // （検索中の自動オープン状態を誤って記録しないため）
    if (!tocLastFiltered) {
      Array.prototype.forEach.call(elToc.querySelectorAll("details.toc-chapter"), function (d) {
        var s = d.querySelector("summary");
        if (s) tocOpen[s.textContent] = d.open;
      });
    }
    if (tocForceOpen) {
      tocOpen[tocForceOpen] = true;
      tocForceOpen = null;
    }
    tocLastFiltered = filtering;

    elToc.innerHTML = "";
    if (window.GCP_INTRO) {
      var a = document.createElement("a");
      a.href = "#intro";
      a.className = "toc-intro" + (introShown ? " active" : "");
      a.textContent = window.GCP_INTRO.tocTitle || "はじめに";
      elToc.appendChild(a);
    }
    var categories = [];
    visible.forEach(function (c) {
      if (categories.indexOf(c.category) === -1) categories.push(c.category);
    });
    if (filtering && visible.length === 0) {
      var empty = document.createElement("p");
      empty.className = "toc-empty";
      empty.textContent = "「" + (elSearch ? elSearch.value.trim() : "") + "」に一致するケースはありません";
      elToc.appendChild(empty);
    }
    categories.forEach(function (cat) {
      var details = document.createElement("details");
      details.className = "toc-chapter";
      if (filtering) {
        // 検索中は一致ケースを見せるため該当カテゴリを自動オープンする
        details.open = true;
      } else if (Object.prototype.hasOwnProperty.call(tocOpen, cat)) {
        details.open = tocOpen[cat];
      } else {
        details.open = !!(current && current.category === cat);
      }
      var summary = document.createElement("summary");
      summary.textContent = cat;
      details.appendChild(summary);
      var ul = document.createElement("ul");
      visible.filter(function (c) { return c.category === cat; }).forEach(function (c) {
        var li = document.createElement("li");
        var a = document.createElement("a");
        a.href = "#case-" + c.id;
        a.textContent = c.id + ". " + c.title;
        a.className = "toc-step" +
          (state.done[c.id] ? " done" : "") +
          (current && current.id === c.id ? " active" : "");
        li.appendChild(a);
        ul.appendChild(li);
      });
      details.appendChild(ul);
      elToc.appendChild(details);
    });
    // 付録リンク（参考資料リスト・用語集）はケース一覧の末尾にまとめる。
    // 先頭の1件だけケース一覧との区切り線を持たせる
    var appendixAdded = false;
    function addAppendixLink(hash, label, active) {
      var a = document.createElement("a");
      a.href = hash;
      a.className = "toc-intro toc-appendix" +
        (appendixAdded ? "" : " toc-appendix-first") + (active ? " active" : "");
      a.textContent = label;
      elToc.appendChild(a);
      appendixAdded = true;
    }
    if (window.GCP_RESOURCES) {
      addAppendixLink("#resources", window.GCP_RESOURCES.tocTitle || "参考資料リスト", resourcesShown);
    }
    // 用語集は参考資料リストと同じ付録扱い。データが未登録ならリンクを出さない
    if (window.GCP_GLOSSARY) {
      addAppendixLink("#glossary", window.GCP_GLOSSARY.tocTitle || "用語集", glossaryShown);
    }
  }

  function h(html) { return html || ""; }

  /** 属性値に埋め込む文字列のエスケープ */
  function escAttr(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function listHtml(items, cls) {
    if (!items || !items.length) return "";
    return '<ul class="' + (cls || "") + '">' + items.map(function (i) {
      return "<li>" + i + "</li>";
    }).join("") + "</ul>";
  }

  function servicesHtml(services) {
    if (!services || !services.length) return "";
    // アイコン画像は同梱していないため、構成図と同じカテゴリ色のバッジで描く
    return '<div class="svc-list">' + services.map(function (s) {
      return (
        '<div class="svc-item">' +
        GcpDiagram.badge(s.icon, 40) +
        '<div><div class="svc-name">' + s.name + "</div>" +
        '<div class="svc-role">' + s.role + "</div></div></div>"
      );
    }).join("") + "</div>";
  }

  function refsHtml(refs) {
    if (!refs || !refs.length) return "";
    return '<ul class="ref-list">' + refs.map(function (r) {
      var note = r.note ? ' <span class="ref-note">— ' + r.note + "</span>" : "";
      return '<li><a href="' + r.url + '" target="_blank" rel="noopener noreferrer">' +
        r.title + "</a>" + note + "</li>";
    }).join("") + "</ul>";
  }

  function patternHtml(p, isMain) {
    var html = "";
    html += '<section class="pattern' + (isMain ? " pattern-main" : "") + '">';
    html += "<h3>" + (isMain ? "推奨アーキテクチャ：" : "代替パターン：") + p.name + "</h3>";
    if (p.when) html += '<p class="pattern-when">こんなときはこちら：' + p.when + "</p>";
    if (p.diagram) {
      // ラベルが小さくて読めないという声への対応。クリック／Enterで拡大モーダルを開く。
      // 横スクロールは内側のdiagram-wrapが担い、拡大バッジは外側に固定して一緒に流れないようにする
      html += '<div class="diagram-box">' +
        '<span class="diagram-zoom-hint" aria-hidden="true">クリックで拡大</span>' +
        '<div class="diagram-wrap" role="button" tabindex="0" aria-label="構成図を拡大表示"' +
        ' data-diagram-title="' + escAttr(p.name) + '">' +
        GcpDiagram.render(p.diagram, p.name) + "</div></div>";
    }
    if (p.flow) {
      html += "<h4>図の流れ</h4>" + listHtml(p.flow, "flow-list");
    }
    if (p.services) {
      html += "<h4>使うサービス</h4>" + servicesHtml(p.services);
    }
    if (p.points) {
      html += "<h4>設計の工夫点</h4>" + listHtml(p.points, "points-list");
    }
    if (p.pros || p.cons) {
      html += '<div class="pros-cons">';
      html += '<div class="pros"><h4>メリット</h4>' + listHtml(p.pros) + "</div>";
      html += '<div class="cons"><h4>デメリット・注意点</h4>' + listHtml(p.cons) + "</div>";
      html += "</div>";
    }
    if (p.cost) {
      html += '<h4>費用感の目安</h4><p class="pattern-cost">' + h(p.cost) + "</p>";
    }
    if (p.references) {
      html += "<h4>公式ドキュメント・参考資料</h4>" + refsHtml(p.references);
    }
    html += "</section>";
    return html;
  }

  /**
   * 確認問題（理解度チェック）のHTMLを組み立てる。
   * quizが未設定のケースでは何も出さない（全ケースへの投入が済むまでの移行期対応）。
   * details/summaryのネイティブ挙動をそのまま使うため、キーボードでも開閉できる。
   */
  function quizHtml(quiz) {
    if (!quiz || !quiz.length) return "";
    var html = '<section class="quiz"><h3>理解度チェック</h3>';
    html += '<p class="quiz-lead">答えを開く前に、まず自分の言葉で説明してみましょう。' +
      "説明できたところと詰まったところの差が、そのまま理解の残りです。</p>";
    quiz.forEach(function (item, i) {
      if (!item || !item.q) return;
      html += '<details class="quiz-item"><summary>' +
        '<span class="quiz-no">問' + (i + 1) + "</span>" +
        '<span class="quiz-q">' + h(item.q) + "</span></summary>" +
        '<div class="quiz-a"><span class="quiz-a-label">答えと解説</span>' +
        h(item.a) + "</div></details>";
    });
    return html + "</section>";
  }

  /**
   * 本文中の「ケースN」（N=1〜50）を該当ケースへのリンクに置換する。
   * - 直後に数字が続くもの（ケース123等）は対象外
   * - 「ケース 12 / 50」のような半角スペース入りのブレッドクラムは対象外
   * - SVG（構成図）内部はアンカー挿入で壊れるため置換しない
   */
  function linkCaseRefs(html) {
    return html.split(/(<svg[\s\S]*?<\/svg>)/).map(function (part) {
      if (part.lastIndexOf("<svg", 0) === 0) return part;
      return part.replace(/ケース(50|[1-4][0-9]|[1-9])(?![0-9])/g, function (m, n) {
        return '<a href="#case-' + n + '">ケース' + n + "</a>";
      });
    }).join("");
  }

  function showCase(id) {
    var c = caseById[id];
    if (!c) return;
    var prevCategory = current ? current.category : null;
    current = c;
    introShown = false;
    resourcesShown = false;
    glossaryShown = false;
    state.lastCase = id;
    saveState();
    // 別カテゴリへの遷移時は、移動先のカテゴリを開いて現在地を見せる
    // （同一カテゴリ内の再描画ではユーザーの開閉状態を尊重する）
    if (c.category !== prevCategory) tocForceOpen = c.category;
    elWelcome.hidden = true;
    elView.hidden = false;

    var html = "";
    html += '<p id="case-breadcrumb">' + c.category + "｜ケース " + c.id + " / " + cases.length + "</p>";
    html += "<h2>" + c.title + "</h2>";
    html += '<section class="scenario"><h3>どんなサービス？</h3>' + h(c.scenario) + "</section>";
    if (c.requirements) {
      html += '<section><h3>前提・要件</h3>' + listHtml(c.requirements, "req-list") + "</section>";
    }
    html += patternHtml(c.main, true);
    (c.alternatives || []).forEach(function (alt) {
      html += patternHtml(alt, false);
    });
    if (c.cost) html += '<section class="cost"><h3>費用感の目安</h3>' + h(c.cost) + "</section>";
    if (c.summary) html += '<section class="case-summary"><h3>このケースのまとめ</h3>' + h(c.summary) + "</section>";
    html += quizHtml(c.quiz);

    // 端のケースでは行き止まりに見えないよう「はじめに」「参考資料リスト」へ誘導する
    var hasPrevCase = !!caseById[c.id - 1];
    var hasNextCase = !!caseById[c.id + 1];
    var prevLabel = hasPrevCase ? "前のケース" : "はじめに";
    var nextLabel = hasNextCase ? "次のケース" : "参考資料リストへ";
    var prevDisabled = !hasPrevCase && !window.GCP_INTRO;
    var nextDisabled = !hasNextCase && !window.GCP_RESOURCES;

    html += '<nav id="case-nav" aria-label="ケース移動">';
    html += '<button id="btn-prev"' + (prevDisabled ? " disabled" : "") + ">" + prevLabel + "</button>";
    html += '<label id="done-toggle"><input type="checkbox" id="chk-done"' +
      (state.done[c.id] ? " checked" : "") + "> 読んだ</label>";
    html += '<button id="btn-next" class="primary"' + (nextDisabled ? " disabled" : "") + ">" + nextLabel + "</button>";
    html += "</nav>";

    elView.innerHTML = linkCaseRefs(html);

    $("btn-prev").addEventListener("click", function () {
      if (hasPrevCase) location.hash = "#case-" + (c.id - 1);
      else if (window.GCP_INTRO) location.hash = "#intro";
    });
    $("btn-next").addEventListener("click", function () {
      if (hasNextCase) location.hash = "#case-" + (c.id + 1);
      else if (window.GCP_RESOURCES) location.hash = "#resources";
    });
    $("chk-done").addEventListener("change", function () {
      setDone(c.id, this.checked);
      renderToc(); renderProgress();
    });

    renderToc();
    renderProgress();
    setTitle("ケース" + c.id + " " + c.title);
    window.scrollTo(0, 0);
    $("main").scrollTop = 0;
    focusHeading(elView);
  }

  function showIntro() {
    var intro = window.GCP_INTRO;
    if (!intro) return;
    introShown = true;
    resourcesShown = false;
    glossaryShown = false;
    current = null;
    elView.hidden = true;
    elWelcome.hidden = false;
    elWelcome.innerHTML = "";
    var page = document.createElement("div");
    page.className = "intro-page";
    page.innerHTML = intro.content;
    // ケース未登録の段階（土台のみの状態）ではボタンを出さない
    if (caseById[1]) {
      var btn = document.createElement("button");
      btn.className = "primary";
      btn.textContent = "ケース1から始める";
      btn.addEventListener("click", function () { location.hash = "#case-1"; });
      page.appendChild(btn);
    }
    elWelcome.appendChild(page);
    renderToc();
    setTitle(intro.tocTitle || "はじめに");
    window.scrollTo(0, 0);
    $("main").scrollTop = 0;
    focusHeading(elWelcome);
  }

  function showResources() {
    var res = window.GCP_RESOURCES;
    if (!res) return;
    resourcesShown = true;
    introShown = false;
    glossaryShown = false;
    current = null;
    elView.hidden = true;
    elWelcome.hidden = false;
    elWelcome.innerHTML = "";
    var page = document.createElement("div");
    page.className = "intro-page";
    page.innerHTML = res.content;
    elWelcome.appendChild(page);
    renderToc();
    setTitle(res.tocTitle || "参考資料リスト");
    window.scrollTo(0, 0);
    $("main").scrollTop = 0;
    focusHeading(elWelcome);
  }

  /**
   * 用語集ページ。つまみ食い読みでも用語の初出説明にたどり着けるようにする。
   * 用語数が多くなるため、ページ内の検索欄で用語名・英語名・説明から絞り込める。
   */
  function showGlossary() {
    var glossary = window.GCP_GLOSSARY;
    if (!glossary) return;
    glossaryShown = true;
    introShown = false;
    resourcesShown = false;
    current = null;
    elView.hidden = true;
    elWelcome.hidden = false;

    var title = glossary.tocTitle || "用語集";
    var termCount = 0;
    var html = '<div class="intro-page glossary-page">';
    html += "<h2>" + title + "</h2>";
    html += '<p class="glossary-lead">ケースを読んでいて分からない言葉が出てきたら、ここで引いてください。' +
      "各用語には、その用語が実際に使われているケースへのリンクを付けています。</p>";
    html += '<div class="glossary-search-wrap">' +
      '<label for="glossary-search">用語をしぼり込む</label>' +
      '<input type="search" id="glossary-search" autocomplete="off"' +
      ' placeholder="用語名や説明で検索（例：VPC、キャッシュ）">' +
      '<p id="glossary-count" role="status" aria-live="polite"></p>' +
      "</div>";

    (glossary.groups || []).forEach(function (group) {
      var terms = group.terms || [];
      if (!terms.length) return;
      html += '<section class="glossary-group"><h3>' + h(group.name) + "</h3>";
      terms.forEach(function (t) {
        if (!t || !t.term) return;
        termCount++;
        // 検索対象（用語名・英語正式名・説明）を属性に持たせ、絞り込みをDOM操作だけで完結させる
        var haystack = [t.term, t.full || "", String(t.desc || "").replace(/<[^>]*>/g, "")]
          .join(" ").toLowerCase();
        html += '<article class="glossary-term" data-search="' + escAttr(haystack) + '">';
        html += '<h4 class="gt-name">' + h(t.term) +
          (t.full ? ' <span class="gt-full">' + h(t.full) + "</span>" : "") + "</h4>";
        // 説明文中の「ケースN」も本文と同じくリンクにする。
        // 下の「学べるケース」は自前でリンクを組むため、ここだけに適用して二重リンクを防ぐ
        html += '<div class="gt-desc">' + linkCaseRefs(h(t.desc)) + "</div>";
        var caseIds = (t.cases || []).filter(function (n) { return caseById[n]; });
        if (caseIds.length) {
          html += '<p class="gt-cases">学べるケース：' + caseIds.map(function (n) {
            return '<a href="#case-' + n + '" title="' + escAttr(caseById[n].title) + '">ケース' + n + "</a>";
          }).join("、") + "</p>";
        }
        html += "</article>";
      });
      html += "</section>";
    });
    if (termCount === 0) {
      html += "<p>用語がまだ登録されていません。</p>";
    }
    html += '<p class="glossary-empty" hidden>一致する用語はありません。別の言い方で探してみてください。</p>';
    html += "</div>";

    elWelcome.innerHTML = "";
    var page = document.createElement("div");
    page.innerHTML = html;
    elWelcome.appendChild(page);

    var input = $("glossary-search");
    var countEl = $("glossary-count");
    var emptyEl = page.querySelector(".glossary-empty");
    var termEls = Array.prototype.slice.call(page.querySelectorAll(".glossary-term"));
    var groupEls = Array.prototype.slice.call(page.querySelectorAll(".glossary-group"));

    function applyFilter() {
      var q = input.value.trim().toLowerCase();
      var shown = 0;
      termEls.forEach(function (el) {
        var hit = q === "" || el.getAttribute("data-search").indexOf(q) !== -1;
        el.hidden = !hit;
        if (hit) shown++;
      });
      // 全件が隠れた分類の見出しごと隠す
      groupEls.forEach(function (g) {
        var any = Array.prototype.some.call(g.querySelectorAll(".glossary-term"), function (el) {
          return !el.hidden;
        });
        g.hidden = !any;
      });
      if (emptyEl) emptyEl.hidden = shown !== 0;
      countEl.textContent = q === ""
        ? "全" + termCount + "件"
        : shown + "件 / 全" + termCount + "件";
    }
    if (input) {
      applyFilter();
      input.addEventListener("input", applyFilter);
    }

    renderToc();
    setTitle(title);
    window.scrollTo(0, 0);
    $("main").scrollTop = 0;
    focusHeading(elWelcome);
  }

  window.addEventListener("hashchange", function () {
    var m = location.hash.match(/^#case-(\d+)$/);
    if (m) showCase(Number(m[1]));
    else if (location.hash === "#intro") showIntro();
    else if (location.hash === "#resources") showResources();
    else if (location.hash === "#glossary") showGlossary();
  });

  // 他タブでの読了チェック変更を取り込んで表示へ反映する
  window.addEventListener("storage", function (e) {
    if (e.key !== null && e.key !== STORAGE_KEY) return;
    state.done = loadState().done;
    renderToc();
    renderProgress();
    var chk = $("chk-done");
    if (chk && current) chk.checked = !!state.done[current.id];
  });

  if (elSearch) {
    elSearch.addEventListener("input", function () { renderToc(); });
  }

  // ---- 構成図の拡大表示 ----
  // 複雑な図はラベルが小さくて読めないという声への対応。
  // SVGなので拡大しても劣化せず、モーダル内で画面幅いっぱいに広げられる。
  var modal = null, modalBody = null, modalTitle = null, modalClose = null, modalOpener = null;

  function buildModal() {
    if (modal) return;
    modal = document.createElement("div");
    modal.id = "diagram-modal";
    modal.hidden = true;
    modal.innerHTML =
      '<div class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="diagram-modal-title">' +
      '<div class="modal-head">' +
      '<h2 id="diagram-modal-title" class="modal-title"></h2>' +
      '<button type="button" class="modal-close">閉じる</button></div>' +
      '<div class="modal-body" tabindex="0" role="group"' +
      ' aria-label="拡大した構成図。矢印キーでスクロールできます"></div></div>';
    document.body.appendChild(modal);
    modalBody = modal.querySelector(".modal-body");
    modalTitle = modal.querySelector(".modal-title");
    modalClose = modal.querySelector(".modal-close");
    modalClose.addEventListener("click", closeModal);
    // パネルの外側（背景）クリックで閉じる
    modal.addEventListener("click", function (e) { if (e.target === modal) closeModal(); });
    modal.addEventListener("keydown", onModalKeydown);
  }

  /** Escで閉じ、Tabはモーダル内で循環させる（簡易フォーカストラップ） */
  function onModalKeydown(e) {
    if (e.key === "Escape") { e.preventDefault(); closeModal(); return; }
    if (e.key !== "Tab") return;
    var focusable = [modalClose, modalBody];
    var idx = focusable.indexOf(document.activeElement);
    var next = e.shiftKey
      ? focusable[(idx <= 0 ? focusable.length : idx) - 1]
      : focusable[(idx + 1) % focusable.length];
    e.preventDefault();
    next.focus();
  }

  function openModal(wrap) {
    var svg = wrap.querySelector("svg");
    if (!svg) return;
    buildModal();
    modalOpener = wrap;
    modalTitle.textContent = "構成図：" + (wrap.getAttribute("data-diagram-title") || "");
    // 矢印マーカーのidがページ内で重複しないよう、複製側だけ付け替える
    modalBody.innerHTML = svg.outerHTML.replace(/dg-arrow/g, "dg-arrow-zoom");
    var clone = modalBody.querySelector("svg");
    if (clone) clone.setAttribute("class", "dg dg-zoom");
    modal.hidden = false;
    document.body.classList.add("modal-open");
    modalClose.focus();
  }

  function closeModal() {
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    modalBody.innerHTML = "";
    document.body.classList.remove("modal-open");
    // 閉じたら元の図へフォーカスを戻す
    if (modalOpener && document.body.contains(modalOpener)) {
      try { modalOpener.focus({ preventScroll: true }); } catch (e) { modalOpener.focus(); }
    }
    modalOpener = null;
  }

  // 図はケース遷移のたびに作り直されるため、documentへの委譲でクリックを拾う
  document.addEventListener("click", function (e) {
    var t = e.target;
    var wrap = t && t.closest ? t.closest('.diagram-wrap[role="button"]') : null;
    if (wrap) openModal(wrap);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    var el = document.activeElement;
    if (!el || !el.classList || !el.classList.contains("diagram-wrap")) return;
    e.preventDefault();
    openModal(el);
  });

  // ---- 進捗のエクスポート／インポート ----
  // 進捗はこのブラウザのlocalStorageにしか残らないため、
  // 端末を移すときやふり返りに使えるよう短い文字列で持ち出せるようにする。
  var PROGRESS_PREFIX = SITE_TITLE + " 進捗";
  var elPanel = $("progress-panel");
  var elExport = $("btn-progress-export");
  var elImport = $("btn-progress-import");
  var msgTimer = null;

  function showProgressMsg(text) {
    var el = $("progress-msg");
    if (!el) return;
    el.textContent = text;
    el.hidden = false;
    if (msgTimer) clearTimeout(msgTimer);
    msgTimer = setTimeout(function () { el.hidden = true; el.textContent = ""; }, 8000);
  }

  function progressText() {
    var ids = cases.filter(function (c) { return state.done[c.id]; })
      .map(function (c) { return c.id; });
    return PROGRESS_PREFIX + " " + ids.length + "/" + cases.length + " 読了：" + ids.join(",");
  }

  /** 進捗文字列からケース番号を取り出す。読めない文字列はnullを返す */
  function parseProgressText(text) {
    var body = null;
    var m = String(text).match(/読了[：:]([\s\S]*)$/);
    if (m) body = m[1];
    else if (/[0-9]/.test(text) && /^[\s0-9,、]+$/.test(text)) body = text; // 番号だけ貼られた場合も許容
    if (body === null) return null;
    var ids = [];
    body.split(/[^0-9]+/).forEach(function (s) {
      if (!s) return;
      var n = Number(s);
      if (caseById[n] && ids.indexOf(n) === -1) ids.push(n);
    });
    return ids;
  }

  /** 読み込んだ番号を既存の進捗に足し込む（既存のチェックは消さない）。新規分の件数を返す */
  function mergeDone(ids) {
    var done = loadState().done;
    Object.keys(state.done).forEach(function (k) { done[k] = true; });
    var added = 0;
    ids.forEach(function (id) { if (!done[id]) { done[id] = true; added++; } });
    state.done = done;
    persist({ done: done, lastCase: state.lastCase });
    return added;
  }

  function closePanel() {
    if (!elPanel) return;
    elPanel.hidden = true;
    elPanel.innerHTML = "";
    if (elImport) elImport.setAttribute("aria-expanded", "false");
  }

  /** クリップボードが使えない環境向けに、選択してコピーできるテキストを出す */
  function openExportFallback(text) {
    elPanel.hidden = false;
    elPanel.innerHTML =
      '<label for="progress-text">この文字列をコピーしてください</label>' +
      '<textarea id="progress-text" rows="3" readonly></textarea>' +
      '<div class="panel-actions"><button type="button" class="mini-btn" id="btn-panel-close">閉じる</button></div>';
    var ta = $("progress-text");
    ta.value = text;
    ta.focus();
    ta.select();
    $("btn-panel-close").addEventListener("click", function () { closePanel(); elExport.focus(); });
  }

  function openImportPanel() {
    elPanel.hidden = false;
    elImport.setAttribute("aria-expanded", "true");
    elPanel.innerHTML =
      '<label for="progress-text">コピーした進捗の文字列を貼り付けてください</label>' +
      '<textarea id="progress-text" rows="3" placeholder="' +
      escAttr(PROGRESS_PREFIX + " 12/50 読了：1,2,5") + '"></textarea>' +
      '<div class="panel-actions">' +
      '<button type="button" class="mini-btn primary" id="btn-panel-apply">反映する</button>' +
      '<button type="button" class="mini-btn" id="btn-panel-close">閉じる</button></div>' +
      '<p class="panel-note">いまの読了チェックは消えません。読み込んだ分が足されます。</p>';
    $("progress-text").focus();
    $("btn-panel-apply").addEventListener("click", function () {
      var ids = parseProgressText($("progress-text").value);
      if (!ids || ids.length === 0) {
        showProgressMsg("読み込める進捗が見つかりませんでした");
        return;
      }
      var added = mergeDone(ids);
      renderToc();
      renderProgress();
      var chk = $("chk-done");
      if (chk && current) chk.checked = !!state.done[current.id];
      closePanel();
      elImport.focus();
      showProgressMsg(ids.length + "件を読み込みました（新しく付いたのは" + added + "件）");
    });
    $("btn-panel-close").addEventListener("click", function () { closePanel(); elImport.focus(); });
  }

  if (elExport && elPanel) {
    elExport.addEventListener("click", function () {
      var text = progressText();
      var count = doneCount();
      closePanel();
      function fallback() {
        openExportFallback(text);
        showProgressMsg("自動コピーができないため、下の文字列を手動でコピーしてください");
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          showProgressMsg(count + "件をコピーしました");
        }, fallback);
      } else {
        fallback();
      }
    });
  }

  if (elImport && elPanel) {
    elImport.addEventListener("click", function () {
      if (elImport.getAttribute("aria-expanded") === "true") { closePanel(); return; }
      closePanel();
      openImportPanel();
    });
  }

  if (cases.length === 0 && !window.GCP_INTRO) {
    elWelcome.innerHTML = "<h2>教材データが見つかりません</h2>";
  } else if (cases.length === 0) {
    // ケース未生成の土台段階でも「はじめに」だけは表示して動作確認できるようにする
    renderToc();
    renderProgress();
    showIntro();
    location.hash = "#intro";
  } else {
    renderToc();
    renderProgress();
    var m = location.hash.match(/^#case-(\d+)$/);
    // 付録ページへの直リンクでもそのページを開けるようにする
    if (!m && location.hash === "#resources" && window.GCP_RESOURCES) {
      showResources();
    } else if (!m && location.hash === "#glossary" && window.GCP_GLOSSARY) {
      showGlossary();
    } else if (!m && window.GCP_INTRO && (location.hash === "#intro" || !state.lastCase)) {
      showIntro();
      location.hash = "#intro";
    } else {
      var initial = m ? Number(m[1]) : state.lastCase || cases[0].id;
      if (!caseById[initial]) initial = cases[0].id;
      showCase(initial);
      location.hash = "#case-" + initial;
    }
  }
})();
