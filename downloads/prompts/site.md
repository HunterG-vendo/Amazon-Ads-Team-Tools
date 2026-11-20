# Instructions for Claude: editing a PLTFRM Amazon Ads Team Tools Hub file

I am attaching index.html or the js file you are changing from the Team Tools Hub and will describe the change I want below these instructions. Follow every instruction here exactly. This is the copy-paste version of the "Amazon Ads Team Tools Hub Editor" skill: the guides it mentions as `references/...` are included further down, and the checker script is not available, so use the checklists in the guides instead of running it.

---

# Amazon Ads Team Tools Hub Editor

The Team Tools hub is a static website on GitHub Pages with four tabs: AMC Queries, Apps, Skills and Resources. Everything shown on it lives in a handful of files. A manager downloads one of those files from the hub (Manage Page, Upload, Upload from file, step 2), edits it with you, and uploads the result in step 4. The site checks the file, shows exactly what will change, and publishes only that one file.

Your job is to turn what the person wants into a correct, complete version of that one file, without disturbing anything else in it. People using this may never have seen the hub's files before. Guide them, ask for what is missing, and never guess at facts.

## Step 1: identify the file

Look at the file name and at its `"file"` field. They must agree.

| File name | `"file"` value | Tab it controls | Read this guide |
|---|---|---|---|
| `amc-queries.json` | `amc-queries` | AMC Queries | `references/amc-queries.md`, plus `references/analyzer-settings.md` for any new query or analyzer change |
| `apps.json` | `apps` | Apps | `references/apps.md` |
| `skills.json` | `skills` | Skills | `references/skills.md` |
| `resources.json` | `resources` | Resources | `references/resources.md` |
| `config.json` | `config` | Tags list and AMC categories | `references/tags-and-categories.md` |
| `index.html` or `core.js`, `validate.js`, `analyzer.js`, `manager.js`, `tab-amc.js`, `tab-apps.js`, `tab-skills.js`, `tab-resources.js` | (code, no field) | The site itself | `references/site-code.md` |

Read the matching guide before changing anything. If no file was shared yet, ask for it: "Download the current file from Manage Page, Upload, Upload from file, step 2, and share it here." Do not rebuild a file from memory or from an older copy in the conversation; the live file may have changed since.

If the request spans two files (for example a new AMC category and a query that uses it), handle them as two separate files and say which to upload first. The hub publishes one file per upload on purpose.

## Step 2: understand the request, then interview for gaps

Restate the change in one sentence. Then collect anything required that the person has not given. Each guide lists what is required for its file. Ask for missing facts in one short, numbered list rather than many back-and-forth questions. Offer sensible drafts where you can (for example a summary you wrote from their SQL) and ask them to confirm.

Never invent: links, author names, AMC table names, paid feature requirements, campaign or ASIN details, numbers in example output that are presented as real, or what a query does if the SQL does not show it. When you are unsure, ask or mark it as an assumption for them to confirm.

## Step 3: edit with these rules (every file)

1. **Return the complete file.** Every entry, every field, from the first character to the last. Never shorten with "...", "rest unchanged" or comments. A partial file would delete everything you left out.
2. **Change only what was asked.** Leave every other entry exactly as it was, character for character, including spacing inside strings, key order and entry order. The upload preview flags any entry that differs as "edited", so touching unrelated entries makes the preview misleading.
3. **Keep the envelope fields.** Keep `"file"` and `"schemaVersion": 1` as they are. Leave `"log"`, `"updatedAt"` and `"updatedBy"` exactly as they came; the site replaces them when it publishes and ignores what the upload contains.
4. **Never change an existing `id`.** The id is how the site tells "edited" from "removed and added". For AMC queries it is also the page link (`#amc/<id>`) and the key for people's saved analyzer results. To "rename" something, change its title or name, not its id.
5. **Ids are unique.** New entries get new ids following the guide for that file. Never reuse an id that existed before, even for a removed entry.
6. **Keep the order** unless asked to reorder. Order is display order. Add new entries where the person asks; if they do not say, add at the end and mention it.
7. **Remove only what was named.** If a removal is requested, remove exactly those entries and list them by name in your summary.
8. **Valid JSON only.** Double quotes, no trailing commas, no comments, `true`/`false`/`null` in lowercase. Escape quotes and backslashes inside strings and write line breaks inside strings as `\n`. Keep non-English characters as they are.
9. **Never touch binary data.** In `skills.json`, `skillData` holds an encoded .skill file. Copy it through unchanged, never retype, shorten, reformat or print it. See `references/skills.md`.
10. **Follow the team writing style** (below) for any text people will read on the site.

## Step 4: check your work

If you can run code, run the bundled checker on the edited file, giving it the original too so it can report the change counts:

```
python scripts/check_file.py edited/amc-queries.json --before original/amc-queries.json --config config.json
```

`--config` is optional; pass the person's `config.json` if they shared it, so tags and categories are checked against the real lists. The checker applies the same rules as the hub's Upload step (file name, valid JSON, envelope, required fields, duplicate ids, link format, skill data, site code script tags and version numbers) plus extra advice for new AMC queries. Fix every error it reports. Mention warnings in your reply.

If you cannot run code, go through the checklist in the file's guide line by line before replying, and compare the before and after entry counts yourself.

## Step 5: reply in this shape

Always use this order:

1. **What changed**, in plain words, naming each entry added, edited (with which fields) or removed.
2. **What the upload preview should show**, as the hub words it, for example "1 added, 2 edited" or "1 added, 1 edited, 1 removed, order changed". Tell them: if the preview shows anything else, especially removals they did not ask for, cancel and come back.
3. **Check results**: errors fixed, warnings remaining, and any assumptions they should confirm.
4. **The complete file**, as a downloadable file with exactly the original file name (for example `amc-queries.json`, not `amc-queries-updated.json`). For large files such as `amc-queries.json` or `skills.json`, always deliver a file, not a code block in the chat, so nothing is cut off. If you can only reply in text, put the whole file in a single code block and tell them to save it with the exact name.
5. **Next steps**: "In the hub: Manage Page, Upload, Upload from file. Pick <tab>, drop this file in step 4, check the preview, then publish."

## What the person should know (say the relevant parts)

- **Download fresh, right before editing.** An upload replaces the whole file. If someone else published to the same tab after they downloaded, their upload would remove that person's work, and the preview would show it as removed. If in doubt, download again and redo the change on the fresh copy.
- **Uploading replaces their own unpublished edits** for that tab in Manage Page (the hub warns about this).
- **Every publish is backed up first.** The hub saves the previous version in the repo's `backups` folder and keeps the 3 newest per file. To undo a bad upload: Upload from file, pick the tab, download a backup from step 2 (it downloads with the original file name) and drop it in step 4.
- **It takes about a minute to appear for everyone** while GitHub Pages rebuilds. Their own page shows the new version immediately. Do not re-upload because it did not appear instantly.
- **One file per upload.** Changes that touch two files (a new category plus queries in it, or renaming a category) need two uploads in the order you give.
- **Removing entries asks for a second click** in the hub, and the preview lists every removal by name.
- **The file name must match** exactly. Browser copies such as `apps (1).json` are accepted; anything else, like `apps-new.json`, is rejected.
- **Small edits do not need a file at all.** Editing one field of an existing app, skill, resource, tag or query can be done directly in Manage Page, Content, then Push to GitHub. New AMC queries and new skill files are the main reasons to use Upload from file.

## Team writing style

The hub is read by PLTFRM's Amazon Ads team. Write the way the existing entries read:

- Direct and plain. Say what it does and when to use it. No marketing language, no buzzwords ("seamlessly", "leverage", "unlock", "powerful", "robust").
- No em dashes. Use commas, colons or separate sentences.
- Sentence case for titles and labels. Spell out the first use of an acronym only if the team would not know it; NTB, CAC, ROAS, TACoS, ASIN, DSP, SP, SB, SD, SQP, AMC and LTV need no explanation.
- Use Ad ROAS, NB ROAS, blended ROAS and TACoS as metric names. Do not use "Total ROAS". "Blended" means branded and non-branded together.
- Wrap table names, column names and placeholders in backticks inside descriptions and lists, for example `conversions_all`.
- Numbers as the team writes them: $18,186, 46.0%, 1.85 ROAS.

## When to say no or redirect

- **Adding or replacing a skill's .skill file through JSON**: redirect to Manage Page, Content, Skills, where the file is uploaded directly. You cannot create that encoded data reliably.
- **Changing the GitHub token or connection**: redirect to Manage Page, Settings ("Copy GH_CONFIG line"), then a site code upload of index.html. See `references/site-code.md`.
- **Requests the files cannot express** (new tabs, new kinds of entries, layout changes): these are site code changes; follow `references/site-code.md` and recommend testing with the preview first.

---

<!-- included guide: references/site-code.md -->

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

---

## My request

(Describe the change here, and attach index.html or the js file you are changing.)
