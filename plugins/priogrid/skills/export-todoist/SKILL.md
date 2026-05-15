---
name: export-todoist
description: Preview or write Priogrid export changes to Todoist. Use when the user invokes /export-todoist, /priogrid:export-todoist, or asks to dry-run Todoist changes.
---

# export-todoist

Run the bundled Priogrid script with the `export-todoist` command:

```bash
node ../../scripts/priogrid.mjs export-todoist
```

Resolve `../../scripts/priogrid.mjs` relative to this `SKILL.md`. This is dry-run by default. Only add `--write` when the user explicitly asks to write changes.
