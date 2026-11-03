/* 倭姫命世記 ── 現代語訳タブの描画と、画像・翻刻タブとの行き来
   データ：yakugo.js（window.YAMATOHIME_YAKUGO）
   index.html の switchTab() と loadPage() を用いる（この script は index.html 本体の script の後で読み込む）。
   翻刻本文の DOM には手を触れず、各 .chapter の末尾に「現代語訳で読む」ボタンを足すだけにしている。 */
(function () {
  'use strict';
  var D = window.YAMATOHIME_YAKUGO;
  var root = document.getElementById('viewer-yaku');
  if (!D || !root) return;

  var LEVEL = { '訳': 'lv-yaku', '大意': 'lv-gist', '保留': 'lv-hold' };

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function pageLabel(a, b) { return a === b ? '第' + a + '丁' : '第' + a + '〜' + b + '丁'; }

  // [[見出し語]] / [[見出し語|表示]] → 用語ボタン、〔…〕→ 補った語、※n → 注番号
  function markup(s) {
    var h = esc(s);
    h = h.replace(/〔([^〔〕]*)〕/g, '<span class="yaku-hosoku">〔$1〕</span>');
    h = h.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, function (_, key, label) {
      if (!D.terms[key]) return label || key;
      return '<button type="button" class="yaku-term" data-term="' + key + '" aria-haspopup="dialog">' + (label || key) + '</button>';
    });
    h = h.replace(/※(\d+)/g, '<sup class="yaku-sup">※$1</sup>');
    return h;
  }

  // ── 描画 ──
  var html = [];
  html.push('<div class="yaku-draft">' + esc(D.note) + '</div>');
  html.push('<div class="text-intro">' +
    '翻刻テキストタブの本文を、場面ごとに現代語に訳したものです。<b>〔　〕</b>は訳者が補った語、<b>※</b>は注です。' +
    '赤い点線の語を押すと、用語の解説が出ます。<br>' +
    '翻刻はまだ校正中で、読みの確定していない字が多くあります。そのため各段に、' +
    '<b>訳</b>（語句を追って訳せた段）・<b>大意</b>（一部を補って大意を示した段）・<b>保留</b>（文として訳せず、読める語句だけを示した段）の別を付けました。' +
    '</div>');

  html.push('<nav class="yaku-index" aria-label="現代語訳の目次">');
  D.sections.forEach(function (s) {
    html.push('<a href="#yaku-' + s.id + '" data-jump="' + s.id + '">' + esc(pageLabel(s.pages[0], s.pages[1])) + '</a>');
  });
  html.push('</nav>');

  D.sections.forEach(function (s) {
    html.push('<section class="chapter yaku-sec" id="yaku-' + s.id + '">');
    html.push('<div class="chapter-heading">' + esc(s.title) + '（' + esc(pageLabel(s.pages[0], s.pages[1])) + '）</div>');
    html.push('<div class="chapter-summary">' + markup(s.lead) + '</div>');
    html.push('<div class="yaku-links"><button type="button" class="yaku-btn" data-to-text="' + s.id + '">翻刻テキストで見る</button></div>');
    html.push('<div class="yaku-body">');
    s.items.forEach(function (it, i) {
      var used = {};
      (it.yaku.match(/※(\d+)/g) || []).forEach(function (m) { used[m.slice(1)] = 1; });
      html.push('<div class="yaku-item"' + (i === 0 || s.items[i - 1].p !== it.p ? ' id="yaku-p' + it.p + '"' : '') + '>');
      html.push('<div class="yaku-meta">' +
        '<button type="button" class="yaku-btn" data-to-image="' + it.p + '" title="この丁の書写本画像を見る">第' + it.p + '丁' + (it.side ? '　' + esc(it.side) : '') + '　画像 ▸</button>' +
        '<span class="yaku-level ' + (LEVEL[it.level] || '') + '">' + esc(it.level) + '</span></div>');
      html.push('<p class="yaku-text">' + markup(it.yaku) + '</p>');
      if (it.notes && it.notes.length) {
        html.push('<ul class="yaku-notes">');
        it.notes.forEach(function (n, k) {
          var lab = used[k + 1] ? '※' + (k + 1) : '注';
          html.push('<li><span class="yaku-nlabel">' + lab + '</span>' + markup(n) + '</li>');
        });
        html.push('</ul>');
      }
      html.push('</div>');
    });
    html.push('</div></section>');
  });
  root.innerHTML = html.join('');

  // ── タブ移動 ──
  function tabBtn(name) {
    var bs = document.querySelectorAll('.tab-btn');
    for (var i = 0; i < bs.length; i++) {
      if ((bs[i].getAttribute('onclick') || '').indexOf("'" + name + "'") > -1) return bs[i];
    }
    return null;
  }
  function openTab(name) {
    var b = tabBtn(name);
    if (b && typeof window.switchTab === 'function') window.switchTab(name, b);
  }
  function scrollToEl(el) {
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function flash(el) {
    if (!el) return;
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
  }
  function sectionById(id) {
    for (var i = 0; i < D.sections.length; i++) if (D.sections[i].id === id) return D.sections[i];
    return null;
  }
  function sectionForPage(n) {
    for (var i = 0; i < D.sections.length; i++) {
      var s = D.sections[i];
      for (var j = 0; j < s.items.length; j++) if (s.items[j].p === n) return s;
    }
    return null;
  }
  // 翻刻タブの章は見出しの語で対応づける（章が増減しても崩れにくいように）。見つからなければ順番で。
  function textChapter(s) {
    var chs = document.querySelectorAll('#viewer-text .chapter');
    for (var i = 0; i < chs.length; i++) {
      var h = chs[i].querySelector('.chapter-heading');
      if (h && h.textContent.indexOf(s.match) > -1) return chs[i];
    }
    return chs[D.sections.indexOf(s)] || null;
  }

  function goYakuPage(n) {
    openTab('yaku');
    var el = document.getElementById('yaku-p' + n);
    setTimeout(function () { scrollToEl(el); flash(el); }, 30);
  }
  function goYakuSection(id) {
    openTab('yaku');
    var el = document.getElementById('yaku-' + id);
    setTimeout(function () { scrollToEl(el); }, 30);
  }
  function goImage(n) {
    openTab('image');
    if (typeof window.loadPage === 'function') window.loadPage(n);
    setTimeout(function () { scrollToEl(document.getElementById('viewer-image')); }, 30);
  }
  function goText(id) {
    var s = sectionById(id);
    openTab('text');
    var el = s && textChapter(s);
    setTimeout(function () { scrollToEl(el); }, 30);
  }

  root.addEventListener('click', function (e) {
    var t = e.target.closest('[data-to-image],[data-to-text],[data-jump],.yaku-term');
    if (!t) return;
    if (t.hasAttribute('data-to-image')) goImage(parseInt(t.getAttribute('data-to-image'), 10));
    else if (t.hasAttribute('data-to-text')) goText(t.getAttribute('data-to-text'));
    else if (t.hasAttribute('data-jump')) { e.preventDefault(); goYakuSection(t.getAttribute('data-jump')); }
    else showTerm(t);
  });

  // 翻刻タブ：各章の末尾に「現代語訳で読む」
  D.sections.forEach(function (s) {
    var ch = textChapter(s);
    if (!ch || ch.querySelector('.yaku-xlink')) return;
    var d = document.createElement('div');
    d.className = 'yaku-xlink';
    d.innerHTML = '<button type="button" class="yaku-btn">この段の現代語訳を読む ▸</button>';
    d.firstChild.addEventListener('click', function () { goYakuSection(s.id); });
    ch.appendChild(d);
  });

  // 画像タブ：訳のある丁なら「この丁の現代語訳」
  var cap = document.getElementById('image-caption');
  if (cap) {
    var il = document.createElement('div');
    il.id = 'yaku-imglink';
    il.hidden = true;
    il.innerHTML = '<button type="button" class="yaku-btn">この丁の現代語訳を読む ▸</button>';
    cap.parentNode.insertBefore(il, cap.nextSibling);
    var curPage = 0;
    il.firstChild.addEventListener('click', function () { goYakuPage(curPage); });
    var update = function (n) { curPage = n; il.hidden = !sectionForPage(n); };
    if (typeof window.loadPage === 'function') {
      var orig = window.loadPage;
      window.loadPage = function (n) { orig(n); update(n); };
    }
    update(typeof window.current === 'number' ? window.current : 0);
  }

  // ── 用語解説 ──
  var pop = document.createElement('div');
  pop.className = 'yaku-pop';
  pop.id = 'yaku-pop';
  pop.setAttribute('role', 'dialog');
  pop.setAttribute('aria-labelledby', 'yaku-pop-title');
  pop.hidden = true;
  document.body.appendChild(pop);
  var opener = null;

  function showTerm(btn) {
    var key = btn.getAttribute('data-term');
    var t = D.terms[key];
    if (!t) return;
    if (!pop.hidden && opener === btn) { hideTerm(); return; }
    opener = btn;
    pop.innerHTML =
      '<button type="button" class="pop-close" aria-label="閉じる">×</button>' +
      '<h3 id="yaku-pop-title">' + esc(key) + '</h3>' +
      '<div class="pop-yomi">' + esc(t.yomi || '') + '</div>' +
      '<span class="pop-kind">' + esc(t.kind || '') + '</span>' +
      '<p>' + esc(t.desc) + '</p>';
    pop.hidden = false;
    if (window.matchMedia('(min-width:641px)').matches) {
      var r = btn.getBoundingClientRect();
      var w = pop.offsetWidth;
      var left = Math.min(Math.max(16, r.left + window.scrollX), window.scrollX + document.documentElement.clientWidth - w - 16);
      pop.style.left = left + 'px';
      pop.style.top = (r.bottom + window.scrollY + 8) + 'px';
    } else {
      pop.style.left = ''; pop.style.top = '';
    }
    pop.querySelector('.pop-close').addEventListener('click', function () { hideTerm(true); });
    pop.querySelector('.pop-close').focus({ preventScroll: true });
  }
  function hideTerm(refocus) {
    if (pop.hidden) return;
    pop.hidden = true;
    if (refocus && opener) opener.focus({ preventScroll: true });
    opener = null;
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hideTerm(true); });
  document.addEventListener('click', function (e) {
    if (pop.hidden) return;
    if (pop.contains(e.target) || e.target.closest('.yaku-term')) return;
    hideTerm(false);
  });
  document.querySelectorAll('.tab-btn').forEach(function (b) { b.addEventListener('click', function () { hideTerm(false); }); });

  // ── #yaku / #yaku-p25 / #yaku-s06 で直接開く ──
  function fromHash() {
    var m = /^#yaku(?:-(p\d+|s\d+))?$/.exec(location.hash);
    if (!m) return;
    if (!m[1]) openTab('yaku');
    else if (m[1][0] === 'p') goYakuPage(parseInt(m[1].slice(1), 10));
    else goYakuSection(m[1]);
  }
  fromHash();
  window.addEventListener('hashchange', fromHash);
})();
