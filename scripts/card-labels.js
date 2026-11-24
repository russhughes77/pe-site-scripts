/*
 * Card labels: writes card-labels.json for the homepage card labels (pe-site.js v9.3).
 *
 * Runs from .github/workflows/card-labels.yml. Does what the homepage used to do in every
 * visitor's browser: reads the site's own blog feeds (Free, Updated, Deal, Review and News
 * categories and tags, the Partner Deals blog, and the newest 60 posts for anything with
 * "review" in a category or tag) and saves which article paths belong under which label:
 *   {"generated": "...", "labels": [{"text": "Free", "items": [{"p": "/path", "e": "2026-11-30"}]}]}
 * "e" is a deal's end date when one can be found, and the homepage drops the DEAL label from
 * the day after it, in the reader's own time zone, as before.
 *
 * The LABELS list and the date reading are copies of the ones in pe-site.js (section
 * "NEWS, FREE, DEAL and REVIEW labels"). Change a rule there and change it here too.
 *
 * If a feed can't be read (a server error or no connection), the file is left as it was and the job
 * reports why. A category or tag that doesn't exist simply has no posts.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const SITE = process.env.HERO_SITE || 'https://www.production-expert.com';
const OUT = process.env.CARD_LABELS_OUT || path.join(__dirname, '..', 'card-labels.json');
const BASE = '/production-expert-1?format=json&';
const REFRESH_HOURS = 20;

// In priority order, as in pe-site.js. Only the lookups matter here; priority is applied by the homepage.
const LABELS = [
  { text: 'Free', names: ['Free', 'Free Plugins', 'Free Plugin', 'Freebies'] },
  { text: 'Updated', names: ['Updated'] },
  { text: 'Deal', names: ['Deal', 'Deals', 'Partner Deals'], blogs: ['/partner-deals'], dropEnded: true },
  { text: 'Review', names: ['Review', 'Reviews', 'Expert Review', 'Expert Reviews', 'Product Review', 'Product Reviews'],
    match: /\breview/i, skip: /\b(year|month|week)s?\s+in\s+review\b/i },
  { text: 'News', names: ['News'] },
];

class FeedError extends Error {}

function pathOf(u) {
  try { return new URL(u, SITE).pathname.replace(/\/$/, ''); } catch (e) { return ''; }
}

async function getJson(url) {
  let r;
  try {
    r = await fetch(url.startsWith('http') ? url : SITE + url, {
      headers: { 'User-Agent': 'pe-site-scripts card labels job', Accept: 'application/json' },
    });
  } catch (e) { throw new FeedError(`${url}: ${e.message}`); }
  if (r.status >= 500 || r.status === 429) throw new FeedError(`${url}: HTTP ${r.status}`);
  if (!r.ok) return { items: [] };            // a category or tag that doesn't exist
  try { return await r.json(); } catch (e) { return { items: [] }; }
}

// ---- Deal end dates: copied from pe-site.js ----
const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11 };
function mon(w) { w = (w || '').toLowerCase(); return MONTHS[w.slice(0, 4)] !== undefined ? MONTHS[w.slice(0, 4)] : MONTHS[w.slice(0, 3)]; }

function readDate(t, pub) {
  let m, d, mo, y;
  if ((m = /\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b/.exec(t))) {
    d = +m[1]; mo = +m[2] - 1; y = +m[3];
  } else if ((m = /\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([a-z]{3,9})\.?(?:,?\s+(\d{4}))?/i.exec(t)) && mon(m[2]) !== undefined) {
    d = +m[1]; mo = mon(m[2]); y = m[3] ? +m[3] : 0;
  } else if ((m = /\b([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?/i.exec(t)) && mon(m[1]) !== undefined) {
    d = +m[2]; mo = mon(m[1]); y = m[3] ? +m[3] : 0;
  } else return null;
  if (y && y < 100) y += 2000;
  if (!(d >= 1 && d <= 31 && mo >= 0 && mo <= 11)) return null;
  const p = pub ? new Date(pub) : new Date();
  if (!y) {
    y = p.getFullYear();
    if (new Date(y, mo, d) < new Date(p.getFullYear(), p.getMonth(), p.getDate())) y++;
  }
  return new Date(y, mo, d);
}

function endDate(i) {
  let m;
  const tags = i.tags || [];
  for (let k = 0; k < tags.length; k++) {
    if ((m = /^ends-(\d{4})-(\d{2})-(\d{2})$/i.exec(tags[k]))) return new Date(+m[1], +m[2] - 1, +m[3]);
  }
  const body = String(i.body || '').replace(/<[^>]+>/g, '\n').replace(/&nbsp;/g, ' ');
  if ((m = /#(?:expires|offer\s+ends)\s*:?\s*([^\n]{1,40})/i.exec(body))) {
    const dt = readDate(m[1], i.publishOn);
    if (dt) return dt;
  }
  if ((m = /\bend(?:s|ing)?\s+(?:on\s+)?([^|]{3,30})/i.exec(i.title || ''))) return readDate(m[1], i.publishOn);
  return null;
}

function iso(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// ---- The lookups: same as the homepage's ----
function urls(j) {
  return (j.items || []).map((i) => {
    if (!i.fullUrl) return null;
    const e = endDate(i);
    return { p: pathOf(i.fullUrl), e: e ? iso(e) : '' };
  });
}

async function feed(q) { return urls(await getJson(BASE + q)); }

async function blogFeed(b) {
  const j = await getJson(b + '?format=json');
  const first = urls(j);
  const next = j.pagination && j.pagination.nextPage && j.pagination.nextPageUrl;
  if (!next) return first;
  const j2 = await getJson(next + (next.indexOf('?') < 0 ? '?' : '&') + 'format=json');
  return first.concat(urls(j2));
}

async function matchFeed(L) {
  const keep = (j) => (j.items || []).filter((i) =>
    (i.categories || []).concat(i.tags || []).some((n) => L.match.test(n) && !(L.skip && L.skip.test(n)))
  ).map((i) => (i.fullUrl ? { p: pathOf(i.fullUrl), e: '' } : null));
  let url = BASE.replace(/&$/, ''), out = [];
  for (let left = 3; left > 0; left--) {
    const j = await getJson(url);
    out = out.concat(keep(j));
    const next = j.pagination && j.pagination.nextPage && j.pagination.nextPageUrl;
    if (!next) break;
    url = next + (next.indexOf('?') < 0 ? '?' : '&') + 'format=json';
  }
  return out;
}

// Run the lookups a few at a time, so the site isn't hit with 30 requests at once
async function pool(tasks, size) {
  const out = new Array(tasks.length);
  let n = 0;
  await Promise.all(Array.from({ length: size }, async () => {
    while (n < tasks.length) { const i = n++; out[i] = await tasks[i](); }
  }));
  return out;
}

async function main() {
  const labels = [];
  for (const L of LABELS) {
    const tasks = [];
    L.names.forEach((n) => {
      const v = encodeURIComponent(n);
      tasks.push(() => feed('category=' + v), () => feed('tag=' + v));
    });
    (L.blogs || []).forEach((b) => tasks.push(() => blogFeed(b)));
    if (L.match) tasks.push(() => matchFeed(L));
    const lists = await pool(tasks, 4);
    const seen = new Map();
    [].concat(...lists).forEach((x) => { if (x && x.p && !seen.has(x.p)) seen.set(x.p, x.e); });
    labels.push({ text: L.text, items: [...seen].map(([p, e]) => (e ? { p, e } : { p })) });
  }

  let old = null;
  try { old = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) {}
  const now = new Date();
  if (old && JSON.stringify(old.labels) === JSON.stringify(labels) &&
      now - Date.parse(old.generated) < REFRESH_HOURS * 36e5) {
    console.log('No change.');
    return;
  }
  fs.writeFileSync(OUT, JSON.stringify({ generated: now.toISOString().replace(/\.\d+Z$/, '+00:00'), labels }));
  console.log('Saved: ' + labels.map((l) => `${l.text} ${l.items.length}`).join(', '));
}

main().catch((e) => {
  console.error(`::error::Could not read the site's feeds (${e.message}), so card-labels.json was left as it was.`);
  process.exit(1);
});
