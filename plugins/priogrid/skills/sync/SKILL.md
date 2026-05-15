---
name: sync
description: Read fresh Todoist state into Priogrid. Use when the user invokes /sync, /priogrid:sync, or asks to refresh Priogrid from Todoist without writing metadata.
---

# sync

Run the bundled Priogrid script with the `sync` command:

```bash
node ../../scripts/priogrid.mjs sync
```

Resolve `../../scripts/priogrid.mjs` relative to this `SKILL.md`. This is read-only against Todoist apart from local disposable cache writes. Relay the command output in chat.
