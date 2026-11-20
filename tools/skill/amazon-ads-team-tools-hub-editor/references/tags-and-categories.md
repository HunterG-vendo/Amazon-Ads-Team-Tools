# config.json (Tags and AMC categories)

One file holds the shared Tags list (used by Apps, Skills and Resources, and their Tags filters) and the AMC categories (used by the AMC Queries tab: card labels, icons, the Categories filter, and the category dropdown when editing a query). It also holds the hub's earlier activity history in `log`.

## File shape

```json
{
  "file": "config",
  "schemaVersion": 1,
  "updatedAt": "2026-11-20T18:30:00.000Z",
  "updatedBy": "Hunter G",
  "tags": [ { "name": "PPC" }, { "name": "Reporting", "color": "#4f9eff" } ],
  "amcCategories": [ { "name": "Advanced NTB Analysis", "icon": "people-plus" }, { "name": "Other", "icon": "list" } ],
  "log": []
}
```

Leave `updatedAt`, `updatedBy` and `log` as they are. JSON allows no comments.

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

- [ ] `tags` and `amcCategories` are lists; every entry has a `name`; no duplicates (ignoring case).
- [ ] No tag named App, Skill, AMC Query or Resource.
- [ ] Every `icon` is one of the 18 ids.
- [ ] "Other" kept last; order otherwise unchanged unless asked.
- [ ] `log` untouched (it holds history going back months).
