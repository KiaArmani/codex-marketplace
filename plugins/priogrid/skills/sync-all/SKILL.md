---
name: sync-all
description: Reconcile Priogrid metadata with Todoist. Use when the user invokes /sync-all, /priogrid:sync-all, or asks to initialize/sync Priogrid to Todoist.
---

# sync-all

Run the bundled Priogrid script with the `sync-all` command:

```bash
node ../../scripts/priogrid.mjs sync-all
```

Resolve `../../scripts/priogrid.mjs` relative to this `SKILL.md`. This reads Todoist, creates or updates Priogrid metadata in Todoist, refreshes from Todoist again, and prints the result. Relay the output in chat.
