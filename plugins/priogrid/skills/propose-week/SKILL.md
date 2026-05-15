---
name: propose-week
description: Propose a weekly Priogrid plan. Use when the user invokes /propose-week, /priogrid:propose-week, or gives weekly capacity to plan.
---

# propose-week

Run the bundled Priogrid script with the `propose-week` command:

```bash
node ../../scripts/priogrid.mjs propose-week --capacity <minutes>
```

Resolve `../../scripts/priogrid.mjs` relative to this `SKILL.md`. If the user gives hours, convert to minutes. If capacity is missing, ask for it. Relay the generated weekly plan markdown.
