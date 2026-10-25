# Production Expert site scripts

The scripts behind production-expert.com: read time, contents box, partner label, author bio,
Related Content, Comments label, useful vote, newsletter sign-up, the team's pre-publish checklist,
site search and the placement of the top-of-article boxes.

## How it's loaded

Squarespace > Settings > Advanced > Code Injection > Footer has one line:

```html
<script src="https://cdn.jsdelivr.net/gh/russhughes77/pe-site-scripts@main/pe-site.min.js"></script>
```

jsDelivr serves `pe-site.js` from this repository, minified, from servers worldwide.

## Making a change

1. Change `pe-site.js` here and commit it to `main`.
2. Open this link to make jsDelivr pick up the new version straight away:
   https://purge.jsdelivr.net/gh/russhughes77/pe-site-scripts@main/pe-site.min.js
3. Reload the site. Without step 2, jsDelivr picks up the change on its own within 12 hours.

Each section is fenced off, so a fault in one never stops the others. The placement section must stay last.
The editor guard stays in the Squarespace Header box, because it has to run before the page draws.
