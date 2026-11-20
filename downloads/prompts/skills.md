# Instructions for Claude: editing a PLTFRM Amazon Ads Team Tools Hub file

I am attaching skills.json from the Team Tools Hub and will describe the change I want below these instructions. Follow every instruction here exactly. This is the copy-paste version of the "Amazon Ads Team Tools Hub Editor" skill: the guides it mentions as `references/...` are included further down, and the checker script is not available, so use the checklists in the guides instead of running it.

---

# Amazon Ads Team Tools Hub Editor

The Team Tools hub is a static website on GitHub Pages. It opens on a home page (Featured picks, Recently opened, Browse) and has four tabs: AMC Queries, Apps, Skills and Resources. Everything shown on it lives in a handful of files. A manager downloads one of those files from the hub (Manage Page, Upload, Upload from file, step 2), edits it with you, and uploads the result in step 4. The site checks the file, shows exactly what will change, and publishes only that one file.

Your job is to turn what the person wants into a correct, complete version of that one file, without disturbing anything else in it. People using this may never have seen the hub's files before. Guide them, ask for what is missing, and never guess at facts.

## Step 1: identify the file

Look at the file name and at its `"file"` field. They must agree.

| File name | `"file"` value | Tab it controls | Read this guide |
|---|---|---|---|
| `amc-queries.json` | `amc-queries` | AMC Queries | `references/amc-queries.md`, plus `references/analyzer-settings.md` for any new query or analyzer change |
| `apps.json` | `apps` | Apps | `references/apps.md` |
| `skills.json` | `skills` | Skills | `references/skills.md` |
| `resources.json` | `resources` | Resources | `references/resources.md` |
| `config.json` | `config` | Home page featured items, Tags list and AMC categories | `references/tags-and-categories.md` |
| `index.html` or `core.js`, `validate.js`, `analyzer.js`, `manager.js`, `tab-home.js`, `tab-amc.js`, `tab-apps.js`, `tab-skills.js`, `tab-resources.js` | (code, no field) | The site itself | `references/site-code.md` |

Read the matching guide before changing anything. If no file was shared yet, ask for it: "Download the current file from Manage Page, Upload, Upload from file, step 2, and share it here." Do not rebuild a file from memory or from an older copy in the conversation; the live file may have changed since.

If the request spans two files (for example a new AMC category and a query that uses it), handle them as two separate files and say which to upload first. The hub publishes one file per upload on purpose.

## Big changes go to Hunter G. for review first

Some changes reshape the hub rather than its content. For these, still do the work (prepare the complete files and explain them), but **do not tell the person to upload them**. Tell them to send the files and your summary to **Hunter G.**, who owns the hub, reviews big changes and uploads them himself.

A change is big if it does any of these:
- Adds, removes or renames a tab or a whole section (for example a new "Dashboards" tab like Skills), or adds a new kind of entry or a new data file.
- Changes how publishing, backups, the password, the GitHub connection, the Upload checks or the "keep pages up to date" logic work.
- Changes the analyzer's calculations, or the home page's structure.
- Redesigns the look (layout, colors, fonts) beyond fixing a typo in a label.
- Touches more than one site code file, or removes more than a few entries from any data file at once.
- Anything you are not confident is safe.

For a big change, end your reply with a **Review package for Hunter G.**: what was asked, what you changed in each file and why, what could break, how to test it (for example: open preview.html, then each tab, then Manage Page), and how to roll back (the backups and GitHub history). Then: "Send these files and this summary to Hunter G. for review. Do not upload them yourself."

Small changes stay self-service: adding, editing, removing or reordering a few queries, apps, skills, resources, tags, categories or home page picks, and one-line label or text fixes in the site code.

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
- **Featured items:** if you remove an entry that is featured on the home page, the home page simply skips it. Mention it, and suggest picking a replacement in Manage Page, Home.
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
- **Requests the files cannot express** (new tabs, new kinds of entries, layout changes): these are big site code changes. Follow `references/site-code.md`, prepare the files, and hand them over as a review package for Hunter G. (see "Big changes go to Hunter G. for review first"). Never tell the person to upload them directly.

---

<!-- included guide: references/skills.md -->

# skills.json (Skills tab)

Claude skills the team can download. Clicking a card opens a window with a Download button for the stored .skill file, or a link if there is no stored file.

## File shape

`{"file": "skills", "schemaVersion": 1, "updatedAt", "updatedBy", "items": [...], "log": [...]}`. Leave `updatedAt`, `updatedBy` and `log` as they are.

## A skill

```json
{
  "id": "t1783716152785",
  "name": "Bulk Sheet Tool",
  "url": "",
  "desc": "Fixes bulk sheet upload errors, organizes and manages portfolios, and builds new campaigns, ad groups, keywords, and targets.",
  "author": "Matan L.",
  "tags": ["Bulk Optimizations", "PPC", "SP", "SB"],
  "skillFileName": "amazon-bulk-sheets.skill",
  "skillData": "UEsDBBQAAAAI...(very long)..."
}
```

| Field | Required | Rules |
|---|---|---|
| `id` | yes | Unique, never changed. |
| `name` | yes | Name shown on the card. |
| `skillData` | yes, unless `url` is set | The .skill file (a zip) encoded as base64 text. **Never create, retype, shorten, reformat or print it.** Copy it through byte for byte. The hub rejects data that is not a valid zip. |
| `skillFileName` | with `skillData` | The download name, ending in `.skill`. Safe to change. |
| `url` | yes, unless `skillData` is set | An `https://` link to the file (for example SharePoint). Use `""` when the file is stored. |
| `desc`, `author`, `tags` | recommended | As for apps; tags spelled exactly as in the Tags list. |

## What you can and cannot do here

- **Can**: change names, descriptions, authors, tags, file names, links; reorder; remove a skill.
- **Cannot**: add a new skill file or replace one. Encoding a file by hand in a chat is not reliable, and one wrong character makes the download a broken file. Tell the person: "Add or replace the .skill file in Manage Page, Content, Skills: Add skill or Edit, then drop the .skill file. That stores it correctly." You can still prepare the name, description and tags for them to paste into that form.
- **Large file**: skills.json carries every stored skill, so it can be big. Always return it as a downloadable file. If your environment cannot return the full file without risk of cutting it off, recommend making the change in Manage Page, Content instead.

## Featured on the home page

If an entry you remove (or whose id the person insists on changing) is one of the home page's Featured picks, the home page will skip it. Say so in your reply and suggest choosing a replacement in Manage Page, Home.

## Checklist

- [ ] Every `skillData` value identical to the original (same length, same first and last characters).
- [ ] Each skill has `skillData` or an `https://` `url`.
- [ ] Ids unique and unchanged; complete file.

---

<!-- included guide: references/tags-and-categories.md -->

# config.json (Home page featured items, Tags and AMC categories)

One file holds the home page's Featured picks, the shared Tags list (used by Apps, Skills and Resources, and their Tags filters) and the AMC categories (used by the AMC Queries tab: card labels, icons, the Categories filter, and the category dropdown when editing a query). It also holds the hub's earlier activity history in `log`.

## File shape

```json
{
  "file": "config",
  "schemaVersion": 1,
  "updatedAt": "2026-11-20T18:30:00.000Z",
  "updatedBy": "Hunter G",
  "tags": [ { "name": "PPC" }, { "name": "Reporting", "color": "#4f9eff" } ],
  "amcCategories": [ { "name": "Advanced NTB Analysis", "icon": "people-plus" }, { "name": "Other", "icon": "list" } ],
  "featured": [ { "target": "amc-queries", "id": "true-nb-roas" }, { "target": "apps", "id": "t1783026537088" } ],
  "log": []
}
```

Leave `updatedAt`, `updatedBy` and `log` as they are. JSON allows no comments.

## Featured (home page)

- Up to 6 picks, shown in this order in the Featured section of the home page. Any mix of types.
- Each pick is `{"target": "...", "id": "..."}` where `target` is `amc-queries`, `apps`, `skills` or `resources`, and `id` is the exact id of that entry in its file (look it up in the person's file; never guess). No duplicates.
- A pick whose entry no longer exists is skipped on the home page and flagged in Manage Page, Home.
- The easiest way to change picks is Manage Page, Home (six dropdowns). Use a file upload only if the person prefers.
- Changing which items are featured or their order is a small, self-service change. Changing what the home page shows (new sections, layout) is a big change for Hunter G. to review.

## Tags

- `name` is required, unique ignoring capital letters, and cannot be a tab name: App, Skill, AMC Query, Resource.
- Older tags carry a `color` value. Colors are no longer shown; leave existing ones as they are and do not add colors to new tags.
- Order is the order tags appear in the Tags filter.
- **Removing a tag** only removes it from this list. Apps and skills that use it keep the label (it still shows on their cards) but it disappears from the filter. Tell the person, and offer to also remove it from those entries in a separate upload of that file if they want it gone everywhere.
- **Renaming a tag** is a removal plus an addition here, and every entry using the old name keeps the old name until its own file is updated. Explain this and list the uploads needed.

## AMC categories

- `name` is required and unique ignoring capital letters. Queries reference categories by exact name in their `type` field.
- `icon` is one of these ids (anything else shows the plain tag icon):
  `people-plus` (new customers), `path` (path), `trend` (trend), `list` (list), `tag` (tag), `bars` (bar chart), `pie` (share), `repeat` (repeat), `clock` (timing), `calendar` (calendar), `cart` (purchases), `dollar` (revenue), `target` (targeting), `funnel` (funnel), `layers` (layers), `search` (search terms), `tv` (DSP and video), `star` (highlights).
  Suggest the icon that matches the category's meaning.
- Order is the order in the Categories filter. Keep "Other" last.
- **Adding a category**: add it here first and upload `config.json`. Then queries can use it (a separate `amc-queries.json` upload, or editing each query's category in Manage Page, Content).
- **Removing a category**: queries that still use it keep showing it with the plain tag icon. Recommend moving those queries to another category first.
- **Renaming a category** takes two uploads, in this order: (1) `config.json` with the new name added (keep the old one for now), (2) `amc-queries.json` with every affected query's `type` changed to the new name; then optionally (3) `config.json` again with the old name removed. Never do it in a single upload, because queries would point at a name that does not exist yet.

## Checklist

- [ ] `featured` has at most 6 picks, each with a valid `target` and an `id` that exists in that file, no duplicates.
- [ ] `tags` and `amcCategories` are lists; every entry has a `name`; no duplicates (ignoring case).
- [ ] No tag named App, Skill, AMC Query or Resource.
- [ ] Every `icon` is one of the 18 ids.
- [ ] "Other" kept last; order otherwise unchanged unless asked.
- [ ] `log` untouched (it holds history going back months).

---

## My request

(Describe the change here, and attach skills.json.)
