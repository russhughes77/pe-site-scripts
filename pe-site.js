/*
 * Production Expert: site scripts
 * Loaded by one line in Squarespace > Settings > Advanced > Code Injection > Footer.
 * Each section is fenced off, so a fault in one can never stop the others.
 * The order matters: the placement section must stay last.
 */

/* ================================================================
 * Production Expert: blog post date format
 * Rewrites the date on single posts from US MM.DD.YY to "October 23, 2026",
 * so Google reads it correctly. Blog list and category pages get the same format,
 * keeping their day name: "Monday 10.05.26" becomes "Monday, October 5, 2026".
 * ================================================================ */
try {
(function () {
  var months = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

  function format(d, m, y) {
    return months[parseInt(m, 10) - 1] + ' ' + parseInt(d, 10) + ', ' + y;
  }

  function fixPostDates() {
    // Single posts and blog list pages (main blog, category and tag pages)
    var els = document.querySelectorAll(
      'article time, .blog-item-wrapper time, .entry-dateline time, time.published, time.dt-published'
    );

    els.forEach(function (el) {
      if (el.dataset.dateFixed) return;
      var out = null;

      // Preferred: read the ISO date Squarespace puts in the datetime attribute
      var iso = el.getAttribute('datetime');
      var m = iso && iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m) {
        out = format(m[3], m[2], m[1]);
      } else {
        // Fallback: convert visible US-style MM.DD.YY text
        var t = el.textContent.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
        if (t) {
          var y = t[3].length === 2 ? '20' + t[3] : t[3];
          out = format(t[2], t[1], y);
        }
      }

      if (out) {
        // List pages put the day name first ("Monday 10.05.26"): keep it
        var day = el.textContent.trim().match(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/);
        if (day) out = day[1] + ', ' + out;
        el.textContent = out;
        el.dataset.dateFixed = '1';
      }
    });
  }

  document.addEventListener('DOMContentLoaded', fixPostDates);
  window.addEventListener('mercury:load', fixPostDates); // Ajax page loads
})();
} catch (e) { if (window.console) console.warn('Production Expert script failed: blog post date format', e); }

/* ================================================================
 * Production Expert: article enhancements
 * 1. A paragraph starting with "#H4 " becomes an H4 subheading.
 * 2. Read time badge (238 wpm, rounded up) and a reading progress bar.
 * 3. Contents box from the H3s, with H4s indented, on posts with 4 or more sections.
 * Tag a post "no-contents" to leave it out.
 * 4. Video watch time added to the badge and the contents box (YouTube and Vimeo).
 * Everything stops at the "You Might Also Find These Articles Useful" heading.
 * ================================================================ */
try {
(function () {
  var C = {
    wpm: 238, codeSecs: 20, minSections: 4,
    blue: '#006eb3', ink: '#222', grey: '#555', subGrey: '#666', panel: '#f4f4f4',
    font: "'Open Sans',sans-serif",
    stop: /you might(?:\s+also)?\s+find\s+th(?:ese|is)/i,
    skip: 'figcaption,.image-caption-wrapper,.sqs-block-newsletter,.sqs-block-button,.sqs-block-video,.sqs-block-audio,script,style,noscript,iframe,pre,.pe-ui'
  };
  var article, stopEl, bar, ticking = false, vids = [], ytQueue = null;
  var calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var LINK = 'text-decoration-color:rgba(0,0,0,.25);text-underline-offset:3px';

  function all(sel, root) { return [].slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, cls, css) { var e = document.createElement(tag); if (cls) e.className = cls; if (css) e.style.cssText = css; return e; }
  function esc(t) { return t.replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  function mins(secs) { return Math.max(1, Math.ceil(secs / 60)); }
  function beforeStop(node) { return !stopEl || !!(node.compareDocumentPosition(stopEl) & 4); }
  function cleanTitle(t) { t = (t || '').trim(); return /^(youtube|vimeo)?\s*(video\s*)?player$/i.test(t) ? '' : t.length > 80 ? t.slice(0, 78).trim() + '…' : t; }

  // 1. #H4 paragraphs become H4s (plain text, so pasted colours or styling can't hide them)
  function makeH4s() {
    all('p', article).forEach(function (p) {
      if (!/^\s*#h4\b/i.test(p.textContent)) return;
      var h = el('h4', 'pe-h4', 'font-family:' + C.font + ';font-weight:800;font-style:normal;font-size:18px;line-height:1.1em;letter-spacing:0;text-transform:none;color:' + C.ink + ';margin:1.4em 0 .5em;opacity:1;visibility:visible');
      h.textContent = p.textContent.replace(/^\s*#h4\b\s*/i, '').trim();
      p.parentNode.replaceChild(h, p);
    });
  }

  // 2a. Read time badge
  function readTime() {
    all('div,span,p', article).forEach(function (n) {            // remove hand-placed "X min read" badges
      if (!n.isConnected || !/^\s*\d+\s*min(ute)?s?\s+read\s*$/i.test(n.textContent)) return;
      var block = n.closest('.sqs-block');
      (block && article.contains(block) && /^\s*\d+\s*min(ute)?s?\s+read\s*$/i.test(block.textContent) ? block : n).remove();
    });
    var words = 0, walk = document.createTreeWalker(article, NodeFilter.SHOW_TEXT), t;
    while ((t = walk.nextNode())) {
      if (!beforeStop(t)) break;
      if (t.parentElement && !t.parentElement.closest(C.skip)) words += (t.nodeValue.match(/\S*[\p{L}\p{N}]\S*/gu) || []).length;
    }
    var code = all('pre', article).filter(beforeStop).length;
    var badge = el('div', 'pe-ui pe-badge', 'display:flex;width:max-content;max-width:100%;clear:both;align-items:center;gap:6px;padding:6px 12px;margin-bottom:1rem;background:' + C.panel + ';border-radius:4px;font-family:' + C.font + ';font-size:13px;color:' + C.grey);
    badge.innerHTML = '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg><span>' + mins(words / C.wpm * 60 + code * C.codeSecs) + ' min read</span>';
    article.insertBefore(badge, article.firstChild);
  }

  // 2b. Progress bar, full when the reader reaches the related content heading
  function progressBar() {
    bar = document.body.appendChild(el('div', 'pe-ui', 'position:fixed;left:0;top:0;width:100%;height:3px;background:#e87722;transform-origin:0 50%;transform:scaleX(0);z-index:2147483000;pointer-events:none' + (calm ? '' : ';transition:transform 80ms linear')));
    bar.setAttribute('aria-hidden', 'true');
    updateBar();
  }
  function updateBar() {
    ticking = false;
    if (!bar || !article) return;
    var top = article.getBoundingClientRect().top;
    var end = stopEl ? stopEl.getBoundingClientRect().top : article.getBoundingClientRect().bottom;
    var travel = end - top - innerHeight;
    var p = travel > 0 ? -top / travel : (end <= innerHeight ? 1 : 0);
    bar.style.transform = 'scaleX(' + Math.min(1, Math.max(0, p)).toFixed(4) + ')';
  }

  // 3. Contents box
  function contents() {
    if (document.querySelector('article.tag-no-contents')) return;
    var sections = 0, used = {};
    var heads = all('h3,h4', article).filter(function (h) {
      if (!beforeStop(h) || !h.textContent.trim()) return false;
      if (h.tagName === 'H3') sections++;
      return sections > 0;                                         // ignore H4s that come before the first H3
    });
    if (sections < C.minSections) return;
    var html = '', subOpen = false;
    heads.forEach(function (h, i) {
      var text = h.textContent.replace(/\s+/g, ' ').trim(), sub = h.tagName === 'H4';
      if (!h.id) {
        var base = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'section', id = base, k = 2;
        while (used[id] || document.getElementById(id)) id = base + '-' + k++;
        h.id = id;
      }
      used[h.id] = 1;
      h.style.scrollMarginTop = '24px';
      var link = '<a href="#' + h.id + '" style="color:' + (sub ? C.subGrey : 'inherit') + ';' + LINK + '">' + esc(text) + '</a>';
      if (sub) {
        if (!subOpen) { html += '<ul style="list-style:none;margin:2px 0 0;padding:0 0 0 16px;font-size:14px">'; subOpen = true; }
        html += '<li style="padding:3px 0">' + link + '</li>';
      } else {
        if (subOpen) { html += '</ul>'; subOpen = false; }
        html += (i ? '</li>' : '') + '<li style="padding:4px 0;break-inside:avoid">' + link;
      }
    });
    html += (subOpen ? '</ul>' : '') + '</li>';
    var nav = el('nav', 'pe-ui pe-contents', 'clear:both;margin:0 0 1.75rem;padding:14px 18px;background:' + C.panel + ';border-radius:4px;font-family:' + C.font + ';color:' + C.ink);
    nav.setAttribute('aria-label', 'Contents');
    nav.innerHTML = '<details' + (heads.length >= 8 && innerWidth < 700 ? '' : ' open') + '>' +
      '<summary style="cursor:pointer;font-size:13px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:' + C.grey + '">&nbsp;In this article (' + sections + ' sections)</summary>' +
      '<ul class="pe-list" style="list-style:none;margin:10px 0 2px;padding:0;font-size:15px;line-height:1.45;' + (heads.length >= 10 ? 'column-width:17em;column-gap:2em' : '') + '">' + html + '</ul></details>';
    nav.addEventListener('click', function (e) {
      var a = e.target.closest('a'), target = a && document.getElementById(a.hash.slice(1));
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: calm ? 'auto' : 'smooth' });
      history.replaceState(null, '', a.hash);
    });
    var badge = article.querySelector('.pe-badge');
    article.insertBefore(nav, badge ? badge.nextSibling : article.firstChild);
  }

  // 4. Video watch time
  function videos() {
    var blocks = all('.sqs-block-video', article).filter(beforeStop), tries = 0;
    if (!blocks.length) return;
    (function waitForPlayers() {                                    // Squarespace adds the iframes after load
      if (!blocks.every(function (b) { return b.querySelector('iframe'); }) && tries++ < 40) return setTimeout(waitForPlayers, 250);
      blocks.forEach(function (b, i) {
        var f = b.querySelector('iframe'), v = { block: b, secs: 0, title: f ? cleanTitle(f.title) : '' };
        if (!f) return;
        b.id = b.id || 'video-' + (i + 1);
        b.style.scrollMarginTop = '24px';
        vids.push(v);
        var vimeo = f.src.match(/vimeo\.com\/video\/(\d+)/);
        if (/youtube\.com|youtu\.be/.test(f.src)) youtube(f, v, i);
        else if (vimeo) fetch('https://vimeo.com/api/oembed.json?url=' + encodeURIComponent('https://vimeo.com/' + vimeo[1]))
          .then(function (r) { return r.json(); }).then(function (d) { v.secs = d.duration || 0; v.title = v.title || cleanTitle(d.title); showVideoTime(); }).catch(function () {});
      });
    })();
  }
  function youtube(f, v, i) {
    var u = new URL(f.src);
    u.searchParams.set('enablejsapi', '1');
    u.searchParams.set('origin', location.origin);
    f.id = f.id || 'pe-yt-' + i;
    f.setAttribute('loading', 'eager');
    f.src = u.href;
    var connect = function () { new YT.Player(f.id, { events: { onReady: function (e) { v.secs = e.target.getDuration() || 0; if (!v.title) try { v.title = cleanTitle(e.target.getVideoData().title); } catch (x) {} showVideoTime(); } } }); };
    if (window.YT && YT.loaded) return connect();
    if (ytQueue) return ytQueue.push(connect);
    ytQueue = [connect];
    var previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = function () { if (previous) previous(); ytQueue.forEach(function (fn) { fn(); }); };
    document.head.appendChild(el('script')).src = 'https://www.youtube.com/iframe_api';
  }
  function showVideoTime() {
    var ready = vids.filter(function (v) { return v.secs > 0; });
    if (!ready.length) return;
    var total = ready.reduce(function (sum, v) { return sum + v.secs; }, 0);
    var badge = article.querySelector('.pe-badge');
    if (badge) (badge.querySelector('.pe-vid') || badge.appendChild(el('span', 'pe-vid'))).textContent = '· ' + mins(total) + ' min video';
    var list = article.querySelector('.pe-list');
    if (!list) return;
    all('.pe-vli', list).forEach(function (n) { n.remove(); });
    ready.forEach(function (v, i) {
      list.appendChild(el('li', 'pe-vli', 'padding:4px 0;break-inside:avoid')).innerHTML =
        '<a href="#' + v.block.id + '" style="color:inherit;' + LINK + '">' + (v.title ? 'Watch: ' + esc(v.title) : ready.length > 1 ? 'Watch video ' + (i + 1) : 'Watch the video') + ' (' + mins(v.secs) + ' min)</a>';
    });
  }

  function init() {
    all('.pe-ui').forEach(function (n) { n.remove(); });
    article = document.querySelector('[data-pe-article],body.view-item article.hentry .body.entry-content');
    if (!article) return;
    stopEl = all('h1,h2,h3,h4', article).filter(function (h) { return C.stop.test(h.textContent); })[0] || null;
    vids = [];
    makeH4s();
    readTime();
    contents();
    progressBar();
    videos();
    if (location.hash) { var t = document.getElementById(decodeURIComponent(location.hash.slice(1))); if (t) t.scrollIntoView(); }
  }

  addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(updateBar); } }, { passive: true });
  addEventListener('resize', updateBar);
  addEventListener('mercury:load', init);
  // The footer loads after the article, so run straight away and nothing jumps once the reader has started
  if (document.querySelector('body.view-item article.hentry .body.entry-content,[data-pe-article]')) init();
  else document.addEventListener('DOMContentLoaded', init);
})();
} catch (e) { if (window.console) console.warn('Production Expert script failed: article enhancements', e); }

/* ================================================================
 * Production Expert: partner content label
 * Any post tagged "Partner" gets the disclosure line directly under the header
 * image, above the read time badge and contents box. The old hand-typed overlay caption is hidden on
 * tagged posts but stays in the page source as a fallback.
 * Untagged older posts with the overlay text are still recognised as partner
 * content (for related content matching), and left exactly as they are.
 * ================================================================ */
try {
(function () {
  var C = {
    tag: 'partner',
    text: 'This is Partner Content.',
    linkText: 'What does this mean?',
    linkUrl: '/review-policy',
    blue: '#006eb3',
    ink: '#222'
  };

  function article() { return document.querySelector('body.view-item article.hentry'); }

  function overlayCaption(a) {
    var caps = a.querySelectorAll('figcaption, .image-caption');
    for (var i = 0; i < caps.length; i++) {
      if (/this is partner content/i.test(caps[i].textContent)) return caps[i].closest('figcaption') || caps[i];
    }
    return null;
  }

  function place(label, body) {
    // Insert once; the placement script decides the final position and order.
    if (!label.parentNode) body.insertBefore(label, body.firstChild);
  }

  function run() {
    var a = article();
    if (!a) return tagPage();
    var tagged = a.classList.contains('tag-' + C.tag);
    var cap = overlayCaption(a);
    if (!tagged && !cap) return;

    // Flag for the related content script: brand-only matching on partner posts.
    document.documentElement.classList.add('pe-partner');
    window.PE = window.PE || {};
    window.PE.partner = true;

    if (!tagged) return; // older untagged post: leave its overlay as it is

    var body = a.querySelector('.body.entry-content');
    if (!body) return;
    var label = body.querySelector('.pe-partner-label');
    if (!label) {
      label = document.createElement('p');
      label.className = 'pe-ui pe-partner-label';
      label.setAttribute('role', 'note');
      label.style.cssText = 'margin:0 0 1rem;padding:8px 14px;border-left:3px solid ' + C.blue +
        ';background:#eef5fb;font-family:"Open Sans",sans-serif;font-size:14px;line-height:1.4;color:' + C.ink + ';';
      var strong = document.createElement('strong');
      strong.textContent = C.text + ' ';
      var link = document.createElement('a');
      link.href = C.linkUrl;
      link.textContent = C.linkText;
      link.style.cssText = 'color:' + C.blue + ';text-underline-offset:3px;';
      label.appendChild(strong);
      label.appendChild(link);
      if (cap) cap.style.display = 'none';
    }
    place(label, body);
  }

  // Keep the Partner tag listing page out of Google's index.
  function tagPage() {
    var m = location.search.match(/[?&]tag=([^&]+)/i);
    if (!m || decodeURIComponent(m[1].replace(/\+/g, ' ')).toLowerCase() !== C.tag) return;
    if (document.querySelector('meta[name="robots"][content*="noindex"]')) return;
    var meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, follow';
    document.head.appendChild(meta);
  }

  run();
  setTimeout(run, 400);            // re-seat above badges added by later scripts
  addEventListener('load', run);
  addEventListener('mercury:load', run);
})();
} catch (e) { if (window.console) console.warn('Production Expert script failed: partner content label', e); }

/* ================================================================
 * Production Expert: automatic author bio
 * What it does on every article page:
 * 1. Reads the author from the "Posted by" link.
 * 2. Looks that name up in the /author-bios collection (cached in the browser for 12 hours).
 * 3. Builds the bio panel (photo, name, excerpt, Read more) at the end of the article body.
 *
 * It does nothing if:
 * - the page is not a blog post, or is inside /author-bios itself
 * - the author is on the SKIP list
 * - no matching bio exists
 * - the article already contains a link to /author-bios/ (a manually added bio), so old posts never double up
 *
 * Debug: add ?biodebug to any article URL and open the browser console.
 * ================================================================ */
try {
(function () {
  'use strict';

  /* ---------- CONFIG ---------- */
  var BIOS_PATH = '/author-bios';
  var CACHE_KEY = 'pe-author-bios-v1';
  var CACHE_HOURS = 12;
  var MAX_PAGES = 40;

  // Accounts that should never get a bio block.
  var SKIP = [];

  // If a Squarespace author name differs from the bio title, map it here.
  // Left side: name as shown in "Posted by". Right side: bio title on /author-bios.
  var ALIASES = {
    // 'mike t': 'Mike Thornton'
  };

  // Where the bio goes. First match wins; the block is appended inside it.
  var TARGETS = [
    '.blog-item-content-wrapper',
    '.blog-item-content',
    'article .entry-content',
    'article .blog-item-body',
    'article .sqs-layout',
    'article'
  ];
  /* ---------------------------- */

  var DEBUG = /[?&]biodebug\b/.test(location.search);
  function log() { if (DEBUG && window.console) console.log.apply(console, ['[PE bio]'].concat([].slice.call(arguments))); }

  function norm(s) {
    return (s || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[\u2018\u2019\u201C\u201D"'.,()]/g, '')
      .replace(/\s+/g, ' ')
      .trim().toLowerCase();
  }

  function isArticlePage() {
    if (location.pathname.indexOf(BIOS_PATH) === 0) return false;
    var b = document.body.classList;
    if (b.contains('view-item') && (b.contains('collection-type-blog') || document.querySelector('article'))) return true;
    return !!document.querySelector('.blog-item, article.BlogItem, .BlogItem-wrapper');
  }

  function findAuthor() {
    var scope = document.querySelector('article') || document;
    var a = scope.querySelector('a[href*="?author="]') || document.querySelector('a[href*="?author="]');
    return a ? a.textContent.trim() : '';
  }

  function readCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var c = JSON.parse(raw);
      if (Date.now() - c.t > CACHE_HOURS * 3600 * 1000) return null;
      return c.bios;
    } catch (e) { return null; }
  }

  function writeCache(bios) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), bios: bios })); } catch (e) {}
  }

  function fetchPage(url) {
    var sep = url.indexOf('?') === -1 ? '?' : '&';
    return fetch(url + sep + 'format=json', { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  function loadAllBios() {
    var cached = readCache();
    if (cached && !DEBUG) { log('using cache', cached.length); return Promise.resolve(cached); }
    var bios = [];
    function next(url, n) {
      return fetchPage(url).then(function (data) {
        (data.items || []).forEach(function (it) {
          bios.push({
            name: it.title || '',
            url: it.fullUrl || '',
            img: it.assetUrl || '',
            excerpt: it.excerpt || ''
          });
        });
        var p = data.pagination;
        if (p && p.nextPage && p.nextPageUrl && n < MAX_PAGES) return next(p.nextPageUrl, n + 1);
        return bios;
      });
    }
    return next(BIOS_PATH, 1).then(function (all) { writeCache(all); log('fetched', all.length, 'bios'); return all; });
  }

  function findBio(bios, author) {
    var key = norm(ALIASES[norm(author)] || ALIASES[author] || author);
    for (var i = 0; i < bios.length; i++) if (norm(bios[i].name) === key) return bios[i];
    return null;
  }

  function buildBlock(bio) {
    // Grey panel in the same family as the "In this article" contents box,
    // with a larger photo, the name as a heading and an arrowed Read more link.
    var FONT = 'font-family:"Open Sans",sans-serif;';
    var TEXT = FONT + 'font-size:14px;line-height:1.75;color:#333;';
    var BLUE = '#006eb3';

    var wrap = document.createElement('aside');
    wrap.className = 'pe-ui pe-author-bio';
    wrap.setAttribute('aria-label', 'About the author');
    wrap.setAttribute('style', 'margin:40px 0 24px;padding:28px 34px 30px;background:#f4f4f4;border-radius:6px;' + FONT);

    var label = document.createElement('p');
    label.textContent = 'About the author';
    label.setAttribute('style', FONT + 'margin:0 0 18px;font-size:13px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#6b6b70;line-height:1.4;');
    wrap.appendChild(label);

    var row = document.createElement('div');
    row.setAttribute('style', 'display:flex;flex-wrap:wrap;gap:26px;align-items:flex-start;');

    if (bio.img) {
      var imgLink = document.createElement('a');
      imgLink.href = bio.url;
      imgLink.setAttribute('style', 'flex:0 0 120px;display:block;');
      var img = document.createElement('img');
      img.src = bio.img + (bio.img.indexOf('?') === -1 ? '?format=300w' : '');
      img.alt = bio.name;
      img.loading = 'lazy';
      img.setAttribute('style', 'width:120px;height:120px;object-fit:cover;border-radius:50%;display:block;');
      imgLink.appendChild(img);
      row.appendChild(imgLink);
    }

    var text = document.createElement('div');
    text.setAttribute('style', 'flex:1 1 260px;min-width:0;');

    var name = document.createElement('p');
    name.setAttribute('style', FONT + 'margin:0 0 10px;font-size:26px;font-weight:700;line-height:1.2;color:#222;');
    name.textContent = bio.name;
    text.appendChild(name);

    var ex = document.createElement('div');
    ex.className = 'pe-author-bio-excerpt';
    ex.innerHTML = bio.excerpt;
    // The site styles every paragraph and link at article size, so each needs the panel style set directly.
    var ps = ex.querySelectorAll('p');
    for (var j = 0; j < ps.length; j++) ps[j].style.cssText += ';' + TEXT + 'margin:0 0 8px;';
    var ls = ex.querySelectorAll('a');
    for (var k = 0; k < ls.length; k++) ls[k].style.cssText += ';color:' + BLUE + ';text-underline-offset:3px;';
    text.appendChild(ex);

    var more = document.createElement('p');
    more.setAttribute('style', FONT + 'margin:14px 0 0;font-size:16px;line-height:1.4;');
    var a = document.createElement('a');
    a.href = bio.url;
    a.textContent = 'Read more \u00a0\u2192';
    a.setAttribute('style', 'color:' + BLUE + ';text-decoration:none;');
    more.appendChild(a);
    text.appendChild(more);

    row.appendChild(text);
    wrap.appendChild(row);
    return wrap;
  }

  function run() {
    if (!isArticlePage()) { log('not an article page'); return; }
    if (document.querySelector('.pe-author-bio')) { log('already rendered'); return; }

    var article = document.querySelector('article') || document;
    if (article.querySelector('a[href*="' + BIOS_PATH + '/"]')) { log('manual bio present, skipping'); return; }

    var author = findAuthor();
    log('author:', author || '(none)');
    if (!author || SKIP.indexOf(norm(author)) !== -1) return;

    loadAllBios().then(function (bios) {
      var bio = findBio(bios, author);
      if (!bio) { log('no bio found for', author); return; }
      var target = null;
      for (var i = 0; i < TARGETS.length && !target; i++) target = document.querySelector(TARGETS[i]);
      if (!target) { log('no insertion point'); return; }
      if (document.querySelector('.pe-author-bio')) return;
      target.appendChild(buildBlock(bio));
      log('inserted bio for', bio.name, 'into', target);
    }).catch(function (e) { log('error', e); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
  // Squarespace AJAX page loads (7.0 templates)
  window.addEventListener('mercury:load', run);
})();
} catch (e) { if (window.console) console.warn('Production Expert script failed: automatic author bio', e); }

/* ================================================================
 * Production Expert: automatic Related Content section
 * On every article it shows up to three related posts (thumbnail and title) after the
 * article and author bio, independent of the hand-picked "You Might Also Find These
 * Articles Useful" block.
 *
 * How it picks them:
 * - Shared tags score highest (3 points each), shared specific categories score 1 each.
 * - Newest wins ties. The current post and anything already linked in the article are skipped.
 * - Partner posts (tag "partner") match on their brand tags only, never on category,
 * so a partner piece never recommends a competitor.
 * - Broad categories listed in BROAD are ignored for matching.
 *
 * It only loads when the reader nears the end of the article, so it never slows the page.
 * Results are cached in the browser for 6 hours.
 * Debug: add ?reldebug to an article URL and open the console.
 * ================================================================ */
try {
(function () {
  'use strict';

  var C = {
    max: 3,
    heading: 'Related Content',
    blog: '/production-expert-1',
    cacheHours: 6,
    tagFeeds: 2,
    ignoreTags: ['partner', 'no-contents'],
    BROAD: ['news', 'review', 'reviews', 'opinion', 'comment', 'interview', 'podcast', 'deal',
            'competition', 'advice', 'audio', 'music', 'discuss', 'event', 'just for fun', 'poll',
            'quiz', 'quick tip', 'jobs', 'business', 'case study', 'buying guide', 'free plug-in'],
    ink: '#222'
  };

  var DEBUG = /[?&]reldebug\b/.test(location.search);
  function log() { if (DEBUG && window.console) console.log.apply(console, ['[PE related]'].concat([].slice.call(arguments))); }
  function low(s) { return (s || '').toLowerCase().trim(); }

  function article() { return document.querySelector('body.view-item article.hentry'); }

  function linkValues(a, key) {
    var out = [], re = new RegExp('[?&]' + key + '=([^&]+)');
    var links = a.querySelectorAll('a[href*="' + key + '="]');
    for (var i = 0; i < links.length; i++) {
      var m = (links[i].getAttribute('href') || '').match(re);
      if (m) {
        var v = decodeURIComponent(m[1].replace(/\+/g, ' '));
        if (out.indexOf(v) === -1) out.push(v);
      }
    }
    return out;
  }

  function cacheGet(k) {
    try {
      var c = JSON.parse(localStorage.getItem(k) || 'null');
      if (c && Date.now() - c.t < C.cacheHours * 3600000) return c.v;
    } catch (e) {}
    return null;
  }
  function cacheSet(k, v) { try { localStorage.setItem(k, JSON.stringify({ t: Date.now(), v: v })); } catch (e) {} }

  // Header image from the post's promoted block, falling back to the first image in the body.
  function thumb(i) {
    var re = /data-(?:src|image)="(https:\/\/images\.squarespace-cdn\.com\/[^"]+)"/;
    var m = (i.promotedBlock || '').match(re) || (i.body || '').match(re);
    return m ? m[1].split('?')[0] : '';
  }

  function feed(param, value) {
    var url = C.blog + '?' + param + '=' + encodeURIComponent(value);
    var key = 'pe-rel:' + url;
    var hit = cacheGet(key);
    if (hit) { log('cache', url); return Promise.resolve(hit); }
    return fetch(url + '&format=json', { credentials: 'same-origin' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (d) {
        var slim = (d.items || []).map(function (i) {
          return { t: i.title, u: i.fullUrl, a: thumb(i), tg: i.tags || [], c: i.categories || [], p: i.publishOn || i.addedOn || 0 };
        });
        cacheSet(key, slim);
        log('fetched', url, slim.length);
        return slim;
      })
      .catch(function (e) { log('feed failed', url, e); return []; });
  }

  function build(items, a) {
    var ref = a.querySelector('.body.entry-content h3');
    var cs = ref ? getComputedStyle(ref) : null;

    var sec = document.createElement('section');
    sec.className = 'pe-ui pe-related';
    sec.setAttribute('aria-label', C.heading);
    sec.style.cssText = 'margin:40px 0 24px;';

    var h = document.createElement('h3');
    h.textContent = C.heading;
    h.style.cssText = 'margin:0 0 16px;';
    if (cs) { h.style.fontFamily = cs.fontFamily; h.style.fontWeight = cs.fontWeight; h.style.color = cs.color; h.style.fontSize = cs.fontSize; }
    sec.appendChild(h);

    var grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:20px;';

    items.forEach(function (it) {
      var card = document.createElement('a');
      card.href = it.u;
      card.style.cssText = 'display:block;text-decoration:none;color:' + C.ink + ';';

      var img = document.createElement(it.a ? 'img' : 'div');
      if (it.a) { img.src = it.a + '?format=500w'; img.alt = ''; img.loading = 'lazy'; }
      img.style.cssText = 'display:block;width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:3px;margin:0 0 10px;background:#eee;';
      card.appendChild(img);

      var t = document.createElement('span');
      t.textContent = it.t;
      t.style.cssText = 'display:block;font-family:"Open Sans",sans-serif;font-size:15px;font-weight:600;line-height:1.35;color:' + C.ink + ';';
      card.appendChild(t);
      grid.appendChild(card);
    });

    sec.appendChild(grid);
    return sec;
  }

  function run() {
    var a = article();
    if (!a || a.querySelector('.pe-related') || a.getAttribute('data-pe-related')) return;
    a.setAttribute('data-pe-related', '1');

    var body = a.querySelector('.body.entry-content');
    if (!body) return;

    var partner = a.classList.contains('tag-partner') || !!(window.PE && window.PE.partner);
    var tags = linkValues(a, 'tag').filter(function (t) { return C.ignoreTags.indexOf(low(t)) === -1; });
    var cats = linkValues(a, 'category').filter(function (c) { return C.BROAD.indexOf(low(c)) === -1; });
    log('partner:', partner, 'tags:', tags, 'cats:', cats);

    var here = location.pathname.replace(/\/$/, '');
    var linked = {};
    var bl = body.querySelectorAll('a[href]');
    for (var i = 0; i < bl.length; i++) {
      try { linked[new URL(bl[i].href, location.href).pathname.replace(/\/$/, '')] = 1; } catch (e) {}
    }

    var tagL = tags.map(low), catL = cats.map(low);

    function score(it) {
      var s = 0;
      it.tg.forEach(function (t) { if (tagL.indexOf(low(t)) !== -1) s += 3; });
      if (!partner) it.c.forEach(function (c) { if (catL.indexOf(low(c)) !== -1) s += 1; });
      return s;
    }

    function pick(lists) {
      var seen = {}, pool = [];
      lists.forEach(function (l) {
        l.forEach(function (it) {
          var p = (it.u || '').replace(/\/$/, '');
          if (!p || p === here || linked[p] || seen[p]) return;
          seen[p] = 1;
          it.s = score(it);
          if (it.s > 0) pool.push(it);
        });
      });
      // On partner posts, prefer focused articles over broad roundups that tag many brands.
      pool.sort(function (x, y) { return y.s - x.s || (partner ? x.tg.length - y.tg.length : 0) || y.p - x.p; });
      return pool.slice(0, C.max);
    }

    var jobs = tags.slice(0, C.tagFeeds).map(function (t) { return feed('tag', t); });

    Promise.all(jobs).then(function (lists) {
      var res = pick(lists);
      if (res.length >= C.max || partner || !cats.length) return res;
      return feed('category', cats[0]).then(function (cl) { return pick(lists.concat([cl])); });
    }).then(function (res) {
      log('results', res);
      if (!res.length) return;
      var sec = build(res, a);
      body.parentNode.insertBefore(sec, body.nextSibling);
    });
  }

  function arm() {
    var a = article();
    if (!a) return;
    var body = a.querySelector('.body.entry-content');
    if (!body) return;
    // Load once the reader is within roughly two screens of the end of the article.
    function check() {
      if (body.getBoundingClientRect().bottom < window.innerHeight + 1500) {
        removeEventListener('scroll', check);
        removeEventListener('resize', check);
        run();
      }
    }
    addEventListener('scroll', check, { passive: true });
    addEventListener('resize', check);
    check();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arm);
  else arm();
  addEventListener('mercury:load', arm);
})();
} catch (e) { if (window.console) console.warn('Production Expert script failed: automatic Related Content section', e); }

/* ================================================================
 * Production Expert: "Comments" label above the Disqus thread
 * Adds a small uppercase "Comments" label directly above the comments, in the same
 * style as the "About the author" label, so the comments read as part of the article.
 * Runs on blog posts only: on any page without Disqus comments it does nothing.
 * ================================================================ */
try {
(function () {
  function go() {
    // Find the Disqus comments container. If this page has none, or the label
    // is already there, stop.
    var t = document.getElementById('disqus_thread');
    if (!t || document.querySelector('.pe-comments-label')) return;

    // Build the label. "pe-ui" marks it as site furniture so the read time
    // script doesn't count it as article text.
    var l = document.createElement('p');
    l.className = 'pe-ui pe-comments-label';
    l.textContent = 'Comments';

    // Same font, size, spacing and grey as the "About the author" label.
    // The 48px top margin separates it from the content above.
    l.setAttribute('style', 'margin:48px 0 16px;font-family:"Open Sans",sans-serif;font-size:13px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#6b6b70;line-height:1.4;');

    // Place it immediately above the comments.
    t.parentNode.insertBefore(l, t);
  }

  // Run once the page has finished building, or straight away if it already has.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();

  // Run again when Squarespace loads a new page without a full refresh.
  addEventListener('mercury:load', go);
})();
} catch (e) { if (window.console) console.warn('Production Expert script failed: "Comments" label above the Disqus thread', e); }

/* ================================================================
 * Production Expert: "Was this article useful?" vote
 * What it does:
 * - Adds a small Yes / No prompt at the end of every article, just above the author bio.
 * - Each vote is sent to Plausible as a "Useful Vote" event. Plausible records the page
 * automatically, and the script adds the vote (yes/no) and the author's name as properties.
 * - Readers only ever see a thank-you message (set in "thanks" below). There is no public count.
 * - Each reader can vote once per article. Their vote is remembered in their own browser,
 * so returning readers see the thank-you message instead of the buttons.
 *
 * One-off setup in Plausible (Site settings):
 * 1. Goals > Add goal > Custom event, named exactly: Useful Vote
 * 2. Custom properties > add "vote" and "author" so you can break results down by them.
 *
 * Debug: add ?usefuldebug to an article URL and open the console. In debug mode votes
 * are logged to the console instead of being sent, and the "already voted" memory is ignored.
 * ================================================================ */
try {
(function () {
  'use strict';

  /* ---------- SETTINGS ---------- */
  var C = {
    question: 'Was this article useful?',
    thanks: 'Thanks for letting us know. It helps ensure we create content that supports audio professionals.',
    event: 'Useful Vote',            // must match the goal name in Plausible exactly
    orange: '#e87722',               // Production Expert orange, used for the buttons
    storeKey: 'pe-useful:'           // prefix for the per-article "already voted" memory
  };
  /* ------------------------------ */

  var DEBUG = /[?&]usefuldebug\b/.test(location.search);
  function log() { if (DEBUG && window.console) console.log.apply(console, ['[PE useful]'].concat([].slice.call(arguments))); }

  // The article body on Production Expert's Squarespace 7.0 template.
  function body() { return document.querySelector('body.view-item article.hentry .body.entry-content'); }

  // The author's name from the "Posted by" link, sent with the vote so results
  // can be compared by author in Plausible.
  function author() {
    var a = document.querySelector('article.hentry a[href*="?author="]');
    return a ? a.textContent.trim() : '';
  }

  // Remember a vote in the reader's own browser. Wrapped in try/catch because
  // private browsing modes can block storage; the vote still counts if so.
  function voted() { try { return !DEBUG && localStorage.getItem(C.storeKey + location.pathname); } catch (e) { return null; } }
  function remember(v) { try { localStorage.setItem(C.storeKey + location.pathname, v); } catch (e) {} }

  // Send the vote to Plausible, or log it in debug mode.
  function send(vote) {
    var props = { vote: vote, author: author() };
    if (DEBUG) { log('would send', C.event, props); return; }
    if (typeof window.plausible === 'function') window.plausible(C.event, { props: props });
  }

  // Shared text style: Open Sans, in line with the contents box and bio panel.
  var FONT = 'font-family:"Open Sans",sans-serif;';

  // One Yes or No button: white with an orange outline.
  function button(label, vote, box) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.setAttribute('style', FONT + 'font-size:14px;font-weight:600;line-height:1;padding:9px 20px;border:1.5px solid ' + C.orange +
      ';border-radius:999px;background:#fff;color:' + C.orange + ';cursor:pointer;');
    b.addEventListener('click', function () {
      send(vote);
      remember(vote);
      thank(box);
    });
    return b;
  }

  // Replace the question and buttons with the thank-you line.
  function thank(box) {
    box.innerHTML = '';
    var p = document.createElement('p');
    p.textContent = C.thanks;
    p.setAttribute('style', FONT + 'margin:0;font-size:15px;line-height:1.5;color:#333;');
    box.appendChild(p);
  }

  function build() {
    // Grey panel matching the contents box and bio panel.
    var box = document.createElement('div');
    box.className = 'pe-ui pe-useful';   // "pe-ui" keeps it out of the read time count
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', C.question);
    box.setAttribute('style', 'margin:36px 0 0;padding:16px 24px;background:#f4f4f4;border-radius:6px;display:flex;flex-wrap:wrap;align-items:center;gap:12px 16px;');

    // Readers who have already voted on this article just see the thank-you line.
    if (voted()) { thank(box); return box; }

    var q = document.createElement('p');
    q.textContent = C.question;
    q.setAttribute('style', FONT + 'margin:0;font-size:15px;font-weight:700;line-height:1.4;color:#222;');
    box.appendChild(q);

    var btns = document.createElement('div');
    btns.setAttribute('style', 'display:flex;gap:10px;');
    btns.appendChild(button('Yes', 'yes', box));
    btns.appendChild(button('No', 'no', box));
    box.appendChild(btns);
    return box;
  }

  function run() {
    var b = body();
    if (!b || b.querySelector('.pe-useful')) return;   // not an article, or already added

    // Add it at the end of the article body. The author bio script adds its panel to
    // the same place slightly later, so the order on the page is:
    // article > "Was this article useful?" > About the author > Related Content > Comments.
    var bio = b.querySelector('.pe-author-bio');
    var box = build();
    if (bio) b.insertBefore(box, bio); else b.appendChild(box);
    log('added');
  }

  // Run once the page has finished building, and again on Squarespace's in-place page loads.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
  addEventListener('mercury:load', run);
})();
} catch (e) { if (window.console) console.warn('Production Expert script failed: "Was this article useful?" vote', e); }

/* ================================================================
 * Production Expert: newsletter sign-up inside articles
 * Places a sign-up box in the article, styled to match the site:
 * - before the third section of articles with four or more sections
 * - otherwise just before "You Might Also Find These Articles Useful"
 * Never on partner posts, never twice, and never where a Kit form is already in the article.
 * clear:both keeps the box below any floated image, so it never runs behind one (30 Oct 2026).
 * Sign-ups go to the existing Kit form (2954485) and land on the existing thank-you page.
 * ================================================================ */
try {
(function () {
  var C = {
    action: 'https://app.kit.com/forms/2954485/subscriptions',
    headline: "Make sure you don't miss a thing!",
    sub: 'Free plugins, deals, and news for audio professionals.',
    button: 'Sign up now',
    note: 'We respect your privacy. Unsubscribe at any time.',
    accent: '#222' // button colour: change to your brand hex if needed
  };

  function spot(body) {
    var hs = body.querySelectorAll('h3'), sections = [], related = null;
    for (var i = 0; i < hs.length; i++) {
      if (/you might(?:\s+also)?\s+find\s+th(?:ese|is)/i.test(hs[i].textContent)) { related = hs[i]; break; }
      sections.push(hs[i]);
    }
    if (sections.length >= 4) return sections[2];
    return related;
  }

  function build() {
    var a = document.querySelector('body.view-item article.hentry');
    if (!a || a.querySelector('.pe-signup')) return;
    if (a.classList.contains('tag-partner') || document.documentElement.classList.contains('pe-partner')) return;
    var body = a.querySelector('.body.entry-content');
    if (!body || body.querySelector('.formkit-form, form[action*="kit.com"], form[action*="convertkit"]')) return;
    var at = spot(body);
    if (!at) return;

    var box = document.createElement('div');
    box.className = 'pe-ui pe-signup';
    box.innerHTML =
      '<style>' +
      '.pe-signup{clear:both;margin:2rem 0;padding:22px 24px;background:#f4f4f4;border-radius:4px;font-family:"Open Sans",sans-serif;color:#222}' +
      '.pe-signup .pe-su-h{margin:0 0 4px;font-size:19px;font-weight:700;line-height:1.3;color:#222}' +
      '.pe-signup .pe-su-s{margin:0 0 14px;font-size:15px;line-height:1.45;color:#444}' +
      '.pe-signup form{display:flex;flex-wrap:wrap;gap:10px;margin:0}' +
      '.pe-signup input{flex:1 1 180px;min-width:0;padding:11px 12px;border:1px solid #d5d8dc;border-radius:3px;background:#fff;font:15px "Open Sans",sans-serif;color:#222}' +
      '.pe-signup input:focus{outline:2px solid ' + C.accent + ';outline-offset:-1px;border-color:' + C.accent + '}' +
      '.pe-signup button{flex:0 0 auto;padding:11px 22px;border:0;border-radius:3px;background:' + C.accent + ';color:#fff;font:700 15px "Open Sans",sans-serif;cursor:pointer}' +
      '.pe-signup button:hover{filter:brightness(1.1)}' +
      '.pe-signup .pe-su-n{margin:10px 0 0;font-size:12px;color:#777}' +
      '@media (max-width:600px){.pe-signup button{flex-basis:100%}}' +
      '</style>' +
      '<p class="pe-su-h"></p><p class="pe-su-s"></p>' +
      '<form method="post">' +
      '<input type="text" name="fields[first_name]" placeholder="First name" aria-label="First name" autocomplete="given-name" required>' +
      '<input type="email" name="email_address" placeholder="Email address" aria-label="Email address" autocomplete="email" required>' +
      '<button type="submit"></button>' +
      '</form><p class="pe-su-n"></p>';
    box.querySelector('.pe-su-h').textContent = C.headline;
    box.querySelector('.pe-su-s').textContent = C.sub;
    box.querySelector('button').textContent = C.button;
    box.querySelector('.pe-su-n').textContent = C.note;
    box.querySelector('form').action = C.action;

    at.parentNode.insertBefore(box, at);
  }

  build();
  addEventListener('load', build);
  addEventListener('mercury:load', build);
})();
} catch (e) { if (window.console) console.warn('Production Expert script failed: newsletter sign-up inside articles', e); }

/* ================================================================
 * Production Expert: pre-publish checklist (team only)
 * A checklist panel in the corner of every post, only for people logged in to Squarespace.
 * Readers never see it. Ticks are shared by the whole team through the Google Sheet.
 * - Shows only what matters: problems first, then unticked checks; ticked checks fold
 * into one line. When everything is done it shrinks to a small pill, and on published
 * posts with nothing wrong it disappears.
 * - Automatic checks: alt text, meta description, partner tag, internal links in the article,
 * broken internal links, heading order and hero image. They warn but never block.
 * - Scheduled posts with checks missing get a red bar across the top of the page.
 * - Edits made more than 10 minutes after the last tick bring the panel back.
 * - "Help me write" opens a floating window with suggested headlines, meta descriptions, URLs and
 * alt text, written by Claude through the Google Sheet, each with a Use button that fills it into Squarespace. Its Links tab
 * suggests internal links on words already in the draft and adds them with one click. Like the panel,
 * drag its title bar to move it, click to shrink it, double-click to put it back in the corner.
 * - Reports each post's stage to the Google Sheet for the content pipeline dashboard.
 * - "Flag for author" in the Notes box emails the author a content issue; it stays a red warning
 * until someone marks it resolved (see the Notes section).
 * If the panel ever fails to appear for someone on the team, open any post with
 * ?checklist on the end of its address once, and it will always show in that browser.
 * ================================================================ */
try {
(function () {
  var C = {
    store: 'https://script.google.com/macros/s/AKfycbzKBcQln1DzO_Ml9_5KWZG_Rh_M-Px2TgHDYtYIbncl_9IXEjICvYz0448k1E3H9UAYeQ/exec',
    items: ['Title, SEO and URL', 'Content and grammar', 'Image check', 'Schedule'],
    blue: '#006eb3',
    green: '#3b6d11',
    red: '#c62828',
    amber: '#b26a00',
    graceMins: 10,  // edits within this long of the last tick don't bring the panel back
    metaMin: 140,   // meta description length range, in characters (house SEO rules)
    metaMax: 160,
    titleMax: 60,   // SEO title length Google shows before cutting off
  };
  // Font for the team panels. 'PE UI Sans' is Open Sans loaded by styleUp() under a private name;
  // the plain 'Open Sans' after it covers the moment before that has loaded.
  var F = "'PE UI Sans','Open Sans',sans-serif";

  /* Version of pe-site.js, shown beside JOE in Joe's title bar, so anyone can say which copy their
   * browser is running. Raise it with every push: the second number for fixes and small changes,
   * the first for a new feature. Start the commit message with the version ("v1.1: ...") and add
   * the commit to this list once it's pushed, so a rollback is one step: put that commit's two
   * files back on main.
   *   0.9  30 Oct 2026  7217ed2  Before versions began
   *   1.0  30 Oct 2026  7a5e6ac  Image tab in Joe (testing, RH only); version shown in Joe
   *   1.1  30 Oct 2026  e46e1ab  Image tab: Place as hero puts the crop into the top image block
   *   1.2  30 Oct 2026  e9ff08a  Links and Image tabs, and the internal links check, on for the whole team
   *   1.3  30 Oct 2026  (this)   Image tab starts with Add image; Depositphotos search folded in, with a
   *                              sign-in reminder and a warning on files under 1000px wide */
  var PE_VERSION = '1.3';
  try { console.info('Production Expert site scripts v' + PE_VERSION); } catch (e) {}

  function ls(k, v) {
    try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; }
  }
  function isTeam() {
    if (/[?&]checklist\b/.test(location.search)) ls('pe-team', '1');
    var ctx = (window.Static && Static.SQUARESPACE_CONTEXT) || {};
    var inEditor = false;
    try { inEditor = window.top !== window; } catch (e) { inEditor = true; }
    return !!ctx.authenticatedAccount || inEditor || ls('pe-team') === '1';
  }
  function el(tag, css, text) {
    var e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (text != null) e.textContent = text;
    return e;
  }

  var state = {}, post, panel, pill, list, head, hideTimer, banner, drawer;
  var loaded = false, firstLoad = true;
  var scheduledFor = 0;         // publish time if the post is scheduled for the future
  var editedAt = 0;             // when the post was last saved
  var postData = {};            // the post's own record from Squarespace
  var auto = [];                // results of the automatic checks
  var linkCache = {};           // internal link address: true if it works
  var lastReport = '';          // what was last sent to the pipeline dashboard
  var statusErr = '';           // why asking Squarespace for the post's status failed, if it did
  var reportErr = '';           // why the last dashboard update failed, if it did
  var started = Date.now();
  var altSuggest = {};          // image address: { status, text }
  var writeSuggest = {};        // task: { status, options, error }
  var mode = null;              // 'open' or 'pill' once someone has clicked; null follows the rules
  var showDone = false, drawerTab = 'headlines';
  var force = /[?&]checklist\b/.test(location.search);
  var guarded = document.documentElement.classList.contains('pe-editor'); // set by the editor guard in the Header
  var hist = null;              // this post's edit history from the Google Sheet, newest first (null until loaded)
  var histOpen = false;         // true while the History list is showing in the panel
  var histScroll = 0;           // keeps the History list's scroll position when the panel redraws
  var seenSave = 0;             // the last save time this browser has sent to the history
  var seenStatus = '';          // the status that went with it, so a status change on its own is noticed

  function postTitle() {
    if (postData.title) return postData.title;
    if (postData.title) return postData.title;
    var ctx = (window.Static && Static.SQUARESPACE_CONTEXT) || {};
    if (ctx.item && ctx.item.title) return ctx.item.title;
    var h = document.querySelector('article.hentry .entry-title');
    var t = h ? h.textContent.replace(/\s+/g, ' ').trim() : '';
    if (t) return t;
    var og = document.querySelector('meta[property="og:title"]');
    return ((og && og.content) || document.title).split(' | ')[0];
  }
  function who() {
    var w = ls('pe-initials');
    if (!w) {
      w = (prompt('Your initials, so the team can see who ticked what:') || '').trim().toUpperCase().slice(0, 4);
      if (w) ls('pe-initials', w);
    }
    return w || '?';
  }

  function call(params) {
    var q = Object.keys(params).map(function (k) { return k + '=' + encodeURIComponent(params[k]); }).join('&');
    return fetch(C.store + '?' + q).then(function (r) { return r.json(); }).then(function (d) {
      if (d && !d.error) { state = d; loaded = true; draw(); firstLoad = false; }
    }).catch(function () {
      loaded = true;
      draw();
      head.lastChild.textContent = 'offline';
    });
  }

  /* ---------- Stage ---------- */

  function counts() {
    var done = 0, lastTick = 0;
    C.items.forEach(function (i) { var s = state[i] || {}; if (s.done) { done++; if (s.when > lastTick) lastTick = s.when; } });
    var all = done === C.items.length;
    // Ready to schedule: every check except the last one (Schedule) is ticked
    var preSchedule = C.items.slice(0, -1).every(function (i) { return (state[i] || {}).done; });
    var autoWarn = auto.filter(function (r) { return !r.ok; }).length;
    return {
      done: done, all: all, preSchedule: preSchedule, autoWarn: autoWarn,
      warn: scheduledFor > Date.now() && !all,
      stale: all && lastTick && editedAt > lastTick + C.graceMins * 60000
    };
  }
  // Squarespace's own status, confirmed by testing: 1 is published, 2 is scheduled, 3 is needs review, 4 is draft
  function stageOf(c) {
    var wf = +postData.workflowState || 0;
    var live = (wf === 1 || wf === 2) && +postData.publishOn && +postData.publishOn <= Date.now(); // a scheduled post whose time has come is live
    return scheduledFor > Date.now() ? 'Scheduled'
      : live && c.stale ? 'Edited since checked'
      : live ? 'Published'
      : c.stale ? 'Edited since checked'
      : wf === 3 ? 'In review'
      : c.preSchedule && !c.autoWarn ? 'Ready to schedule'
      : c.done ? 'Checks in progress' : 'Draft';
  }

  /* ---------- Embargo ----------
   * Some posts can't go out before a set time. Anyone on the team can give a post an embargo
   * in the panel (date, time and the time zone the embargo was given in, since press embargoes
   * often come in US time). It's kept per post in the Embargoes tab of the Google Sheet.
   * While the embargo hasn't lifted, the automatic checks warn, in red:
   * - a draft or review post whose planned date is before the embargo (before it's scheduled)
   * - a scheduled post set to go out before the embargo (the red bar shows too)
   * - a live post published before the embargo (the red bar shows too)
   * Like every warning, it never blocks Squarespace; it makes the problem impossible to miss.
   * Setting, changing and removing an embargo also go into the edit history. */
  var embargo = { at: 0, tz: '', by: '' };      // from the Google Sheet; at 0 means no embargo
  var embBox = null;                            // the embargo line in the panel, built once
  var embEditing = false;                       // true while the date and time boxes are showing
  var ZONES = [['Europe/London', 'UK'], ['America/New_York', 'US Eastern'], ['America/Los_Angeles', 'US Pacific'], ['Europe/Berlin', 'Central Europe']];

  function zoneName(tz) {
    for (var i = 0; i < ZONES.length; i++) if (ZONES[i][0] === tz) return ZONES[i][1];
    return tz;
  }
  // A time as it reads in a given zone: 'Thu 29 Oct, 17:00'
  function inZone(t, tz) {
    return new Date(t).toLocaleString('en-GB', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
  // The embargo in UK time, plus the zone it was given in when that's different
  function embText(t, tz) {
    var uk = inZone(t, 'Europe/London') + ' UK';
    return tz && tz !== 'Europe/London' ? uk + ' (' + inZone(t, tz) + ' ' + zoneName(tz) + ')' : uk;
  }
  // How far a zone's clock is ahead of UTC at a given moment, in milliseconds (allows for summer time)
  function zoneOffset(t, tz) {
    var parts = {};
    new Intl.DateTimeFormat('en-GB', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      .formatToParts(new Date(t)).forEach(function (x) { parts[x.type] = +x.value; });
    return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute) - Math.floor(t / 60000) * 60000;
  }
  // '2026-10-29' and '09:00' in US Pacific (say) as an exact moment
  function zonedTime(dateStr, timeStr, tz) {
    var d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr || ''), h = /^(\d{2}):(\d{2})$/.exec(timeStr || '');
    if (!d || !h) return 0;
    var wall = Date.UTC(+d[1], d[2] - 1, +d[3], +h[1], +h[2]);
    var t = wall - zoneOffset(wall, tz);
    return wall - zoneOffset(t, tz); // second pass gets it right on the days the clocks change
  }
  // The other way: an exact moment as date and time boxes in a zone
  function zonedParts(t, tz) {
    var p = {};
    new Intl.DateTimeFormat('en-GB', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      .formatToParts(new Date(t)).forEach(function (x) { p[x.type] = x.value; });
    return { date: p.year + '-' + p.month + '-' + p.day, time: p.hour + ':' + p.minute };
  }

  // Reads the post's embargo from the sheet, or saves a new one (extra holds at, tz, by)
  function embargoCall(extra) {
    var data = { action: 'emb', post: post };
    if (extra) { data.set = 1; data.title = postTitle(); Object.keys(extra).forEach(function (k) { data[k] = extra[k]; }); }
    var q = Object.keys(data).map(function (k) { return k + '=' + encodeURIComponent(data[k]); }).join('&');
    return fetch(C.store + '?' + q).then(function (r) { return r.json(); }).then(function (d) {
      if (!d || !d.ok) throw new Error((d && d.error) || 'no reply');
      var e = d.embargo || {};
      var changed = (+e.at || 0) !== embargo.at || (e.tz || '') !== embargo.tz;
      embargo = { at: +e.at || 0, tz: e.tz || '', by: e.by || '' };
      if (extra) { embEditing = false; getHistory(); }  // the sheet logged the change in the history
      if (changed || extra) { renderEmbargo(); refreshAuto(); }
    });
  }

  // The automatic check, added to the others by runAuto
  function embargoCheck() {
    if (!embargo.at || embargo.at <= Date.now()) return null; // no embargo, or it has lifted
    var wf = +postData.workflowState || 0, t = +postData.publishOn || 0, lift = embText(embargo.at, embargo.tz);
    if (wf === 1 && t && t <= Date.now())
      return { ok: false, kind: 'embargo', live: true, text: 'Live before the embargo lifts on ' + lift, bar: 'This post is live, but the embargo lifts on ' + lift };
    if (scheduledFor && scheduledFor < embargo.at)
      return { ok: false, kind: 'embargo', text: 'Scheduled for ' + inZone(scheduledFor, 'Europe/London') + ', before the embargo lifts on ' + lift, bar: 'This goes out before the embargo lifts on ' + lift };
    // Squarespace keeps a planned date on drafts and review posts; only a future one is a real plan
    if ((wf === 3 || wf === 4) && t > Date.now() && t < embargo.at)
      return { ok: false, kind: 'embargo', text: 'Planned date ' + inZone(t, 'Europe/London') + ' is before the embargo lifts on ' + lift };
    return { ok: true, text: 'Embargoed until ' + lift };
  }

  // The embargo line under the panel's title bar. Kept out of the part draw() rebuilds, so typing
  // a date isn't wiped by the panel refreshing every 30 seconds.
  function renderEmbargo() {
    if (!embBox) return;
    embBox.innerHTML = '';
    var small = 'padding:3px 9px;border:1px solid #d5d9de;border-radius:5px;background:#fff;font:600 11.5px/1.6 ' + F + ';color:#333;cursor:pointer;';
    function btn(text, css, onclick) { var b = el('button', css, text); b.type = 'button'; b.onclick = onclick; return b; }

    if (embEditing) {
      var start = embargo.at ? zonedParts(embargo.at, embargo.tz || 'Europe/London') : { date: '', time: '09:00' };
      var form = el('div', 'margin:10px 0 2px;padding:10px 12px;border:1px solid #eceef1;border-radius:6px;background:#fafbfc;');
      form.appendChild(el('div', 'margin-bottom:6px;font:700 10.5px ' + F + ';letter-spacing:.08em;text-transform:uppercase;color:#7a8088;', 'Embargo lifts'));
      var field = 'padding:5px 6px;border:1px solid #d5d9de;border-radius:5px;background:#fff;font:13px ' + F + ';color:#222;';
      var row = el('div', 'display:flex;gap:6px;flex-wrap:wrap;');
      var dIn = el('input', field + 'flex:1 1 130px;'); dIn.type = 'date'; dIn.value = start.date;
      var tIn = el('input', field + 'flex:0 0 92px;'); tIn.type = 'time'; tIn.value = start.time;
      var zIn = el('select', field + 'flex:1 1 100%;');
      ZONES.forEach(function (z) { var o = el('option', '', z[1] + ' time'); o.value = z[0]; zIn.appendChild(o); });
      zIn.value = embargo.tz || 'Europe/London';
      row.appendChild(dIn); row.appendChild(tIn); row.appendChild(zIn);
      form.appendChild(row);
      var msg = el('div', 'min-height:0;margin-top:6px;font-size:12px;color:#80868d;');
      function preview() { // shows the time in the UK as it's typed, so a US embargo is easy to check
        var t = zonedTime(dIn.value, tIn.value, zIn.value);
        msg.style.color = '#80868d';
        msg.textContent = t ? 'Lifts ' + embText(t, zIn.value) : '';
      }
      dIn.oninput = tIn.oninput = zIn.onchange = preview;
      preview();
      form.appendChild(msg);
      var acts = el('div', 'display:flex;gap:6px;margin-top:8px;');
      var save = btn('Save embargo', 'padding:5px 12px;border:1px solid ' + C.blue + ';border-radius:5px;background:' + C.blue + ';font:700 12px/1.6 ' + F + ';color:#fff;cursor:pointer;', function () {
        var t = zonedTime(dIn.value, tIn.value, zIn.value);
        if (!t) { msg.style.color = C.red; msg.textContent = 'Add a date and a time.'; return; }
        save.disabled = true; save.textContent = 'Saving…';
        embargoCall({ at: t, tz: zIn.value, by: who() }).catch(function (e) {
          save.disabled = false; save.textContent = 'Save embargo';
          msg.style.color = C.red; msg.textContent = 'Not saved: ' + (e.message || e) + '. Try again.';
        });
      });
      acts.appendChild(save);
      acts.appendChild(btn('Cancel', small, function () { embEditing = false; renderEmbargo(); }));
      form.appendChild(acts);
      embBox.appendChild(form);
      return;
    }

    if (!embargo.at) {
      embBox.appendChild(btn('+ Add an embargo', 'margin:10px 0 0;padding:0;border:0;background:none;font:600 12px ' + F + ';color:' + C.blue + ';cursor:pointer;',
        function () { embEditing = true; renderEmbargo(); }));
      return;
    }
    var future = embargo.at > Date.now();
    // The embargo on its own lines, with Change and Remove underneath so the text has the full width
    var line = el('div', 'margin:10px 0 0;padding:9px 11px;border-radius:6px;font-size:12.5px;line-height:1.45;' +
      (future ? 'background:#fdecea;color:#7a1d17;' : 'background:#f6f7f9;color:#5a6068;'));
    line.appendChild(el('div', 'font-weight:700;', (future ? '🔒 Embargoed until ' : 'Embargo lifted ') + inZone(embargo.at, 'Europe/London') + ' UK'));
    var sub = [];
    if (embargo.tz && embargo.tz !== 'Europe/London') sub.push(inZone(embargo.at, embargo.tz) + ' ' + zoneName(embargo.tz));
    if (embargo.by) sub.push('set by ' + embargo.by);
    var foot = el('div', 'display:flex;align-items:center;gap:6px;margin-top:4px;');
    foot.appendChild(el('span', 'flex:1;opacity:.85;', sub.join(' · ')));
    foot.appendChild(btn('Change', small, function () { embEditing = true; renderEmbargo(); }));
    foot.appendChild(btn('Remove', small, function () {
      embargoCall({ at: 0, tz: '', by: who() }).catch(function () {});
    }));
    line.appendChild(foot);
    embBox.appendChild(line);
  }

  /* ---------- Notes ----------
   * A shared notes box at the bottom of the panel for anything the checks don't cover
   * ("waiting on a quote from the developer", "hold the hero image until Thursday").
   * Each note is kept per post in the Notes tab of the Google Sheet with the initials of
   * whoever left it and the time, so everyone opening the post sees the same notes.
   * Anyone on the team can remove a note; adding and removing both go into the edit history.
   * The box stays hidden until the sheet answers with notes, so this part does nothing
   * until the Code.gs with the Notes section has been deployed.
   *
   * Flag for author (since 29 Oct 2026): the same text box, sent as a content issue instead of a
   * note. The sheet emails the post's author (and the reviewer, if someone else has taken the
   * review) with an "I've read this" button. The flag shows in red at the top of the notes and as
   * a red automatic warning until someone marks it Resolved. Read and resolved are kept apart:
   * read means the author has seen it, resolved means it's fixed. The button only appears once
   * the sheet says it can handle flags ("flags: 1" in its answer). */
  var notes = null;                             // this post's notes from the sheet, oldest first (null until the sheet answers)
  var notesBox = null, notesList = null;        // built once; only the list part is redrawn
  var flagBtn = null;                           // the Flag for author button, shown once the sheet can take flags
  var flagsOn = false;                          // the sheet answered with flags: 1
  var NOTE_MAX = 800;                           // characters per note, so a note always fits in one request

  // The person logged in to Squarespace, from the page's own record of their account.
  // Used so flag emails reach the right author and read buttons show only to them.
  function account() {
    var ctx = (window.Static && Static.SQUARESPACE_CONTEXT) || {};
    var a = ctx.authenticatedAccount || {};
    return { id: a.id || '', name: a.displayName || '', first: a.firstName || '', email: a.email || '' };
  }
  // The post's author, as Squarespace records it
  function authorOf() {
    var a = postData.author || {};
    return { id: postData.authorId || a.id || '', name: a.displayName || [a.firstName, a.lastName].filter(Boolean).join(' ') || '' };
  }
  // Tells the sheet who is logged in, once a day per browser, so flag emails have an address
  // to go to. Sent in the body of a request, never in the address.
  function registerMe() {
    var me = account();
    if (!me.id || !me.email) return;
    var mark = me.id + '|' + new Date().toISOString().slice(0, 10);
    if (ls('pe-acct-sent') === mark) return;
    fetch(C.store, { method: 'POST', body: JSON.stringify({ action: 'whoami', id: me.id, name: me.name, first: me.first, email: me.email }) })
      .then(function (r) { return r.json(); }).then(function (d) { if (d && d.ok) ls('pe-acct-sent', mark); }).catch(function () {});
  }

  // Takes the sheet's answer to a notes or flag request and redraws what changed
  function gotNotes(d, logged) {
    var before = JSON.stringify(notes), wasOn = flagsOn;
    notes = d.notes;
    flagsOn = !!d.flags;
    if (logged) getHistory();                   // the sheet logged the change in the history
    if (JSON.stringify(notes) !== before || flagsOn !== wasOn) { renderNotes(); refreshAuto(); }
  }

  // Reads the post's notes, or adds or removes one (extra holds add/text or del), then redraws the list
  function notesCall(extra) {
    var data = { action: 'notes', post: post };
    if (extra) { data.title = postTitle(); data.by = who(); Object.keys(extra).forEach(function (k) { data[k] = extra[k]; }); }
    var q = Object.keys(data).map(function (k) { return k + '=' + encodeURIComponent(data[k]); }).join('&');
    return fetch(C.store + '?' + q).then(function (r) { return r.json(); }).then(function (d) {
      // An older Code.gs answers this with the ordinary checklist read, which has no notes: stay hidden
      if (!d || !d.ok || !d.notes) { if (extra) throw new Error((d && d.error) || 'the sheet needs the Notes update'); return; }
      gotNotes(d, !!extra);
      return d;
    });
  }

  // The flag buttons: op add (with text), send (with id and to), read or done (with id).
  // Sent as the body of the request, since it carries the account's email address.
  function flagCall(op, extra) {
    var au = authorOf();
    var data = { action: 'flag', op: op, post: post, title: postTitle(), by: who(), me: account(),
      authorId: au.id, author: au.name, url: postData.fullUrl || location.pathname };
    Object.keys(extra || {}).forEach(function (k) { data[k] = extra[k]; });
    return fetch(C.store, { method: 'POST', body: JSON.stringify(data) }).then(function (r) { return r.json(); }).then(function (d) {
      if (!d || !d.ok) throw new Error((d && d.error) || 'no reply');
      gotNotes(d, true);
      return d;
    });
  }

  var smallBtn = 'padding:3px 9px;border:1px solid #d5d9de;border-radius:5px;background:#fff;font:600 11.5px/1.6 ' + F + ';color:#333;cursor:pointer;';

  // While someone is editing a note, the list isn't redrawn under them (the 30-second refresh
  // would wipe what they're typing). It catches up as soon as they save or cancel.
  var editingNote = null, notesWaiting = false;

  // A note's text, selectable so it can be copied, plus "edited" when it has been changed
  function noteText(n) {
    var box = el('div');
    var t = el('div', 'white-space:pre-wrap;word-wrap:break-word;color:#222;user-select:text;-webkit-user-select:text;cursor:text;', n.text); // keeps the writer's line breaks
    t.className = 'pe-sel';
    box.appendChild(t);
    if (n.editedAt) box.appendChild(el('div', 'margin-top:2px;font-size:11px;color:#a0a6ad;', 'Edited by ' + (n.editedBy || '?') + ' ' + when(n.editedAt)));
    return box;
  }

  // The Edit button: turns the note into a text box with Save and Cancel, in place
  function editBtn(n, card, textBox) {
    var b = el('button', 'padding:0 4px;border:0;background:none;font:600 11.5px/1 ' + F + ';color:' + C.blue + ';cursor:pointer;', 'Edit');
    b.type = 'button';
    b.title = 'Change the wording of this note';
    b.onclick = function () {
      if (editingNote) return;
      editingNote = n.id;
      var box = el('div');
      var area = el('textarea', 'display:block;box-sizing:border-box;width:100%;min-height:70px;padding:7px 9px;border:1px solid #d5d9de;border-radius:6px;' +
        'resize:vertical;background:#fff;font:13px/1.45 ' + F + ';color:#222;');
      area.value = n.text;
      area.maxLength = NOTE_MAX;
      var row = el('div', 'display:flex;align-items:center;gap:6px;margin-top:6px;');
      var msg = el('span', 'flex:1;font-size:11.5px;color:' + C.red + ';');
      var cancel = el('button', smallBtn, 'Cancel');
      var save = el('button', 'padding:3px 10px;border:1px solid ' + C.blue + ';border-radius:5px;background:' + C.blue + ';font:700 11.5px/1.6 ' + F + ';color:#fff;cursor:pointer;', 'Save');
      cancel.type = save.type = 'button';
      function done() { editingNote = null; renderNotes(); }
      cancel.onclick = done;
      save.onclick = function () {
        var text = area.value.trim();
        if (!text) { msg.textContent = 'A note can\'t be empty.'; area.focus(); return; }
        if (text === n.text) { done(); return; }
        save.disabled = cancel.disabled = true; save.textContent = 'Saving…';
        editingNote = null;   // let the answer redraw the list
        notesCall({ edit: n.id, text: text.slice(0, NOTE_MAX) }).then(function (d) {
          // An older Code.gs ignores edits: say so rather than look as if it saved
          var now = (d && d.notes || []).filter(function (x) { return x.id === n.id; })[0];
          if (!now || now.text !== text.slice(0, NOTE_MAX)) throw new Error('the sheet needs the latest Code.gs');
          renderNotes();
        }).catch(function (e) {
          editingNote = n.id;
          save.disabled = cancel.disabled = false; save.textContent = 'Save';
          msg.textContent = 'Not saved: ' + (e.message || e) + '. Try again.';
        });
      };
      area.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save.click(); }
        if (e.key === 'Escape') { e.preventDefault(); done(); }
      });
      row.appendChild(msg); row.appendChild(cancel); row.appendChild(save);
      box.appendChild(area); box.appendChild(row);
      card.replaceChild(box, textBox);
      b.style.display = 'none';
      area.focus();
    };
    return b;
  }

  // One flagged issue: red edge, who raised it, the note, then where it's up to and its buttons
  function flagCard(n) {
    var open = n.flag === 'open', me = account();
    var card = el('div', 'margin:0 0 6px;padding:8px 10px;border:1px solid ' + (open ? '#f2c4c0' : '#eceef1') + ';border-left:4px solid ' + (open ? C.red : '#b9bdc3') +
      ';border-radius:6px;background:' + (open ? '#fdf3f2' : '#fafbfc') + ';font-size:12.5px;line-height:1.45;');
    var top = el('div', 'display:flex;align-items:center;gap:6px;margin-bottom:2px;font-size:11.5px;color:#80868d;');
    top.appendChild(el('span', 'font-weight:700;color:' + (open ? C.red : '#5a6068') + ';', open ? '⚑ Content issue' : '✓ Issue resolved'));
    top.appendChild(el('span', 'font-weight:700;color:#222;', n.by || '?'));
    top.appendChild(el('span', 'flex:1;font-variant-numeric:tabular-nums;', when(+n.at)));
    var textBox = noteText(n);
    top.appendChild(editBtn(n, card, textBox));
    if (!open) top.appendChild(removeX(n));                                 // only a resolved issue can be removed
    card.appendChild(top);
    card.appendChild(textBox);

    // Where it's up to, in one grey line
    var bits = [];
    if (n.emailed) bits.push('Emailed to ' + n.emailed);
    else if (n.authorId && n.authorId === me.id) bits.push('Your own post, so no email was sent');
    else if (open) bits.push('Not emailed: no address on file for ' + (n.author || 'the author'));
    if (n.readAt) bits.push('read ' + when(n.readAt));
    else if (n.emailed && open) bits.push('not read yet');
    if (!open) bits.push('resolved by ' + (n.doneBy || '?') + ' ' + when(n.doneAt));
    card.appendChild(el('div', 'margin-top:4px;font-size:11.5px;color:' + (open && !n.readAt ? C.red : '#80868d') + ';', bits.join(' · ')));
    if (!open) {
      // A resolved issue can be put back: it returns to the warnings and the dashboard's alert
      var again = el('button', smallBtn + 'margin-top:6px;', 'Reopen issue');
      again.type = 'button';
      again.title = 'Not fixed after all: put it back as an open content issue';
      var amsg = el('div', 'font-size:11.5px;color:' + C.red + ';');
      again.onclick = function () {
        again.disabled = true;
        flagCall('reopen', { id: n.id }).catch(function (e) { again.disabled = false; amsg.textContent = 'Not saved: ' + (e.message || e) + '. Try again.'; });
      };
      card.appendChild(again);
      card.appendChild(amsg);
      return card;
    }

    var acts = el('div', 'display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;');
    var msg = el('div', 'flex:1 1 100%;font-size:11.5px;color:' + C.red + ';');
    function act(text, primary, fn) {
      var b = el('button', primary ? 'padding:3px 10px;border:1px solid ' + C.red + ';border-radius:5px;background:' + C.red + ';font:700 11.5px/1.6 ' + F + ';color:#fff;cursor:pointer;' : smallBtn, text);
      b.type = 'button';
      b.onclick = function () {
        b.disabled = true;
        // re-enabled afterwards too, so a cancelled confirm leaves the button usable
        fn().then(function () { b.disabled = false; }, function (e) { b.disabled = false; msg.textContent = 'Not saved: ' + (e.message || e) + '. Try again.'; });
      };
      acts.appendChild(b);
    }
    // The author can mark it read here too, as well as from the email
    if (!n.readAt && n.authorId && n.authorId === me.id) act('I\'ve read this', false, function () { return flagCall('read', { id: n.id }); });
    // Closing an issue takes it off the warnings and the dashboard, so it's a plain button
    // with a confirm, never a one-click red one (29 Oct 2026). Reopen undoes it.
    act('Mark as fixed', false, function () {
      if (!confirm('Mark this issue as fixed?\n\nIt comes off the warnings and the Content Manager. You can reopen it later.')) return Promise.resolve();
      return flagCall('done', { id: n.id });
    });
    // No address on file: a box to type one in, saved to the Authors tab for next time
    if (!n.emailed && !(n.authorId && n.authorId === me.id)) {
      var addr = el('input', 'flex:1 1 150px;min-width:0;padding:3px 7px;border:1px solid #d5d9de;border-radius:5px;font:12px ' + F + ';color:#222;');
      addr.type = 'email';
      addr.placeholder = (n.author ? n.author.split(' ')[0] + '\'s' : 'Author\'s') + ' email address';
      acts.insertBefore(addr, acts.firstChild);
      var send = el('button', smallBtn, 'Send');
      send.type = 'button';
      send.onclick = function () {
        var to = addr.value.trim();
        if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(to)) { msg.textContent = 'Add an email address.'; addr.focus(); return; }
        send.disabled = true;
        flagCall('send', { id: n.id, to: to }).catch(function (e) { send.disabled = false; msg.textContent = 'Not sent: ' + (e.message || e) + '.'; });
      };
      acts.insertBefore(send, addr.nextSibling);
    }
    acts.appendChild(msg);
    card.appendChild(acts);
    return card;
  }

  // The × that removes a note, after a confirm
  function removeX(n) {
    var x = el('button', 'padding:0 4px;border:0;background:none;font:600 14px/1 ' + F + ';color:#a0a6ad;cursor:pointer;', '×');
    x.type = 'button';
    x.title = 'Remove this note';
    x.onclick = function () {
      if (!confirm('Remove this note from ' + (n.by || 'the team') + '?')) return;
      x.disabled = true;
      notesCall({ del: n.id }).catch(function () { x.disabled = false; });
    };
    return x;
  }

  // The notes themselves, each with initials and time on top. Rebuilt on its own,
  // never by draw(), so a half-typed note isn't wiped by the 30-second refresh.
  // Open flags come first, so the issue is the first thing anyone opening the post sees.
  function renderNotes() {
    if (!notesBox || !notes) return;
    if (editingNote) { notesWaiting = true; return; }   // someone is mid-edit: catch up when they finish
    notesWaiting = false;
    notesBox.style.display = '';
    if (flagBtn) flagBtn.style.display = flagsOn ? '' : 'none';
    notesList.innerHTML = '';
    var openFlags = notes.filter(function (n) { return n.flag === 'open'; });
    openFlags.concat(notes.filter(function (n) { return n.flag !== 'open'; })).forEach(function (n) {
      if (n.flag) { notesList.appendChild(flagCard(n)); return; }
      var card = el('div', 'margin:0 0 6px;padding:8px 10px;border:1px solid #eceef1;border-radius:6px;background:#fafbfc;font-size:12.5px;line-height:1.45;');
      var top = el('div', 'display:flex;align-items:center;gap:6px;margin-bottom:2px;font-size:11.5px;color:#80868d;');
      top.appendChild(el('span', 'font-weight:700;color:#222;', n.by || '?'));                    // initials of whoever left it
      top.appendChild(el('span', 'flex:1;font-variant-numeric:tabular-nums;', when(+n.at)));
      var textBox = noteText(n);
      top.appendChild(editBtn(n, card, textBox));
      top.appendChild(removeX(n));
      card.appendChild(top);
      card.appendChild(textBox);
      notesList.appendChild(card);
    });
  }

  // The automatic check for open flags, added to the others by runAuto
  function flagCheck() {
    var open = (notes || []).filter(function (n) { return n.flag === 'open'; });
    if (!open.length) return null;
    var unread = open.filter(function (n) { return !n.readAt; }).length;
    return { ok: false, kind: 'flag', text: (open.length === 1 ? 'Content issue flagged by ' + (open[0].by || '?') : open.length + ' content issues flagged') +
      (unread ? ', not read yet' : ', read by the author') + '. See Notes' };
  }

  // Builds the box once: heading, the notes, and a text box with Add note and Flag for author underneath
  function buildNotes() {
    notesBox = el('div', 'display:none;padding:2px 16px 14px;border-top:1px solid #eceef1;');
    notesBox.appendChild(sectionLabel('Notes'));
    notesList = el('div');
    notesBox.appendChild(notesList);
    var field = el('textarea', 'display:block;box-sizing:border-box;width:100%;min-height:54px;padding:7px 9px;border:1px solid #d5d9de;border-radius:6px;' +
      'resize:vertical;background:#fff;font:13px/1.45 ' + F + ';color:#222;');
    field.placeholder = 'Anything the team should know about this post';
    field.maxLength = NOTE_MAX;
    var row = el('div', 'display:flex;align-items:center;gap:8px;margin-top:6px;');
    var msg = el('span', 'flex:1;font-size:11.5px;color:#80868d;');
    var add = el('button', 'padding:5px 12px;border:1px solid ' + C.blue + ';border-radius:5px;background:' + C.blue + ';font:700 12px/1.6 ' + F + ';color:#fff;cursor:pointer;', 'Add note');
    add.type = 'button';
    flagBtn = el('button', 'display:none;padding:5px 10px;border:1px solid ' + C.red + ';border-radius:5px;background:#fff;font:700 12px/1.6 ' + F + ';color:' + C.red + ';cursor:pointer;', '⚑ Flag for author');
    flagBtn.type = 'button';
    flagBtn.title = 'Save this as a content issue and email the author';
    function showWho() { // tells people their initials will go on the note, or that they'll be asked for them
      msg.style.color = '#80868d';
      msg.textContent = ls('pe-initials') ? 'Signed ' + ls('pe-initials') : 'You\'ll be asked for your initials';
    }
    add.onclick = function () {
      var text = field.value.trim();
      if (!text) { field.focus(); return; }
      add.disabled = true; add.textContent = 'Saving…';
      notesCall({ add: 1, text: text.slice(0, NOTE_MAX) }).then(function () {
        field.value = '';
        add.disabled = false; add.textContent = 'Add note';
        showWho();
      }).catch(function (e) {
        add.disabled = false; add.textContent = 'Add note';
        msg.style.color = C.red; msg.textContent = 'Not saved: ' + (e.message || e) + '. Try again.';
      });
    };
    flagBtn.onclick = function () {
      var text = field.value.trim();
      if (!text) { field.focus(); msg.style.color = C.red; msg.textContent = 'Write what needs fixing first.'; return; }
      var au = authorOf(), me = account();
      var own = au.id && au.id === me.id;
      if (!confirm(own ? 'This is your own post, so no email goes out. Flag it as a content issue anyway?'
        : 'Flag this for ' + (au.name || 'the author') + '? They\'ll get an email with your note.')) return;
      flagBtn.disabled = true; flagBtn.textContent = 'Sending…';
      flagCall('add', { text: text.slice(0, NOTE_MAX) }).then(function (d) {
        field.value = '';
        flagBtn.disabled = false; flagBtn.textContent = '⚑ Flag for author';
        msg.style.color = d.needEmail || d.capped ? C.red : C.green;
        msg.textContent = d.needEmail ? 'Flagged. No address on file for ' + (d.author || 'the author') + ': add one on the flag above.'
          : d.capped ? 'Flagged, but the daily email limit is reached.'
          : d.sent && d.sent.length ? 'Flagged and emailed to ' + d.sent.join(', ') + '.' : 'Flagged.';
      }).catch(function (e) {
        flagBtn.disabled = false; flagBtn.textContent = '⚑ Flag for author';
        msg.style.color = C.red; msg.textContent = 'Not flagged: ' + (e.message || e) + '. Try again.';
      });
    };
    // Cmd+Enter or Ctrl+Enter adds the note without reaching for the mouse
    field.addEventListener('keydown', function (e) { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); add.click(); } });
    showWho();
    var btns = el('div', 'display:flex;gap:6px;flex:0 0 auto;');
    btns.appendChild(flagBtn);
    btns.appendChild(add);
    notesBox.appendChild(field);
    notesBox.appendChild(row);
    notesBox.appendChild(msg);
    row.appendChild(el('span', 'flex:1;'));
    row.appendChild(btns);
    msg.style.display = 'block';
    msg.style.marginTop = '5px';
    return notesBox;
  }

  /* ---------- Edit history ----------
   * Squarespace records when a post was last saved, but not who saved it, and keeps no history
   * the page can read. So the checklist keeps one in the History tab of the Google Sheet:
   * - Saves: noticed within seconds (on every status check). A save is credited to whoever was
   *   working on this post in this browser around the time of the save; the record of that
   *   activity is kept in localStorage, so it survives the preview reloading after Save.
   *   A save nobody's checklist saw being made (the phone app, say) is logged as editor unknown.
   *   Each save also notes what changed since the last one: headline, SEO title, meta
   *   description, URL, status and word count. The Google Sheet works that out.
   * - Ticks, unticks and "Checks still OK" are logged with initials.
   * When two people's checklists see the same save, the sheet keeps one row, and fills in
   * the initials if the first report didn't have them. */

  // Remembers that this person is working on this post. One unbroken stretch of activity
  // (no gap over 10 minutes) is kept as its start and latest time.
  function noteActivity(e) {
    if (e && e.target && e.target.closest && e.target.closest('.pe-checklist, .pe-checklist-pill, .pe-drawer')) return; // our own panels don't count
    var now = Date.now(), a = {};
    try { a = JSON.parse(ls('pe-act') || '{}') || {}; } catch (x) {}
    if (a.p === post && now - a.l < 600000) { if (now - a.l < 5000) return; a.l = now; } // within 5 seconds: no need to write again
    else a = { p: post, s: now, l: now };
    ls('pe-act', JSON.stringify(a));
  }

  // Initials of the person who made a save at this time, or '' if this browser can't tell.
  // A minute of slack either side allows for Squarespace's clock and ours differing slightly.
  function saverAt(when) {
    var a = {};
    try { a = JSON.parse(ls('pe-act') || '{}') || {}; } catch (x) {}
    if (a.p !== post || when < a.s - 60000 || when > a.l + 60000) return '';
    return ls('pe-initials') || ''; // never prompts: a save isn't the moment to ask for initials
  }

  // The post's state as the history compares it from one save to the next
  function snapshot(it) {
    var words = String(it.body || '').replace(/<[^>]+>/g, ' ').replace(/&[#a-z0-9]+;/gi, ' ').split(/\s+/).filter(Boolean).length;
    return {
      title: postTitle(), seoTitle: seo().seoTitle || '', meta: seo().seoDescription || '',
      url: it.urlId || '', status: statusText(it), words: words
    };
  }

  // Squarespace's status number as words. A scheduled post includes its time, so a reschedule shows.
  // The time is always built the same way, in UK time, whatever the browser. Safari and Chrome
  // word dates differently ("Wed 28 Oct at 09:00" against "Wed 28 Oct, 09:00"), and the sheet
  // matches one save reported by two browsers on its status text, so different wording logged
  // the same save twice (the second as "editor unknown").
  function statusText(it) {
    var wf = +it.workflowState || 0, t = +it.publishOn || 0;
    if ((wf === 2 || wf === 1) && t > Date.now()) {
      var parts = {};
      new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
        .formatToParts(new Date(t)).forEach(function (p) { parts[p.type] = p.value; });
      return 'Scheduled for ' + parts.weekday + ' ' + parts.day + ' ' + parts.month + ', ' + parts.hour + ':' + parts.minute;
    }
    return wf === 1 ? 'Published' : wf === 2 ? 'Scheduled' : wf === 3 ? 'In review' : wf === 4 ? 'Draft' : '';
  }

  // Called after every status check: logs a new save, or a status change with no save
  function noteSave(it) {
    if (!editedAt) return;
    var status = statusText(it);
    if (editedAt === seenSave && status === seenStatus) return;
    // a status change on its own keeps the old save time, so it's dated now instead
    var saved = editedAt !== seenSave || !seenSave;
    var at = saved ? editedAt : Date.now();
    seenSave = editedAt;
    seenStatus = status;
    logEvent({ kind: saved ? 'save' : 'status', at: editedAt, when: at, status: status, who: saverAt(at), snap: JSON.stringify(snapshot(it)) });
  }

  // Sends one event to the History tab; the sheet answers with the post's updated history
  function logEvent(data) {
    data.action = 'hlog';
    data.post = post;
    data.title = postTitle();
    getHistory(data);
  }
  function getHistory(data) {
    data = data || { action: 'hist', post: post };
    var q = Object.keys(data).map(function (k) { return k + '=' + encodeURIComponent(data[k]); }).join('&');
    return fetch(C.store + '?' + q).then(function (r) { return r.json(); }).then(function (d) {
      if (d && d.ok && d.history) { hist = d.history; draw(); }
    }).catch(function () {}); // no history this time: the panel just shows the save time
  }

  // 'Today 08:14', 'Yesterday 17:02', or 'Mon 26 Oct 17:02'
  function when(t) {
    var d = new Date(t), now = new Date();
    var hm = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    var day = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    if (t >= day) return 'Today ' + hm;
    if (t >= day - 86400000) return 'Yesterday ' + hm;
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) + ' ' + hm;
  }

  // One history entry as a sentence
  function histText(h) {
    var who = h.who || '';
    if (h.kind === 'save') return (who ? who + ' saved' : 'Saved, editor unknown') + (h.detail ? ': ' + h.detail : '');
    if (h.kind === 'embargo') return h.item === 'removed' ? who + ' removed the embargo' : who + ' set the embargo: lifts ' + h.item;
    if (h.kind === 'status') return (who ? who + ' changed the status' : 'Status changed') + (h.detail ? ': ' + h.detail : '');
    if (h.kind === 'tick') return who + ' ticked ' + h.item;
    if (h.kind === 'untick') return who + ' unticked ' + h.item;
    if (h.kind === 'confirm') return who + ' confirmed the checks still hold';
    if (h.kind === 'note') return who + ' added a note: ' + h.item;       // item is the start of the note
    if (h.kind === 'unnote') return who + ' removed a note: ' + h.item;
    if (h.kind === 'flag') return who + ' flagged a content issue: ' + h.item;
    if (h.kind === 'flagsent') return 'Content issue emailed to ' + h.item;
    if (h.kind === 'flagread') return (who || 'The author') + ' read the content issue';
    if (h.kind === 'flagdone') return who + ' resolved the content issue: ' + h.item;
    if (h.kind === 'flagreopen') return who + ' reopened the content issue: ' + h.item;
    if (h.kind === 'noteedit') return who + ' edited a note: ' + h.item;
    if (h.kind === 'flagedit') return who + ' edited the content issue: ' + h.item;
    return h.kind;
  }

  // The 'Last edited' line at the top of the panel, with the History list under it when open
  function drawHistory() {
    if (!editedAt) return;
    var last = (hist || []).filter(function (h) { return h.kind === 'save' && h.when === editedAt; })[0]; // the entry for the latest save
    var line = el('div', 'display:flex;align-items:center;gap:8px;margin:8px 0 2px;font-size:12px;line-height:1.4;color:#80868d;');
    line.appendChild(el('span', 'flex:1;', 'Last edited ' + when(editedAt) + (last && last.who ? ' by ' + last.who : '')));
    var b = el('button', 'flex:0 0 auto;padding:2px 8px;border:1px solid #dde1e6;border-radius:5px;background:' + (histOpen ? '#e3eef8' : '#fff') +
      ';font:600 11px/1.6 ' + F + ';color:' + (histOpen ? C.blue : '#444') + ';cursor:pointer;', 'History ' + (histOpen ? '▴' : '▾'));
    b.type = 'button';
    b.onclick = function () { histOpen = !histOpen; histScroll = 0; draw(); if (histOpen) getHistory(); };
    line.appendChild(b);
    list.appendChild(line);
    // Without initials in this browser, saves can only be logged as 'editor unknown', so ask once here
    if (!ls('pe-initials')) {
      var ask = el('button', 'display:block;width:100%;margin:4px 0 2px;padding:6px 10px;border:1px dashed #c9cfd6;border-radius:6px;background:#fff;' +
        'font:600 12px ' + F + ';color:' + C.blue + ';text-align:left;cursor:pointer;', 'Add your initials so your saves are credited');
      ask.type = 'button';
      ask.onclick = function () { who(); draw(); };
      list.appendChild(ask);
    }
    if (!histOpen) return;

    var box = el('div', 'margin:6px 0 4px;max-height:220px;overflow:auto;border:1px solid #eceef1;border-radius:6px;background:#fafbfc;');
    if (!hist) box.appendChild(el('div', 'padding:10px 12px;font-size:12px;color:#888;', 'Loading…'));
    else if (!hist.length) box.appendChild(el('div', 'padding:10px 12px;font-size:12px;color:#888;', 'Nothing recorded yet. The history starts from 27 Oct 2026.'));
    else hist.forEach(function (h, i) {
      var row = el('div', 'display:flex;gap:10px;padding:7px 12px;font-size:12px;line-height:1.45;' + (i ? 'border-top:1px solid #eceef1;' : ''));
      row.appendChild(el('span', 'flex:0 0 92px;color:#80868d;font-variant-numeric:tabular-nums;', when(h.when)));
      row.appendChild(el('span', 'flex:1;color:' + (h.kind === 'save' || h.kind === 'status' ? '#222' : '#555') + ';', histText(h)));
      box.appendChild(row);
    });
    box.addEventListener('scroll', function () { histScroll = box.scrollTop; });
    list.appendChild(box);
    setTimeout(function () { box.scrollTop = histScroll; }, 0); // after it's in the page, so the scroll sticks
  }

  /* ---------- Drawing the panel ---------- */

  function draw() {
    if (!panel) return;
    var c = counts(), stage = stageOf(c);
    var problems = c.warn || c.stale || c.autoWarn > 0 || !c.all;
    var colour = c.warn ? C.red : (c.stale || c.autoWarn) ? C.amber : c.all ? C.green : C.blue;
    var status = c.done + '/' + C.items.length + (c.autoWarn ? ' · ' + c.autoWarn + (c.autoWarn === 1 ? ' warning' : ' warnings') : '');

    var embIssue = auto.filter(function (r) { return r.kind === 'embargo' && !r.ok; })[0];
    var flagIssue = auto.filter(function (r) { return r.kind === 'flag'; })[0];
    head.firstChild.textContent = embIssue ? (embIssue.live ? 'Live before embargo' : 'Embargo clash') : flagIssue ? 'Content issue' : c.warn ? 'Scheduled: checks missing' : c.stale ? 'Edited since checked' : 'Pre-publish checks';
    head.lastChild.textContent = status;
    head.style.color = embIssue || flagIssue || c.warn ? C.red : c.stale ? C.amber : '#222';
    head.lastChild.style.color = colour;
    panel.style.borderTopColor = colour;
    pill.style.borderColor = colour;
    pill.style.color = colour;
    pill.firstChild.textContent = reportErr ? '⚠ ' : c.all && !c.autoWarn && !c.stale ? '✓ ' : '';
    pill.title = reportErr ? 'Dashboard not updated: ' + reportErr : 'Pre-publish checks';
    pill.lastChild.textContent = status;

    list.innerHTML = '';
    drawHistory();
    drawStale(c);
    drawProblems();
    drawChecks();
    if (stage === 'Draft' || stage === 'In review' || stage === 'Checks in progress') {
      var hw = el('button', 'display:block;width:100%;margin-top:12px;padding:9px;border:1px solid #dde1e6;border-radius:6px;background:#f7f9fb;font:600 13px ' + F + ';color:#222;cursor:pointer;', '✨ Ask Joe');
      hw.title = 'Joe v' + PE_VERSION + ' (formerly Help me write): headlines, meta descriptions, URLs, alt text, links and images';
      hw.type = 'button';
      hw.onclick = function () { openDrawer(); };
      list.appendChild(hw);
    }
    // Only shown if Squarespace couldn't be asked about the post (the full readout was for setting up)
    if (statusErr) list.appendChild(el('div', 'margin-top:10px;padding-top:8px;border-top:1px solid #eceef1;color:#888;font:11px/1.5 ' + F + ';',
      'Couldn\'t check the post with Squarespace: ' + statusErr + '. Trying again in 30 seconds.'));
    if (reportErr) list.appendChild(el('div', 'margin-top:10px;padding:7px 9px;border-radius:4px;background:#fdecea;color:' + C.red + ';font:12px/1.4 ' + F + ';',
      'The Content Manager did not update: ' + reportErr + '. It will try again in 30 seconds.'));
    var embBad = auto.filter(function (r) { return r.kind === 'embargo' && !r.ok; })[0];
    warning(c.warn || (scheduledFor > Date.now() && c.autoWarn) || (embBad && embBad.live), C.items.filter(function (i) { return !(state[i] || {}).done; }), c.autoWarn, embBad, flagIssue);
    if (drawer && drawer.style.display !== 'none') drawDrawer();

    clearTimeout(hideTimer);
    if (!loaded) return; // stay hidden until the sheet has answered
    reportStage(c, stage);

    // What to show: hidden on a published post with nothing wrong; a pill when all done;
    // the open panel while anything needs doing. A click on either overrides this.
    var show = force ? (mode || 'open')
      : stage === 'Published' && !problems ? 'none'
      : mode || (problems ? 'open' : 'pill');
    var apply = function () {
      panel.style.display = show === 'open' ? '' : 'none';
      pill.style.display = show === 'pill' ? 'flex' : 'none';
    };
    if (show !== 'open' && !firstLoad && panel.style.display !== 'none' && !mode) hideTimer = setTimeout(apply, 1200);
    else apply();
  }

  function sectionLabel(text, colour) {
    return el('div', 'margin:12px 0 4px;font:700 10.5px/1.4 ' + F + ';letter-spacing:.08em;text-transform:uppercase;color:' + (colour || '#7a8088') + ';', text);
  }

  function drawStale(c) {
    if (!c.stale) return;
    var note = el('div', 'margin:10px 0 4px;padding:10px 12px;border-radius:6px;background:#fff4e0;color:#5a3a00;font-size:13px;line-height:1.45;');
    var at = new Date(editedAt).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    note.appendChild(document.createTextNode('Edited ' + at + ', after these checks were ticked. Untick anything that needs another look, or confirm they still hold.'));
    var ok = el('button', 'display:block;margin-top:8px;padding:7px 13px;border:0;border-radius:6px;background:' + C.amber + ';color:#fff;font:700 13px ' + F + ';cursor:pointer;', 'Checks still OK');
    ok.type = 'button';
    ok.onclick = function () {
      ok.disabled = true;
      ok.textContent = 'Saving…';
      var by = who(), chain = Promise.resolve();
      logEvent({ kind: 'confirm', who: by }); // one history line, not one per check
      C.items.forEach(function (i) {
        chain = chain.then(function () { return call({ action: 'set', post: post, item: i, done: 1, by: by, title: postTitle() }); });
      });
    };
    note.appendChild(ok);
    list.appendChild(note);
  }

  function drawProblems() {
    var warnings = auto.filter(function (r) { return !r.ok; });
    if (!warnings.length) return;
    list.appendChild(sectionLabel('Needs fixing', C.amber));
    warnings.forEach(function (r) {
      var hard = r.kind === 'embargo' || r.kind === 'flag'; // embargo problems and flagged issues are shown in red
      var row = el('div', 'display:flex;gap:8px;align-items:flex-start;padding:3px 0;font:' + (hard ? 600 : 400) + ' 13px/1.4 ' + F + ';color:' + (hard ? C.red : '#5a3a00') + ';');
      row.appendChild(el('span', 'color:' + (hard ? C.red : C.amber) + ';', '⚠'));
      var t = el('span', 'flex:1;' + (r.els ? 'cursor:pointer;text-decoration:underline;text-underline-offset:2px;' : ''), r.text);
      if (r.els) { t.title = 'Show me'; t.onclick = function () { point(r.els); }; }
      row.appendChild(t);
      var fix = /^(alt|meta|headlines|links)$/.test(r.kind || '') ? r.kind : null;
      if (fix) {
        var b = el('button', 'flex:0 0 auto;padding:2px 8px;border:1px solid #e3c79a;border-radius:5px;background:#fff;font:600 11px/1.6 ' + F + ';color:#5a3a00;cursor:pointer;', 'Suggest');
        b.type = 'button';
        b.onclick = function () { openDrawer(fix); };
        row.appendChild(b);
      }
      list.appendChild(row);
    });
  }

  function checkRow(item, s) {
    var row = el('label', 'display:flex;align-items:center;gap:9px;padding:5px 0;font-size:13.5px;cursor:pointer;');
    var box = el('input', 'flex:0 0 auto;width:16px;height:16px;margin:0;accent-color:' + C.blue + ';');
    box.type = 'checkbox';
    box.checked = !!s.done;
    box.onchange = function () {
      state[item] = { done: box.checked, by: who(), when: Date.now() };
      draw();
      call({ action: 'set', post: post, item: item, done: box.checked ? 1 : 0, by: state[item].by, title: postTitle() });
      logEvent({ kind: box.checked ? 'tick' : 'untick', item: item, who: state[item].by }); // into the edit history
    };
    row.appendChild(box);
    row.appendChild(el('span', 'flex:1;', item));
    row.appendChild(el('span', 'font-size:11px;font-weight:600;color:#8a9097;', s.done && s.by ? s.by : '')); // initials of whoever ticked it
    return row;
  }

  function drawChecks() {
    var todo = C.items.filter(function (i) { return !(state[i] || {}).done; });
    var done = C.items.filter(function (i) { return (state[i] || {}).done; });
    if (todo.length) {
      list.appendChild(sectionLabel('Still to check'));
      todo.forEach(function (i) {
        list.appendChild(checkRow(i, state[i] || {}));
        // Squarespace doesn't let the page see the Share tab, so social share is a reminder here
        if (i === 'Schedule') list.appendChild(el('div', 'margin:-2px 0 4px 25px;color:#80868d;font:12px/1.45 ' + F + ';',
          'Before ticking: check the social share slider is on in the Share tab'));
      });
    }
    if (done.length) {
      var t = el('div', 'display:flex;gap:6px;align-items:center;margin-top:8px;padding:3px 0;font:600 12.5px ' + F + ';color:' + C.green + ';cursor:pointer;',
        '✓ ' + done.length + ' done ' + (showDone ? '▴' : '▾'));
      t.onclick = function () { showDone = !showDone; draw(); };
      list.appendChild(t);
      if (showDone) done.forEach(function (i) {
        var r = checkRow(i, state[i] || {});
        r.style.paddingLeft = '14px';
        r.style.color = '#666';
        list.appendChild(r);
      });
    }
  }

  // Tells the pipeline dashboard where this post is up to, whenever that changes
  // One line for the dashboard: what Google will show for this post
  function seoSummary() {
    var st = String(seo().seoTitle || '').trim(), md = String(seo().seoDescription || '').trim();
    var slug = String(postData.urlId || '').split('/').pop();
    return [
      st ? 'SEO title ' + st.length + '/' + C.titleMax : 'No SEO title (headline ' + postTitle().length + '/' + C.titleMax + ')',
      md ? 'Meta ' + md.length + '/' + C.metaMax : 'No meta',
      slug ? 'URL /' + slug : ''
    ].filter(String).join(' · ');
  }

  function reportStage(c, stage) {
    var details = auto.filter(function (r) { return !r.ok; }).map(function (r) { return r.text; }).join('; ');
    var author = (postData.author && (postData.author.displayName || postData.author.firstName)) || '';
    var wf = +postData.workflowState || 0;
    var data = {
      action: 'report', post: post, title: postTitle(), author: author,
      url: postData.fullUrl || location.pathname, stage: stage,
      checks: c.done + ' of ' + C.items.length, warnings: c.autoWarn, details: details,
      edited: editedAt || '', publishOn: scheduledFor || '', by: ls('pe-initials') || '', wf: wf,
      missing: C.items.filter(function (i) { return !(state[i] || {}).done; }).join(', '),
      seo: seoSummary(),
      categories: (postData.categories || []).join(', ') // so the dashboard can highlight News posts
    };
    var sig = JSON.stringify([wf, stage, data.checks, c.autoWarn, details, editedAt, scheduledFor, data.title, author, data.missing, data.seo, data.categories]);
    if (sig === lastReport) return;
    if (!auto.length && Date.now() - started < 8000) return; // give the automatic checks a moment first
    lastReport = sig;
    var q = Object.keys(data).map(function (k) { return k + '=' + encodeURIComponent(data[k]); }).join('&');
    fetch(C.store + '?' + q).then(function (r) { return r.json(); }).then(function (d) {
      var was = reportErr;
      reportErr = d && d.ok ? '' : ((d && d.error) || 'no reply');
      if (reportErr) lastReport = '';
      if (reportErr !== was) draw();
    }).catch(function () { lastReport = ''; if (!reportErr) { reportErr = 'could not reach the Google Sheet'; draw(); } });
  }

  // Red bar across the top of the page while a scheduled post has unticked checks or warnings
  function warning(on, missing, autoWarn, embBad, flagBad) {
    if (!on) { if (banner) banner.style.display = 'none'; return; }
    if (!banner) {
      banner = el('div', 'position:fixed;top:0;left:0;right:0;z-index:10001;padding:10px 16px;background:' + C.red +
        ';color:#fff;font:600 14px/1.4 ' + F + ';text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.2);');
      banner.className = 'pe-schedule-warning';
      banner.setAttribute('role', 'alert');
      document.body.appendChild(banner);
    }
    var when = new Date(scheduledFor).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    var bits = [];
    if (embBad) bits.push('EMBARGO: ' + (embBad.bar || embBad.text) + '.'); // named first, before anything else
    if (flagBad) bits.push('CONTENT ISSUE flagged for the author and not resolved.');
    if (missing.length) bits.push(missing.length + (missing.length === 1 ? ' check' : ' checks') + ' not done: ' + missing.join(', ') + '.');
    var others = autoWarn - (embBad ? 1 : 0) - (flagBad ? 1 : 0); // the embargo and flag are already named above
    if (others) bits.push(others + (others === 1 ? ' other automatic warning' : ' other automatic warnings') + ' in the checklist.');
    // a live post has no schedule to report, only the embargo
    banner.textContent = (scheduledFor ? 'Scheduled for ' + when + '. ' : '') + bits.join(' ');
    banner.style.display = '';
  }

  // Asks Squarespace about this post: when it goes live, its status and when it was edited
  function checkSchedule() {
    // the time on the end makes Squarespace answer with the current status, never a saved copy
    return fetch(location.pathname + '?format=json&pe=' + Date.now(), { credentials: 'same-origin', cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var it = (d && d.item) || {};
        postData = it;
        linksSeen(it); // after a save: did the links added from Help me write make it in?
        usesSeen(it);  // and the headlines, SEO titles, meta descriptions and URLs filled in by Use?
        var t = +it.publishOn || 0;
        var was = scheduledFor, wasEdit = editedAt;
        // Squarespace keeps a post's planned date even after it goes back to draft (status 4)
        // or review (status 3), so only scheduled (2) or published (1) with a future date counts
        var wfNow = +it.workflowState || 0;
        scheduledFor = t > Date.now() && (wfNow === 2 || wfNow === 1) ? t : 0;
        editedAt = +it.updatedOn || 0;
        noteSave(it); // into the edit history, if this save or status hasn't been sent yet
        // In the editor the reader extras are hidden while a post is a draft or in review.
        // Once it's scheduled or live, show them so the team sees what readers will see.
        if (guarded) document.documentElement.classList.toggle('pe-editor', !(scheduledFor || ((wfNow === 1 || wfNow === 2) && t && t <= Date.now())));
        if ((scheduledFor !== was || editedAt !== wasEdit) && loaded) draw();
        statusErr = '';
      }).catch(function (e) { statusErr = String(e && e.message || e).slice(0, 80); if (loaded) draw(); });
  }

  /* ---------- Automatic checks ---------- */

  function articleBody() { return document.querySelector('body.view-item article.hentry .body.entry-content'); }
  function own(e) { return !e.closest('.pe-ui, .pe-checklist, .pe-checklist-pill, .pe-drawer, .pe-author-bio, .pe-signup'); }
  function seo() { return postData.seoData || {}; }

  function runAuto() {
    var a = document.querySelector('body.view-item article.hentry');
    var body = articleBody();
    if (!a || !body) return Promise.resolve([]);
    var out = [];

    // 0. Embargo (see the Embargo section): first, because it's the costliest mistake
    var emb = embargoCheck();
    if (emb) out.push(emb);
    // 0b. A content issue flagged for the author and not yet resolved (see the Notes section)
    var flg = flagCheck();
    if (flg) out.push(flg);

    // 1. Alt text on the pictures in the article body and its header (ad banners don't count)
    var imgs = Array.prototype.filter.call(a.querySelectorAll('.body.entry-content img, .promoted-block-image img, .entry-header img'), function (i) {
      return own(i) && !i.closest('noscript, .antur-ad, a[href*="adserver"]') && (i.getAttribute('data-src') || i.getAttribute('src'));
    });
    // the same picture can appear twice in the page (e.g. lazy-load copies), so count each once
    var seenSrc = {};
    imgs = imgs.filter(function (i) { var k = imgSrc(i); if (seenSrc[k]) return false; seenSrc[k] = 1; return true; });
    var noAlt = imgs.filter(function (i) { return !String(i.getAttribute('alt') || '').trim(); });
    out.push(noAlt.length
      ? { ok: false, kind: 'alt', text: noAlt.length + ' of ' + imgs.length + (imgs.length === 1 ? ' image has' : ' images have') + ' no alt text', els: noAlt }
      : { ok: true, text: imgs.length ? 'Alt text on all ' + imgs.length + ' images' : 'No images to check' });

    // 2. Meta description
    var md = String(seo().seoDescription || '').trim();
    if (!md) out.push({ ok: false, kind: 'meta', text: 'No meta description' });
    else if (md.length < C.metaMin) out.push({ ok: false, kind: 'meta', text: 'Meta description is short (' + md.length + ' characters)' });
    else if (md.length > C.metaMax) out.push({ ok: false, kind: 'meta', text: 'Meta description is long (' + md.length + ' characters)' });
    else out.push({ ok: true, text: 'Meta description, ' + md.length + ' characters' });

    // 2b. Title as Google shows it: the SEO title, or the headline when there isn't one
    var gt = String(seo().seoTitle || postTitle() || '').trim();
    if (gt.length > C.titleMax) out.push({ ok: false, kind: 'headlines', text: (seo().seoTitle ? 'SEO title' : 'Headline, used as the SEO title,') + ' is long (' + gt.length + ' characters)' });
    else out.push({ ok: true, text: (seo().seoTitle ? 'SEO title, ' : 'Headline used as SEO title, ') + gt.length + ' characters' });

    // 3. Related links block: check removed 26 Oct 2026. The automatic Related
    // Answers panel now covers related reading, so the hand-built "You Might Also
    // Find These Articles Useful" block is optional and no longer checked.

    // 4. Partner tag and disclosure
    var tagged = a.classList.contains('tag-partner');
    var overlay = Array.prototype.some.call(a.querySelectorAll('figcaption, .image-caption'), function (cp) { return /this is partner content/i.test(cp.textContent); });
    var label = !!a.querySelector('.pe-partner-label');
    if (overlay && !tagged) out.push({ ok: false, text: 'Says “Partner Content” but has no Partner tag' });
    else if (tagged && !label && !overlay) out.push({ ok: false, text: 'Partner tag set, but no disclosure line is showing' });
    else if (tagged) out.push({ ok: true, text: 'Partner tag and disclosure in place' });

    // 5. Headings in order
    var h3s = body.querySelectorAll('h3'), firstH4 = body.querySelector('h4');
    var words = (body.textContent || '').split(/\s+/).length;
    if (firstH4 && (!h3s.length || (h3s[0].compareDocumentPosition(firstH4) & Node.DOCUMENT_POSITION_PRECEDING)))
      out.push({ ok: false, text: 'A subheading (H4) comes before any section heading (H3)', els: [firstH4] });
    else if (!h3s.length && words > 600) out.push({ ok: false, text: 'No section headings in a ' + Math.round(words / 100) * 100 + '-word article' });
    else out.push({ ok: true, text: 'Headings in order' });

    // 6. Hero image
    var hero = a.querySelector('.promoted-block-image img, .entry-header img') ||
      Array.prototype.slice.call(body.querySelectorAll('.sqs-block')).slice(0, 6).filter(function (b) { return /image-block|gallery-block/.test(b.className); })[0];
    out.push(hero ? { ok: true, text: 'Hero image in place' } : { ok: false, text: 'No hero image, so search results will show no picture' });

    // 6b and 6c only apply before a post goes live (status 1 is published). Older live posts
    // were written before these rules, and flagging them would fill the Content Manager with
    // "Live with issues" for posts nobody needs to change.
    // They also only apply to posts created from 26 Oct 2026, when these rules began, so old
    // drafts and posts already in the queue aren't flagged (addedOn is when the post was created).
    if ((+postData.workflowState || 0) !== 1 && (+postData.addedOn || 0) >= Date.UTC(2026, 9, 26)) {
      // 6b. Image source: the credit for the article's pictures goes in the Source URL box
      // on the post's Options tab, which Squarespace saves as sourceUrl
      if (imgs.length || hero) {
        out.push(String(postData.sourceUrl || '').trim()
          ? { ok: true, text: 'Image source added' }
          : { ok: false, text: 'No image source. Add it in the Source URL box on the Options tab' });
      }

      // 6c. Social share. Squarespace doesn't tell the page what's set on the Share tab until a
      // post goes live (pushedServices and pendingPushedServices come back empty even with the
      // slider on and text filled in, confirmed 26 Oct 2026), so this can't be checked
      // automatically. It's a reminder under the Schedule check instead (see drawChecks).
    }

    // 6d. Internal links in the article. A post of 300 words or more with no link to another
    // Production Expert article gets a warning, with a button that opens the Links tab in Help me
    // write. Links in the "You Might Also Find These Articles Useful" block don't count: they sit
    // after the article. Only checked before a post goes live, and (while the Links tab is being
    // tested) only for the people who have that tab, so nobody is warned without the tool to fix it.
    if (linksOn() && (+postData.workflowState || 0) !== 1) {
      var inBody = 0, past = false, words = 0;
      Array.prototype.forEach.call(body.querySelectorAll('p, li, h1, h2, h3, h4'), function (e) {
        if (past || !own(e)) return;
        if (LINKS.stop.test(e.textContent)) { past = true; return; }
        if (/^H[1-4]$/.test(e.tagName) || (e.tagName === 'LI' && e.querySelector('p'))) return;
        words += squash(e.textContent).split(' ').filter(Boolean).length;
        Array.prototype.forEach.call(e.querySelectorAll('a[href]'), function (l) {
          var h = l.getAttribute('href') || '';
          if (/^#/.test(h) || /\.(jpe?g|png|gif|webp|pdf)$/i.test(l.pathname)) return;
          if (l.host === location.host || /(^|\.)production-expert\.com$/.test(l.hostname)) inBody++;
        });
      });
      // A warning only when there's something to act on: if the archive has nothing that
      // matches this article, a neutral note instead, so the post isn't held back for nothing.
      // While the link index is still loading, nothing is shown; the check runs again once it has.
      if (words >= 300 && inBody) out.push({ ok: true, text: inBody + (inBody === 1 ? ' internal link' : ' internal links') + ' in the article' });
      else if (words >= 300) {
        if (!linkIdx) loadLinkIndex();
        if (linkIdx && linkIdx.targets) {
          if (!linkSugg || linkSugg.sig !== textSig()) findLinks();
          out.push(linkSugg.list.length
            ? { ok: false, kind: 'links', text: 'No internal links in the article' }
            : { ok: true, text: 'No internal links, and nothing in the archive matches this article' });
        }
      }
    }

    // 7. Internal links that lead nowhere (other sites can't be checked from the page)
    var links = Array.prototype.filter.call(body.querySelectorAll('a[href]'), function (l) {
      return own(l) && l.host === location.host && !/^#/.test(l.getAttribute('href')) && !/\.(jpe?g|png|gif|webp|pdf)$/i.test(l.pathname);
    });
    var paths = {};
    links.forEach(function (l) { (paths[l.pathname] = paths[l.pathname] || []).push(l); });
    var lst = Object.keys(paths).slice(0, 40);
    return Promise.all(lst.map(function (path) {
      if (path in linkCache) return Promise.resolve();
      var ask = fetch(path, { credentials: 'same-origin' })
        .then(function (r) { linkCache[path] = r.ok; }).catch(function () { linkCache[path] = true; });
      return Promise.race([ask, new Promise(function (r) { setTimeout(r, 5000); })]); // slow links count as fine
    })).then(function () {
      var bad = [];
      lst.forEach(function (path) { if (linkCache[path] === false) bad = bad.concat(paths[path]); });
      out.push(!lst.length ? { ok: true, text: 'No internal links to check' }
        : bad.length ? { ok: false, text: bad.length + (bad.length === 1 ? ' internal link goes' : ' internal links go') + ' to a missing page', els: bad }
        : { ok: true, text: 'All ' + lst.length + ' internal links work' });
      return out;
    });
  }

  // Scrolls to the problem and outlines it for a few seconds
  function point(els) {
    if (!els || !els.length) return;
    els = els.map(function (e) { return e.tagName === 'IMG' ? (e.closest('.sqs-block, .promoted-block-image, figure') || e) : e; });
    els[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
    els.forEach(function (e) {
      var was = e.style.outline;
      e.style.outline = '3px solid ' + C.amber;
      e.style.outlineOffset = '3px';
      setTimeout(function () { e.style.outline = was; }, 4000);
    });
  }

  function refreshAuto() {
    return runAuto().then(function (res) { auto = res; if (loaded) draw(); });
  }

  /* ---------- Help me write drawer ---------- */

  var TABS = [['headlines', 'Headlines'], ['meta', 'Meta description'], ['url', 'URL'], ['alt', 'Alt text']];

  // Inside the Squarespace editor, the post sits in a frame and the editor's own toolbars float
  // over it, covering anything in the frame. So the drawer goes in the editor window itself.
  function hostDoc() {
    try { if (window.top !== window && window.top.document && window.top.document.body) return window.top.document; } catch (e) {}
    return document;
  }

  /* ---------- Look of the team panels ----------
   * The checklist and Help me write sit in Squarespace's editor window, which never loads the
   * site's fonts, so they fell back to Arial or Helvetica. And the site itself only loads Open Sans
   * at 400 and 800, so the panels' 600 and 700 weights came out at 800.
   * styleUp() fixes both, for the team only: it loads Open Sans (300 to 800) into whichever window
   * the panels are in, renamed 'PE UI Sans' so the extra weights never change how articles look,
   * then adds the few styles inline CSS can't do: hover, keyboard focus, thin scrollbars.
   * If the editor ever refuses the font or the stylesheet, the panels simply look as before. */
  var UI_CSS =
    '.pe-checklist,.pe-checklist-pill,.pe-drawer,.pe-schedule-warning{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-rendering:optimizeLegibility}' +
    // Squarespace's editor styles its own buttons and inputs; this stops that reaching ours
    '.pe-checklist *,.pe-checklist-pill *,.pe-drawer *{font-family:inherit!important;box-sizing:border-box}' +
    '.pe-checklist button,.pe-checklist-pill,.pe-drawer button{transition:filter .12s,background-color .12s,box-shadow .12s}' +
    // a slight darken on hover; the title bars are left alone because they're drag handles
    '.pe-checklist button:not(.pe-ck-head):hover,.pe-drawer button:not(.pe-x):hover,.pe-checklist-pill:hover{filter:brightness(.95)}' +
    '.pe-drawer .pe-x:hover{color:#222!important}' +
    '.pe-checklist button:focus-visible,.pe-checklist input:focus-visible,.pe-checklist-pill:focus-visible,.pe-drawer button:focus-visible{outline:2px solid ' + C.blue + ';outline-offset:2px}' +
    '.pe-checklist,.pe-drawer *{scrollbar-width:thin;scrollbar-color:#cfd4da transparent}';

  function styleUp(doc) {
    if (!doc || doc.getElementById('pe-ui-style')) return;
    var head = doc.head || doc.documentElement;
    var css = doc.createElement('style');
    css.id = 'pe-ui-style';
    css.textContent = UI_CSS;
    head.appendChild(css);
    // Google's stylesheet for Open Sans, with the family renamed before it goes in the page
    fetch('https://fonts.googleapis.com/css2?family=Open+Sans:wght@300..800&display=swap')
      .then(function (r) { return r.ok ? r.text() : ''; })
      .then(function (t) {
        if (!t) return;
        var font = doc.createElement('style');
        font.id = 'pe-ui-font';
        font.textContent = t.replace(/font-family:\s*'Open Sans'/g, "font-family:'PE UI Sans'");
        head.appendChild(font);
      })
      .catch(function () {}); // no font: the panels fall back to Open Sans or the system font
  }

  // Squarespace closes the Edit Post window on any click outside it. Clicks, taps and keys inside
  // our panel and drawer stay inside them, and buttons don't take focus away from the window.
  function shield(box) {
    ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'touchstart', 'touchend', 'focusin', 'focusout', 'keydown', 'keyup', 'wheel']
      .forEach(function (t) { box.addEventListener(t, function (e) { e.stopPropagation(); }); });
    box.addEventListener('mousedown', function (e) {
      // Note text (class pe-sel) can be selected and copied, so it's left alone (29 Oct 2026)
      if (e.target.closest && e.target.closest('.pe-sel')) return;
      if (!/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) e.preventDefault();
    });
  }

  /* The drawer is a floating window, like the checklist panel:
   * - drag the title bar to move it anywhere; the spot is remembered
   * - click the title bar to shrink it to just the title bar, click again to open it
   * - double-click the title bar to put it back in the top-right corner, full size
   * Position is measured from the top-right corner of the window, so it opens where the old
   * full-height drawer used to sit. */
  var DRAWER_W = 380, DRAWER_H = 640;           // full size in pixels, before fitting the window
  var dpos = { r: 16, t: 16 };                   // gap from the right and top edges
  var drawerShut = false;                        // true when shrunk to the title bar
  var drawerHead, drawerInner, drawerChev;       // title bar, the part that's redrawn, and the ▾/▸ marker
  try {
    var dsaved = JSON.parse(ls('pe-hmw-pos') || 'null');
    if (dsaved && dsaved.r >= 0 && dsaved.t >= 0) dpos = { r: dsaved.r, t: dsaved.t };
    drawerShut = ls('pe-hmw-shut') === '1';
  } catch (e) {}

  // Keeps the window on screen and sizes it to fit below wherever it's been moved
  function placeDrawer() {
    if (!drawer) return;
    var w = drawer.ownerDocument.defaultView;
    dpos.r = Math.max(0, Math.min(w.innerWidth - 120, dpos.r));
    dpos.t = Math.max(0, Math.min(w.innerHeight - 48, dpos.t));
    drawer.style.right = dpos.r + 'px';
    drawer.style.top = dpos.t + 'px';
    drawer.style.width = Math.min(DRAWER_W, w.innerWidth - 16) + 'px';
    // shrunk: just the title bar. Open: full size, or whatever room is left below it.
    drawer.style.height = drawerShut ? 'auto' : Math.max(220, Math.min(DRAWER_H, w.innerHeight - dpos.t - 16)) + 'px';
    if (drawerInner) drawerInner.style.display = drawerShut ? 'none' : 'flex';
    if (drawerChev) drawerChev.textContent = drawerShut ? '▸' : '▾';
  }

  function setDrawerShut(v) {
    drawerShut = v;
    ls('pe-hmw-shut', v ? '1' : '');
    placeDrawer();
  }

  // Tells the shared drag code how a drag moves this window
  var drawerSpot = {
    get: function () { return { r: dpos.r, t: dpos.t }; },
    set: function (start, dx, dy) { dpos.r = start.r - dx; dpos.t = start.t + dy; placeDrawer(); },
    save: function () { ls('pe-hmw-pos', JSON.stringify(dpos)); }
  };

  // The title bar is built once, so a drag isn't cut short when suggestions arrive and the
  // rest of the window is redrawn underneath it
  function buildDrawerHead() {
    drawerHead = el('div', 'display:flex;align-items:center;gap:8px;padding:12px 16px;font-weight:700;font-size:15px;line-height:1.3;cursor:move;touch-action:none;user-select:none;');
    drawerHead.title = 'Click to shrink. Drag to move. Double-click to put it back in the corner.';
    drawerChev = el('span', 'flex:0 0 auto;width:12px;color:#888;font-size:12px;', '▾');
    drawerHead.appendChild(drawerChev);
    // The window is called Joe, after Joe Meek. Wordmark in the same style as Patchbay on the
    // site: a small glyph (a microphone) then the name in brand blue capitals, Open Sans 800
    var joe = el('span', 'flex:1;display:flex;align-items:center;gap:7px;color:' + C.blue + ';');
    joe.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:0 0 auto;display:block">' +
      '<rect x="9" y="2.5" width="6" height="11" rx="3"/><path d="M5.5 10.5a6.5 6.5 0 0 0 13 0"/><path d="M12 17v4.5"/><path d="M8.5 21.5h7"/></svg>' +
      '<span style="font-size:16px;font-weight:800;letter-spacing:.14em;line-height:1;">JOE</span>' +
      '<span title="Version of the site scripts this browser is running" style="font-size:11px;font-weight:600;letter-spacing:0;color:#9aa0a6;line-height:1;">v' + PE_VERSION + '</span>';
    joe.setAttribute('aria-label', 'Joe, help me write');
    drawerHead.appendChild(joe);
    var x = el('button', 'flex:0 0 auto;border:0;background:none;font-size:22px;font-weight:400;line-height:1;cursor:pointer;color:#8a9097;padding:0 2px;', '×');
    x.type = 'button';
    x.className = 'pe-x';
    x.setAttribute('aria-label', 'Close');
    x.title = 'Close';
    x.onclick = function () { drawer.style.display = 'none'; };
    drawerHead.appendChild(x);
    movable(drawerHead,
      function () { setDrawerShut(!drawerShut); },                     // click: shrink or open
      function () {                                                    // double-click: back to the corner
        dpos = { r: 16, t: 16 }; ls('pe-hmw-pos', '');
        setDrawerShut(false);
      },
      drawerSpot);
    return drawerHead;
  }

  function openDrawer(tab) {
    if (tab) drawerTab = tab;
    if (drawer && !drawer.isConnected) drawer = null;
    if (!drawer) {
      drawer = el('div', 'position:fixed;z-index:10002;max-width:calc(100vw - 16px);display:flex;flex-direction:column;overflow:hidden;' +
        'background:#fff;border:1px solid #e3e6ea;border-top:4px solid ' + C.blue + ';border-radius:8px;box-shadow:0 16px 40px rgba(17,24,39,.16),0 2px 6px rgba(17,24,39,.06);' +
        'font:14px/1.5 ' + F + ';color:#222;');
      drawer.className = 'pe-drawer';
      drawer.appendChild(buildDrawerHead());
      // everything under the title bar: tabs and the scrolling content
      drawerInner = el('div', 'flex:1;min-height:0;display:flex;flex-direction:column;');
      drawer.appendChild(drawerInner);
      shield(drawer);
      var doc = hostDoc();
      styleUp(doc);
      if (doc !== document) {
        drawer.style.zIndex = '2147483000';
        doc.querySelectorAll('.pe-drawer').forEach(function (d) { d.remove(); }); // one left from another post
        // close it when this post's preview goes away (another post opened, or the editor closed)
        addEventListener('pagehide', function () { if (drawer) drawer.remove(); });
      }
      doc.body.appendChild(drawer);
      doc.defaultView.addEventListener('resize', placeDrawer);
    }
    drawer.style.display = 'flex';
    // Opened from a warning's fix button: the person wants that tab, so don't leave it shrunk
    if (tab && drawerShut) setDrawerShut(false);
    placeDrawer();
    drawDrawer();
  }

  function articleText() {
    var body = articleBody();
    if (!body) return '';
    var copy = body.cloneNode(true);
    Array.prototype.forEach.call(copy.querySelectorAll('.pe-ui, .pe-signup, .pe-author-bio, script, style, noscript'), function (x) { x.remove(); });
    var t = (copy.innerText || copy.textContent || '').replace(/\n{3,}/g, '\n\n');
    // stop at the related links block, which isn't part of the article itself
    var cut = t.search(/You Might Also Find These Articles Useful/i);
    if (cut > 0) t = t.slice(0, cut);
    return t.trim().slice(0, 15000);
  }

  function currentFor(tab) {
    if (tab === 'headlines') return { label: 'Current SEO title', value: seo().seoTitle || postTitle(), max: C.titleMax };
    if (tab === 'meta') return { label: 'Current meta description', value: seo().seoDescription || '', min: C.metaMin, max: C.metaMax };
    return { label: 'Current URL', value: postData.urlId ? '/' + postData.urlId : location.pathname };
  }

  function lengthNote(text, min, max) {
    var n = text.length;
    var bad = (max && n > max) || (min && n < min);
    return el('span', 'flex:0 0 auto;padding-top:2px;font-size:11px;font-weight:600;font-variant-numeric:tabular-nums;color:' + (bad ? C.amber : '#8a9097') + ';', n + (max ? '/' + max : ''));
  }

  function suggestWrite(task, more) {
    var prev = writeSuggest[task] || {};
    writeSuggest[task] = { status: 'loading', options: prev.options || [] };
    drawDrawer();
    var payload = {
      action: 'write', task: task, title: postTitle(), seoTitle: seo().seoTitle || '',
      meta: seo().seoDescription || '', url: postData.urlId || '', text: articleText(),
      tags: (postData.tags || []).join(', '), categories: (postData.categories || []).join(', '),
      avoid: more ? (prev.options || []).join('\n') : ''
    };
    // Sent as plain text so the browser makes a simple request the Google Sheet accepts
    fetch(C.store, { method: 'POST', body: JSON.stringify(payload) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        writeSuggest[task] = d && d.options && d.options.length
          ? { status: 'done', options: (more ? (prev.options || []) : []).concat(d.options) }
          : { status: 'error', options: prev.options || [], error: (d && d.error) || 'No suggestions came back' };
      })
      .catch(function () { writeSuggest[task] = { status: 'error', options: prev.options || [], error: 'Could not reach the Google Sheet' }; })
      .then(drawDrawer);
  }

  function copyText(text, btn) {
    function done() { btn.textContent = 'Copied'; setTimeout(function () { btn.textContent = 'Copy'; }, 1500); }
    function fallback() {
      var t = document.createElement('textarea');
      t.value = text; document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); done(); } catch (e) {}
      t.remove();
    }
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
  }

  function copyButton(text) {
    var b = el('button', 'flex:0 0 auto;padding:3px 10px;border:1px solid #d5d9de;border-radius:5px;background:#fff;font:600 11.5px/1.6 ' + F + ';color:#333;cursor:pointer;', 'Copy');
    b.type = 'button';
    b.onclick = function () { copyText(text, b); };
    return b;
  }

  /* ---------- Use: putting Joe's suggestions straight into Squarespace ----------
   * Every suggestion has a Use button instead of Copy. It fills the field in Squarespace's own
   * Edit Post window (from the page editor it presses Settings to open it; from the post list Edit
   * opens it anyway), then reads the
   * field back to check the value took. If it didn't, that row offers Copy instead. You still
   * press Apply or Save, and after the next save the row checks the saved post has the new value.
   * Where each field lives (confirmed in the live editor, 30 Oct 2026):
   *   headline          Content tab, input[name=title] (Squarespace's older YUI forms)
   *   SEO title         SEO tab, first textarea.u-field-textarea (a React field)
   *   meta description  SEO tab, second textarea.u-field-textarea, placeholder "Enter a description…"
   *   URL               Options tab, input[name=urlId]
   *   alt text          the image's own panel, opened by double-clicking the image in the editor,
   *                     field under the "Image Alt Text" label (a React field)
   * React fields ignore a plain value change, so values are set through the browser's own value
   * setter and followed by input and change events, which React listens for. */

  var useDone = {};           // task|text: { st: 'busy'|'used'|'saved'|'notsaved'|'failed', why, at, field }
  var NO_SETTINGS = 'Click Edit on the post first, then Use again.';

  function visible(e) { var r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }
  function ours(e) { return !!(e.closest && e.closest('.pe-checklist, .pe-checklist-pill, .pe-drawer, .pe-ui')); }

  // Leaf text on screen, matched exactly or by a pattern, outside our own panels
  function textEl(doc, test) {
    return Array.prototype.filter.call(doc.querySelectorAll('div, span, label, button, a, p, h1, h2, h3'), function (e) {
      return e.children.length === 0 && !ours(e) && visible(e) && test(e.textContent.trim());
    })[0] || null;
  }

  // The Edit Post window: its headline box exists and its tabs are on screen (the headline box
  // itself is hidden on some tabs, so it can't be the test on its own). Null when it isn't open.
  function settingsDoc() {
    var docs = [hostDoc(), document];
    for (var i = 0; i < docs.length; i++) {
      if (docs[i].querySelector('input[name="title"]') && textEl(docs[i], function (t) { return t === 'SEO'; })) return docs[i];
    }
    return null;
  }

  // In the page editor, presses its Settings button so the Edit Post window opens.
  // Resolves with the window's document, or null if there was no way to open it.
  function openSettings() {
    var doc = settingsDoc();
    if (doc) return Promise.resolve(doc);
    var lab = Array.prototype.filter.call(document.querySelectorAll('.sqs-button-vanilla .label'), function (e) {
      return e.textContent.trim() === 'Settings' && visible(e);
    })[0];
    if (!lab) return Promise.resolve(null);
    (lab.closest('.sqs-button-vanilla') || lab).click();
    // a freshly opened window loads the post's saved values a moment after it appears, and
    // anything filled in before then is overwritten, so give it time to settle
    return waitFor(settingsDoc, 3000).then(function (doc) { return doc && wait(800).then(function () { return doc; }); });
  }

  // Fills a field, then watches it for a moment: if Squarespace puts its own value back (it can
  // while a tab is still loading), fills it again, up to three times. Resolves true once the
  // value has held for over half a second.
  function fillAndHold(f, v) {
    var tries = 0;
    function attempt() {
      setField(f, v);
      return wait(350).then(function () {
        if (f.value !== v && ++tries < 3) return attempt();
        return wait(300).then(function () { return f.value === v; });
      });
    }
    return attempt();
  }

  // Checks find() every 100ms until it returns something, or gives up after ms
  function waitFor(find, ms) {
    var until = Date.now() + ms;
    return new Promise(function (ok) {
      (function look() {
        var got = find();
        if (got || Date.now() > until) return ok(got || null);
        setTimeout(look, 100);
      })();
    });
  }

  // Clicks one of the Edit Post window's tabs (Content, Options, SEO...)
  function settingsTab(doc, name) {
    var tab = textEl(doc, function (t) { return t === name; });
    if (tab) tab.click();
  }

  // Sets a field's value the way typing would, so YUI and React forms both take it
  function setField(f, v) {
    var w = f.ownerDocument.defaultView;
    var proto = f.tagName === 'TEXTAREA' ? w.HTMLTextAreaElement.prototype : w.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(f, v);
    ['input', 'change', 'blur'].forEach(function (t) { f.dispatchEvent(new w.Event(t, { bubbles: true })); });
  }

  // The box under a label such as "SEO Title (Optional)", found by walking up from the label
  function boxUnder(doc, labelRe) {
    var lab = textEl(doc, function (t) { return labelRe.test(t); });
    for (var box = lab, i = 0; box && i < 5; i++) {
      box = box.parentElement;
      var f = box && Array.prototype.filter.call(box.querySelectorAll('textarea, input[type="text"], input:not([type])'), function (x) { return !ours(x); })[0];
      if (f) return f;
    }
    return null;
  }

  // The field in the Edit Post window for each kind of suggestion. Switches to its tab, then
  // waits until the field is drawn and on screen.
  function fieldFor(doc, field) {
    var tabName = field === 'title' ? 'Content' : field === 'url' ? 'Options' : 'SEO';
    settingsTab(doc, tabName);
    return waitFor(function () {
      var f = field === 'title' ? doc.querySelector('input[name="title"]')
        : field === 'url' ? doc.querySelector('input[name="urlId"]')
        : field === 'meta' ? boxUnder(doc, /^SEO Description/i)
        : boxUnder(doc, /^SEO Title/i);
      return f && visible(f) && !ours(f) ? f : null;
    }, 3000);
  }

  function useLabel(field) {
    return { title: 'headline', seotitle: 'SEO title', meta: 'meta description', url: 'URL', alt: 'alt text' }[field];
  }

  // Fills one field with one suggestion. key identifies the row; text is the suggestion.
  function useText(key, field, text) {
    var value = field === 'url' ? text.replace(/^https?:\/\/[^/]+/, '').replace(/^\/+/, '').split('/').pop() : text;
    if (field === 'url' && (+postData.workflowState || 0) === 1) {
      useDone[key] = { st: 'failed', why: 'This post is live. A new URL breaks every link to it, so change it by hand and add a redirect.' };
      return drawDrawer();
    }
    useDone[key] = { st: 'busy' };
    drawDrawer();
    openSettings().then(function (doc) {
      if (!doc) throw NO_SETTINGS;
      return fieldFor(doc, field);
    }).then(function (f) {
      if (!f) throw 'Couldn’t find the ' + useLabel(field) + ' box in Squarespace.';
      return fillAndHold(f, value).then(function (held) {
        if (!held) throw 'Squarespace didn’t keep the new ' + useLabel(field) + '.';
        // set every other row for this field back to its plain state
        Object.keys(useDone).forEach(function (k) { if (k !== key && useDone[k].field === field && useDone[k].st === 'used') delete useDone[k]; });
        useDone[key] = { st: 'used', at: Date.now(), field: field, value: value };
      });
    }).catch(function (why) {
      useDone[key] = { st: 'failed', why: typeof why === 'string' ? why : 'Squarespace didn’t take it.' };
    }).then(drawDrawer);
  }

  // Alt text: opens the image's panel in the editor and fills its alt text box
  function editorImage(src) {
    var docs = [document], host = hostDoc(), found = null;
    if (host !== document) docs.push(host);
    docs.some(function (doc) {
      found = Array.prototype.filter.call(doc.querySelectorAll('.sqs-layout.sqs-editing img'), function (i) {
        return imgSrc(i) === src && visible(i);
      })[0] || null;
      return !!found;
    });
    return found;
  }
  function altField() {
    var docs = [hostDoc(), document], out = null;
    docs.some(function (doc) {
      var lab = Array.prototype.filter.call(doc.querySelectorAll('*'), function (e) {
        return e.children.length === 0 && /^image alt text$/i.test(e.textContent.trim()) && visible(e);
      })[0];
      for (var box = lab, i = 0; box && i < 5 && !out; i++) { box = box.parentElement; out = box && box.querySelector('input, textarea'); }
      return !!out;
    });
    return out;
  }
  function useAlt(key, src, text) {
    var img = editorImage(src);
    if (!img) { useDone[key] = { st: 'failed', why: 'That picture isn’t open for editing. Click Edit, then Use again.' }; return drawDrawer(); }
    useDone[key] = { st: 'busy' };
    drawDrawer();
    img.scrollIntoView({ block: 'center' });
    var r = img.getBoundingClientRect(), w = img.ownerDocument.defaultView;
    img.dispatchEvent(new w.MouseEvent('dblclick', { bubbles: true, cancelable: true, view: w, detail: 2, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
    var tries = 0;
    (function look() {
      var f = altField();
      if (!f && ++tries < 12) return setTimeout(look, 150);
      if (!f) { useDone[key] = { st: 'failed', why: 'Squarespace didn’t open the picture’s settings.' }; return drawDrawer(); }
      setField(f, text);
      setTimeout(function () {
        useDone[key] = f.value === text
          ? { st: 'used', at: Date.now(), field: 'alt', value: text, why: '✓ Filled in. Click away from the picture panel, then Save.' }
          : { st: 'failed', why: 'Squarespace didn’t take the alt text.' };
        drawDrawer();
      }, 150);
    })();
  }

  // The buttons for one suggestion: Use (one per field), then its state
  function useButtons(task, text, fields, onUse) {
    var box = el('div', 'display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:7px;');
    var anyFailed = false;
    fields.forEach(function (field) {
      var key = task + '|' + field + '|' + text, d = useDone[key] || {};
      if (d.st === 'busy') { box.appendChild(el('span', 'font-size:12px;color:#777;', 'Filling in…')); return; }
      if (d.st === 'used' || d.st === 'saved') {
        box.appendChild(el('span', 'font-size:12px;font-weight:600;color:' + C.green + ';',
          d.st === 'saved' ? '✓ ' + useLabel(field).charAt(0).toUpperCase() + useLabel(field).slice(1) + ' saved' : d.why || '✓ Filled in. Press Apply or Save in Squarespace.'));
        return;
      }
      if (d.st === 'notsaved') box.appendChild(el('span', 'flex:1 0 100%;font-size:12px;color:' + C.red + ';', 'The saved post doesn’t have this ' + useLabel(field) + '. Use it again.'));
      if (d.st === 'failed') { anyFailed = true; box.appendChild(el('span', 'flex:1 0 100%;font-size:12px;color:' + C.red + ';', d.why)); }
      var label = fields.length > 1 ? 'Use as ' + useLabel(field) : 'Use';
      box.appendChild(linkBtn(label, function () { onUse(key, field); }, true));
    });
    if (anyFailed) {
      var c = copyButton(text);
      box.appendChild(c);
    }
    return box;
  }

  // After a save, checks the saved post holds each value Use filled in
  function usesSeen(it) {
    var seo = it.seoData || {}, changed = false;
    Object.keys(useDone).forEach(function (k) {
      var d = useDone[k];
      if (d.st !== 'used' || !(+it.updatedOn > d.at)) return;
      var saved = d.field === 'title' ? it.title : d.field === 'seotitle' ? seo.seoTitle : d.field === 'meta' ? seo.seoDescription :
        d.field === 'url' ? String(it.urlId || '').split('/').pop() : null;
      if (saved == null) return; // alt text isn't in the post data, so it's left as filled in
      d.st = String(saved).trim() === String(d.value).trim() ? 'saved' : 'notsaved';
      changed = true;
    });
    if (changed && drawer) drawDrawer();
  }

  function actionButton(text, onclick, primary) {
    var b = el('button', 'margin:12px 0;padding:8px 14px;border:' + (primary ? '1px solid ' + C.blue : '1px solid #d5d9de') + ';border-radius:6px;background:' +
      (primary ? C.blue : '#fff') + ';color:' + (primary ? '#fff' : '#222') + ';font:700 13px ' + F + ';cursor:pointer;', text);
    b.type = 'button';
    b.onclick = onclick;
    return b;
  }

  function drawDrawer() {
    if (!drawer || !drawerInner) return;
    // only the part under the title bar is redrawn; keep the reader's scroll position
    var scroll = drawerInner.lastChild ? drawerInner.lastChild.scrollTop : 0;
    drawerInner.innerHTML = '';

    var tabs = el('div', 'display:flex;gap:4px;flex-wrap:wrap;padding:8px 12px;border-top:1px solid #eceef1;border-bottom:1px solid #eceef1;background:#fafbfc;');
    drawerTabs().forEach(function (t) {
      var on = t[0] === drawerTab;
      var b = el('button', 'padding:5px 11px;border:0;border-radius:999px;background:' + (on ? '#e3eef8' : 'transparent') + ';color:' + (on ? C.blue : '#5a6068') +
        ';font:' + (on ? 700 : 600) + ' 12.5px ' + F + ';cursor:pointer;', t[1]);
      b.type = 'button';
      b.onclick = function () { drawerTab = t[0]; drawDrawer(); };
      tabs.appendChild(b);
    });
    drawerInner.appendChild(tabs);

    var body = el('div', 'flex:1;min-height:0;overflow:auto;padding:4px 16px 16px;');
    drawerInner.appendChild(body);
    if (drawerTab === 'links' && !linksOn()) drawerTab = 'headlines';
    if (drawerTab === 'image' && !imageOn()) drawerTab = 'headlines';
    if (drawerTab === 'alt') drawAltTab(body); else if (drawerTab === 'links') drawLinksTab(body);
    else if (drawerTab === 'image') drawImageTab(body); else drawWriteTab(body);
    body.scrollTop = scroll;
  }

  function drawWriteTab(body) {
    var task = drawerTab, cur = currentFor(task), sg = writeSuggest[task] || {};
    var curBox = el('div', 'margin:14px 0 4px;padding:10px 12px;background:#f6f7f9;border:1px solid #eceef1;border-radius:6px;font-size:13px;line-height:1.45;');
    curBox.appendChild(el('div', 'font:700 10.5px ' + F + ';letter-spacing:.08em;text-transform:uppercase;color:#7a8088;margin-bottom:4px;', cur.label));
    var cv = el('div', 'display:flex;gap:8px;align-items:flex-start;');
    cv.appendChild(el('span', 'flex:1;color:' + (cur.value ? '#222' : '#999') + ';', cur.value || 'None yet'));
    if (cur.value && (cur.max || cur.min)) cv.appendChild(lengthNote(cur.value, cur.min, cur.max));
    curBox.appendChild(cv);
    body.appendChild(curBox);

    if (!sg.status) {
      var what = task === 'headlines' ? 'Suggest headlines' : task === 'meta' ? 'Suggest meta descriptions' : 'Suggest URLs';
      body.appendChild(actionButton(what, function () { suggestWrite(task); }, true));
      body.appendChild(el('div', 'font-size:12px;color:#777;', 'Claude reads this article and suggests options using the house SEO rules. Use fills your choice into Squarespace; nothing goes live until you press Apply or Save.'));
      return;
    }
    // headlines can go in as the headline or the SEO title; the rest have one home each
    var fields = task === 'headlines' ? ['title', 'seotitle'] : task === 'meta' ? ['meta'] : ['url'];
    (sg.options || []).forEach(function (o) {
      var item = el('div', 'padding:11px 0;border-bottom:1px solid #eceef1;');
      var row = el('div', 'display:flex;gap:10px;align-items:flex-start;');
      row.appendChild(el('span', 'flex:1;line-height:1.5;', o));
      if (task !== 'url') row.appendChild(lengthNote(o, cur.min, cur.max));
      item.appendChild(row);
      item.appendChild(useButtons(task, o, fields, function (key, field) { useText(key, field, o); }));
      body.appendChild(item);
    });
    if (sg.status === 'loading') body.appendChild(el('div', 'padding:12px 0;color:#777;', 'Writing…'));
    if (sg.status === 'error') body.appendChild(el('div', 'padding:10px 0;color:' + C.red + ';font-size:13px;', sg.error));
    if (sg.status !== 'loading') body.appendChild(actionButton('More options', function () { suggestWrite(task, true); }));
    body.appendChild(el('div', 'font-size:12px;color:#777;', task === 'url'
      ? 'Changing the URL of a published post breaks existing links to it, so Use only works before publishing.'
      : 'Use fills it into the post’s settings. Open Settings (or Edit from the post list) first, then press Apply or Save.'));
  }

  /* ---------- Alt text ---------- */

  function imgSrc(i) { return String(i.getAttribute('data-src') || i.currentSrc || i.src || '').split('?')[0]; }

  // The heading and caption around an image, so the description can be specific
  function imgContext(i) {
    var body = articleBody(), section = '';
    if (body) Array.prototype.forEach.call(body.querySelectorAll('h2, h3, h4'), function (h) {
      if (h.compareDocumentPosition(i) & Node.DOCUMENT_POSITION_FOLLOWING) section = h.textContent.trim();
    });
    var holder = i.closest('figure, .sqs-block, .promoted-block-image');
    var cap = holder && holder.querySelector('figcaption, .image-caption');
    return { section: section, caption: cap ? cap.textContent.replace(/\s+/g, ' ').trim() : '' };
  }

  function suggestAlt(imgs) {
    var chain = Promise.resolve();
    imgs.forEach(function (i) {
      var src = imgSrc(i);
      if (altSuggest[src] && altSuggest[src].status !== 'error') return;
      altSuggest[src] = { status: 'loading' };
      chain = chain.then(function () {
        var ctx = imgContext(i);
        var q = 'action=alt&img=' + encodeURIComponent(src) + '&title=' + encodeURIComponent(postTitle()) +
          '&section=' + encodeURIComponent(ctx.section) + '&caption=' + encodeURIComponent(ctx.caption);
        return fetch(C.store + '?' + q).then(function (r) { return r.json(); }).then(function (d) {
          altSuggest[src] = d && d.alt ? { status: 'done', text: d.alt } : { status: 'error', text: (d && d.error) || 'No suggestion' };
        }).catch(function () { altSuggest[src] = { status: 'error', text: 'Could not reach the Google Sheet' }; })
          .then(drawDrawer);
      });
    });
    drawDrawer();
  }

  function drawAltTab(body) {
    var r = auto.filter(function (x) { return x.kind === 'alt'; })[0];
    if (!r) { body.appendChild(el('div', 'padding:14px 0;color:' + C.green + ';', '✓ Every image has alt text.')); return; }
    var any = r.els.some(function (i) { return altSuggest[imgSrc(i)]; });
    body.appendChild(el('div', 'margin:12px 0 4px;font-size:13px;color:#555;', r.text + '. Click a picture to find it in the article.'));
    if (!any) {
      body.appendChild(actionButton('Suggest alt text', function () { suggestAlt(r.els); }, true));
      return;
    }
    r.els.forEach(function (i) {
      var sg = altSuggest[imgSrc(i)] || {};
      var row = el('div', 'display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-bottom:1px solid #eceef1;');
      var th = el('img', 'flex:0 0 auto;width:64px;height:44px;object-fit:cover;border-radius:4px;cursor:pointer;background:#eee;');
      th.src = imgSrc(i) + '?format=100w';
      th.alt = '';
      th.title = 'Show me';
      th.onclick = function () { point([i]); };
      row.appendChild(th);
      var txt = el('div', 'flex:1;min-width:0;');
      txt.appendChild(el('span', 'font-size:13px;color:' + (sg.status === 'error' ? C.red : '#222') + ';',
        sg.status === 'loading' ? 'Writing…' : sg.text || 'Not asked yet'));
      if (sg.status === 'done') txt.appendChild(useButtons('alt|' + imgSrc(i), sg.text, ['alt'], function (key) { useAlt(key, imgSrc(i), sg.text); }));
      row.appendChild(txt);
      body.appendChild(row);
    });
    body.appendChild(el('div', 'margin-top:10px;font-size:12px;color:#777;', 'Read each one first. Use opens the picture’s panel in the editor and fills in its alt text; then Save.'));
  }

  /* ---------- Image (hero image from Depositphotos) ----------
   * Three steps, all in this tab (since v1.3 step 1 is Add image: drop any picture in; the
   * Depositphotos searches sit under it behind "No picture yet?"):
   *   1 Search: Joe suggests three Depositphotos searches for the draft (the pe-image-search
   *     rules, asked of the sheet as task 'image'). If the sheet has no Image prompt yet, three
   *     searches are built from the headline instead, so the tab still works. Open in
   *     Depositphotos opens that search in a new browser tab, on the team member's own login.
   *     Depositphotos keeps its filters in a scrambled code in the address (?sh=...), so the link
   *     can't pre-set Horizontal; set it once in Depositphotos (checked 30 Oct 2026).
   *   2 Crop and name: drop the downloaded file in (or choose it). A 16:9 frame sits over it and
   *     drags to keep the right part in shot. The file name comes from the search used, editable.
   *     Save image downloads the crop at up to 2500px wide as a JPEG under that name.
   *   3 Place: Place as hero puts the crop into the first image block in the post, the way
   *     dragging it into that block would: it opens the block's panel (double-click), hands the
   *     file to the panel's own upload box (Add an Image on an empty block, Replace on a full one)
   *     and waits until the panel shows the new file name. Then Write alt text moves to the Alt
   *     text tab for the new picture. Nothing goes live until Save.
   *     How the panel works was checked in the live Edit Post window on 30 Oct 2026: the panel has
   *     an ordinary file input (accept image/jpeg, png, gif, webp) beside "Add an Image" or
   *     "Replace", and setting its files and firing change uploads the picture; "Alternate
   *     Filename" then reads the file's name and "Image alt text" takes a typed value.
   * While it's being tested only the initials in IMAGE.who see the tab. Opening any post with
   * ?image on the end of its address also turns it on in that browser. */
  var IMAGE = {
    who: 'all',               // initials that see the tab, or 'all' (everyone since v1.2)
    width: 2500,              // widest Squarespace uses; the crop is saved at this width
    ratio: 16 / 9,
    quality: 0.86,            // JPEG quality for the saved crop
    stock: 'https://depositphotos.com/photos/'
  };
  var imgSearch = null;       // { status, options: [{q, note}], error, local }
  var imgPick = null;         // { img, file, w, h, x, y, name, err } once a file is dropped in
  var imgLastQ = '';          // the search last opened, used for the file name

  if (/[?&]image\b/.test(location.search)) ls('pe-image', '1');
  function imageOn() {
    if (IMAGE.who === 'all' || ls('pe-image') === '1') return true;
    return IMAGE.who.indexOf((ls('pe-initials') || '').toUpperCase()) !== -1;
  }

  // file-name style: lower case words joined by hyphens, nothing else
  function slugWords(t, max) {
    var w = String(t || '').toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
    return w.slice(0, max || 8).join('-');
  }

  // Searches built from the headline, for when the sheet has no Image prompt
  var IMG_STOP = /^(a|an|the|and|or|but|for|to|of|in|on|at|by|with|from|into|is|are|was|were|be|it|its|this|that|these|those|what|why|how|when|who|which|your|you|we|our|still|now|new|vs|versus|best|top|review|reviewed|explained|guide|need|needs|watch|really|actually|just|more|most|than|can|could|should|will|about|after|before|every|all|any|do|does|get|gets|make|makes|use|using|2024|2025|2026|2027)$/;
  function localSearches() {
    var words = postTitle().replace(/[^A-Za-z0-9\s'-]/g, ' ').split(/\s+/).filter(function (w) { return w && !IMG_STOP.test(w.toLowerCase()); })
      .map(function (w) { return w.toLowerCase(); });
    var core = words.slice(0, 4).join(' ');
    var two = words.slice(0, 2).join(' ');
    var out = [];
    if (core) out.push({ q: core, note: 'Straight from the headline' });
    if (two) out.push({ q: two + ' recording studio', note: 'The subject in a working room' });
    out.push({ q: (two ? two + ' ' : '') + 'audio engineer', note: 'A person at work, wider choice of shots' });
    return out;
  }

  // The sheet's answer: one search per line, optionally "search | why"
  function parseSearches(opts) {
    return (opts || []).map(function (o) {
      var bits = String(o).split(/\s+\|\s+|\s+[–—-]\s+/);
      return { q: bits[0].replace(/^["'\d.\s]+|["']$/g, '').trim(), note: (bits[1] || '').trim() };
    }).filter(function (x) { return x.q; }).slice(0, 6);
  }

  function suggestImage(more) {
    var prev = imgSearch && imgSearch.options || [];
    imgSearch = { status: 'loading', options: more ? prev : [] };
    drawDrawer();
    var payload = {
      action: 'write', task: 'image', title: postTitle(), seoTitle: seo().seoTitle || '',
      meta: seo().seoDescription || '', url: postData.urlId || '', text: articleText().slice(0, 4000),
      tags: (postData.tags || []).join(', '), categories: (postData.categories || []).join(', '),
      avoid: more ? prev.map(function (x) { return x.q; }).join('\n') : ''
    };
    fetch(C.store, { method: 'POST', body: JSON.stringify(payload) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var got = d && d.options ? parseSearches(d.options) : [];
        if (got.length) imgSearch = { status: 'done', options: (more ? prev : []).concat(got) };
        else throw (d && d.error) || 'none';
      })
      .catch(function () {
        // no Image prompt in the sheet yet (or no answer): fall back to the headline
        imgSearch = more && prev.length ? { status: 'done', options: prev, local: true, error: 'No more searches came back.' }
          : { status: 'done', options: localSearches(), local: true };
      })
      .then(drawDrawer);
  }

  function openStock(q) {
    imgLastQ = q;
    var url = IMAGE.stock + encodeURIComponent(slugWords(q, 10)) + '.html';
    var w = hostDoc().defaultView || window;
    w.open(url, '_blank', 'noopener');
    if (imgPick && imgPick.auto) imgPick.name = imgName();
  }

  function imgName() {
    var base = slugWords(imgLastQ, 6) || slugWords(postTitle(), 6) || 'hero-image';
    return base + '.jpg';
  }

  // Reads a dropped or chosen file into the crop step
  function takeImageFile(file) {
    if (!file || !/^image\//.test(file.type)) { imgPick = { err: 'That isn’t a picture. Drop in the JPEG from Depositphotos.' }; return drawDrawer(); }
    var url = URL.createObjectURL(file);
    var im = new Image();
    im.onload = function () {
      var w = im.naturalWidth, h = im.naturalHeight, cw, ch;
      if (w / h > IMAGE.ratio) { ch = h; cw = Math.round(h * IMAGE.ratio); } else { cw = w; ch = Math.round(w / IMAGE.ratio); }
      imgPick = { img: im, url: url, file: file, w: w, h: h, cw: cw, ch: ch, x: Math.round((w - cw) / 2), y: Math.round((h - ch) / 2), name: imgName(), auto: true };
      drawDrawer();
    };
    im.onerror = function () { imgPick = { err: 'Couldn’t open that file.' }; drawDrawer(); };
    im.src = url;
  }

  // The crop preview: the picture, darkened outside the 16:9 frame, which drags
  function cropCanvas() {
    var P = imgPick, cv = el('canvas', 'display:block;width:100%;border-radius:6px;background:#eee;cursor:grab;touch-action:none;');
    var dw = 344, dh = Math.round(dw * P.h / P.w);
    var dpr = (hostDoc().defaultView || window).devicePixelRatio || 1;
    cv.width = dw * dpr; cv.height = dh * dpr;
    cv.style.aspectRatio = P.w + ' / ' + P.h;
    var g = cv.getContext('2d'), k = dw / P.w;
    function paint() {
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.drawImage(P.img, 0, 0, dw, dh);
      g.fillStyle = 'rgba(0,0,0,.55)';
      var fx = P.x * k, fy = P.y * k, fw = P.cw * k, fh = P.ch * k;
      g.fillRect(0, 0, dw, fy); g.fillRect(0, fy + fh, dw, dh - fy - fh);
      g.fillRect(0, fy, fx, fh); g.fillRect(fx + fw, fy, dw - fx - fw, fh);
      g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(fx + 1, fy + 1, fw - 2, fh - 2);
      // rule-of-thirds guides, faint
      g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1;
      [1, 2].forEach(function (i) {
        g.beginPath(); g.moveTo(fx + fw * i / 3, fy); g.lineTo(fx + fw * i / 3, fy + fh); g.stroke();
        g.beginPath(); g.moveTo(fx, fy + fh * i / 3); g.lineTo(fx + fw, fy + fh * i / 3); g.stroke();
      });
    }
    paint();
    var drag = null;
    cv.addEventListener('pointerdown', function (e) {
      drag = { x: e.clientX, y: e.clientY, px: P.x, py: P.y };
      cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing';
      e.preventDefault(); e.stopPropagation();
    });
    cv.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var scale = P.w / cv.getBoundingClientRect().width;
      P.x = Math.round(Math.max(0, Math.min(P.w - P.cw, drag.px + (e.clientX - drag.x) * scale)));
      P.y = Math.round(Math.max(0, Math.min(P.h - P.ch, drag.py + (e.clientY - drag.y) * scale)));
      paint();
    });
    function end() { drag = null; cv.style.cursor = 'grab'; }
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    cv.addEventListener('dblclick', function () { P.x = Math.round((P.w - P.cw) / 2); P.y = Math.round((P.h - P.ch) / 2); paint(); });
    return cv;
  }

  // The crop as a JPEG file under the chosen name. Resolves { file, w, h } or null.
  function makeCrop() {
    var P = imgPick, outW = Math.min(IMAGE.width, P.cw), outH = Math.round(outW / IMAGE.ratio);
    var doc = hostDoc(), c = doc.createElement('canvas');
    c.width = outW; c.height = outH;
    var g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(P.img, P.x, P.y, P.cw, P.ch, 0, 0, outW, outH);
    var name = (slugWords(String(P.name).replace(/\.(jpe?g|png|webp)$/i, ''), 12) || 'hero-image') + '.jpg';
    P.name = name;
    return new Promise(function (ok) {
      c.toBlob(function (blob) {
        if (!blob) return ok(null);
        var W = doc.defaultView || window;
        ok({ blob: blob, file: new W.File([blob], name, { type: 'image/jpeg' }), w: outW, h: outH, name: name });
      }, 'image/jpeg', IMAGE.quality);
    });
  }

  function saveCrop() {
    var P = imgPick, doc = hostDoc();
    makeCrop().then(function (out) {
      if (!out) { P.saved = 'failed'; return drawDrawer(); }
      var blob = out.blob, outW = out.w, outH = out.h, name = out.name;
      var a = doc.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = name;
      doc.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
      P.saved = { w: outW, h: outH, kb: Math.round(blob.size / 1024) };
      drawDrawer();
    });
  }

  /* Place as hero. The post must be open for editing (Edit on the page, or Edit Post from the
   * post list). Works in whichever window holds the editing text blocks, like Links' Add. */
  function editDocs() { var d = [document], h = hostDoc(); if (h !== document) d.push(h); return d; }

  // The first image block in the post being edited, or null
  function heroBlock() {
    var found = null;
    editDocs().some(function (doc) {
      var layout = doc.querySelector('.sqs-layout.sqs-editing');
      found = layout && Array.prototype.filter.call(layout.querySelectorAll('.sqs-block-image'), function (b) { return !ours(b) && visible(b); })[0] || null;
      return !!found;
    });
    return found;
  }
  function editingOpen() { return editDocs().some(function (doc) { return !!doc.querySelector('.sqs-layout.sqs-editing'); }); }

  // The upload box in an open image panel: the file input next to "Add an Image" or "Replace"
  function panelUpload() {
    var out = null;
    editDocs().some(function (doc) {
      var lab = Array.prototype.filter.call(doc.querySelectorAll('div, span, button, p'), function (e) {
        return e.children.length === 0 && !ours(e) && visible(e) && /^(add an image|replace)$/i.test(e.textContent.trim());
      })[0];
      for (var box = lab, i = 0; box && i < 8 && !out; i++) {
        box = box.parentElement;
        out = box && box.querySelector('input[type="file"]');
      }
      return !!out;
    });
    return out;
  }

  // The file name the open panel shows (its "Alternate Filename" box, or the text beside Replace)
  function panelShows(name) {
    return editDocs().some(function (doc) {
      var hit = false;
      Array.prototype.forEach.call(doc.querySelectorAll('input:not([type="file"])'), function (f) { if (!ours(f) && f.value === name) hit = true; });
      if (!hit) hit = !!Array.prototype.filter.call(doc.querySelectorAll('div, span, p'), function (e) {
        return e.children.length === 0 && !ours(e) && e.textContent.trim() === name && visible(e);
      })[0];
      return hit;
    });
  }

  function placeHero() {
    var P = imgPick;
    if (!editingOpen()) { P.placed = { st: 'failed', why: 'Click Edit on the post first, then Place as hero again.' }; return drawDrawer(); }
    var block = heroBlock();
    if (!block) { P.placed = { st: 'failed', why: 'There’s no image block in the post. Add an empty image block at the top, then Place as hero again.' }; return drawDrawer(); }
    P.placed = { st: 'busy' };
    drawDrawer();
    makeCrop().then(function (out) {
      if (!out) throw 'The browser couldn’t make the file.';
      // open the block's panel: an empty block opens on a click, a full one on a double-click
      block.scrollIntoView({ block: 'center' });
      var w = block.ownerDocument.defaultView, r = block.getBoundingClientRect();
      var at = { bubbles: true, cancelable: true, view: w, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
      block.dispatchEvent(new w.MouseEvent('click', at));
      at.detail = 2;
      (block.querySelector('img') || block).dispatchEvent(new w.MouseEvent('dblclick', at));
      return waitFor(panelUpload, 4000).then(function (inp) {
        if (!inp) throw 'Squarespace didn’t open the image panel. Click the top image once, then Place as hero again.';
        var IW = inp.ownerDocument.defaultView;
        var dt = new IW.DataTransfer();
        dt.items.add(out.file.constructor === IW.File ? out.file : new IW.File([out.blob], out.name, { type: 'image/jpeg' }));
        inp.files = dt.files;
        inp.dispatchEvent(new IW.Event('change', { bubbles: true }));
        // uploading a large JPEG can take a while on a slow connection
        return waitFor(function () { return panelShows(out.name); }, 30000);
      }).then(function (ok) {
        if (!ok) throw 'The upload didn’t show up in the panel. Check the top image, or use Save image and upload it by hand.';
        P.placed = { st: 'done', name: out.name, w: out.w, h: out.h };
      });
    }).catch(function (why) {
      P.placed = { st: 'failed', why: typeof why === 'string' ? why : 'Squarespace didn’t take the picture. Use Save image and upload it by hand.' };
    }).then(drawDrawer);
  }

  // After placing: the Alt text tab, with suggestions already asked for the new picture
  function altForHero() {
    drawerTab = 'alt';
    drawDrawer();
    refreshAuto().then(function () {
      var r = auto.filter(function (x) { return x.kind === 'alt'; })[0];
      if (r && r.els && r.els.length) suggestAlt(r.els);
    });
  }

  function stepBar(n) {
    var bar = el('div', 'display:flex;gap:4px;margin:12px 0 4px;');
    ['Add image', 'Crop and name', 'Place'].forEach(function (t, i) {
      var on = i + 1 === n, done = i + 1 < n;
      bar.appendChild(el('span', 'flex:1;text-align:center;padding:4px 0;border-radius:4px;font:600 11px ' + F + ';background:' + (on ? '#e3eef8' : '#f4f5f7') +
        ';color:' + (on ? C.blue : done ? '#5a6068' : '#9aa0a6') + ';', (done ? '✓ ' : (i + 1) + ' ') + t));
    });
    return bar;
  }

  function sub(text) { return el('div', 'font:700 10.5px ' + F + ';letter-spacing:.08em;text-transform:uppercase;color:#7a8088;margin:14px 0 6px;', text); }

  // Below this width a file is too small for a hero; from Depositphotos it's almost certainly the
  // watermarked preview, which is what you get when not signed in (since v1.3)
  var IMG_TOO_SMALL = 1000;

  function dropZone() {
    var dz = el('div', 'padding:18px 12px;border:1.5px dashed #c9cfd6;border-radius:8px;text-align:center;font-size:13px;color:#5a6068;background:#fafbfc;');
    dz.appendChild(el('div', 'margin-bottom:4px;font-weight:600;color:#222;', 'Drop a picture here'));
    dz.appendChild(el('div', 'margin-bottom:10px;font-size:12px;color:#777;', 'A press shot, a screenshot or a Depositphotos download'));
    var pick = el('input', 'display:none;');
    pick.type = 'file'; pick.accept = 'image/*';
    pick.onchange = function () { takeImageFile(pick.files && pick.files[0]); };
    dz.appendChild(pick);
    dz.appendChild(linkBtn('Choose file', function () { pick.click(); }));
    ['dragenter', 'dragover'].forEach(function (t) {
      dz.addEventListener(t, function (e) { e.preventDefault(); e.stopPropagation(); dz.style.borderColor = C.blue; dz.style.background = '#eef5fb'; });
    });
    dz.addEventListener('dragleave', function (e) { e.stopPropagation(); dz.style.borderColor = '#c9cfd6'; dz.style.background = '#fafbfc'; });
    dz.addEventListener('drop', function (e) {
      e.preventDefault(); e.stopPropagation();
      takeImageFile(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]);
    });
    return dz;
  }

  // The Depositphotos searches, opened from "No picture yet?" under the drop box
  function drawSearch(body) {
    if (!imgSearch) {
      var ask = el('div', 'margin-top:10px;font-size:12.5px;color:#555;display:flex;align-items:center;gap:8px;flex-wrap:wrap;');
      ask.appendChild(el('span', '', 'No picture yet?'));
      ask.appendChild(linkBtn('Find one on Depositphotos', function () { suggestImage(); }));
      body.appendChild(ask);
      return;
    }
    body.appendChild(el('div', 'margin:12px 0 2px;padding:8px 10px;border-radius:6px;background:#fdf6e9;color:#7a4b00;font-size:12px;line-height:1.45;',
      'Sign in to the Production Expert Depositphotos account before downloading. Only a signed-in download is full size and licensed for the site.'));
    (imgSearch.options || []).forEach(function (o) {
      var item = el('div', 'padding:9px 0;border-bottom:1px solid #eceef1;');
      item.appendChild(el('div', 'font:600 13px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;color:#222;', o.q));
      if (o.note) item.appendChild(el('div', 'font-size:12px;color:#777;margin-top:2px;', o.note));
      var row = el('div', 'display:flex;gap:6px;margin-top:7px;');
      row.appendChild(linkBtn('Open in Depositphotos ↗', function () { openStock(o.q); drawDrawer(); }, true));
      row.appendChild(copyButton(o.q));
      if (imgLastQ === o.q) row.appendChild(el('span', 'align-self:center;font-size:12px;color:' + C.green + ';', '✓ Opened'));
      item.appendChild(row);
      body.appendChild(item);
    });
    if (imgSearch.status === 'loading') body.appendChild(el('div', 'padding:10px 0;color:#777;', 'Writing…'));
    if (imgSearch.local) body.appendChild(el('div', 'margin-top:8px;font-size:12px;color:#777;', 'Built from the headline. Joe’s own suggestions arrive once the Image row is added to the sheet’s Prompts tab.'));
    if (imgSearch.error) body.appendChild(el('div', 'margin-top:6px;font-size:12px;color:' + C.red + ';', imgSearch.error));
    if (imgSearch.status !== 'loading') body.appendChild(actionButton('More options', function () { suggestImage(true); }));
    body.appendChild(el('div', 'font-size:12px;color:#777;', 'In Depositphotos, set Orientation to Horizontal. Download the photo, then drop it in above.'));
  }

  function drawImageTab(body) {
    var has = imgPick && !imgPick.err;
    var step = !has ? 1 : imgPick.placed && imgPick.placed.st === 'done' ? 3 : 2;
    body.appendChild(stepBar(step));

    // ---- 1 Add image ----
    body.appendChild(sub('1 Add image'));
    if (!has) {
      body.appendChild(dropZone());
      if (imgPick && imgPick.err) body.appendChild(el('div', 'margin-top:6px;font-size:12px;color:' + C.red + ';', imgPick.err));
      drawSearch(body);
    } else {
      body.appendChild(el('div', 'font-size:12.5px;color:' + C.green + ';', '✓ ' + imgPick.file.name + ' (' + imgPick.w + ' × ' + imgPick.h + ')'));
    }

    // ---- 2 Crop and name ----
    body.appendChild(sub('2 Crop and name'));
    if (!has) {
      body.appendChild(el('div', 'font-size:12.5px;color:#9aa0a6;', 'Add a picture first.'));
    } else {
      var P = imgPick;
      if (P.w < IMG_TOO_SMALL) body.appendChild(el('div', 'margin-bottom:8px;padding:8px 10px;border-radius:6px;background:#fdecea;color:' + C.red + ';font-size:12px;line-height:1.45;',
        'This picture is only ' + P.w + 'px wide, too small for a hero. If it came from Depositphotos it’s the watermarked preview: sign in to the Production Expert account and download it again.'));
      body.appendChild(el('div', 'text-align:right;font-size:11.5px;color:#777;margin-bottom:6px;', 'Drag to reposition'));
      body.appendChild(cropCanvas());
      var outW = Math.min(IMAGE.width, P.cw);
      body.appendChild(el('div', 'font-size:11.5px;margin-top:5px;color:' + (P.cw < IMAGE.width ? C.amber : '#777') + ';',
        P.cw < IMAGE.width ? 'Saved at ' + outW + ' × ' + Math.round(outW / IMAGE.ratio) + ', smaller than the ' + IMAGE.width + 'px hero size. A larger file looks sharper.'
          : '16:9, saved at ' + outW + ' × ' + Math.round(outW / IMAGE.ratio) + '. Double-click the picture to centre the frame.'));

      body.appendChild(el('div', 'font-size:12px;color:#5a6068;margin:12px 0 4px;', 'File name'));
      var nm = el('input', 'width:100%;padding:7px 9px;border:1px solid #cfd4da;border-radius:6px;font:13px ui-monospace,SFMono-Regular,Menlo,monospace;color:#222;');
      nm.type = 'text'; nm.value = P.name;
      nm.oninput = function () { P.name = nm.value; P.auto = false; };
      body.appendChild(nm);

      var acts = el('div', 'display:flex;gap:6px;flex-wrap:wrap;align-items:center;');
      acts.appendChild(actionButton(P.placed && P.placed.st === 'done' ? 'Place again' : 'Place as hero', function () { placeHero(); }, true));
      acts.appendChild(actionButton(P.saved && P.saved !== 'failed' ? 'Save again' : 'Save image', function () { saveCrop(); }));
      acts.appendChild(actionButton('Different file', function () { if (P.url) URL.revokeObjectURL(P.url); imgPick = null; drawDrawer(); }));
      body.appendChild(acts);
      if (P.saved === 'failed') body.appendChild(el('div', 'font-size:12px;color:' + C.red + ';', 'The browser couldn’t make the file. Try Save image again.'));
      else if (P.saved) body.appendChild(el('div', 'font-size:12px;color:' + C.green + ';', '✓ Saved ' + P.name + ' (' + P.saved.w + ' × ' + P.saved.h + ', ' + P.saved.kb + ' KB) to your downloads.'));
    }

    // ---- 3 Place ----
    body.appendChild(sub('3 Place'));
    var pl = imgPick && imgPick.placed;
    if (pl && pl.st === 'busy') body.appendChild(el('div', 'font-size:12.5px;color:#777;', 'Placing the picture in the top image block…'));
    else if (pl && pl.st === 'failed') body.appendChild(el('div', 'font-size:12.5px;color:' + C.red + ';line-height:1.5;', pl.why));
    else if (pl && pl.st === 'done') {
      body.appendChild(el('div', 'font-size:12.5px;color:' + C.green + ';line-height:1.5;', '✓ ' + pl.name + ' is in the top image block (' + pl.w + ' × ' + pl.h + '). Write the alt text next, then Save the post.'));
      body.appendChild(actionButton('Write alt text', altForHero, true));
    } else body.appendChild(el('div', 'font-size:12.5px;color:#555;line-height:1.5;', 'With the post open in Edit, Place as hero puts the crop into the first image block, replacing any picture already there. Nothing goes live until you Save. Save image downloads the file instead, if you’d rather upload it by hand.'));
  }

  /* ---------- Links (internal links inside the draft) ----------
   * The pe-internal-links skill, built into Help me write. The nightly Related Answers job
   * publishes links-index.json: every article that may be linked to (last three years or still
   * earning Google clicks, never partner content), each with a few anchor phrases, a reason line,
   * whether it's about one product or brand, and its first-seven-days views from the stats sheet.
   *
   * This tab looks for those phrases, word for word, in the post's text blocks and suggests the
   * best few. A link only ever goes on words already in the article; the wording never changes.
   * The skill's rules, in code:
   *   - never in headings, quotes, captions, the opening words, the last paragraph, or after
   *     "You Might Also Find These Articles Useful"
   *   - never to this post, or to an article it already links to
   *   - one link per paragraph, one per article, roughly one per 200 words
   *   - on Partner posts, and on reviews or news about one brand's product, never to another
   *     brand's product or to a roundup or buying guide (the competitor rule)
   *   - better tiers win ties: Exceptional, Strong, Average, Below median, Unscored
   *
   * Add puts the link in for you, through Squarespace's own editor, with the post open in Edit
   * (inline on the page, or the Edit Post window from the post list):
   *   1. finds the same paragraph in the text being edited
   *   2. selects exactly those words
   *   3. hands Squarespace's editor the link as a paste, the way pasting by hand would
   *   4. checks the link is there and the text around it is unchanged. If not, it undoes
   *      whatever happened and that row falls back to Show in post and Copy link.
   * You still press Save. After the next save the row checks the saved post really has the link.
   *
   * While it's being tested only the initials in LINKS.who see the tab. Change it to 'all' to
   * give it to the team. Opening any post with ?links on the end of its address also turns it on
   * in that browser. */
  var LINKS = {
    index: 'https://pe-related-answers.pages.dev/links-index.json',
    site: 'https://www.production-expert.com',
    who: 'all',               // initials that see the tab, or 'all' (everyone since v1.2)
    perWords: 200,            // about one link per this many words of article
    tiers: [[3731, 'Exceptional', 2.5, '#3b6d11', '#eaf3de'], [2361, 'Strong', 2, '#185fa5', '#e6f1fb'],
            [1269, 'Average', 1, '#5a6068', '#f1f2f4'], [0, 'Below median', 0, '#854f0b', '#faeeda']],
    stop: /you might(?:\s+also)?\s+find\s+th(?:ese|is)/i
  };
  var linkIdx = null;         // null, 'loading', 'error', or the downloaded index
  var linkSugg = null;        // this post's suggestions, in article order
  var linkDone = {};          // target path: { st: 'added'|'saved'|'notsaved'|'skipped'|'failed'|'busy', why, at }

  if (/[?&]links\b/.test(location.search)) ls('pe-links', '1');
  function linksOn() {
    if (LINKS.who === 'all' || ls('pe-links') === '1') return true;
    return LINKS.who.indexOf((ls('pe-initials') || '').toUpperCase()) !== -1;
  }
  function drawerTabs() {
    var t = linksOn() ? TABS.concat([['links', 'Links']]) : TABS;
    return imageOn() ? t.concat([['image', 'Image']]) : t;
  }

  function tierOf(v) {
    if (v == null) return null;
    for (var i = 0; i < LINKS.tiers.length; i++) if (v >= LINKS.tiers[i][0]) return LINKS.tiers[i];
    return null;
  }
  function lower(a) { return (a || []).map(function (x) { return String(x).toLowerCase().trim(); }); }
  function pathOf(href) {
    try { return new URL(href, LINKS.site).pathname.replace(/\/+$/, ''); } catch (e) { return ''; }
  }
  function squash(t) { return String(t || '').replace(/[\u200b\u200c\u200d\ufeff]/g, '').replace(/[\s\u00a0]+/g, ' ').trim(); }

  function loadLinkIndex() {
    if (linkIdx && linkIdx !== 'error') return;
    linkIdx = 'loading';
    drawDrawer();
    fetch(LINKS.index, { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) { linkIdx = d && d.targets ? d : 'error'; if (linkIdx !== 'error') findLinks(); })
      .catch(function () { linkIdx = 'error'; })
      .then(function () { drawDrawer(); refreshAuto(); }); // the internal links check needs the index too
  }

  // The paragraphs a link may go in: text blocks only (so Add can edit them), never headings,
  // quotes, captions, marker lines (#H4, #expires, #people) or anything after the related block
  function linkParas() {
    var body = articleBody();
    if (!body) return [];
    var out = [], stopped = false;
    Array.prototype.forEach.call(body.querySelectorAll('p, li, h1, h2, h3, h4'), function (e) {
      if (stopped) return;
      var t = squash(e.textContent);
      if (/^H[1-4]$/.test(e.tagName) || e.querySelector('strong:only-child, b:only-child') && squash(e.querySelector('strong, b').textContent) === t) {
        if (LINKS.stop.test(t)) stopped = true;
        return; // headings, and bold lines standing in for headings
      }
      if (LINKS.stop.test(t)) { stopped = true; return; }
      if (!t || t.charAt(0) === '#') return;
      if (e.tagName === 'LI' && e.querySelector('p')) return; // its paragraph is counted instead
      if (!e.closest('.sqs-block-html, .html-block')) return;
      if (e.closest('blockquote, figcaption, .image-caption-wrapper, .pe-ui, .pe-checklist, .pe-drawer, .pe-people, .pe-author-bio, .pe-signup')) return;
      out.push(e);
    });
    return out;
  }

  // Text pieces of a paragraph that aren't already inside a link (or all of them, with inLinks)
  function textNodes(p, inLinks) {
    var w = p.ownerDocument.createTreeWalker(p, NodeFilter.SHOW_TEXT, null), n, out = [];
    while ((n = w.nextNode())) if (inLinks || !(n.parentNode.closest && n.parentNode.closest('a'))) out.push(n);
    return out;
  }

  // Every whole-word, any-case appearance of a phrase in one text piece
  function phraseRe(ph) {
    var body = ph.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/['’]/g, "['’]").replace(/\s+/g, '[\\s\\u00a0]+');
    return new RegExp('(^|[^\\w-])(' + body + ')(?![\\w-])', 'gi');
  }

  // This post's brands, for the competitor rule. Partner posts and reviews or news about one
  // brand's product protect that brand; everything else is editorial and the rule doesn't apply.
  function protectedBrands(targets) {
    var tags = lower(postData.tags), cats = lower(postData.categories), title = postTitle().toLowerCase();
    var partner = tags.indexOf('partner') !== -1 || tags.indexOf('partners') !== -1;
    var brands = {};
    targets.forEach(function (x) {
      var b = (x.b || '').toLowerCase();
      if (b && x.k === 'product' && (tags.indexOf(b) !== -1 || new RegExp('(^|[^\\w])' + b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\w])').test(title))) brands[b] = 1;
    });
    var any = Object.keys(brands).length > 0;
    var oneProduct = any && cats.some(function (c) { return /review|news|first look|announce/.test(c); });
    if (partner) return { on: true, brands: brands, why: 'Partner post' };
    // reviews or news naming a brand in the title or tags protect that brand too
    if (oneProduct) return { on: true, brands: brands, why: 'Single-product post' };
    return { on: false, brands: {} };
  }

  // Suggestions for this post. The strict rules first; if they find nothing, a looser pass
  // (any phrase of two words or more, or a product name, without needing a shared tag), shown
  // with a note so each one is judged. Remembers a fingerprint of the text, so the 30-second
  // checks only redo the work when the article changes.
  function findLinks() {
    if (!linkIdx || !linkIdx.targets) return;
    var strict = matchLinks(false);
    linkSugg = strict.list.length ? strict : matchLinks(true);
    linkSugg.loose = !strict.list.length && linkSugg.list.length > 0;
    linkSugg.sig = textSig();
  }
  function textSig() {
    var b = articleBody();
    return b ? b.textContent.length + ':' + b.querySelectorAll('a[href]').length : '';
  }

  function matchLinks(loose) {
    var paras = linkParas();
    var words = paras.reduce(function (n, p) { return n + squash(p.textContent).split(' ').length; }, 0);
    var here = location.pathname.replace(/\/+$/, '');
    var linked = {};
    var body = articleBody();
    if (body) Array.prototype.forEach.call(body.querySelectorAll('a[href]'), function (a) { linked[pathOf(a.getAttribute('href'))] = 1; });
    var myTags = lower(postData.tags);
    var guard = protectedBrands(linkIdx.targets);
    var now = Date.now(), found = [];

    linkIdx.targets.forEach(function (x) {
      if (x.u === here || linked[x.u]) return;
      // competitor rule, on a post protecting a brand: never another brand's product, and never
      // a roundup or buying guide, which puts that brand's competitors side by side
      if (guard.on && (x.k === 'comparison' || (x.k === 'product' && (!x.b || !guard.brands[x.b.toLowerCase()])))) return;
      var shared = lower(x.g).filter(function (g) { return myTags.indexOf(g) !== -1; }).length;
      var tier = tierOf(x.v);
      var age = x.d ? (now - Date.parse(x.d)) / 864e5 : 9999;
      x.p.forEach(function (ph) {
        var nw = ph.split(/\s+/).length;
        var named = /[A-Z0-9]/.test(ph);
        // relevance guard: a shared tag, a phrase of three words or more, or a product name.
        // The looser pass still needs two words or a product name.
        if (loose ? (nw < 2 && !named) : (!shared && nw < 3 && !named)) return;
        var re = phraseRe(ph);
        paras.forEach(function (p, pi) {
          var last = pi === paras.length - 1 && paras.length > 3;
          if (last) return; // end on the writer's voice, not a link
          textNodes(p).forEach(function (n) {
            re.lastIndex = 0;
            var m;
            while ((m = re.exec(n.data))) {
              var start = m.index + m[1].length;
              // not part of a longer name: "Focusrite Saffire" inside "Focusrite Saffire Pro 24 DSP"
              // would send readers to a different product, so a capitalised word or number right
              // after the words, or a capitalised word mid-sentence right before them, rules it out
              // (product names only: an ordinary phrase such as "gain staging" can follow "Pro Tools")
              if (/^[A-Z0-9]/.test(m[2])) {
                var after = n.data.slice(start + m[2].length).match(/^[\s\u00a0]+(\S+)/);
                if (after && /^[A-Z0-9]/.test(after[1])) continue;
                var head = n.data.slice(0, start), prior = head.match(/(\S+)[\s\u00a0]+$/);
                if (prior && /^[A-Z]/.test(prior[1]) && head.trim() !== prior[1] &&
                    !/[.!?:]$/.test(head.replace(/[\s\u00a0]*\S+[\s\u00a0]+$/, ''))) continue;
              }
              // not in the opening four words of the article
              if (pi === 0 && n.data.slice(0, start).split(/\s+/).filter(Boolean).length < 4 && textNodes(p)[0] === n) continue;
              var score = Math.min(nw, 4) + Math.min(shared, 2) * 1.5 + (tier ? tier[2] : 0.5) + (age < 365 ? 0.5 : 0);
              // every appearance competes, so a target can still land in another paragraph
              found.push({ score: score, para: p, paraText: p.textContent, pi: pi, anchor: m[2], target: x, tier: tier, shared: shared });
            }
          });
        });
      });
    });

    // Best first (earlier in the article on a tie), then one per paragraph and one per
    // article linked to, about one per LINKS.perWords words
    var cap = Math.max(2, Math.round(words / LINKS.perWords));
    found.sort(function (a, b) { return b.score - a.score || a.pi - b.pi; });
    var used = {}, usedTarget = {}, out = [];
    found.forEach(function (s) {
      if (out.length >= cap || used[s.pi] || usedTarget[s.target.u]) return;
      used[s.pi] = 1;
      usedTarget[s.target.u] = 1;
      out.push(s);
    });
    out.sort(function (a, b) { return a.pi - b.pi; });
    return { list: out, guard: guard, words: words, linked: Object.keys(linked).length };
  }

  /* ----- Putting a link in -----
   * Squarespace has two ways to edit a post, and Add works with both:
   *   - inline: Edit on the page itself. The article is edited in place, in the page the checklist
   *     runs in. This is how most of the team works.
   *   - the Edit Post window: Edit from the post list. The article is edited in a window in the
   *     editor's own page, while the page behind it is only a preview.
   * Either way each text block is a ProseMirror editor (.sqs-html-content), open for editing.
   * Add finds the same paragraph by its text, selects the words, and hands ProseMirror the link as
   * a paste, so Squarespace makes the link itself and knows the post has changed. Both confirmed
   * in the live editor, 30 Oct 2026. */

  // The editable text blocks: in this page (inline editing) first, then in the Edit Post window.
  // Empty when the post isn't open for editing either way.
  function editorRoots() {
    var docs = [document], host = hostDoc(), roots = [];
    if (host !== document) docs.push(host);
    docs.some(function (doc) {
      try {
        roots = Array.prototype.slice.call(doc.querySelectorAll('.sqs-layout.sqs-editing .sqs-html-content.ProseMirror'));
        if (!roots.length) roots = Array.prototype.slice.call(doc.querySelectorAll('.sqs-html-content[contenteditable="true"]'));
      } catch (e) {}
      return roots.length > 0;
    });
    return roots;
  }

  // Finds the paragraph and the words in the Edit Post window. inLinks also looks inside links,
  // to take out a link this tab added.
  function locate(s, inLinks) {
    var want = squash(s.paraText), opening = want.slice(0, 40), hit = null, loose = null;
    editorRoots().some(function (root) {
      Array.prototype.some.call(root.querySelectorAll('p, li'), function (p) {
        var t = squash(p.textContent);
        var exact = t === want;
        if (!exact && (loose || t.slice(0, 40) !== opening)) return false; // a lightly edited paragraph still counts
        var found = null;
        textNodes(p, inLinks).some(function (n) {
          var re = phraseRe(s.anchor), m;
          re.lastIndex = 0;
          while ((m = re.exec(n.data))) {
            if (m[2] === s.anchor) { found = { node: n, start: m.index + m[1].length, para: p, root: root }; return true; }
          }
          return false;
        });
        if (found && exact) { hit = found; return true; }
        if (found) loose = found;
        return false;
      });
      return !!hit;
    });
    return hit || loose;
  }

  function selectWords(hit, len) {
    var doc = hit.node.ownerDocument;
    var r = doc.createRange();
    r.setStart(hit.node, hit.start);
    r.setEnd(hit.node, hit.start + len);
    var sel = doc.defaultView.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
    return r;
  }

  function wait(ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); }

  // Hands the editor a paste, built in the editor window's own terms. Returns true if it took it.
  function pasteInto(root, html, text) {
    var w = root.ownerDocument.defaultView;
    var dt = new w.DataTransfer();
    if (html) dt.setData('text/html', html);
    dt.setData('text/plain', text);
    var ev = new w.ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
    if (!ev.clipboardData) Object.defineProperty(ev, 'clipboardData', { value: dt }); // older Safari
    root.dispatchEvent(ev);
    return ev.defaultPrevented;
  }

  function linkHtml(url, words) {
    return '<a href="' + url + '">' + words.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</a>';
  }

  function hasLink(root, s) {
    return Array.prototype.some.call(root.querySelectorAll('a[href]'), function (a) {
      return pathOf(a.getAttribute('href')) === s.target.u && squash(a.textContent) === squash(s.anchor);
    });
  }

  var NOT_OPEN = 'The post isn’t open for editing. Click Edit, then Add again.';

  function addLink(s) {
    var key = s.target.u, url = LINKS.site + s.target.u;
    if (!editorRoots().length) { linkDone[key] = { st: 'failed', why: NOT_OPEN }; drawDrawer(); return; }
    var hit = locate(s);
    if (!hit) { linkDone[key] = { st: 'failed', why: 'Those words aren’t in the Edit Post window any more. Press Refresh.' }; drawDrawer(); return; }
    linkDone[key] = { st: 'busy' };
    drawDrawer();
    var root = hit.root, before = squash(root.textContent);
    hit.para.scrollIntoView({ block: 'center' });
    root.focus({ preventScroll: true });
    selectWords(hit, s.anchor.length);
    // a moment for the editor to notice the new selection before the paste arrives
    wait(80).then(function () {
      pasteInto(root, linkHtml(url, s.anchor), s.anchor);
      return wait(300);
    }).then(function () {
      var ok = hasLink(root, s), same = squash(root.textContent) === before;
      if (ok && same) {
        var sel = root.ownerDocument.defaultView.getSelection();
        if (sel.rangeCount) sel.collapseToEnd();
        linkDone[key] = { st: 'added', at: Date.now() };
        return;
      }
      // Something went wrong: put the block back as it was with the editor's own undo
      if (!same || ok) { try { root.ownerDocument.execCommand('undo'); } catch (e) {} }
      throw !same ? 'Squarespace changed the text, so the change was undone.' : 'Squarespace didn’t accept the link.';
    }).catch(function (why) {
      linkDone[key] = { st: 'failed', why: typeof why === 'string' ? why : 'Squarespace didn’t accept the link.' };
    }).then(drawDrawer);
  }

  // Takes a link this tab added out again, by pasting the plain words back over it
  function removeLink(s) {
    var key = s.target.u;
    var hit = locate(s, true);
    var a = hit && hit.node.parentNode.closest && hit.node.parentNode.closest('a[href]');
    if (!a || pathOf(a.getAttribute('href')) !== s.target.u) {
      if (!editorRoots().length) { linkDone[key] = { st: 'added', why: NOT_OPEN }; drawDrawer(); return; }
      delete linkDone[key]; drawDrawer(); return; // already gone
    }
    var root = hit.root, doc = root.ownerDocument;
    root.focus({ preventScroll: true });
    var r = doc.createRange();
    r.selectNodeContents(a);
    var sel = doc.defaultView.getSelection();
    sel.removeAllRanges(); sel.addRange(r);
    wait(80).then(function () {
      pasteInto(root, '', a.textContent);
      return wait(300);
    }).then(function () {
      if (hasLink(root, s)) linkDone[key] = { st: 'added', why: 'Couldn’t remove it. Select the words and remove the link by hand.' };
      else delete linkDone[key];
      drawDrawer();
    });
  }

  // Scrolls to the words in the Edit Post window (or the preview, if that isn't open) and selects them
  function showWords(s) {
    var hit = locate(s, true);
    if (hit) {
      hit.para.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(function () { hit.root.focus({ preventScroll: true }); selectWords(hit, s.anchor.length); }, 350);
      return;
    }
    if (s.para && s.para.isConnected) {
      s.para.scrollIntoView({ behavior: 'smooth', block: 'center' });
      point([s.para]);
    }
  }

  // Copies the words as a link, for pasting over the selection by hand
  function copyLink(s, btn) {
    var url = LINKS.site + s.target.u;
    var html = linkHtml(url, s.anchor);
    function done() { btn.textContent = 'Copied, paste over the words'; setTimeout(function () { btn.textContent = 'Copy link'; }, 2500); }
    try {
      navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([url], { type: 'text/plain' }) })]).then(done, function () { copyText(url, btn); });
    } catch (e) { copyText(url, btn); }
  }

  // After a save, checks the saved post really holds each link this tab added
  function linksSeen(it) {
    if (typeof it.body !== 'string') return;
    var changed = false;
    Object.keys(linkDone).forEach(function (k) {
      var d = linkDone[k];
      if (d.st !== 'added' || !(+it.updatedOn > d.at)) return;
      d.st = it.body.indexOf(k + '"') !== -1 || it.body.indexOf(k + '?') !== -1 || it.body.indexOf(k + '#') !== -1 ? 'saved' : 'notsaved';
      changed = true;
    });
    if (changed && drawerTab === 'links') drawDrawer();
  }

  /* ----- The tab ----- */

  function linkBtn(text, onclick, primary) {
    var b = el('button', 'flex:0 0 auto;padding:4px 11px;border:1px solid ' + (primary ? C.blue : '#d5d9de') + ';border-radius:5px;background:' + (primary ? C.blue : '#fff') +
      ';font:600 11.5px/1.6 ' + F + ';color:' + (primary ? '#fff' : '#333') + ';cursor:pointer;', text);
    b.type = 'button';
    b.onclick = function () { onclick(b); };
    return b;
  }

  function drawLinksTab(body) {
    if (!linkIdx) loadLinkIndex();
    if (linkIdx === 'loading' || !linkIdx) { body.appendChild(el('div', 'padding:14px 0;color:#777;', 'Reading the archive…')); return; }
    if (linkIdx === 'error') {
      body.appendChild(el('div', 'padding:14px 0;color:' + C.red + ';font-size:13px;', 'The link index couldn’t be read. It’s built each night by the Related Answers job.'));
      body.appendChild(actionButton('Try again', function () { linkIdx = null; loadLinkIndex(); }));
      return;
    }
    if (!linkSugg) findLinks();
    var sg = linkSugg, list = sg.list;
    var added = list.filter(function (s) { var d = linkDone[s.target.u]; return d && /added|saved|notsaved/.test(d.st); }).length;

    var intro = (sg.guard.on ? sg.guard.why + ': no links to other brands’ products or to roundups. ' : 'Editorial post. ') +
      sg.words.toLocaleString() + ' words, ' + sg.linked + ' existing ' + (sg.linked === 1 ? 'link' : 'links') + ' skipped.';
    body.appendChild(el('div', 'margin:12px 0 2px;font-size:12px;color:#5a6068;', intro));
    body.appendChild(el('div', 'margin:0 0 6px;font-size:12px;color:#8a9097;', list.length ? added + ' of ' + list.length + ' added' : ''));

    if (!list.length) {
      body.appendChild(el('div', 'padding:12px 0;color:#555;font-size:13px;', 'No phrases in this draft match an article worth linking to, so the internal links check won’t hold this post back.'));
    } else if (sg.loose) {
      body.appendChild(el('div', 'margin:4px 0 6px;padding:8px 10px;background:#fff8e6;border-radius:6px;font-size:12px;color:#5a3a00;', 'No close matches, so these are looser ones: they share words with the article but not its tags. Check each fits before adding it.'));
    }
    list.forEach(function (s) {
      var d = linkDone[s.target.u] || {};
      var row = el('div', 'padding:11px 0;border-bottom:1px solid #eceef1;' + (d.st === 'skipped' ? 'opacity:.55;' : ''));
      // the sentence around the words, with the words marked
      var t = s.para.textContent, i = t.indexOf(s.anchor);
      var ctx = el('div', 'font-size:12.5px;color:#5a6068;line-height:1.55;margin-bottom:5px;');
      if (i === -1) ctx.textContent = s.anchor;
      else {
        // about 50 characters either side, starting and ending on whole words
        var a = Math.max(0, i - 50), b = Math.min(t.length, i + s.anchor.length + 50);
        if (a > 0) { var sp = t.indexOf(' ', a); a = sp !== -1 && sp < i ? sp + 1 : a; }
        if (b < t.length) { var sb = t.lastIndexOf(' ', b); b = sb > i + s.anchor.length ? sb : b; }
        ctx.appendChild(document.createTextNode((a ? '…' : '') + t.slice(a, i)));
        ctx.appendChild(el('mark', 'background:#fff3c4;color:#222;padding:0 2px;border-radius:3px;', s.anchor));
        ctx.appendChild(document.createTextNode(t.slice(i + s.anchor.length, b) + (b < t.length ? '…' : '')));
      }
      row.appendChild(ctx);
      var ti = el('div', 'font-size:13.5px;font-weight:700;line-height:1.4;color:' + C.blue + ';' + (d.st === 'skipped' ? 'text-decoration:line-through;' : ''), s.target.t);
      var tier = s.tier;
      ti.appendChild(el('span', 'display:inline-block;margin-left:6px;padding:1px 7px;border-radius:999px;font-size:10.5px;font-weight:600;vertical-align:1px;' +
        'color:' + (tier ? tier[3] : '#5a6068') + ';background:' + (tier ? tier[4] : '#f1f2f4') + ';',
        tier ? tier[1] + ' ' + s.target.v.toLocaleString() : 'Unscored'));
      row.appendChild(ti);
      if (s.target.r) row.appendChild(el('div', 'font-size:12px;color:#777;margin:3px 0 0;', s.target.r));
      var acts = el('div', 'display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:8px;');

      if (d.st === 'busy') acts.appendChild(el('span', 'font-size:12px;color:#777;', 'Adding…'));
      else if (d.st === 'added' || d.st === 'saved' || d.st === 'notsaved') {
        var msg = d.st === 'saved' ? '✓ Added and saved' : d.st === 'notsaved' ? 'The saved post doesn’t have this link. Add it again, or by hand.' : d.why || '✓ Added. Press Save in Squarespace.';
        acts.appendChild(el('span', 'font-size:12px;font-weight:600;color:' + (d.st === 'notsaved' ? C.red : C.green) + ';', msg));
        if (d.st === 'notsaved') acts.appendChild(linkBtn('Add again', function () { addLink(s); }, true));
        else acts.appendChild(linkBtn('Undo', function () { removeLink(s); }));
      } else if (d.st === 'skipped') {
        acts.appendChild(el('span', 'font-size:12px;color:#777;', 'Skipped'));
        acts.appendChild(linkBtn('Undo', function () { delete linkDone[s.target.u]; drawDrawer(); }));
      } else {
        if (d.st === 'failed') {
          acts.appendChild(el('div', 'flex:1 0 100%;font-size:12px;color:' + C.red + ';margin-bottom:2px;', d.why + ' Show in post selects the words; Copy link, then paste over them.'));
          acts.appendChild(linkBtn('Copy link', function (b) { copyLink(s, b); }, true));
        } else {
          acts.appendChild(linkBtn('Add', function () { addLink(s); }, true));
        }
        acts.appendChild(linkBtn('Show in post', function () { showWords(s); }));
        acts.appendChild(linkBtn('Skip', function () { linkDone[s.target.u] = { st: 'skipped' }; drawDrawer(); }));
      }
      row.appendChild(acts);
      body.appendChild(row);
    });

    body.appendChild(actionButton('Refresh', function () { linkSugg = null; drawDrawer(); refreshAuto(); }));
    body.appendChild(el('div', 'font-size:12px;color:#777;', 'Add links the words for you without changing them. Nothing goes live until you press Save in Squarespace.'));
  }

  /* ---------- Moving the panel ---------- */

  // The panel and pill share one spot, measured from the bottom-right corner of the window
  var pos = { r: 16, b: 16 };
  function place() {
    if (!panel) return;
    var w = panel.ownerDocument.defaultView;
    pos.r = Math.max(0, Math.min(w.innerWidth - 80, pos.r));
    pos.b = Math.max(0, Math.min(w.innerHeight - 44, pos.b));
    [panel, pill].forEach(function (e) { e.style.right = pos.r + 'px'; e.style.bottom = pos.b + 'px'; });
    panel.style.maxHeight = Math.max(160, w.innerHeight - pos.b - 16) + 'px';
  }
  // A click does the usual thing; a drag of more than a few pixels moves it instead
  // onDouble (optional): a double-click does that instead, so the single click waits a moment
  // spot (optional): which box is being moved. Defaults to the checklist panel and pill.
  //   { get: returns its position, set: takes dx and dy from where the drag started, save: stores it }
  //   The checklist is measured from the bottom-right corner, the Help me write window from the
  //   top-right, so each box says how a drag changes its own position.
  var checklistSpot = {
    get: function () { return { r: pos.r, b: pos.b }; },
    set: function (start, dx, dy) { pos.r = start.r - dx; pos.b = start.b - dy; place(); },
    save: function () { ls('pe-ck-pos', JSON.stringify(pos)); }
  };
  function movable(handle, onClick, onDouble, spot) {
    spot = spot || checklistSpot;
    var sx, sy, start, down = false, moved = false, wait = null;
    handle.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      // a press on a button inside the handle (the drawer's close button) isn't a drag
      if (e.target !== handle && e.target.closest && e.target.closest('button') && e.target.closest('button') !== handle) return;
      down = true; moved = false; sx = e.clientX; sy = e.clientY; start = spot.get();
      try { handle.setPointerCapture(e.pointerId); } catch (x) {}
    });
    handle.addEventListener('pointermove', function (e) {
      if (!down) return;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 5) return;
      moved = true; spot.set(start, dx, dy);
    });
    handle.addEventListener('pointerup', function () {
      if (!down) return;
      down = false;
      if (moved) spot.save();
    });
    handle.addEventListener('click', function (e) {
      if (moved) { moved = false; e.preventDefault(); return; }
      // a click on a button inside the handle does that button's job only
      var inner = e.target.closest && e.target.closest('button');
      if (inner && inner !== handle) return;
      if (!onDouble) return onClick();
      if (wait) { clearTimeout(wait); wait = null; return onDouble(); }
      wait = setTimeout(function () { wait = null; onClick(); }, 250);
    });
  }

  /* ---------- Build ---------- */

  function build() {
    // Author bios are not articles: no checklist, and nothing reported to the
    // Content Manager dashboard, so opening a bio never adds it to the list.
    if (/^\/author-bios(\/|$)/.test(location.pathname)) return;
    var a = document.querySelector('body.view-item article.hentry');
    var ctx = (window.Static && Static.SQUARESPACE_CONTEXT) || {};
    post = ctx.itemId || (a && a.id.replace('article-', ''));
    if (!a || !post || panel || !isTeam()) return;

    panel = el('div', 'display:none;position:fixed;right:16px;bottom:16px;z-index:9999;width:300px;max-width:calc(100vw - 32px);max-height:calc(100vh - 80px);overflow:auto;' +
      'background:#fff;border:1px solid #e3e6ea;border-top:4px solid ' + C.blue + ';border-radius:8px;box-shadow:0 12px 32px rgba(17,24,39,.14),0 2px 6px rgba(17,24,39,.06);' +
      'font:14px/1.45 ' + F + ';color:#222;');
    panel.className = 'pe-checklist';
    head = el('button', 'display:flex;justify-content:space-between;align-items:baseline;gap:10px;width:100%;text-align:left;padding:12px 16px 11px;border:0;border-bottom:1px solid #eceef1;background:none;font:700 14px/1.3 ' + F + ';cursor:pointer;color:#222;');
    head.type = 'button';
    head.className = 'pe-ck-head';
    head.title = 'Click to shrink. Drag to move. Double-click to put it back in the corner.';
    // Title in small capitals with wide spacing, matching Squarespace's own window headers (EDIT POST)
    head.appendChild(el('span', 'font-size:13px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:inherit;'));
    head.appendChild(el('span', 'flex:0 0 auto;font-size:12px;font-weight:600;font-variant-numeric:tabular-nums;')); // the 2/4 count
    head.style.cursor = 'move';
    head.style.touchAction = 'none';
    list = el('div', 'padding:2px 16px 14px;');
    embBox = el('div', 'padding:0 16px;');
    panel.appendChild(head);
    panel.appendChild(embBox);
    panel.appendChild(list);
    panel.appendChild(buildNotes()); // under the checks, outside the part draw() rebuilds

    pill = el('button', 'display:none;position:fixed;right:16px;bottom:16px;z-index:9999;align-items:center;gap:4px;padding:8px 15px;border:2px solid ' + C.blue +
      ';border-radius:20px;background:#fff;box-shadow:0 6px 18px rgba(17,24,39,.16);font:700 13px ' + F + ';font-variant-numeric:tabular-nums;cursor:pointer;');
    pill.type = 'button';
    pill.className = 'pe-checklist-pill';
    pill.title = 'Pre-publish checks';
    pill.appendChild(el('span'));
    pill.appendChild(el('span'));
    pill.style.cursor = 'move';
    pill.style.touchAction = 'none';
    movable(head, function () { mode = 'pill'; draw(); }, function () { pos = { r: 16, b: 16 }; ls('pe-ck-pos', ''); place(); });
    movable(pill, function () { mode = 'open'; draw(); });

    // Like the drawer, the panel goes in the editor window itself, so the Edit Post window
    // and Squarespace's toolbars can't cover it
    shield(panel);
    shield(pill);
    var doc = hostDoc();
    styleUp(doc);
    if (doc !== document) styleUp(document); // the red scheduled bar stays in the post's own window
    if (doc !== document) {
      panel.style.zIndex = pill.style.zIndex = '2147482999';
      doc.querySelectorAll('.pe-checklist, .pe-checklist-pill').forEach(function (d) { d.remove(); }); // one left from another post
      addEventListener('pagehide', function () { panel.remove(); pill.remove(); });
    }
    doc.body.appendChild(panel);
    doc.body.appendChild(pill);
    try { var saved = JSON.parse(ls('pe-ck-pos') || 'null'); if (saved && saved.r >= 0 && saved.b >= 0) pos = saved; } catch (e) {}
    place();
    doc.defaultView.addEventListener('resize', place);
    // A click in Squarespace's own windows (Apply in Edit Post, a status change) may have changed
    // the post, so check its status again shortly after, and once more in case saving was slow
    // Clicks and typing mark this person as working on the post, for the edit history
    [document, doc].forEach(function (d, i) {
      if (i && d === document) return; // outside the editor both are the same page
      d.addEventListener('pointerdown', noteActivity, true);
      d.addEventListener('keydown', noteActivity, true);
    });
    if (doc !== document) {
      var again = [];
      doc.addEventListener('click', function () {
        again.forEach(clearTimeout);
        again = [1500, 5000].map(function (ms) { return setTimeout(function () { checkSchedule().then(refreshAuto); }, ms); });
      }, true);
    }
    draw();
    checkSchedule().then(function () { call({ post: post }); setTimeout(refreshAuto, 1200); });
    renderEmbargo();
    embargoCall().catch(function () {}); // no answer: no embargo line changes, try again in 30 seconds
    notesCall().catch(function () {});   // no answer: the notes box stays as it is
    registerMe();                        // so flag emails can reach this person as an author
    setInterval(function () {
      if (document.hidden) return;
      checkSchedule().then(refreshAuto); call({ post: post });
      if (!embEditing) embargoCall().catch(function () {}); // someone else may have set one
      notesCall().catch(function () {});                    // someone else may have left a note
    }, 30000);
  }

  build();
  addEventListener('load', build);
  addEventListener('mercury:load', build);
})();
} catch (e) { if (window.console) console.warn('Production Expert script failed: pre-publish checklist (team only)', e); }

/* ================================================================
 * Production Expert: free site search, plus search tracking
 * Paste into Code Injection > Footer.
 * - A Search button, top right, on every page. It opens a search box with quick links,
 * and shows matching articles as you type.
 * - Rebuilds Squarespace's search results page as a clean list with dates, pictures,
 * relevance filtering, a Best match / Newest sort, a five-year limit and matching
 * YouTube videos at the top and podcast episodes.
 * - Records searches in Plausible as a "Search" event (query, source, results).
 * ================================================================ */
try {
(function () {
  var C = {
    ink: '#222',
    font: '"Open Sans",sans-serif',
    maxYears: 5,          // leave out articles older than this (pages without a date always stay)
    offerDays: 60,        // deals, giveaways and competitions older than this count as ended
    link: '#1a0dab',      // result title colour (Google's link blue)
    // The checklist Google Sheet also keeps the list of YouTube videos for search
    videoStore: 'https://script.google.com/macros/s/AKfycbzKBcQln1DzO_Ml9_5KWZG_Rh_M-Px2TgHDYtYIbncl_9IXEjICvYz0448k1E3H9UAYeQ/exec',
    // Words readers use interchangeably. A search for any one also finds the others.
    synonyms: [
      ['pt', 'pro tools'], ['protools', 'pro tools'],
      ['eq', 'equaliser', 'equalizer'], ['equalise', 'equalize'], ['normalise', 'normalize'],
      ['analyser', 'analyzer'], ['colour', 'color'], ['centre', 'center'], ['licence', 'license'],
      ['atmos', 'dolby atmos'], ['s1', 'studio one', 'fender studio pro'], ['studio one', 'fender studio pro'],
      ['verb', 'reverb'], ['comp', 'compressor'], ['mic', 'microphone'], ['mics', 'microphones'],
      ['plugin', 'plug-in'], ['plugins', 'plug-ins'], ['logic', 'logic pro'],
      ['fix', 'repair', 'restore', 'clean up'], ['restore', 'restoration'], ['clean up', 'cleanup'], ['noise', 'hiss', 'hum'], ['dialogue', 'dialog']
    ],
    quickLinks: [
      ['Compatibility Charts', '/compatibility'],
      ['Free Plugins', '/free-pro-tools-plug-ins'],
      ['Partner Deals', '/deals'],
      ['Win Studio Gear', '/win'],
      ['Podcast', '/podcast'],
      ['iLok Help', '/ilok-help']
    ],
    // Addresses never shown in search. A line ending in / hides everything under it.
    // Add any test or old pages here, e.g. '/test-page' or '/old-landing-pages/'.
    hide: [
      '/author-bios/',
      '/search'
    ],
    // Pages (not articles) whose title or address contains one of these words are
    // treated as test pages and hidden. Articles are never affected, so a review
    // called "We Test The New Neve" still shows.
    testWords: ['test', 'testing', 'demo', 'sandbox', 'staging', 'draft', 'copy', 'untitled', 'temp', 'placeholder', 'example', 'dummy']
  };
  var path = location.pathname.replace(/\/+$/, '') || '/';
  var inEditor = false;
  try { inEditor = window.top !== window; } catch (e) { inEditor = true; }
  var YEAR = 31557600000;

  function track(query, source, results) {
    query = String(query || '').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 100);
    if (!query || !window.plausible) return;
    var props = { query: query, source: source };
    if (results !== undefined) props.results = results ? 'found' : 'none';
    window.plausible('Search', { props: props });
  }
  function css(text) { var s = document.createElement('style'); s.textContent = text; document.head.appendChild(s); }
  function esc(t) { return String(t || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function date(ms) { return ms ? new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''; }
  function rx(t) { return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  // Squarespace's search feed, 20 results per page
  // Titles can arrive with HTML codes in them (&nbsp; &amp;), so turn them back into plain text
  var decoder = document.createElement('textarea');
  function plain(t) { decoder.innerHTML = String(t || ''); return decoder.value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim(); }

  function feed(q, pages) {
    var calls = [];
    for (var p = 0; p < pages; p++) {
      calls.push(fetch('/api/search/GeneralSearch?q=' + encodeURIComponent(q) + '&p=' + p)
        .then(function (r) { return r.json(); }).catch(function () { return { items: [] }; }));
    }
    return Promise.all(calls).then(function (res) {
      var seen = {}, items = [];
      res.forEach(function (d) { (d.items || []).forEach(function (it) { if (!seen[it.id] && it.itemUrl && allowed(it)) { seen[it.id] = 1; it.title = plain(it.title); items.push(it); } }); });
      return items;
    });
  }

  // Keeps test pages, author bios and anything on the hide list out of search
  var testRe = new RegExp('(^|[^a-z])(' + C.testWords.map(rx).join('|') + ')([^a-z]|$)', 'i');
  function allowed(it) {
    var url = String(it.itemUrl).split('?')[0].replace(/\/+$/, '') || '/';
    for (var i = 0; i < C.hide.length; i++) {
      var h = C.hide[i];
      if (/\/$/.test(h) ? (url + '/').indexOf(h) === 0 : url === h.replace(/\/+$/, '')) return false;
    }
    var article = !!it.publishOn && it.recordTypeName === 'text';
    if (!article && (testRe.test(it.title || '') || testRe.test(url))) return false;
    return true;
  }

  // The search as typed, plus versions using the other words from the synonym list (up to 3 extra)
  function variants(q) {
    var base = q.toLowerCase().replace(/\s+/g, ' ').trim(), out = [base];
    C.synonyms.forEach(function (group) {
      group.forEach(function (term) {
        var re = new RegExp('(^|\\W)' + rx(term) + '(?=\\W|$)', 'i');
        if (!re.test(base)) return;
        group.forEach(function (alt) {
          if (alt === term || alt.length <= 4) return; // never expand into a short abbreviation
          var v = base.replace(re, function (m, pre) { return pre + alt; });
          if (out.indexOf(v) < 0 && out.length < 4) out.push(v);
        });
      });
    });
    return out;
  }
  // Squarespace only finds articles containing every word typed, so a natural search like
  // "fixing bad audio" can find nothing. These are the looser versions tried when that happens:
  // filler words dropped, word endings trimmed (fixing to fix), then one word left out at a time,
  // each with its synonyms ("fix audio" also tries "repair audio" and "restore audio").
  var FILLER = ['a', 'an', 'the', 'to', 'of', 'in', 'on', 'for', 'with', 'and', 'or', 'my', 'your', 'how', 'what', 'why',
    'is', 'are', 'do', 'does', 'can', 'i', 'best', 'good', 'bad', 'better', 'great', 'quick', 'easy', 'using', 'use', 'way', 'ways', 'tips', 'guide'];
  function trim(w) {
    if (w.length > 5 && /ing$/.test(w)) { w = w.slice(0, -3); if (/([b-df-hj-np-tv-z])\1$/.test(w)) w = w.slice(0, -1); return w; }
    if (w.length > 4 && /ed$/.test(w)) return w.slice(0, -2);
    if (w.length > 3 && /[^s]s$/.test(w)) return w.slice(0, -1);
    return w;
  }
  function looser(q) {
    var words = q.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(Boolean);
    var core = words.filter(function (w) { return FILLER.indexOf(w) < 0; }).map(trim);
    if (!core.length) return [];
    var bases = [core.join(' ')];
    if (core.length >= 3) core.forEach(function (w, i) { bases.push(core.filter(function (x, j) { return j !== i; }).join(' ')); });
    var out = [];
    bases.forEach(function (b) { variants(b).forEach(function (v) { if (out.indexOf(v) < 0) out.push(v); }); });
    return out.filter(function (v) { return v !== q.toLowerCase().trim(); }).slice(0, 6);
  }

  // Fetches the search and its variants, merged, with the search as typed first.
  // If that finds fewer than three close matches, it widens the search with looser versions.
  // useAI: on the results page only, a search that still finds little is rephrased by Claude
  // (through the Google Sheet) into the terms articles actually use, then searched again
  function search(q, pagesMain, pagesAlt, useAI) {
    var vs = variants(q);
    function merge(lists, into, seen) {
      lists.forEach(function (l) { l.forEach(function (it) { if (!seen[it.id]) { seen[it.id] = 1; into.push(it); } }); });
    }
    return Promise.all(vs.map(function (v, i) { return feed(v, i ? pagesAlt : pagesMain); })).then(function (lists) {
      var seen = {}, items = [];
      merge(lists, items, seen);
      var close = score(byAge(items).recent, vs).filter(function (it) { return it._strong; }).length;
      var wider = close < 3 ? looser(q).filter(function (v) { return vs.indexOf(v) < 0; }) : [];
      var step = !wider.length ? Promise.resolve({ items: items, phrases: vs, widened: false })
        : Promise.all(wider.map(function (v) { return feed(v, 2); })).then(function (more) {
          merge(more, items, seen);
          return { items: items, phrases: vs.concat(wider), widened: close === 0 };
        });
      return step.then(function (res) {
        var closeNow = score(byAge(res.items).recent, res.phrases).filter(function (it) { return it._strong; }).length;
        if (!useAI || closeNow >= 3 || q.split(/\s+/).length < 3 || !C.videoStore) return res;
        return rephrase(q).then(function (terms) {
          terms = terms.filter(function (t) { return res.phrases.indexOf(t) < 0; });
          if (!terms.length) return res;
          return Promise.all(terms.map(function (t) { return feed(t, 2); })).then(function (more) {
            merge(more, res.items, seen);
            return { items: res.items, phrases: res.phrases.concat(terms), widened: closeNow === 0 || res.widened, ai: terms };
          });
        });
      });
    });
  }

  // Asks the Google Sheet (and through it Claude) for the search terms behind a question.
  // Gives up after eight seconds so search never hangs on it (repeat questions answer instantly).
  function rephrase(q) {
    var ask = fetch(C.videoStore + '?rephrase=' + encodeURIComponent(q)).then(function (r) { return r.json(); })
      .then(function (d) { return (d && d.terms) || []; }).catch(function () { return []; });
    var timeout = new Promise(function (r) { setTimeout(function () { r([]); }, 8000); });
    return Promise.race([ask, timeout]);
  }

  // Splits results into recent (or undated pages) and older than the age limit
  function byAge(items) {
    var cutoff = Date.now() - C.maxYears * YEAR, recent = [], older = [];
    items.forEach(function (it) { (it.publishOn && it.publishOn < cutoff ? older : recent).push(it); });
    return { recent: recent, older: older };
  }

  // Relevance. Squarespace matches any article that mentions the words anywhere, so each
  // result is scored on where the search appears: title and tags count most, then the
  // summary, then how often the exact phrase is used. Passing mentions are marked weak.
  // Partner posts are flagged so they carry their label, and ended offers drop down.
  function score(items, phrases) {
    if (typeof phrases === 'string') phrases = [phrases];
    var now = Date.now();
    var tests = phrases.map(function (p) {
      var phrase = p.toLowerCase().replace(/\s+/g, ' ').trim();
      var words = phrase.split(' ').filter(function (w) { return w.length > 1; });
      return { phrase: phrase, words: words.length ? words : [phrase], re: new RegExp('\\b' + rx(phrase), 'g') };
    });
    items.forEach(function (it, i) {
      var title = (it.title || '').toLowerCase();
      var labels = (it.tags || []).concat(it.categories || []).join(' | ').toLowerCase();
      var summary = (it.excerpt || '').toLowerCase();
      var body = (it.body || '').toLowerCase();
      var page = !it.publishOn;
      var years = page ? 0 : (now - it.publishOn) / YEAR;
      it._strong = false; it._best = 0;
      tests.forEach(function (t) {
        function all(x) { return t.words.every(function (w) { return x.indexOf(w) > -1; }); }
        var uses = (body.match(t.re) || []).length;
        var inTitle = title.indexOf(t.phrase) > -1, titleAll = all(title);
        var inLabels = labels.indexOf(t.phrase) > -1, labelsAll = all(labels);
        var inSummary = summary.indexOf(t.phrase) > -1;
        if (inTitle || titleAll || inLabels || uses >= 3 || (inSummary && uses >= 2)) it._strong = true;
        it._best = Math.max(it._best, (inTitle ? 40 : 0) + (titleAll ? 20 : 0) + (inLabels ? 20 : 0) + (labelsAll ? 10 : 0) +
          (inSummary ? 10 : 0) + Math.min(uses, 10) * 3 + (page && (inTitle || titleAll) ? 45 : 0));
      });
      it._best += Math.max(0, 15 - years * 1.5) + (1 - i / items.length) * 10;
      it._partner = (it.tags || []).some(function (t) { return /^partner$/i.test(t); }) || /this is partner content/i.test(it.body || '');
      var offer = /(^|\|)\s*(deal|deals|competition|win|winner|special offer)\s*(\||$)|giveaway/.test(labels) || /limited time|prize draw|giveaway|competition|^win /i.test(it.title || '');
      it._ended = offer && !page && now - it.publishOn > C.offerDays * 86400000;
      if (it._ended) { it._strong = false; it._best -= 30; }
    });
    return items;
  }
  function metaLine(it) {
    var bits = [];
    if (it._partner) bits.push('Partner Content');
    if (it._ended) bits.push('Offer ended');
    bits.push(it.publishOn ? [date(it.publishOn), (it.categories || [])[0]].filter(Boolean).join(' · ') : 'Guide');
    return bits.join(' · ');
  }
  // Squarespace's grey placeholder has no file name at the end of its address
  function realImage(u) { return u && !/\/\d+\/?$/.test(u.split('?')[0]); }
  // An article's picture: its thumbnail, else its hero image, else the first sizeable picture
  // in the article (skipping small square images such as author photos). Remembered once found.
  var picCache = {};
  function picture(it) {
    if (picCache[it.id]) return picCache[it.id];
    picCache[it.id] = realImage(it.imageUrl) ? Promise.resolve(it.imageUrl) :
      fetch(it.itemUrl + '?format=json').then(function (r) { return r.json(); }).then(function (d) {
        var b = ((d.item && d.item.promotedBlock) || '') + ((d.item && d.item.body) || ''), re = /<img[^>]+>/g, tag;
        while ((tag = re.exec(b))) {
          var src = (tag[0].match(/(?:data-src|src)="(https:\/\/(?:images\.squarespace-cdn\.com|static1\.squarespace\.com)[^"]+)"/) || [])[1];
          var dim = tag[0].match(/data-image-dimensions="(\d+)x(\d+)"/);
          if (!src || !realImage(src) || !dim) continue;
          var w = +dim[1], r = +dim[2] / w;
          if (w < 600 || r < 0.3 || r > 1.4 || (r > 0.85 && w < 1000)) continue;
          return src;
        }
        return null;
      }).catch(function () { return null; });
    return picCache[it.id];
  }
  function addPicture(it, holder, size) {
    picture(it).then(function (u) {
      if (!u) return;
      var img = document.createElement('img');
      img.alt = '';
      img.loading = 'lazy';
      img.onerror = function () { holder.remove(); };
      img.src = u.split('?')[0] + '?format=' + size + 'w';
      holder.appendChild(img);
      holder.classList.add('has');
    });
  }
  function best(a, b) { return b._best - a._best; }

  // Readers' choice: open results in a new tab (the default) or in the same tab. Remembered in their browser.
  function newTab() { try { return localStorage.getItem('pe-search-newtab') !== '0'; } catch (e) { return true; } }
  function setNewTab(on) { try { localStorage.setItem('pe-search-newtab', on ? '1' : '0'); } catch (e) {} }
  function tabAttrs() { return newTab() ? ' target="_blank" rel="noopener"' : ''; }
  // Runs a search: in a new tab when that's the reader's choice, otherwise in this one
  function goSearch(q) {
    var url = '/search?q=' + encodeURIComponent(q);
    if (newTab()) { var w = window.open(url, '_blank'); if (w) { try { w.opener = null; } catch (e) {} return; } }
    location.href = url;
  }
  function searchForm(form, field) {
    form.addEventListener('submit', function (e) {
      var q = field.value.trim();
      e.preventDefault();
      if (q) goSearch(q);
    });
  }

  /* 1. Search button and box, with quick links and results as you type */
  function button() {
    if (inEditor || path === '/search' || document.querySelector('.pe-search-btn')) return;
    var F = C.font, I = C.ink;
    css(
      '.pe-search-btn{position:fixed;top:14px;right:16px;z-index:9998;display:flex;align-items:center;gap:6px;padding:8px 14px;border:0;border-radius:20px;background:' + I + ';color:#fff;font:700 14px ' + F + ';cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.15)}' +
      '.pe-search-btn:hover{filter:brightness(1.25)}' +
      '.pe-sp{position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.45);display:none;align-items:flex-start;justify-content:center;padding:10vh 16px 0}' +
      '.pe-sp.open{display:flex}' +
      '.pe-sp-box{width:100%;max-width:640px;max-height:80vh;overflow:auto;background:#fff;border-radius:8px;box-shadow:0 8px 30px rgba(0,0,0,.25);font-family:' + F + '}' +
      '.pe-sp form{display:flex;gap:8px;margin:0;padding:14px;border-bottom:1px solid #eceef1}' +
      '.pe-sp input{flex:1;min-width:0;padding:12px;border:1px solid #d5d8dc;border-radius:4px;font:16px ' + F + ';color:#222}' +
      '.pe-sp input:focus{outline:2px solid ' + I + ';outline-offset:-1px}' +
      '.pe-sp form button{padding:12px 18px;border:0;border-radius:4px;background:' + I + ';color:#fff;font:700 15px ' + F + ';cursor:pointer}' +
      '.pe-sp-list{padding:6px 0 10px}' +
      '.pe-sp-head{margin:8px 18px 4px;font:700 11px ' + F + ';letter-spacing:.08em;text-transform:uppercase;color:#888}' +
      '.pe-sp-item{display:flex;align-items:center;gap:12px;padding:9px 18px;color:' + I + '!important;text-decoration:none!important;border:0!important}' +
      '.pe-sp-item:hover,.pe-sp-item.on{background:#f3f4f6}' +
      '.pe-sp-txt{flex:1;min-width:0}' +
      '.pe-sp-pic{flex:0 0 auto;width:56px;height:40px;border-radius:4px;overflow:hidden;background:#eceef1;display:none}' +
      '.pe-sp-pic.has{display:block}' +
      '.pe-sp-pic img{width:100%;height:100%;object-fit:cover;display:block}' +
      '.pe-sp-t{display:block;font:600 15px/1.35 ' + F + '}' +
      '.pe-sp-m{display:block;margin-top:2px;font:600 11px ' + F + ';letter-spacing:.04em;text-transform:uppercase;color:#888}' +
      '.pe-sp-all{font-weight:700;border-top:1px solid #eceef1!important;margin-top:4px}' +
      '.pe-sp-note{margin:10px 18px;font:14px ' + F + ';color:#666}' +
      '.pe-sp-tip{display:flex;align-items:center;gap:6px;margin:0;padding:8px 18px 12px;font:12px ' + F + ';color:#888;cursor:pointer}' +
      '.pe-sp .pe-sp-tip input{flex:none;width:auto;margin:0;padding:0;border:0;accent-color:' + I + '}'
    );
    var icon = '<svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="7"></circle><line x1="16.5" y1="16.5" x2="21" y2="21"></line></svg>';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pe-search-btn';
    btn.setAttribute('aria-label', 'Search Production Expert');
    btn.innerHTML = icon + '<span>Search</span>';

    var pop = document.createElement('div');
    pop.className = 'pe-sp';
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', 'Search');
    // Everything chosen here opens in a new tab unless the reader unticks it, so the page underneath isn't lost
    pop.innerHTML = '<div class="pe-sp-box"><form action="/search" method="get" role="search">' +
      '<input type="search" name="q" placeholder="Search Production Expert" aria-label="Search terms" autocomplete="off" required>' +
      '<button type="submit">Search</button></form><div class="pe-sp-list" role="listbox"></div>' +
      '<label class="pe-sp-tip"><input type="checkbox"> Open results in a new tab</label></div>';
    var input = pop.querySelector('input[type="search"]'), list = pop.querySelector('.pe-sp-list');
    var tick = pop.querySelector('.pe-sp-tip input'), form = pop.querySelector('form');
    function applyTab() { tick.checked = newTab(); }
    applyTab();
    searchForm(form, input);
    tick.onchange = function () { setNewTab(tick.checked); applyTab(); lookup(); };
    var timer, latest = '', cache = {};

    function row(href, title, meta, extra, pic) {
      return '<a class="pe-sp-item' + (extra || '') + '" role="option" href="' + esc(href) + '"' + tabAttrs() + '><span class="pe-sp-txt"><span class="pe-sp-t">' + esc(title) + '</span>' +
        (meta ? '<span class="pe-sp-m">' + esc(meta) + '</span>' : '') + '</span>' + (pic ? '<span class="pe-sp-pic"></span>' : '') + '</a>';
    }
    function quick() {
      list.innerHTML = '<p class="pe-sp-head">Quick links</p>' +
        C.quickLinks.map(function (l) { return row(l[1], l[0]); }).join('');
    }
    function suggest(q, items) {
      if (q !== latest) return;
      var pick = score(byAge(items.items).recent, items.phrases).filter(function (it) { return it._strong; }).sort(best).slice(0, 6);
      var all = row('/search?q=' + encodeURIComponent(q), 'See all results for “' + q + '”', '', ' pe-sp-all');
      list.innerHTML = pick.length
        ? '<p class="pe-sp-head">Top matches</p>' + pick.map(function (it) {
            return row(it.itemUrl, it.title, metaLine(it), '', true);
          }).join('') + all
        : '<p class="pe-sp-note">No close matches yet. Press Search to see everything that mentions it.</p>' + all;
      var holders = list.querySelectorAll('.pe-sp-pic');
      pick.forEach(function (it, i) { if (holders[i]) addPicture(it, holders[i], 100); });
    }
    function lookup() {
      var q = input.value.trim();
      latest = q;
      if (q.length < 2) return quick();
      if (cache[q]) return suggest(q, cache[q]);
      search(q, 3, 1).then(function (res) { cache[q] = res; suggest(q, res); });
    }

    function open() { applyTab(); pop.classList.add('open'); if (!input.value) quick(); else lookup(); setTimeout(function () { input.focus(); }, 30); }
    function close() { pop.classList.remove('open'); }
    btn.onclick = open;
    pop.onclick = function (e) { if (e.target === pop) close(); };
    input.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(lookup, 250); });

    // Arrow keys move through the list; Enter opens the highlighted item, or searches
    input.addEventListener('keydown', function (e) {
      var items = Array.prototype.slice.call(list.querySelectorAll('.pe-sp-item'));
      var at = items.indexOf(list.querySelector('.pe-sp-item.on'));
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (at > -1) items[at].classList.remove('on');
        at = e.key === 'ArrowDown' ? Math.min(at + 1, items.length - 1) : Math.max(at - 1, -1);
        if (at > -1) { items[at].classList.add('on'); items[at].scrollIntoView({ block: 'nearest' }); }
      } else if (e.key === 'Enter' && at > -1) {
        e.preventDefault();
        items[at].click();
      }
    });
    // A reader who picks a suggestion never reaches the results page, so record the search here
    list.addEventListener('click', function (e) {
      var a = e.target.closest('.pe-sp-item');
      if (a && latest.length > 1 && !a.classList.contains('pe-sp-all')) track(latest, 'as you type', true);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
      var t = e.target.tagName;
      if (e.key === '/' && t !== 'INPUT' && t !== 'TEXTAREA' && !e.target.isContentEditable) { e.preventDefault(); open(); }
    });

    document.body.appendChild(btn);
    document.body.appendChild(pop);
  }

  /* 2. The search results page, rebuilt from Squarespace's search feed */
  function searchPage() {
    if (path !== '/search') return;
    var F = C.font, I = C.ink, PER = 24;
    var params = new URLSearchParams(location.search);
    var q = (params.get('q') || '').trim();
    var typed = (params.get('from') || '').trim();  // set when we corrected a typo
    var exact = params.get('exact') === '1';        // reader asked for their spelling as typed
    css(
      '.sqs-search-page{display:none!important}' +
      '.pe-sr [hidden]{display:none!important}' +
      '.pe-sr{max-width:760px;margin:0 auto 60px;padding:0 4px;font-family:' + F + ';color:' + I + '}' +
      '.pe-sr form{display:flex;gap:8px;margin:0 0 18px}' +
      '.pe-sr input{flex:1;min-width:0;padding:14px 16px;border:1px solid #d5d8dc;border-radius:6px;font:18px ' + F + ';color:#222;background:#fff}' +
      '.pe-sr input:focus{outline:2px solid ' + I + ';outline-offset:-1px}' +
      '.pe-sr form button{padding:0 22px;border:0;border-radius:6px;background:' + I + ';color:#fff;font:700 15px ' + F + ';cursor:pointer}' +
      '.pe-sr-tabs{display:flex;gap:24px;margin:-4px 0 14px;border-bottom:1px solid #e6e8eb;overflow-x:auto;scrollbar-width:none}' +
      '.pe-sr-tabs button{flex:0 0 auto;padding:8px 2px 10px;border:0;border-bottom:3px solid transparent;margin-bottom:-1px;border-radius:0;background:none;font:600 14px ' + F + ';color:#666;cursor:pointer}' +
      '.pe-sr-tabs button:hover{color:' + I + '}' +
      '.pe-sr-tabs button[aria-selected="true"]{color:' + I + ';border-bottom-color:' + I + '}' +
      '.pe-sr-tabs button span{margin-left:6px;font-weight:400;color:#999}' +
      '.pe-sr-tabs button.none{color:#aaa}' +
      '.pe-sr-pic.vid{position:relative;width:160px;height:90px;background:#000}' +
      '.pe-sr-pic.vid i{position:absolute;left:50%;top:50%;width:36px;height:26px;margin:-13px 0 0 -18px;border-radius:7px;background:rgba(0,0,0,.72)}' +
      '.pe-sr-pic.vid i:after{content:"";position:absolute;left:14px;top:7px;border-style:solid;border-width:6px 0 6px 10px;border-color:transparent transparent transparent #fff}' +
      '@media (max-width:600px){.pe-sr-pic.vid{width:112px;height:63px}}' +
      '.pe-sr-podrow{padding:8px 0;border-bottom:1px solid #e6e8eb}' +
      '.pe-sr-bar{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;margin:0 0 18px}' +
      '.pe-sr-right{display:flex;align-items:center;flex-wrap:wrap;gap:14px}' +
      '.pe-sr-nt{display:flex;align-items:center;gap:6px;margin:0;font:13px ' + F + ';color:#666;cursor:pointer}' +
      '.pe-sr .pe-sr-nt input{flex:none;width:auto;margin:0;padding:0;border:0;accent-color:' + I + '}' +
      '.pe-sr-count{margin:0;font:600 14px ' + F + ';color:#666}' +
      '.pe-sr-sort{display:flex;gap:4px;padding:3px;background:#f1f2f4;border-radius:20px}' +
      '.pe-sr-sort button{padding:6px 14px;border:0;border-radius:16px;background:none;font:600 13px ' + F + ';color:#555;cursor:pointer}' +
      '.pe-sr-sort button[aria-pressed="true"]{background:#fff;color:' + I + ';box-shadow:0 1px 3px rgba(0,0,0,.12)}' +
      '.pe-sr-grid{display:block;border-top:1px solid #e6e8eb}' +
      '.pe-sr-card{display:flex;align-items:flex-start;gap:18px;padding:18px 0 20px;border:0!important;border-bottom:1px solid #e6e8eb!important;border-radius:0!important;box-shadow:none!important;background:none!important;color:inherit!important;text-decoration:none!important}' +
      '.pe-sr-meta{margin:0 0 4px;font:600 12px ' + F + ';letter-spacing:.04em;text-transform:uppercase;color:#888}' +
      '.pe-sr-title{margin:0 0 6px;font:700 19px/1.3 ' + F + ';color:' + C.link + '}' +
      'a.pe-sr-card:visited .pe-sr-title{color:#681da8}' +
      '.pe-sr-vids{padding:18px 0 20px;border-bottom:1px solid #e6e8eb}' +
      '.pe-sr-vids h3{margin:0 0 12px!important;font:700 15px ' + F + '!important;letter-spacing:0!important;text-transform:none!important;color:' + I + '!important}' +
      '.pe-sr-vrow{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(180px,1fr);gap:14px;overflow-x:auto;padding-bottom:4px}' +
      '.pe-sr-v{display:block;color:inherit!important;text-decoration:none!important;border:0!important}' +
      '.pe-sr-vimg{position:relative;padding-bottom:56.25%;border-radius:8px;overflow:hidden;background:#000}' +
      '.pe-sr-vimg img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}' +
      '.pe-sr-vimg i{position:absolute;left:50%;top:50%;width:40px;height:28px;margin:-14px 0 0 -20px;border-radius:7px;background:rgba(0,0,0,.72)}' +
      '.pe-sr-vimg i:after{content:"";position:absolute;left:16px;top:8px;border-style:solid;border-width:6px 0 6px 10px;border-color:transparent transparent transparent #fff}' +
      '.pe-sr-vt{margin:8px 0 2px;font:600 14px/1.35 ' + F + ';color:' + C.link + ';display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}' +
      '.pe-sr-vm{margin:0;font:12px ' + F + ';color:#777}' +
      '.pe-sr-pods{padding:18px 0 14px;border-bottom:1px solid #e6e8eb}' +
      '.pe-sr-pods h3{margin:0 0 8px!important;font:700 15px ' + F + '!important;letter-spacing:0!important;text-transform:none!important;color:' + I + '!important}' +
      '.pe-sr-pod{display:flex;gap:14px;align-items:flex-start;padding:10px 0;color:inherit!important;text-decoration:none!important;border:0!important}' +
      '.pe-sr-mic{flex:0 0 auto;width:44px;height:44px;border-radius:8px;background:#222 url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27white%27 stroke-width=%272%27 stroke-linecap=%27round%27%3E%3Crect x=%279%27 y=%273%27 width=%276%27 height=%2711%27 rx=%273%27/%3E%3Cpath d=%27M5 11a7 7 0 0 0 14 0M12 18v3%27/%3E%3C/svg%3E") center/22px no-repeat}' +
      '.pe-sr-podtxt{flex:1;min-width:0}' +
      '.pe-sr-pt{display:block;font:600 16px/1.35 ' + F + ';color:' + C.link + '}' +
      '.pe-sr-pod:hover .pe-sr-pt{text-decoration:underline;text-underline-offset:3px}' +
      '.pe-sr-pm{display:block;margin:2px 0 4px;font:600 12px ' + F + ';letter-spacing:.04em;text-transform:uppercase;color:#888}' +
      '.pe-sr-ps{display:block;font:14px/1.5 ' + F + ';color:#555;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}' +
      '.pe-sr-txt{flex:1;min-width:0}' +
      '.pe-sr-pic{flex:0 0 auto;width:120px;height:80px;margin-top:4px;border-radius:6px;overflow:hidden;background:#eceef1;display:none}' +
      '.pe-sr-pic.has{display:block}' +
      '.pe-sr-pic img{width:100%;height:100%;object-fit:cover;display:block}' +
      '@media (max-width:600px){.pe-sr-pic{width:84px;height:56px}}' +
      '.pe-sr-meta b{color:' + I + '}' +
      '.pe-sr-card:hover .pe-sr-title{text-decoration:underline;text-underline-offset:3px}' +
      '.pe-sr-text{margin:0;font:15px/1.6 ' + F + ';color:#555}' +
      '.pe-sr-text em{font-style:normal;font-weight:700;color:' + I + '}' +
      '.pe-sr-more{display:block;margin:28px auto 0;padding:12px 26px;border:1px solid ' + I + ';border-radius:6px;background:#fff;font:700 15px ' + F + ';color:' + I + ';cursor:pointer}' +
      '.pe-sr-empty{padding:30px 0;font:16px/1.5 ' + F + ';color:#555}' +
      '.pe-sr-fix{margin:0 0 14px;font:15px/1.5 ' + F + ';color:#555}' +
      '.pe-sr-fix a{color:' + C.link + '!important}' +
      '.pe-sr-fix .big{font-size:17px;color:#222}'
    );
    function marked(t) { return esc(t).replace(/&lt;em&gt;/g, '<em>').replace(/&lt;\/em&gt;/g, '</em>'); }
    function bold(html) {
      var words = q.split(/\s+/).filter(function (w) { return w.length > 1; }).map(rx);
      return words.length ? html.replace(new RegExp('\\b((?:' + words.join('|') + ')s?)\\b', 'gi'), '<em>$1</em>') : html; // whole words only, so "pro" doesn't light up "product"
    }

    var root = document.createElement('div');
    root.className = 'pe-sr';
    root.innerHTML = '<p class="pe-sr-fix" hidden></p><form action="/search" method="get" role="search"><input type="search" name="q" placeholder="Search Production Expert" aria-label="Search terms" required><button type="submit">Search</button></form>' +
      '<div class="pe-sr-tabs" role="tablist" aria-label="Type of result" hidden></div>' +
      '<div class="pe-sr-bar"><p class="pe-sr-count" aria-live="polite"></p><div class="pe-sr-right"><label class="pe-sr-nt"><input type="checkbox"> Open in a new tab</label><div class="pe-sr-sort" role="group" aria-label="Sort results"><button type="button" data-s="new" aria-pressed="true">Newest</button><button type="button" data-s="best" aria-pressed="false">Best match</button></div></div></div>' +
      '<div class="pe-sr-grid"></div><button type="button" class="pe-sr-more" hidden>Show more</button>';
    var native = document.querySelector('.sqs-search-page');
    var host = native ? native.parentNode : (document.querySelector('#content, main, .content') || document.body);
    host.insertBefore(root, native ? native.nextSibling : host.firstChild);
    root.querySelector('input[type="search"]').value = q;
    searchForm(root.querySelector('form'), root.querySelector('input[type="search"]'));
    var ntBox = root.querySelector('.pe-sr-nt input');
    ntBox.checked = newTab();
    ntBox.onchange = function () { setNewTab(ntBox.checked); if (items.length || vlist.length || plist.length) draw(); };

    var grid = root.querySelector('.pe-sr-grid'), count = root.querySelector('.pe-sr-count'), more = root.querySelector('.pe-sr-more');
    var bar = root.querySelector('.pe-sr-bar'), sorter = root.querySelector('.pe-sr-sort'), tabsEl = root.querySelector('.pe-sr-tabs');
    var items = [], older = [], phrases = [q], order = 'new', shown = PER, loose = false;
    // Tabs, as on Google: All (articles with video and podcast strips), Articles, Videos, Podcasts.
    // The chosen tab is kept in the address (&t=videos), so Back and shared links keep it.
    var TABS = [['all', 'All'], ['articles', 'Articles'], ['videos', 'Videos'], ['podcasts', 'Podcasts']];
    var tab = params.get('t');
    if (!TABS.some(function (t) { return t[0] === tab; })) tab = 'all';
    var vlist = [], plist = [];   // every matching video and podcast episode, for their tabs
    if (!q) { bar.hidden = true; return; }
    count.textContent = 'Searching…';

    // What each result says under its title: the meta description written for Google, else the
    // article's summary, else the matched snippets. Search words in bold.
    function blurb(it) {
      if (it._seo) return bold(esc(it._seo));
      var summary = String(it.excerpt || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      return summary ? bold(esc(summary)) : marked((it.highlight || []).slice(1, 3).join(' \u2026 '));
    }
    // Asks the Google Sheet for the meta descriptions of results not yet looked up
    function describe(list) {
      var need = list.filter(function (it) { return !it._seoAsked && it.itemUrl; }).slice(0, 30);
      if (!need.length || !C.videoStore) return Promise.resolve();
      need.forEach(function (it) { it._seoAsked = true; });
      return fetch(C.videoStore + '?desc=' + encodeURIComponent(need.map(function (it) { return it.itemUrl; }).join('|')))
        .then(function (r) { return r.json(); }).then(function (d) {
          var map = (d && d.descriptions) || {};
          need.forEach(function (it) {
            if (!map[it.itemUrl]) return;
            it._seo = map[it.itemUrl];
            var el = grid.querySelector('a.pe-sr-card[href="' + it.itemUrl.replace(/"/g, '') + '"] .pe-sr-text');
            if (el) el.innerHTML = blurb(it); // already on screen: swap the text in place
          });
        }).catch(function () {});
    }
    function ordered() {
      var strong = items.filter(function (it) { return it._strong; });
      var pool = (loose || !strong.length) ? items : strong;
      return pool.slice().sort(order === 'new'
        ? function (a, b) { return (b.publishOn || 9e15) - (a.publishOn || 9e15); }
        : best);
    }

    function card(it) {
      var a = document.createElement('a');
      a.className = 'pe-sr-card';
      a.href = it.itemUrl;
      if (newTab()) { a.target = '_blank'; a.rel = 'noopener'; }
      var meta = metaLine(it);
      var text = blurb(it);
      a.innerHTML = '<div class="pe-sr-txt"><p class="pe-sr-meta">' + esc(meta).replace('Partner Content', '<b>Partner Content</b>') + '</p><p class="pe-sr-title">' + esc(it.title) + '</p><p class="pe-sr-text">' + text + '</p></div><div class="pe-sr-pic"></div>';
      addPicture(it, a.querySelector('.pe-sr-pic'), 300);
      return a;
    }

    function pool() {
      var strong = items.filter(function (it) { return it._strong; });
      return (loose || !strong.length) ? items : strong;
    }
    function drawTabs() {
      var n = { all: null, articles: pool().length, videos: vlist.length, podcasts: plist.length };
      tabsEl.innerHTML = TABS.map(function (t) {
        var c = n[t[0]];
        return '<button type="button" role="tab" data-t="' + t[0] + '" aria-selected="' + (t[0] === tab) + '"' + (c === 0 ? ' class="none"' : '') + '>' +
          t[1] + (c ? '<span>' + c + '</span>' : '') + '</button>';
      }).join('');
      tabsEl.hidden = false;
    }
    tabsEl.onclick = function (e) {
      var b = e.target.closest('button');
      if (!b || b.getAttribute('data-t') === tab) return;
      tab = b.getAttribute('data-t');
      shown = PER;
      try { var u = new URL(location.href); if (tab === 'all') u.searchParams.delete('t'); else u.searchParams.set('t', tab); history.replaceState(null, '', u); } catch (x) {}
      draw();
    };
    function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
    function pager(total) {
      if (total > shown) { more.textContent = 'Show more'; more.hidden = false; more.dataset.act = 'more'; } else more.hidden = true;
    }
    // Videos and podcast episodes on their own tabs: newest first, or the sheet's own order for best match
    function byDate(list) { return order === 'new' ? list.slice().sort(function (a, b) { return (b.date || 0) - (a.date || 0); }) : list.slice(); }
    function drawVideos() {
      grid.innerHTML = '';
      var list = byDate(vlist);
      list.slice(0, shown).forEach(function (v) {
        var a = document.createElement('a');
        a.className = 'pe-sr-card';
        a.href = 'https://www.youtube.com/watch?v=' + encodeURIComponent(v.id);
        a.target = '_blank'; a.rel = 'noopener';
        a.innerHTML = '<div class="pe-sr-txt"><p class="pe-sr-meta">' + esc(['YouTube', date(v.date)].filter(Boolean).join(' \u00b7 ')) + '</p><p class="pe-sr-title">' + esc(v.title) + '</p></div>' +
          '<div class="pe-sr-pic has vid"><img loading="lazy" alt="" src="https://i.ytimg.com/vi/' + encodeURIComponent(v.id) + '/mqdefault.jpg"><i></i></div>';
        grid.appendChild(a);
      });
      if (!list.length) grid.innerHTML = '<p class="pe-sr-empty">No videos on our YouTube channel match \u201c' + esc(q) + '\u201d.</p>';
      count.textContent = plural(list.length, 'video', 'videos') + ' for \u201c' + q + '\u201d';
      sorter.hidden = !list.length;
      pager(list.length);
    }
    function drawPodcasts() {
      grid.innerHTML = '';
      var list = byDate(plist);
      list.slice(0, shown).forEach(function (e) {
        var row = document.createElement('div');
        row.className = 'pe-sr-podrow';
        row.innerHTML = podLink(e);
        grid.appendChild(row);
      });
      if (!list.length) grid.innerHTML = '<p class="pe-sr-empty">No podcast episodes match \u201c' + esc(q) + '\u201d.</p>';
      count.textContent = plural(list.length, 'podcast episode', 'podcast episodes') + ' for \u201c' + q + '\u201d';
      sorter.hidden = !list.length;
      pager(list.length);
    }

    function draw() {
      drawTabs();
      if (tab === 'videos') return drawVideos();
      if (tab === 'podcasts') return drawPodcasts();
      var strips = tab === 'all';
      var strong = items.filter(function (it) { return it._strong; });
      var pool = (loose || !strong.length) ? items : strong;
      var list = pool.slice().sort(order === 'new'
        ? function (a, b) { return (b.publishOn || 9e15) - (a.publishOn || 9e15); } // guide pages (no date) stay on top
        : best);
      grid.innerHTML = '';
      sorter.hidden = false;
      if (!list.length) {
        // no articles: say so, but keep the video and podcast strips on the All tab
        grid.innerHTML = '<p class="pe-sr-empty">No articles for \u201c' + esc(q) + '\u201d' + (older.length ? ' from the last ' + C.maxYears + ' years' : '') + '.</p>';
        if (strips && vids) grid.appendChild(vids);
        if (strips && pods) grid.appendChild(pods);
        count.textContent = '';
        sorter.hidden = true;
        if (older.length) { more.textContent = 'Show ' + plural(older.length, 'older article', 'older articles'); more.dataset.act = 'older'; more.hidden = false; }
        else more.hidden = true;
        return;
      }
      if (vids && vidsTop && strips) grid.appendChild(vids);
      describe(list.slice(0, shown));
      list.slice(0, shown).forEach(function (it, i) {
        grid.appendChild(card(it));
        if (i === 2 && strips && vids && !vidsTop) grid.appendChild(vids);
        if (i === 2 && strips && pods) grid.appendChild(pods);
      });
      if (strips && vids && !vids.parentNode) grid.appendChild(vids);
      if (strips && pods && !pods.parentNode) grid.appendChild(pods);
      var weak = items.length - strong.length;
      count.textContent = pool.length + (tab === 'articles' ? (pool.length === 1 ? ' article' : ' articles') : (pool.length === 1 ? ' result' : ' results')) + ' for “' + q + '”' +
        (!strong.length ? ' (no close matches, showing everything that mentions it)' : '');
      if (list.length > shown) { more.textContent = 'Show more'; more.hidden = false; more.dataset.act = 'more'; }
      else if (!loose && strong.length && weak) { more.textContent = 'Show ' + weak + ' less relevant results'; more.hidden = false; more.dataset.act = 'loose'; }
      else more.hidden = true;
    }

    sorter.onclick = function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      order = b.getAttribute('data-s');
      shown = PER;
      Array.prototype.forEach.call(this.children, function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      draw();
    };
    more.onclick = function () {
      if (more.dataset.act === 'older') { items = score(older, phrases); sorter.hidden = false; }
      else if (more.dataset.act === 'loose') loose = true;
      else shown += PER;
      draw();
    };

    // Matching videos from the YouTube channel, shown as a strip at the top of the results,
    // and matching podcast episodes, shown as a short list after the third result.
    // The results wait up to 1.5 seconds for them so the page doesn't jump. If they arrive
    // after the reader has started scrolling, they go after the third result instead.
    var vids = null, pods = null, vidsTop = true, drawn = false, videosIn;
    var videosReady = new Promise(function (done) { videosIn = done; });
    if (!C.videoStore) videosIn();
    else {
      // limit: how many of each the sheet should send for the Videos and Podcasts tabs
      fetch(C.videoStore + '?media=' + encodeURIComponent(q) + '&years=' + C.maxYears + '&limit=60').then(function (r) { return r.json(); }).then(function (d) {
        var cutoff = Date.now() - C.maxYears * YEAR;
        var eps = (d.podcasts || []).filter(function (e) { return e.date >= cutoff; });
        plist = eps;
        vlist = (d.videos || []).filter(function (v) { return v.date >= cutoff; });
        if (eps.length) {
          pods = document.createElement('div');
          pods.className = 'pe-sr-pods';
          pods.innerHTML = '<h3>Podcast episodes</h3>' + eps.slice(0, 3).map(podLink).join('');
        }
        if (drawn) draw();
        var list = vlist.slice(0, 4);
        if (!list.length) return videosIn();
        vids = document.createElement('div');
        vids.className = 'pe-sr-vids';
        vids.innerHTML = '<h3>Videos</h3><div class="pe-sr-vrow">' + list.map(function (v) {
          return '<a class="pe-sr-v" href="https://www.youtube.com/watch?v=' + encodeURIComponent(v.id) + '" target="_blank" rel="noopener">' +
            '<div class="pe-sr-vimg"><img loading="lazy" alt="" src="https://i.ytimg.com/vi/' + encodeURIComponent(v.id) + '/mqdefault.jpg"><i></i></div>' +
            '<p class="pe-sr-vt">' + esc(v.title) + '</p><p class="pe-sr-vm">YouTube \u00b7 ' + esc(date(v.date)) + '</p></a>';
        }).join('') + '</div>';
        videosIn();
        if (!drawn) return;
        vidsTop = window.scrollY < 150;
        draw();
      }).catch(function () { videosIn(); });
    }
    function podLink(e) {
      var meta = ['Podcast', date(e.date), e.minutes ? e.minutes + ' min' : ''].filter(Boolean).join(' \u00b7 ');
      return '<a class="pe-sr-pod" href="' + esc(e.url) + '" target="_blank" rel="noopener"><span class="pe-sr-mic" aria-hidden="true"></span>' +
        '<span class="pe-sr-podtxt"><span class="pe-sr-pt">' + esc(e.title) + '</span><span class="pe-sr-pm">' + esc(meta) + '</span>' +
        (e.summary ? '<span class="pe-sr-ps">' + esc(e.summary) + '</span>' : '') + '</span></a>';
    }
    var waitForVideos = Promise.race([videosReady, new Promise(function (r) { setTimeout(r, 1500); })]);

    // Typo help. When a search finds fewer than three close matches, ask the Google Sheet for
    // a corrected spelling built from your own titles, tags and video titles.
    var fix = root.querySelector('.pe-sr-fix');
    function spelling() {
      if (exact || typed || !C.videoStore) return Promise.resolve(null);
      return fetch(C.videoStore + '?spell=' + encodeURIComponent(q)).then(function (r) { return r.json(); })
        .then(function (d) { return d && d.suggestion && d.suggestion !== q.toLowerCase() ? d.suggestion : null; })
        .catch(function () { return null; });
    }
    function link(text, query, ex) { return '<a href="/search?q=' + encodeURIComponent(query) + (ex ? '&exact=1' : '') + '">' + esc(text) + '</a>'; }
    if (typed) {
      fix.innerHTML = '<span class="big">Showing results for <b>' + esc(q) + '</b></span><br>Search instead for ' + link(typed, typed, true);
      fix.hidden = false;
    }

    Promise.all([search(q, 8, 3, true), waitForVideos]).then(function (both) {
      var res = both[0];
      drawn = true;
      phrases = res.phrases;
      // a question Claude rephrased reads best with the closest match first
      if (res.ai) {
        order = 'best';
        Array.prototype.forEach.call(sorter.children, function (x) { x.setAttribute('aria-pressed', x.getAttribute('data-s') === 'best' ? 'true' : 'false'); });
      }
      var split = byAge(res.items);
      items = score(split.recent, phrases);
      older = split.older;
      var strongCount = items.filter(function (it) { return it._strong; }).length;
      if (res.widened && strongCount && !typed) {
        fix.innerHTML = 'No exact matches for \u201c' + esc(q) + '\u201d, so these are the closest articles.';
        fix.hidden = false;
      }
      track(q, typed ? 'spelling fix' : res.ai ? 'rephrased by AI' : 'site search', strongCount > 0);

      // Nothing useful found: try the corrected spelling straight away, as Google does
      var check = strongCount < 3 ? spelling() : Promise.resolve(null);
      check.then(function (suggestion) {
        if (suggestion && !strongCount) {
          location.replace('/search?q=' + encodeURIComponent(suggestion) + '&from=' + encodeURIComponent(q));
          return;
        }
        if (suggestion) {
          fix.innerHTML = 'Did you mean ' + link(suggestion, suggestion) + '?';
          fix.hidden = false;
        }
        // Give the meta descriptions up to 1.5 seconds so the text doesn't change after it appears
        Promise.race([describe(ordered().slice(0, shown)), new Promise(function (r) { setTimeout(r, 1500); })]).then(show);
      });
    });

    function show() {
      draw();
      if (!items.length && !older.length && !vlist.length && !plist.length && tab === 'all')
        grid.innerHTML = '<p class="pe-sr-empty">No results for \u201c' + esc(q) + '\u201d. Try fewer words, or a product or brand name.</p>';
    }
  }

  button();
  searchPage();
  addEventListener('mercury:load', button);
})();
} catch (e) { if (window.console) console.warn('Production Expert script failed: free site search, plus search tracking', e); }

/* ================================================================
 * Production Expert: hide tags from readers, keep tag pages out of Google, category chips
 * - The "tags:" line under each post is hidden. The links stay in the page, because other
 *   sections read them (Related Content cards match on tag links). Categories stay visible.
 * - Tag archive pages (any address with ?tag=) tell Google not to index them, while still
 *   following their links. Google reads tags added by script when it renders the page.
 *   Category pages are left as they are.
 * ================================================================ */
try {
(function () {
  // 1. Hide the tags line. A style rule, so it also covers posts loaded later by Squarespace.
  var st = document.createElement('style');
  st.textContent = 'article footer .meta .tags{display:none!important}';
  document.head.appendChild(st);

  // 2. noindex on tag pages. Runs on every page load, including Squarespace's in-page loads.
  function noindexTags() {
    var tagPage = /[?&]tag=/.test(location.search);
    var m = document.querySelector('meta[name="robots"][data-pe-tag]');
    if (tagPage && !m) {
      m = document.createElement('meta');
      m.name = 'robots';
      m.content = 'noindex, follow';
      m.setAttribute('data-pe-tag', '1');   // ours, so it can be taken away on other pages
      document.head.appendChild(m);
    } else if (!tagPage && m) {
      m.parentNode.removeChild(m);
    }
  }
  noindexTags();
  addEventListener('mercury:load', noindexTags);

  // 3. Categories as grey chips under a "FILED UNDER" label, matching the "In this article" box.
  // The original links are moved, not copied, so they stay real links in the page. Near-duplicates
  // that differ only in capitals ("Pro Tools computer" / "Pro Tools Computer") show once, and only
  // the first three show. The rest stay in the page, hidden, because the Related Content cards
  // match on every category link.
  var cs = document.createElement('style');
  cs.textContent =
    '.pe-cats{margin:28px 0 24px;font-family:"Open Sans",sans-serif}' +
    '.pe-cats-label{font-size:11px;letter-spacing:.06em;color:#777;margin:0 0 8px;text-transform:uppercase}' +
    '.pe-cats-list{display:flex;flex-wrap:wrap;gap:6px}' +
    '.pe-cats-list a{background:#f1f2f4;color:#333!important;font-size:13px;line-height:1.4;padding:5px 11px;border-radius:4px;text-decoration:none!important;border:0!important}' +
    '.pe-cats-list a:hover{background:#e6e8eb;color:#006EB3!important}' +
    '.pe-cats-list a.pe-cat-more{display:none}' +
    // On list pages the chips sit under each excerpt, so less space around them
    'body:not(.view-item) .pe-cats{margin:14px 0 18px}' +
    // On a category page, that category's chip is picked out in brand blue
    '.pe-cats-list a.pe-cat-here{background:#e3eef7;color:#006EB3!important}';
  document.head.appendChild(cs);

  function chipCategories() {
    // Runs on single articles and on blog list pages (the main blog and category/tag pages)
    document.querySelectorAll('article footer .meta .categories').forEach(function (box) {
      if (box.classList.contains('pe-cats')) return;               // already done
      var links = Array.prototype.slice.call(box.querySelectorAll('a'));
      if (!links.length) return;
      var list = document.createElement('div');
      list.className = 'pe-cats-list';
      // Of each near-duplicate, keep the version with more capitals ("Pro Tools Computer")
      function caps(a) { return (a.textContent.match(/[A-Z]/g) || []).length; }
      var best = {};
      links.forEach(function (a) {
        var key = a.textContent.trim().toLowerCase();
        if (!best[key] || caps(a) > caps(best[key])) best[key] = a;
      });
      var shown = 0;
      // The category this page is showing, if any (?category=Computer), in lower case
      var here = (location.search.match(/[?&]category=([^&]*)/) || [])[1];
      here = here ? decodeURIComponent(here.replace(/\+/g, ' ')).toLowerCase() : '';
      links.forEach(function (a) {
        var key = a.textContent.trim().toLowerCase();
        if (here && key === here) a.classList.add('pe-cat-here');
        if (best[key] !== a || shown >= 3) a.classList.add('pe-cat-more');   // duplicate or over three
        else shown++;
        list.appendChild(a);
      });
      var label = document.createElement('div');
      label.className = 'pe-cats-label';
      label.textContent = 'Filed under';
      box.textContent = '';                                         // drops "categories:" and the commas
      box.appendChild(label);
      box.appendChild(list);
      box.classList.add('pe-cats');
    });
  }
  chipCategories();
  addEventListener('mercury:load', chipCategories);
})();
} catch (e) { if (window.console) console.warn('Production Expert script failed: hide tags and noindex tag pages', e); }

/* ================================================================
 * Production Expert: people section (#people ... #end people)
 * Turns a run of image + text blocks into a designed list of people:
 * a round photo on the left, the person's name, an optional role line and
 * their text on the right, separated by fine lines. Transparent background,
 * full width of the article column.
 *
 * How the team uses it, all in the normal Squarespace editor:
 *   #people                      (on its own line; add a label after it if wanted,
 *                                 e.g. "#people The Contributors")
 *   [image block]  photo of person 1, any image layout
 *   [text block]   Name on its own line (optional)
 *                  Role on its own line (optional)
 *                  Their bio paragraphs
 *   [image block]  photo of person 2 ... and so on, one image per person
 *   #end people                  (on its own line)
 *
 * Every image starts a new person; the text after it belongs to them.
 * Divider (line) blocks in between are ignored. With no name line, a name at
 * the start of the bio ("Burak Topalakci is a ...") is picked up as the name.
 * Inside the Squarespace editor the blocks are left exactly as they are, so they stay
 * editable. A blue "Preview people section" button appears above the #people line;
 * it swaps the blocks for a preview built from copies, and "Back to editing" swaps back.
 * Nothing inside a text block is touched in the editor, so nothing extra can be saved.
 * ================================================================ */
try {
(function () {
  var START = /^\s*#people\b\s*(.*)$/i;            // "#people" plus an optional label
  var END = /^\s*#\s*end[\s-]*people\s*$/i;         // "#end people" (also "#end-people")
  var TEXT_TAGS = 'P,UL,OL,BLOCKQUOTE,H1,H2,H3,H4,H5,H6';
  var SHORT = 80;                                    // a line this short with no full stop is a name or role
  var BLUE = '#006eb3';

  var inEditor = false;
  try { inEditor = window.top !== window; } catch (e) { inEditor = true; }

  // One small stylesheet: inline styles can't do the phone layout, and the site's
  // own paragraph styles are strong, so the text rules carry !important.
  function styles() {
    if (document.getElementById('pe-people-style')) return;
    var s = document.createElement('style');
    s.id = 'pe-people-style';
    s.textContent =
      '.pe-people{clear:both;margin:2.25rem 0;padding:0;background:transparent;font-family:"Open Sans",sans-serif}' +
      '.pe-people-label{margin:0 0 6px!important;font-size:13px!important;font-weight:700!important;letter-spacing:.14em;text-transform:uppercase;color:#6b6b70!important;line-height:1.4!important}' +
      '.pe-person{display:flex;gap:28px;align-items:flex-start;padding:26px 0;border-top:1px solid #e3e3e3}' +
      '.pe-person:last-child{border-bottom:1px solid #e3e3e3}' +
      '.pe-person-photo{flex:0 0 120px;width:120px;height:120px;border-radius:50%;object-fit:cover;object-position:50% 30%;display:block;background:#eee;margin:0}' +
      '.pe-person-text{flex:1 1 auto;min-width:0}' +
      '.pe-person-name{margin:2px 0 4px!important;font-size:22px!important;font-weight:700!important;line-height:1.25!important;color:#222!important}' +
      '.pe-person-role{margin:0 0 10px!important;font-size:13px!important;letter-spacing:.06em;text-transform:uppercase;line-height:1.4!important;color:#6b6b70!important}' +
      '.pe-person-text p,.pe-person-text li{font-size:16px!important;line-height:1.7!important;color:#333}' +
      '.pe-person-text p{margin:0 0 10px!important}' +
      '.pe-person-text>:last-child{margin-bottom:0!important}' +
      '.pe-person-text a{color:' + BLUE + ';text-underline-offset:3px}' +
      '.pe-people-toggle{display:inline-block;margin:0 0 10px;padding:6px 12px;border:0;border-radius:4px;background:' + BLUE + ';color:#fff;font:600 13px/1.3 "Open Sans",sans-serif;cursor:pointer}' +
      '@media (max-width:600px){' +
        '.pe-person{gap:18px;padding:22px 0}' +
        '.pe-person-photo{flex-basis:84px;width:84px;height:84px}' +
        '.pe-person-name{font-size:19px!important}' +
        '.pe-person-text p,.pe-person-text li{font-size:15px!important}' +
      '}';
    document.head.appendChild(s);
  }

  function after(a, b) { return !!(a.compareDocumentPosition(b) & 4); }   // b comes after a
  function between(node, s, e) { return after(s, node) && after(node, e) && !node.contains(s) && !node.contains(e); }
  function text(n) { return (n.textContent || '').replace(/\s+/g, ' ').trim(); }
  function isShortLine(n) { var t = text(n); return n.tagName !== 'UL' && n.tagName !== 'OL' && t && t.length <= SHORT && !/[.!?]$/.test(t); }

  // Best image address: Squarespace keeps the real one in data-src until it lazy-loads
  function photoUrl(img) {
    var u = img.getAttribute('data-src') || img.getAttribute('data-image') || img.currentSrc || img.src || '';
    if (/squarespace-cdn\.com/.test(u) && u.indexOf('format=') === -1) u += (u.indexOf('?') === -1 ? '?' : '&') + 'format=300w';
    return u;
  }

  function build(body, startP, endP, editor) {
    var label = (text(startP).match(START) || [])[1] || '';

    // Walk everything between the two marker lines, in page order:
    // each image opens a new person, text elements fill the current one.
    var people = [], cur = null;
    var walk = document.createTreeWalker(body, NodeFilter.SHOW_ELEMENT), n;
    walk.currentNode = startP;
    while ((n = walk.nextNode()) && n !== endP) {
      if (endP && n.contains(endP)) continue;
      if (n.tagName === 'IMG' && n.closest('.sqs-block-image, .image-block, .sqs-block-gallery')) {
        if (n.closest('noscript')) continue;
        cur = { img: n, parts: [] };
        people.push(cur);
      } else if (cur && TEXT_TAGS.indexOf(n.tagName) !== -1 && n.closest('.sqs-block-html, .html-block') &&
                 !n.parentElement.closest('p,ul,ol,blockquote,h1,h2,h3,h4,h5,h6') && text(n)) {
        cur.parts.push(n);
      }
    }
    if (!people.length) return null;

    styles();
    var sec = document.createElement('section');
    sec.className = 'pe-people';
    sec.setAttribute('aria-label', label || 'People');
    if (label) {
      var l = document.createElement('p');
      l.className = 'pe-people-label';
      l.textContent = label;
      sec.appendChild(l);
    }
    var list = document.createElement('div');
    sec.appendChild(list);

    people.forEach(function (p) {
      var row = document.createElement('div');
      row.className = 'pe-person';
      var parts = p.parts.slice(), name = '', role = '';

      // Name and role: up to two short leading lines
      if (parts.length > 1 && isShortLine(parts[0])) { name = text(parts.shift()); }
      if (name && parts.length > 1 && isShortLine(parts[0])) { role = text(parts.shift()); }
      // No name line: take a name from the start of the bio, e.g. "George Haddad is known for..."
      if (!name && parts.length) {
        // \p{Lu} is any capital letter in any alphabet, so accented names (Árnason, Øvrebø, Žižek)
        // count; lower-case particles (van, de, da...) are allowed between the capitalised words.
        var m = text(parts[0]).match(/^(\p{Lu}[\p{L}'’.-]+(?:\s(?:(?:van|von|de|da|del|della|di|du|der|den|dos|das|la|le|bin|al|ibn)\s)?\p{Lu}[\p{L}'’.-]+){1,3})\s+(?:is|was|has|works|began|started|joined|spent)\b/u);
        if (m) name = m[1];
      }

      var img = document.createElement('img');
      img.className = 'pe-person-photo';
      img.src = photoUrl(p.img);
      img.alt = name || p.img.alt || '';
      img.loading = 'lazy';
      row.appendChild(img);

      var t = document.createElement('div');
      t.className = 'pe-person-text';
      if (name) { var h = document.createElement('p'); h.className = 'pe-person-name'; h.textContent = name; t.appendChild(h); }
      if (role) { var r = document.createElement('p'); r.className = 'pe-person-role'; r.textContent = role; t.appendChild(r); }
      // On the live page the original paragraphs are moved (links and formatting come with them).
      // In the editor they are copied, so the real blocks are never changed.
      parts.forEach(function (el) {
        var node = editor ? el.cloneNode(true) : el;
        node.removeAttribute('style');
        t.appendChild(node);
      });
      row.appendChild(t);
      list.appendChild(row);
    });

    if (editor) return sec;                                             // the editor preview places itself

    // Put the section where the #people line was, then hide the leftovers
    startP.parentNode.insertBefore(sec, startP);
    startP.style.display = 'none';
    endP.style.display = 'none';
    [].forEach.call(body.querySelectorAll('.sqs-block'), function (b) {
      if (between(b, startP, endP)) b.style.display = 'none';         // images, emptied text blocks, dividers
    });
    var endBlock = endP.closest('.sqs-block');                          // "#end people" alone in its block
    if (endBlock && !text(endBlock).replace(text(endP), '').trim() && !endBlock.querySelector('img')) endBlock.style.display = 'none';
    // Rows and columns left with nothing showing
    [].forEach.call(body.querySelectorAll('.row, .col'), function (r) {
      if (r.contains(sec)) return;
      var blocks = r.querySelectorAll('.sqs-block');
      if (blocks.length && [].every.call(blocks, function (b) { return b.style.display === 'none'; })) r.style.display = 'none';
    });
    return sec;
  }

  // True when the block has any wording after the given line
  function textAfter(line, block) {
    var w = document.createTreeWalker(block, NodeFilter.SHOW_TEXT), t;
    while ((t = w.nextNode())) if (after(line, t) && !line.contains(t) && t.nodeValue.trim()) return true;
    return false;
  }

  // Editor only: a button below the #people line that swaps between the editable
  // blocks and a preview. Everything it adds sits outside the blocks, and it only
  // shows or hides whole blocks, so Squarespace never saves any of it.
  function editorPreview(body, startP, endP) {
    var startBlock = startP.closest('.sqs-block'), endBlock = endP.closest('.sqs-block');
    // The button and preview go straight after the block holding the #people line,
    // so any intro text earlier in that block stays above them, as on the live page.
    if (!startBlock || !startBlock.parentNode || startBlock.nextElementSibling && startBlock.nextElementSibling.classList.contains('pe-people-toggle')) return;
    var preview = null, hidden = [], markers = [];
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pe-people-toggle';
    btn.textContent = 'Preview people section';

    // Back to editing: remove the preview and show everything exactly as it was
    function exit() {
      if (!preview) return;
      preview.remove(); preview = null;
      hidden.forEach(function (b) { b.style.display = ''; }); hidden = [];
      markers.forEach(function (m) { m.style.display = ''; if (!m.getAttribute('style')) m.removeAttribute('style'); }); markers = [];
      btn.textContent = 'Preview people section';
    }

    function enter() {
      preview = build(body, startP, endP, true);
      if (!preview) { btn.textContent = 'No photos found between #people and #end people'; return; }
      styles();
      [].forEach.call(body.querySelectorAll('.sqs-block'), function (b) {
        if (between(b, startBlock, endBlock || endP)) { b.style.display = 'none'; hidden.push(b); }
      });
      // "#end people" is often typed at the end of the last person's text block. When
      // nothing follows it in that block, hide the whole block too, or the last
      // person's text shows twice (once in the preview, once below it).
      if (endBlock && endBlock !== startBlock && !textAfter(endP, endBlock)) { endBlock.style.display = 'none'; hidden.push(endBlock); }
      // The two marker lines disappear too, so the preview reads as the finished page.
      // They sit inside text blocks, so they are only hidden while previewing, and any
      // click into one of those blocks ends the preview first (see guard below).
      [startP, endP].forEach(function (m) {
        if (m.style.display !== 'none') { m.style.display = 'none'; markers.push(m); }
      });
      startBlock.parentNode.insertBefore(preview, btn.nextSibling);
      btn.textContent = 'Back to editing';
    }

    btn.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      if (preview) exit(); else enter();
    });

    // Guard: clicking or tabbing into a block that holds a hidden marker line returns to
    // editing before Squarespace's own editor sees the click, so the hiding can never be
    // saved into the article along with someone's typing.
    function guard(e) {
      if (!preview || !e.target || !e.target.closest) return;
      var blk = e.target.closest('.sqs-block');
      if (blk && (blk === startBlock || blk === endBlock)) exit();
    }
    document.addEventListener('mousedown', guard, true);
    document.addEventListener('focusin', guard, true);
    document.addEventListener('keydown', function (e) { if (preview && e.key === 'Escape') exit(); }, true);

    startBlock.parentNode.insertBefore(btn, startBlock.nextSibling);
    styles();
  }

  function run() {
    var body = document.querySelector('body.view-item article.hentry .body.entry-content');
    if (!body || (!inEditor && body.querySelector('.pe-people'))) return;
    var lines = [].filter.call(body.querySelectorAll('p'), function (p) { return !p.closest('.pe-people'); });
    var startP = null;
    lines.forEach(function (p) {
      var t = text(p);
      if (END.test(t)) {
        if (startP) {
          try { if (inEditor) editorPreview(body, startP, p); else build(body, startP, p); }
          catch (e) { if (window.console) console.warn('PE people section', e); }
        }
        startP = null;
      } else if (START.test(t) && !END.test(t)) {
        startP = p;
      }
    });
  }

  run();
  if (inEditor) setTimeout(run, 1500);                                  // the editor can draw the blocks late
  addEventListener('mercury:load', function () { setTimeout(run, 50); });
})();
} catch (e) { if (window.console) console.warn('Production Expert script failed: people section', e); }

/* ================================================================
 * Production Expert: placement for the top-of-article boxes
 * Puts the partner label, read time badge and contents box in one fixed order:
 * - If the article body opens with a hero image (with or without short notes above it),
 *   the boxes go directly beneath that image.
 * - If the hero sits outside the body (promoted posts), they stay at the top of the body.
 * Only a full-width image counts as the hero. Small, floated or side-by-side images
 * (a contributor headshot beside their bio, say) are skipped, so the boxes never wrap
 * around them. Fixed 27 Oct 2026 after the boxes landed beside a floated headshot.
 * ================================================================ */
try {
(function () {
  var ORDER = ['.pe-partner-label', '.pe-badge', '.pe-contents'];
  var LOOKAHEAD = 6;      // how many blocks from the top to search for the hero image
  var MIN_WIDTH = 0.6;    // a hero must fill at least 60% of the article column
  var NOTE_CHARS = 350;   // a text block longer than this is the article itself, not a note

  // True when an image block is floated (Squarespace's "float left/right" image layout)
  function floated(b) {
    if (/\bfloat\b/.test(b.className)) return true;
    var f = getComputedStyle(b).float;
    if (f && f !== 'none') return true;
    var inner = b.querySelector('.image-block-outer-wrapper, figure, .sqs-image');
    return !!(inner && getComputedStyle(inner).float !== 'none');
  }

  // True when the block (or row) is wide enough to be a hero.
  // If the page hasn't laid out yet (width 0), give it the benefit of the doubt.
  function wide(node, layout) {
    var w = node.getBoundingClientRect().width, full = layout.getBoundingClientRect().width;
    return !w || !full || w / full >= MIN_WIDTH;
  }

  function isImage(b) { return /\b(image-block|gallery-block)\b/.test(b.className); }

  function hero(body) {
    var layout = body.querySelector('.sqs-layout');
    if (!layout) return null;
    var blocks = layout.querySelectorAll('.sqs-block');
    for (var i = 0; i < blocks.length && i < LOOKAHEAD; i++) {
      var b = blocks[i];
      if (b.querySelector('h2, h3')) return null;                       // reached the article proper
      if (!isImage(b)) {
        // Long text before any hero means the article has started: keep the boxes at the top
        if (b.textContent.replace(/\s+/g, ' ').trim().length > NOTE_CHARS) return null;
        continue;
      }
      if (floated(b)) continue;                                         // headshot or inline picture, not a hero
      var row = b.closest('.row');
      var cols = row ? row.querySelectorAll(':scope > .col') : [];
      if (cols.length > 1) {
        // A multi-column row only counts if every column is an image (a side-by-side hero).
        // A picture beside text is a bio or illustration, so keep looking.
        var allImages = [].every.call(cols, function (c) {
          var inC = c.querySelectorAll('.sqs-block');
          return inC.length && [].every.call(inC, isImage);
        });
        if (allImages && wide(row, layout)) return row;
        continue;
      }
      if (wide(b, layout)) return b;
    }
    return null;
  }

  function run() {
    var body = document.querySelector('body.view-item article.hentry .body.entry-content');
    if (!body) return;
    var items = [];
    ORDER.forEach(function (sel) {
      var el = body.querySelector(sel);
      if (el) items.push(el);
    });
    if (!items.length) return;

    // Belt and braces: never let any of the boxes wrap around a floated image
    items.forEach(function (el) { el.style.clear = 'both'; });

    var anchor = hero(body);
    var parent = anchor ? anchor.parentNode : body;
    var ref = anchor ? anchor.nextSibling : body.firstChild;

    // Already in place and in order? Leave the page alone.
    var ok = true, n = ref;
    for (var i = 0; i < items.length; i++) {
      if (n !== items[i]) { ok = false; break; }
      n = n.nextSibling;
    }
    if (ok) return;

    // Inside a column, line the boxes up with the edges of the blocks around them
    var pad = anchor ? getComputedStyle(anchor).paddingLeft : '';
    items.forEach(function (el) {
      el.style.marginLeft = el.style.marginRight = anchor ? pad : '';
      parent.insertBefore(el, ref);
    });
  }

  run();
  setTimeout(run, 500);
  setTimeout(run, 1500);
  addEventListener('load', run);
  addEventListener('mercury:load', function () { setTimeout(run, 100); });
})();
} catch (e) { if (window.console) console.warn('Production Expert script failed: placement for the top-of-article boxes', e); }
