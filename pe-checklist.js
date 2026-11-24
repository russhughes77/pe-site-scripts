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
    // 5.1: the Socials tick talks to the Partners script, which writes the posts (Content Manager > Socials).
    // The token is public, like the rest of this file: it only lets the panel ask for, or cancel, posts for this article.
    socials: 'https://script.google.com/macros/s/AKfycbw5_UxURgMgLtSdxdhYn6DeVtKtMkywtZ_8iL-Y8vt1A1S-Gci1NU8Acs9wJzHbx6k6/exec',
    socialsToken: 'pe-social-tick-1',
    // 5.7: Free Plug-in of the Week. Drafts made on the dashboard (Tools > Plug-in of the Week) wait here for a
    // blank post to be filled. The token is public, like the Socials one: it reads drafts and records which post holds one.
    potw: 'https://pe-related-answers.pages.dev/api/freeplugins/potw/',
    potwToken: 'pe-potw-1',
    // 6.6: partner fact-check review. The panel only reads where a review stands (public token, read only). Preparing
    // opens the team preview, which is behind the team sign-in, and hands the saved article to it by postMessage.
    fc: 'https://pe-related-answers.pages.dev/api/factcheck/',
    fcTeam: 'https://pe-related-answers.pages.dev/api/partners/factcheck/',
    fcOrigin: 'https://pe-related-answers.pages.dev',
    fcToken: 'pe-factcheck-1',
    // 8.7: Joe's advice. The writer's one line and the advice are kept here for the whole team.
    joe: 'https://pe-related-answers.pages.dev/api/joe/',
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
   *   1.3  30 Oct 2026  cdf8585  Image tab starts with Add image; Depositphotos search folded in, with a
   *                              sign-in reminder and a warning on files under 1000px wide
   *   1.4  30 Oct 2026  e05f2e9  Pixabay searched inside the Image tab; credit under the hero and Source URL
   *                              filled on Place as hero (needs the 30 Oct Pixabay Code.gs)
   *   1.5  30 Oct 2026  5d8a225  Typing in Joe's text boxes survives the checklist's redraws (Pixabay search,
   *                              file name, credit)
   *   1.6  30 Oct 2026  4e57de0  Place as hero waits for the new picture's asset id before moving on (fixes
   *                              pictures not sticking); credit waits for the caption box to be redrawn
   *   1.7  30 Oct 2026  c6c2348  Links tab rebuilt like the pe-internal-links skill: shortlist by subject,
   *                              Claude picks anchors in the writer's words (needs the 30 Oct links Code.gs)
   *   1.8  30 Oct 2026  d5a1126  Homepage: first ad moves below the first six articles on tablets and
   *                              desktops; stays under the hero on phones
   *   1.9  30 Oct 2026  99f02ef  Homepage ad move: finds the ad by the ad server's placeholder, as the
   *                              banner itself loads after the script runs (v1.8 never moved it)
   *   2.0  30 Oct 2026  d77accb  Homepage banners in the article grid: every 9 articles on desktop, every
   *                              8 on tablet, none within 4 of the end; phones unchanged
   *   2.1  30 Oct 2026  03c1ecd  Article title on the hero picture, bottom left, large white type; tag
   *                              "Title Above" opts an article out
   *   2.2  30 Oct 2026  657cc25  Orange NEWS label on news articles in the homepage's main article grid;
   *                              author photo in a circle under "Posted by" (tablet and desktop)
   *   2.3  30 Oct 2026  3267c59  NEWS label also on the news section further down the homepage
   *   2.4  30 Oct 2026  09653dc  Author list in Edit Post, Options, sorted A to Z
   *   2.5  31 Oct 2026  6929d79 FREE and DEAL labels on homepage cards alongside NEWS; FREE beats DEAL
   *                              beats NEWS when an article fits more than one
   *   2.6  31 Oct 2026  5d0b929 DEAL label now reads the Partner Deals blog itself; v2.5 only searched the
   *                              main blog, so deals never got the label. Label cache renamed to refresh
   *   2.7  31 Oct 2026  a069b04 DEAL label dropped from the day after a deal ends (ends- tag, #expires or
   *                              #offer ends line, or "Ends ..." in the title)
   *   2.8  31 Oct 2026  2131b9d MOST READ label on the three homepage stories with the most pageviews
   *                              yesterday (Plausible, via most-read.json); beats FREE, DEAL and NEWS
   *   2.9  31 Oct 2026  db4b6d9 Notes in the pre-publish checks fold away: click the NOTES heading.
   *                              Remembered per browser; open flags stay on show when shut
   *   3.0  31 Oct 2026  042ec40 Joe bar pinned to the foot of the checks panel on every stage (Open Joe,
   *                              a chip per tab, Bring to front when open); version in the panel title
   *   3.1   1 Nov 2026  c7d0dc3 Planned date from Mel's calendar (needs the Planned dates Code.gs), amber
   *                              Ahead of plan warning, Too soon warning under 5 minutes (works now)
   *   3.2   1 Nov 2026  7fd392c Sends the author with planned date requests; unconfirmed calendar
   *                              matches labelled "Matched to Mel's calendar by title"
   *   3.3   1 Nov 2026  e6ae9d1 Planned date box follows the stage: "Published …" with on plan / ahead /
   *                              later on live posts (no buttons), "Scheduled …" on scheduled posts;
   *                              "+ Add an embargo" hidden on live posts
   *   3.4   1 Nov 2026  4311424 Stale draft warning: a draft not edited for 4 weeks asks whether it can
   *                              be deleted
   *   3.5   1 Nov 2026  79d73b8 Overview score: how much a Google AI summary could give away. A line in
   *                              the checks panel that opens to a summary, and an Overview tab in Joe
   *                              (needs the Overview Code.gs). Advisory only, never a warning
   *   3.6   1 Nov 2026  8df5a5e Overview prompts shown on partner posts too, in line with editorial
   *                              policy: we add our own view to partner content
   *   3.7   1 Nov 2026  8ee3e8d Overview tab says "Nothing to add" when Joe returns no prompts (the
   *                              1 Nov Code.gs gives fewer than three when the draft doesn't need them)
   *   3.8   1 Nov 2026  31427db Overview counts embedded video and audio (Squarespace video and audio
   *                              blocks, YouTube, Vimeo, SoundCloud and other players) as items Claude
   *                              judges; our own clips count as ours and add up to 15 to the score.
   *                              Needs the 1 Nov late Code.gs
   *   3.9   1 Nov 2026  9388bcb Overview judges pictures in the body too (not the hero or ad banners):
   *                              our own screenshots and graphics count as ours and add 5. Needs the
   *                              1 Nov screenshots Code.gs
   *   4.0   1 Nov 2026  0333c6e Stale draft warning ignores saves that changed nothing (opening a draft
   *                              and closing it no longer resets its clock); goes by the History list
   *   4.1   2 Nov 2026  d0b0fc2 Squarespace stopped promoting a post's first image as its hero on save
   *                              (from about midday 2 Nov). Place as hero also fills Featured Image, and
   *                              the hero check warns when nothing reaches the homepage tile or Facebook
   *   4.2   2 Nov 2026  ac19bd9 Homepage hero headline lines up with the left edge of the article grid
   *                              at every window width; bottoms of g, p and y no longer cut off
   *   4.3   2 Nov 2026  bf6aea6 Live articles missing Squarespace's hero area get it rebuilt from the
   *                              opening image, so the hero runs edge to edge on phones again
   *   4.4   2 Nov 2026  60367c4 Phones: the article title on the hero and the homepage hero headline
   *                              line up with the text below them (were 16px from the screen edge,
   *                              text at 30px)
   *   4.5   2 Nov 2026  02cba92 Homepage on a light grey (#F6F6F6) with white story cards of equal
   *                              height in each row; tablet and desktop only
   *   4.6   2 Nov 2026  75c373c Grey homepage: gaps between cards set on the row, so hidden (expired)
   *                              deals no longer leave two Deals cards touching
   *   4.7   2 Nov 2026  9725745 Homepage and blog cards with no picture get the article's own hero,
   *                              so a post re-saved under Squarespace's hero bug never shows a blank tile
   *   4.8   3 Nov 2026  aaa015d Joe: suggestions can be highlighted and copied by hand, and every
   *                              suggestion has a Copy button beside Use
   *   4.9   4 Nov 2026  970b08b Homepage hero filled from the five newest articles tagged "Hero",
   *                              cropped on the focal point; pictures under 1500px wide skipped, and
   *                              the checks warn. Hero tag kept out of Related Content
   *   5.0   5 Nov 2026  d233115 REVIEW label on homepage cards for anything with "review" in a
   *                              category or tag (not Preview or Year In Review); order is MOST READ,
   *                              FREE, DEAL, REVIEW, NEWS
   *   5.1   6 Nov 2026  7f84086 Socials tick in the checks panel: asks for Instagram, Facebook and
   *                              LinkedIn posts, written by Claude when the article goes live and
   *                              waiting on the Content Manager's Socials tab
   *   5.2   6 Nov 2026  3377958 Phones: the photo credit under the article hero is hidden (it sat
   *                              against the screen edge with each link as a full-width bar).
   *                              Partner Content captions are never hidden
   *   5.3   6 Nov 2026  415d318 Featured Image filled by Joe: when a saved post has a hero but no Featured
   *                              Image, Joe copies the hero into it (Facebook, LinkedIn, Google and the
   *                              homepage take their picture from there; without it they get the site
   *                              logo). Check 6a now reads the Featured Image only, in red, with a Fill it
   *                              now button: Squarespace promotes heroes again, but the promoted hero no
   *                              longer reaches the share picture, so 6a had been showing green
   *   5.4   7 Nov 2026  3145339 Help: a ? button in Joe's title bar and in the Joe bar at the foot of the checks
   *                              panel opens the team's help guide (pe-related-answers.pages.dev/help) in its own
   *                              window, on the page for the Joe tab on screen, or on the checks panel
   *   5.5   8 Nov 2026  2ed7c73 Joe's Use buttons type into Squarespace's boxes like a person (focus, select,
   *                              insert) instead of writing the value in, and only count it as taken when
   *                              Squarespace's own copy of the value agrees, watched for 1.5 seconds. Fixes
   *                              Use showing the words but Save keeping the old ones. Alt text gets the same
   *   5.6   8 Nov 2026  5a559b6 Alt text check only warns when the same picture has no alt on two checks in a
   *                              row (the second runs 3 seconds after the first). Fixes a false "1 of 8 images
   *                              have no alt text" while Squarespace redraws image blocks as the editor opens
   *   5.7   9 Nov 2026  588c8a0 Free Plug-in of the Week: on a blank post, while a draft from the dashboard waits, the
   *                              checks panel offers "Fill with this week's pick". It pastes the article into the first
   *                              text block, fills the headline, SEO title, meta description and URL, records the post
   *                              for the dashboard and ticks Socials. Copy buttons for whatever didn't take, and for the
   *                              picture file name and alt text
   *   5.8   9 Nov 2026  6302a05 Socials: a "Don't change title" tick under the Socials tick. The card headline is the
   *                              article's own title instead of Claude's rewrite. Ticking it also ticks Socials; on posts
   *                              already written it swaps the headline straight away (Partners script v1.23)
   *   5.9   11 Nov 2026         Plug-in of the Week: the panel shows the day and slot chosen on the dashboard ("Drafted
   *                              for Sat 14 Nov, 9am main slot"; "Schedule it for …" once filled)
   *   6.0   11 Nov 2026  ac5d007 Updated tag: a refreshed article tagged Updated shows "Updated <date>" beside its
   *                              date, and its homepage card gets an UPDATED label (after FREE, before DEAL)
   *   6.1   11 Nov 2026  6e0bd86 Refreshed articles on the homepage: an article tagged Updated in the last 24 hours gets
   *                              a card in the top row of the homepage grid, labelled UPDATED, without redating it
   *   6.2   11 Nov 2026  8db2b67 Newsletter sign-up box inside articles switched off sitewide (SIGNUP_ON = false); it
   *                              was breaking the layout of the updated SSL article
   *   6.3   11 Nov 2026  6b5bc5a Updated articles: a note above the comments ("updated on <date>; comments before that
   *                              date refer to the earlier version"); the Comments heading finds Hyvor as well as Disqus
   *   6.4   11 Nov 2026  bdec203 Article byline reads "By <name>" instead of Squarespace's "Posted by <name>"
   *   6.5   12 Nov 2026         Socials: the "Don't change title" tick (5.8) is gone. Social posts now always use the
   *                              article's own title and excerpt, never a rewrite (Partners script v1.28)
   *   6.6   12 Nov 2026         Partner fact-check: on partner posts the checks panel shows where the brand's review
   *                              stands and offers "Prepare for fact-check" (then "Prepare Version 1.1" …). It reads
   *                              the post as saved and opens the team preview, which sends it to the brand. The
   *                              preview frame on pe-related-answers.pages.dev sets window.PE_FC_PREVIEW, which every
   *                              "leave the editor alone" check now respects, so the preview looks like the live page
   *   7.0   12 Nov 2026         Tabbed checks panel (Russ chose option A of the mockups): Checks, Joe, Publish, Partner
   *                              (partner posts only, marked Partner Team only) and Notes, one at a time, each with a
   *                              number when it needs you. Joe is a tab inside the panel instead of a second window
   *                              (Pop out wider still opens its own window). The panel shrinks to its pill when
   *                              someone types in the post. Roll back to v6.6 (dcc334a) if anything misbehaves
   *   7.1   12 Nov 2026         The open panel keeps its top edge where it is and only changes height between tabs
   *                              (was anchored to the bottom, so it jumped up and down). Drag it anywhere; double-click
   *                              the title puts it back at the top right. The Partner tab shows on any post with a
   *                              fact-check under way, and is checked again once Squarespace's record of the post loads
   *   7.2   12 Nov 2026         Joe sees tables, audio and video. The Overview check (and the text Joe's other tabs
   *                              read) now counts tables, in a Code Block from the Tables tool or pasted into text, our
   *                              own stem, A/B, blind test, clip and mixer players, and embeds whose player Squarespace
   *                              only draws on play (read from the block's stored code). Commit d77db1c. Roll back to v7.1 (704eaab)
   *   7.3   12 Nov 2026  ce3ce3c Homepage hero keeps the hand-made slides from the Front Page Heroes gallery
   *                              (/front-page-heroes). They play first, then the five newest Hero-tagged articles;
   *                              the hidden slide is swapped as the slideshow moves on, so all of them show on the
   *                              gallery's own slides. Before this the tagged articles covered the hand-made ones.
   *                              Roll back to v7.2 (2d0d3cf)
   *   7.4   13 Nov 2026         Refreshed articles reach the homepage only on the day Mel schedules them in the Content
   *                              Manager (09:00 UK, for 24 hours), read from the dashboard's public list
   *                              (pe-related-answers.pages.dev/api/refresh/live). Tagging or editing an article
   *                              Updated no longer puts it on the homepage by itself. Roll back to v7.3 (ce3ce3c)
   *   7.5   14 Nov 2026  1c19e0c Dark mode tables: article tables (Tables tool and skill) get dark rows, light text,
   *                              softer green and amber, and keep their orange header, instead of white rows on a dark
   *                              page. The subscription calculator, drawn in a Shadow DOM, gets dark colour roles
   *                              switched on with the page. Roll back to v7.4 (f68219e)
   *   7.6   17 Nov 2026         Client review tick (the team's request): on partner posts the Publish tab has a "Client
   *                              review" tick, so Mel and PJ know the piece needs sending to the brand for a fact-check.
   *                              Ticking emails them once and shows "Client review needed" on the Content Manager; the
   *                              Partner tab shows who asked and gets a "!" until a version is sent, then the tick reads
   *                              as done. Stored by pe-related-answers (/api/factcheck/ask). Roll back to v7.5 (1c19e0c)
   *   7.7   17 Nov 2026         Socials by default (Mel asked why news didn't post itself): the Socials tick sends the
   *                              post's publish time and status, so the Partners script (v1.34) can show the tick as on
   *                              for every new article and off for older ones. Unticked, the note under it is the
   *                              script's ("Left off socials. Tick to make the posts."). Commit 4f228d8. Roll back to v7.6
   *   7.8   18 Nov 2026  f98f9d5 Related Content fixes: in dark mode the section's box gets proper padding (the heading
   *                              and cards sat against its border), and the heading no longer turns light grey in light
   *                              mode (it used to copy its colour from the page, which was wrong if dark mode had been
   *                              on). Roll back to v7.7 (46bdaa9)
   *   7.9   18 Nov 2026  11e0f64 Breathing room at the top of site pages: Contact Us, About and the other ordinary pages
   *                              get 48px above their content (28px on phones) so the first heading no longer sits
   *                              hard under the menu. Articles and the homepage are unchanged. Roll back to v7.8 (f98f9d5)
   *   8.0   19 Nov 2026         Menu separators and phone hamburger menu: the | between menu items is drawn by the script,
   *                              so menu names in Squarespace can drop their typed " |" (any left are stripped). On phones
   *                              (639px and under) a three-line button top right opens a slide-in panel built from the
   *                              desktop menu, with dropdowns; Search moves to the centre of the top bar. Roll back to v7.9 (11e0f64)
   *   8.1  News and deals are ad hoc: no Ahead of plan or Went live early warning in the checks panel, no amber
   *                              title or scheduled bar for it, and the planned date box says the date isn't checked.
   *                              Matches the Content Manager's Site 54 rule. Commit 60bb3c2. Roll back to v8.0 (3a3c60a)
   *   8.2  News is judged as news in Joe's Overview: the check tells the checker it's announcement-day news, any prompt or
   *                              search asking for a verdict, review, testing, hands-on or buy/skip advice is dropped, the
   *                              score shows in neutral grey with a note that low is normal for news, and news results saved
   *                              before 8.2 are cleared. Commit 2fb1c01. Roll back to v8.1 (16cc0fc)
   *   8.3  19 Nov 2026  4a4d09f Homepage hero placeholder slides: with every hand-made slide deleted from Front Page
   *                              Heroes, Squarespace drew no slideshow, so the Hero-tagged articles had nowhere to play.
   *                              A gallery slide titled "Placeholder" is now never shown as itself, only as a blank for
   *                              the tagged articles. Keep two or three in the gallery. Roll back to v8.2 (6245c45)
   *   8.4  19 Nov 2026  eb8d4c6 Homepage hero fixes after the first placeholder went up: a slide counts as a placeholder
   *                              when its picture's file name has "placeholder" in it (titles are optional); a slide with
   *                              no title gets a headline box, so headlines show; with one slide in the gallery the script
   *                              plays the tagged articles on it every 6 seconds and the arrows work. Roll back to v8.3 (4a4d09f)
   *   8.5  19 Nov 2026  02f5613 Overview score removed: following its advice took the WaveRider v5 piece from 39 to 12. The
   *                              panel section and Joe's tab are now "Advice": suggestions only, each saying where, what and
   *                              why; advice from the last check is sent with the next so it stays put, and covered points are
   *                              ticked off as done. Results saved before 8.5 are cleared. Roll back to v8.4 (352e053)
   *   8.6  19 Nov 2026  1575571 News means the News tag or category, nothing else: Joe's server judged the WaveRider v5
   *                              feature as news from its "What's New" headline. Every other post now carries a note telling
   *                              Claude it isn't news and to judge it as the piece its headline promises; any news-style
   *                              headline note or prompt is dropped; 8.5 results are cleared. Roll back to v8.5 (27ea5aa)
   *   8.7  19 Nov 2026  2e6cf41 Joe's advice rebuilt around the promise in the headline (Russ, 19 Nov 2026). The writer says
   *                              in one line what the piece is for; Joe answers under four fixed headings (What I understood,
   *                              Is the promise kept?, Why would someone click past Google?, What to do). He reads the
   *                              author's bio and the team's, points to our earlier coverage, and can suggest a colleague for
   *                              a second opinion. The line and the advice are saved for the whole team on Joe's own server
   *                              (pe-related-answers /api/joe), where the rules are applied in code. Headline suggestions
   *                              carry the promise rule. The Google Sheet's "overview" task is no longer called.
   *                              Roll back to v8.6 (3e472d8)
   *   8.8  19 Nov 2026  2721278 Joe's advice after an edit (Russ: "it still gave the same advice"). Joe's server must now say
   *                              done or open for every earlier suggestion and judge by substance; a suggestion still open
   *                              says what the change did and what is missing; the tab says how many paragraphs Joe saw
   *                              change and how many suggestions were ticked, or that he can see no change at all. In the
   *                              Edit Post window Joe reads the text being edited, where he used to read the unsaved
   *                              preview behind it. Roll back to v8.7 (71a5605)
   *   8.9  23 Nov 2026          Homepage speed, first step: the hero picture on show is fetched at high priority
   *                              (fetchpriority=high), which PageSpeed flagged as missing on mobile and desktop.
   *                              Hero behaviour is otherwise unchanged. Roll back to v8.8 (81cd624). Commit f96b840
   *   9.0  23 Nov 2026          Homepage speed, second step: the team-only checklist, Joe and the panel moved out of
   *                              pe-site.js into this file (pe-checklist.js), which only the team downloads. Readers' script
   *                              shrinks from 267 KB to 112 KB minified (80 KB to 33 KB compressed). Behaviour for the team
   *                              is unchanged. The version history now lives here. Roll back to v8.9 (33d84d7). Commit 808acba
   *   9.1  24 Nov 2026          Homepage speed, third step: the hero reads a short list (heroes.json, rewritten every 30
   *                              minutes by a GitHub job) instead of the whole Hero-tag blog feed, and on a first visit the
   *                              hand-made slides are painted straight away. If the list is missing, broken or over 3 days
   *                              old, the blog feed is used as before. Roll back to v9.0 (808acba). Commit a540acd
   *   9.2  24 Nov 2026          Homepage speed, fourth step: the same job saves a compressed WebP copy of each tagged hero
   *                              picture (heroes/, up to three widths) and the hero uses it instead of the original, which
   *                              can be a heavy PNG (PageSpeed: 222 KiB saveable on today's). A missing or failing copy falls
   *                              back to the original. Roll back to v9.1 (a540acd). Commit 09a5902
   *   9.3  24 Nov 2026          Homepage speed, fifth step: the FREE, UPDATED, DEAL, REVIEW and NEWS card labels are read from
   *                              card-labels.json, kept by a 30-minute GitHub job, instead of about 1 MB of blog feeds in every
   *                              visitor's browser. Tested for identical labels against the old method. If the file is missing,
   *                              broken or over 3 days old the feeds are read in the browser as before. Roll back to v9.2 (09a5902). Commit fd8bbda
   *   9.4  24 Nov 2026          Accessibility: the homepage hero link now has the headline as its accessible name. PageSpeed's
   *                              agentic browsing audit failed it with "Links must have discernible text", because the picture
   *                              is a CSS background and the real image is hidden. No visible change. Roll back to v9.3 (fd8bbda). Commit 6be8e6e
   *   9.5  24 Nov 2026          Homepage speed, sixth step: the first hero picture appears at once instead of fading in over
   *                              0.4 seconds (the fade held back the largest paint). Later slide changes still fade. Pairs with
   *                              an early request for heroes.json in the Squarespace Header. Roll back to v9.4 (6be8e6e).
   */
  var PE_VERSION = '9.5';
  // 5.4: the help guide. The public editor copy, because contributors use the panel and Joe but can't sign in
  // to the dashboard; the team's full guide is linked from it. #t= picks the topic, &from= says where from.
  var HELP_URL = 'https://pe-related-answers.pages.dev/help';
  var social = null;            // 5.1: { on, status, label, by } for this post's Socials tick, once read
  var socialBusy = false, socialErr = '';
  var potw = null;               // 5.7: Plug-in of the Week picks waiting for a post (or filled into this one), once read
  var potwBusy = false, potwNotes = [];
  var fc = null;                 // 6.6: this post's partner fact-check, once read ({ review: {…} | null })
  // 7.0: the tabbed panel. panelTab is the tab on show (remembered in this browser); tabPicked is set once the
  // panel has chosen for itself on load (Checks when something needs fixing); joePopped is true while Joe is in its
  // own wider window instead of the panel's Joe tab.
  var panelTab = ls('pe-ck-tab') || 'checks', tabPicked = false, joePopped = false;
  var tabBar = null, joeHost = null, notesWrap = null, pubWrap = null;
  var fcBusy = false, fcErr = '', fcSent = false;
  var askBusy = false, askErr = '';   // 7.6: the Client review tick (its state arrives with the fact-check read, as fc.ask)
  try { console.info('Production Expert site scripts v' + PE_VERSION); } catch (e) {}

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
  function el(tag, css, text) {
    var e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (text != null) e.textContent = text;
    return e;
  }
  // 5.4: opens the help guide on a topic, in one reusable window beside the editor (a second press reuses it)
  function openHelp(topic, from) {
    var url = HELP_URL + '#t=' + encodeURIComponent(topic) + (from ? '&from=' + encodeURIComponent(from) : '');
    var w = null;
    try { w = window.open(url, 'pe-help', 'popup=yes,width=1080,height=840'); } catch (e) { w = null; }
    if (w) { try { w.focus(); } catch (e) {} }
  }
  // 5.4: the small round ? button used in Joe's title bar and the Joe bar
  function helpButton(title, onclick) {
    var q = el('button', 'flex:0 0 auto;width:20px;height:20px;padding:0;border:1px solid #c9ced4;border-radius:50%;background:#fff;' +
      'font:700 12px/18px ' + F + ';color:#5f6368;cursor:pointer;text-align:center;', '?');
    q.type = 'button';
    q.className = 'pe-help-q';
    q.title = title;
    q.setAttribute('aria-label', title);
    q.onclick = function (e) { e.stopPropagation(); onclick(); };
    return q;
  }

  var state = {}, post, panel, pill, list, head, hideTimer, banner, drawer;
  var loaded = false, firstLoad = true;
  var scheduledFor = 0;         // publish time if the post is scheduled for the future
  var editedAt = 0;             // when the post was last saved
  var postData = {};            // the post's own record from Squarespace
  var auto = [];                // results of the automatic checks
  var altMiss = {};             // 5.6: image address: checks in a row it has had no alt
  var altRecheck = false;       // 5.6: a first miss waiting to be confirmed
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
      // A new embargo starts on the planned date when it came from Make it an embargo
      var start = embargo.at ? zonedParts(embargo.at, embargo.tz || 'Europe/London') : { date: embSeed || '', time: '09:00' };
      embSeed = '';
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
      // A live post can't be put under embargo any more, so the link only shows before it goes out
      var wfE = +postData.workflowState || 0, tE = +postData.publishOn || 0;
      if ((wfE === 1 || wfE === 2) && tE && tE <= Date.now()) return;
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
    line.appendChild(el('div', 'opacity:.85;', sub.join(' · ')));
    var foot = el('div', 'display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;');
    foot.appendChild(btn('Change', small, function () { embEditing = true; renderEmbargo(); }));
    foot.appendChild(btn('Remove', small, function () {
      embargoCall({ at: 0, tz: '', by: who() }).catch(function () {});
    }));
    // Make it a planned date: keeps the day as a soft date and removes the hard embargo.
    // Only once the sheet takes planned dates (plan isn't null).
    if (plan && future) foot.appendChild(btn('Make it a planned date', small, function () {
      var d = londonDay(embargo.at), by = who();
      planCall({ day: d === plan.cal ? '' : d, by: by }).then(function () {
        return embargoCall({ at: 0, tz: '', by: by });
      }).catch(function () {});
    }));
    line.appendChild(foot);
    embBox.appendChild(line);
  }

  /* ---------- Planned date (v3.1) ----------
   * Each post's planned publishing day, read from Mel's Editorial Calendar 2026 through the
   * Google Sheet (the post's linked calendar slot, the same link the Content Manager uses).
   * Anyone can move the date in the panel. A moved date is kept in the checklist sheet as an
   * override; Mel's calendar is never written to, because it's her plan. The panel shows
   * "Moved from Thu 5 Nov by RH" so the change is visible, and the Content Manager can flag it.
   *
   * Because the team always schedules (never Publish, which upsets Facebook), the check runs
   * the moment a post is scheduled: a scheduled day before the planned day turns the panel
   * amber with "Ahead of plan", and the scheduled bar names it, leaving time to pull it back.
   * A planned date is a soft date; an embargo (above) is the hard "must not" one, in red.
   * One click turns either into the other.
   *
   * The sheet side (Code.gs, section "Planned dates"): GET ?action=plan&post=…&title=…
   * answers {ok, plan: {cal: 'YYYY-MM-DD' or '', lane, over: 'YYYY-MM-DD' or '', by, on}}.
   * Add set=1&day=YYYY-MM-DD&by=… to move the date (day= empty clears the override).
   * Until the sheet answers with "plan", this whole box stays hidden and nothing changes. */
  var plan = null;                               // from the sheet; null until it answers with a plan
  var planBox = null;                            // the planned date line in the panel, built once
  var planEditing = false;                       // true while the date box is showing
  var embSeed = '';                              // a day to start the embargo form on (from Make it an embargo)

  // An exact moment as its day in the UK: '2026-11-05'
  function londonDay(t) { return zonedParts(t, 'Europe/London').date; }
  // '2026-11-05' as 'Thu 5 Nov' (midday UTC, so no time zone can tip it into another day)
  function dayText(d) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || '');
    if (!m) return d || '';
    return new Date(Date.UTC(+m[1], m[2] - 1, +m[3], 12)).toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });
  }
  // The day that counts: a date moved in the panel beats the calendar's
  function planDay() { return plan ? (plan.over || plan.cal || '') : ''; }

  // Reads the post's planned date from the sheet, or moves it (extra holds day and by)
  function planCall(extra) {
    // The author helps the sheet match the post to Mel's calendar when it isn't linked yet
    var data = { action: 'plan', post: post, title: postTitle(), author: authorOf().name || '' };
    if (extra) { data.set = 1; Object.keys(extra).forEach(function (k) { data[k] = extra[k]; }); }
    var q = Object.keys(data).map(function (k) { return k + '=' + encodeURIComponent(data[k]); }).join('&');
    return fetch(C.store + '?' + q).then(function (r) { return r.json(); }).then(function (d) {
      // An older Code.gs answers with something else and no plan: stay hidden
      if (!d || !d.ok || !d.plan) { if (extra) throw new Error((d && d.error) || 'the sheet needs the Planned dates update'); return; }
      var p = d.plan, before = JSON.stringify(plan);
      plan = { cal: p.cal || '', lane: p.lane || '', guess: !!+p.guess, over: p.over || '', by: p.by || '', on: +p.on || 0 };
      if (extra) { planEditing = false; getHistory(); }  // the sheet logged the move in the history
      if (JSON.stringify(plan) !== before || extra) { renderPlan(); refreshAuto(); }
    });
  }

  // 8.1: News and deals are ad hoc (Site 54). They go out when the story breaks or the offer starts, so
  // their date is never judged against Mel's calendar. Same rule as the Content Manager's adHoc():
  // News is the News category or tag; a deal is a post in the Partner Deals blog, or before then a
  // title that reads like an offer.
  var OFFER_WORDS = /\b(sale|deals?|discounts?|offers?|black friday|cyber monday|save up to|half price)\b|\b\d{1,3}\s?% off\b/i;
  function adHoc() {
    var names = (postData.tags || []).concat(postData.categories || []).map(function (t) { return String(t).trim().toLowerCase(); });
    if (names.indexOf('news') > -1) return 'News';
    if (document.querySelector('body.view-item article.hentry.category-news, body.view-item article.hentry.tag-news')) return 'News';
    var url = String(postData.fullUrl || location.pathname || '');
    if (/\/partner-deals(\/|$)/i.test(url)) return 'Deal';
    if (OFFER_WORDS.test(postTitle() || '')) return 'Deal';
    return '';
  }

  // The automatic check, added to the others by runAuto. Compares days in the UK, since the
  // calendar plans days, not times.
  function planCheck() {
    var day = planDay();
    if (!day) return null;
    var kind = adHoc();
    if (kind) return { ok: true, text: kind + ' is ad hoc, so its date isn\'t checked against the plan' };
    var wf = +postData.workflowState || 0, t = +postData.publishOn || 0;
    if (scheduledFor && londonDay(scheduledFor) < day)
      return { ok: false, kind: 'plan', text: 'Scheduled for ' + inZone(scheduledFor, 'Europe/London') + ', but planned for ' + dayText(day),
        bar: 'planned for ' + dayText(day) };
    if ((wf === 1 || wf === 2) && t && t <= Date.now() && londonDay(t) < day && Date.now() - t < 7 * 864e5)
      return { ok: false, kind: 'plan', live: true, text: 'Went live ' + inZone(t, 'Europe/London') + ', but was planned for ' + dayText(day) };
    return { ok: true, text: 'Planned for ' + dayText(day) };
  }

  // The Facebook quirk: a post that goes live within 5 minutes of being created or scheduled
  // can lose its image on Facebook and give 404s. Warns when a post has just been scheduled
  // (edited in the last 10 minutes) for less than 5 minutes ahead. The first sighting of each
  // schedule is remembered, so the warning doesn't vanish when the page reloads.
  function soonCheck() {
    if (!scheduledFor) return null;
    var key = 'pe-sched-seen-' + post, seen = null;
    try { seen = JSON.parse(ls(key) || 'null'); } catch (e) {}
    if (!seen || seen.t !== scheduledFor) { seen = { t: scheduledFor, at: Date.now() }; ls(key, JSON.stringify(seen)); }
    var gap = scheduledFor - Math.max(seen.at, +postData.updatedOn || 0);
    var fresh = Date.now() - (+postData.updatedOn || 0) < 10 * 60000;
    if (fresh && gap < 5 * 60000)
      return { ok: false, kind: 'soon', text: 'Goes out less than 5 minutes after it was scheduled. Facebook may lose the image and the link may 404: schedule it at least 5 minutes ahead',
        bar: 'Less than 5 minutes ahead: schedule it later so Facebook keeps the image' };
    return null;
  }

  // Drafts left untouched (v3.4): a draft not edited for 4 weeks or more gets an amber warning
  // asking whether it can be deleted. Goes by the last edit, so an old draft someone is still
  // working on isn't flagged. The Content Manager flags the same drafts (Code.gs).
  // v4.0: goes by the last save that changed something. Squarespace logs a save when a post is just
  // opened in the editor and closed, which reset the clock on every draft anyone looked at. The
  // History list compares each save with the one before (headline, SEO title, meta, URL, word count,
  // status), so a save that changed none of those is ignored. Code.gs uses the same rule.
  var STALE_DAYS = 28;
  function realEditTime() {
    var edited = +postData.updatedOn || 0;
    if (!hist) return 0;                                             // wait for the History list
    var saves = hist.filter(function (h) { return h.kind === 'save' || h.kind === 'status'; })
      .sort(function (a, b) { return a.when - b.when; });
    if (!saves.length) return edited;
    if (edited > saves[saves.length - 1].when + 60000) return edited; // newest save not in History yet
    var real = saves[0].when;                                       // the first save seen counts as an edit
    saves.forEach(function (h) { if (h.detail) real = h.when; });  // then only saves that changed something
    return real;
  }
  function staleDraftCheck() {
    if ((+postData.workflowState || 0) !== 4) return null;          // drafts only
    var edited = realEditTime();
    if (!edited) return null;
    var days = Math.floor((Date.now() - edited) / 864e5);
    if (days < STALE_DAYS) return null;
    var weeks = Math.floor(days / 7);
    return { ok: false, kind: 'stale', text: 'Draft not edited for ' + weeks + ' weeks. Is it still needed, or can it be deleted?' };
  }

  // The planned date line, above the embargo. Kept out of the part draw() rebuilds, like the embargo.
  function renderPlan() {
    if (!planBox) return;
    planBox.innerHTML = '';
    if (!plan) return;                           // sheet not updated yet: nothing to show
    var small = 'padding:3px 9px;border:1px solid #d5d9de;border-radius:5px;background:#fff;font:600 11.5px/1.6 ' + F + ';color:#333;cursor:pointer;';
    function btn(text, css, onclick) { var b = el('button', css, text); b.type = 'button'; b.onclick = onclick; return b; }
    var day = planDay();

    if (planEditing) {
      var form = el('div', 'margin:10px 0 2px;padding:10px 12px;border:1px solid #eceef1;border-radius:6px;background:#fafbfc;');
      form.appendChild(el('div', 'margin-bottom:6px;font:700 10.5px ' + F + ';letter-spacing:.08em;text-transform:uppercase;color:#7a8088;', 'Planned date'));
      var dIn = el('input', 'width:100%;box-sizing:border-box;padding:5px 6px;border:1px solid #d5d9de;border-radius:5px;background:#fff;font:13px ' + F + ';color:#222;');
      dIn.type = 'date'; dIn.value = day;
      form.appendChild(dIn);
      var msg = el('div', 'margin-top:6px;font-size:12px;color:#80868d;',
        plan.cal ? 'Mel\'s calendar says ' + dayText(plan.cal) + '. Her calendar isn\'t changed.' : 'Not in Mel\'s calendar. Her calendar isn\'t changed.');
      form.appendChild(msg);
      var acts = el('div', 'display:flex;gap:6px;margin-top:8px;');
      var save = btn('Save date', 'padding:5px 12px;border:1px solid ' + C.blue + ';border-radius:5px;background:' + C.blue + ';font:700 12px/1.6 ' + F + ';color:#fff;cursor:pointer;', function () {
        if (!dIn.value) { msg.style.color = C.red; msg.textContent = 'Pick a date.'; return; }
        // Saving the calendar's own date clears the override instead of storing a copy of it
        var v = dIn.value === plan.cal ? '' : dIn.value;
        save.disabled = true; save.textContent = 'Saving…';
        planCall({ day: v, by: who() }).catch(function (e) {
          save.disabled = false; save.textContent = 'Save date';
          msg.style.color = C.red; msg.textContent = 'Not saved: ' + (e.message || e) + '. Try again.';
        });
      });
      acts.appendChild(save);
      acts.appendChild(btn('Cancel', small, function () { planEditing = false; renderPlan(); }));
      form.appendChild(acts);
      planBox.appendChild(form);
      return;
    }

    // Where the post is up to: live posts report when they went out, scheduled posts when they will
    var wfP = +postData.workflowState || 0, tP = +postData.publishOn || 0;
    var isLive = (wfP === 1 || wfP === 2) && tP && tP <= Date.now();
    if (!day) {
      if (isLive) return;                        // live with no plan: nothing useful to add now
      planBox.appendChild(btn('+ Add a planned date', 'margin:10px 0 0;padding:0;border:0;background:none;font:600 12px ' + F + ';color:' + C.blue + ';cursor:pointer;',
        function () { planEditing = true; renderPlan(); }));
      return;
    }
    var chk = planCheck(), bad = chk && !chk.ok;
    var line = el('div', 'margin:10px 0 0;padding:9px 11px;border-radius:6px;font-size:12.5px;line-height:1.45;' +
      (bad ? 'background:#fff4e0;color:#5a3a00;border:1px solid #f0d49a;' : 'background:#f6f7f9;color:#3a4048;border:1px solid #eceef1;'));
    // The headline changes with the stage:
    //   live:       "Published Sun 1 Nov, 09:00", then "On plan", "planned Thu 5 Nov" or "a day late"
    //   scheduled:  "Scheduled Thu 5 Nov, 09:00 · on plan"
    //   otherwise:  "Planned Thu 5 Nov"
    var actualDay = isLive ? londonDay(tP) : scheduledFor ? londonDay(scheduledFor) : '';
    var headline = isLive ? 'Published ' + inZone(tP, 'Europe/London')
      : scheduledFor ? 'Scheduled ' + inZone(scheduledFor, 'Europe/London') : 'Planned ' + dayText(day);
    var icon = bad ? '⚠ ' : isLive ? '✓ ' : '📅 ';
    line.appendChild(el('div', 'font-weight:700;', icon + headline));
    if (actualDay && adHoc()) {
      line.appendChild(el('div', 'font-weight:600;color:#3a4048;', adHoc() + ' is ad hoc, so its date isn\'t checked against the plan'));
    } else if (actualDay) {
      var late = actualDay > day;
      line.appendChild(el('div', 'font-weight:600;color:' + (bad ? 'inherit' : late ? '#5a3a00' : '#2e6b10') + ';',
        actualDay === day ? 'On plan' : (late ? 'Later than planned, ' : 'Ahead of plan, ') + 'planned ' + dayText(day)));
    }
    var sub = plan.over
      ? (plan.cal ? 'Moved from ' + dayText(plan.cal) : 'Not in Mel\'s calendar') + (plan.by ? ' by ' + plan.by : '')
      // guess: not linked on the Content Manager yet, matched by title (and author)
      : (plan.guess ? 'Matched to Mel\'s calendar by title, not confirmed yet' : 'From Mel\'s calendar') + (plan.lane ? ', ' + plan.lane + ' lane' : '');
    line.appendChild(el('div', 'opacity:.85;', sub));
    if (bad && !chk.live) line.appendChild(el('div', 'margin-top:3px;font-weight:600;', 'Change the schedule, or move the planned date.'));
    // Once a post is live the date can't be changed by the plan, so the buttons go
    if (isLive) { planBox.appendChild(line); return; }
    var foot = el('div', 'display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;');
    foot.appendChild(btn('Change date', small, function () { planEditing = true; renderPlan(); }));
    if (plan.over && plan.cal) foot.appendChild(btn('Back to calendar date', small, function () { planCall({ day: '', by: who() }).catch(function () {}); }));
    if (plan.over && !plan.cal) foot.appendChild(btn('Remove', small, function () { planCall({ day: '', by: who() }).catch(function () {}); }));
    // Make it an embargo: opens the embargo form on this day, for a time and zone to be added
    if (!embargo.at) foot.appendChild(btn('Make it an embargo', small, function () { embSeed = day; embEditing = true; renderEmbargo(); }));
    line.appendChild(foot);
    planBox.appendChild(line);
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
  var notesHead = null, notesForm = null;       // the clickable Notes heading, and the text box with its buttons
  // Notes can be folded away to save room. The choice is remembered per browser ('1' = shut).
  // Open flags for the author stay on show even when shut, so a content issue is never hidden.
  var notesShut = ls('pe-notes-shut') === '1';
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
    drawNotesHead(openFlags.length);
    notesForm.style.display = notesShut ? 'none' : '';   // shut: hide the text box and buttons
    // Shut shows only open flags; open shows everything, flags first
    (notesShut ? openFlags : openFlags.concat(notes.filter(function (n) { return n.flag !== 'open'; }))).forEach(function (n) {
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

  // The Notes heading doubles as the fold button: NOTES · 3 ▾ when open, ▸ when shut.
  // The count is every note on the post; open flags are named in red so they stand out when shut.
  function drawNotesHead(flagCount) {
    if (!notesHead) return;
    var total = (notes || []).length;
    notesHead.innerHTML = '';
    notesHead.appendChild(el('span', 'width:10px;font-size:10px;color:#9aa0a6;', notesShut ? '▸' : '▾'));
    notesHead.appendChild(el('span', '', 'Notes' + (total ? ' · ' + total : '')));
    if (flagCount) notesHead.appendChild(el('span', 'color:' + C.red + ';', '⚑ ' + flagCount + (flagCount === 1 ? ' flag' : ' flags')));
    notesHead.title = notesShut ? 'Show notes' : 'Hide notes';
    notesHead.setAttribute('aria-expanded', notesShut ? 'false' : 'true');
  }

  // Opens or shuts the notes, remembers the choice in this browser, and redraws.
  // Left alone while a note is being edited, so a half-finished edit isn't hidden mid-flow.
  function toggleNotes() {
    if (editingNote) return;
    notesShut = !notesShut;
    ls('pe-notes-shut', notesShut ? '1' : '0');
    renderNotes();
  }

  // Builds the box once: heading, the notes, and a text box with Add note and Flag for author underneath
  function buildNotes() {
    notesBox = el('div', 'display:none;padding:2px 16px 14px;border-top:1px solid #eceef1;');
    // Clickable heading, styled to match the other section labels in the panel
    notesHead = el('button', 'display:flex;align-items:center;gap:6px;width:100%;margin:12px 0 4px;padding:0;border:0;background:none;' +
      'font:700 10.5px/1.4 ' + F + ';letter-spacing:.08em;text-transform:uppercase;color:#7a8088;cursor:pointer;text-align:left;');
    notesHead.type = 'button';
    notesHead.onclick = toggleNotes;
    notesBox.appendChild(notesHead);
    notesList = el('div');
    notesBox.appendChild(notesList);
    notesForm = el('div');                        // holds the text box, buttons and message so they fold away together
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
    notesForm.appendChild(field);
    notesForm.appendChild(row);
    notesForm.appendChild(msg);
    notesBox.appendChild(notesForm);
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
      if (d && d.ok && d.history) {
        hist = d.history;
        // v4.0: the stale draft check goes by History, so redo it now History has arrived
        auto = auto.filter(function (r) { return r.kind !== 'stale'; });
        var old = staleDraftCheck();
        if (old) auto.push(old);
        draw();
      }
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
    if (h.kind === 'plan') return h.item === 'cleared' ? who + ' put the planned date back to Mel\'s calendar' : who + ' moved the planned date to ' + h.item;
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
    var planIssue = auto.filter(function (r) { return (r.kind === 'plan' || r.kind === 'soon') && !r.ok; })[0];
    head.firstChild.textContent = embIssue ? (embIssue.live ? 'Live before embargo' : 'Embargo clash') : flagIssue ? 'Content issue'
      : planIssue ? (planIssue.kind === 'soon' ? 'Scheduled too soon' : 'Ahead of plan')
      : c.warn ? 'Scheduled: checks missing' : c.stale ? 'Edited since checked' : 'Pre-publish checks';
    head.lastChild.textContent = status;
    head.style.color = embIssue || flagIssue || c.warn ? C.red : (c.stale || planIssue) ? C.amber : '#222';
    head.lastChild.style.color = colour;
    panel.style.borderTopColor = colour;
    pill.style.borderColor = colour;
    pill.style.color = colour;
    pill.firstChild.textContent = reportErr ? '⚠ ' : c.all && !c.autoWarn && !c.stale ? '✓ ' : '';
    pill.title = reportErr ? 'Dashboard not updated: ' + reportErr : 'Pre-publish checks';
    pill.lastChild.textContent = status;

    list.innerHTML = '';
    // 7.0: one tab at a time. Opens on Checks when something needs fixing, otherwise on the last tab used.
    if (!tabPicked && loaded) { tabPicked = true; if (c.warn || c.stale || c.autoWarn > 0) panelTab = 'checks'; }
    if (panelTab === 'partner' && !fcPartner()) panelTab = 'checks';
    drawTabs(c);
    var tab = panelTab;
    pubWrap.style.display = tab === 'publish' ? '' : 'none';
    notesWrap.style.display = tab === 'notes' ? '' : 'none';
    list.style.display = tab === 'joe' ? 'none' : '';
    joeHost.style.display = tab === 'joe' ? 'flex' : 'none';
    if (tab === 'checks') {
      drawStale(c);
      drawProblems();
      drawOverview(); // Joe's advice (8.5, was the Overview score), between the warnings and the checks
      drawChecks();
    } else if (tab === 'publish') {
      drawPotw(); // 5.7: Free Plug-in of the Week, only on a blank post while a draft waits (or the post it filled)
      drawSocial(); // 5.1: the Socials tick
      drawAsk();    // 7.6: the Client review tick, partner posts only
    } else if (tab === 'partner') {
      drawPartnerOnly();
      drawFc();   // 6.6: partner fact-check, partner posts only
    } else if (tab === 'notes') {
      drawHistory();
    } else if (tab === 'joe') {
      showJoe();
    }
    drawJoeBar(); // not on screen since 7.0, kept up to date so nothing that reads it breaks
    // Only shown if Squarespace couldn't be asked about the post (the full readout was for setting up)
    if (statusErr) list.appendChild(el('div', 'margin-top:10px;padding-top:8px;border-top:1px solid #eceef1;color:#888;font:11px/1.5 ' + F + ';',
      'Couldn\'t check the post with Squarespace: ' + statusErr + '. Trying again in 30 seconds.'));
    if (reportErr) list.appendChild(el('div', 'margin-top:10px;padding:7px 9px;border-radius:4px;background:#fdecea;color:' + C.red + ';font:12px/1.4 ' + F + ';',
      'The Content Manager did not update: ' + reportErr + '. It will try again in 30 seconds.'));
    var embBad = auto.filter(function (r) { return r.kind === 'embargo' && !r.ok; })[0];
    warning(c.warn || (scheduledFor > Date.now() && c.autoWarn) || (embBad && embBad.live), C.items.filter(function (i) { return !(state[i] || {}).done; }), c.autoWarn, embBad, flagIssue,
      auto.filter(function (r) { return (r.kind === 'plan' || r.kind === 'soon') && !r.ok && !r.live; }));
    if (joeIsOpen()) drawDrawer();

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
      var hard = r.kind === 'embargo' || r.kind === 'flag' || r.kind === 'featured'; // embargo problems, flagged issues and a missing Featured Image are shown in red
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
      if (r.kind === 'featured') {   // 5.3
        var fb = el('button', 'flex:0 0 auto;padding:2px 8px;border:1px solid ' + C.red + ';border-radius:5px;background:#fff;font:600 11px/1.6 ' + F + ';color:' + C.red + ';cursor:pointer;', featuredBusy ? 'Filling…' : 'Fill it now');
        fb.type = 'button';
        fb.disabled = featuredBusy;
        fb.onclick = function () { fillFeatured(true); };
        row.appendChild(fb);
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

  /* ---------- 7.0: the tabs ----------
   * Checks: what needs fixing, the Overview score and the four checks. Joe: Joe itself. Publish: planned date,
   * embargo, Plug-in of the Week and Socials. Partner (partner posts only): the fact-check, for the Partner Team only.
   * Notes: notes, flags for the author and the edit history. A number on a tab means something there needs you. */
  function panelTabs() {
    var t = [['checks', 'Checks'], ['joe', 'Joe'], ['publish', 'Publish']];
    if (fcPartner()) t.push(['partner', 'Partner']);
    t.push(['notes', 'Notes']);
    return t;
  }
  function setTab(t) {
    panelTab = t; tabPicked = true; ls('pe-ck-tab', t);
    draw();
  }
  function drawTabs(c) {
    if (!tabBar) return;
    var r = fc && fc.review;
    var openFlags = (notes || []).filter(function (n) { return n.flag === 'open'; }).length;
    var potwWaiting = potw && potw.length && !potwHere() && potw.some(function (p) { return p.status === 'drafted'; }) && potwBlank();
    var badge = {
      checks: (c.warn ? 1 : 0) + (c.stale ? 1 : 0) + Math.max(0, c.autoWarn || 0),
      publish: socialErr ? '!' : potwWaiting ? 1 : 0,
      partner: r ? (r.open || ((r.standing === 'lapsed' || r.standing === 'edited') ? '!' : 0)) : 0,
      notes: openFlags || 0
    };
    if (!badge.partner && fc && fc.ask && !fc.ask.done) badge.partner = '!';   // 7.6: Client review ticked, nothing sent yet
    var colour = { checks: c.warn || auto.some(function (x) { return !x.ok && (x.kind === 'embargo' || x.kind === 'flag'); }) ? C.red : C.amber, publish: C.amber, partner: '#c2410c', notes: C.red };
    tabBar.innerHTML = '';
    panelTabs().forEach(function (t) {
      var on = t[0] === panelTab;
      var b = el('button', 'display:flex;align-items:center;gap:5px;border:0;background:none;padding:10px 8px 8px;margin-bottom:-1px;cursor:pointer;' +
        'font:' + (on ? 700 : 600) + ' 12.5px ' + F + ';color:' + (on ? C.blue : '#5f6368') + ';border-bottom:3px solid ' + (on ? C.blue : 'transparent') + ';', t[1]);
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      var n = badge[t[0]];
      if (n) b.appendChild(el('span', 'font-size:10.5px;font-weight:700;background:' + colour[t[0]] + ';color:#fff;border-radius:999px;padding:0 6px;line-height:16px;', String(n)));
      b.onclick = function () { setTab(t[0]); };
      tabBar.appendChild(b);
    });
  }
  // The Partner tab is for the Partner Team only (Russ, 12 Nov 2026)
  function drawPartnerOnly() {
    var w = el('div', 'margin:12px 0 4px;padding:9px 11px;border-radius:6px;background:#fdecea;border:1px solid #f2c4c0;color:#791f1f;font:12.5px/1.45 ' + F + ';');
    w.appendChild(el('b', '', 'Partner Team only. '));
    w.appendChild(document.createTextNode('This tab is for Russ, Mike, Mel and PJ. If you’re not on the Partner Team, please leave everything here alone.'));
    list.appendChild(w);
  }
  // Typing in the post (or Squarespace's own boxes) shrinks the panel to its pill, so it's out of the way while
  // writing. A click on the pill opens it again. Only real key presses count, never the panel's own filling-in.
  function typingShrink(e) {
    if (!e.isTrusted || !panel || mode === 'pill' || panel.style.display === 'none') return;
    var t = e.target;
    if (!t || !t.closest || t.closest('.pe-checklist, .pe-checklist-pill, .pe-drawer')) return;
    if (!(t.isContentEditable || /^(INPUT|TEXTAREA)$/.test(t.tagName))) return;
    if (!(e.key && (e.key.length === 1 || e.key === 'Enter' || e.key === 'Backspace' || e.key === 'Delete'))) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    mode = 'pill';
    draw();
  }

  /* ---------- 6.6: partner fact-check ----------
   * Partners never see a piece before it's published, but sometimes the brand checks a draft for factual accuracy
   * only. On a partner post this section shows where that stands and offers "Prepare for fact-check". Prepare:
   *   1. opens the team preview (pe-related-answers.pages.dev, behind the team sign-in) in a new tab, inside the click
   *      so the browser allows it,
   *   2. reads this post as Squarespace has it saved (the logged-in page, drafts included), takes out its article,
   *   3. hands the article to the preview tab by postMessage once that tab says it's ready (only to that address).
   * The preview files it as the next version and shows exactly what the brand will see, with the Send form. Nothing
   * is sent from here. The read below passes the post's last save and status, so the Content Manager can say
   * "Edited since approved", and the review closes once the article is live. */
  function fcPartner() {
    // 7.1: a post with a fact-check under way always counts, whatever its tags say right now
    if (fc && fc.review) return true;
    if (document.querySelector('body.view-item article.hentry.tag-partner')) return true;
    return (postData.tags || []).concat(postData.categories || []).some(function (t) { return String(t).trim().toLowerCase() === 'partner'; });
  }
  function loadFc() {
    if (!post || !fcPartner()) return;
    var q = 'panel?t=' + encodeURIComponent(C.fcToken) + '&post=' + encodeURIComponent(post) +
      '&u=' + (+postData.updatedOn || 0) + '&wf=' + (+postData.workflowState || 0) + '&pub=' + (+postData.publishOn || 0);
    fetch(C.fc + q).then(function (r) { return r.json(); })
      .then(function (d) { if (d && d.ok) { fc = d; if (!fcBusy) fcErr = ''; } draw(); })
      .catch(function () { if (!fc) fcErr = 'Couldn\'t reach the fact-check system'; draw(); });
  }
  function fcOpen(url) {
    var w = null;
    try { w = window.open(url, 'pe-factcheck-' + post); } catch (e) { w = null; }
    if (w) { try { w.focus(); } catch (e) {} }
    return w;
  }
  function prepareFc() {
    if (fcBusy) return;
    fcBusy = true; fcErr = ''; fcSent = false;
    var win = fcOpen(C.fcTeam + 'page?prepare=' + encodeURIComponent(post));   // during the click, or it's blocked
    if (!win) { fcBusy = false; fcErr = 'Your browser blocked the new tab. Allow pop-ups for this site, then press Prepare again.'; draw(); return; }
    draw();
    var payload = null, ready = false;
    function send() {
      if (!payload || !ready || fcSent) return;
      try { win.postMessage({ peFcArticle: payload }, C.fcOrigin); fcSent = true; } catch (e) { fcErr = 'Couldn\'t hand the article to the preview tab: ' + e.message; }
      fcBusy = false; draw();
      setTimeout(loadFc, 8000);
    }
    function onMsg(e) {
      if (e.origin !== C.fcOrigin || !e.data || !e.data.peFcReady || String(e.data.post) !== String(post)) return;
      ready = true; send();
    }
    window.addEventListener('message', onMsg);
    setTimeout(function () { window.removeEventListener('message', onMsg); if (!fcSent) { fcBusy = false; if (!fcErr) fcErr = 'The preview tab didn\'t answer. Check you\'re signed in to the dashboard there, then press Prepare again.'; draw(); } }, 30000);
    // The saved post, as Squarespace serves it to a signed-in member of the team (drafts too)
    fetch(location.pathname + '?pe-fc=' + Date.now(), { credentials: 'same-origin', cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('Squarespace answered ' + r.status); return r.text(); })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var art = doc.querySelector('article.hentry');
        if (!art) throw new Error('the saved page has no article in it');
        // Anything of ours that might be in the saved markup comes out; Squarespace's own markup stays exactly as it is
        art.querySelectorAll('.pe-checklist, .pe-checklist-pill, .pe-drawer, .pe-ui, .pe-schedule-warning').forEach(function (x) { x.remove(); });
        payload = { postId: post, postUrl: postData.fullUrl || location.pathname, title: postTitle(), author: authorOf().name,
          updatedOn: +postData.updatedOn || 0, html: art.outerHTML, bodyClass: (doc.body && doc.body.className) || '' };
        send();
      })
      .catch(function (e) { fcBusy = false; fcErr = 'Couldn\'t read the saved post: ' + (e && e.message || e) + '. Save it and press Prepare again.'; draw(); });
  }
  function drawFc() {
    if (!fcPartner()) return;
    list.appendChild(sectionLabel('Partner fact-check', '#c2410c'));
    var box = el('div', 'padding:8px 10px;border-radius:6px;background:#fff7ed;border:1px solid #fed7aa;font:12.5px/1.5 ' + F + ';color:#431407;');
    var r = fc && fc.review;
    var btn = function (text, title, onclick, primary) {
      var b = el('button', 'width:100%;margin-top:6px;padding:6px 10px;border-radius:5px;font:700 12.5px/1.5 ' + F + ';cursor:pointer;' +
        (primary ? 'border:0;background:#c2410c;color:#fff;' : 'border:1px solid #c2410c;background:#fff;color:#c2410c;'), text);
      b.type = 'button'; b.title = title; b.disabled = fcBusy; b.onclick = onclick;
      return b;
    };
    // 7.6: who ticked Client review, while nothing has gone to the brand since
    if (fc && fc.ask && !fc.ask.done) box.appendChild(el('div', 'margin-bottom:6px;padding:5px 8px;border-radius:5px;background:#c2410c;color:#fff;font-weight:700;',
      'Client review asked for by ' + (fc.ask.by || 'someone') + (fc.ask.at ? ', ' + askWhen(fc.ask.at) : '') + '. Prepare it and send it to the brand.'));
    if (!fc && !fcErr) box.appendChild(el('div', '', 'Reading…'));
    else if (!r) {
      box.appendChild(el('div', '', 'Send this draft to the brand to check facts only: no tone, no wording. Save the post first; the copy is of the last saved version.'));
      box.appendChild(btn(fcBusy ? 'Preparing…' : 'Prepare for fact-check', 'Opens the preview of exactly what the brand will see, where you choose who it goes to and send it', prepareFc, true));
    } else {
      var colour = r.standing === 'approved' ? C.green : (r.standing === 'lapsed' || r.standing === 'edited') ? C.red : '#431407';
      box.appendChild(el('div', 'font-weight:700;color:' + colour + ';', r.label));
      if (r.open) box.appendChild(el('div', '', r.open + (r.open === 1 ? ' comment' : ' comments') + ' from the brand to answer.'));
      if (r.standing === 'edited') box.appendChild(el('div', 'color:' + C.red + ';', 'Edited since they approved. If the change is factual, prepare Version ' + r.nextVersion + '.'));
      if (r.pending) box.appendChild(el('div', '', 'Version ' + r.nextVersion + ' is prepared and waiting to be sent.'));
      box.appendChild(btn('Open the review', 'The preview, the brand\'s comments and the record', function () { fcOpen(r.page); }, !!r.pending || r.open > 0));
      if (!r.published) box.appendChild(btn(fcBusy ? 'Preparing…' : (r.standing === 'draft' ? 'Prepare again' : 'Prepare Version ' + r.nextVersion),
        'Copies the saved post as the next version and opens the preview to check and send it', prepareFc, false));
    }
    if (fcSent && !fcErr) box.appendChild(el('div', 'margin-top:6px;color:' + C.green + ';', '✓ Sent to the preview tab. Check it there and press Send.'));
    if (fcErr) box.appendChild(el('div', 'margin-top:6px;color:' + C.red + ';', fcErr));
    list.appendChild(box);
  }

  /* ---------- 7.6: Client review tick ----------
   * The team asked (17 Nov 2026) for a way for whoever writes a partner piece to say "this needs a client review", so
   * Mel and PJ know to send it to the brand for a fact-check. On partner posts the Publish tab has a Client review tick.
   * Ticking it tells pe-related-answers (/api/factcheck/ask), which records who asked, emails Mel and PJ once and puts
   * an orange "Client review needed" tag on the post's row in the Content Manager. Its state comes back with the
   * fact-check read (loadFc) as fc.ask: { by, at, done }. done means a version has been sent to the brand since it
   * was ticked, so the tick shows as finished and can't be changed. Unticking clears it (a mistake, or no longer
   * needed). The tick clears itself once the post is live. */
  function askWhen(iso) {
    try { return new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return ''; }
  }
  function setAsk(on) {
    if (askBusy) return;
    askBusy = true; askErr = '';
    var by = who();
    var was = fc ? fc.ask : null;
    if (!fc) fc = { review: null };
    // Shown straight away; the reply replaces it
    fc.ask = on ? (was || { by: by, at: new Date().toISOString(), done: false }) : null;
    draw();
    fetch(C.fc + 'ask', { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ t: C.fcToken, post: post, on: on, by: by, title: postTitle(), url: postData.fullUrl || location.pathname }) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        askBusy = false;
        if (d && d.ok) { fc.ask = d.ask; askErr = d.warning || ''; }
        else { fc.ask = was; askErr = (d && d.error) || 'That didn\'t save'; }
        draw();
      })
      .catch(function () { askBusy = false; fc.ask = was; askErr = 'Couldn\'t reach the fact-check system. Try again.'; draw(); });
    logEvent({ kind: on ? 'tick' : 'untick', item: 'Client review', who: by });
  }
  function drawAsk() {
    if (!fcPartner()) return;
    var a = fc && fc.ask, r = fc && fc.review;
    var already = !a && r && r.standing && r.standing !== 'draft';   // with the brand already, ticked or not
    list.appendChild(sectionLabel('Client review', '#c2410c'));
    var row = el('label', 'display:flex;align-items:center;gap:9px;padding:5px 0;font-size:13.5px;cursor:pointer;');
    var box = el('input', 'flex:0 0 auto;width:16px;height:16px;margin:0;accent-color:#c2410c;');
    box.type = 'checkbox';
    box.checked = !!a || !!already;
    box.disabled = askBusy || !fc || !!already || !!(a && a.done);
    box.onchange = function () { setAsk(box.checked); };
    row.appendChild(box);
    row.appendChild(el('span', 'flex:1;', 'Send to the brand for a fact-check'));
    row.appendChild(el('span', 'font-size:11px;font-weight:600;color:#8a9097;', a && a.by ? a.by : ''));
    list.appendChild(row);
    var note = askErr ? askErr
      : !fc ? 'Reading…'
      : already ? 'Already with the brand: ' + r.label
      : a && a.done ? '✓ Done: a version has gone to the brand' + (r && r.label ? ' (' + r.label + ')' : '')
      : a ? 'Mel and PJ have been told. Shows as "Client review needed" on the Content Manager until a version is sent.'
      : 'Tick if this piece needs a client review. Mel and PJ are emailed and send it to the brand to check facts only.';
    list.appendChild(el('div', 'margin:-2px 0 4px 25px;font:12px/1.45 ' + F + ';color:' + (askErr ? C.red : a && a.done ? C.green : '#80868d') + ';', note));
  }

  /* ---------- 5.1: Socials tick ---------- */
  // Ticked: the Partners script makes Instagram, Facebook and LinkedIn posts for this article. Not live yet: they're
  // written when it goes live. They wait on the Content Manager's Socials tab to be checked and sent.
  function loadSocial() {
    if (!post) return;
    // 7.7: the post's publish time and status, so the script knows whether it's covered by Socials by default
    // (left off until Squarespace's record is read, so the script looks the post up itself rather than guessing)
    fetch(C.socials + '?socialtick=' + encodeURIComponent(post) + '&t=' + encodeURIComponent(C.socialsToken) +
          (postData && postData.id ? '&pub=' + (+postData.publishOn || 0) + '&wf=' + (+postData.workflowState || 0) : ''))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.ok) { social = d; socialErr = ''; }
        else socialErr = d && d.error === 'key' ? 'Not switched on yet: the Partners script needs updating to v1.16' : (d && d.error) || 'no reply';
        draw();
      })
      .catch(function () { socialErr = 'Couldn\'t reach the Partners sheet'; draw(); });
  }
  function setSocial(on) {
    socialBusy = true; socialErr = '';
    var by = who();
    var wasOn = !!(social && social.on);
    // Shown straight away while the Partners sheet answers; the reply replaces it
    social = { on: on, status: on ? (wasOn ? social.status : 'asking') : '', label: on ? (wasOn ? 'Saving…' : 'Asking…') : '',
               by: on ? (wasOn && social.by ? social.by : by + ' (panel)') : '' };
    draw();
    var body = { op: 'socialtick', t: C.socialsToken, postId: post, on: on, by: by, title: postTitle() };
    fetch(C.socials, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body) })
      .then(function (r) { return r.json(); })
      .then(function (d) { socialBusy = false; if (d && d.ok) social = d; else { socialErr = (d && d.error) || 'That didn\'t save'; loadSocial(); } draw(); })
      .catch(function () { socialBusy = false; socialErr = 'Couldn\'t reach the Partners sheet. Try again.'; loadSocial(); draw(); });
    logEvent({ kind: on ? 'tick' : 'untick', item: 'Socials', who: by });
  }
  function drawSocial() {
    list.appendChild(sectionLabel('Socials'));
    var row = el('label', 'display:flex;align-items:center;gap:9px;padding:5px 0;font-size:13.5px;cursor:pointer;');
    var box = el('input', 'flex:0 0 auto;width:16px;height:16px;margin:0;accent-color:' + C.blue + ';');
    box.type = 'checkbox';
    box.checked = !!(social && social.on);
    box.disabled = socialBusy || !social;
    box.onchange = function () { setSocial(box.checked); };
    row.appendChild(box);
    row.appendChild(el('span', 'flex:1;', 'Make Instagram, Facebook and LinkedIn posts'));
    row.appendChild(el('span', 'font-size:11px;font-weight:600;color:#8a9097;', social && social.on && social.by ? String(social.by).replace(/ \(panel\)$/, '') : ''));
    list.appendChild(row);
    var note = socialErr ? socialErr : !social ? 'Reading…' : social.on || social.label ? social.label : 'Made from the article\'s own title and excerpt when it goes live, ready to check on the Content Manager\'s Socials tab';
    list.appendChild(el('div', 'margin:-2px 0 4px 25px;font:12px/1.45 ' + F + ';color:' + (socialErr || (social && social.status === 'failed') ? C.red : '#80868d') + ';', note));
  }

  /* ---------- 5.7: Free Plug-in of the Week ----------
   * Mike picks Saturday's plug-in on the dashboard and Claude drafts the article there. Squarespace has no way
   * for us to make a post from outside, so the draft waits until someone opens a blank post: this section then
   * offers "Fill with this week's pick". Fill does, in order:
   *   1. copies the article to the clipboard straight away (the browser only allows that during the click),
   *   2. pastes it into the post's first text block when the post is open for editing, the same way Joe's
   *      Links tab adds a link, so Squarespace knows the post changed,
   *   3. opens the Edit Post window and fills the headline, SEO title, meta description and URL with Joe's
   *      own fill-and-check (fieldFor, fillAndHold),
   *   4. tells the dashboard which post holds the pick (so "This week's pick" on the free plug-ins page can
   *      switch over once it's live), and ticks Socials so the posts are written with the developer tagged.
   * Anything that didn't take gets a Copy button instead. The person still checks the [Check] lines, adds the
   * picture, presses Save and schedules. */
  function loadPotw() {
    if (!post) return;
    fetch(C.potw + 'pending?t=' + encodeURIComponent(C.potwToken) + '&post=' + encodeURIComponent(post))
      .then(function (r) { return r.json(); })
      .then(function (d) { potw = d && d.ok ? d.picks || [] : []; draw(); })
      .catch(function () { potw = []; });
  }
  // The pick already filled into this post, if any
  function potwHere() { return (potw || []).filter(function (p) { return p.postId === post; })[0] || null; }
  // A post that hasn't been written yet: no headline, Squarespace's "Untitled", or no words in the body
  function potwBlank() {
    var t = String(postTitle() || '').trim();
    if (!t || /^untitled/i.test(t)) return true;
    var words = editorRoots().map(function (r) { return r.textContent; }).join(' ').trim();
    return !words && (+postData.workflowState || 0) !== 1;   // never offer it on a published post
  }
  function potwNote(t, bad, copy) { potwNotes.push({ t: t, bad: !!bad, copy: copy }); }

  function fillPotw(p) {
    var d = p.draft || {};
    potwBusy = true; potwNotes = []; draw();
    // 1. Clipboard first, while the click still counts as the person's own action
    var copied = false;
    try {
      if (window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
        navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([d.html || ''], { type: 'text/html' }),
          'text/plain': new Blob([plainOf(d.html)], { type: 'text/plain' }) })]).then(function () { copied = true; }, function () {});
      } else if (navigator.clipboard) navigator.clipboard.writeText(plainOf(d.html)).then(function () { copied = true; }, function () {});
    } catch (e) {}
    // 2. The article into the first text block, if the post is open for editing
    var root = editorRoots()[0], bodyIn = false;
    if (root) {
      try {
        var doc = root.ownerDocument, W = doc.defaultView;
        root.focus();
        var r = doc.createRange(); r.selectNodeContents(root);
        var sel = W.getSelection(); sel.removeAllRanges(); sel.addRange(r);
        pasteInto(root, d.html, plainOf(d.html));
      } catch (e) {}
    }
    wait(600).then(function () {
      bodyIn = !!root && root.textContent.replace(/\s+/g, ' ').length > 200;
      if (bodyIn) potwNote('✓ Article put into the text block.');
      else potwNote(root ? 'The article didn\'t go into the text block.' : 'The post isn\'t open for editing, so the article couldn\'t go in.', true);
      if (!bodyIn) potwNote(copied ? 'It\'s on your clipboard: click into the first text block and paste (Cmd+V).' : 'Copy it and paste it into the first text block:', true, copied ? '' : d.html);
      // 3. Headline, SEO title, meta description and URL in the Edit Post window
      return openSettings();
    }).then(function (doc) {
      var fields = [['title', d.title, 'Headline'], ['seo', d.seoTitle, 'SEO title'], ['meta', d.meta, 'Meta description'], ['url', d.slug, 'URL']];
      if (!doc) {
        potwNote('Couldn\'t open the post\'s Settings. Copy these in:', true);
        fields.forEach(function (f) { potwNote(f[2] + ': ' + f[1], true, f[1]); });
        return;
      }
      return fields.reduce(function (chain, f) {
        return chain.then(function () {
          if (!f[1]) return;
          return fieldFor(doc, f[0]).then(function (box) {
            if (!box) { potwNote(f[2] + ' box not found: ' + f[1], true, f[1]); return; }
            return fillAndHold(box, f[1]).then(function (held) {
              potwNote(held ? '✓ ' + f[2] + ' filled.' : f[2] + ' didn\'t take: ' + f[1], !held, held ? '' : f[1]);
            });
          });
        });
      }, Promise.resolve()).then(function () { settingsTab(doc, 'Content'); });
    }).then(function () {
      // 4. Tell the dashboard, then tick Socials
      return fetch(C.potw + 'filled', { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ t: C.potwToken, id: p.id, postId: post }) })
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (res && res.ok) { p.status = 'filled'; p.postId = post; }
          else potwNote('The dashboard wasn\'t told this post holds the pick: ' + ((res && res.error) || 'no reply') + '. Fill again later.', true);
        }, function () { potwNote('Couldn\'t reach the dashboard to record this post. Fill again later.', true); });
    }).then(function () {
      if (!(social && social.on) && social !== null) { setSocial(true); potwNote('✓ Socials ticked: the posts are written when it goes live, with ' + p.vendor + ' tagged if it\'s in the Brands tab.'); }
      potwNote('Now: press Save in Settings, upload the picture, check the highlighted [Check] lines, add your take, then schedule.');
      potwBusy = false; logEvent({ kind: 'potw', item: p.name, who: who() }); draw();
    }).catch(function (e) { potwBusy = false; potwNote('Fill stopped: ' + (e && e.message || e), true); draw(); });
  }
  // "Sat 14 Nov, 9am main slot" from a pick's date and slot
  var POTW_SLOTS = { '9am': '9am main slot', '6pm': '6pm second slot', extra: 'additional content' };
  function potwWhen(p) {
    var d = p.week ? new Date(p.week + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : '';
    return d + (POTW_SLOTS[p.slot] ? ', ' + POTW_SLOTS[p.slot] : '');
  }
  // Text without the tags, for the plain clipboard copy and the length check
  function plainOf(html) { var t = document.createElement('div'); t.innerHTML = html || ''; return t.textContent.replace(/\s+\n/g, '\n').trim(); }

  function drawPotw() {
    if (!potw || !potw.length) return;
    var here = potwHere(), waiting = potw.filter(function (p) { return p.status === 'drafted'; });
    if (!here && (!waiting.length || !potwBlank())) return;
    list.appendChild(sectionLabel('Free Plug-in of the Week', C.blue));
    var box = el('div', 'padding:8px 10px;border-radius:6px;background:#eef5fb;font:12.5px/1.5 ' + F + ';color:#1f2d3a;');
    if (here) {
      var dd = here.draft || {};
      box.appendChild(el('div', 'font-weight:700;margin-bottom:4px;', here.name + ' by ' + here.vendor + ' is in this post'));
      // 5.8: the day and slot chosen on the dashboard, so it's scheduled where the editorial calendar expects it
      if (here.week) box.appendChild(el('div', 'margin-bottom:6px;', 'Schedule it for ' + potwWhen(here) + '.'));
      [['Picture file name', dd.imageFile], ['Alt text', dd.imageAlt], ['Excerpt', dd.excerpt], ['Tags', (dd.tags || []).join(', ')]].forEach(function (x) {
        if (!x[1]) return;
        var row = el('div', 'display:flex;gap:8px;align-items:flex-start;margin:4px 0;');
        row.appendChild(el('span', 'flex:1;min-width:0;overflow-wrap:anywhere;', x[0] + ': ' + x[1]));
        row.appendChild(copyButton(x[1]));
        box.appendChild(row);
      });
      if (dd.image) {
        var a = el('a', 'color:' + C.blue + ';font-weight:600;', 'Open the picture to save it');
        a.href = dd.image; a.target = '_blank'; a.rel = 'noopener';
        box.appendChild(a);
      }
    } else {
      waiting.forEach(function (p) {
        box.appendChild(el('div', 'margin-bottom:6px;', 'Drafted for ' + potwWhen(p) + ': ' + p.name + ' by ' + p.vendor + '.'));
        var b = el('button', 'width:100%;padding:6px 10px;border:0;border-radius:5px;background:' + C.blue + ';color:#fff;font:700 12.5px/1.5 ' + F + ';cursor:pointer;margin-bottom:6px;',
          potwBusy ? 'Filling…' : 'Fill with this week\'s pick');
        b.type = 'button'; b.disabled = potwBusy;
        b.title = 'Puts in the article, headline, SEO title, meta description and URL, and ticks Socials';
        b.onclick = function () { fillPotw(p); };
        box.appendChild(b);
      });
    }
    potwNotes.forEach(function (n) {
      var row = el('div', 'display:flex;gap:8px;align-items:flex-start;margin-top:4px;color:' + (n.bad ? C.red : C.green) + ';');
      row.appendChild(el('span', 'flex:1;min-width:0;overflow-wrap:anywhere;', n.t));
      if (n.copy) row.appendChild(copyButton(n.copy));
      box.appendChild(row);
    });
    list.appendChild(box);
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
  function warning(on, missing, autoWarn, embBad, flagBad, planBad) {
    planBad = planBad || [];
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
    planBad.forEach(function (r) { bits.push((r.kind === 'soon' ? 'TOO SOON: ' : 'AHEAD OF PLAN: ') + (r.bar || r.text) + '.'); });
    if (missing.length) bits.push(missing.length + (missing.length === 1 ? ' check' : ' checks') + ' not done: ' + missing.join(', ') + '.');
    var others = autoWarn - (embBad ? 1 : 0) - (flagBad ? 1 : 0) - planBad.length; // already named above
    if (others) bits.push(others + (others === 1 ? ' other automatic warning' : ' other automatic warnings') + ' in the checklist.');
    // a live post has no schedule to report, only the embargo
    banner.textContent = (scheduledFor ? 'Scheduled for ' + when + '. ' : '') + bits.join(' ');
    // Amber when the only problems are the date ones (soft), red for everything else
    var onlyDate = planBad.length && !embBad && !flagBad && !missing.length && others <= 0;
    banner.style.background = onlyDate ? C.amber : C.red;
    banner.style.display = '';
  }

  // Asks Squarespace about this post: when it goes live, its status and when it was edited
  function checkSchedule() {
    // the time on the end makes Squarespace answer with the current status, never a saved copy
    return fetch(location.pathname + '?format=json&pe=' + Date.now(), { credentials: 'same-origin', cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var it = (d && d.item) || {};
        var firstRead = !postData.id;
        postData = it;
        if (firstRead && !fc) loadFc();   // 7.1: the Partner tag may only be known now, from Squarespace's record
        if (firstRead && !socialBusy) loadSocial();   // 7.7: ask again now its publish time and status are known
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
        if (editedAt !== wasEdit && fc) loadFc();   // 6.6: a new save may mean "Edited since approved"
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
    // 0c. Scheduled ahead of the planned date, and scheduled too close to now (Facebook)
    var pln = planCheck();
    if (pln) out.push(pln);
    var soon = soonCheck();
    if (soon) out.push(soon);
    // 0d. A draft nobody has edited for four weeks or more: still needed, or can it go?
    var old = staleDraftCheck();
    if (old) out.push(old);

    // 1. Alt text on the pictures in the article body and its header (ad banners don't count)
    var imgs = Array.prototype.filter.call(a.querySelectorAll('.body.entry-content img, .promoted-block-image img, .entry-header img'), function (i) {
      return own(i) && !i.closest('noscript, .antur-ad, a[href*="adserver"]') && (i.getAttribute('data-src') || i.getAttribute('src'));
    });
    // the same picture can appear twice in the page (e.g. lazy-load copies), so count each once
    var seenSrc = {};
    imgs = imgs.filter(function (i) { var k = imgSrc(i); if (seenSrc[k]) return false; seenSrc[k] = 1; return true; });
    var noAltNow = imgs.filter(function (i) { return !String(i.getAttribute('alt') || '').trim(); });
    // 5.6: Squarespace redraws image blocks as the editor opens, and for a moment a picture can have no
    // alt. Only warn when the same picture has no alt on two checks in a row; a recheck runs 3 seconds
    // after a first miss, so a real gap still shows within seconds
    var miss = {};
    noAltNow.forEach(function (i) { var k = imgSrc(i); miss[k] = (altMiss[k] || 0) + 1; });
    altMiss = miss;
    var noAlt = noAltNow.filter(function (i) { return altMiss[imgSrc(i)] >= 2; });
    if (noAltNow.length > noAlt.length) altRecheck = true;
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
    // 6a (v4.1). The picture Squarespace hands to the homepage tile and Facebook: the promoted hero,
    // or the Featured Image on the Options tab (assetUrl then ends in a file name). Since midday on
    // 2 Nov 2026 Squarespace stopped promoting the first image of a post when it's saved, so a hero in
    // the body alone isn't enough any more. Read from the saved post, so it updates after Save.
    // 5.3: only the Featured Image counts now. Found 6 Nov 2026: Squarespace promotes heroes again, but a post
    // with a promoted hero and no Featured Image still shares the site logo (Vienna Performer, Logic Pro 13,
    // MIXPrep 2.3.1, UAD Capitol Studios). An empty Featured Image comes back as a folder address ending in /.
    var served = hasFeatured();
    if (!hero) out.push({ ok: false, text: 'No hero image, so search results will show no picture' });
    else if (!served) out.push({ ok: false, kind: 'featured', text: featuredMsg || 'No Featured Image, so Facebook, LinkedIn, Google and the homepage tile get the site logo. Joe fills it when the post is saved with its Edit window open, or press Fill it now' });
    else out.push({ ok: true, text: 'Hero image in place' });

    // 6d (v4.9). Tagged "Hero" for the homepage slideshow: is the picture wide enough? The homepage
    // skips pictures under 1500px wide (same number as minWidth in the Hero tag section), so say so
    // here, where it can be fixed. Applies to live posts too, as old articles get tagged.
    var heroTag = a.classList.contains('tag-hero') ||
      (postData.tags || []).some(function (t) { return String(t).toLowerCase() === 'hero'; });
    if (heroTag) {
      var HERO_MIN = 1500;
      var hsrc = String((postData.promotedBlock || '') + (postData.body || ''));
      var hm = hsrc.match(/<img[^>]+data-image-dimensions="(\d+)x(\d+)"/i);
      var hw = hm ? +hm[1] : 0;
      if (!hw && hero) {
        var him = hero.tagName === 'IMG' ? hero : hero.querySelector && hero.querySelector('img');
        var hd = him && (him.getAttribute('data-image-dimensions') || '').match(/^(\d+)x/);
        hw = hd ? +hd[1] : 0;
      }
      if (!hw) out.push({ ok: false, text: 'Tagged Hero, but no picture found for the homepage slideshow' });
      else if (hw < HERO_MIN) out.push({ ok: false, text: 'Tagged Hero, but the picture is ' + hw + 'px wide, so the homepage will skip it. Upload a version ' + HERO_MIN + 'px wide or more' });
      else out.push({ ok: true, text: 'Tagged Hero: picture is ' + hw + 'px wide, sharp enough for the homepage' });
    }

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
          out.push(linkSugg.shortlist.length
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
    return runAuto().then(function (res) {
      auto = res;
      if (altRecheck) { altRecheck = false; setTimeout(refreshAuto, 3000); } // 5.6: confirm a missing alt quickly
      autoFeatured(); // 5.3: a saved post with a hero and no Featured Image gets one
      if (!planEditing) renderPlan(); // the planned date line turns amber or back as the schedule changes
    if (!embEditing) renderEmbargo(); // and the embargo link goes once the post is live
      if (loaded) draw();
    });
  }

  /* ---------- Help me write drawer ---------- */

  var TABS = [['headlines', 'Headlines'], ['meta', 'Meta description'], ['url', 'URL'], ['alt', 'Alt text']];

  // Inside the Squarespace editor, the post sits in a frame and the editor's own toolbars float
  // over it, covering anything in the frame. So the drawer goes in the editor window itself.
  function hostDoc() {
    try { if ((window.top !== window && !window.PE_FC_PREVIEW) && window.top.document && window.top.document.body) return window.top.document; } catch (e) {}
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
    if (drawerInner && drawerInner.parentNode === drawer) drawerInner.style.display = drawerShut ? 'none' : 'flex';
    if (drawerChev) drawerChev.textContent = drawerShut ? '▸' : '▾';
  }

  function setDrawerShut(v) {
    drawerShut = v;
    ls('pe-hmw-shut', v ? '1' : '');
    placeDrawer();
    drawJoeBar();
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
    // 5.4: help on whichever tab Joe is showing
    drawerHead.appendChild(helpButton('Help for this tab', function () {
      var t = drawerTabs().filter(function (d) { return d[0] === drawerTab; })[0];
      openHelp('joe-' + drawerTab, 'Joe \u203a ' + (t ? t[1] : 'Joe'));
    }));
    var x = el('button', 'flex:0 0 auto;border:0;background:none;font-size:22px;font-weight:400;line-height:1;cursor:pointer;color:#8a9097;padding:0 2px;', '×');
    x.type = 'button';
    x.className = 'pe-x';
    x.setAttribute('aria-label', 'Close');
    x.title = 'Close';
    // 7.0: closing the popped-out window puts Joe back in the panel's Joe tab
    x.onclick = function () { drawer.style.display = 'none'; joePopped = false; DRAWER_W = 380; draw(); };
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

  // 7.0: everything that opened Joe (warning Suggest buttons, chips, Fill) now opens the panel's Joe tab on that
  // tab. Only Pop out wider gives Joe its own window, as before 7.0.
  function openDrawer(tab) {
    if (tab) drawerTab = tab;
    if (!joePopped && panel) {
      panelTab = 'joe'; ls('pe-ck-tab', 'joe'); tabPicked = true;
      if (mode === 'pill' || panel.style.display === 'none') mode = 'open';
      draw();
      return;
    }
    popJoe();
  }
  // Builds Joe's window and its inner part once, hidden
  function makeDrawer() {
    if (drawer && !drawer.isConnected) { drawer = null; drawerInner = null; }
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
      watchJoeHighlight(drawer);
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
      drawer.style.display = 'none';
    }
  }
  // Pop out wider: Joe in its own window, 560px wide, for the Image and Links tabs
  function popJoe() {
    makeDrawer();
    joePopped = true;
    DRAWER_W = 560;
    if (drawerInner.parentNode !== drawer) drawer.appendChild(drawerInner);
    drawer.style.display = 'flex';
    if (drawerShut) setDrawerShut(false);
    placeDrawer();
    drawDrawer();
    if (panel) draw();
  }
  // The Joe tab: Joe's inner part moved into the panel, under a slim bar with help and Pop out wider
  function showJoe() {
    if (joePopped) {
      joeHost.innerHTML = '';
      var box = el('div', 'padding:16px;display:flex;flex-direction:column;gap:10px;font-size:13px;line-height:1.5;color:#444;');
      box.appendChild(el('div', '', 'Joe is open in its own wider window.'));
      var back = el('button', 'align-self:flex-start;padding:6px 14px;border:0;border-radius:6px;background:' + C.blue + ';color:#fff;font:700 12.5px ' + F + ';cursor:pointer;', 'Bring Joe back into the panel');
      back.type = 'button';
      back.onclick = function () { if (drawer) drawer.style.display = 'none'; joePopped = false; DRAWER_W = 380; draw(); };
      box.appendChild(back);
      joeHost.appendChild(box);
      return;
    }
    makeDrawer();
    if (drawerInner.parentNode !== joeHost) {
      joeHost.innerHTML = '';
      var bar = el('div', 'display:flex;align-items:center;gap:8px;padding:8px 14px 6px;');
      var mark = el('span', 'flex:1;display:flex;align-items:center;gap:6px;color:' + C.blue + ';');
      mark.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:block">' +
        '<rect x="9" y="2.5" width="6" height="11" rx="3"/><path d="M5.5 10.5a6.5 6.5 0 0 0 13 0"/><path d="M12 17v4.5"/><path d="M8.5 21.5h7"/></svg>' +
        '<span style="font-size:12px;font-weight:800;letter-spacing:.14em;">JOE</span>';
      bar.appendChild(mark);
      bar.appendChild(helpButton('Help for this tab', function () {
        var t = drawerTabs().filter(function (d) { return d[0] === drawerTab; })[0];
        openHelp('joe-' + drawerTab, 'Joe \u203a ' + (t ? t[1] : 'Joe'));
      }));
      var pop = el('button', 'padding:3px 10px;border:1px solid #d4d8dd;border-radius:5px;background:#fff;font:600 11.5px ' + F + ';color:#3c4043;cursor:pointer;', 'Pop out wider \u2197');
      pop.type = 'button';
      pop.title = 'Open Joe in its own wider window, handy for Image and Links';
      pop.onclick = popJoe;
      bar.appendChild(pop);
      joeHost.appendChild(bar);
      joeHost.appendChild(drawerInner);
    }
    drawerInner.style.display = 'flex';
    // A fixed height inside the panel, so Joe's own list scrolls rather than the whole panel
    var w = joeHost.ownerDocument.defaultView || window;
    var h = Math.max(260, Math.min(560, w.innerHeight - 220));
    drawerInner.style.height = (h - 36) + 'px';
  }

  /* ---------- Joe bar (v3.0) ----------
   * A bar pinned to the foot of the pre-publish checks panel, on every stage, so Joe can always
   * be found again after it's closed. It stays put while the checks above it scroll.
   *   - Closed: the Joe wordmark, an Open Joe button, and a chip per tab that opens Joe on that tab.
   *   - Open (even if shrunk or dragged out of the way): the bar turns blue and says "is open",
   *     with Bring to front, which opens it full size. The chip for the tab Joe is on is highlighted.
   * Replaces the old Ask Joe button, which only showed on drafts and posts in review and so
   * vanished once all the checks were ticked. */
  var joeBar = null, joeBarRow = null, joeChips = null;

  // Short chip labels, so all six fit on two rows at most in a 300px panel
  var JOE_CHIP = { headlines: 'Headlines', meta: 'Meta', url: 'URL', alt: 'Alt text', links: 'Links', image: 'Image', overview: 'Advice' };

  // Joe counts as open when its window is on the page and not closed with x
  function joeIsOpen() {
    if (joePopped) return !!(drawer && drawer.isConnected && drawer.style.display !== 'none');
    // 7.0: docked in the panel's Joe tab, with the panel open
    return !!(panel && panelTab === 'joe' && panel.style.display !== 'none' && drawerInner && joeHost && drawerInner.parentNode === joeHost);
  }

  // Built once by build(); position:sticky keeps it at the foot of the panel's scrolling area
  function buildJoeBar() {
    joeBar = el('div', 'position:sticky;bottom:0;z-index:1;padding:9px 16px 10px;border-top:1px solid #eceef1;background:#fafbfc;');
    joeBarRow = el('div', 'display:flex;align-items:center;gap:8px;');
    joeChips = el('div', 'display:flex;flex-wrap:wrap;gap:5px;margin-top:8px;');
    joeBar.appendChild(joeBarRow);
    joeBar.appendChild(joeChips);
    return joeBar;
  }

  // Redraws the bar to match Joe's state: closed, open, or open but shrunk
  function drawJoeBar() {
    if (!joeBar) return;
    var open = joeIsOpen();
    joeBar.style.background = open ? '#e8f1f9' : '#fafbfc';
    joeBarRow.innerHTML = '';
    // Same microphone glyph and JOE capitals as Joe's own title bar
    var mark = el('span', 'display:flex;align-items:center;gap:6px;color:' + C.blue + ';');
    mark.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:0 0 auto;display:block">' +
      '<rect x="9" y="2.5" width="6" height="11" rx="3"/><path d="M5.5 10.5a6.5 6.5 0 0 0 13 0"/><path d="M12 17v4.5"/><path d="M8.5 21.5h7"/></svg>' +
      '<span style="font-size:13px;font-weight:800;letter-spacing:.14em;line-height:1;">JOE</span>';
    joeBarRow.appendChild(mark);
    joeBarRow.appendChild(el('span', 'flex:1;font-size:12px;color:' + C.blue + ';', open ? (drawerShut ? 'is open, shrunk' : 'is open') : ''));
    // 5.4: help on the checks panel (and from there, every topic)
    joeBarRow.appendChild(helpButton('Help: the checks panel, Joe and the whole system', function () { openHelp('checks', 'the checks panel'); }));
    var b = el('button', 'flex:0 0 auto;padding:4px 12px;border:1px solid ' + C.blue + ';border-radius:5px;background:' + (open ? '#fff' : C.blue) +
      ';font:700 12px/1.6 ' + F + ';color:' + (open ? C.blue : '#fff') + ';cursor:pointer;', open ? 'Bring to front' : 'Open Joe');
    b.type = 'button';
    b.title = 'Joe v' + PE_VERSION + ' (formerly Help me write): headlines, meta descriptions, URLs, alt text, links and images';
    // Bring to front opens it full size, since a shrunk Joe is the usual reason it's hard to see
    b.onclick = function () { if (open && drawerShut) setDrawerShut(false); openDrawer(); };
    joeBarRow.appendChild(b);
    // One chip per tab this person can use (Links and Image follow the same settings as Joe's tabs)
    joeChips.innerHTML = '';
    drawerTabs().forEach(function (t) {
      var on = open && drawerTab === t[0];
      var c = el('button', 'padding:2px 9px;border:1px solid ' + (on ? C.blue : '#d5d9de') + ';border-radius:999px;background:' + (on ? '#fff' : 'transparent') +
        ';font:600 11.5px/1.6 ' + F + ';color:' + (on ? C.blue : '#555') + ';cursor:pointer;white-space:nowrap;', JOE_CHIP[t[0]] || t[1]);
      c.type = 'button';
      c.title = 'Open Joe on ' + t[1];
      c.onclick = function () { openDrawer(t[0]); };
      joeChips.appendChild(c);
    });
  }

  /* ---------- Joe's advice (8.7, 19 Nov 2026; was the Overview check, v3.5) ----------
   * Why it exists: Google now answers many searches with its own AI summary, and fewer people click through.
   * Joe's advice is there to win those clicks back, by checking that a piece keeps the promise its headline
   * makes and that a searcher can see it comes from people who do the work.
   *
   * How it works:
   *  - The writer says in one line what the piece is for. Joe gives no advice without it. The line is saved
   *    with the post on Joe's server (pe-related-answers, /api/joe), so the whole team sees it.
   *  - Joe answers under four fixed headings: What I understood, Is the promise kept?, Why would someone
   *    click past Google?, What to do. Up to three suggestions, each saying where, what and why.
   *  - The server reads the author's bio and the team's bios, and looks up our earlier coverage.
   *  - There is no score and nothing is counted. An unchanged post always gets the same answer, earlier
   *    suggestions come back word for word until they're covered, and covered ones are ticked off.
   *  - The rules live on the server (functions-lib/joe.js in pe-related-answers): no verdicts unless the
   *    headline promised one, no padding, news judged as news (News tag or category only).
   * Advisory only: never a warning, never counted, never blocks Ready to schedule.
   * Runs once by itself when a post reaches review, if the writer's line is there; otherwise on Check.
   * The old Google Sheet task "overview" (Code.gs) is no longer called. */
  var ovRes = null, ovFor = '', ovBusy = false, ovErr = '', ovAuto = false, ovMarked = false;
  var ovSameNote = false;   // 8.8: true when the last check found nothing changed, so the saved answer came back
  var ovPointNow = '', ovPointBy = '', ovReady = false;   // the writer's one line, who wrote it, and whether the server has answered
  var ovOpen = ls('pe-ov-open') === '1';

  // Embedded video and audio a reader can watch or hear and an AI summary can't (v3.8).
  // Squarespace video and audio blocks, embed blocks holding a known player, and bare players.
  var OV_MEDIA = /youtube\.com|youtu\.be|youtube-nocookie\.com|vimeo\.com|wistia|soundcloud\.com|spotify\.com|bandcamp\.com|mixcloud\.com|podbean|buzzsprout|libsyn|anchor\.fm|simplecast|captivate|audiomack|loom\.com|pe-related-answers\.pages\.dev\/stem-player/i;
  var OV_AUDIO_HOST = /soundcloud|spotify|bandcamp|mixcloud|podbean|buzzsprout|libsyn|anchor\.fm|simplecast|captivate|audiomack/i;
  // 7.2: our own players (stem, A/B, blind test, clip player, mixer), made on the dashboard's Stems pages.
  // In a Code Block they're a plain div until stem-player.js runs, and the editor never runs it, so they
  // have to be found by their class. All five are audio.
  var OV_PE_PLAYERS = '.pe-stems, .pe-ab, .pe-blind, .pe-clips, .pe-mix';

  // 7.2: what a block really holds. In the editor Squarespace often keeps an embed's or Code Block's code in
  // the block's settings (data-block-json) or in a data-html attribute and only draws the player when it's
  // played, so the page itself has no iframe to find. This returns the block itself plus that stored code,
  // read with DOMParser, which never runs scripts or loads anything.
  function ovSources(e) {
    var out = [e], code = [];
    try {
      var info = JSON.parse(e.getAttribute('data-block-json') || '{}') || {};
      if (info.html) code.push(String(info.html));
      if (info.url) code.push('<iframe src="' + String(info.url).replace(/"/g, '&quot;') + '"></iframe>');
    } catch (x) {}
    Array.prototype.forEach.call(e.querySelectorAll('[data-html]'), function (d) { code.push(d.getAttribute('data-html') || ''); });
    code.forEach(function (h) {
      if (!h) return;
      try { out.push(new DOMParser().parseFromString(h, 'text/html').body); } catch (x) {}
    });
    return out;
  }
  // The first match for a selector across the block and its stored code
  function ovFind(e, sel) {
    var srcs = ovSources(e);
    for (var i = 0; i < srcs.length; i++) {
      if (srcs[i].matches && srcs[i].matches(sel)) return srcs[i];
      var f = srcs[i].querySelector(sel);
      if (f) return f;
    }
    return null;
  }
  // What kind of player a block or bare player is: 'Video', 'Audio', or '' if it isn't one
  function ovMedia(e) {
    if (e.matches('.sqs-block-video')) return 'Video';
    if (e.matches('.sqs-block-audio')) return 'Audio';
    if (e.matches(OV_PE_PLAYERS) || ovFind(e, OV_PE_PLAYERS)) return 'Audio';   // 7.2: our own players
    var srcs = ovSources(e);
    for (var s = 0; s < srcs.length; s++) {
      var root = srcs[s];
      var players = root === e && !/^(IFRAME|VIDEO|AUDIO)$/.test(e.tagName) ? root.querySelectorAll('iframe, video, audio')
        : root === e ? [e] : root.querySelectorAll('iframe, video, audio');
      for (var i = 0; i < players.length; i++) {
        var f = players[i];
        if (f.tagName === 'AUDIO') return 'Audio';
        if (f.tagName === 'VIDEO') return 'Video';
        var src = f.getAttribute('src') || f.getAttribute('data-src') || '';
        if (f.tagName === 'IFRAME' && OV_MEDIA.test(src)) return OV_AUDIO_HOST.test(src) ? 'Audio' : 'Video';
      }
    }
    // Squarespace marks some embeds with the provider's name instead
    var prov = e.querySelector('[data-provider-name]');
    if (prov) return OV_AUDIO_HOST.test(prov.getAttribute('data-provider-name') || '') ? 'Audio' : 'Video';
    return '';
  }
  // 7.2: a table in the post, either in a Code Block (the dashboard's Tables tool) or pasted into a text block
  function ovTable(e) {
    if (e.tagName === 'TABLE') return e;
    var t = ovFind(e, 'table');
    return t && t.rows && t.rows.length >= 2 ? t : null;
  }

  // How each item is described to Claude: the text of a paragraph, or a label for a player, picture or table
  function ovText(e) {
    var kind = e.getAttribute('data-pe-ov');
    if (!kind) return squash(e.textContent);
    if (kind === 'Image') { // v3.9: alt text, caption and file name, which usually says whether it's a screenshot
      var img = e.querySelector('img'), alt = squash(img && img.getAttribute('alt'));
      var file = '';
      try { file = decodeURIComponent(imgSrc(img).split('/').pop()).replace(/\+/g, ' '); } catch (x) {}
      var cap = squash((e.querySelector('figcaption, .image-caption') || {}).textContent || '').slice(0, 160);
      return '[Image' + (alt ? ': ' + alt : '') + (cap && cap !== alt ? '. Caption: ' + cap : '') + (file ? '. File: ' + file.slice(0, 80) : '') + ']';
    }
    if (kind === 'Table') { // 7.2: the table's size, its header row and as many rows as fit, so Claude can judge whose data it is
      var tb = ovTable(e);
      if (!tb) return '[Table]';
      var rows = Array.prototype.map.call(tb.rows, function (r) {
        return Array.prototype.map.call(r.cells, function (c) { return squash(c.textContent); }).join(' | ');
      }).filter(Boolean);
      var cols = tb.rows[0] ? tb.rows[0].cells.length : 0;
      var tcap = squash((tb.querySelector('caption') || {}).textContent || '');
      var body = rows.slice(1).join('; ');
      if (body.length > 900) body = body.slice(0, 900) + '…';
      return '[Table: ' + rows.length + ' rows, ' + cols + ' columns' + (tcap ? '. Caption: ' + tcap : '') +
        '. Header: ' + (rows[0] || '') + '. Rows: ' + body + ']';
    }
    // 7.2: our own players say so plainly, with their title and the clips they hold
    var pe = e.matches(OV_PE_PLAYERS) ? e : ovFind(e, OV_PE_PLAYERS);
    if (pe) {
      var cl = pe.classList;
      var what = cl.contains('pe-blind') ? 'blind test' : cl.contains('pe-ab') ? 'A/B player' :
        cl.contains('pe-clips') ? 'clip player' : cl.contains('pe-mix') ? 'mixer' : 'stem player';
      var names = [];
      try {
        names = (JSON.parse(pe.getAttribute('data-tracks') || '[]') || []).map(function (t) { return squash(t && (t.name || t.label)); }).filter(Boolean);
      } catch (x) {}
      var ptitle = squash(pe.getAttribute('data-title') || pe.getAttribute('data-label') || '');
      return '[Audio' + (ptitle ? ': ' + ptitle : '') + ', our own ' + what + ' with audio Production Expert recorded or prepared for this post' +
        (names.length ? '. Clips: ' + names.join(', ').slice(0, 200) : '') + ']';
    }
    var info = {};
    try { info = JSON.parse(e.getAttribute('data-block-json') || '{}') || {}; } catch (x) {}
    var f = ovFind(e, 'iframe, video, audio') || e;
    var src = info.url || info.audioAssetUrl || f.getAttribute('src') || f.getAttribute('data-src') || '';
    var host = '';
    try { host = new URL(src, location.href).hostname.replace(/^www\./, ''); } catch (x) {}
    var title = squash(info.title || (f.getAttribute && f.getAttribute('title')) || '');
    if (/^(youtube|vimeo)?\s*(video\s*)?player$/i.test(title)) title = '';
    var words = squash(info.description || e.textContent || '').slice(0, 160);
    return '[' + kind + (title ? ': ' + title : '') + (host && !/squarespace/i.test(host) ? ', from ' + host : kind === 'Audio' ? ', uploaded to the post' : '') +
      (words && words !== title ? '. Caption: ' + words : '') + ']';
  }
  // The article's paragraphs, list items, players, pictures and tables in reading order, stopping at the
  // related links block
  /* 8.8: where the article's text is read from. Editing on the page itself, the page holds the live text. In the
   * Edit Post window (Edit from the post list) the page behind is only a preview that doesn't change until the
   * post is saved, so Joe read the old text and gave the same advice after an edit. When that window is open,
   * its own text is read instead. Any trouble finding it falls back to the page. */
  function ovBody() {
    var page = articleBody(), live = null;
    try {
      editDocs().some(function (doc) { live = doc.querySelector('.sqs-layout.sqs-editing'); return !!live; });
      if (live && !(page && page.contains(live)) && live.querySelector('p')) return live;
    } catch (e) {}
    return page;
  }
  function ovParas() {
    var body = ovBody();
    if (!body) return [];
    // 7.2: start clean each time, so a block that changed since the last look is judged afresh
    Array.prototype.forEach.call(body.querySelectorAll('[data-pe-ov]'), function (x) { x.removeAttribute('data-pe-ov'); });
    var out = [], stop = false;
    Array.prototype.forEach.call(body.querySelectorAll('p, li, blockquote, table, .sqs-block-image, .sqs-block-video, .sqs-block-audio, .sqs-block-embed, .sqs-block-code, .sqs-block-html, ' + OV_PE_PLAYERS + ', iframe, video, audio'), function (e) {
      if (stop) return;
      if (e.closest('.pe-ui, .pe-signup, .pe-author-bio, .pe-checklist, .pe-drawer')) return;
      if (e.parentElement && e.parentElement.closest('[data-pe-ov]')) return; // counted with its block
      // Pictures in the body (v3.9). The hero (any picture before the first paragraph) and ad banners don't count
      if (e.matches('.sqs-block-image')) {
        var pic = e.querySelector('img');
        if (!pic || !out.length || e.querySelector('.antur-ad, a[href*="adserver"]') || e.closest('.antur-ad')) return;
        e.setAttribute('data-pe-ov', 'Image');
        out.push(e);
        return;
      }
      // Text blocks are only looked at for a table inside them; their paragraphs are counted one by one below
      if (e.matches('.sqs-block-html')) return;
      // A table pasted into a text block (7.2)
      if (e.tagName === 'TABLE') {
        if (e.rows && e.rows.length >= 2) { e.setAttribute('data-pe-ov', 'Table'); out.push(e); }
        return;
      }
      if (/^(IFRAME|VIDEO|AUDIO)$/.test(e.tagName) || e.matches('.sqs-block-video, .sqs-block-audio, .sqs-block-embed, .sqs-block-code, ' + OV_PE_PLAYERS)) {
        var kind = ovMedia(e);
        // 7.2: a Code Block holding a table (the dashboard's Tables tool) counts as one item
        if (!kind && e.matches('.sqs-block-code, .sqs-block-embed') && ovTable(e)) kind = 'Table';
        if (kind) { e.setAttribute('data-pe-ov', kind); out.push(e); }
        return;
      }
      var t = squash(e.textContent);
      if (/You Might Also Find These Articles Useful/i.test(t)) { stop = true; return; }
      if (e.tagName === 'LI' && e.querySelector('p')) return;          // its paragraphs count instead
      if (e.tagName === 'P' && e.closest('blockquote, li') && out.indexOf(e.closest('blockquote, li')) >= 0) return;
      if (t.length >= 40) out.push(e);
    });
    return out;
  }
  // What's saved for this post: first this browser's copy (so it shows at once), then the server's, which is
  // the one the whole team shares
  function ovLoad() {
    if (ovFor === post || !post) return;
    ovFor = post; ovRes = null; ovPointNow = ''; ovPointBy = ''; ovReady = false; ovErr = ''; ovAuto = false;
    try {
      var mine = JSON.parse(ls('pe-joe-' + post) || 'null');
      if (mine) { ovPointNow = mine.point || ''; ovPointBy = mine.by || ''; ovRes = mine.advice && mine.advice.v === 2 ? mine.advice : null; }
    } catch (e) {}
    var asked = post;
    fetch(C.joe + 'state?post=' + encodeURIComponent(post))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (asked !== post) return;
        ovReady = true;
        if (d && d.ok) {
          // The server's line wins, unless someone is typing a new one in this browser right now
          var typing = drawer && drawer.ownerDocument.activeElement && drawer.ownerDocument.activeElement.getAttribute &&
            drawer.ownerDocument.activeElement.getAttribute('data-keep') === 'joe-point';
          if (!typing && d.point) { ovPointNow = d.point; ovPointBy = d.pointBy || ''; }
          if (d.advice) ovRes = d.advice;
          ovKeep();
        }
        draw();
      })
      .catch(function () { ovReady = true; });
  }

  /* ---------- Joe's advice: the lines Joe says and the parts he draws (8.7) ---------- */
  function ovNews() { try { return adHoc() === 'News'; } catch (e) { return false; } }   // News tag or category only (Site 54)
  function ovPartner() { return !!document.querySelector('body.view-item article.hentry.tag-partner'); }
  // The article as the numbered items Joe reads
  function ovItems(paras) { return (paras || ovParas()).map(ovText); }
  // True when the post's headline, line or text has changed since the advice was given. The server keeps the
  // first 160 characters of each item with the advice, so this works for a colleague's check too.
  function ovStale() {
    if (!ovRes) return false;
    if ((ovRes.point || '') !== ovPointNow) return true;
    var now = ovItems().map(function (t) { return squash(t).slice(0, 160); });
    return JSON.stringify(now) !== JSON.stringify(ovRes.items || []);
  }
  // Keeps the line and the advice in this browser too, so the panel shows them at once next time
  function ovKeep() { ls('pe-joe-' + post, JSON.stringify({ point: ovPointNow, by: ovPointBy, advice: ovRes })); }

  // Saves the writer's one line for the whole team
  // (No redraw here: the box saves as the writer clicks away from it, and redrawing at that moment would swallow
  // the click they were making, such as Check my piece. The panel's own redraw a few seconds later shows the note.)
  function ovSavePoint(text) {
    text = squash(text).slice(0, 240);
    if (text === ovPointNow) return;
    ovPointNow = text; ovPointBy = account().first || account().name || '';
    ovKeep();
    fetch(C.joe + 'point', { method: 'POST', body: JSON.stringify({ post: post, point: text, who: ovPointBy }) }).catch(function () {});
  }

  // One check. Joe gives no advice until the writer has said what the piece is for.
  function ovRun() {
    if (ovBusy) return;
    if (!ovPointNow) { ovErr = 'Add your one line first: what is the point of this piece?'; draw(); return; }
    var paras = ovParas();
    if (paras.length < 4) { ovErr = 'There isn\'t enough article text yet to check'; draw(); return; }
    ovBusy = true; ovErr = ''; ovSameNote = false;
    draw();
    var au = authorOf();
    var payload = {
      post: post, title: postTitle(), seoTitle: seo().seoTitle || '', meta: seo().seoDescription || '',
      url: postData.urlId || '', author: au.name || '', point: ovPointNow,
      news: ovNews() ? 1 : 0, partner: ovPartner() ? 1 : 0,
      items: ovItems(paras), who: account().first || account().name || ''
    };
    // Sent as plain text so the browser makes a simple request
    fetch(C.joe + 'advice', { method: 'POST', body: JSON.stringify(payload) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        ovBusy = false;
        if (d && d.ok && d.advice) { ovRes = d.advice; ovSameNote = !!d.same; ovKeep(); }
        else ovErr = (d && d.message) || 'No answer came back';
        if (ovMarked) ovMark(true);
        draw();
      })
      .catch(function () { ovBusy = false; ovErr = 'Could not reach Joe. Check your connection and try again.'; draw(); });
  }

  // Show in the post: paragraphs only we could write get a green edge, ones a summary could repeat a grey wash
  function ovMark(on) {
    ovMarked = on;
    var ours = (ovRes && ovRes.ours) || [];
    ovParas().forEach(function (e, i) {
      var mine = ours.indexOf(i + 1) >= 0;
      e.style.background = on ? (mine ? '#eef6e6' : '#eceef1') : '';
      e.style.boxShadow = on && mine ? 'inset 3px 0 0 ' + C.green : '';
      e.style.borderRadius = on ? '3px' : '';
      e.title = on ? (mine ? 'Only we can say this' : 'A Google summary could repeat this') : '';
    });
    if (on) {
      var first = ovParas().filter(function (e, i) { return ours.indexOf(i + 1) < 0; })[0];
      if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function ovSmall(text, fn, blue) {
    var b = el('button', 'flex:0 0 auto;padding:2px 9px;border:1px solid ' + (blue ? C.blue : '#dde1e6') + ';border-radius:5px;background:#fff;font:' + (blue ? 700 : 600) +
      ' 11.5px/1.6 ' + F + ';color:' + (blue ? C.blue : '#444') + ';cursor:pointer;', text);
    b.type = 'button';
    b.onclick = fn;
    return b;
  }
  // One of the four fixed headings. Sentence case, exactly as Russ approved them, never reworded.
  function ovHead(text) { return el('div', 'margin:16px 0 5px;font:700 13.5px/1.35 ' + F + ';color:#1f2933;', text); }
  function ovLine(text, colour) { return el('div', 'margin:3px 0;font-size:12.5px;line-height:1.5;color:' + (colour || '#3a4048') + ';', text); }
  // One suggestion: where it goes (bold), what to do, and why the reader expects it. Ticked and struck through when done.
  function ovPoint(s, done) {
    var d = el('div', 'margin:8px 0;padding:3px 0 3px 10px;border-left:2px solid ' + (done ? '#c9ced4' : C.green) + ';font-size:12.5px;line-height:1.5;color:' + (done ? '#80868d' : '#333') + ';');
    if (done) {
      d.appendChild(el('span', 'color:' + C.green + ';font-weight:700;', '✓ '));
      d.appendChild(el('span', 'text-decoration:line-through;', s.text || ''));
      return d;
    }
    if (s.where) d.appendChild(el('div', 'font-weight:700;color:#1f2933;', s.where));
    d.appendChild(el('div', '', s.what || ''));
    if (s.link && s.link.url) {
      var a = el('a', 'display:inline-block;margin-top:2px;color:' + C.blue + ';text-decoration:underline;', s.link.title + (s.link.year ? ' (' + s.link.year + ')' : ''));
      a.href = s.link.url; a.target = '_blank'; a.rel = 'noopener';
      d.appendChild(a);
    }
    if (s.why) d.appendChild(el('div', 'margin-top:2px;color:#5f6368;', 'Why: ' + s.why));
    // 8.8: on a later check, what the writer's change did and what is still missing
    if (s.note) d.appendChild(el('div', 'margin-top:4px;padding:4px 7px;border-radius:4px;background:#fff4e0;color:#5a3a00;', 'Still open: ' + s.note));
    return d;
  }
  // The one-line summary shown on the Checks tab
  function ovSummary(r) {
    var n = (r.suggestions || []).length;
    return (r.kept === 'no' ? 'promise not kept' : 'promise kept') + ', ' + (n ? n + (n === 1 ? ' suggestion' : ' suggestions') : 'nothing to add');
  }

  // The Joe's advice section of the Checks tab: one line, opening to the first thing to do
  function drawOverview() {
    ovLoad();
    var wf = +postData.workflowState || 0;
    // Runs once by itself when the post reaches review, if the writer's line is there and nobody has checked yet
    if (!ovRes && !ovBusy && !ovErr && !ovAuto && wf === 3 && ovPointNow && ovReady) { ovAuto = true; setTimeout(ovRun, 0); }
    if (!ovRes && !ovBusy && wf === 1) return; // nothing to show on a live post never checked
    list.appendChild(sectionLabel('Joe\'s advice'));
    if (!ovRes) {
      var r0 = el('div', 'display:flex;align-items:center;gap:8px;padding:3px 0;font-size:13px;line-height:1.4;color:' + (ovErr && ovPointNow ? C.red : '#555') + ';');
      r0.appendChild(el('span', 'flex:1;', ovBusy ? 'Joe is reading the post…'
        : !ovPointNow ? 'Joe: add your one line to get advice'
        : ovErr || 'Joe: does the piece keep its headline\'s promise?'));
      if (!ovBusy) r0.appendChild(!ovPointNow ? ovSmall('Open Joe', function () { openDrawer('overview'); }, true) : ovSmall(ovErr ? 'Try again' : 'Check', ovRun, true));
      list.appendChild(r0);
      return;
    }
    var stale = ovStale(), bad = ovRes.kept === 'no';
    var row = el('button', 'display:flex;align-items:center;gap:8px;width:100%;margin:2px 0;padding:6px 9px;border:1px solid #e1e4e8;border-radius:6px;background:#f6f7f9' +
      ';text-align:left;font:13px/1.4 ' + F + ';color:#3a4048;cursor:pointer;');
    row.type = 'button';
    row.title = 'Joe checks that the piece keeps its headline\'s promise and gives a searcher a reason to click past Google\'s summary';
    row.appendChild(el('span', 'flex:1;', 'Joe: ' + (ovBusy ? 'reading…' : ovSummary(ovRes)) + (stale ? ' (edited since)' : '')));
    row.appendChild(el('span', 'font-size:11px;color:#5f6368;', ovOpen ? '▴' : '▾'));
    row.style.borderLeft = '3px solid ' + (bad ? C.amber : C.green);
    row.onclick = function () { ovOpen = !ovOpen; ls('pe-ov-open', ovOpen ? '1' : '0'); draw(); };
    list.appendChild(row);
    if (!ovOpen) return;
    var box = el('div', 'padding:6px 2px 4px;font-size:12.5px;line-height:1.45;color:#444;');
    var p = (ovRes.suggestions || [])[0];
    if (p) box.appendChild(ovPoint(p, false));
    else box.appendChild(el('div', '', 'Nothing to add.'));
    var dn = (ovRes.done || []).length;
    if (dn) box.appendChild(el('div', 'color:#5f6368;', dn + (dn === 1 ? ' point' : ' points') + ' from earlier checks done.'));
    if (stale) box.appendChild(el('div', 'margin-top:4px;color:#5a3a00;', 'The post has changed since. Check again to update the advice.'));
    if (ovErr) box.appendChild(el('div', 'margin:4px 0;color:' + C.red + ';', ovErr));
    var btns = el('div', 'display:flex;gap:6px;margin-top:6px;');
    btns.appendChild(ovSmall('All four answers in Joe', function () { openDrawer('overview'); }, true));
    btns.appendChild(ovSmall(ovBusy ? 'Checking…' : 'Check again', ovRun));
    box.appendChild(btns);
    box.appendChild(el('div', 'margin-top:6px;font-size:11.5px;color:#80868d;', 'Advisory only. Doesn\'t count as a warning.'));
    list.appendChild(box);
  }

  // Joe's Advice tab. Always in the same order: why it exists, the writer's one line, the button, then the four
  // fixed headings. An author who has used it once knows where to look the next time.
  function drawOverviewTab(body) {
    ovLoad();
    // 1. Why this exists. Always on show, so nobody has to wonder what the tab is for.
    body.appendChild(el('div', 'margin:14px 0 0;padding:10px 12px;border-radius:6px;background:#f3f6f9;font-size:12.5px;line-height:1.5;color:#3a4048;',
      'Google\'s summaries can repeat facts. They can\'t repeat our experience or our opinion. Joe checks that your piece keeps the promise in its headline, and that a searcher can see why ours is the one to read.'));

    // 2. The writer's one line. Saved with the post for the whole team.
    body.appendChild(el('label', 'display:block;margin:14px 0 4px;font:700 13px/1.4 ' + F + ';color:#1f2933;', 'In one line, what is the point of this piece?'));
    var box = el('input', 'box-sizing:border-box;width:100%;padding:7px 9px;border:1px solid #c9ced4;border-radius:6px;font:13px/1.4 ' + F + ';color:#222;background:#fff;');
    box.type = 'text'; box.maxLength = 240; box.value = ovPointNow;
    box.placeholder = 'For example: show mixers a faster way to ride vocals without automation';
    box.setAttribute('data-keep', 'joe-point');   // keeps its words and cursor while the panel redraws
    box.onchange = function () { ovSavePoint(box.value); };
    box.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); ovSavePoint(box.value); if (ovPointNow) ovRun(); } };
    body.appendChild(box);
    body.appendChild(el('div', 'margin-top:3px;font-size:11.5px;color:#80868d;', ovPointNow
      ? 'Saved with the post for the whole team' + (ovPointBy ? ' (' + ovPointBy + ')' : '') + '. Changing it starts Joe\'s advice afresh.'
      : 'Joe gives no advice until this is filled in. Everyone who checks the post will see it.'));

    // 3. The button
    var go = actionButton(ovBusy ? 'Joe is reading…' : ovRes ? 'Check again' : 'Check my piece', function () { ovSavePoint(box.value); ovRun(); }, !ovRes);
    body.appendChild(go);
    if (ovErr) body.appendChild(el('div', 'margin:-4px 0 8px;color:' + C.red + ';font-size:13px;', ovErr));
    if (!ovRes) return;

    var r = ovRes, stale = ovStale();
    body.appendChild(el('div', 'font-size:11.5px;color:#80868d;', 'Checked ' + when(r.at) + (r.by ? ' by ' + r.by : '') + '.'));
    // 8.8: Joe says what he saw change, so an author is never left wondering whether their edit was read
    if (ovSameNote) {
      body.appendChild(el('div', 'margin:8px 0 0;padding:8px 10px;border-radius:6px;background:#fff4e0;color:#5a3a00;font-size:12.5px;line-height:1.45;',
        'I can\'t see any change to the headline, description, your line or the article since the last check, so my answer is the same. If you\'ve made changes that aren\'t showing here, save the post and check again.'));
    } else if (r.last && r.last.later && !stale) {
      var ch = r.last.changed || 0, tk = r.last.ticked || 0;
      body.appendChild(el('div', 'margin:8px 0 0;padding:8px 10px;border-radius:6px;background:#eef6e6;color:#2c4a1c;font-size:12.5px;line-height:1.45;',
        'Since the last check I read ' + (ch ? ch + (ch === 1 ? ' new or changed paragraph' : ' new or changed paragraphs') : 'no changed paragraphs (the headline or description changed)') + '. ' +
        (tk ? tk + (tk === 1 ? ' suggestion is' : ' suggestions are') + ' now ticked off.' : 'No earlier suggestion is fully covered yet. Each one below says what is still missing.')));
    }
    if (stale) body.appendChild(el('div', 'margin:8px 0 0;padding:8px 10px;border-radius:6px;background:#fff4e0;color:#5a3a00;font-size:12.5px;line-height:1.45;',
      'The post has changed since this check. Check again to tick off what you\'ve covered.'));

    // 4. The four headings, word for word, in this order, on every check
    body.appendChild(ovHead('What I understood'));
    body.appendChild(ovLine('Your point: ' + (r.understood || r.point)));
    body.appendChild(ovLine('Your headline promises: ' + r.promise + (r.quote ? ' (“' + r.quote + '”)' : '')));
    body.appendChild(ovLine(r.author && r.author.house ? 'Written under the Production Expert byline, so I\'ve gone by the site\'s standing.'
      : 'Written by ' + ((r.author && r.author.name) || 'an author I couldn\'t read') + (r.author && r.author.bio ? ', whose bio I\'ve read.' : '. I couldn\'t find a bio for that name, so I know nothing of their background.'), '#5f6368'));
    if (r.news) body.appendChild(ovLine('Tagged News, so I haven\'t asked for testing, impressions or buying advice.', '#5f6368'));

    body.appendChild(ovHead('Is the promise kept?'));
    var k = el('div', 'margin:3px 0;font-size:12.5px;line-height:1.5;color:#3a4048;');
    k.appendChild(el('span', 'font-weight:700;color:' + (r.kept === 'no' ? C.amber : C.green) + ';', r.kept === 'no' ? 'Not yet. ' : 'Yes. '));
    k.appendChild(el('span', '', r.keptWhy || ''));
    body.appendChild(k);

    body.appendChild(ovHead('Why would someone click past Google?'));
    body.appendChild(ovLine(r.click || ''));
    body.appendChild(ovLine(r.clickVisible === 'no' ? 'A searcher can\'t see that from the headline and description yet.' : 'A searcher can see that from the headline and description.', r.clickVisible === 'no' ? '#5a3a00' : '#5f6368'));

    body.appendChild(ovHead('What to do'));
    if ((r.suggestions || []).length) r.suggestions.forEach(function (s) { body.appendChild(ovPoint(s, false)); });
    else body.appendChild(ovLine('Nothing to add.'));
    if ((r.done || []).length) {
      body.appendChild(sectionLabel('Done since earlier checks'));
      r.done.forEach(function (p) { body.appendChild(ovPoint(p, true)); });
    }

    // Only when a colleague's working background is a clearly closer match to the subject
    if (r.second && r.second.name) {
      body.appendChild(ovHead('Worth a second opinion'));
      body.appendChild(ovLine(r.second.name + ': “' + r.second.bio + '”. ' + (r.second.why || '')));
      body.appendChild(ovLine('Their view would add weight before this goes out. It\'s your call whether to ask.', '#5f6368'));
    }

    var tools = el('div', 'display:flex;gap:6px;flex-wrap:wrap;margin-top:14px;');
    tools.appendChild(ovSmall(ovMarked ? 'Hide in the post' : 'Show what a summary could repeat', function () { ovMark(!ovMarked); drawDrawer(); }));
    tools.appendChild(ovSmall('Suggest headlines', function () { openDrawer('headlines'); }));
    body.appendChild(tools);
    body.appendChild(el('div', 'margin-top:10px;font-size:12px;color:#777;', 'Advisory only. It never counts as a warning or blocks scheduling.'));
  }

  function articleText() {
    var body = articleBody();
    if (!body) return '';
    // 7.2: label the players and tables first, so the copy can say what they are. Without this Joe's other tabs
    // saw nothing where a video, an audio example or a stem player sat, and a table as loose words.
    try { ovParas(); } catch (x) {}
    var copy = body.cloneNode(true);
    Array.prototype.forEach.call(copy.querySelectorAll('[data-pe-ov]'), function (x) {
      var kind = x.getAttribute('data-pe-ov');
      if (kind === 'Image') return;   // pictures stay as they were
      var label = '';
      try { label = ovText(x); } catch (y) {}
      if (label) x.replaceWith(document.createTextNode('\n' + label + '\n'));
    });
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

  /* 8.7: a headline makes a promise and the article must keep it (Russ, 19 Nov 2026). Where the article holds real
   * first-hand experience, at least one suggested headline should let a searcher see that a practitioner is behind
   * it, because that is what a Google summary sitting above our result visibly lacks. Shown, never claimed. */
  var HEADLINE_NOTE = '[Note to whoever writes these headlines, not part of the article: every headline makes a promise and the ' +
    'article must keep it. Never promise anything the article below does not deliver: no "tested", "review", "compared", number of ' +
    'tips or length of time in use unless the article really has it, and no question the article does not answer. Never give the ' +
    'conclusion away, and never promise a verdict or a buy or skip ruling unless the article gives one. If the article contains real ' +
    'first-hand experience of its subject (use on real work, testing, time spent with it, or a named professional\'s account), at ' +
    'least one option must show a searcher that a practitioner is behind it, by saying what was done or naming the writer\'s trade, ' +
    'near the start of the headline and without boasting words such as "expert". If the article has no first-hand experience, do ' +
    'not suggest that it has. If the post is news, report the news.]';
  function suggestWrite(task, more) {
    var prev = writeSuggest[task] || {};
    writeSuggest[task] = { status: 'loading', options: prev.options || [] };
    drawDrawer();
    var payload = {
      action: 'write', task: task, title: postTitle(), seoTitle: seo().seoTitle || '',
      meta: seo().seoDescription || '', url: postData.urlId || '',
      // 8.7: headline suggestions carry the promise rule (see HEADLINE_NOTE)
      text: task === 'headlines' ? (HEADLINE_NOTE + '\n' + articleText()).slice(0, 15000) : articleText(),
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
  // 5.5: the old check only read what the box showed. A React field keeps its own copy of the value,
  // and when that copy missed the change the box still showed Joe's words for a moment, the check
  // passed, then Squarespace's next redraw put the old value back (Russ, 8 Nov 2026: about 9 in 10
  // Uses ended in copy and paste). Now the fill types like a person (typeInto) and "held" also needs
  // React's own copy (reactValue) to agree, watched for about a second and a half.
  function fillAndHold(f, v) {
    var tries = 0;
    function holds() { var rv = reactValue(f); return f.value === v && (rv === undefined || rv === v); }
    function attempt() {
      setField(f, v, tries > 0);
      return wait(400).then(function () {
        if (!holds() && ++tries < 4) return attempt();
        // still there a second later? Squarespace's late redraws land within about a second
        return wait(1100).then(function () {
          if (!holds() && ++tries < 4) return attempt();
          return holds();
        });
      });
    }
    return attempt();
  }

  // The value React holds for a field (from its props on the element), or undefined when the field
  // isn't a React-controlled one (the older YUI boxes), in which case only the box itself is checked
  function reactValue(f) {
    try {
      for (var k in f) {
        if (k.indexOf('__reactProps$') === 0 || k.indexOf('__reactEventHandlers$') === 0) {
          var p = f[k];
          return p && typeof p.value === 'string' ? p.value : undefined;
        }
      }
    } catch (e) {}
    return undefined;
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

  // Sets a field's value. 5.5: types it first (typeInto), which every form on the page treats as a
  // person typing; falls back to the direct way if the browser refuses, or on a retry when typing
  // didn't take. force skips straight to the direct way.
  function setField(f, v, force) {
    if (!force && typeInto(f, v)) return;
    var w = f.ownerDocument.defaultView;
    var proto = f.tagName === 'TEXTAREA' ? w.HTMLTextAreaElement.prototype : w.HTMLInputElement.prototype;
    // React notices a change by comparing against its tracker; clearing it makes sure it sees one
    try { if (f._valueTracker) f._valueTracker.setValue(''); } catch (e) {}
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(f, v);
    f.dispatchEvent(new w.InputEvent('input', { bubbles: true, inputType: 'insertReplacementText', data: v }));
    f.dispatchEvent(new w.Event('change', { bubbles: true }));
    try { f.blur(); } catch (e) {}
  }

  // 5.5: puts the text in as if typed: focuses the box, selects what's there, and inserts the new words
  // with the browser's own insertText command. That raises the same events a keyboard does, which React
  // fields, Squarespace's older YUI boxes (they only watch a box that has focus) and undo all follow.
  // True if the box ended up holding the text.
  function typeInto(f, v) {
    try {
      var doc = f.ownerDocument, w = doc.defaultView;
      try { w.focus(); } catch (e) {}
      f.focus();
      if (doc.activeElement !== f) return false;
      f.select();
      var ok = doc.execCommand('insertText', false, v);
      if (!ok || f.value !== v) return false;
      // let the older boxes' watchers see the new value before focus moves on
      setTimeout(function () { try { if (doc.activeElement === f) f.blur(); } catch (e) {} }, 250);
      return true;
    } catch (e) { return false; }
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
      // 5.5: same typing and checks as the other fields (was one try, checked after 150ms)
      fillAndHold(f, text).then(function (held) {
        useDone[key] = held
          ? { st: 'used', at: Date.now(), field: 'alt', value: text, why: '✓ Filled in. Click away from the picture panel, then Save.' }
          : { st: 'failed', why: 'Squarespace didn’t take the alt text. Copy it and paste it in.' };
        drawDrawer();
      });
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
    // Copy is always offered (v4.8): Use sometimes fills nothing without noticing, and the team
    // needs the words to paste by hand
    box.appendChild(copyButton(text));
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

  // True while someone is highlighting text in Joe, or has some highlighted. The checklist's
  // every-few-seconds redraws wait, so the highlight isn't wiped mid-copy (v4.8). Clicking any
  // button in Joe clears the highlight first, so tabs and buttons always work.
  var joeMouseDown = false, joeDrawWaiting = false;
  function joeHighlighting() {
    if (!drawer) return false;
    if (joeMouseDown) return true;
    var s = drawer.ownerDocument.getSelection && drawer.ownerDocument.getSelection();
    return !!(s && !s.isCollapsed && s.rangeCount && drawerInner && drawerInner.contains(s.anchorNode)); // 7.0: docked or popped
  }
  function watchJoeHighlight(box) {
    var doc = box.ownerDocument;
    box.addEventListener('mousedown', function (e) {
      if (e.target.closest && e.target.closest('.pe-sel')) joeMouseDown = true;
      if (e.target.closest && e.target.closest('button')) { var s = doc.getSelection(); if (s) s.removeAllRanges(); }
    }, true);
    doc.addEventListener('mouseup', function () { joeMouseDown = false; }, true);
    doc.addEventListener('selectionchange', function () {
      if (joeDrawWaiting && !joeHighlighting()) { joeDrawWaiting = false; drawDrawer(); }
    });
  }

  function drawDrawer() {
    if (!drawer || !drawerInner) return;
    if (joeHighlighting()) { joeDrawWaiting = true; return; }
    // only the part under the title bar is redrawn; keep the reader's scroll position
    var scroll = drawerInner.lastChild ? drawerInner.lastChild.scrollTop : 0;
    // The checklist redraws Joe every few seconds. A text box someone is typing in (marked with
    // data-keep) keeps its words, cursor and focus across the redraw (v1.5)
    var act = drawer.ownerDocument.activeElement, kept = null;
    if (act && drawerInner.contains(act) && act.getAttribute && act.getAttribute('data-keep')) {
      kept = { key: act.getAttribute('data-keep'), value: act.value, a: act.selectionStart, b: act.selectionEnd };
    }
    drawerInner.innerHTML = '';

    var tabs = el('div', 'display:flex;gap:4px;flex-wrap:wrap;padding:8px 12px;border-top:1px solid #eceef1;border-bottom:1px solid #eceef1;background:#fafbfc;');
    drawerTabs().forEach(function (t) {
      var on = t[0] === drawerTab;
      var b = el('button', 'padding:5px 11px;border:0;border-radius:999px;background:' + (on ? '#e3eef8' : 'transparent') + ';color:' + (on ? C.blue : '#5a6068') +
        ';font:' + (on ? 700 : 600) + ' 12.5px ' + F + ';cursor:pointer;', t[1]);
      b.type = 'button';
      b.onclick = function () { drawerTab = t[0]; drawDrawer(); drawJoeBar(); };
      tabs.appendChild(b);
    });
    drawerInner.appendChild(tabs);

    var body = el('div', 'flex:1;min-height:0;overflow:auto;padding:4px 16px 16px;');
    drawerInner.appendChild(body);
    if (drawerTab === 'links' && !linksOn()) drawerTab = 'headlines';
    if (drawerTab === 'image' && !imageOn()) drawerTab = 'headlines';
    if (drawerTab === 'alt') drawAltTab(body); else if (drawerTab === 'links') drawLinksTab(body);
    else if (drawerTab === 'image') drawImageTab(body); else if (drawerTab === 'overview') drawOverviewTab(body); else drawWriteTab(body);
    body.scrollTop = scroll;
    if (kept) {
      var again = body.querySelector('[data-keep="' + kept.key + '"]');
      if (again) {
        again.value = kept.value;
        again.focus();
        try { again.setSelectionRange(kept.a, kept.b); } catch (e) {}
      }
    }
  }

  function drawWriteTab(body) {
    var task = drawerTab, cur = currentFor(task), sg = writeSuggest[task] || {};
    var curBox = el('div', 'margin:14px 0 4px;padding:10px 12px;background:#f6f7f9;border:1px solid #eceef1;border-radius:6px;font-size:13px;line-height:1.45;');
    curBox.appendChild(el('div', 'font:700 10.5px ' + F + ';letter-spacing:.08em;text-transform:uppercase;color:#7a8088;margin-bottom:4px;', cur.label));
    var cv = el('div', 'display:flex;gap:8px;align-items:flex-start;');
    var cvt = el('span', 'flex:1;color:' + (cur.value ? '#222' : '#999') + ';user-select:text;-webkit-user-select:text;cursor:text;', cur.value || 'None yet');
    cvt.className = 'pe-sel';
    cv.appendChild(cvt);
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
      var ot = el('span', 'flex:1;line-height:1.5;user-select:text;-webkit-user-select:text;cursor:text;', o);
      ot.className = 'pe-sel'; // can be highlighted and copied (v4.8)
      row.appendChild(ot);
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
      var at = el('span', 'font-size:13px;color:' + (sg.status === 'error' ? C.red : '#222') + ';user-select:text;-webkit-user-select:text;cursor:text;',
        sg.status === 'loading' ? 'Writing…' : sg.text || 'Not asked yet');
      at.className = 'pe-sel'; // can be highlighted and copied (v4.8)
      txt.appendChild(at);
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
  var imgPick = null;         // { img, file, w, h, x, y, name, err, credit } once a file is dropped in
  var imgSource = null;       // 'pixabay' or 'deposit': which search is open under the drop box (v1.4)
  var pxRes = null;           // Pixabay results: { status, q, page, hits, total, error }
  var pxPicking = null;       // id of the Pixabay photo being fetched
  var pxTyped = null;         // words typed in the Pixabay search box, kept until searched (v1.5)
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
      .then(function () {
        // Search Pixabay was pressed before the suggestions arrived: run the first one
        if (imgSource === 'pixabay' && !pxRes && imgSearch.options && imgSearch.options[0]) return pixabaySearch(imgSearch.options[0].q);
        drawDrawer();
      });
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
  // credit, for a Pixabay photo: { site, user, userUrl, page }, used for the caption and Source URL
  function takeImageFile(file, credit) {
    if (!file || !/^image\//.test(file.type)) { imgPick = { err: 'That isn’t a picture. Drop in a JPEG or PNG.' }; return drawDrawer(); }
    var url = URL.createObjectURL(file);
    var im = new Image();
    im.onload = function () {
      var w = im.naturalWidth, h = im.naturalHeight, cw, ch;
      if (w / h > IMAGE.ratio) { ch = h; cw = Math.round(h * IMAGE.ratio); } else { cw = w; ch = Math.round(w / IMAGE.ratio); }
      imgPick = { img: im, url: url, file: file, w: w, h: h, cw: cw, ch: ch, x: Math.round((w - cw) / 2), y: Math.round((h - ch) / 2), name: imgName(), auto: true,
        credit: credit || null, creditText: credit ? 'Photo by ' + credit.user + ' on ' + credit.site : '' };
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
    var oldAsset = blockAsset(block);
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
        // Done only when the block holds a new picture (a new Squarespace asset id) and the panel shows
        // its name. The name alone isn't proof: a new photo can share the old one's name, and moving on
        // before the upload finishes (to the Options tab, say) interrupts it (v1.6, found 30 Oct 2026).
        // Uploading a large JPEG can take a while on a slow connection.
        return waitFor(function () {
          var a = blockAsset(heroBlock());
          return a && a !== oldAsset && panelShows(out.name);
        }, 45000);
      }).then(function (ok) {
        if (!ok) throw 'The upload didn’t show up in the panel. Check the top image, or use Save image and upload it by hand.';
        P.placed = { st: 'done', name: out.name, w: out.w, h: out.h, notes: [] };
        return wait(600).then(function () { return creditCaption(P); }).then(function () { return creditSource(P); })
          .then(function () { return featuredImage(P, out); });
      });
    }).catch(function (why) {
      P.placed = { st: 'failed', why: typeof why === 'string' ? why : 'Squarespace didn’t take the picture. Use Save image and upload it by hand.' };
    }).then(drawDrawer);
  }

  // The Squarespace asset id of the picture in an image block (the folder before the file name in
  // its address), or '' when the block is empty
  function blockAsset(b) {
    var im = b && b.querySelector('img');
    var u = im ? String(im.getAttribute('data-src') || im.getAttribute('data-image') || im.src || '') : '';
    if (!/squarespace-cdn|static1\.squarespace/.test(u)) return '';
    var parts = u.split('?')[0].split('/');
    return parts.length > 1 ? parts[parts.length - 2] : '';
  }

  function escHtml(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  /* The credit under the hero (v1.4). The image block's caption is a ProseMirror editor
   * (.image-caption .ProseMirror, checked live 30 Oct 2026); a paste with HTML keeps the links.
   * Untouched Pixabay credits go in as "Photo by <photographer> on <Pixabay>", both linked;
   * anything typed or changed by hand goes in as plain text. An empty credit leaves the caption alone. */
  function creditCaption(P) {
    var text = String(P.creditText || '').trim();
    if (!text) return;
    var c = P.credit, html = c && text === 'Photo by ' + c.user + ' on ' + c.site
      ? 'Photo by <a href="' + escHtml(c.userUrl) + '">' + escHtml(c.user) + '</a> on <a href="' + escHtml(c.page) + '">' + escHtml(c.site) + '</a>'
      : escHtml(text);
    // Squarespace redraws the block as the new picture lands, so wait for the caption box to be back
    return waitFor(function () {
      var b = heroBlock(), e = b && b.querySelector('.image-caption .ProseMirror');
      return e && visible(e) ? e : null;
    }, 8000).then(function (ed) {
    if (!ed) { P.placed.notes.push({ bad: true, t: 'Couldn’t find the caption under the picture. Type the credit there: ' + text }); return; }
    var doc = ed.ownerDocument, W = doc.defaultView;
    ed.focus();
    var r = doc.createRange(); r.selectNodeContents(ed);
    var sel = W.getSelection(); sel.removeAllRanges(); sel.addRange(r);
    var dt = new W.DataTransfer();
    dt.setData('text/html', html); dt.setData('text/plain', text);
    ed.dispatchEvent(new W.ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    return wait(400).then(function () {
      var got = (ed.textContent || '').replace(/\s+/g, ' ').trim() === text.replace(/\s+/g, ' ');
      P.placed.notes.push(got ? { t: '✓ Credit added under the picture.' } : { bad: true, t: 'The credit didn’t go in. Type it under the picture: ' + text });
    });
    });
  }

  /* Source URL on the Options tab (v1.4), for photos with a page to point to (Pixabay). Filled
   * only when empty: the team sometimes puts a press page there, and that stays. Never touches
   * "Post Title should link to Source URL". */
  function creditSource(P) {
    var c = P.credit;
    if (!c || !c.page) return;
    return openSettings().then(function (doc) {
      if (!doc) { P.placed.notes.push({ bad: true, t: 'Source URL not filled: open Settings, Options, and paste ' + c.page }); return; }
      settingsTab(doc, 'Options');
      return waitFor(function () {
        var f = doc.querySelector('input[name="sourceUrl"]');
        return f && visible(f) ? f : null;
      }, 3000).then(function (f) {
        if (!f) { P.placed.notes.push({ bad: true, t: 'Couldn’t find Source URL on the Options tab. Paste it by hand: ' + c.page }); return; }
        if (String(f.value || '').trim()) { P.placed.notes.push({ t: 'Source URL already holds ' + f.value + ', so it was left alone.' }); return; }
        return fillAndHold(f, c.page).then(function (held) {
          P.placed.notes.push(held ? { t: '✓ Source URL filled. Press Apply in Settings, then Save.' } : { bad: true, t: 'Source URL didn’t take. Paste it by hand: ' + c.page });
        });
      }).then(function () { settingsTab(doc, 'Content'); }); // back to the post, so the new picture is in view
    });
  }

  /* Featured Image on the Options tab (v4.1). Since about midday on 2 Nov 2026 Squarespace no longer
   * treats the first image in a post as its hero (the "promoted block") when a post is saved, so a post
   * saved after that shows a blank homepage tile and the site logo on Facebook. Found live on Krotos
   * Studio 3.0 and RME Control 3.5: every post saved from 12:52 that day lost it, every one saved by
   * 11:51 kept it. The Featured Image box fixes both, and the article page doesn't show it, so the
   * hero never appears twice. Filled only when empty; a picture already there is left alone.
   * The box is a Squarespace uploader on the Options tab with an ordinary file input beside
   * "Upload an Image" (checked live 2 Nov 2026). It turns a .webp named .jpg away ("Processing
   * failed"), which is why Joe's crop is always a real JPEG. Unlike the rest of the window, this box
   * saves to the post the moment the upload finishes: Cancel and Discard don't undo it (checked live
   * 2 Nov 2026), so Joe only ever puts the hero itself there. */
  function featuredBox(doc) {
    var lab = Array.prototype.filter.call(doc.querySelectorAll('label, div, span'), function (e) {
      return e.children.length === 0 && !ours(e) && e.textContent.trim() === 'Featured Image';
    })[0];
    for (var box = lab, i = 0; box && i < 6; i++) {
      box = box.parentElement;
      var inp = box && box.querySelector('.sqs-uploader input[type="file"], input[type="file"]');
      if (inp) return { box: box, inp: inp };
    }
    return null;
  }
  // 'filled', 'empty', or null while the box is still loading. Only reliable with the Options tab
  // showing: on other tabs the preview never loads and "Upload an Image" stays in the page either way.
  function featuredState(f) {
    var pic = Array.prototype.some.call(f.box.querySelectorAll('img'), function (i) {
      return /squarespace/.test(i.currentSrc || i.src || '') && visible(i);
    });
    if (pic) return 'filled';
    var up = Array.prototype.some.call(f.box.querySelectorAll('div, span, button'), function (e) {
      return e.children.length === 0 && e.textContent.trim() === 'Upload an Image' && visible(e);
    });
    return up ? 'empty' : null;
  }
  function featuredImage(P, out) {
    return openSettings().then(function (doc) {
      if (!doc) { P.placed.notes.push({ bad: true, t: 'Featured Image not filled. Open Settings, Options, and upload the same picture to Featured Image, or the homepage tile and Facebook image will be blank.' }); return; }
      settingsTab(doc, 'Options');
      return waitFor(function () { var f = featuredBox(doc); return f && featuredState(f) ? f : null; }, 5000).then(function (f) {
        if (!f) { P.placed.notes.push({ bad: true, t: 'Couldn’t find Featured Image on the Options tab. Upload the same picture there by hand (Save image downloads it).' }); return; }
        if (featuredState(f) === 'filled') { P.placed.notes.push({ t: 'Featured Image already has a picture, so it was left alone. Check it matches the hero.' }); return; }
        var IW = f.inp.ownerDocument.defaultView, dt = new IW.DataTransfer();
        dt.items.add(new IW.File([out.blob], out.name, { type: 'image/jpeg' }));
        f.inp.files = dt.files;
        f.inp.dispatchEvent(new IW.Event('change', { bubbles: true }));
        return waitFor(function () {
          var g = featuredBox(doc);
          return g && featuredState(g) === 'filled' && !/processing failed/i.test(doc.body.textContent) ? g : null;
        }, 30000).then(function (g) {
          P.placed.notes.push(g ? { t: '✓ Same picture set as the Featured Image, for the homepage tile and Facebook. Squarespace saves this box straight away.' }
            : { bad: true, t: 'Featured Image didn’t take. Upload the same picture there by hand on the Options tab.' });
        });
      }).then(function () { settingsTab(doc, 'Content'); });
    });
  }

  /* 5.3: Featured Image filled from the hero, whoever saved the post and however the hero went in.
   * Runs when the checks find a hero and an empty Featured Image, the post's Edit window is open (the
   * Featured Image box lives in its Settings), and Joe hasn't already tried since the last save. Uses the
   * same upload as Place as hero (featuredImage), which only ever fills an empty box. The picture is the
   * saved hero (the Promoted Block), else the first picture in the article, redrawn as a real JPEG
   * (Squarespace's CDN hands browsers WebP, and the box turns a WebP away). */
  var featuredBusy = false, featuredTried = '', featuredMsg = '';
  function hasFeatured() {
    var u = String(postData.assetUrl || '').replace(/\?.*$/, '');
    return /\/[^\/]+\.[a-z0-9]{3,4}$/i.test(u);
  }
  function heroSource() {
    var m = /(?:data-src|src)="(https:\/\/images\.squarespace-cdn\.com\/[^"]+)"/i.exec(String(postData.promotedBlock || '') + String(postData.body || ''));
    return m ? m[1].replace(/&amp;/g, '&').replace(/\?.*$/, '') : '';
  }
  function editWindowOpen() {
    return !!settingsDoc() || Array.prototype.some.call(document.querySelectorAll('.sqs-button-vanilla .label'), function (e) {
      return e.textContent.trim() === 'Settings' && visible(e);
    });
  }
  function autoFeatured() {
    if (featuredBusy || !post || hasFeatured() || !heroSource() || !editWindowOpen()) return;
    var key = post + ':' + (postData.updatedOn || '');
    if (featuredTried === key) return;   // once per save
    featuredTried = key;
    fillFeatured(false);
  }
  function heroJpeg(src) {
    return fetch(src + '?format=2500w', { mode: 'cors' }).then(function (r) {
      if (!r.ok) throw new Error('picture ' + r.status);
      return r.blob();
    }).then(function (b) { return createImageBitmap(b); }).then(function (bmp) {
      var cv = document.createElement('canvas'); cv.width = bmp.width; cv.height = bmp.height;
      cv.getContext('2d').drawImage(bmp, 0, 0);
      return new Promise(function (ok, no) { cv.toBlob(function (b) { b ? ok(b) : no(new Error('JPEG')); }, 'image/jpeg', 0.9); });
    }).then(function (blob) {
      var name = decodeURIComponent(src.split('/').pop() || 'hero').replace(/\+/g, ' ').replace(/\.[a-z0-9]{3,4}$/i, '') + '.jpg';
      return { blob: blob, name: name.replace(/[^\w .-]/g, '').trim() || 'hero.jpg' };
    });
  }
  function fillFeatured(byHand) {
    if (featuredBusy) return;
    var src = heroSource();
    if (!src) { featuredMsg = 'No Featured Image, and no saved hero to copy into it. Add a hero, Save, then press Fill it now'; refreshAuto(); return; }
    if (byHand && !editWindowOpen()) { featuredMsg = 'No Featured Image. Open the post\'s Edit window, then press Fill it now'; refreshAuto(); return; }
    featuredBusy = true; featuredMsg = ''; draw();
    var P = { placed: { notes: [] } };
    heroJpeg(src).then(function (out) { return featuredImage(P, out); }).then(function () {
      var bad = P.placed.notes.filter(function (n) { return n.bad; })[0];
      featuredMsg = bad ? 'No Featured Image: ' + bad.t : '';
      logEvent({ kind: 'featured', item: bad ? 'Featured Image not filled' : 'Featured Image filled from the hero', who: who() });
    }).catch(function (e) {
      featuredMsg = 'No Featured Image, and Joe couldn\'t copy the hero (' + String(e && e.message || e).slice(0, 60) + '). Upload it on the Options tab';
    }).then(function () {
      featuredBusy = false;
      return wait(2500).then(checkSchedule).then(refreshAuto);
    });
  }

  /* Pixabay search (v1.4), through the checklist Apps Script so the key stays private:
   * ?pixabay=<words>&page=<n> answers { total, page, hits: [{ id, page, user, userUrl, thumb, w, h }] },
   * ?pixabayimg=<id> answers the photo as base64 with its credit. Thumbnails are Pixabay's own
   * preview addresses, shown as plain images (never drawn on a canvas, so no cross-site limits). */
  function pixabaySearch(q, more) {
    q = String(q || '').replace(/\s+/g, ' ').trim();
    if (!q) return;
    pxTyped = null;
    var prev = more && pxRes && pxRes.q === q ? pxRes : null;
    pxRes = { status: 'loading', q: q, page: prev ? prev.page + 1 : 1, hits: prev ? prev.hits : [], total: prev ? prev.total : 0 };
    imgLastQ = q;
    drawDrawer();
    fetch(C.store + '?pixabay=' + encodeURIComponent(q) + '&page=' + pxRes.page)
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.error === 'no post') throw 'Pixabay isn’t set up in the Google Sheet yet (the new Code.gs needs deploying).';
        if (!d || d.error) throw (d && d.error) || 'No answer from Pixabay';
        pxRes = { status: 'done', q: q, page: d.page || pxRes.page, hits: pxRes.hits.concat(d.hits || []), total: d.total || 0 };
      })
      .catch(function (e) { pxRes = { status: 'error', q: q, page: pxRes.page, hits: pxRes.hits, total: pxRes.total, error: typeof e === 'string' ? e : 'Could not reach the Google Sheet' }; })
      .then(drawDrawer);
  }

  function pixabayPick(h) {
    if (pxPicking) return;
    pxPicking = h.id;
    drawDrawer();
    fetch(C.store + '?pixabayimg=' + h.id)
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d || !d.data) throw (d && d.error) || 'No picture came back from Pixabay';
        var bin = atob(d.data), arr = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        var file = new File([arr], 'pixabay-' + h.id + '.jpg', { type: d.mime || 'image/jpeg' });
        takeImageFile(file, { site: 'Pixabay', user: d.user || h.user, userUrl: d.userUrl || h.userUrl, page: d.page || h.page });
      })
      .catch(function (e) { if (pxRes) pxRes.error = typeof e === 'string' ? e : 'Could not reach the Google Sheet'; })
      .then(function () { pxPicking = null; drawDrawer(); });
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

  // "No picture yet?" under the drop box (v1.4): Pixabay searched here, with the photos shown in
  // Joe, or Depositphotos, opened on its own site. Both start from Joe's suggested searches.
  function drawSearch(body) {
    var ask = el('div', 'margin-top:10px;font-size:12.5px;color:#555;display:flex;align-items:center;gap:6px;flex-wrap:wrap;');
    ask.appendChild(el('span', '', 'No picture yet?'));
    ask.appendChild(linkBtn('Search Pixabay', function () {
      imgSource = 'pixabay';
      if (!imgSearch) suggestImage();
      else if (!pxRes && imgSearch.options && imgSearch.options[0]) pixabaySearch(imgSearch.options[0].q);
      drawDrawer();
    }, imgSource === 'pixabay'));
    ask.appendChild(linkBtn('Depositphotos', function () { imgSource = 'deposit'; if (!imgSearch) suggestImage(); drawDrawer(); }, imgSource === 'deposit'));
    body.appendChild(ask);
    if (imgSource === 'pixabay') drawPixabay(body);
    else if (imgSource === 'deposit') drawDeposit(body);
  }

  function drawPixabay(body) {
    // the searches: Joe's suggestions as chips, plus a box for your own words
    var terms = el('div', 'display:flex;gap:5px;flex-wrap:wrap;margin-top:10px;');
    (imgSearch && imgSearch.options || []).forEach(function (o) {
      var on = pxRes && pxRes.q === o.q;
      var b = el('button', 'padding:3px 9px;border-radius:999px;border:1px solid ' + (on ? C.blue : '#d5d9de') + ';background:' + (on ? '#e3eef8' : '#fff') +
        ';color:' + (on ? C.blue : '#333') + ';font:600 11.5px ' + F + ';cursor:pointer;', o.q);
      b.type = 'button'; b.title = o.note || '';
      b.onclick = function () { pixabaySearch(o.q); };
      terms.appendChild(b);
    });
    if (imgSearch && imgSearch.status === 'loading') terms.appendChild(el('span', 'font-size:12px;color:#777;align-self:center;', 'Writing searches…'));
    body.appendChild(terms);
    var own = el('div', 'display:flex;gap:6px;margin-top:8px;');
    var box = el('input', 'flex:1;min-width:0;padding:6px 8px;border:1px solid #cfd4da;border-radius:6px;font:13px ' + F + ';color:#222;');
    box.type = 'text'; box.placeholder = 'Your own search words';
    box.setAttribute('data-keep', 'px-q');
    box.value = pxTyped != null ? pxTyped : pxRes ? pxRes.q : '';
    box.oninput = function () { pxTyped = box.value; };
    box.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); pixabaySearch(box.value); } };
    own.appendChild(box);
    own.appendChild(linkBtn('Search', function () { pixabaySearch(box.value); }, true));
    body.appendChild(own);

    if (!pxRes) return;
    if (pxRes.hits.length) {
      var grid = el('div', 'display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-top:10px;');
      pxRes.hits.forEach(function (h) {
        var cell = el('button', 'position:relative;padding:0;border:0;border-radius:4px;overflow:hidden;aspect-ratio:3/2;background:#eef0f3;cursor:pointer;' +
          (pxPicking === h.id ? 'outline:2px solid ' + C.blue + ';outline-offset:1px;' : ''));
        cell.type = 'button';
        cell.title = (h.tags || '') + ' · ' + h.w + ' × ' + h.h + ' · by ' + h.user;
        var im = el('img', 'display:block;width:100%;height:100%;object-fit:cover;');
        im.src = h.thumb; im.alt = ''; im.loading = 'lazy';
        cell.appendChild(im);
        cell.appendChild(el('span', 'position:absolute;left:4px;bottom:2px;right:4px;font:600 10px ' + F + ';color:#fff;text-shadow:0 0 3px #000;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;',
          pxPicking === h.id ? 'Fetching…' : h.user));
        cell.onclick = function () { pixabayPick(h); };
        grid.appendChild(cell);
      });
      body.appendChild(grid);
    }
    if (pxRes.status === 'loading') body.appendChild(el('div', 'padding:8px 0;font-size:12px;color:#777;', 'Searching Pixabay…'));
    else if (pxRes.status === 'done' && !pxRes.hits.length) body.appendChild(el('div', 'padding:8px 0;font-size:12px;color:#777;', 'Nothing on Pixabay for that. Try other words.'));
    if (pxRes.error) body.appendChild(el('div', 'padding:6px 0;font-size:12px;color:' + C.red + ';', pxRes.error));
    if (pxRes.status === 'done' && pxRes.hits.length && pxRes.hits.length < pxRes.total)
      body.appendChild(actionButton('More photos', function () { pixabaySearch(pxRes.q, true); }));
    body.appendChild(el('div', 'margin-top:6px;font-size:12px;color:#777;line-height:1.45;', 'Click a photo to use it. Joe fetches it and fills in the credit; Place as hero then puts the credit under the picture and fills Source URL if it’s empty. Pixabay photos come at up to 1280 pixels wide.'));
  }

  function drawDeposit(body) {
    body.appendChild(el('div', 'margin:12px 0 2px;padding:8px 10px;border-radius:6px;background:#fdf6e9;color:#7a4b00;font-size:12px;line-height:1.45;',
      'Sign in to the Production Expert Depositphotos account before downloading. Only a signed-in download is full size and licensed for the site.'));
    if (!imgSearch) return;
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
      nm.type = 'text'; nm.value = P.name; nm.setAttribute('data-keep', 'img-name');
      nm.oninput = function () { P.name = nm.value; P.auto = false; };
      body.appendChild(nm);

      body.appendChild(el('div', 'font-size:12px;color:#5a6068;margin:12px 0 4px;', 'Credit under the picture' + (P.credit ? '' : ' (optional)')));
      var cr = el('input', 'width:100%;padding:7px 9px;border:1px solid #cfd4da;border-radius:6px;font:13px ' + F + ';color:#222;');
      cr.type = 'text'; cr.value = P.creditText || ''; cr.placeholder = 'Image courtesy of …'; cr.setAttribute('data-keep', 'img-credit');
      cr.oninput = function () { P.creditText = cr.value; };
      body.appendChild(cr);
      if (P.credit) body.appendChild(el('div', 'font-size:11.5px;color:#777;margin-top:4px;line-height:1.45;',
        'From ' + P.credit.site + '. Left as it is, the photographer’s name and ' + P.credit.site + ' link to their pages. Source URL: ' + P.credit.page.replace(/^https?:\/\//, '') + ', filled only if empty.'));

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
      (pl.notes || []).forEach(function (n) { body.appendChild(el('div', 'font-size:12px;line-height:1.45;margin-top:4px;color:' + (n.bad ? C.red : C.green) + ';', n.t)); });
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
    t = imageOn() ? t.concat([['image', 'Image']]) : t;
    return t.concat([['overview', 'Advice']]); // v3.5, for everyone; called Advice since 8.5 (no score)
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

  /* Suggestions for this post (v1.7, rebuilt to work like the pe-internal-links skill).
   * 1. Shortlist: archive articles that share the draft's subject (phrase cores, tags, brand,
   *    title words; plurals and analog/analogue treated alike), competitor rule applied. Cheap,
   *    so the internal links check uses it: it warns only when the shortlist has something.
   * 2. Claude, through the checklist Apps Script (action 'links'), reads the draft and picks
   *    phrases already in it worth linking, each to one shortlisted article, with a reason.
   *    Asked only when the Links tab is open, and cached per draft text.
   * 3. Every pick is checked here: the words must be in that paragraph as written, outside an
   *    existing link, not in the opening four words; one per paragraph, one per article.
   * If Claude can't be reached, the old phrase matching is used instead, with a note. */
  var LINK_STOP = /^(a|an|the|and|or|but|for|to|of|in|on|at|by|with|from|into|is|are|was|were|be|been|it|its|this|that|these|those|what|why|how|when|who|which|your|you|we|our|they|their|them|he|she|his|her|still|now|new|vs|versus|best|top|review|reviewed|explained|guide|need|needs|really|actually|just|more|most|than|can|could|should|would|will|about|after|before|every|all|any|do|does|did|get|gets|make|makes|use|using|used|one|two|three|first|also|over|out|up|down|not|no|so|if|as|has|have|had|there|here|then|some|many|much|very|way|ways|time|year|years|part|good|great|well|look|looks|find|tip|tips|thing|things|audio|music|sound|studio|production|pro|2023|2024|2025|2026|2027)$/;
  function normWord(w) {
    w = String(w).toLowerCase().replace(/^analog$/, 'analogue');
    if (w.length > 4 && /s$/.test(w) && !/ss$/.test(w)) w = w.slice(0, -1);
    return w;
  }
  function normWords(t) {
    return String(t || '').toLowerCase().replace(/['’]/g, '').split(/[^a-z0-9+]+/).filter(Boolean).map(normWord);
  }

  function linkShortlist() {
    var paras = linkParas();
    var words = paras.reduce(function (n, p) { return n + squash(p.textContent).split(' ').length; }, 0);
    var here = location.pathname.replace(/\/+$/, '');
    var linked = {};
    var body = articleBody();
    if (body) Array.prototype.forEach.call(body.querySelectorAll('a[href]'), function (a) { linked[pathOf(a.getAttribute('href'))] = 1; });
    var guard = protectedBrands(linkIdx.targets);
    var myTags = lower(postData.tags);
    // the draft's words and word pairs
    var dw = {}, db = {};
    var all = normWords(postTitle() + ' ' + paras.map(function (p) { return p.textContent; }).join(' '));
    all.forEach(function (w, i) { dw[w] = 1; if (i) db[all[i - 1] + ' ' + w] = 1; });
    var scored = [];
    linkIdx.targets.forEach(function (x) {
      if (x.u === here || linked[x.u]) return;
      if (guard.on && (x.k === 'comparison' || (x.k === 'product' && (!x.b || !guard.brands[x.b.toLowerCase()])))) return;
      var score = 0, pairs = {};
      x.p.forEach(function (ph) {
        var w = normWords(ph);
        var real = w.filter(function (v) { return !LINK_STOP.test(v); });
        if (real.length > 1 && w.every(function (v, i) { return !i || db[w[i - 1] + ' ' + v]; })) score += 4; // the whole phrase, pair by pair
        for (var i = 1; i < w.length; i++) {
          var bg = w[i - 1] + ' ' + w[i];
          // only pairs of two meaningful words ("mix bus", "channel strip"), never "the DAW" or "a mix"
          if (db[bg] && !LINK_STOP.test(w[i - 1]) && !LINK_STOP.test(w[i]) && w[i - 1].length > 1 && w[i].length > 1) pairs[bg] = 1;
        }
        if (w.length === 1 && /[A-Z0-9]/.test(ph) && dw[w[0]]) score += 3; // a one-word product name
      });
      score += Math.min(Object.keys(pairs).length, 3) * 3;
      var tw = {};
      normWords(x.t).forEach(function (w) { if (w.length > 2 && !LINK_STOP.test(w) && dw[w]) tw[w] = 1; });
      score += Math.min(Object.keys(tw).length, 4) * 0.75;
      score += Math.min(lower(x.g).filter(function (g) { return myTags.indexOf(g) !== -1; }).length, 2) * 2;
      if (x.b && normWords(x.b).every(function (w) { return dw[w]; })) score += 2;
      if (score >= 3) scored.push({ x: x, score: score });
    });
    scored.sort(function (a, b) { return b.score - a.score || (b.x.v || 0) - (a.x.v || 0); });
    return { targets: scored.slice(0, 60).map(function (s) { return s.x; }), guard: guard, words: words, linked: Object.keys(linked).length, paras: paras };
  }

  function findLinks() {
    if (!linkIdx || !linkIdx.targets) return;
    var sl = linkShortlist();
    linkSugg = { status: 'ready', list: [], shortlist: sl.targets, guard: sl.guard, words: sl.words, linked: sl.linked, paras: sl.paras, sig: textSig() };
  }

  // Asks Claude for the links (only from the Links tab), then checks each pick in the draft
  function askLinks() {
    var sg = linkSugg;
    if (!sg || sg.status !== 'ready') return;
    sg.status = 'loading';
    var paras = sg.paras, send = [];
    paras.forEach(function (p, i) {
      if (i === paras.length - 1 && paras.length > 3) return; // end on the writer's voice
      var t = squash(p.textContent);
      if (t.split(' ').length >= 6) send.push({ i: i, text: t });
    });
    var ids = {};
    var targets = sg.shortlist.map(function (x, n) {
      var id = 'a' + n, tier = tierOf(x.v);
      ids[id] = x;
      return { id: id, t: x.t, r: x.r || '', k: x.k || '', b: x.b || '', tier: tier ? tier[1] : 'Unscored' };
    });
    if (!targets.length || !send.length) { sg.status = 'done'; return drawDrawer(); }
    var tags = lower(postData.tags);
    fetch(C.store, { method: 'POST', body: JSON.stringify({
      action: 'links', title: postTitle(), tags: (postData.tags || []).join(', '), categories: (postData.categories || []).join(', '),
      partner: tags.indexOf('partner') !== -1 || tags.indexOf('partners') !== -1, paras: send, targets: targets
    }) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (linkSugg !== sg) return;
        if (!d || d.error || !d.picks) throw (d && d.error) || 'No answer';
        var used = {}, usedT = {}, list = [];
        d.picks.forEach(function (pk) {
          var p = paras[pk.para], x = ids[pk.target];
          if (!p || !x || used[pk.para] || usedT[x.u]) return;
          var hit = null, re = phraseRe(pk.anchor);
          textNodes(p).some(function (n, ni) {
            re.lastIndex = 0;
            var m;
            while ((m = re.exec(n.data))) {
              var start = m.index + m[1].length;
              if (pk.para === 0 && ni === 0 && n.data.slice(0, start).split(/\s+/).filter(Boolean).length < 4) continue;
              hit = m[2];
              return true;
            }
            return false;
          });
          if (!hit) return; // not in that paragraph as written: dropped
          used[pk.para] = 1; usedT[x.u] = 1;
          list.push({ para: p, paraText: p.textContent, pi: pk.para, anchor: hit, target: x, tier: tierOf(x.v), why: pk.why });
        });
        list.sort(function (a, b) { return a.pi - b.pi; });
        sg.list = list;
        sg.status = 'done';
      })
      .catch(function (e) {
        if (linkSugg !== sg) return;
        // fall back to the old phrase matching, so the tab is never empty-handed for no reason
        var strict = matchLinks(false), loose = strict.list.length ? strict : matchLinks(true);
        sg.list = loose.list;
        sg.loose = !strict.list.length && loose.list.length > 0;
        sg.status = 'done';
        sg.error = (typeof e === 'string' && e !== 'No answer' ? e : 'Joe couldn’t reach the link picker in the Google Sheet') + '. These come from simple phrase matching instead.';
      })
      .then(drawDrawer);
    drawDrawer();
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
    if (!linkSugg || linkSugg.sig !== textSig() && linkSugg.status !== 'loading') findLinks();
    var sg = linkSugg, list = sg.list;
    if (sg.status === 'ready') askLinks();
    if (sg.status === 'loading' || sg.status === 'ready') {
      body.appendChild(el('div', 'padding:14px 0;color:#777;font-size:13px;', 'Joe is reading the draft against ' + sg.shortlist.length + ' related articles…'));
      return;
    }
    var added = list.filter(function (s) { var d = linkDone[s.target.u]; return d && /added|saved|notsaved/.test(d.st); }).length;

    var intro = (sg.guard.on ? sg.guard.why + ': no links to other brands’ products or to roundups. ' : 'Editorial post. ') +
      sg.words.toLocaleString() + ' words, ' + sg.linked + ' existing ' + (sg.linked === 1 ? 'link' : 'links') + ' skipped.';
    body.appendChild(el('div', 'margin:12px 0 2px;font-size:12px;color:#5a6068;', intro));
    body.appendChild(el('div', 'margin:0 0 6px;font-size:12px;color:#8a9097;', list.length ? added + ' of ' + list.length + ' added' : ''));

    if (sg.error) body.appendChild(el('div', 'margin:4px 0 6px;padding:8px 10px;background:#fff8e6;border-radius:6px;font-size:12px;color:#5a3a00;', sg.error));
    if (!list.length) {
      body.appendChild(el('div', 'padding:12px 0;color:#555;font-size:13px;', sg.shortlist.length
        ? 'Joe read the draft against ' + sg.shortlist.length + ' related articles and found no place where a link would genuinely help the reader.'
        : 'Nothing in the archive matches this article, so the internal links check won’t hold this post back.'));
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
      if (s.why || s.target.r) row.appendChild(el('div', 'font-size:12px;color:#777;margin:3px 0 0;', s.why || s.target.r));
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

  // The pill sits at a spot measured from the bottom-right corner of the window.
  // 7.1: the open panel is measured from the TOP-right corner instead (Russ, 12 Nov 2026: it should stay where it
  // is and just be shorter). Its top edge never moves when a tab is shorter or longer; only its height changes.
  var pos = { r: 16, b: 16 };
  var ppos = { r: 16, t: 80 };                 // the open panel: gap from the right and top edges
  try { var psaved = JSON.parse(ls('pe-ck-ppos') || 'null'); if (psaved && psaved.r >= 0 && psaved.t >= 0) ppos = { r: psaved.r, t: psaved.t }; } catch (e) {}
  function place() {
    if (!panel) return;
    var w = panel.ownerDocument.defaultView;
    pos.r = Math.max(0, Math.min(w.innerWidth - 80, pos.r));
    pos.b = Math.max(0, Math.min(w.innerHeight - 44, pos.b));
    pill.style.right = pos.r + 'px'; pill.style.bottom = pos.b + 'px';
    ppos.r = Math.max(0, Math.min(w.innerWidth - 120, ppos.r));
    ppos.t = Math.max(0, Math.min(w.innerHeight - 120, ppos.t));
    panel.style.right = ppos.r + 'px'; panel.style.top = ppos.t + 'px'; panel.style.bottom = 'auto';
    panel.style.maxHeight = Math.max(160, w.innerHeight - ppos.t - 16) + 'px';
  }
  // How a drag of the panel's title bar moves it (top-right based)
  var panelSpot = {
    get: function () { return { r: ppos.r, t: ppos.t }; },
    set: function (start, dx, dy) { ppos.r = start.r - dx; ppos.t = start.t + dy; place(); },
    save: function () { ls('pe-ck-ppos', JSON.stringify(ppos)); }
  };
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
    loadSocial(); // 5.1
    loadPotw(); // 5.7
    loadFc();   // 6.6
    setInterval(function () { if (!fcBusy && document.visibilityState === 'visible') loadFc(); }, 120000);
    setInterval(function () { if (!socialBusy && document.visibilityState === 'visible') loadSocial(); }, 120000);

    panel = el('div', 'display:none;position:fixed;right:16px;top:80px;z-index:9999;width:360px;max-width:calc(100vw - 32px);max-height:calc(100vh - 80px);overflow:auto;' +
      'background:#fff;border:1px solid #e3e6ea;border-top:4px solid ' + C.blue + ';border-radius:8px;box-shadow:0 12px 32px rgba(17,24,39,.14),0 2px 6px rgba(17,24,39,.06);' +
      'font:14px/1.45 ' + F + ';color:#222;');
    panel.className = 'pe-checklist';
    head = el('button', 'display:flex;justify-content:space-between;align-items:baseline;gap:10px;width:100%;text-align:left;padding:12px 16px 11px;border:0;border-bottom:1px solid #eceef1;background:none;font:700 14px/1.3 ' + F + ';cursor:pointer;color:#222;');
    head.type = 'button';
    head.className = 'pe-ck-head';
    head.title = 'Click to shrink. Drag to move. Double-click to put it back in the corner.';
    // Title in small capitals with wide spacing, matching Squarespace's own window headers (EDIT POST)
    head.appendChild(el('span', 'font-size:13px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:inherit;'));
    // Version of the site scripts, beside the title, so anyone can see which copy they're running
    // without opening Joe. draw() only touches the first and last spans, so this one is left alone.
    var ver = el('span', 'flex:1;font-size:11px;font-weight:600;letter-spacing:0;color:#9aa0a6;', 'v' + PE_VERSION);
    ver.title = 'Version of the site scripts this browser is running';
    head.appendChild(ver);
    head.appendChild(el('span', 'flex:0 0 auto;font-size:12px;font-weight:600;font-variant-numeric:tabular-nums;')); // the 2/4 count
    head.style.cursor = 'move';
    head.style.touchAction = 'none';
    list = el('div', 'padding:2px 16px 14px;');
    embBox = el('div', 'padding:0 16px;');
    planBox = el('div', 'padding:0 16px;');
    panel.appendChild(head);
    // 7.0: the tabs, under the title. The planned date and embargo lines live on the Publish tab and the notes on
    // the Notes tab; each sits in a wrapper so its own code can show or hide it as before.
    tabBar = el('div', 'display:flex;gap:2px;padding:0 8px;border-bottom:1px solid #e3e6ea;position:sticky;top:0;z-index:2;background:#fff;');
    tabBar.setAttribute('role', 'tablist');
    panel.appendChild(tabBar);
    pubWrap = el('div');
    pubWrap.appendChild(planBox);
    pubWrap.appendChild(embBox);
    panel.appendChild(pubWrap);
    panel.appendChild(list);
    joeHost = el('div', 'display:none;flex-direction:column;min-height:0;');   // Joe, docked in its tab
    panel.appendChild(joeHost);
    notesWrap = el('div');
    notesWrap.appendChild(buildNotes()); // outside the part draw() rebuilds
    panel.appendChild(notesWrap);
    buildJoeBar(); // 7.0: built but not shown; the Joe tab replaces it

    pill = el('button', 'display:none;position:fixed;right:16px;bottom:16px;z-index:9999;align-items:center;gap:4px;padding:8px 15px;border:2px solid ' + C.blue +
      ';border-radius:20px;background:#fff;box-shadow:0 6px 18px rgba(17,24,39,.16);font:700 13px ' + F + ';font-variant-numeric:tabular-nums;cursor:pointer;');
    pill.type = 'button';
    pill.className = 'pe-checklist-pill';
    pill.title = 'Pre-publish checks';
    pill.appendChild(el('span'));
    pill.appendChild(el('span'));
    pill.style.cursor = 'move';
    pill.style.touchAction = 'none';
    movable(head, function () { mode = 'pill'; draw(); }, function () { ppos = { r: 16, t: 80 }; ls('pe-ck-ppos', ''); place(); }, panelSpot);
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
    watchJoeHighlight(joeHost); // 7.0: highlighting text in the docked Joe holds off redraws, as in its own window
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
      d.addEventListener('keydown', typingShrink, true); // 7.0: typing in the post shrinks the panel to its pill
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
    planCall().catch(function () {});    // no answer, or an older Code.gs: the planned date stays hidden
    notesCall().catch(function () {});   // no answer: the notes box stays as it is
    registerMe();                        // so flag emails can reach this person as an author
    setInterval(function () {
      if (document.hidden) return;
      checkSchedule().then(refreshAuto); call({ post: post });
      if (!embEditing) embargoCall().catch(function () {}); // someone else may have set one
      if (!planEditing) planCall().catch(function () {});   // or moved the planned date
      notesCall().catch(function () {});                    // someone else may have left a note
    }, 30000);
  }

  build();
  addEventListener('load', build);
  addEventListener('mercury:load', build);
})();
} catch (e) { if (window.console) console.warn('Production Expert script failed: pre-publish checklist (team only)', e); }
