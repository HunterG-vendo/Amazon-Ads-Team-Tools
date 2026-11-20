# Site code (index.html and js files)

Changing code changes the whole hub for everyone, including Manage Page, which is how every other change gets published. A broken code file can lock people out of fixing it from the hub. Work carefully, change as little as possible, and always return whole files.

## The files

| File | What it does |
|---|---|
| `index.html` | Page shell: header, all styling, the GitHub connection (`GH_CONFIG`), the code version (`HUB_BUILD`), and the script tags. |
| `js/validate.js` | Every check used before publishing (file names, JSON, required fields, diffs, site file checks). |
| `js/core.js` | Loads the data files, tab navigation, shared helpers, Filters menus, category icons, skill downloads, keeping open pages up to date. |
| `js/analyzer.js` | The "Analyze the output" section on AMC query pages (Chart.js, SheetJS and jsPDF loaded from cdn.jsdelivr.net). |
| `js/tab-amc.js` | AMC Queries list and query pages. |
| `js/tab-apps.js`, `js/tab-skills.js`, `js/tab-resources.js` | The other three tabs. |
| `js/manager.js` | Manage Page: password, Content, Tags & Categories, Upload (Publish current, Push to GitHub, Upload from file, backups), Updates, Settings, and all GitHub publishing. |

Data lives in `data/*.json`, never in code. If a request can be done by editing a data file, do that instead.

The repo also has `downloads/` (the Claude skill file and the copy-paste prompts used in Upload from file, step 3) and `tools/` (the skill's source and `build_skill.py`, which generates `downloads/`). To change the skill or prompts: edit the markdown in `tools/skill/`, run `python tools/build_skill.py`, then upload the changed `tools/` and `downloads/` files on the GitHub website (Add file, Upload files). The hub's Site code upload only accepts index.html and the js files.

## Rules that keep the hub working

1. **Return the whole file.** Never a snippet, diff, or "insert this here". The hub replaces the file with exactly what is uploaded.
2. **Raise the version on every code change.** In `index.html`, `var HUB_BUILD = '2026.11.20-8';` and every `?v=2026.11.20-8` on the script tags must be identical. When any `js/` file changes, raise the number (for example to `2026.11.20-9`, or the new date with `-1`) in all nine places and upload `index.html` too. Otherwise browsers keep the old code for up to 10 minutes and open pages never offer the refresh.
3. **Keep `GH_CONFIG` exactly as it is** unless the person is changing the GitHub connection. The token is stored as two base64 halves joined by `.` so GitHub's secret scanning does not block the push. Never write a raw token. To change it, the person uses Manage Page, Settings, "Copy GH_CONFIG line" and pastes that line over the existing one.
4. **Every publish writes exactly one data file.** Do not add code that writes several files in one action or rewrites `index.html` from the page.
5. **Never publish a snapshot of the page.** The old hub saved the live page as the new file, which baked an open Manage Page and stuck buttons into the site for everyone. Publishing must only write data built from plain objects.
6. **No browser pop-ups.** No `alert()`, `confirm()` or `prompt()`; they are blocked when the hub is opened inside other tools. Use inline messages and the two-click pattern (`M.confirmClick(button, 'Click again to ...')`).
7. **Do not cache data in the browser.** Data files are fetched with `?t=` and `cache: 'no-store'` so everyone sees new publishes. Only small personal settings use storage, always through `Hub.store` (which survives blocked storage).
8. **Keep the one-time cleanup and freshness logic** in `core.js` (old cache clearing, the publisher's catch-up copy, open-page refresh, code-version check).
9. **Keep backups before publishing** (`M.backupFile`, `M.pruneBackups`, 3 kept per file) and the stale-write protection (publishing with the version GitHub gave you; GitHub refuses stale writes and Manage Page offers "Load latest").
10. **Script tags**: index.html must load, in this order, with `defer`: `js/validate.js`, `js/core.js`, `js/analyzer.js`, `js/tab-amc.js`, `js/tab-apps.js`, `js/tab-skills.js`, `js/tab-resources.js`, `js/manager.js`, and keep `<main class="page" id="app">`. The Upload check rejects an index.html missing any of these.
11. **External resources**: only Google Fonts (Geist, Geist Mono) and cdn.jsdelivr.net for the analyzer libraries at pinned versions. Do not add other hosts without a reason the person agrees to.
12. **Plain JavaScript, no build step.** Files are ES5 style functions inside an IIFE (the analyzer uses modern syntax that every current browser runs). No frameworks, no modules, no `import`.

## Design rules (from the team's feedback)

- Black background, neutral black-to-white grays only. No blue tint, no colored accents in the interface, no colored tags, no color dots on tabs. Color appears only in SQL syntax highlighting and analyzer charts.
- Corporate and flat: solid surfaces, small shadows, no glass or blur, no glossy gradients. Pills for buttons, inputs and chips; 12 to 14px corners on panels.
- Hover states brighten to white, never to a color.
- Geist for text, Geist Mono for code and table headers. Sentence case. No emojis. No em dashes in any visible text.
- Card grids for AMC Queries, Apps and Skills; compact link cards for Resources. Search plus separate dropdown buttons (Categories, Tags) and sort; no rows of filter buttons. No description lines under the tab titles.
- Favicon is the white P on a black square.

## How code reaches the site

Manage Page, Upload, Upload from file, Site code. Drop one or more of the listed files. The hub checks the file name is one of the site files, that JavaScript has no syntax errors, and that index.html still has its script tags, `GH_CONFIG` and the page container. It backs up the current version of each file to `backups/site/` (3 kept per file), publishes them one at a time, and records the update in the history. Open pages show "Refresh to get the new version" once the new index.html is live.

## If a code upload breaks the hub

If Manage Page still opens, restore from the backups: Upload from file, Site code, download the backup from step 2 and drop it in step 4.

If the page is broken so badly that Manage Page will not open, fix it on GitHub directly:
1. Open https://github.com/HunterG-vendo/Amazon-Ads-Team-Tools.
2. Open `backups/site/` and the newest backup of the broken file, then copy its contents (Raw, select all).
3. Open the broken file, click the pencil (Edit), replace everything with the backup, and commit to main.
4. Or use the repo's commit history to view the previous version of the file and restore it the same way.
5. Wait about a minute and hard-refresh the site.

## Before replying with code

- [ ] Whole files only; every file the change needs is included.
- [ ] `HUB_BUILD` and all `?v=` values raised and identical; index.html included whenever a js file changed.
- [ ] `GH_CONFIG` unchanged (or replaced with the line from Settings).
- [ ] No `alert(`, `confirm(` or `prompt(`; no new hosts; no frameworks.
- [ ] Publishing still writes one data file per action with a backup first.
- [ ] Design rules followed.
- [ ] Tell the person which files to upload, in one Site code upload, and to refresh after about a minute.
