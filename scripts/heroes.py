"""
Heroes: writes heroes.json for the homepage hero (pe-site.js v9.1).

Runs from .github/workflows/heroes.yml. Asks the blog for the articles tagged "Hero", picks
out each one's picture the same way the homepage script always has, and saves a short list:
{"generated": "...", "tag": "Hero", "items": [{"url", "title", "src", "fx", "fy", "w", "on", "img", "ws"}, ...]}

Lean pictures (v9.2): each article's picture is downloaded, compressed to WebP at up to three
widths and saved in heroes/ (named heroes/<id>-<width>.webp). "img" is the id and "ws" the widths
saved. The homepage uses these in place of the original, which can be a heavy PNG. If a picture
can't be fetched or converted the item has no "img" and the homepage uses the original as before.
Pictures no longer in the list are deleted.

The homepage then reads this small file instead of the whole blog feed, so the first hero
picture can start loading much sooner.

If the blog can't be reached, or answers with something that isn't a feed, the file is left as it
was and the job reports why. A feed with no tagged articles is a real answer and is saved as an
empty list. The file is only rewritten when the list changes, or once a day so the homepage can
tell the job is still running.
"""
import datetime
import hashlib
import io
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.environ.get("HEROES_OUT") or os.path.join(ROOT, "heroes.json")
SITE = os.environ.get("HERO_SITE", "https://www.production-expert.com")
BLOG = "/production-expert-1"
TAG = "Hero"
MIN_WIDTH = 1500      # same number as the homepage script and the pre-publish checks
KEEP = 10             # the homepage shows five, but some may be skipped there
REFRESH_HOURS = 20    # rewrite at least this often, so "generated" shows the job is alive
LEAN_DIR = os.environ.get("HEROES_DIR") or os.path.join(ROOT, "heroes")
WIDTHS = (750, 1500, 2500)   # sizes made; the picture's own width is added when it falls between
QUALITY = 80
LEAN_ITEMS = 6        # only the first few are made lean; the homepage shows five


def picture_of(it):
    """The article's picture, read the way pe-site.js does: first image in the promoted block
    or body, else the Featured Image. Returns a dict, or None."""
    html = (it.get("promotedBlock") or "") + (it.get("body") or "")
    m = re.search(r'<img[^>]+data-src="([^"]+)"[^>]*>', html, re.I)
    if m:
        tag = m.group(0)
        dims = re.search(r'data-image-dimensions="(\d+)x(\d+)"', tag, re.I)
        fp = re.search(r'data-image-focal-point="([\d.]+),([\d.]+)"', tag, re.I)
        return {
            "src": m.group(1).replace("&amp;", "&"),
            "w": int(dims.group(1)) if dims else 0,
            "fx": float(fp.group(1)) if fp else 0.5,
            "fy": float(fp.group(2)) if fp else 0.5,
        }
    # A post with no Featured Image still has an assetUrl, but it ends in a slash
    a = str(it.get("assetUrl") or "")
    if re.search(r"/[^/?]+\.[a-z0-9]{3,4}(\?|$)", a, re.I):
        f = it.get("mediaFocalPoint") or {}
        return {"src": a, "w": 0, "fx": f.get("x", 0.5), "fy": f.get("y", 0.5)}
    return None


def build(feed):
    rows = []
    for it in feed.get("items") or []:
        if not it.get("fullUrl"):
            continue
        p = picture_of(it)
        if not p:
            continue
        # A picture whose width is known and too small is skipped, as on the homepage.
        # Width 0 (a Featured Image) is measured by the homepage when it needs to be.
        if p["w"] and p["w"] < MIN_WIDTH:
            print(f"Skipped \"{it.get('title', '')}\": picture is {p['w']}px wide (needs {MIN_WIDTH}).")
            continue
        rows.append({
            "url": it["fullUrl"],
            "title": it.get("title") or "",
            "src": p["src"],
            "fx": p["fx"],
            "fy": p["fy"],
            "w": p["w"],
            "on": int(it.get("publishOn") or 0),
        })
    rows.sort(key=lambda r: r["on"], reverse=True)
    return rows[:KEEP]


def lean_id(src):
    """A short stable name for a picture, from its address."""
    return hashlib.sha1(src.encode()).hexdigest()[:12]


def lean_widths(w):
    ws = [x for x in WIDTHS if x <= w]
    if not ws or ws[-1] < min(w, WIDTHS[-1]):
        ws.append(min(w, WIDTHS[-1]))
    return ws


def make_lean(item):
    """Download the picture and save it as WebP at each width. Returns (id, widths) or None."""
    try:
        from PIL import Image
    except ImportError:
        print("::warning::Pillow is not installed, so no lean pictures were made.")
        return None
    pid = lean_id(item["src"])
    sep = "&" if "?" in item["src"] else "?"
    try:
        req = urllib.request.Request(item["src"] + sep + "format=2500w",
                                     headers={"User-Agent": "pe-site-scripts heroes job"})
        with urllib.request.urlopen(req, timeout=60) as r:
            data = r.read()
        im = Image.open(io.BytesIO(data))
        im.load()
    except Exception as e:  # any failure just means this one keeps its original picture
        print(f"::warning::Could not fetch \"{item['title']}\" picture ({e}); the original will be used.")
        return None
    if im.mode not in ("RGB", "RGBA"):
        im = im.convert("RGBA" if "transparency" in im.info else "RGB")
    w, h = im.size
    ws = lean_widths(w)
    made = []
    os.makedirs(LEAN_DIR, exist_ok=True)
    for tw in ws:
        path = os.path.join(LEAN_DIR, f"{pid}-{tw}.webp")
        if not os.path.exists(path):
            out = im if tw >= w else im.resize((tw, max(1, round(h * tw / w))), Image.LANCZOS)
            out.save(path, "WEBP", quality=QUALITY, method=6)
        made.append(tw)
    item["w"] = item["w"] or w   # a Featured Image's width is now known
    return pid, made


def tidy(items):
    """Delete lean pictures that no item in the list uses any more."""
    keep = set()
    for it in items:
        if it.get("img"):
            for tw in it.get("ws", []):
                keep.add(f"{os.path.basename(it['img'])}-{tw}.webp")
    if not os.path.isdir(LEAN_DIR):
        return
    for name in os.listdir(LEAN_DIR):
        if name.endswith(".webp") and name not in keep:
            os.remove(os.path.join(LEAN_DIR, name))


def main():
    url = f"{SITE}{BLOG}?format=json&tag={urllib.parse.quote(TAG)}"
    req = urllib.request.Request(url, headers={"User-Agent": "pe-site-scripts heroes job", "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            feed = json.load(r)
    except (urllib.error.URLError, ValueError, TimeoutError) as e:
        print(f"::error::Could not read the Hero feed ({e}), so heroes.json was left as it was.")
        return 1
    if not isinstance(feed, dict) or not isinstance(feed.get("items"), list):
        print("::error::The Hero feed did not look like a blog feed, so heroes.json was left as it was.")
        return 1

    items = build(feed)
    for it in items[:LEAN_ITEMS]:
        got = make_lean(it)
        if got:
            it["img"], it["ws"] = "heroes/" + got[0], got[1]
    tidy(items)
    now = datetime.datetime.now(datetime.timezone.utc)

    old = None
    try:
        with open(OUT) as f:
            old = json.load(f)
    except (OSError, ValueError):
        pass
    if old and old.get("items") == items:
        try:
            age = now - datetime.datetime.fromisoformat(old["generated"])
            if age < datetime.timedelta(hours=REFRESH_HOURS):
                print("No change.")
                return 0
        except (KeyError, ValueError):
            pass

    with open(OUT, "w") as f:
        json.dump({"generated": now.strftime("%Y-%m-%dT%H:%M:%S+00:00"), "tag": TAG, "items": items}, f,
                  separators=(",", ":"))
    print(f"Saved {len(items)} hero article(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
