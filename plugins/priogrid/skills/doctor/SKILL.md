---
name: doctor
description: Run the Priogrid doctor check. Use when the user invokes /doctor, /priogrid:doctor, or asks to verify Priogrid/Todoist setup.
---

# doctor

Run the bundled Priogrid script with the `doctor` command:

```bash
node ../../scripts/priogrid.mjs doctor
```

Resolve `../../scripts/priogrid.mjs` relative to this `SKILL.md`, not relative to the user's current project. Relay the markdown output. If `TODOIST_API_TOKEN` is missing, tell the user to set it on this machine.
