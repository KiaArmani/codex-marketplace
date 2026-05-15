---
name: priogrid
description: Chat-driven weekly planning over Todoist. Use when the user asks to review priorities, plan a week, mark projects active/parked/waiting/someday/maintenance, add planning projects or chunks, schedule chunks, sync priogrid to Todoist, migrate old priogrid data, or inspect today/tomorrow tasks.
---

# priogrid

priogrid is a Todoist-backed weekly planning assistant. All interaction happens in Codex chat. There is no web UI, API server, scheduler, dashboard, or frontend.

## Ground Rules

- Use the bundled script at `plugins/priogrid/scripts/priogrid.mjs`.
- Require `TODOIST_API_TOKEN` for real Todoist operations.
- Treat Todoist as canonical. Read Todoist before every answer that depends on current tasks or projects.
- Mutating workflows must write priogrid metadata/tasks to Todoist immediately, then read Todoist again before reporting results.
- Do not edit the user's project repo to operate priogrid.
- The local cache is disposable and lives under the user's home directory unless `PRIOGRID_CACHE_FILE` is set.

## Common Commands

```bash
node plugins/priogrid/scripts/priogrid.mjs doctor
node plugins/priogrid/scripts/priogrid.mjs sync
node plugins/priogrid/scripts/priogrid.mjs sync-all
node plugins/priogrid/scripts/priogrid.mjs review
node plugins/priogrid/scripts/priogrid.mjs list-projects
node plugins/priogrid/scripts/priogrid.mjs today --days 2
node plugins/priogrid/scripts/priogrid.mjs propose-week --capacity 360
node plugins/priogrid/scripts/priogrid.mjs set-project-status "Motion" active
node plugins/priogrid/scripts/priogrid.mjs add-project --name "Tax Report 2025" --status waiting --area life --energy admin --budget 120
node plugins/priogrid/scripts/priogrid.mjs add-chunk --project "Motion" --title "Triage release blockers" --minutes 45 --energy deep-work
node plugins/priogrid/scripts/priogrid.mjs schedule-chunk <chunk-id> --date YYYY-MM-DD --time HH:MM
node plugins/priogrid/scripts/priogrid.mjs migrate --from /path/to/planner-store.json
```

## Chat Workflow Mapping

- "Review priorities" -> run `review`.
- "What is due today/tomorrow?" -> run `today --days 2`.
- "Sync priogrid to Todoist" -> run `sync-all`.
- "Mark projects active/parked" -> run `set-project-status`, then summarize the refreshed review.
- "Add this idea as a parked project" -> run `add-project` with status/area/energy/budget.
- "Schedule this chunk" -> run `schedule-chunk`; this writes to Todoist immediately.

## Output Style

Relay the high-signal markdown output in chat. If a command fails because the Todoist token is missing, tell the user to set `TODOIST_API_TOKEN` on this machine.
