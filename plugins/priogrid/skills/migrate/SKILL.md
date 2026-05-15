---
name: migrate
description: Migrate an old Priogrid planner-store JSON file into Todoist-backed metadata. Use when the user invokes /migrate, /priogrid:migrate, or asks to migrate an old store.
---

# migrate

Run the bundled Priogrid script with the `migrate` command:

```bash
node ../../scripts/priogrid.mjs migrate --from /path/to/planner-store.json
```

Resolve `../../scripts/priogrid.mjs` relative to this `SKILL.md`. Require the source file path before running. This writes Priogrid metadata to Todoist.
