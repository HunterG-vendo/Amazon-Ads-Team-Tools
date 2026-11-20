# apps.json (Apps tab)

Browser tools built by the team (mostly GitHub Pages sites). Each card opens its link in a new tab.

## File shape

`{"file": "apps", "schemaVersion": 1, "updatedAt", "updatedBy", "items": [...], "log": [...]}`. Leave `updatedAt`, `updatedBy` and `log` as they are. `items` order is the default display order (people can also sort A to Z or by author).

## An app

```json
{
  "id": "t1793212345678",
  "name": "Daypart Analyzer",
  "url": "https://hunterg-vendo.github.io/Daypart-Analyzer/",
  "desc": "Analyze your Amazon Ads performance by hour and day of week to find the best bid adjustment windows and cut spend during low-converting time slots.",
  "author": "Hunter G.",
  "tags": ["Report Analyzers", "PPC", "SP"]
}
```

| Field | Required | Rules |
|---|---|---|
| `id` | yes | Unique. For a new app use `t` followed by the current Unix time in milliseconds (13 digits). Never change an existing id. |
| `name` | yes | The tool's name as the team calls it, title case like the existing cards. |
| `url` | yes | Must start with `https://`. Usually `https://<github-user>.github.io/<Repo-Name>/`. Use the link the person gives; never guess a URL. |
| `desc` | recommended | One to three sentences: what you upload or enter, and what you get back. Plain and specific. |
| `author` | recommended | Name as the team writes it ("Ricky G."). Ask if not given. |
| `tags` | recommended | Names from the Tags list in config.json, spelled exactly as listed there. Current tags: Report Analyzers, Reporting, Bulk Optimizations, PPC, DSP, SP, SB, AMC, SQL (check the person's config.json if shared, the list may have grown). A tag not in the list still shows, but the hub warns and it will not appear under Tags until someone adds it in Tags & Categories. |

## Asking for missing details

For a new app you need: name, link, a description (offer a draft if they explain what it does), author, and which tags apply (offer the list). If they want a tag that does not exist, tell them to add it under Manage Page, Tags & Categories (or a `config.json` upload) first, or accept that it will show without being in the Tags filter.

## Checklist

- [ ] Complete file, same count plus additions minus removals.
- [ ] Every id unique; no existing id changed.
- [ ] Every app has `name` and an `https://` `url`.
- [ ] Tags spelled exactly as in the Tags list.
- [ ] Untouched apps byte-for-byte the same.
- [ ] Writing style: plain, no em dashes, no buzzwords.
