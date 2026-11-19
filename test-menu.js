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
      'html.pe-seps #nav>li:not(:last-child)::after{content:"|";margin-left:.35em;opacity:.55;pointer-events:none}' : '') +
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

