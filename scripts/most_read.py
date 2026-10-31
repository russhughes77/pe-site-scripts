"""
Most read: writes most-read.json for the homepage MOST READ label (pe-site.js v2.8).

Runs each morning from .github/workflows/most-read.yml. Asks Plausible for
yesterday's pageviews (UK date) for the top 500 pages and saves them as
{"date": "2026-10-30", "pages": [{"p": "/path", "v": 1234}, ...]}.

The homepage script then ranks the stories it is showing by these numbers and
labels the top three. Old evergreen articles can sit in this list too; they
simply never match a homepage card.

Needs the PLAUSIBLE_API_KEY secret (Plausible: Settings, API Keys, Stats API).
PLAUSIBLE_SITE_ID defaults to production-expert.com. If the key is missing or
Plausible fails, the file is left as it was and the job reports why.
"""
import datetime
import json
import os
import sys
import urllib.error
import urllib.request
from zoneinfo import ZoneInfo

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "most-read.json")
API = "https://plausible.io/api/v2/query"
LIMIT = 500

# Pages that are never stories
SKIP_EXACT = {"/", "/search", "/production-expert-1", "/partner-deals"}
SKIP_PREFIX = ("/tag/", "/category/", "/production-expert-1/tag/", "/production-expert-1/category/")


def main():
    key = os.environ.get("PLAUSIBLE_API_KEY", "").strip()
    site = os.environ.get("PLAUSIBLE_SITE_ID", "").strip() or "production-expert.com"
    if not key:
        print("::warning::PLAUSIBLE_API_KEY is not set, so most-read.json was not updated.")
        return 0

    day = (datetime.datetime.now(ZoneInfo("Europe/London")).date() - datetime.timedelta(days=1)).isoformat()
    query = {
        "site_id": site,
        "metrics": ["pageviews"],
        "date_range": [day, day],
        "dimensions": ["event:page"],
        "order_by": [["pageviews", "desc"]],
        "pagination": {"limit": LIMIT, "offset": 0},
    }
    req = urllib.request.Request(
        API,
        data=json.dumps(query).encode(),
        headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            data = json.load(r)
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")[:300]
        print(f"::error::Plausible returned {e.code} for site {site}: {detail}")
        return 1
    except Exception as e:  # network trouble
        print(f"::error::Could not reach Plausible: {e}")
        return 1

    pages = []
    for row in data.get("results", []):
        p = (row.get("dimensions") or [""])[0].split("?")[0].rstrip("/") or "/"
        v = int((row.get("metrics") or [0])[0] or 0)
        if v <= 0 or p in SKIP_EXACT or p.startswith(SKIP_PREFIX):
            continue
        pages.append({"p": p, "v": v})

    with open(OUT, "w") as f:
        json.dump({"date": day, "site": site, "pages": pages}, f, separators=(",", ":"))
        f.write("\n")
    top = ", ".join(f"{x['p']} ({x['v']})" for x in pages[:3])
    print(f"Wrote {len(pages)} pages for {day}. Top: {top}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
