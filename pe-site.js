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
 * Production Expert: byline reads "By <name>" (v6.4, 11 Nov 2026)
 * Squarespace prints "Posted by <name>" under the date on every article. This trims it to
 * "By <name>". Only the loose words before the name are touched: the author link itself is
 * left alone, so the author bio, author photo and useful vote, which all read the name from
 * that link, carry on as before. Blog list pages are untouched.
 * ================================================================ */
try {
(function () {
  function shortenByline() {
    var spans = document.querySelectorAll('article.hentry .sidebar .author, article.hentry address .author');
    spans.forEach(function (span) {
      if (span.dataset.peBy) return;                      // already done on this page
      // Walk the span's own text pieces (not the link inside it) and swap the wording
      for (var n = span.firstChild; n; n = n.nextSibling) {
        if (n.nodeType === 3 && /posted\s+by/i.test(n.nodeValue)) {
          n.nodeValue = n.nodeValue.replace(/posted\s+by/i, 'By');
          span.dataset.peBy = '1';
          break;
        }
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', shortenByline);
  else shortenByline();
  window.addEventListener('mercury:load', shortenByline); // Ajax page loads
})();
} catch (e) { if (window.console) console.warn('Production Expert script failed: byline', e); }

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

  /* Author photo in a circle under "Posted by" in the date column (v2.2, 30 Oct 2026).
   * Same photo as the bio panel. Tablets and desktops only: on phones that column drops
   * to the bottom of the page, below the comments, so the photo is hidden there.
   * The column itself is centred by Custom CSS. Writers with no photo, and the generic
   * "Production Expert" byline, get no circle. */
  var PHOTO_CSS =
    '.pe-author-photo{display:none}' +
    '@media (min-width:641px){' +
      '.pe-author-photo{display:block;width:120px;height:120px;margin:18px auto 0;border-radius:50%;overflow:hidden;background:#f4f6f8}' +
      '.pe-author-photo img{display:block;width:100%;height:100%;object-fit:cover}' +
      'html.pe-dark .pe-author-photo{background:#26292e}' +
    '}';

  function addPhoto(bio) {
    if (!bio.img || document.querySelector('.pe-author-photo')) return;
    if (norm(bio.name) === 'production expert') return;   // the house byline (news) gets no photo
    var byline = document.querySelector('article.hentry > .sidebar address') ||
                 document.querySelector('article.hentry > .sidebar .author');
    if (!byline) return;
    if (!document.getElementById('pe-author-photo-css')) {
      var st = document.createElement('style');
      st.id = 'pe-author-photo-css';
      st.textContent = PHOTO_CSS;
      document.head.appendChild(st);
    }
    var link = byline.querySelector('a[href*="?author="]');
    var box = document.createElement(link ? 'a' : 'div');
    box.className = 'pe-author-photo';
    if (link) { box.href = link.getAttribute('href'); box.setAttribute('aria-label', 'More from ' + bio.name); }
    var img = document.createElement('img');
    img.src = bio.img.split('?')[0] + '?format=300w';   // small copy, enough for a 120px circle
    img.alt = bio.name;
    img.loading = 'lazy';
    box.appendChild(img);
    byline.parentNode.insertBefore(box, byline.nextSibling);
  }

  /* Phone byline under the headline (v9.8, 25 Nov 2026). A reader asked for it: on a phone the
   * "Posted by" column and photo sit at the very bottom of the page, so you only learn who wrote
   * a personal piece after reading it. This adds a small line at the top of the article body, on
   * phones only: round photo (40px), "By <name>" linking to their other articles, and the date.
   * The placement section at the end of this file puts it first, above the partner label, read
   * time and contents box. No photo for writers without one; nothing at all for the generic
   * "Production Expert" byline. Tablets and desktops are untouched (hidden there). */
  var BYLINE_CSS =
    '.pe-byline{display:none}' +
    '@media (max-width:640px){' +
      'html .pe-byline.pe-ui{display:flex;align-items:center;gap:12px;clear:both;margin:14px 0 18px;padding:4px 0 14px!important;background:none!important;border:0!important;border-bottom:1px solid #e3e3e6!important;border-radius:0!important;box-shadow:none!important;font-family:"Open Sans",sans-serif;font-size:13px;line-height:1.4;color:#6b6b70}' +
      '.pe-byline-photo{flex:0 0 40px;width:40px;height:40px;border-radius:50%;overflow:hidden;background:#f4f6f8;display:block}' +
      '.pe-byline-photo img{display:block;width:100%;height:100%;object-fit:cover}' +
      '.pe-byline-text{min-width:0}' +
      'html .pe-byline .pe-byline-name{display:block;font-size:14px;color:#222!important;font-weight:700;text-decoration:none}' +
      'html .pe-byline .pe-byline-date{display:block;font-size:12px;color:inherit!important}' +
      'html.pe-dark .pe-byline.pe-ui,body.pe-dark .pe-byline.pe-ui{color:#a9adb3!important;border-bottom-color:#2a2c31!important}' +
      'html.pe-dark .pe-byline.pe-ui .pe-byline-name,body.pe-dark .pe-byline.pe-ui .pe-byline-name{color:#e8e8e8!important}' +
      'html.pe-dark .pe-byline-photo,body.pe-dark .pe-byline-photo{background:#26292e}' +
    '}';

  function addMobileByline(bio, author) {
    if (document.querySelector('.pe-byline')) return;
    var name = (bio && bio.name) || author;
    if (!name || norm(name) === 'production expert') return;
    var body = document.querySelector('body.view-item article.hentry .body.entry-content');
    if (!body) return;
    if (!document.getElementById('pe-byline-css')) {
      var st = document.createElement('style');
      st.id = 'pe-byline-css';
      st.textContent = BYLINE_CSS;
      document.head.appendChild(st);
    }
    var link = document.querySelector('article.hentry a[href*="?author="]');
    var href = link ? link.getAttribute('href') : (bio && bio.url) || '';
    var t = document.querySelector('article.hentry time');
    var date = t ? t.textContent.replace(/\s+/g, ' ').trim() : '';
    var iso = t && t.getAttribute('datetime'), dm = iso && iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (dm) date = ['January','February','March','April','May','June','July','August','September','October','November','December'][+dm[2] - 1] + ' ' + (+dm[3]) + ', ' + dm[1];   // same format as the date section

    var box = document.createElement('div');
    box.className = 'pe-byline pe-ui';
    if (bio && bio.img) {
      var pic = document.createElement(href ? 'a' : 'span');
      pic.className = 'pe-byline-photo';
      if (href) { pic.href = href; pic.setAttribute('aria-label', 'More from ' + name); }
      var img = document.createElement('img');
      img.src = bio.img.split('?')[0] + '?format=100w';   // tiny copy, enough for a 40px circle
      img.alt = name;
      pic.appendChild(img);
      box.appendChild(pic);
    }
    var text = document.createElement('div');
    text.className = 'pe-byline-text';
    var by = document.createElement(href ? 'a' : 'span');
    by.className = 'pe-byline-name';
    if (href) by.href = href;
    by.textContent = 'By ' + name;
    text.appendChild(by);
    if (date) {
      var d = document.createElement('span');
      d.className = 'pe-byline-date';
      d.textContent = date;
      text.appendChild(d);
    }
    box.appendChild(text);
    body.insertBefore(box, body.firstChild);   // the placement section moves it into its final spot
    window.dispatchEvent(new Event('pe-byline-ready'));
  }

  function run() {
    if (!isArticlePage()) { log('not an article page'); return; }

    var article = document.querySelector('article') || document;
    // A hand-made bio in the article: keep it, but still add the photo by the byline
    var manual = !!article.querySelector('a[href*="' + BIOS_PATH + '/"]');
    if (manual) log('manual bio present, panel skipped');

    var author = findAuthor();
    log('author:', author || '(none)');
    if (!author || SKIP.indexOf(norm(author)) !== -1) return;

    loadAllBios().then(function (bios) {
      var bio = findBio(bios, author);
      if (!bio) { log('no bio found for', author); addMobileByline(null, author); return; }
      addPhoto(bio);
      addMobileByline(bio, author);
      if (manual || document.querySelector('.pe-author-bio')) return;
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
    ignoreTags: ['partner', 'no-contents', 'hero'],   // 'hero' (v4.9): the homepage hero tag says nothing about subject
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

  // v7.8: dark mode gives every .pe-ui section a dark box with a border (html.pe-dark .pe-ui in the Header),
  // but this section had no padding, so the heading and cards sat hard against the border. This adds the
  // padding only when that box is drawn; light mode has no box, so it stays flush with the article.
  function css() {
    if (document.getElementById('pe-related-css')) return;
    var st = document.createElement('style');
    st.id = 'pe-related-css';
    st.textContent =
      'html.pe-dark .pe-ui.pe-related,body.pe-dark .pe-ui.pe-related{padding:24px 28px 28px!important;border-radius:6px!important}' +
      '@media (max-width:640px){html.pe-dark .pe-ui.pe-related,body.pe-dark .pe-ui.pe-related{padding:18px 16px 20px!important}}';
    document.head.appendChild(st);
  }

  function build(items, a) {
    css();
    var ref = a.querySelector('.body.entry-content h3');
    var cs = ref ? getComputedStyle(ref) : null;

    var sec = document.createElement('section');
    sec.className = 'pe-ui pe-related';
    sec.setAttribute('aria-label', C.heading);
    sec.style.cssText = 'margin:40px 0 24px;';

    var h = document.createElement('h3');
    h.textContent = C.heading;
    h.style.cssText = 'margin:0 0 16px;';
    // Copy the article's H3 font, weight and size so the heading matches the page.
    // v7.8: the colour is no longer copied. Copied while the page was in dark mode it stayed light grey after
    // switching to light mode. It now uses the same dark ink as the card titles, and the dark mode rule
    // (html.pe-dark .pe-ui *) turns it light when dark mode is on.
    h.style.color = C.ink;
    if (cs) { h.style.fontFamily = cs.fontFamily; h.style.fontWeight = cs.fontWeight; h.style.fontSize = cs.fontSize; }
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
    // Disqus until Nov 2026, Hyvor Talk since (v6.3): whichever this page has
    var t = document.getElementById('disqus_thread') ||
            document.querySelector('hyvor-talk-comments, #hyvor-talk-view, .hyvor-talk-comments');
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
  // Hyvor can arrive after the page is built (v6.3): look again a little later
  addEventListener('load', go);
  setTimeout(go, 2500);
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
 * OFF sitewide since 11 Nov 2026 (v6.2): set SIGNUP_ON to true below to bring it back.
 * ================================================================ */
try {
(function () {
  // Switch: false keeps the box off every article (turned off 11 Nov 2026, it broke the SSL article layout).
  // Set back to true to bring it back.
  var SIGNUP_ON = false;
  if (!SIGNUP_ON) return;
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
 * Production Expert: pre-publish checklist loader (v9.0, 23 Nov 2026)
 * The team's checklist, Joe and the panel (about 5,000 lines) live in pe-checklist.min.js,
 * in the same GitHub Pages folder as this file. Readers never see them, so readers no longer
 * download or run them: this loader fetches the file only for the team. "Team" is the same test
 * the checklist applies to itself: a signed-in Squarespace account, the Squarespace editor, or a
 * browser switched on once with ?checklist on the end of any post's address.
 * - Loads once per page, without holding up anything else. If the file can't be fetched the
 *   rest of the site is untouched and the console says so.
 * - Roll back to v8.9 (33d84d7) and the checklist is inline again.
 * ================================================================ */
try {
(function () {
  var URL = 'https://russhughes77.github.io/pe-site-scripts/pe-checklist.min.js';
  function ls(k, v) {
    try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; }
  }
  function isTeam() {
    if (/[?&]checklist\b/.test(location.search)) ls('pe-team', '1');
    var ctx = (window.Static && Static.SQUARESPACE_CONTEXT) || {};
    var inEditor = false;
    try { inEditor = (window.top !== window && !window.PE_FC_PREVIEW); } catch (e) { inEditor = true; }
    return !!ctx.authenticatedAccount || inEditor || ls('pe-team') === '1';
  }
  if (window.peChecklistLoading || !isTeam()) return;
  window.peChecklistLoading = true;
  var s = document.createElement('script');
  s.src = URL;
  s.async = true;
  s.onerror = function () { try { console.warn('Production Expert: the checklist file could not be loaded', URL); } catch (e) {} };
  (document.head || document.documentElement).appendChild(s);
})();
} catch (e) { if (window.console) console.warn('Production Expert script failed: checklist loader', e); }


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
  try { inEditor = (window.top !== window && !window.PE_FC_PREVIEW); } catch (e) { inEditor = true; }
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
  try { inEditor = (window.top !== window && !window.PE_FC_PREVIEW); } catch (e) { inEditor = true; }

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
 * Production Expert: homepage banners in the article grid (v2.0, 30 Oct 2026;
 * began as v1.8/v1.9 "ad after the first six articles")
 * On desktops (rows of three) a banner after every 9 articles; on tablets
 * (rows of two) after every 8, so each banner lands on a clean row break.
 * The first is the existing ad from under the hero, moved down; the rest are
 * new placeholders the ad server fills from the same zone.
 * No banner goes within 4 articles of the end of the grid, because a manual
 * banner already sits just below it (after "Older articles archive"); with 30
 * articles that means banners after 9 and 18 on desktop, 8, 16 and 24 on tablet.
 * Phones (640px and under, one article per row) get the one banner only, after the
 * third article (v9.6, 24 Nov 2026; before that it stayed under the hero). Just below
 * the first screen it no longer competes with the hero picture for bandwidth, and a
 * banner that loads late can't push visible content down. No extra banners are added.
 * The ad is found by the ad server's placeholder (.antur-ad), since the banner
 * itself loads after this runs. If the hero, the ad or the grid is missing, the
 * page is left untouched.
 * ================================================================ */
try {
(function () {
  var PHONE = '(max-width: 640px)';  // same width the homepage hero CSS uses for phones
  var EVERY = { 3: 9, 2: 8 };        // articles per banner, by articles per row
  var CLEAR_OF_END = 4;              // no banner this close to the end of the grid
  var PHONE_AFTER = 3;               // v9.6: on phones the one banner sits after this many articles, just below the first screen
  var SLOT_CSS = 'clear:both;float:none;width:100%;padding:8px 0 calc(0.877193% + 8px);';

  if (!document.body || !document.body.classList.contains('homepage')) return;
  try { if ((window.top !== window && !window.PE_FC_PREVIEW)) return; } catch (e) { return; }   // leave the editor alone

  var ad, home, list, zone, slots = [];

  function find() {
    var hero = document.querySelector('#container-content .sqs-block-gallery');
    if (!hero) return false;
    var next = hero.nextElementSibling;
    if (!next || !next.classList.contains('sqs-block-embed')) return false;
    var ph = next.querySelector('.antur-ad');
    if (!ph && !next.querySelector('a[href], iframe, img')) return false;
    list = document.querySelector('#container-content .sqs-block-summary-v2 .summary-item-list');
    if (!list) return false;
    ad = next;
    zone = (ph && ph.getAttribute('data-zone')) || 'pe-leaderboard';
    // A marker where the ad came from, so it can go back on phones
    home = document.createElement('div');
    home.className = 'pe-ad-home';
    home.style.display = 'none';
    ad.parentNode.insertBefore(home, ad);
    return true;
  }

  function articles() {
    return Array.prototype.slice.call(list.querySelectorAll(':scope > .summary-item'));
  }

  // Articles per row, measured from the layout rather than guessed from the width
  function perRow(items) {
    if (items.length < 2) return 1;
    var top = Math.round(items[0].getBoundingClientRect().top), n = 1;
    while (n < items.length && Math.round(items[n].getBoundingClientRect().top) === top) n++;
    return n;
  }

  function makeSlot(i) {
    var slot = document.createElement('div');
    slot.className = 'pe-ad-slot';
    slot.style.cssText = SLOT_CSS;
    if (i > 0) {
      // A fresh placeholder for the ad server, same zone as the moved ad
      slot.innerHTML = '<div class="sqs-block-content"><div class="antur-ad" data-zone="' + zone +
        '" style="max-width:1140px;margin:0 auto;"></div></div>';
    }
    return slot;
  }

  function putAdHome() {
    if (ad.previousSibling !== home) home.parentNode.insertBefore(ad, home.nextSibling);
    ad.style.padding = '';
    ad.style.margin = '';
  }

  function place() {
    if (!ad) return;
    var phone = window.matchMedia && window.matchMedia(PHONE).matches;
    var items = articles();
    var every = phone ? 0 : EVERY[perRow(items)];
    // Where the banners go: after article 9, 18 ... (or 8, 16 ...), clear of the end
    var after = [];
    if (every) for (var n = every; n <= items.length - CLEAR_OF_END; n += every) after.push(n);
    // v9.6: phones get the single banner after article 3, below the first screen, so it no longer
    // competes with the hero picture for the phone's bandwidth. A grid too short for that leaves it under the hero.
    if (phone && items.length >= PHONE_AFTER + CLEAR_OF_END) after = [PHONE_AFTER];

    if (!after.length) {
      // A grid too short: ad back under the hero, added banners hidden
      putAdHome();
      slots.forEach(function (s) { s.style.display = 'none'; });
      return;
    }
    var added = false;
    after.forEach(function (n, i) {
      if (!slots[i]) { slots[i] = makeSlot(i); added = added || i > 0; }
      var slot = slots[i];
      slot.style.display = '';
      if (items[n - 1].nextSibling !== slot) items[n - 1].parentNode.insertBefore(slot, items[n - 1].nextSibling);
    });
    // Any slots beyond what this layout needs are hidden
    for (var j = after.length; j < slots.length; j++) slots[j].style.display = 'none';
    // The first slot holds the moved ad
    if (ad.parentNode !== slots[0]) slots[0].appendChild(ad);
    ad.style.padding = '0';
    ad.style.margin = '0';
    // Ask the ad server to fill any new placeholders (if its script has loaded;
    // if not, it fills them itself when it does)
    if (added && window.AnturAd && typeof window.AnturAd.init === 'function') {
      try { window.AnturAd.init(); } catch (e) {}
    }
  }

  function run() {
    if (!ad && !find()) return;
    place();
  }

  run();
  document.addEventListener('DOMContentLoaded', run);
  addEventListener('load', run);
  // Re-place when the grid changes shape (window resized, tablet turned). Squarespace
  // re-flows the rows on resize, so wait for it to finish first.
  var timer;
  addEventListener('resize', function () {
    clearTimeout(timer);
    timer = setTimeout(place, 250);
  });
})();
} catch (e) { if (window.console) console.warn('Production Expert script failed: homepage banners in the article grid', e); }

/* ================================================================
 * Production Expert: NEWS, FREE, DEAL and REVIEW labels on homepage cards
 * (NEWS v2.2/v2.3, 30 Oct 2026; FREE and DEAL added v2.5, 31 Oct 2026; REVIEW v5.0, 5 Nov 2026)
 * Puts a small orange label (Production Expert orange, #E87722) in the top-left
 * corner of the picture on homepage cards. Homepage only.
 *   FREE  anything in a Free / Free Plugins / Freebies category or tag
 *   DEAL  every post in the Partner Deals blog (/partner-deals), plus anything in a
 *         Deal / Deals / Partner Deals category or tag in the main blog (v2.6).
 *         From the day after a deal ends, it loses the DEAL label (v2.7). The end date
 *         comes from, in order: an ends-2026-11-30 tag, the post's #expires or
 *         #offer ends line, or "Ends 29th October" in the title. No date, no change.
 *   REVIEW  anything with the word "review" in any of its categories or tags (v5.0):
 *         Review, Reviews, Expert Review, Plugin Reviews and so on. "Preview" doesn't
 *         count, and nor does "Year In Review" (or Month / Week In Review), which are
 *         round-ups, not reviews. Found two ways: the newest 60 posts in the main blog
 *         are checked tag by tag, and the usual names are also looked up directly so
 *         older reviews in the lists further down the homepage get labelled too.
 *   UPDATED  anything tagged Updated (v6.0, 11 Nov 2026): an older article that has been
 *         properly refreshed. The team adds the tag when a refresh goes back up; the article
 *         page then shows "Updated <date>" too (see "Updated label on refreshed articles").
 *   NEWS  anything in the News category or tagged News
 *   MOST READ  the three homepage stories with the most pageviews yesterday (v2.8).
 *         The numbers come from most-read.json beside this script, written each
 *         morning by the "Most read" job in this repo from Plausible. If the file
 *         is missing or empty, no MOST READ labels appear and nothing else changes.
 * One label per card. MOST READ wins, then FREE, then UPDATED, then DEAL, then REVIEW, then NEWS,
 * so a free plugin filed under News reads FREE, a review that's also tagged News
 * reads REVIEW, and a popular deal reads MOST READ.
 * The cards themselves don't say what an article is, so the lists come from the
 * site's own feeds. They are fetched after the page has loaded and kept in this
 * browser for an hour. A category or tag name that doesn't exist on the site
 * simply returns nothing, so the extra spellings cost nothing.
 * All homepage article lists are labelled, including the "Latest Music And Audio
 * Production News" section (v2.3); set SECTION_TOO to false for the main grid only.
 * Faster start (v9.3, 24 Nov 2026): the lists used to be read from the blog feeds in every
 *   visitor's browser, about 1 MB on a first visit. A GitHub job now reads them every 30 minutes and
 *   saves the answer in card-labels.json (scripts/card-labels.js, a copy of the lookups below), and
 *   the homepage reads that. If the file is missing, unreadable or older than 3 days, the feeds are
 *   read in the browser exactly as before. Roll back to v9.2 (09a5902).
 * ================================================================ */
try {
(function () {
  var SECTION_TOO = true;    // label the lists further down too (on since v2.3)
  var KEY = 'pe-card-labels-v60';   // renamed whenever the rules change so old cached lists are ignored
  var KEEP_MS = 60 * 60 * 1000;      // reuse the lists for an hour
  var BASE = '/production-expert-1?format=json&';
  var LISTS_URL = 'https://russhughes77.github.io/pe-site-scripts/card-labels.json';   // v9.3
  var LISTS_MAX_AGE = 3 * 864e5;     // older than this, the job is presumed stopped and the feeds are read here
  var MOST_READ = { text: 'Most Read', count: 3,
    url: 'https://russhughes77.github.io/pe-site-scripts/most-read.json' };

  // In priority order: the first label that matches wins.
  // names: categories or tags looked up in the main blog.
  // blogs: whole blogs where every post gets the label (Partner Deals lives in its own blog,
  // so the main blog's feed never sees those posts; that was the v2.5 bug).
  var LABELS = [
    { text: 'Free', names: ['Free', 'Free Plugins', 'Free Plugin', 'Freebies'] },
    // Updated (v6.0): a refreshed older article, tagged Updated by the team. After Free (Russ, 11 Nov 2026).
    { text: 'Updated', names: ['Updated'] },
    { text: 'Deal', names: ['Deal', 'Deals', 'Partner Deals'], blogs: ['/partner-deals'], dropEnded: true },
    // Review (v5.0). match: any category or tag that passes this test gets the label, whatever
    // it's called, so a new "Interface Reviews" tag works without touching this file. skip: names
    // that contain the word but aren't reviews. names: looked up directly as well, for older
    // reviews that have dropped out of the newest 60 posts but still show further down.
    { text: 'Review', names: ['Review', 'Reviews', 'Expert Review', 'Expert Reviews', 'Product Review', 'Product Reviews'],
      match: /\breview/i, skip: /\b(year|month|week)s?\s+in\s+review\b/i },
    { text: 'News', names: ['News'] }
  ];

  if (!document.body || !document.body.classList.contains('homepage')) return;
  try { if ((window.top !== window && !window.PE_FC_PREVIEW)) return; } catch (e) { return; }   // leave the editor alone

  var CSS =
    '.pe-news-card{position:relative;display:block}' +
    '.pe-news-badge{position:absolute;z-index:3;top:14px;left:14px;padding:6px 11px 5px;background:#e87722;color:#fff;' +
      "font-family:'Open Sans',sans-serif;font-weight:800;font-size:15px;line-height:1;letter-spacing:.12em;" +
      'text-transform:uppercase;border-radius:3px;box-shadow:0 1px 6px rgba(0,0,0,.25);pointer-events:none}' +
    '@media (max-width:640px){.pe-news-badge{top:12px;left:12px;font-size:14px}}';

  function path(u) {
    try { return new URL(u, location.origin).pathname.replace(/\/$/, ''); } catch (e) { return ''; }
  }

  function saved() {
    try {
      var o = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (o && o.t && Date.now() - o.t < KEEP_MS && o.m) return o;
    } catch (e) {}
    return null;
  }

  function getJson(url) {
    return fetch(url, { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : { items: [] }; })
      .catch(function () { return { items: [] }; });
  }
  // ---- Deal end dates (v2.7). Same sources as the offer-expiry script, read day first. ----
  var MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11 };
  function mon(w) { w = (w || '').toLowerCase(); return MONTHS[w.slice(0, 4)] !== undefined ? MONTHS[w.slice(0, 4)] : MONTHS[w.slice(0, 3)]; }

  // Reads "30/11/26", "30.11.2026", "30 November 2026", "30th Nov", "Nov 30th, 2026".
  // A missing year takes the publish year, or the next one if that would end before publication.
  function readDate(t, pub) {
    var m, d, mo, y;
    if ((m = /\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b/.exec(t))) {
      d = +m[1]; mo = +m[2] - 1; y = +m[3];
    } else if ((m = /\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([a-z]{3,9})\.?(?:,?\s+(\d{4}))?/i.exec(t)) && mon(m[2]) !== undefined) {
      d = +m[1]; mo = mon(m[2]); y = m[3] ? +m[3] : 0;
    } else if ((m = /\b([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?/i.exec(t)) && mon(m[1]) !== undefined) {
      d = +m[2]; mo = mon(m[1]); y = m[3] ? +m[3] : 0;
    } else return null;
    if (y && y < 100) y += 2000;
    if (!(d >= 1 && d <= 31 && mo >= 0 && mo <= 11)) return null;
    var p = pub ? new Date(pub) : new Date();
    if (!y) {
      y = p.getFullYear();
      if (new Date(y, mo, d) < new Date(p.getFullYear(), p.getMonth(), p.getDate())) y++;
    }
    return new Date(y, mo, d);
  }

  function endDate(i) {
    var k, m;
    var tags = i.tags || [];
    for (k = 0; k < tags.length; k++) {
      if ((m = /^ends-(\d{4})-(\d{2})-(\d{2})$/i.exec(tags[k]))) return new Date(+m[1], +m[2] - 1, +m[3]);
    }
    var body = String(i.body || '').replace(/<[^>]+>/g, '\n').replace(/&nbsp;/g, ' ');
    if ((m = /#(?:expires|offer\s+ends)\s*:?\s*([^\n]{1,40})/i.exec(body))) {
      var dt = readDate(m[1], i.publishOn);
      if (dt) return dt;
    }
    if ((m = /\bend(?:s|ing)?\s+(?:on\s+)?([^|]{3,30})/i.exec(i.title || ''))) return readDate(m[1], i.publishOn);
    return null;
  }

  // True from the day after the end date, in the reader's own time zone
  function hasEnded(i) {
    var e = endDate(i);
    if (!e) return false;
    var n = new Date();
    return e < new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }

  function urls(j) {
    return (j.items || []).map(function (i) {
      return i.fullUrl ? { p: path(i.fullUrl), ended: hasEnded(i) } : null;
    });
  }

  function feed(q) {
    return getJson(BASE + q).then(urls);
  }

  // A whole blog: its two newest pages (about 40 posts), which covers everything the homepage shows
  function blogFeed(b) {
    return getJson(b + '?format=json').then(function (j) {
      var first = urls(j);
      var next = j.pagination && j.pagination.nextPage && j.pagination.nextPageUrl;
      if (!next) return first;
      return getJson(next + (next.indexOf('?') < 0 ? '?' : '&') + 'format=json').then(function (j2) {
        return first.concat(urls(j2));
      });
    });
  }

  // The main blog's newest posts (3 pages, about 60), keeping those with a category or tag that
  // passes L.match and not L.skip. Each post in the feed lists its own categories and tags, so
  // this catches any spelling without knowing the names in advance (v5.0).
  function matchFeed(L) {
    var keep = function (j) {
      return (j.items || []).filter(function (i) {
        return (i.categories || []).concat(i.tags || []).some(function (n) {
          return L.match.test(n) && !(L.skip && L.skip.test(n));
        });
      }).map(function (i) { return i.fullUrl ? { p: path(i.fullUrl), ended: false } : null; });
    };
    function page(url, left) {
      return getJson(url).then(function (j) {
        var got = keep(j);
        var next = j.pagination && j.pagination.nextPage && j.pagination.nextPageUrl;
        if (!next || left <= 1) return got;
        return page(next + (next.indexOf('?') < 0 ? '?' : '&') + 'format=json', left - 1)
          .then(function (more) { return got.concat(more); });
      });
    }
    return page(BASE.replace(/&$/, ''), 3);
  }

  // Yesterday's pageviews by page, { "/article-path": 1234, ... }; {} when unavailable.
  // The date in the address changes daily so browsers never hold an old copy past the morning.
  function fetchReads() {
    var d = new Date().toISOString().slice(0, 10);
    return fetch(MOST_READ.url + '?d=' + d, { mode: 'cors', credentials: 'omit' })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .catch(function () { return {}; })
      .then(function (j) {
        var out = {};
        (j.pages || []).forEach(function (x) { if (x && x.p && x.v > 0) out[path(x.p).toLowerCase()] = x.v; });
        return out;
      });
  }

  // v9.3: the lists from card-labels.json, in the same shape as slowLists() gives: one array of
  // article paths per label, in LABELS order. A deal whose end date has passed (in this reader's
  // own time zone) is dropped, as before. Resolves to null when the file can't be used.
  function fastLists() {
    return fetch(LISTS_URL + '?d=' + new Date().toISOString().slice(0, 13), { mode: 'cors', credentials: 'omit' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j || !Array.isArray(j.labels)) return null;
        var made = Date.parse(j.generated);
        if (!made || Date.now() - made > LISTS_MAX_AGE) return null;
        var n = new Date(), today = new Date(n.getFullYear(), n.getMonth(), n.getDate());
        var out = [];
        for (var i = 0; i < LABELS.length; i++) {
          var L = LABELS[i], f = null;
          for (var k = 0; k < j.labels.length; k++) if (j.labels[k] && j.labels[k].text === L.text) f = j.labels[k];
          if (!f || !Array.isArray(f.items)) return null;
          out.push(f.items.filter(function (x) {
            if (!x || !x.p) return false;
            if (!(L.dropEnded && x.e)) return true;
            var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(x.e);
            return !(m && new Date(+m[1], +m[2] - 1, +m[3]) < today);
          }).map(function (x) { return x.p; }));
        }
        return out;
      })
      .catch(function () { return null; });
  }

  // Builds { m: { "/article-path": "Free", ... }, r: { "/article-path": views } }
  function fetchMap() {
    var reads = fetchReads();
    return fastLists().then(function (per) {
      return per ? build(per, reads) : slowLists().then(function (per2) { return build(per2, reads); });
    });
  }

  // The old way: read the blog feeds here (about 1 MB). Used when card-labels.json can't be.
  function slowLists() {
    return Promise.all(LABELS.map(function (L) {
      var qs = [];
      L.names.forEach(function (n) {
        var v = encodeURIComponent(n);
        qs.push('category=' + v, 'tag=' + v);
      });
      var jobs = qs.map(feed).concat((L.blogs || []).map(blogFeed));
      if (L.match) jobs.push(matchFeed(L));   // any category or tag containing the word (v5.0)
      return Promise.all(jobs).then(function (lists) {
        return [].concat.apply([], lists)
          .filter(function (x) { return x && !(L.dropEnded && x.ended); })
          .map(function (x) { return x.p; });
      });
    }));
  }

  function build(perLabel, reads) {
    var map = {};
    // Walk from lowest to highest priority so the higher label overwrites
    for (var i = LABELS.length - 1; i >= 0; i--) {
      perLabel[i].forEach(function (p) { if (p) map[p] = LABELS[i].text; });
    }
    return reads.then(function (r) {
      var data = { t: Date.now(), m: map, r: r };
      try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {}
      return data;
    });
  }

  // The homepage cards with the most reads yesterday: { "/article-path": true }
  function topRead(reads) {
    var seen = {}, ranked = [];
    lists().forEach(function (blk) {
      blk.querySelectorAll('.summary-item .summary-title a, .summary-item a.summary-title-link').forEach(function (a) {
        var p = path(a.getAttribute('href')), v = reads[p.toLowerCase()];
        if (!p || seen[p] || !v) return;
        seen[p] = 1;
        ranked.push({ p: p, v: v });
      });
    });
    ranked.sort(function (x, y) { return y.v - x.v; });
    var top = {};
    ranked.slice(0, MOST_READ.count).forEach(function (x) { top[x.p] = true; });
    return top;
  }

  // The homepage article lists to label: the first summary block (the main grid), plus
  // the rest only if SECTION_TOO is on
  function lists() {
    var blocks = document.querySelectorAll('#container-content .sqs-block-summary-v2');
    var out = [];
    for (var i = 0; i < blocks.length; i++) {
      if (!blocks[i].querySelector('.summary-item')) continue;           // skip empty blocks
      out.push(blocks[i]);
      if (!SECTION_TOO) break;
    }
    return out;
  }

  function label(data) {
    if (!data || !data.m) return;
    var map = data.m, top = topRead(data.r || {});
    if (!document.getElementById('pe-news-badge-css')) {
      var st = document.createElement('style');
      st.id = 'pe-news-badge-css';
      st.textContent = CSS;
      document.head.appendChild(st);
    }
    lists().forEach(function (blk) {
      blk.querySelectorAll('.summary-item').forEach(function (it) {
        var a = it.querySelector('.summary-title a, a.summary-title-link');
        var pic = it.querySelector('.summary-thumbnail-container');
        if (!a || !pic || pic.querySelector('.pe-news-badge')) return;
        var p = path(a.getAttribute('href'));
        var text = top[p] ? MOST_READ.text : map[p];
        if (!text) return;
        pic.classList.add('pe-news-card');
        var b = document.createElement('span');
        b.className = 'pe-news-badge pe-badge-' + text.toLowerCase().replace(/\s+/g, '-');
        b.textContent = text;
        pic.appendChild(b);
      });
    });
  }

  function start() {
    try { localStorage.removeItem('pe-news-urls'); } catch (e) {}   // old v2.2 store, no longer used
    var s = saved();
    if (s) { label(s); return; }
    fetchMap().then(label);
  }

  // Wait for the page to finish loading so the feeds never compete with it
  if (document.readyState === 'complete') setTimeout(start, 300);
  else addEventListener('load', function () { setTimeout(start, 300); });
})();
} catch (e) { if (window.console) console.warn('Production Expert script failed: NEWS, FREE, DEAL and REVIEW labels on homepage cards', e); }

/* ================================================================
 * Production Expert: homepage hero headline lined up with the grid (v4.2, 2 Nov 2026)
 * The homepage hero picture runs the full width of the window, but its
 * headline used to sit a fixed 30px from the window edge. On anything wider
 * than the page column that left it hanging out to the left of the article
 * pictures below. This keeps the headline's left edge on the same line as
 * the left edge of the article grid at every window width, and moves with it
 * as the window is resized.
 * It also stops the bottom of letters such as g, p and y being cut off on
 * the second line: the line spacing was tighter than the font needs and the
 * headline box hid anything below it.
 * - Every screen size. On phones the pictures run edge to edge, so the
 *   headline lines up with the card headlines and text instead (v4.3; it was
 *   16px from the screen edge, the text 30px).
 * - The descender fix applies at every size.
 * - Homepage only. Leaves the editor alone.
 * ================================================================ */
try {
(function () {
  var MIN_DESKTOP = 768;              // px; the wider headline (85% of the column) from here up

  function isHome() { return document.body && document.body.classList.contains('homepage'); }
  if ((window.top !== window && !window.PE_FC_PREVIEW)) return;  // the Squarespace editor

  // The styles. --pe-hero-left is measured below; until it is, the fallback
  // works out the same edge from the 1200px page and its 30px padding.
  var CSS =
    'body.homepage .sqs-block-gallery .meta .meta-title{' +
      'line-height:1.2 !important;padding-bottom:0.14em !important;margin-bottom:-0.14em !important;}' +
    // Every screen size (phones added in v4.3): the headline's left edge on the grid's edge
    'body.homepage .sqs-block-gallery .meta{' +
      'left:var(--pe-hero-left, calc(max(0px, (100% - 1200px) / 2) + 30px)) !important;' +
      'right:var(--pe-hero-left, calc(max(0px, (100% - 1200px) / 2) + 30px)) !important;' +
      'width:auto !important;max-width:none !important;}' +
    '@media (min-width:' + MIN_DESKTOP + 'px){' +
      // Headline up to 85% of the column (was two-thirds of the window), so
      // headlines that used to break over two lines still do.
      'body.homepage .sqs-block-gallery .meta .meta-inside{max-width:85% !important;}' +
    '}';

  function addStyle() {
    if (document.getElementById('pe-hero-align-css')) return;
    var st = document.createElement('style');
    st.id = 'pe-hero-align-css';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  // Measure where the article grid starts, relative to the full-width hero, and
  // hand that to the styles above. The hero block is used rather than each slide,
  // because slides that aren't showing are moved off to the side.
  function measure() {
    if (!isHome()) return;
    var hero = document.querySelector('.sqs-block-gallery');
    var col = document.querySelector('#container-content .sqs-layout');
    if (!hero || !col) return;
    var h = hero.getBoundingClientRect();
    var left = Math.round(col.getBoundingClientRect().left - h.left);
    if (left >= 0 && left < h.width / 2) {
      document.documentElement.style.setProperty('--pe-hero-left', left + 'px');
    }
  }

  var queued = false;
  function onResize() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; measure(); });
  }

  function run() {
    if (!isHome()) return;
    addStyle();
    measure();
    setTimeout(measure, 600);         // again once the gallery has finished laying out
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
  addEventListener('load', measure);
  addEventListener('resize', onResize);
  addEventListener('mercury:load', run);
})();
} catch (e) { if (window.console) console.warn('Production Expert script failed: homepage hero headline alignment', e); }

/* ================================================================
 * Production Expert: homepage hero, hand-made slides plus the "Hero" tag
 * (v4.9, 4 Nov 2026; hand-made slides kept from v7.3, 12 Nov 2026)
 * The slideshow at the top of the homepage plays two kinds of slide:
 * - Hand-made: every slide in the Front Page Heroes gallery
 *   (/front-page-heroes), in the order they sit in the gallery. These play
 *   first, exactly as made: picture, headline and link. Nothing is checked
 *   or skipped, so they look the way they were set up.
 * - Tagged: the five newest articles tagged "Hero", newest first, after the
 *   hand-made ones. Each new one pushes the oldest off, so nobody has to
 *   remove old tags. An article already in the gallery isn't shown twice.
 * How it fits: the gallery has as many slides as it has hand-made ones, so
 *   when there are more slides to play than that, the script swaps the next
 *   slide's picture, headline and link while it is hidden, and the
 *   slideshow carries on through the whole list (arrows work both ways).
 *   Before v7.3 the tagged articles were painted over the hand-made slides,
 *   so those never showed.
 * - Tagged pictures: the article's own hero (its promoted image, or the first
 *   image in the body), falling back to the Featured Image on the Options
 *   tab, cropped to the slideshow's shape around the picture's focal point.
 *   Move the focal point dot on the hero image to change the crop.
 * - Sharpness: a tagged picture under 1500px wide would look soft at full
 *   width, so that article is skipped and the next tagged one is used. The
 *   pre-publish checks warn when a Hero-tagged article's picture is too small.
 * - Order of tagged articles goes by publish date, not by when the tag was
 *   added, so tagging an old article only gets it in if it is newer than the
 *   fifth tagged one.
 * - If the tag feed fails, the hand-made slides play on their own.
 * - The tag stays hidden from readers and out of Related Content (both
 *   handled by their own sections).
 * - Placeholder slides (v8.3): a gallery slide titled "Placeholder" (any
 *   capitals), or whose picture's file name has "placeholder" in it, is never
 *   shown as itself. It is only a blank slide for the tagged articles to play on. Squarespace draws no slideshow from an empty
 *   gallery, so with no hand-made slides the tagged ones had nowhere to go.
 *   Each needs a click-through link (any, / will do). With fewer tagged
 *   articles than placeholders, the tagged ones repeat to fill them.
 * - One-slide gallery (v8.4): Squarespace never moves on from a single slide,
 *   so the script plays the list on it itself (every oneSlideEvery ms) and
 *   works the arrows. A slide with no title gets a headline box made for it.
 * - Testing: add ?pe-hero-tag=News to the homepage address to fill the tagged
 *   part from another tag. Only that browser tab sees it.
 * - Homepage only. Leaves the editor alone.
 * - Faster start (v9.1, 24 Nov 2026): the tagged list is read from heroes.json, a short file
 *   a GitHub job rewrites every 30 minutes (scripts/heroes.py), instead of the whole blog feed.
 *   The request starts as soon as this section runs, and on a first visit the hand-made
 *   slides are painted at once rather than after the list arrives. If heroes.json is missing,
 *   broken or older than 3 days, the blog feed is used exactly as before. Roll back to v9.0 (808acba).
 * - Lean pictures (v9.2, 24 Nov 2026): the same job saves a compressed WebP copy of each tagged
 *   article's picture (heroes/, three widths) and the hero uses it in place of the original, which
 *   can be a heavy PNG (PageSpeed: 222 KiB saveable on one). If a copy is missing or fails to load,
 *   the original is used. Hand-made slides keep their own pictures. Roll back to v9.1 (a540acd).
 * - Link name (v9.4, 24 Nov 2026): each slide's link is given the headline as its accessible name,
 *   because the picture is a hidden image plus a CSS background and left the link with no text
 *   for screen readers and AI agents. Looks the same. Roll back to v9.3 (fd8bbda).
 * - Instant first picture (v9.5, 24 Nov 2026): the first picture a slide shows appears at once instead
 *   of fading in over 0.4 seconds, which held back the page's largest paint. Later changes still fade.
 *   Roll back to v9.4 (6be8e6e).
 * - Hidden on phones (v9.7, 24 Nov 2026): on a phone the hero looked like any other story and could
 *   show the same one for days, so it is hidden at 640px and under and does no work there (no list,
 *   no pictures). Tablets and desktops are unchanged. C.phoneHide: false brings it back. The Header
 *   box also hides it in CSS so it never flashes. Roll back to v9.6 (979cf4d).
 * ================================================================ */
try {
(function () {
  var C = {
    tag: 'Hero',                      // the tag that puts an article in the hero (any capitals)
    max: 5,                           // tagged articles to add after the hand-made slides
    manualFirst: true,                // true: hand-made slides first, then tagged. false: tagged first
    blog: '/production-expert-1',     // the blog the tagged articles come from
    minWidth: 1500,                   // px; narrower tagged pictures are skipped (same number in the checks)
    swapDelay: 1500,                  // ms after a slide change before the hidden slides are swapped, so a
                                      // slide is never changed while it is still fading out
    oneSlideEvery: 6000,              // ms between slides when the gallery has only one slide
    key: 'pe-hero-v2',                // this browser's copy of the last tagged list, for an instant start
    json: 'https://russhughes77.github.io/pe-site-scripts/heroes.json',   // v9.1: the short list a daily job keeps
    jsonMaxAgeDays: 3,                // older than this, the job is presumed stopped and the blog feed is used
    base: 'https://russhughes77.github.io/pe-site-scripts/',   // v9.2: where the job's lean pictures (heroes/…) live
    phoneHide: true,                  // v9.7: no hero on phones (false brings it back there)
    phone: '(max-width: 640px)'       // what counts as a phone: the same width the homepage styles use
  };

  try { if ((window.top !== window && !window.PE_FC_PREVIEW)) return; } catch (e) { return; }   // the Squarespace editor
  function isHome() { return document.body && document.body.classList.contains('homepage'); }

  // A test tag from the address (?pe-hero-tag=News), otherwise the real one
  var testTag = (location.search.match(/[?&]pe-hero-tag=([^&]+)/) || [])[1];
  var TAG = testTag ? decodeURIComponent(testTag.replace(/\+/g, ' ')) : C.tag;

  // v9.7: on phones the hero is hidden and none of its work is done: no list, no pictures
  var onPhone = !!(C.phoneHide && !testTag && window.matchMedia && window.matchMedia(C.phone).matches);
  if (onPhone && isHome() && !document.getElementById('pe-hero-phone-css')) {
    var hs = document.createElement('style');
    hs.id = 'pe-hero-phone-css';
    hs.textContent = '@media ' + C.phone + '{body.homepage .sqs-block-gallery{display:none !important}}';
    document.head.appendChild(hs);
  }

  // The styles. The picture sits in its own layer inside the slide's link, so
  // clicks still go to the article, and the headline and its shading stay on top.
  // Squarespace's own picture is hidden on filled slides only.
  var CSS =
    '.pe-hero-filled > a{position:absolute !important;top:0;left:0;right:0;bottom:0;display:block;overflow:hidden}' +
    '.pe-hero-filled > a img.thumb-image{visibility:hidden !important}' +
    '.pe-hero-pic{position:absolute;top:0;left:0;right:0;bottom:0;background-size:cover;' +
      'background-repeat:no-repeat;opacity:0;transition:opacity .4s ease}' +
    '.pe-hero-pic.pe-in{opacity:1}' +
    '.pe-hero-pic.pe-nofade{transition:none}' +   // v9.5: a picture's first appearance has no fade
    // A placeholder slide's own picture and "Placeholder" headline never show
    '.pe-hero-ph:not(.pe-hero-filled) img{visibility:hidden !important}' +
    '.pe-hero-ph:not(.pe-hero-filled) .meta-title,.pe-hero-ph:not(.pe-hero-filled) .meta-description{visibility:hidden !important}';

  // A placeholder: titled "Placeholder", or its picture's file name has "placeholder" in it
  // (hero-placeholder-1.webp), so a slide uploaded with no title still counts (v8.4)
  function isPlaceholder(s) {
    var t = s.querySelector('.meta-title'), img = s.querySelector('img');
    var name = (t && t.textContent.trim()) || '';
    var alt = (img && (img.alt || img.getAttribute('data-title'))) || '';
    var src = (img && (img.getAttribute('data-src') || img.getAttribute('data-image') || img.getAttribute('src'))) || '';
    var file = src.replace(/[?#].*$/, '').split('/').pop();
    return /^placeholder\b/i.test(name) || /placeholder/i.test(alt) || /placeholder/i.test(file);
  }

  // A slide with no title has no headline box, so make one in Squarespace's own shape,
  // which the site's hero headline styles already cover (v8.4)
  function titleBox(s) {
    var t = s.querySelector('.meta-title');
    if (t) return t;
    var m = document.createElement('div');
    m.className = 'meta pe-hero-meta';
    m.innerHTML = '<div class="meta-inside"><div class="meta-title"></div></div>';
    s.appendChild(m);
    return m.querySelector('.meta-title');
  }

  function addStyle() {
    if (document.getElementById('pe-hero-tag-css')) return;
    var st = document.createElement('style');
    st.id = 'pe-hero-tag-css';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  function ls(v) {
    try {
      if (v === undefined) return JSON.parse(localStorage.getItem(C.key) || 'null');
      localStorage.setItem(C.key, JSON.stringify(v));
    } catch (e) { return null; }
  }

  // Full address, so the same article matches whether written /path or https://…/path
  function full(u) { return String(u || '').charAt(0) === '/' ? location.origin + u : String(u || ''); }
  function key(u) { return full(u).replace(/^https?:\/\/(www\.)?/i, '').replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase(); }

  /* ---------- The hand-made slides ----------
   * Read from the slides Squarespace drew from the Front Page Heroes gallery, once, before
   * anything is swapped, and kept on the gallery element so a re-run never reads a swapped slide. */
  function readManual(gallery) {
    if (gallery.peHeroManual) return gallery.peHeroManual;
    var out = [];
    Array.prototype.forEach.call(gallery.querySelectorAll('.slide'), function (s) {
      if (isPlaceholder(s)) { s.classList.add('pe-hero-ph'); return; }   // a blank for tagged articles only
      var img = s.querySelector('img');
      var src = img && (img.getAttribute('data-src') || img.getAttribute('data-image') || img.getAttribute('src'));
      var url = s.getAttribute('data-click-through-url') || (s.querySelector('a') || {}).href || '';
      if (!src || !url) return;
      var fp = ((img.getAttribute('data-image-focal-point') || '').match(/([\d.]+),([\d.]+)/) || []);
      var t = s.querySelector('.meta-title');
      out.push({
        url: url,
        title: (t && t.textContent.trim()) || (img && img.alt) || '',
        src: src, fx: fp[1] !== undefined ? +fp[1] : 0.5, fy: fp[2] !== undefined ? +fp[2] : 0.5,
        manual: true
      });
    });
    gallery.peHeroManual = out;
    return out;
  }

  /* ---------- The tagged articles ---------- */

  // The article's picture, read from the blog feed: { src, w, h, fx, fy } or null
  function pictureOf(it) {
    var html = (it.promotedBlock || '') + (it.body || '');
    var m = html.match(/<img[^>]+data-src="([^"]+)"[^>]*>/i);
    if (m) {
      var tag = m[0];
      var dims = (tag.match(/data-image-dimensions="(\d+)x(\d+)"/i) || []);
      var fp = (tag.match(/data-image-focal-point="([\d.]+),([\d.]+)"/i) || []);
      return {
        src: m[1].replace(/&amp;/g, '&'),
        w: +dims[1] || 0, h: +dims[2] || 0,
        fx: fp[1] !== undefined ? +fp[1] : 0.5, fy: fp[2] !== undefined ? +fp[2] : 0.5
      };
    }
    // No image in the article: the Featured Image, if one is set. A post without one
    // still has an assetUrl, but it ends in a slash and serves a 300px placeholder.
    var a = String(it.assetUrl || '');
    if (/\/[^\/?]+\.[a-z0-9]{3,4}(\?|$)/i.test(a)) {
      var f = it.mediaFocalPoint || {};
      return { src: a, w: 0, h: 0, fx: f.x !== undefined ? f.x : 0.5, fy: f.y !== undefined ? f.y : 0.5 };
    }
    return null;
  }

  // The width of a picture whose size the feed didn't give (Featured Images).
  // The image server never enlarges, so asking for 2500px returns the original width.
  function measure(p) {
    if (p.w) return Promise.resolve(p);
    return new Promise(function (res) {
      var im = new Image();
      im.onload = function () { p.w = im.naturalWidth; p.h = im.naturalHeight; res(p); };
      im.onerror = function () { res(p); };
      im.src = p.src + (p.src.indexOf('?') < 0 ? '?' : '&') + 'format=2500w';
    });
  }

  // The newest tagged articles with a sharp enough picture, newest first. Articles already
  // in the hand-made slides are left out here, so they don't use up one of the five places.
  function fetchList(skip) {
    var url = C.blog + '?format=json&tag=' + encodeURIComponent(TAG);
    return fetch(url, { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : { items: [] }; })
      .then(function (j) {
        var now = Date.now();
        var items = (j.items || []).filter(function (it) {
          return it.fullUrl && (+it.publishOn || 0) <= now && !skip[key(it.fullUrl)];
        }).sort(function (a, b) { return (+b.publishOn || 0) - (+a.publishOn || 0); });
        return Promise.all(items.map(function (it) {
          var p = pictureOf(it);
          return p ? measure(p).then(function (p2) { return { it: it, p: p2 }; }) : null;
        }));
      })
      .then(function (rows) {
        var out = [];
        rows.forEach(function (r) {
          if (!r || out.length >= C.max) return;
          if (r.p.w < C.minWidth) {
            try { console.info('Hero: skipped "' + r.it.title + '", picture is ' + (r.p.w || 'an unknown') + 'px wide (needs ' + C.minWidth + ')'); } catch (e) {}
            return;
          }
          out.push({
            url: r.it.fullUrl, title: r.it.title || '',
            src: r.p.src, fx: r.p.fx, fy: r.p.fy
          });
        });
        return out;
      });
  }

  /* ---------- The short list (v9.1) ----------
   * heroes.json holds the tagged articles with their pictures already picked out, so this page
   * needn't download and read the blog feed. The request starts now, before the page has finished
   * loading, and run() picks up the answer. Resolves to the file's items, or null when the file
   * can't be used (missing, not a list, or older than C.jsonMaxAgeDays), so the blog feed takes over. */
  var jsonReady = null;
  function startJson() {
    if (jsonReady || testTag) return;
    jsonReady = fetch(C.json, { credentials: 'omit' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j || !Array.isArray(j.items)) return null;
        var made = Date.parse(j.generated);
        if (!made || Date.now() - made > C.jsonMaxAgeDays * 864e5) return null;
        return j.items;
      })
      .catch(function () { return null; });
  }
  if (!onPhone && (isHome() || /^\/?$/.test(location.pathname))) startJson();

  // The same result as fetchList(), from the short list: newest first, published already,
  // not in the hand-made slides, sharp enough, at most C.max. A picture whose width the job
  // couldn't read (w 0) is measured here, as before.
  function fromJson(items, skip) {
    var now = Date.now();
    var rows = items.filter(function (h) {
      return h && h.url && h.src && (+h.on || 0) <= now && !skip[key(h.url)];
    }).sort(function (a, b) { return (+b.on || 0) - (+a.on || 0); });
    return Promise.all(rows.map(function (h) {
      var p = { src: h.src, w: +h.w || 0, h: 0, fx: h.fx, fy: h.fy };
      return measure(p).then(function (p2) { return { h: h, p: p2 }; });
    })).then(function (list) {
      var out = [];
      list.forEach(function (r) {
        if (out.length >= C.max) return;
        if (r.p.w < C.minWidth) {
          try { console.info('Hero: skipped "' + r.h.title + '", picture is ' + (r.p.w || 'an unknown') + 'px wide (needs ' + C.minWidth + ')'); } catch (e) {}
          return;
        }
        out.push({ url: r.h.url, title: r.h.title || '', src: r.p.src, fx: r.p.fx, fy: r.p.fy, img: r.h.img || '', ws: r.h.ws || [] });
      });
      return out;
    });
  }

  // The tagged list: from heroes.json when it can be used, otherwise from the blog feed
  function getTagged(skip) {
    startJson();
    return (jsonReady || Promise.resolve(null)).then(function (items) {
      return items ? fromJson(items, skip) : fetchList(skip);
    });
  }

  /* ---------- Putting a slide on screen ---------- */

  // How wide a picture to ask for: the slideshow's width on this screen, rounded up
  // to one of the image server's sizes, so phones don't download desktop pictures
  function bestSize(box) {
    var need = (box.offsetWidth || window.innerWidth) * (window.devicePixelRatio || 1);
    var sizes = [750, 1000, 1500, 2500];
    for (var i = 0; i < sizes.length; i++) if (sizes[i] >= need) return sizes[i];
    return 2500;
  }

  // Put one entry (hand-made or tagged) into one slide: link, headline, picture
  function paint(s, h, w, late) {
    var a = s && s.querySelector('a');
    if (!a || !h) return;
    var href = full(h.url);
    if (s.getAttribute('data-pe-hero') === href) return;   // already showing this one
    a.href = href;
    s.setAttribute('data-click-through-url', href);
    s.setAttribute('data-pe-hero', href);
    var img = a.querySelector('img');
    if (img) img.alt = h.title;
    // v9.4: the picture is hidden and the headline sits outside the link, so the link had no
    // text a screen reader or an AI agent could read (Lighthouse: "Links must have discernible text")
    a.setAttribute('aria-label', h.title);
    var t = titleBox(s);
    // On a slide that is showing (one-slide gallery), the headline changes with the picture
    if (!late) t.textContent = h.title;
    var pic = a.querySelector('.pe-hero-pic');
    if (!pic) { pic = document.createElement('div'); pic.className = 'pe-hero-pic'; a.appendChild(pic); }
    pic.classList.remove('pe-in');
    pic.style.backgroundPosition = (h.fx * 100) + '% ' + (h.fy * 100) + '%';
    var orig = h.src + (h.src.indexOf('?') < 0 ? '?' : '&') + 'format=' + w + 'w';
    // v9.2: a tagged article's picture has a lean WebP copy on our own pages (made by the Heroes job),
    // which can be a fifth of the size of the original PNG. The smallest copy wide enough is used. If
    // that file can't be loaded, the original is used instead.
    var src = orig;
    if (h.img && h.ws && h.ws.length) {
      var ws = h.ws.slice().sort(function (a, b) { return a - b; }), pick = ws[ws.length - 1];
      for (var k = 0; k < ws.length; k++) if (ws[k] >= w) { pick = ws[k]; break; }
      src = C.base + h.img + '-' + pick + '.webp';
    }
    // Show the picture once it has loaded, so the slide never flashes empty. If it
    // has been swapped again in the meantime, this older picture is dropped.
    var im = new Image();
    // v8.9: the picture on show is the page's largest element, so the browser is told to fetch it
    // first (fetchpriority=high). Pictures on hidden slides keep the normal priority. Before
    // Squarespace has marked an active slide, only the first slide counts as the one on show.
    try {
      var g = s.closest && s.closest('.sqs-block-gallery');
      var onShow = s.classList.contains('sqs-active-slide') ||
        (g && !g.querySelector('.slide.sqs-active-slide') && g.querySelector('.slide') === s);
      if (onShow) im.fetchPriority = 'high';
    } catch (e) {}
    im.onload = function () {
      if (s.getAttribute('data-pe-hero') !== href) return;
      // v9.5: the first picture a slide ever shows appears at once. The 0.4 second fade-in held back
      // the page's largest paint, and on a first visit there is nothing for it to fade from. Later
      // changes (the slideshow moving on, the full list arriving) still fade.
      var first = !pic.style.backgroundImage;
      if (first) pic.classList.add('pe-nofade');
      pic.style.backgroundImage = 'url("' + src.replace(/"/g, '%22') + '")';
      if (late) t.textContent = h.title;
      s.classList.add('pe-hero-filled');
      if (first) {
        pic.classList.add('pe-in');
        setTimeout(function () { pic.classList.remove('pe-nofade'); }, 100);
      } else {
        requestAnimationFrame(function () { pic.classList.add('pe-in'); });
      }
    };
    im.onerror = function () {
      if (src === orig || s.getAttribute('data-pe-hero') !== href) return;
      src = orig;   // the lean copy failed: show the original instead
      var im2 = new Image();
      im2.onload = im.onload;
      im2.src = src;
    };
    im.src = src;
  }

  /* ---------- The rotation ----------
   * The slideshow has n slides; the list has T entries. Each slide remembers which entry it
   * shows (slot[i]). When the slideshow moves on, the entry on the new slide becomes the
   * current one, and the hidden slides either side are swapped to the next and previous
   * entries in the list, a moment later, once the old slide has faded out. */
  function setup(gallery, list) {
    var slides = Array.prototype.slice.call(gallery.querySelectorAll('.slide'));
    var n = slides.length, T = list.length;
    if (!n || !T) return;
    var w = bestSize(gallery);
    var st = gallery.peHeroState;
    if (st && st.observer) st.observer.disconnect();
    clearTimeout(st && st.timer);
    clearInterval(st && st.tick);

    // One slide in the gallery: Squarespace never moves on from it and its arrows do nothing,
    // so the script plays the list itself on that slide, every C.oneSlideEvery ms, and the
    // arrows step back and forward (v8.4)
    if (n === 1 && T > 1) {
      var one = { list: list, k: 0, tick: 0 };
      gallery.peHeroState = one;
      paint(slides[0], list[0], w);
      one.step = function (d) {
        one.k = ((one.k + d) % T + T) % T;
        paint(slides[0], list[one.k], w, true);
      };
      one.tick = setInterval(function () { if (!document.hidden) one.step(1); }, C.oneSlideEvery);
      if (!gallery.peHeroArrows) {
        gallery.peHeroArrows = true;
        gallery.addEventListener('click', function (e) {
          var b = e.target.closest && e.target.closest('.sqs-gallery-controls .previous, .sqs-gallery-controls .next');
          var s2 = gallery.peHeroState;
          if (!b || !s2 || !s2.step) return;
          e.preventDefault(); e.stopPropagation();
          s2.step(b.classList.contains('previous') ? -1 : 1);
          clearInterval(s2.tick);   // a click restarts the timer, so the next change isn't straight after
          s2.tick = setInterval(function () { if (!document.hidden) s2.step(1); }, C.oneSlideEvery);
        }, true);
      }
      return;
    }

    function activeIndex() {
      for (var i = 0; i < n; i++) if (slides[i].classList.contains('sqs-active-slide')) return i;
      return 0;
    }

    // As many entries as slides, or fewer: no rotation needed, each slide gets one
    // Placeholder slides left over repeat the list, so none shows as a blank
    if (T <= n) {
      list.forEach(function (h, i) { paint(slides[i], h, w); });
      for (var j = T; j < n; j++) if (slides[j].classList.contains('pe-hero-ph')) paint(slides[j], list[j % T], w);
      gallery.peHeroState = { list: list };
      return;
    }

    var a0 = activeIndex();
    var slot = [];
    for (var i = 0; i < n; i++) slot[i] = ((i - a0) % n + n) % n;   // the showing slide starts on entry 0
    // The showing slide is painted straight away. The rest are hidden, so they can change freely.
    slides.forEach(function (s, i) { paint(s, list[slot[i]], w); });

    var state = { list: list, active: a0, slot: slot, timer: 0 };
    gallery.peHeroState = state;

    // Swap the slides either side of slide b to the next and previous entries. The slide
    // that is still fading out (outgoing) is left alone; it gets its turn after swapDelay.
    function prepareAround(b, outgoing) {
      var k = slot[b];
      var next = (b + 1) % n, prev = (b - 1 + n) % n;
      if (next !== outgoing) {
        slot[next] = (k + 1) % T;
        paint(slides[next], list[slot[next]], w);
      }
      if (prev !== next && prev !== outgoing) {   // two slides only: the forward one wins
        slot[prev] = (k - 1 + T) % T;
        paint(slides[prev], list[slot[prev]], w);
      }
    }

    prepareAround(a0, -1);

    // Watch for the slideshow moving on (autoplay, arrows or a swipe). The neighbour that
    // isn't fading out is swapped at once, so quick clicks on the arrows find it ready;
    // the one fading out is swapped once it has gone.
    state.observer = new MutationObserver(function () {
      var b = activeIndex();
      if (b === state.active) return;
      var outgoing = state.active;
      state.active = b;
      prepareAround(b, outgoing);
      clearTimeout(state.timer);
      state.timer = setTimeout(function () { prepareAround(state.active, -1); }, C.swapDelay);
    });
    slides.forEach(function (s) { state.observer.observe(s, { attributes: true, attributeFilter: ['class'] }); });
  }

  // Hand-made slides and tagged articles in one list, in the order chosen in the settings
  function combine(manual, tagged) {
    return C.manualFirst ? manual.concat(tagged) : tagged.concat(manual);
  }

  function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

  function run() {
    if (!isHome() || onPhone) return;
    var gallery = document.querySelector('.sqs-block-gallery');
    if (!gallery || !gallery.querySelector('.slide')) return;
    addStyle();
    var manual = readManual(gallery);
    var skip = {};
    manual.forEach(function (m) { skip[key(m.url)] = 1; });
    // The last tagged list this browser saw goes in straight away, then the feed is checked
    var saved = !testTag && ls();
    var savedList = saved && saved.list ? saved.list.filter(function (h) { return !skip[key(h.url)]; }) : null;
    if (savedList && savedList.length) setup(gallery, combine(manual, savedList));
    // v9.1: a first visit has no saved list, so the hand-made slides are painted now, and the first
    // picture starts loading, instead of waiting for the tagged list. They keep their places when
    // the full list arrives, so nothing on screen changes.
    else if (!testTag && manual.length) setup(gallery, manual);
    getTagged(skip).then(function (tagged) {
      if (!testTag) ls({ t: Date.now(), list: tagged });
      if (!savedList || !same(savedList, tagged) || testTag) setup(gallery, combine(manual, tagged));
    }).catch(function (e) { try { console.warn('Hero: tag list failed, hand-made slides only', e); } catch (x) {} });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
  addEventListener('mercury:load', function () { setTimeout(run, 100); });
})();
} catch (e) { if (window.console) console.warn('Production Expert script failed: homepage hero from the Hero tag', e); }

/* ================================================================
 * Production Expert: light grey homepage with white story cards (v4.5, 2 Nov 2026)
 * On tablet and desktop the homepage sits on a light grey (#F6F6F6) and every
 * story in the article lists becomes a white card, so the grid reads as
 * separate stories without adding lines or borders. The header and footer
 * stay white.
 * - Cards in a row are the same height, so the white boxes line up along the
 *   bottom. The lists switch from floats to a wrapping row to do that; card
 *   widths and the 10px gaps are unchanged. Gaps are set on the row (v4.6),
 *   because Squarespace's card margins count hidden cards and left two Deals
 *   cards touching.
 * - Text inside each card gets 16px of padding so it doesn't touch the card
 *   edge. Pictures stay full width at the top of the card.
 * - Banners in the grid sit on the grey, which marks them off from the stories.
 * - Phones are left alone (768px and under): pictures there run edge to edge,
 *   and phones have dark mode, which this would need its own version of.
 * - Homepage only. Leaves the editor alone.
 * ================================================================ */
try {
(function () {
  var GREY = '#F6F6F6';               // page colour behind the cards
  var FROM = 768;                     // px; tablet and desktop only

  if ((window.top !== window && !window.PE_FC_PREVIEW)) return;  // the Squarespace editor

  var L = 'body.homepage #container-content .summary-item-list';
  var CSS =
    '@media (min-width:' + FROM + 'px){' +
      'body.homepage,body.homepage #navigator{background:' + GREY + ' !important}' +
      'body.homepage #topBar,body.homepage #bottomBar{background:#fff !important}' +
      // v4.6: the gaps come from the row itself, not from Squarespace's per-card margins.
      // Those margins count hidden cards (expired deals), so in Deals two cards ended up
      // touching. 0.877193% is the same gap Squarespace used (10px on a 1140px column).
      L + '{display:flex !important;flex-wrap:wrap !important;align-items:stretch !important;' +
        'column-gap:0.877193% !important;row-gap:10px !important}' +
      L + '::before,' + L + '::after{display:none !important}' +   // the old float clearer would take a slot
      L + ' > .summary-item{background:#fff !important;float:none !important;clear:none !important;margin:0 !important}' +
      L + ' > .summary-item .summary-content{padding:4px 16px 18px !important}' +
    '}';

  function run() {
    if (!document.body || !document.body.classList.contains('homepage')) return;
    if (document.getElementById('pe-grey-home-css')) return;
    var st = document.createElement('style');
    st.id = 'pe-grey-home-css';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
  addEventListener('mercury:load', run);
})();
} catch (e) { if (window.console) console.warn('Production Expert script failed: light grey homepage', e); }

/* ================================================================
 * Production Expert: article title on the hero picture (v2.1, 30 Oct 2026)
 * Moves the article title off its own line above the picture and onto the
 * hero, bottom left, in large white Open Sans Extra Bold over a soft dark
 * fade, matching the homepage hero. The title stays the page's H1, so search
 * engines read it exactly as before.
 * - Titles up to 45 characters are 40px on a laptop; longer ones drop to 32px,
 *   so nearly every title sits on two even lines. 22px on phones.
 * - Only when the article opens with a full-width hero picture: either the
 *   promoted image Squarespace shows above the body, or a single wide image
 *   as the very first block of the body. Anything else keeps its title above.
 * - Opt out per article with the tag "Title Above" (screenshots where the
 *   picture is the point, or pictures with words in the bottom left).
 * - Leaves the editor alone, so writers edit the title as normal.
 * - v4.3: rebuilds Squarespace's hero area when it's missing. From about midday on 2 Nov 2026
 *   Squarespace stopped lifting a post's first image into its own area above the article (the
 *   "promoted block") when a post is saved. The theme bleeds that area edge to edge on phones,
 *   so without it the hero sat inside the padded text column (Krotos Studio 3.0 against FabFilter
 *   Twin 3, same day). When the page has no hero area and the body opens with a single wide image,
 *   that image block moves into a hero area built the way Squarespace builds it (div.special-content
 *   holding a "promoted-block" layout, before the body, with the article marked promoted), so the
 *   theme's own styles apply on every screen size. Live pages only; the editor is untouched.
 * ================================================================ */
try {
(function () {
  var LONG = 45;                      // characters; longer titles use the smaller size
  var MIN_WIDTH = 0.6;                // the picture must fill 60% of the article column

  if (!document.body || !document.body.classList.contains('view-item')) return;
  try { if ((window.top !== window && !window.PE_FC_PREVIEW)) return; } catch (e) { return; }   // leave the editor alone

  var CSS =
    '.pe-hero-title-wrap{position:relative}' +
    // the fade: darkest at the bottom, clear two thirds of the way up; lets clicks through
    '.pe-hero-title-wrap::after{content:"";position:absolute;top:0;right:0;bottom:0;left:0;z-index:1;pointer-events:none;' +
      'background:linear-gradient(to top,rgba(0,0,0,.72) 0%,rgba(0,0,0,.35) 40%,rgba(0,0,0,0) 68%)}' +
    'h1.pe-hero-title{position:absolute!important;z-index:2;left:clamp(16px,3.5%,32px);right:clamp(16px,3.5%,32px);' +
      'bottom:clamp(14px,4%,30px);max-width:78%;margin:0!important;padding:0!important;background:none!important;' +
      "font-family:'Open Sans',sans-serif!important;font-weight:800!important;font-size:clamp(22px,3vw,40px)!important;" +
      'line-height:1.12!important;letter-spacing:-0.01em!important;color:#fff!important;text-align:left!important;' +
      'text-wrap:balance;text-shadow:0 2px 14px rgba(0,0,0,.45)}' +
    'h1.pe-hero-title a{color:#fff!important}' +
    'h1.pe-hero-title.pe-long{font-size:clamp(20px,2.4vw,32px)!important;max-width:88%}' +
    // Phones (v4.3): the picture runs edge to edge, so the title lines up with the
    // left edge of the article text below it (--pe-title-left, measured in alignTitle)
    '@media (max-width:640px){h1.pe-hero-title,h1.pe-hero-title.pe-long{max-width:none;font-size:22px!important;' +
      'left:var(--pe-title-left,30px);right:var(--pe-title-left,30px);bottom:14px}}' +
    // the header the title came from is left empty, so take it out of the flow
    'article header.pe-title-moved{display:none!important}';

  function floated(b) {
    if (/\bfloat\b/.test(b.className)) return true;
    var inner = b.querySelector('.image-block-outer-wrapper, figure, .sqs-image');
    return getComputedStyle(b).float !== 'none' || !!(inner && getComputedStyle(inner).float !== 'none');
  }

  function wideEnough(b, layout) {
    var w = b.getBoundingClientRect().width, full = layout.getBoundingClientRect().width;
    return !w || !full || w / full >= MIN_WIDTH;
  }

  // The first real block of a layout, skipping spacers and empty blocks
  function firstBlock(layout) {
    var blocks = layout.querySelectorAll('.sqs-block');
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      if (/\bspacer-block\b/.test(b.className)) continue;
      if (!b.querySelector('img, iframe, video') && !b.textContent.trim()) continue;
      return b;
    }
    return null;
  }

  // A single wide image block, not floated, alone in its row
  function heroFrom(layout) {
    if (!layout) return null;
    var b = firstBlock(layout);
    if (!b || !/\bimage-block\b/.test(b.className) || floated(b)) return null;
    var row = b.closest('.row');
    if (row && row.querySelectorAll(':scope > .col').length > 1) return null;
    if (!wideEnough(b, layout)) return null;
    return b.querySelector('.image-block-wrapper');
  }

  // v4.3: puts the body's opening hero image into a rebuilt hero area (see the header above)
  function rebuildHeroArea(art) {
    if (art.querySelector('.special-content')) return;            // Squarespace made one: leave it
    var body = art.querySelector('.body.entry-content .sqs-layout');
    if (!body || !heroFrom(body)) return;                         // body doesn't open with a wide image
    var block = firstBlock(body);
    var main = body.closest('section.main') || art.querySelector('section.main');
    if (!main) return;
    var place = body;                                             // the child of section.main holding the body
    while (place && place.parentElement !== main) place = place.parentElement;
    if (!place) return;
    var sc = document.createElement('div');
    sc.className = 'special-content pe-hero-area';
    sc.innerHTML = '<div class="sqs-layout sqs-grid-12 columns-12" data-layout-label="Promoted Block" data-type="promoted-block">' +
      '<div class="row sqs-row"><div class="col sqs-col-12 span-12"></div></div></div>';
    sc.querySelector('.col').appendChild(block);
    main.insertBefore(sc, place);
    art.classList.add('promoted', 'promoted-block-image');
    // Squarespace sizes its pictures to their box; ask it to look again at the new width
    setTimeout(function () { try { window.dispatchEvent(new Event('resize')); } catch (e) {} }, 50);
  }

  // v5.2: the photo credit under the hero is hidden on phones. Once the hero runs edge to edge
  // (v4.3) the caption sat against the screen edge, and the theme's phone styles turned each
  // link in it into a full-width bar (Russ, 6 Nov 2026). Tablet and desktop keep the credit.
  // A hand-typed "This is Partner Content" caption is never hidden: older untagged partner
  // posts still use it as their disclosure.
  function hideHeroCredit(art) {
    var wrap = heroFrom(art.querySelector('.special-content .sqs-layout')) ||
               heroFrom(art.querySelector('.body.entry-content .sqs-layout'));
    if (!wrap) return;
    var block = wrap.closest('.sqs-block') || wrap.parentNode;
    var caps = block.querySelectorAll('figcaption, .image-caption-wrapper, .image-caption');
    var found = false;
    for (var i = 0; i < caps.length; i++) {
      if (/partner content/i.test(caps[i].textContent)) continue;
      caps[i].classList.add('pe-hero-credit');
      found = true;
    }
    if (found && !document.getElementById('pe-hero-credit-css')) {
      var st = document.createElement('style');
      st.id = 'pe-hero-credit-css';
      st.textContent = '@media (max-width:767px){.pe-hero-credit{display:none!important}}';
      document.head.appendChild(st);
    }
  }

  function run() {
    var art = document.querySelector('article.hentry');
    if (!art) return;
    rebuildHeroArea(art);
    hideHeroCredit(art);
    if (art.classList.contains('tag-title-above')) return;
    var h1 = art.querySelector('h1.entry-title');
    if (!h1 || h1.classList.contains('pe-hero-title')) return;   // missing, or already done

    // Promoted image above the body first, then the start of the body
    var wrap = heroFrom(art.querySelector('.special-content .sqs-layout')) ||
               heroFrom(art.querySelector('.body.entry-content .sqs-layout'));
    if (!wrap || !wrap.querySelector('img')) return;

    if (!document.getElementById('pe-hero-title-css')) {
      var st = document.createElement('style');
      st.id = 'pe-hero-title-css';
      st.textContent = CSS;
      document.head.appendChild(st);
    }
    var header = h1.parentNode;
    if (h1.textContent.replace(/\s+/g, ' ').trim().length > LONG) h1.classList.add('pe-long');
    h1.classList.add('pe-hero-title');
    wrap.classList.add('pe-hero-title-wrap');
    wrap.appendChild(h1);
    // Hide the old header only if the title was all it held
    if (header && header.tagName === 'HEADER' && !header.textContent.trim() && !header.querySelector('img, a, time')) {
      header.classList.add('pe-title-moved');
    }
    alignTitle();
  }

  // Phones (v4.3): measure where the article text starts, relative to the hero
  // picture, so the title's left edge sits on the same line as the text, the
  // read time and the contents box below it. Wider screens keep the inset,
  // because there the picture sits inside the text column.
  function alignTitle() {
    var h1 = document.querySelector('h1.pe-hero-title');
    var body = document.querySelector('article.hentry .body.entry-content');
    if (!h1 || !body) return;
    var wrap = h1.parentNode.getBoundingClientRect();
    var left = Math.round(body.getBoundingClientRect().left - wrap.left);
    if (left >= 0 && left < wrap.width / 4) h1.style.setProperty('--pe-title-left', left + 'px');
  }

  run();
  document.addEventListener('DOMContentLoaded', run);
  addEventListener('load', function () { run(); alignTitle(); });
  addEventListener('resize', alignTitle);
  addEventListener('mercury:load', function () { setTimeout(run, 100); });
})();
} catch (e) { if (window.console) console.warn('Production Expert script failed: article title on the hero picture', e); }

/* ================================================================
 * Production Expert: Author list in A to Z order (team only, v2.4, 30 Oct 2026)
 * Squarespace lists authors in Edit Post, Options, in the order their accounts were added, which
 * made the right name hard to find among 140. This sorts that list alphabetically each time the
 * Edit Post window opens. Only the order changes: the author already chosen stays chosen, and
 * nothing is saved until someone presses Save as usual.
 * The list is an ordinary dropdown (select name="authorId") in Squarespace's older editor, which
 * lives in the editor window around the preview this script runs in. Checked live 30 Oct 2026.
 * ================================================================ */
try {
(function () {
  if (window.top === window) return; // only inside the Squarespace editor
  var top;
  try { top = window.top.document; if (!top || !top.body) return; } catch (e) { return; }
  var sorter = new Intl.Collator('en-GB', { sensitivity: 'base', numeric: true });

  function sortList(sel) {
    var opts = Array.prototype.slice.call(sel.options);
    if (opts.length < 2 || sel.getAttribute('data-pe-sorted') === String(opts.length)) return;
    var chosen = sel.value;
    opts.sort(function (a, b) {
      return sorter.compare(a.text.trim(), b.text.trim()) || sorter.compare(a.value, b.value);
    });
    var frag = top.createDocumentFragment();
    opts.forEach(function (o) { frag.appendChild(o); });
    sel.appendChild(frag);
    sel.value = chosen; // moving options can reset the choice in some browsers, so put it back
    sel.setAttribute('data-pe-sorted', String(opts.length));
  }

  function look() {
    try {
      var lists = top.querySelectorAll('select[name="authorId"]');
      for (var i = 0; i < lists.length; i++) sortList(lists[i]);
    } catch (e) {}
  }

  // The Edit Post window can open at any moment, so look once a second (a cheap check that does
  // nothing until the list appears, and nothing again once it has been sorted)
  look();
  setInterval(look, 1000);
})();
} catch (e) { if (window.console) console.warn('Production Expert script failed: Author list in A to Z order', e); }

/* ================================================================
 * Production Expert: Updated label on refreshed articles (v6.0, 11 Nov 2026)
 * When an older article has been properly refreshed, the team adds the tag "Updated" to it
 * in Squarespace. On the article this adds an orange "Updated November 11, 2026" label beside
 * the original date, so readers can see at a glance that it's current. (The homepage card's
 * UPDATED label comes from the card labels section; the dashboard's Evergreen panel reads the
 * same tag to move a planned refresh to Refreshed.)
 * The date is the post's own last-edited time from Squarespace (?format=json, updatedOn), so a
 * later edit to a tagged post moves it on too. If that can't be read, the label says "Updated".
 * Tags are hidden from readers elsewhere, so the tag itself never shows.
 * v6.3: a note above the comments too: "This article was updated on <date>. Comments before that
 * date refer to the earlier version." Old comments stay (Russ, 11 Nov 2026); Ask the Archive only
 * quotes comments from the refresh on. The note sits under the "Comments" heading, just above
 * the thread (Hyvor draws the thread in its own box, so nothing can go inside it).
 * ================================================================ */
try {
(function () {
  var MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var CSS =
    '.pe-updated{display:inline-block;margin:0 0 0 10px;padding:4px 9px 3px;background:#e87722;color:#fff;border-radius:3px;' +
      "font-family:'Open Sans',sans-serif;font-weight:800;font-size:12px;line-height:1.2;letter-spacing:.06em;text-transform:uppercase;vertical-align:middle;white-space:nowrap}" +
    '.pe-updated-block{display:block;margin:6px 0 0}' +
    '@media (max-width:640px){.pe-updated{font-size:11px;margin-left:8px}}' +
    ".pe-updated-note{margin:0 0 18px;padding:12px 16px;background:#f2f2f0;border-radius:6px;font-family:'Open Sans',sans-serif;font-size:14px;line-height:1.5;color:#3a3a3e}" +
    'html.pe-dark .pe-updated-note,body.pe-dark .pe-updated-note{background:#26282c;color:#d6d7da}';

  function fmt(ms) {
    var d = new Date(+ms);
    return isNaN(d) ? '' : MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  }

  function place(art, text) {
    if (art.querySelector('.pe-updated')) return;
    if (!document.getElementById('pe-updated-css')) {
      var st = document.createElement('style');
      st.id = 'pe-updated-css';
      st.textContent = CSS;
      document.head.appendChild(st);
    }
    var lab = document.createElement('span');
    lab.className = 'pe-updated';
    lab.textContent = text;
    lab.title = 'This article has been refreshed since it was first published';
    var time = art.querySelector('time.published, time.dt-published, .entry-dateline time, time');
    if (time && time.parentNode) {
      time.parentNode.insertBefore(lab, time.nextSibling);
    } else {
      // No date shown: put it under the title instead
      var h1 = art.querySelector('h1.entry-title') || document.querySelector('h1');
      if (!h1) return;
      lab.classList.add('pe-updated-block');
      h1.parentNode.insertBefore(lab, h1.nextSibling);
    }
  }

  // The note above the comments (v6.3). Hyvor may arrive after the page is built, so it looks a few times.
  function note(d, tries) {
    if (document.querySelector('.pe-updated-note')) return;
    var thread = document.getElementById('disqus_thread') ||
                 document.querySelector('hyvor-talk-comments, #hyvor-talk-view, .hyvor-talk-comments');
    if (!thread) {
      if ((tries || 0) < 8) setTimeout(function () { note(d, (tries || 0) + 1); }, 1500);
      return;
    }
    var n = document.createElement('p');
    n.className = 'pe-ui pe-updated-note';
    n.textContent = d ? 'This article was updated on ' + d + '. Comments before that date refer to the earlier version.'
                      : 'This article has been updated. Older comments refer to the earlier version.';
    thread.parentNode.insertBefore(n, thread);   // after the "Comments" heading, which sits just above the thread
  }

  function run() {
    try { if ((window.top !== window && !window.PE_FC_PREVIEW)) return; } catch (e) { return; }   // leave the editor alone
    var art = document.querySelector('article.hentry');
    if (!art || !art.classList.contains('tag-updated') || art.querySelector('.pe-updated')) return;
    fetch(location.pathname + '?format=json', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .catch(function () { return {}; })
      .then(function (j) {
        var on = j && j.item && (j.item.updatedOn || j.item.publishOn);
        var d = on ? fmt(on) : '';
        place(art, d ? 'Updated ' + d : 'Updated');
        note(d, 0);
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
  window.addEventListener('mercury:load', run);   // Ajax page loads
})();
} catch (e) { if (window.console) console.warn('Production Expert script failed: Updated label', e); }

/* ================================================================
 * Production Expert: refreshed articles on the homepage on their scheduled day (v7.4, 13 Nov 2026; was v6.1)
 * A refreshed article keeps its original date (tagged Updated, see "Updated label on refreshed
 * articles"), so Squarespace's homepage grid, which runs in publish order, would never show it.
 * Russ, 13 Nov 2026: a refresh is treated like a new piece. Tagging it Updated puts it in Mel's review
 * queue in the Content Manager; she schedules it for a day there, and at 09:00 UK time that day it
 * "goes back out": this adds a card for it to the top row of the homepage grid for 24 hours (second
 * place, so the newest story still leads), with the orange UPDATED label, while the socials and the
 * mailshot follow from the Partners script.
 * - Which articles, and from when, comes from the dashboard's public list (REFRESH_API): only
 *   articles whose scheduled moment has come and is less than 24 hours old. Tagging or editing an
 *   article no longer puts it on the homepage by itself (it did under v6.1, 24 hours after any edit).
 * - The card is a copy of the grid's own first card with the refreshed article's link, title,
 *   excerpt, original date and picture (read from the article's own ?format=json), so it looks and
 *   behaves like the rest.
 * - Newest first if there are several; at most MAX cards. Never a second card for an article that
 *   is already in the grid. If the list can't be read, nothing is added.
 * ================================================================ */
try {
(function () {
  var REFRESH_API = 'https://pe-related-answers.pages.dev/api/refresh/live';   // [{path, at}] live on the homepage now
  var MAX = 2;             // most refreshed cards at once
  var POSITION = 1;        // 0 = first card; 1 = second
  var KEY = 'pe-updated-cards-v2';
  var KEEP_MS = 5 * 60 * 1000;   // a reader moving between pages doesn't ask again for 5 minutes
  var MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  if (!document.body || !document.body.classList.contains('homepage')) return;
  try { if ((window.top !== window && !window.PE_FC_PREVIEW)) return; } catch (e) { return; }   // not in the editor

  function path(u) { try { return new URL(u, location.origin).pathname.replace(/\/$/, ''); } catch (e) { return ''; } }
  function getJson(u, cred) {
    return fetch(u, { credentials: cred || 'same-origin' }).then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; });
  }

  // Refreshes whose day has come (from the dashboard), each filled in from the article's own data, newest first
  function recent() {
    try {
      var o = JSON.parse(sessionStorage.getItem(KEY) || 'null');
      if (o && Date.now() - o.t < KEEP_MS) return Promise.resolve(o.items);
    } catch (e) {}
    return getJson(REFRESH_API, 'omit').then(function (d) {
      var live = (d && d.ok && Array.isArray(d.items)) ? d.items.slice() : [];
      live.sort(function (a, b) { return (+b.at || 0) - (+a.at || 0); });
      live = live.filter(function (x) { return x && typeof x.path === 'string' && x.path.charAt(0) === '/'; }).slice(0, MAX + 2);
      return Promise.all(live.map(function (x) {
        return getJson(x.path + '?format=json').then(function (j) {
          var i = j && j.item;
          if (!i || !i.fullUrl) return null;
          var html = String(i.promotedBlock || '') + String(i.body || '');
          var m = html.match(/<img[^>]+data-src="([^"]+)"/i);
          return { p: path(i.fullUrl), title: i.title || '', excerpt: String(i.excerpt || '').replace(/<[^>]+>/g, '').trim(),
                   img: i.assetUrl || (m && m[1]) || '', pub: +i.publishOn || 0, at: +x.at || 0 };
        });
      })).then(function (items) {
        items = items.filter(Boolean);
        try { sessionStorage.setItem(KEY, JSON.stringify({ t: Date.now(), items: items })); } catch (e) {}
        return items;
      });
    });
  }

  function css() {
    if (document.getElementById('pe-updated-card-css')) return;
    var st = document.createElement('style');
    st.id = 'pe-updated-card-css';
    st.textContent =
      '.pe-updated-card .summary-thumbnail-container{position:relative;display:block}' +
      '.pe-updated-card-badge{position:absolute;z-index:3;top:14px;left:14px;padding:6px 11px 5px;background:#e87722;color:#fff;' +
        "font-family:'Open Sans',sans-serif;font-weight:800;font-size:15px;line-height:1;letter-spacing:.12em;" +
        'text-transform:uppercase;border-radius:3px;box-shadow:0 1px 6px rgba(0,0,0,.25);pointer-events:none}' +
      '@media (max-width:640px){.pe-updated-card-badge{top:12px;left:12px;font-size:14px}}';
    document.head.appendChild(st);
  }

  function card(tpl, a) {
    var c = tpl.cloneNode(true);
    c.classList.add('pe-updated-card');
    c.removeAttribute('id');
    c.setAttribute('data-pe-updated', a.p);
    Array.prototype.forEach.call(c.querySelectorAll('a[href]'), function (x) { x.setAttribute('href', a.p); });
    var t = c.querySelector('.summary-title a, a.summary-title-link');
    if (t) t.textContent = a.title;
    var ex = c.querySelector('.summary-excerpt');
    if (ex) ex.innerHTML = a.excerpt ? '<p></p>' : '';
    if (ex && a.excerpt) ex.querySelector('p').textContent = a.excerpt;
    var dt = c.querySelector('time, .summary-metadata-item--date');
    if (dt && a.pub) {
      var d = new Date(a.pub);
      dt.textContent = MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
      if (dt.setAttribute) dt.setAttribute('datetime', d.toISOString().slice(0, 10));
    }
    // Picture: rebuilt the way the blank-card fix builds one, so lazy loading can't keep the template's
    var old = c.querySelector('.summary-thumbnail-outer-container');
    if (old) old.parentNode.removeChild(old);
    if (a.img) {
      var outer = document.createElement('div');
      outer.className = 'summary-thumbnail-outer-container';
      outer.innerHTML =
        '<a class="summary-thumbnail-container sqs-gallery-image-container" href="' + a.p + '">' +
        '<div class="summary-thumbnail img-wrapper" style="position:relative;padding-bottom:56.25%;overflow:hidden">' +
        '<img class="summary-thumbnail-image loaded" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover" loading="lazy"></div></a>';
      var img = outer.querySelector('img');
      img.src = a.img + (a.img.indexOf('?') < 0 ? '?format=1000w' : '');
      img.alt = a.title;
      c.insertBefore(outer, c.firstChild);
    }
    Array.prototype.forEach.call(c.querySelectorAll('.pe-news-badge, .pe-updated-card-badge'), function (b) { b.parentNode.removeChild(b); });
    var pic = c.querySelector('.summary-thumbnail-container');
    if (pic) {
      var badge = document.createElement('span');
      badge.className = 'pe-news-badge pe-updated-card-badge';   // pe-news-badge too, so the card labels section leaves it alone
      badge.textContent = 'Updated';
      pic.appendChild(badge);
    }
    return c;
  }

  function run() {
    var grid = document.querySelector('#container-content .sqs-block-summary-v2');
    var first = grid && grid.querySelector('.summary-item');
    if (!first || grid.querySelector('.pe-updated-card')) return;
    recent().then(function (items) {
      if (!items.length || grid.querySelector('.pe-updated-card')) return;
      var have = {};
      Array.prototype.forEach.call(grid.querySelectorAll('.summary-item .summary-title a, .summary-item a.summary-title-link'), function (x) {
        have[path(x.getAttribute('href'))] = 1;
      });
      css();
      var list = first.parentNode;
      var at = list.querySelectorAll('.summary-item')[POSITION] || null;
      items.filter(function (a) { return !have[a.p]; }).slice(0, MAX).forEach(function (a) {
        list.insertBefore(card(first, a), at);
      });
      setTimeout(function () { try { window.dispatchEvent(new Event('resize')); } catch (e) {} }, 60);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
  addEventListener('mercury:load', function () { setTimeout(run, 100); });
})();
} catch (e) { if (window.console) console.warn('Production Expert script failed: refreshed articles on the homepage', e); }

/* ================================================================
 * Production Expert: tables and the subscription calculator in dark mode (v7.5, 14 Nov 2026)
 * Tables in articles carry their colours inline (white and #fafafa rows, dark text, an orange header),
 * from the Tables tool and the pe-table-formatter skill. In dark mode the site's dark stylesheet only
 * darkened the header and the borders, so readers got white rows on a dark page with a grey header.
 * This adds dark rows, light text, softer green and amber, and keeps the orange header.
 * Inline styles lose to !important rules, so nothing in the articles needs changing.
 *
 * The subscription calculator (#pe-sub-calc) draws inside a Shadow DOM, which the site's stylesheets
 * can't reach, and its colours were light only, so its text went near-black on the dark page. Its colour
 * roles live in CSS variables on .viz-root, so this puts a second set of variables inside its shadow
 * root and switches them on with a class on the host whenever the page is dark. Any later embed built
 * the same way (an open shadow root with a .viz-root) picks this up too.
 * ================================================================ */
try {
(function () {
  // Where article tables live: Code Blocks (the Tables tool) and Text Blocks (pasted tables)
  var T = 'html.pe-dark .sqs-block-code table,html.pe-dark .sqs-block-html table,html.pe-dark .entry-content table';
  // Builds a selector list: each part of T followed by the given ending
  function each(end) { return T.split(',').map(function (s) { return s + end; }).join(','); }

  var CSS =
    // Rows: dark, with the same gentle stripe the light version has
    each(' tbody tr') + '{background-color:#1a1b1f!important}' +
    each(' tbody tr:nth-child(even)') + '{background-color:#1f2125!important}' +
    each(' td') + '{background-color:transparent!important}' +
    // Dividers inside the table (rows set their own bottom border inline)
    each(' tr') + '{border-color:#33363c!important}' +
    // Text: light for everything except the green and amber values handled below
    each(' td') + ',' + each(' td span') + ',' + each(' td p') + ',' + each(' td strong') + '{color:#e6e7ea!important}' +
    // The first-column labels and the sentence under a value read a touch quieter
    each(' td span[style*="font-size:12px"]') + '{color:#c4c7cd!important}' +
    // Highlighted column: green text and a faint green wash, readable on dark
    each(' td[style*="234,243,222"]') + '{background-color:rgba(95,207,141,.10)!important}' +
    each(' [style*="#3b6d11" i]') + '{color:#8fd16a!important}' +
    // Amber for No, Not supported and the like
    each(' [style*="#b85c00" i]') + '{color:#f1b452!important}' +
    // Header: keep the orange from its row (the dark stylesheet had painted every th grey)
    each(' thead tr[style*="background"] th') + '{background-color:inherit!important}' +
    each(' th[style*="#E38501" i]') + '{background-color:#E38501!important}' +
    // Header text that isn't white (plain grey headings, as in the calculator's price table) goes lighter
    each(' th:not([style*="color:#fff"])') + '{color:#b8bcc3!important}' +
    // The calculator's "See every price" panel sits outside its shadow root: its note text
    'html.pe-dark .sqs-block-code details p[style*="#52514e"],html.pe-dark .sqs-block-code details summary{color:#c4c7cd!important}';

  // The dark colour roles for embeds drawn in a shadow root with a .viz-root (the calculator)
  var SHADOW_CSS =
    ':host(.pe-dark-on) .viz-root{color-scheme:dark;' +
      '--surface-0:#141518;--surface-1:#1d1f23;' +            // page and cards
      '--text-primary:#e6e7ea;--text-secondary:#b8bcc3;--text-muted:#8d919a;' +
      '--grid:#2c2e34;--border:#3a3d44;' +                    // lines
      '--control-bg:#26282d;--control-on:#3a3d44;' +          // pick-list hover, segmented buttons
      '--series-daw:#F08A3A;--series-plugins:#5a9be8;--accent:#4d93e6}' +
    // Tooltip shadow is heavier on dark so it still lifts off the page
    ':host(.pe-dark-on) .tooltip{box-shadow:0 4px 16px rgba(0,0,0,.5)}';

  // Add the table rules to the page once
  function addCss() {
    if (document.getElementById('pe-dark-tables-css')) return;
    var st = document.createElement('style');
    st.id = 'pe-dark-tables-css';
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  // Put the dark roles into each shadow-root embed, and match its host to the page's mode
  function syncShadows() {
    var dark = document.documentElement.classList.contains('pe-dark');
    var hosts = document.querySelectorAll('[id^="pe-"]');
    for (var i = 0; i < hosts.length; i++) {
      var sr = hosts[i].shadowRoot;
      if (!sr || !sr.querySelector('.viz-root')) continue;   // not one of ours, or not drawn yet
      if (!sr.getElementById('pe-dark-roles')) {
        var st = document.createElement('style');
        st.id = 'pe-dark-roles';
        st.textContent = SHADOW_CSS;
        sr.appendChild(st);                                   // last in the root, so it wins ties
      }
      hosts[i].classList.toggle('pe-dark-on', dark);
    }
  }

  function run() {
    addCss();
    syncShadows();
    // Embeds can draw a moment after this script runs, so look again for a few seconds
    var n = 0, t = setInterval(function () { syncShadows(); if (++n >= 10) clearInterval(t); }, 500);
  }

  // Follow the reader's light/dark switch: the toggle changes the class on <html>
  try {
    new MutationObserver(syncShadows).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  } catch (e) {}

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
  addEventListener('mercury:load', function () { setTimeout(run, 100); });   // Ajax page loads
})();
} catch (e) { if (window.console) console.warn('Production Expert script failed: dark mode tables', e); }

/* ================================================================
 * Production Expert: breathing room at the top of site pages (v7.9, 18 Nov 2026)
 * On ordinary pages (Contact Us, About, Write For Us, the free plug-ins and sound effects pages and so on)
 * the first heading sat about 12px under the menu bar, so pages looked pushed up against it.
 * This adds space above the page content: 48px on desktop, 28px on phones.
 * - Only Squarespace "page" pages get it (body.collection-type-page). Articles open with their hero
 *   picture and the blog lists have their own spacing, so they're left alone.
 * - The homepage is skipped (body.homepage) so the hero banner stays tight under the menu.
 * - !important is needed because a Squarespace stylesheet already sets this padding with !important.
 * To change the amount, edit the two numbers below.
 * ================================================================ */
try {
(function () {
  var CSS =
    // Desktop and tablet: the space above the page content
    'body.collection-type-page:not(.homepage) #container-content{padding-top:48px!important}' +
    // Phones: a little less, as the screen is shorter
    '@media (max-width:767px){body.collection-type-page:not(.homepage) #container-content{padding-top:28px!important}}';

  // Add the rule to the page once (the id stops a second copy on Ajax page loads)
  function addCss() {
    if (document.getElementById('pe-page-top-css')) return;
    var st = document.createElement('style');
    st.id = 'pe-page-top-css';
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  addCss();
})();
} catch (e) { if (window.console) console.warn('Production Expert script failed: breathing room at the top of site pages', e); }

/* ================================================================
 * Production Expert: menu separators and the phone hamburger menu (v8.0, 19 Nov 2026)
 *
 * 1. SEPARATORS. The " |" between menu items used to be typed into every menu item's name in Squarespace.
 *    This section draws the line itself, so the names can be plain words ("Latest", "Free Plug-ins").
 *    - Any " |" still left on the end of a name is stripped first, so the menu looks right whether or not
 *      the names have been tidied yet, and never shows two lines.
 *    - The line sits after every top-level item except the last, as before. Dropdown items get none.
 *    - It is drawn in a slightly faded version of the menu's own colour, so it works in light and dark mode
 *      and no longer turns purple/blue beside the current page.
 *
 * 2. HAMBURGER MENU ON PHONES. Squarespace's own phone menu (the word MENU, opening a centred list) is
 *    replaced by a three-line button top right, which slides a panel in from the right.
 *    - The Search button moves to the centre of the top bar, where MENU used to sit; the dark mode
 *      switch stays top left. The hamburger matches the dark mode switch (same size and colours).
 *    - The panel is built from the desktop menu, so it always matches it: change the menu in Squarespace
 *      and the panel follows. Dropdowns (Studio Tools, Compatibility, Resources, About Us) open with the
 *      arrow on the right; the name itself still goes to that section's own page.
 *    - The current page is marked with an orange bar. Closes with the X, a tap outside, the Esc key or
 *      the phone's back gesture. The page behind can't scroll while it's open.
 *    - It applies at 639px wide and under, exactly where Squarespace switches to its phone menu on this
 *      template, so tablets and desktops are untouched (PHONE_MAX below).
 *
 * To switch either part off, set SEPARATORS or BURGER below to false.
 * ================================================================ */
try {
(function () {
  var SEPARATORS = true;   // draw the | between menu items
  var BURGER = true;       // the hamburger menu on phones
  var ORANGE = '#E28602';  // Production Expert orange, for the current page marker
  var PHONE_MAX = 639;     // widest screen that gets the hamburger (where Squarespace shows its phone menu)

  // ---- Strip any typed " |" from the menu names (desktop menu, phone menu and footer menu) ----
  // Walks the text inside each menu link and removes a trailing "|" plus the spaces around it.
  function stripPipes() {
    var links = document.querySelectorAll('#nav a, #mobile-navigation a, #bottomBar nav a');
    for (var i = 0; i < links.length; i++) {
      var walker = document.createTreeWalker(links[i], NodeFilter.SHOW_TEXT, null, false), n;
      while ((n = walker.nextNode())) {
        if (/\|\s*$/.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(/\s*\|\s*$/, '');
      }
    }
  }

  // Clean the name read from a link (used for the phone panel), in case stripping hasn't run on it
  function cleanName(t) { return (t || '').replace(/\s+/g, ' ').replace(/\s*\|\s*$/, '').trim(); }

  // ---- All the styling for both parts, added once ----
  var CSS =
    // Separators: after every top-level desktop menu item except the last one
    (SEPARATORS ?
      'html.pe-seps #nav>li:not(:last-child)::after{content:"|";margin-left:0;opacity:.55;pointer-events:none}' : '') +
    (BURGER ?
      // Hide Squarespace's MENU word and its list while the hamburger is in charge (the bar keeps its height,
      // so the logo stays clear of the buttons that float over it)
      // (639px and under is exactly where this template switches to its phone menu, measured 19 Nov 2026)
      '@media (max-width:' + PHONE_MAX + 'px){html.pe-burger #mobile-navigation-label,html.pe-burger #mobile-navigation>ul{visibility:hidden!important}' +
      'html.pe-burger #mobile-navigation>ul{display:none!important}' +
      // Search moves to the centre of the top bar
      'html.pe-burger .pe-search-btn{left:50%!important;right:auto!important;transform:translateX(-50%)}' +
      'html.pe-burger #pe-burger{display:flex}}' +
      // The hamburger button: the same 40px pill as the dark mode switch, top right
      '#pe-burger{display:none;position:fixed;top:12px;right:16px;z-index:9999;width:40px;height:40px;padding:0;border-radius:20px;' +
        'border:1px solid #dcdcdc;background:#fff;color:#111;cursor:pointer;align-items:center;justify-content:center;-webkit-tap-highlight-color:transparent}' +
      'html.pe-dark #pe-burger{background:#ECEDEF;border-color:#ECEDEF;color:#141518}' +
      '#pe-burger svg{display:block}' +
      // The dimmed page behind the open panel
      '#pe-menu-shade{position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.45);opacity:0;visibility:hidden;transition:opacity .25s,visibility .25s}' +
      // The panel itself: slides in from the right, full height, scrolls if the menu is long
      '#pe-menu{position:fixed;top:0;right:0;bottom:0;z-index:10001;width:min(86vw,360px);background:#fff;color:#111;' +
        'transform:translateX(100%);visibility:hidden;transition:transform .28s ease,visibility .28s;overflow-y:auto;-webkit-overflow-scrolling:touch;' +
        'font-family:"Open Sans",sans-serif;box-shadow:-8px 0 24px rgba(0,0,0,.18);overscroll-behavior:contain}' +
      'html.pe-menu-open #pe-menu{transform:none;visibility:visible}' +
      'html.pe-menu-open #pe-menu-shade{opacity:1;visibility:visible}' +
      'html.pe-menu-open,html.pe-menu-open body{overflow:hidden!important}' +
      // Panel top row: the word Menu and the close button
      '#pe-menu .pe-m-top{display:flex;align-items:center;justify-content:space-between;padding:12px 16px 12px 20px;border-bottom:1px solid #e6e6e6}' +
      '#pe-menu .pe-m-title{font-weight:700;font-size:13px;letter-spacing:.08em;text-transform:uppercase;opacity:.6}' +
      '#pe-menu .pe-m-close{width:40px;height:40px;border:0;background:transparent;color:inherit;cursor:pointer;display:flex;align-items:center;justify-content:center;border-radius:20px;padding:0}' +
      // Menu rows
      '#pe-menu ul{list-style:none;margin:0;padding:0}' +
      '#pe-menu li{margin:0;padding:0;border-bottom:1px solid #eee}' +
      '#pe-menu .pe-m-row{display:flex;align-items:stretch}' +
      '#pe-menu a{display:flex;align-items:center;flex:1;min-height:52px;padding:0 20px;color:inherit!important;text-decoration:none!important;' +
        'font-weight:600;font-size:15px;letter-spacing:.04em;text-transform:uppercase;border-left:4px solid transparent}' +
      '#pe-menu a.pe-m-here{border-left-color:' + ORANGE + '}' +
      // The arrow that opens a dropdown section
      '#pe-menu .pe-m-more{width:56px;border:0;border-left:1px solid #eee;background:transparent;color:inherit;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0}' +
      '#pe-menu .pe-m-more svg{transition:transform .2s}' +
      '#pe-menu li.pe-m-open>.pe-m-row .pe-m-more svg{transform:rotate(180deg)}' +
      // Dropdown items: hidden until opened, normal case, slightly indented
      '#pe-menu .pe-m-sub{display:none;background:#f6f6f6}' +
      '#pe-menu li.pe-m-open>.pe-m-sub{display:block}' +
      '#pe-menu .pe-m-sub li{border-bottom:0;border-top:1px solid #ebebeb}' +
      '#pe-menu .pe-m-sub a{min-height:46px;padding-left:36px;font-weight:400;text-transform:none;letter-spacing:0}' +
      // Dark mode colours (the site's own dark palette)
      'html.pe-dark #pe-menu{background:#1D1F23;color:#E6E7EA}' +
      'html.pe-dark #pe-menu .pe-m-top,html.pe-dark #pe-menu li,html.pe-dark #pe-menu .pe-m-more{border-color:#33363C}' +
      'html.pe-dark #pe-menu .pe-m-sub{background:#141518}' +
      'html.pe-dark #pe-menu .pe-m-sub li{border-color:#2A2D32}' +
      // Readers who ask their phone for less motion get no slide
      '@media (prefers-reduced-motion:reduce){#pe-menu,#pe-menu-shade,#pe-menu .pe-m-more svg{transition:none}}'
    : '');

  function addCss() {
    if (document.getElementById('pe-menu-css')) return;
    var st = document.createElement('style');
    st.id = 'pe-menu-css';
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  // ---- Separators: strip the typed pipes, then switch the drawn ones on (same moment, so never two) ----
  function doSeparators() {
    stripPipes();
    if (SEPARATORS) document.documentElement.classList.add('pe-seps');
  }

  // ---- Hamburger menu ----
  var ICON_BURGER = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/></svg>';
  var ICON_CLOSE = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>';
  var ICON_DOWN = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>';

  var burger, panel, shade, lastFocus = null, pushedState = false, pendingHref = null;

  // Is this link the page we're on? (matches the path, ignoring a trailing slash)
  function isHere(href) {
    try {
      var u = new URL(href, location.href);
      if (u.host !== location.host) return false;
      var a = u.pathname.replace(/\/$/, '') || '/', b = location.pathname.replace(/\/$/, '') || '/';
      return a === b;
    } catch (e) { return false; }
  }

  // Make one menu link for the panel
  function makeLink(a) {
    var link = document.createElement('a');
    link.href = a.getAttribute('href') || '#';
    link.textContent = cleanName(a.textContent);
    if (isHere(link.href)) { link.className = 'pe-m-here'; link.setAttribute('aria-current', 'page'); }
    return link;
  }

  // Build the panel's list from the desktop menu (#nav), dropdowns included
  function buildList() {
    var ul = document.createElement('ul');
    var items = document.querySelectorAll('#nav > li');
    for (var i = 0; i < items.length; i++) {
      var top = items[i].querySelector(':scope > a');
      if (!top) continue;
      var li = document.createElement('li');
      var row = document.createElement('div');
      row.className = 'pe-m-row';
      row.appendChild(makeLink(top));
      li.appendChild(row);

      var subLinks = items[i].querySelectorAll('.subnav a');
      if (subLinks.length) {
        // A dropdown section: an arrow button to open it, and the list of its pages
        var sub = document.createElement('ul');
        sub.className = 'pe-m-sub';
        sub.id = 'pe-m-sub-' + i;
        var openIt = false;
        for (var j = 0; j < subLinks.length; j++) {
          var sli = document.createElement('li');
          var sa = makeLink(subLinks[j]);
          if (sa.className === 'pe-m-here') openIt = true;   // open the section holding the current page
          sli.appendChild(sa);
          sub.appendChild(sli);
        }
        var more = document.createElement('button');
        more.type = 'button';
        more.className = 'pe-m-more';
        more.setAttribute('aria-controls', sub.id);
        more.setAttribute('aria-label', 'Show pages in ' + cleanName(top.textContent));
        more.innerHTML = ICON_DOWN;
        row.appendChild(more);
        li.appendChild(sub);
        setOpen(li, more, openIt);
        more.addEventListener('click', (function (li, more) {
          return function () { setOpen(li, more, !li.classList.contains('pe-m-open')); };
        })(li, more));
      }
      ul.appendChild(li);
    }
    return ul;
  }

  function setOpen(li, btn, open) {
    li.classList.toggle('pe-m-open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function build() {
    if (document.getElementById('pe-burger') || !document.querySelector('#nav > li')) return false;

    // The three-line button
    burger = document.createElement('button');
    burger.id = 'pe-burger';
    burger.type = 'button';
    burger.setAttribute('aria-label', 'Open menu');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-controls', 'pe-menu');
    burger.innerHTML = ICON_BURGER;

    // The dimmed page behind the panel; a tap on it closes the menu
    shade = document.createElement('div');
    shade.id = 'pe-menu-shade';

    // The panel
    panel = document.createElement('nav');
    panel.id = 'pe-menu';
    panel.setAttribute('aria-label', 'Site menu');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    var topRow = document.createElement('div');
    topRow.className = 'pe-m-top';
    topRow.innerHTML = '<span class="pe-m-title">Menu</span>';
    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'pe-m-close';
    close.setAttribute('aria-label', 'Close menu');
    close.innerHTML = ICON_CLOSE;
    topRow.appendChild(close);
    panel.appendChild(topRow);
    panel.appendChild(buildList());

    document.body.appendChild(burger);
    document.body.appendChild(shade);
    document.body.appendChild(panel);

    burger.addEventListener('click', function () { isOpen() ? closeMenu() : openMenu(); });
    close.addEventListener('click', function () { closeMenu(); });
    shade.addEventListener('click', function () { closeMenu(); });

    // A tap on a page link: take back the history step the menu added (so Back from the new page goes to
    // the page the reader was on, not to an empty copy of it), then go to the link
    panel.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a');
      if (!a) return;
      if (pushedState && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        pendingHref = a.href;
        pushedState = false;
        try { history.back(); } catch (err) { location.href = pendingHref; }
        setTimeout(function () { if (pendingHref) location.href = pendingHref; }, 400);   // in case Back is slow
      } else closeMenu(true);
    });

    // Keyboard: Esc closes; Tab stays inside the panel while it's open
    document.addEventListener('keydown', function (e) {
      if (!isOpen()) return;
      if (e.key === 'Escape') { e.preventDefault(); closeMenu(); return; }
      if (e.key === 'Tab') {
        var f = panel.querySelectorAll('a,button');
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });

    // The phone's back gesture closes the menu instead of leaving the page
    window.addEventListener('popstate', function () {
      if (pendingHref) { var h = pendingHref; pendingHref = null; location.href = h; return; }
      if (isOpen()) { pushedState = false; closeMenu(true); }
    });
    return true;
  }

  function isOpen() { return document.documentElement.classList.contains('pe-menu-open'); }

  function openMenu() {
    lastFocus = document.activeElement;
    document.documentElement.classList.add('pe-menu-open');
    burger.setAttribute('aria-expanded', 'true');
    // Add a history step so the back gesture has something to close
    try { history.pushState({ peMenu: 1 }, ''); pushedState = true; } catch (e) {}
    setTimeout(function () { var c = panel.querySelector('.pe-m-close'); if (c) c.focus(); }, 50);
  }

  // leaving = true when the reader tapped a link, so the history step is left alone
  function closeMenu(leaving) {
    if (!isOpen()) return;
    document.documentElement.classList.remove('pe-menu-open');
    burger.setAttribute('aria-expanded', 'false');
    if (pushedState && !leaving) { pushedState = false; try { history.back(); } catch (e) {} }
    if (!leaving && lastFocus && lastFocus.focus) lastFocus.focus();
  }

  // Hamburger on: the html.pe-burger class switches the phone styles on (only below PHONE_MAX, by the CSS),
  // and the panel closes itself if the screen is turned or widened past that point while it's open
  function startBurger() {
    if (!BURGER || !build()) return;
    document.documentElement.classList.add('pe-burger');
    var mq = window.matchMedia('(max-width:' + PHONE_MAX + 'px)');
    var onChange = function () { if (!mq.matches && isOpen()) closeMenu(); };
    if (mq.addEventListener) mq.addEventListener('change', onChange); else if (mq.addListener) mq.addListener(onChange);
  }

  function start() {
    addCss();
    doSeparators();
    startBurger();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
  // Run the strip again once everything has loaded, in case Squarespace redrew a menu late
  window.addEventListener('load', stripPipes);
})();
} catch (e) { if (window.console) console.warn('Production Expert script failed: menu separators and hamburger menu', e); }


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
  var ORDER = ['.pe-byline', '.pe-partner-label', '.pe-badge', '.pe-contents'];   // v9.8: phone byline first
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
  addEventListener('pe-byline-ready', run);   // v9.8: the byline arrives after the bios load
})();
} catch (e) { if (window.console) console.warn('Production Expert script failed: placement for the top-of-article boxes', e); }

/* ================================================================
 * Production Expert: fill blank article cards (v4.7, 2 Nov 2026)
 * Since about midday on 2 Nov 2026 Squarespace drops a post's hero (its "promoted block") whenever
 * the post is saved, so a card for that post in a summary block (the homepage grid, blog lists)
 * comes out with no picture unless someone has set the Featured Image on the Options tab. Found
 * on Krotos Studio 3.0, then on CodWaves Quance after an evening edit to a post that had been fine.
 * For any card without a picture, this fetches the article and gives the card its hero: the
 * promoted image if there is one, otherwise the first image in the body. The card is built the way
 * Squarespace builds its own (summary-thumbnail-outer-container, 16:9, cover crop), so the
 * homepage's other scripts and styles treat it like any other card.
 * - Fixes what readers see only. Facebook and search engines read the page before scripts run, so
 *   the Featured Image is still the real fix (Joe's Place as hero sets it, the checks warn).
 * - Skips cards that already have a picture, and leaves the editor alone.
 * ================================================================ */
try {
(function () {
  try { if ((window.top !== window && !window.PE_FC_PREVIEW)) return; } catch (e) { return; }   // not in the editor
  var done = {};                       // one fetch per article, shared by its cards

  function heroOf(url) {
    return fetch(url + (url.indexOf('?') < 0 ? '?' : '&') + 'format=json', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        var it = d && d.item;
        if (!it) return null;
        var html = (it.promotedBlock || '') + (it.body || '');
        var m = html.match(/<img[^>]+data-src="([^"]+)"[^>]*>/i);
        if (!m) return null;
        var alt = (m[0].match(/alt="([^"]*)"/i) || [])[1] || it.title || '';
        return { src: m[1], alt: alt };
      })
      .catch(function () { return null; });
  }

  function fill(item, pic) {
    if (!pic || item.querySelector('.summary-thumbnail-outer-container')) return;
    var link = item.querySelector('a.summary-title-link, .summary-title a');
    var href = link ? link.getAttribute('href') : '#';
    var outer = document.createElement('div');
    outer.className = 'summary-thumbnail-outer-container pe-filled-thumb';
    outer.innerHTML =
      '<a class="summary-thumbnail-container sqs-gallery-image-container" href="' + href + '">' +
      '<div class="summary-thumbnail img-wrapper" style="position:relative;padding-bottom:56.25%;overflow:hidden">' +
      '<img class="summary-thumbnail-image loaded" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover" loading="lazy"></div></a>';
    var img = outer.querySelector('img');
    img.src = pic.src + (pic.src.indexOf('?') < 0 ? '?format=1000w' : '');
    img.alt = pic.alt;
    item.insertBefore(outer, item.firstChild);
    item.classList.add('summary-item-has-thumbnail');
    // the grid lays cards out by height; ask it to measure again
    setTimeout(function () { try { window.dispatchEvent(new Event('resize')); } catch (e) {} }, 60);
  }

  function run() {
    Array.prototype.forEach.call(document.querySelectorAll('.summary-item'), function (item) {
      if (item.querySelector('.summary-thumbnail-outer-container img, .summary-thumbnail img')) return;
      var link = item.querySelector('a.summary-title-link, .summary-title a');
      var href = link && link.getAttribute('href');
      if (!href || href.charAt(0) !== '/' || item.dataset.peFill) return;   // each card once
      item.dataset.peFill = '1';
      (done[href] = done[href] || heroOf(href)).then(function (pic) { fill(item, pic); });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
  addEventListener('load', run);
  setTimeout(run, 2000);
  addEventListener('mercury:load', function () { setTimeout(run, 100); });
})();
} catch (e) { if (window.console) console.warn('Production Expert script failed: fill blank article cards', e); }
