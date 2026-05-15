---
name: add-project
description: Add a Priogrid planning project backed by Todoist metadata. Use when the user invokes /add-project, /priogrid:add-project, or wants to capture a new project/idea.
---

# add-project

Run the bundled Priogrid script with the `add-project` command:

```bash
node ../../scripts/priogrid.mjs add-project --name "<name>" --status parked --area other --energy any --budget 90
```

Resolve `../../scripts/priogrid.mjs` relative to this `SKILL.md`. Include `--why`, `--outcome`, and `--milestone` when the user provides that planning context.
