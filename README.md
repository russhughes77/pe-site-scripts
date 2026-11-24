# Production Expert site scripts

The scripts behind production-expert.com: read time, contents box, partner label, author bio,
Related Content, Comments label, useful vote, newsletter sign-up, the team's pre-publish checklist,
site search and the placement of the top-of-article boxes.

## How it's loaded

Squarespace > Settings > Advanced > Code Injection > Footer has one line:

```html
<script src="https://russhughes77.github.io/pe-site-scripts/pe-site.min.js"></script>
```

GitHub Pages serves this repository. Browsers keep a copy for 10 minutes, so a change reaches
everyone within about 10 minutes of being pushed. (jsDelivr was tried first, but it tells browsers
to keep their copy for 7 days.)

## Making a change

1. Change `pe-site.js` (reader scripts) or `pe-checklist.js` (checklist, Joe, panel).
2. Rebuild the compressed copy of each file you changed:
   `npx terser pe-site.js -c -m -o pe-site.min.js` and `npx terser pe-checklist.js -c -m -o pe-checklist.min.js`
3. Commit the changed files, source and compressed copy together, to `main`. GitHub Pages republishes in about a minute.

From v9.0 the team-only code (the pre-publish checklist, Joe and the panel, about 5,000 lines) lives in
`pe-checklist.js` / `pe-checklist.min.js` in the same folder. `pe-site.js` holds a small loader that fetches it
only for the team (a signed-in Squarespace account, the Squarespace editor, or a browser switched on with
`?checklist`), so readers download about 113 KB instead of 267 KB.

Each section is fenced off, so a fault in one never stops the others. The placement section must stay last.
The editor guard stays in the Squarespace Header box, because it has to run before the page draws.

## Homepage hero list

From v9.1 the homepage hero reads `heroes.json`, a short list of the Hero-tagged articles with their pictures
already picked out. The **Heroes** workflow (`.github/workflows/heroes.yml`, `scripts/heroes.py`) rewrites it
every 30 minutes, committing only when the list changes (and once a day to show it is still running). To put a
newly tagged article on the homepage at once, run it from the Actions tab: **Heroes**, then **Run workflow**.
If `heroes.json` is missing, unreadable or older than 3 days, the homepage falls back to the blog feed as before.

From v9.2 the same job also saves a compressed WebP copy of each tagged article's picture in `heroes/`
(about three widths each, named `<id>-<width>.webp`) and lists them in `heroes.json`. The homepage uses these
instead of the original, which can be a heavy PNG. If a copy is missing or fails to load, the original is used.
Pictures that leave the list are deleted by the job. Hand-made slides keep their own pictures.

## Homepage card labels

From v9.3 the FREE, UPDATED, DEAL, REVIEW and NEWS labels on homepage cards come from `card-labels.json`, written
every 30 minutes by the **Card labels** workflow (`.github/workflows/card-labels.yml`, `scripts/card-labels.js`).
The label rules exist in two places: the `LABELS` list and deal end-date reading in `pe-site.js` (the fallback, and
the part that applies priority and drops ended deals in the reader's time zone) and the copy of the lookups in
`scripts/card-labels.js`. Change a rule in both. To get a change onto the homepage at once, run the workflow from the
Actions tab. If the file is missing, unreadable or older than 3 days, the homepage reads the blog feeds itself as before.

## Versions and rolling back

Joe shows the version beside its name (for example JOE v1.0), and the browser console logs it.
The history, with the commit for each version, is in the comment above `PE_VERSION`, which lives in
`pe-checklist.js` from v9.0 (it was in `pe-site.js` before).

- With every push, raise `PE_VERSION`, start the commit message with the version ("v1.1: ..."),
  and add the commit to the history once pushed.
- To roll back, copy pe-site.js, pe-site.min.js, pe-checklist.js and pe-checklist.min.js (the last two exist
  from v9.0 on) from that version's commit back onto main and push. Everyone has the old version within about 10 minutes.
- **Easiest:** the **Switch version** workflow (Actions tab > Switch version > Run workflow, type the version,
  for example `v6.6`, then Run workflow). It does exactly that, and switching forward again works the same way.
  Direct link: https://github.com/russhughes77/pe-site-scripts/actions/workflows/switch-version.yml

## Most read (v2.8)
`most-read.json` holds yesterday's pageviews by page from Plausible. The "Most read" workflow
(.github/workflows/most-read.yml, scripts/most_read.py) rewrites it at 05:07 UTC each day. It needs
the repository secret PLAUSIBLE_API_KEY (Plausible Stats API key); set the repository variable
PLAUSIBLE_SITE_ID only if the site isn't registered as production-expert.com. Without the key the
file stays empty and no MOST READ labels appear.
