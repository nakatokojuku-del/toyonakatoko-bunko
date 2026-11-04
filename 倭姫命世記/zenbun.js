// ── 全文タブ（確定翻刻・現代語訳）──
// zenbun-data.js（tools/build-zenbun.py が作る）を読んで描く。
// 頁送りは画像タブと同じ：前丁・次丁のボタン、サムネイル、← で次丁・→ で前丁。
// URL の #page-NN でその丁の全文を開く。
(function () {
  'use strict';
  var DATA = window.ZENBUN_DATA;
  var root = document.getElementById('viewer-zenbun');
  if (!root || !DATA) return;

  var TOTAL = DATA.total;
  var IMAGE_BASE = 'images/';
  var STORE = 'zenbun-show';
  var state = { page: 0, built: false };
  var show = { honkoku: true, yaku: true, notes: false };
  try {
    var saved = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (saved) Object.keys(show).forEach(function (k) { if (typeof saved[k] === 'boolean') show[k] = saved[k]; });
  } catch (e) {}

  function pad(n) { return String(n).padStart(2, '0'); }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  // ── 骨組み（一度だけ作る）──
  var refs = {};
  function build() {
    if (state.built) return;
    state.built = true;

    root.appendChild(el('p', 'z-draft',
      '下書き：確定翻刻・現代語訳とも塾主の確認前です' +
      '<small>翻刻は二つの翻刻を画像で突き合わせて確定したもの、訳はその確定翻刻にもとづく下書きです。字の読み・訳語とも、今後改めることがあります。</small>'));

    var tools = el('div', 'z-tools');
    var tg = el('div', 'z-toggles');
    tg.appendChild(el('span', 'z-tlabel', '表示'));
    [['honkoku', '翻刻'], ['yaku', '訳'], ['notes', '注']].forEach(function (p) {
      var b = el('button', 'z-toggle', p[1]);
      b.type = 'button';
      b.dataset.key = p[0];
      b.addEventListener('click', function () {
        show[p[0]] = !show[p[0]];
        applyShow();
        try { localStorage.setItem(STORE, JSON.stringify(show)); } catch (e) {}
      });
      tg.appendChild(b);
    });
    tools.appendChild(tg);
    tools.appendChild(el('div', 'z-legend',
      '<span class="z-lg"><span class="z-shu">朱色</span>＝朱書</span>' +
      '<span class="z-lg">本文<span class="z-chu"><span class="z-chu-l">小字</span><span class="z-chu-l">二行</span></span>＝割注・傍記</span>' +
      '<span class="z-lg"><span class="z-tochu">上欄</span>＝頭注</span>' +
      '<span class="z-lg"><span class="z-unk">［？］</span>＝判読不能（［某？］は候補）</span>'));
    root.appendChild(tools);

    root.appendChild(navBar('top'));

    var strip = el('div', 'thumb-strip z-thumbs');
    for (var i = 0; i < TOTAL; i++) {
      var t = document.createElement('img');
      t.src = IMAGE_BASE + 'page_' + pad(i) + '.jpg';
      t.className = 'thumb';
      t.loading = 'lazy';
      t.decoding = 'async';
      t.dataset.page = i;
      t.alt = '第' + i + '丁';
      t.title = '第' + i + '丁';
      t.tabIndex = 0;
      t.addEventListener('click', (function (n) { return function () { go(n); }; })(i));
      t.addEventListener('keydown', (function (n) {
        return function (e) { if (e.key === 'Enter' || e.key === ' ') { go(n); e.preventDefault(); } };
      })(i));
      strip.appendChild(t);
    }
    refs.strip = strip;
    root.appendChild(strip);

    refs.page = el('article', 'z-page');
    root.appendChild(refs.page);
    root.appendChild(navBar('bottom'));
    applyShow();
  }

  function navBar(where) {
    var nav = el('div', 'z-nav');
    var prev = el('button', 'nav-btn', '◀ 前丁');
    var ind = el('div', 'page-indicator');
    var next = el('button', 'nav-btn', '次丁 ▶');
    prev.type = next.type = 'button';
    prev.addEventListener('click', function () { go(state.page - 1, where === 'bottom'); });
    next.addEventListener('click', function () { go(state.page + 1, where === 'bottom'); });
    nav.appendChild(prev); nav.appendChild(ind); nav.appendChild(next);
    (refs.navs = refs.navs || []).push({ prev: prev, next: next, ind: ind });
    return nav;
  }

  function applyShow() {
    Object.keys(show).forEach(function (k) { root.classList.toggle('z-off-' + k, !show[k]); });
    root.querySelectorAll('.z-toggle').forEach(function (b) {
      b.setAttribute('aria-pressed', show[b.dataset.key] ? 'true' : 'false');
    });
  }

  // ── 一丁を描く ──
  function sideHtml(label, cols) {
    var h = '<div class="z-side"><span class="z-side-label">' + label + '</span>';
    cols.forEach(function (c) {
      if (c.blank != null) h += '<span class="z-col z-col-blank">' + c.blank + '</span>';
      else if (c.no == null) h += '<span class="z-col z-col-head">' + c.head + '</span>';
      else h += '<span class="z-col" data-no="' + c.no + '"><span class="z-no">' + c.no + '</span>' +
        (c.head || '') + c.html + '</span>';
    });
    return h + '</div>';
  }

  function render() {
    var n = state.page, p = DATA.pages[n] || {}, nn = pad(n);
    var hk = p.honkoku, yk = p.yaku;
    var h = '';
    h += '<figure class="z-img"><a href="' + IMAGE_BASE + 'page_' + nn + '.jpg" target="_blank" rel="noopener">' +
      '<img src="' + IMAGE_BASE + 'page_' + nn + '.jpg" alt="倭姫命世記 第' + n + '丁 書写本画像"></a>' +
      '<figcaption>第' + n + '丁（全' + (TOTAL - 1) + '丁）　画像を押すと原寸で開きます</figcaption></figure>';
    h += '<div class="z-text">';

    h += '<section class="z-sec z-honkoku" aria-label="確定翻刻"><h3><span>確定翻刻</span>' +
      (hk && hk.status ? '<span class="z-status">' + hk.status + '</span>' : '') + '</h3>';
    if (hk) {
      if (hk.naiyou) h += '<p class="z-naiyou">' + hk.naiyou + '</p>';
      h += '<div class="z-tate" style="--len:' + Math.ceil(hk.len) + '" tabindex="0" aria-label="第' + n + '丁の翻刻（縦書き、右丁から）">' +
        sideHtml('右丁', hk.migi) + sideHtml('左丁', hk.hidari) + '</div>';
      if (hk.notes) h += '<div class="z-notes"><h4>翻刻の注</h4>' + hk.notes + '</div>';
    } else {
      h += '<p class="z-empty">この丁の翻刻はまだありません。</p>';
    }
    h += '</section>';

    h += '<section class="z-sec z-yaku" aria-label="現代語訳"><h3><span>現代語訳</span><span class="z-status">下書き</span></h3>';
    if (yk) {
      h += '<div class="z-yaku-body">' + yk.body + '</div>';
      var notes = '';
      if (yk.head) notes += '<h4>頭注・朱書</h4>' + yk.head;
      if (yk.notes) notes += '<h4>訳の注</h4>' + yk.notes;
      if (yk.source) notes += '<p class="z-source">訳の底本：' + yk.source.replace(/[<>&]/g, '') + '</p>';
      if (notes) h += '<div class="z-notes">' + notes + '</div>';
    } else {
      h += '<p class="z-empty">この丁の訳はまだありません。</p>';
    }
    h += '</section></div>';
    refs.page.innerHTML = h;

    refs.navs.forEach(function (v) {
      v.ind.textContent = 'page ' + nn + ' ／ ' + pad(TOTAL - 1);
      v.prev.disabled = n === 0;
      v.next.disabled = n === TOTAL - 1;
    });
    refs.strip.querySelectorAll('.thumb').forEach(function (t) {
      var on = parseInt(t.dataset.page, 10) === n;
      t.classList.toggle('active', on);
      if (on) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
    });
    var a = refs.strip.querySelector('.thumb.active');
    if (a && root.classList.contains('active')) {
      // サムネイル帯の中だけを動かす（頁全体は動かさない）
      refs.strip.scrollTo({ left: a.offsetLeft - refs.strip.clientWidth / 2 + a.clientWidth / 2, behavior: 'smooth' });
    }
    // 縦書きは右端（右丁の一行目）から読み始める
    var tate = refs.page.querySelector('.z-tate');
    if (tate) tate.scrollLeft = tate.scrollWidth;
    [n - 1, n + 1].forEach(function (i) {
      if (i >= 0 && i < TOTAL) { var im = new Image(); im.src = IMAGE_BASE + 'page_' + pad(i) + '.jpg'; }
    });
  }

  function setHash() {
    var want = '#page-' + pad(state.page);
    if (location.hash !== want) history.replaceState(null, '', want);
  }

  function go(n, toTop) {
    if (n < 0 || n >= TOTAL) return;
    build();
    state.page = n;
    render();
    if (root.classList.contains('active')) setHash();
    if (toTop) root.scrollIntoView({ block: 'start' });
  }

  // ── タブの出入り ──
  var tabBtn = document.getElementById('tab-zenbun');
  function openTab() {
    if (!root.classList.contains('active') && tabBtn && typeof window.switchTab === 'function') {
      window.switchTab('zenbun', tabBtn);
    }
  }
  document.querySelectorAll('.tab-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      if (b === tabBtn) {
        // 画像タブで見ていた丁から始める（#page-NN があればそちら）
        var start = state.built ? state.page : (typeof current === 'number' ? current : 0); // eslint-disable-line no-undef
        go(start);
        setHash();
      } else if (/^#page-\d+$/.test(location.hash)) {
        history.replaceState(null, '', location.pathname + location.search);
      }
    });
  });

  function fromHash() {
    var m = /^#page-(\d{1,2})$/.exec(location.hash);
    if (!m) return false;
    var n = parseInt(m[1], 10);
    if (n >= TOTAL) return false;
    openTab();
    go(n);
    return true;
  }
  window.addEventListener('hashchange', fromHash);
  if (fromHash()) {
    // 書誌ヘッダーの下、タブの位置まで送る
    setTimeout(function () { root.scrollIntoView({ block: 'start' }); }, 0);
  }

  // 矢印キーで頁送り（画像タブと同じく ← が次丁へ進む）
  document.addEventListener('keydown', function (e) {
    if (e.target instanceof Element && e.target.matches('input,textarea,select')) return;
    if (!root.classList.contains('active')) return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'ArrowLeft' && state.page < TOTAL - 1) { go(state.page + 1); e.preventDefault(); }
    if (e.key === 'ArrowRight' && state.page > 0) { go(state.page - 1); e.preventDefault(); }
  });
})();
