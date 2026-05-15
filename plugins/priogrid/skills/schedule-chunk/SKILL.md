---
name: schedule-chunk
description: Schedule a Priogrid chunk and write the date/time to Todoist. Use when the user invokes /schedule-chunk, /priogrid:schedule-chunk, or asks to schedule a chunk.
---

# schedule-chunk

Run the bundled Priogrid script with the `schedule-chunk` command:

```bash
node ../../scripts/priogrid.mjs schedule-chunk <chunk-id-or-task-id> --date YYYY-MM-DD --time HH:MM
```

Resolve `../../scripts/priogrid.mjs` relative to this `SKILL.md`. This mutates Todoist immediately, then refreshes the local cache. Relay the result.
