# Instructions for Claude: editing a PLTFRM Amazon Ads Team Tools Hub file

I am attaching amc-queries.json from the Team Tools Hub and will describe the change I want below these instructions. Follow every instruction here exactly. This is the copy-paste version of the "Amazon Ads Team Tools Hub Editor" skill: the guides it mentions as `references/...` are included further down, and the checker script is not available, so use the checklists in the guides instead of running it.

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

<!-- included guide: references/amc-queries.md -->

# amc-queries.json (AMC Queries tab)

Contents: file shape, every field, how each field shows on the site, SQL conventions, multi-part queries, example output, adding a query from SQL (interview), editing and removing, checklist.

## File shape

```json
{
  "file": "amc-queries",
  "schemaVersion": 1,
  "updatedAt": "2026-11-20T18:30:00.000Z",
  "updatedBy": "Hunter G",
  "items": [],
  "log": []
}
```

Leave `updatedAt`, `updatedBy` and `log` exactly as they are in the file you were given; the site sets them when it publishes. (JSON allows no comments, so never add any.) `items` order is the order queries appear in the grid (the default "All" view shows every query in this order).

## A query, field by field

| Field | Required | What it is | Where it shows |
|---|---|---|---|
| `id` | yes | Lowercase slug from the title: letters, numbers, `-`, `_` only. Unique. Never change it once published. | Page link `#amc/<id>`; key for saved analyzer results |
| `title` | yes | Short name, sentence case, what it measures. "NTB by Campaign", "4-Purchase LTV by Cohort". | Card title, page title |
| `type` | strongly expected | The category. Must exactly match a name in config.json `amcCategories` (current: "Advanced NTB Analysis", "LTV Analysis", "Path To Purchase Variations", "Other"). Missing means "Other". | Card label with the category icon, Categories filter |
| `summary` | strongly expected | One or two sentences (about 150 to 220 characters) saying what it returns and why you would run it. | Card text (cut after 4 lines), page lead |
| `description` | recommended | "What it does": how the query works and what to watch for. Paragraphs separated by a blank line (`\n\n`). Wrap table, column and placeholder names in backticks. | "What it does" section |
| `sql` | yes (unless `sqlParts`) | The full query exactly as it runs in AMC. | SQL block with Copy button |
| `sqlParts` | only for multi-step queries | List of steps, see below. When present, the page shows a switcher and copies one part at a time. | SQL block |
| `howTo` | recommended | Ordered steps to run it. List of strings. | "How to run it" (numbered) |
| `requirements` | recommended | What it needs. List of strings. | "What it needs" |
| `useCases` | recommended | When to use it. List of strings. | "Use cases" |
| `tags` | recommended | 3 to 5 short chips (see conventions). Free text, not limited to the Tags list. | Card and page chips, Tags filter |
| `example` | recommended | Sample output: `{"columns": [...], "rows": [[...], ...]}` | "Example output" table and the analyzer's "Try it with the example output" button |
| `viz` | recommended for new queries | Analyzer settings. See `analyzer-settings.md`. | "Analyze the output" section |
| `author` | optional | Who built it, as the team writes names: "Matan L.", "Hunter G.". Ask; never guess. | "By ..." on the card and page |
| `createdAt` | set on new | ISO time, for example `2026-11-20T18:30:00.000Z`. | |
| `updatedAt` | set when edited | ISO time of this edit. Leave it alone on queries you did not change. | "Updated" date on the page |

Unknown fields are kept by the site, so never delete fields you do not recognize.

### List items with labels

In `howTo`, `requirements` and `useCases`, a line that starts with a short label followed by a colon and a space shows the label in bold: `"Paid feature: Amazon Insights. ..."`. The label must be under 70 characters and come before the first `": "`. Use this consistently.

### Conventions from the existing library (follow them)

- **howTo**, in this order where it applies:
  1. "Fill in the header: replace `<BRAND NAME>` and `<AMC INSTANCE>` in the comment block so the saved query is easy to find. These are comments and don't change results."
  2. Which instance to open ("Open the brand's own AMC instance.") and anything brand-specific to edit.
  3. "Set the date range in the AMC UI." plus guidance on range length.
  4. Each optional filter: what to replace, then which line to uncomment by deleting the leading `--`.
  5. "Run, export, and sort in Excel (AMC has no ORDER BY in output)." or the query's own final step.
- **requirements**, each with a bold label:
  - `Paid feature: ...` or `Paid features: None. Runs on a standard AMC instance.` (`conversions_all` and `amazon_retail_purchases` need paid subscriptions; ask if unsure.)
  - `Table: ...` / `Tables: ...` naming every table in backticks.
  - `Instance: ...` (usually "Run it in the brand's own AMC instance.")
  - `Aggregation threshold: ...` when small rows may drop out.
  - `Date range: ...` (for example "Up to 13 months of history.")
  - Any input lists (`ASIN list: ...`, `Campaign names: ...`) and unit notes (`Units: ...`).
- **useCases**: "Short name: what decision it supports." Two to four items.
- **tags**: the main table (`conversions_all`), `Paid feature` or `No paid features`, the grain (`Daily`, `Monthly`, `Cohort`), and any filter (`ASIN filter`, `Campaign filter`). Keep them short.

## SQL conventions

- **Header block** at the top of `sql` (and of each part):

```sql
-- =====================================================================
-- QUERY NAME IN CAPITALS  |  TEMPLATE FOR ANY BRAND
-- Brand: <BRAND NAME>        Instance: <AMC INSTANCE>
-- =====================================================================
-- HOW TO USE
--   1. ...
--   2. ...
--
-- OUTPUT (one row per <grain>)
--   column_name                        what it means
-- =====================================================================
```

  Keep `<BRAND NAME>` and `<AMC INSTANCE>` as literal placeholders. The OUTPUT list must match the final SELECT's column aliases.
- **Optional filters** go in their own CTE with example values (for example `B000000001`) and are wired in with a commented line such as `-- AND tracked_item IN (SELECT asin FROM asin_filter)`, so the query returns everything until someone opts in.
- **Distinct users first**: build one row per user (and grain) before rolling up, as the existing queries do, so customers are not double counted.
- **AMC specifics**: no `ORDER BY` in final output (AMC ignores it; tell people to sort in Excel); spend in Sponsored Ads tables is in microcents and DSP in millicents, so convert to dollars in the query and say so in requirements; days are UTC (`event_date_utc`).
- **Do not "fix" working SQL** you were not asked to change. If you spot a real problem (for example a query that defines CTEs but has no final SELECT, like an incomplete paste), point it out and ask before changing it.
- If the person has the team's `amc-sql` skill, it is the right tool for writing or debugging the SQL itself; this skill is for getting it onto the hub correctly.

## Multi-part queries (`sqlParts`)

Use parts when the analysis needs several queries run in order and saved as separate files (True Non-Branded ROAS is the model). Each part:

```json
{ "name": "1. Classification", "file": "campaign_cost.csv", "note": "What this step returns and anything to check before the next step.", "sql": "-- header...\nSELECT ..." }
```

- Number the names in run order ("1. ...", "2a. ...", "2b. ...").
- `file` is the CSV name to save the result as. `note` may use backticks.
- Every part needs non-empty `sql`.
- Also set the top-level `sql` to all parts joined with a blank line between them. The page uses the parts; `sql` is a fallback.

## Example output (`example`)

- `columns` must be exactly the column aliases the SQL returns, in the same order.
- `rows`: 3 to 8 rows, every value a string (`"1234"`, `"0.0846"`, `"2026-09-01"`), one value per column. Use clearly fake but realistic values (`B0EXAMPL01`, round-ish numbers that add up sensibly). The page labels these as illustrative.
- Write empty values as `""`. Dates as `YYYY-MM-DD` (the first of the month for monthly grain).
- The analyzer's "Try it with the example output" button runs on these rows, so make sure the `viz` settings produce a sensible chart with them.

## Adding a query from someone's SQL (the usual request)

1. **Read the SQL** and work out: the grain (one row per what), the tables used, the output columns, any filters or placeholders, and whether it needs a paid feature.
2. **Draft every field yourself** from the SQL: title, summary, description, howTo, requirements, useCases, tags, example (columns from the aliases, fake rows), and `viz` (see `analyzer-settings.md`).
3. **Ask only for what the SQL cannot tell you**, in one numbered list:
   - Which category (offer the current list from config.json; if none fits, they need a new category first, which is a separate `config.json` upload done before this one).
   - Author name as the team writes it.
   - Anything uncertain: paid feature status, what a filter is for, intended use.
4. **Add the header block** to the SQL if it is missing, with placeholders and an OUTPUT list. Do not change the query logic.
5. **Create the id** from the title (lowercase, hyphens), checking it is not already used.
6. **Set `createdAt` and `updatedAt`** to now (ISO, UTC).
7. **Insert** at the end of `items` unless they say where.
8. **Check** (checker or checklist), then reply in the standard shape. The preview should show "1 added".

## Editing an existing query

- Change only the fields asked for, set that query's `updatedAt` to now, and keep its `id`.
- Moving it to another category means changing `type` to another existing category name exactly.
- Keep `viz`, `example` and `sqlParts` untouched unless the change is about them. If you change the SQL's output columns, update `example.columns` and any `viz` references to match, and say so.

## Removing a query

Remove exactly the named query. Mention that people's saved analyzer results for it stay in their browsers but are no longer reachable, and that the backup lets them restore it.

## Featured on the home page

If an entry you remove (or whose id the person insists on changing) is one of the home page's Featured picks, the home page will skip it. Say so in your reply and suggest choosing a replacement in Manage Page, Home.

## Checklist (go through it before replying)

- [ ] File is complete; entry count is the old count plus additions minus removals.
- [ ] `file` is `"amc-queries"`, `schemaVersion` is 1, `log`, `updatedAt`, `updatedBy` untouched.
- [ ] Every id unique, slug format, no existing id changed.
- [ ] Every query has `title` and either `sql` or `sqlParts` with SQL in every part.
- [ ] `type` matches a category in config.json exactly (or the person agreed to add it first).
- [ ] `howTo`, `requirements`, `useCases`, `tags` are lists of strings.
- [ ] `example.columns` matches the SQL output; every row has one string per column.
- [ ] `viz` only references columns that exist in the output or in `viz.derived` (see analyzer guide).
- [ ] Untouched queries are byte-for-byte the same.
- [ ] Writing style: no em dashes, no buzzwords, backticks around tables and columns.

---

<!-- included guide: references/analyzer-settings.md -->

# Analyzer settings (`viz` on an AMC query)

Every query page has an "Analyze the output" section. Someone runs the query in AMC, uploads the CSV or pastes the rows, and gets headline numbers (KPIs), a chart, a grouped table, an all-rows table, and PDF and Excel downloads. The query's `viz` object tells the analyzer how to present that output. Without `viz`, the analyzer still works using automatic defaults, but a well-written `viz` is what makes it useful.

Contents: how the analyzer reads columns, the `viz` keys, derived columns, KPIs, defaults, worked example, mistakes to avoid, checklist.

## How the analyzer reads the output (automatic, before `viz`)

- **Column types**, from the values:
  - date: at least 90% of values start with `YYYY-MM-DD`. Shown as `YYYY-MM` if every value is the 1st of a month, `YYYY` if every value is January 1st.
  - number: at least 95% parse as numbers (`$`, `,`, `%` and spaces are ignored). A number column whose name ends in `id`, contains `_id_`, `rank` or `sort_order` is treated as an id, not a measure.
  - text: everything else. AMC's literal `null` counts as empty.
- **Group by options**: text and date columns with more than one distinct value.
- **Measures**: number columns.
- **"Across" (x axis) options**: date columns, and text columns with 2 to 40 distinct values.
- **Default aggregation** when grouping: average for names containing `pct`, `percent`, `rate`, `share`, `avg`, `days`, `ltv`, `cac`, `roas` or `_per_`; sum for everything else.
- **Default number format** by name: `pct|percent|rate|share` shows as a percent, `sales|revenue|cost|spend|ltv|cac|price|aov` as money, `days` with 1 decimal, `roas` with 2 decimals, anything else automatic.
- **Labels**: column names are turned into words (`ntb_sales` becomes "NTB sales"; NTB, ASIN, CAC, LTV, ROAS, DSP, SP, SB, SD, ID are kept in capitals).

**Important about percents**: the percent format only adds a `%` sign. It does not multiply by 100. A column holding `0.0846` would show as "0.1%". If the SQL returns fractions, either change the SQL to return 0 to 100, or override the format (`"formats": {"user_purchase_rate": "num2"}`), or compute the percent as a derived ratio with `"scale": 100`.

## The `viz` keys

All keys are optional.

| Key | Shape | What it does |
|---|---|---|
| `derived` | list | New columns calculated from the output (ratios, labels). See below. |
| `kpis` | list | The headline number cards. See below. If missing: Rows, the count of distinct values of the group column, and up to two summed measures. |
| `defaults` | object | Starting chart: `group`, `measure`, `x`, `chart`, `top`, `dir`. See below. |
| `labels` | `{column: "Label"}` | Friendlier names for output columns. |
| `formats` | `{column: kind}` | Force a format. Kinds: `money`, `pct`, `num1`, `num2`, `x` (2 decimals plus "x"), `int`, `text`, `auto`. |
| `agg` | `{column: "sum" \| "avg" \| "max"}` | Override how a column combines when grouping. Use `max` for values that repeat on every row (such as a total per ASIN). |
| `hide` | list of columns | Remove columns from the Group by and Measure pickers (they still appear in the All rows table). Use for helper columns and percent columns you replaced with derived ratios. |
| `groupOrder` | `{"col": column, "values": [...]}` | Fixed order for the groups of that column (when nothing is chosen for "Across"). |
| `chronological` | `true` | Sort groups by their label (oldest first) instead of by value. Use when the group is a year, month or ordered bucket. |
| `rankBy` | column | When an "Across" axis is used, which column picks the top series (for example `new_customers` so the biggest cohorts are shown, not the highest LTV). |
| `filter` | `{"col": column, "value": "...", "label": "..."}` | Adds a checkbox, on by default, that keeps only rows where `col` equals `value`. Use when the output mixes detail rows with rollup rows. |

### `derived`: calculated columns

Each item needs a `name` (lower_snake_case, not already an output column) and a `label`. Exactly one of:

- **ratio**: `{"name": "cac", "label": "CAC", "ratio": ["total_cost", "new_to_brand_purchases"], "fmt": "money"}`
  - Numerator and denominator are each a column or a list of columns that are added together: `"ratio": ["new_to_brand_purchases", ["new_to_brand_purchases", "non_new_to_brand_purchases"]]`.
  - Calculated from the sums of each group, so ratios stay correct when grouped (never average a percent column when you can derive it).
  - `"scale": 100` turns a fraction into a percent; pair it with `"fmt": "pct"`.
  - A zero denominator shows as a dash.
- **concat**: `{"name": "target_match", "label": "Keyword + match type", "concat": ["target", "match_type"], "sep": " · "}` joins text columns into one label (default separator " · ").
- **map**: `{"name": "channel", "label": "Channel", "map": {"col": "advertiser_id", "eq": "Sponsored_ads", "then": "Sponsored Ads", "else": "DSP"}}` turns one exact value into a readable label.
- **path**: `{"name": "path_group", "label": "Path group", "path": {"col": "path", "other": "B"}}` reads an AMC path such as `[[1, NB], [2, B]]` and names it "Non-branded only", "Branded only", "Non-branded then Branded" or "Branded then Non-branded". `other` says whether an "Other" touch counts as `B` or `NB`. Add `"mode": "side"` for "Non-branded first" or "Branded first".

**A derived column is silently dropped if any column it references is missing from the output.** Spell every referenced column exactly as the SQL aliases it.

Derived ratios are measures; concat, map and path results are text, so they can be used to group, as the x axis, or in a KPI `where`.

### `kpis`: headline numbers

Each item has a `label`, an optional `note` (small text under the number), an optional `fmt`, and exactly one of:

| Kind | Example | Shows |
|---|---|---|
| `rows` | `{"label": "Rows", "rows": true}` | Number of rows |
| `sum` | `{"label": "Spend", "sum": "total_cost", "fmt": "money"}` | Total of a column (or a list of columns) |
| `ratio` | `{"label": "CAC", "ratio": ["total_cost", "new_to_brand_purchases"], "fmt": "money"}` | Sum over sum, with optional `scale` |
| `ratio` + `where` | `{"label": "True NB ROAS", "ratio": ["sales_amount", "total_cost"], "where": {"col": "path_group", "in": ["Non-branded only", "Non-branded then Branded"]}, "fmt": "num2"}` | The same ratio over only rows whose `col` (an output or derived text column) is one of `in` |
| `distinct` | `{"label": "ASINs", "distinct": "asin"}` | Count of different values |
| `wavg` | `{"label": "Avg days to next purchase", "wavg": ["avg_days_to_subsequent_purchase", "cross_promo_users"], "fmt": "num1"}` | Average of the first column weighted by the second |
| `top` | `{"label": "Most common window", "top": ["repurchase_window", "unique_users"]}` | The value of the first column whose rows add up to the most of the second |

Use 4 to 6 KPIs (the PDF shows the first 6). Lead with what the query is for. Add a `note` when a total is summed across days or months, because that over-counts unique people.

### `defaults`: the starting chart

```json
"defaults": { "group": "asin", "measure": "ntb_purchasers", "x": "event_day", "chart": "line", "top": "6", "dir": "desc" }
```

- `group`: a text or date column (or a derived text column). Pick the thing people compare: campaign, ASIN, category, path group.
- `measure`: a number column or derived ratio.
- `x`: `""` for ranked horizontal bars, or a date or low-cardinality text column for a trend across it.
- `chart`: `"line"` or `"bar"` (used when `x` is set).
- `top`: a string. Without `x`: `"10"`, `"15"`, `"25"`, `"50"` or `"all"`. With `x`: `"3"`, `"5"`, `"6"`, `"8"` or `"10"` series.
- `dir`: `"desc"` for highest first, `"asc"` for lowest first.

Anything invalid falls back to the automatic choice without an error, so check names carefully.

## Worked example (NTB by Campaign)

```json
"viz": {
  "defaults": { "group": "campaign", "measure": "total_cost", "x": "", "chart": "bar", "top": "15", "dir": "desc" },
  "derived": [
    { "name": "cac", "label": "CAC", "ratio": ["total_cost", "new_to_brand_purchases"], "fmt": "money" },
    { "name": "ntb_pct", "label": "NTB % of purchases", "ratio": ["new_to_brand_purchases", ["new_to_brand_purchases", "non_new_to_brand_purchases"]], "scale": 100, "fmt": "pct" }
  ],
  "hide": ["new_to_brand_purchases_percentage", "advertiser_id"],
  "labels": { "total_cost": "Spend", "new_to_brand_purchases": "NTB purchases" },
  "kpis": [
    { "label": "Spend", "sum": "total_cost", "fmt": "money" },
    { "label": "NTB purchases", "sum": "new_to_brand_purchases", "fmt": "int" },
    { "label": "CAC", "ratio": ["total_cost", "new_to_brand_purchases"], "fmt": "money" },
    { "label": "NTB % of purchases", "ratio": ["new_to_brand_purchases", ["new_to_brand_purchases", "non_new_to_brand_purchases"]], "scale": 100, "fmt": "pct" }
  ]
}
```

## Mistakes to avoid

- Referencing a column the SQL does not output (the derived column or KPI quietly disappears or shows a dash).
- Percent columns stored as fractions with the default percent format (shows 100 times too small).
- Averaging a percent across groups when it could be derived as a ratio of sums.
- `top` as a number instead of a string (`6` instead of `"6"`).
- A `group` with only one distinct value in the output (it is not offered as a group).
- Forgetting `chronological` when groups are years or months (they would sort by value).

## Checklist

- [ ] Every column named in `derived`, `kpis`, `defaults`, `labels`, `formats`, `agg`, `hide`, `groupOrder`, `rankBy` and `filter` exists in the SQL output or in `derived`.
- [ ] Derived names do not clash with output columns.
- [ ] Percents are on a 0 to 100 scale or use `scale: 100`.
- [ ] 4 to 6 KPIs, the most important first, with notes where totals over-count people.
- [ ] `defaults` gives a sensible first chart with the example rows.
- [ ] `example` rows exercise the settings (at least two groups, and at least two dates if `x` is a date).

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

(Describe the change here, and attach amc-queries.json.)
