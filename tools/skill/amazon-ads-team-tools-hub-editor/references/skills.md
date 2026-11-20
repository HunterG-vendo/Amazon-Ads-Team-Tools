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

## Checklist

- [ ] Every `skillData` value identical to the original (same length, same first and last characters).
- [ ] Each skill has `skillData` or an `https://` `url`.
- [ ] Ids unique and unchanged; complete file.
