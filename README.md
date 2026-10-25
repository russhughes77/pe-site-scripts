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

1. Change `pe-site.js`.
2. Rebuild the compressed copy: `npx terser pe-site.js -c -m -o pe-site.min.js`
3. Commit both files to `main`. GitHub Pages republishes in about a minute.

Each section is fenced off, so a fault in one never stops the others. The placement section must stay last.
The editor guard stays in the Squarespace Header box, because it has to run before the page draws.
