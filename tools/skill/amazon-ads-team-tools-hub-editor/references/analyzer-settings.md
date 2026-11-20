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
