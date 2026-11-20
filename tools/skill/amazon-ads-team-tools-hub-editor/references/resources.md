# resources.json (Resources tab)

SOPs, playbooks and guides, usually Word documents on SharePoint. Cards show the name, the link's domain and the description, and open the link in a new tab.

## File shape

`{"file": "resources", "schemaVersion": 1, "updatedAt", "updatedBy", "items": [...], "log": [...]}`. Leave `updatedAt`, `updatedBy` and `log` as they are.

## A resource

```json
{
  "id": "t1793212345678",
  "name": "Tentpole Playbook",
  "url": "https://onepltfrm.sharepoint.com/:w:/r/sites/DigitalAdvertising/_layouts/15/Doc.aspx?sourcedoc=...",
  "desc": "Playbook for planning and running tentpole events like T12, Black Friday, and Cyber Monday.",
  "author": "PLTFRM",
  "tags": []
}
```

| Field | Required | Rules |
|---|---|---|
| `id` | yes | Unique. New: `t` plus the current Unix time in milliseconds. Never change an existing id. |
| `name` | yes | The document's title as people know it ("Account Transition SOP"). |
| `url` | yes | Must start with `https://`. Paste SharePoint links exactly as given, including everything after `?`. Never shorten, decode or "clean" them; the encoded characters (`%20`, `%7B`) are part of the link. Use the link from SharePoint's Share, Copy link so it works for the whole team. |
| `desc` | recommended | One sentence on what the document covers and when to use it. |
| `author` | optional | Defaults to "PLTFRM" for team documents. |
| `tags` | optional | Usually empty. If used, names from the Tags list. |

## Checklist

- [ ] Complete file; ids unique and unchanged.
- [ ] Every resource has `name` and an `https://` link copied exactly.
- [ ] Untouched resources byte-for-byte the same.
