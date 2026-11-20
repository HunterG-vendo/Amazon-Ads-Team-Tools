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
