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
 * - Testing: add ?pe-hero-tag=News to the homepage address to fill the tagged
 *   part from another tag. Only that browser tab sees it.
 * - Homepage only. Leaves the editor alone.
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
    key: 'pe-hero-v2'                 // this browser's copy of the last tagged list, for an instant start
  };

  try { if ((window.top !== window && !window.PE_FC_PREVIEW)) return; } catch (e) { return; }   // the Squarespace editor
  function isHome() { return document.body && document.body.classList.contains('homepage'); }

  // A test tag from the address (?pe-hero-tag=News), otherwise the real one
  var testTag = (location.search.match(/[?&]pe-hero-tag=([^&]+)/) || [])[1];
  var TAG = testTag ? decodeURIComponent(testTag.replace(/\+/g, ' ')) : C.tag;

  // The styles. The picture sits in its own layer inside the slide's link, so
  // clicks still go to the article, and the headline and its shading stay on top.
  // Squarespace's own picture is hidden on filled slides only.
  var CSS =
    '.pe-hero-filled > a{position:absolute !important;top:0;left:0;right:0;bottom:0;display:block;overflow:hidden}' +
    '.pe-hero-filled > a img.thumb-image{visibility:hidden !important}' +
    '.pe-hero-pic{position:absolute;top:0;left:0;right:0;bottom:0;background-size:cover;' +
      'background-repeat:no-repeat;opacity:0;transition:opacity .4s ease}' +
    '.pe-hero-pic.pe-in{opacity:1}';

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
  function paint(s, h, w) {
    var a = s && s.querySelector('a');
    if (!a || !h) return;
    var href = full(h.url);
    if (s.getAttribute('data-pe-hero') === href) return;   // already showing this one
    a.href = href;
    s.setAttribute('data-click-through-url', href);
    s.setAttribute('data-pe-hero', href);
    var img = a.querySelector('img');
    if (img) img.alt = h.title;
    var t = s.querySelector('.meta-title');
    if (t) t.textContent = h.title;
    var pic = a.querySelector('.pe-hero-pic');
    if (!pic) { pic = document.createElement('div'); pic.className = 'pe-hero-pic'; a.appendChild(pic); }
    pic.classList.remove('pe-in');
    pic.style.backgroundPosition = (h.fx * 100) + '% ' + (h.fy * 100) + '%';
    var src = h.src + (h.src.indexOf('?') < 0 ? '?' : '&') + 'format=' + w + 'w';
    // Show the picture once it has loaded, so the slide never flashes empty. If it
    // has been swapped again in the meantime, this older picture is dropped.
    var im = new Image();
    im.onload = function () {
      if (s.getAttribute('data-pe-hero') !== href) return;
      pic.style.backgroundImage = 'url("' + src.replace(/"/g, '%22') + '")';
      s.classList.add('pe-hero-filled');
      requestAnimationFrame(function () { pic.classList.add('pe-in'); });
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

    function activeIndex() {
      for (var i = 0; i < n; i++) if (slides[i].classList.contains('sqs-active-slide')) return i;
      return 0;
    }

    // As many entries as slides, or fewer: no rotation needed, each slide gets one
    if (T <= n) {
      list.forEach(function (h, i) { paint(slides[i], h, w); });
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

    function prepareAround(b) {
      var k = slot[b];
      var next = (b + 1) % n, prev = (b - 1 + n) % n;
      slot[next] = (k + 1) % T;
      paint(slides[next], list[slot[next]], w);
      if (prev !== next) {                     // two slides only: the forward one wins
        slot[prev] = (k - 1 + T) % T;
        paint(slides[prev], list[slot[prev]], w);
      }
    }

    prepareAround(a0);

    // Watch for the slideshow moving on (autoplay, arrows or a swipe)
    state.observer = new MutationObserver(function () {
      var b = activeIndex();
      if (b === state.active) return;
      state.active = b;
      clearTimeout(state.timer);
      state.timer = setTimeout(function () { prepareAround(state.active); }, C.swapDelay);
    });
    slides.forEach(function (s) { state.observer.observe(s, { attributes: true, attributeFilter: ['class'] }); });
  }

  // Hand-made slides and tagged articles in one list, in the order chosen in the settings
  function combine(manual, tagged) {
    return C.manualFirst ? manual.concat(tagged) : tagged.concat(manual);
  }

  function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

  function run() {
    if (!isHome()) return;
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
    fetchList(skip).then(function (tagged) {
      if (!testTag) ls({ t: Date.now(), list: tagged });
      if (!savedList || !same(savedList, tagged) || testTag) setup(gallery, combine(manual, tagged));
    }).catch(function (e) { try { console.warn('Hero: tag feed failed, hand-made slides only', e); } catch (x) {} });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
  addEventListener('mercury:load', function () { setTimeout(run, 100); });
})();
} catch (e) { if (window.console) console.warn('Production Expert script failed: homepage hero from the Hero tag', e); }
