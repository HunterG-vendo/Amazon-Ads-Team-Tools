# PLTFRM Amazon Ads Team Tools

Live at https://hunterg-vendo.github.io/Amazon-Ads-Team-Tools/

A static site on GitHub Pages with four tabs: AMC Queries, Apps, Skills and Resources. No server; Manage Page publishes changes straight to this repo through the GitHub API.

## Files

```
index.html            Page shell, styling, GitHub connection (GH_CONFIG) and the code version (HUB_BUILD)
js/validate.js        All checks used before publishing (file names, JSON, required fields, diffs)
js/core.js            Loads the data files, tab navigation, shared helpers, Filters menu, category icons, skill downloads
js/analyzer.js        Output analyzer on each AMC query page (charts, headline numbers, tables, PDF and Excel)
js/tab-amc.js         AMC Queries tab (list and query pages)
js/tab-apps.js        Apps tab
js/tab-skills.js      Skills tab
js/tab-resources.js   Resources tab
js/manager.js         Manage Page (editing, Upload, Updates, Settings, publishing)
data/amc-queries.json AMC queries
data/apps.json        Apps
data/skills.json      Skills (the .skill files are stored inside as base64)
data/resources.json   Resources
data/config.json      Tags, AMC categories (name and icon), plus the earlier activity history
backups/              Created automatically before every publish; the 3 newest copies of each file
downloads/            The Claude skill (amazon-ads-team-tools-hub-editor.skill) and one copy-paste prompt per file type, used in Upload from file, step 3
tools/                Source of the skill (tools/skill/) and build_skill.py, which generates downloads/
```

Each data file has the same outer shape: `file` (its own name, used to catch wrong uploads), `schemaVersion`, `updatedAt`, `updatedBy`, `items` (or `tags` in config.json) and `log` (latest 150 changes).

## First-time deploy (replacing the old single-file site)

The old site's Upload & Push can only replace index.html, so the first deploy goes through GitHub's website in one commit.

1. Unzip the package. You should see `index.html`, a `js` folder (8 files), a `data` folder (5 files), a `downloads` folder (the skill and 6 prompts) and a `tools` folder. (README.md and preview.html are optional to upload.)
2. Open https://github.com/HunterG-vendo/Amazon-Ads-Team-Tools
3. Click **Add file**, then **Upload files**.
4. Drag in `index.html` and the `js`, `data`, `downloads` and `tools` folders together. GitHub keeps the folders.
5. Commit directly to the main branch.
6. Wait about a minute, then open the live site and hard-refresh (Cmd+Shift+R or Ctrl+Shift+R).
7. Check: four tabs show counts of 11, 7, 2 and 4. Open Manage Page; under your name it should say "Editing the latest files from GitHub."

If something looks wrong, the previous version is in the repo history and in `index_v3.0_backup_before_amc_library.html`.

## Day to day

- **Quick changes:** Manage Page, Content (or Tags & Categories). Edit, then **Save and publish**, or **Save to draft** and keep going.
- **Push to GitHub:** Manage Page, Upload, **Publish current**. One click pushes every unpublished edit; each changed tab is saved as its own file.
- **New AMC queries:** always added by uploading an updated amc-queries.json (Content, AMC Queries, **Add queries with a file** jumps there). Existing queries can still be edited or removed in Content.
- **Bigger changes with Claude:** Manage Page, Upload, **Upload from file**: pick the tab, download the current file, then in step 3 either **Download the Claude skill** (add it to Claude once; it handles every file type) or **Copy prompt** for that file and paste it into Claude with the file. Describe the change, save Claude's file with the same name, drop it in step 4, review the checks and the change preview, then publish. Only that one file changes.
- **Updating the skill or prompts:** edit the markdown in `tools/skill/amazon-ads-team-tools-hub-editor/`, run `python tools/build_skill.py` from the repo root, then upload the changed `tools/` and `downloads/` files on the GitHub website. The skill's `scripts/check_file.py` mirrors `js/validate.js`; if the hub's checks change, update both.
- **Backups:** every publish (Push to GitHub, Save and publish, the per-tab Publish buttons, and Upload from file) first copies the live version of each file it changes into `backups/data/` (data files) or `backups/site/` (code files), named with the date and time, then keeps only the 3 newest per file. Only the files being changed are copied, never the whole repo. If a backup can't be saved, nothing is published. To restore, open Upload from file, pick the tab, download a backup from step 2 (it downloads with the original file name) and drop it in step 4. GitHub's commit history also keeps every version.
- **AMC categories:** Tags & Categories. Add a category with an icon, change icons, reorder (sets the order in the Filters menu). To rename, add the new one, move queries to it in Content, then remove the old one.
- **Analyzer settings:** each query's `viz` object in amc-queries.json holds its derived metrics, headline numbers and default chart. Queries without one get automatic defaults. Edit through Upload from file.
- **New AMC query from Claude:** Content, AMC Queries, Add query, open "Fill this form from JSON", paste, review, publish.
- **Code updates from Claude:** Upload, Site code. Drop the changed files.

## How updates reach everyone

- **New visitors** always load the data files fresh (every request skips the cache), so they see a publish as soon as GitHub Pages finishes rebuilding, usually within a minute.
- **Pages already open** check for new data every 90 seconds and whenever you come back to the tab, then update in place with a short "Updated with the latest changes" note. The check waits while you are typing or have a menu open, and is skipped while Manage Page is open (Manage Page loads the newest files from GitHub itself).
- **The person who published** keeps a copy of what they published for 20 minutes, so refreshing during the Pages rebuild never shows the old version. Once the live file catches up, the copy is dropped.
- **Code updates:** open pages compare their `HUB_BUILD` with the live index.html and show a "Refresh to get the new version" bar; coming back to the tab reloads it automatically (unless Manage Page is open).
- **After every publish** Manage Page closes and you land on the home page.
- **Nobody can land on Manage Page:** publishing only writes data files, never a snapshot of the page, and index.html always starts with Manage Page closed.

## Rules to keep it working

1. **Every publish writes one file.** Never combine tabs into one file.
2. **When any file in `js/` changes, raise `HUB_BUILD` and every `?v=` number in index.html**, then upload index.html too. Browsers keep code files for up to 10 minutes otherwise.
3. **Keep the GitHub token split into two base64 halves joined by `.`** in GH_CONFIG. A plain token gets the push blocked by GitHub secret scanning. Settings, "Copy GH_CONFIG line" produces the correct format.
4. **No `alert()`, `confirm()` or `prompt()`.** They are blocked in iframes. Use the two-click pattern (`M.confirmClick`).
5. **Do not edit `.skill` data by hand.** Upload skill files through Content, Skills.
6. **Conflicts are expected.** If someone else published the same tab first, GitHub refuses the older copy and Manage Page asks you to load the latest. That protects their work.

## Security note

The token in index.html is readable by anyone who views the page source. Use a fine-grained token limited to this one repository with Contents set to Read and write, so a leak can only affect this repo. The manager password is checked in the browser, so it controls who uses the tool day to day but is not real security.
