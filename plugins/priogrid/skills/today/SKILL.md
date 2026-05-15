---
name: today
description: Show Todoist/Priogrid tasks due today and nearby days. Use when the user invokes /today, /priogrid:today, or asks what is due today/tomorrow.
---

# today

Run the bundled Priogrid script with the `today` command:

```bash
node ../../scripts/priogrid.mjs today --days 2
```

Resolve `../../scripts/priogrid.mjs` relative to this `SKILL.md`. If the user provides a day count, pass it as `--days <n>`. Relay the markdown output in chat.
