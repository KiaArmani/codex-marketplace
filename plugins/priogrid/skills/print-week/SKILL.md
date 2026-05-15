---
name: print-week
description: Print the cached Priogrid weekly plan. Use when the user invokes /print-week, /priogrid:print-week, or asks to show the current weekly plan.
---

# print-week

Run the bundled Priogrid script with the `print-week` command:

```bash
node ../../scripts/priogrid.mjs print-week
```

Resolve `../../scripts/priogrid.mjs` relative to this `SKILL.md`. If no cached plan exists, tell the user to run `propose-week` with a capacity first.
