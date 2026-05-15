---
name: add-chunk
description: Add a schedulable Priogrid chunk. Use when the user invokes /add-chunk, /priogrid:add-chunk, or wants to create a concrete next chunk.
---

# add-chunk

Run the bundled Priogrid script with the `add-chunk` command:

```bash
node ../../scripts/priogrid.mjs add-chunk --project "<project>" --title "<title>" --minutes 45 --energy any
```

Resolve `../../scripts/priogrid.mjs` relative to this `SKILL.md`. Include `--done`, `--date`, and `--time` when the user provides a done state or schedule.
