---
name: set-project-status
description: Mark Priogrid projects active, parked, waiting, someday, or maintenance. Use when the user invokes /set-project-status, /priogrid:set-project-status, or asks to change project planning states.
---

# set-project-status

Run the bundled Priogrid script with the `set-project-status` command:

```bash
node ../../scripts/priogrid.mjs set-project-status <project|all> <active|parked|waiting|someday|maintenance>
```

Resolve `../../scripts/priogrid.mjs` relative to this `SKILL.md`. Pass project names in quotes when needed. For "everything else parked", use `all parked --except "<active project>,<maintenance project>"` when an exception list is clear.
