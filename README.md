# Codex Marketplace

My personal Codex plugin marketplace

## Plugins

- `priogrid`: Todoist-backed weekly planning through Codex chat.
- `diataxis`: Write, review, classify, restructure, and improve technical documentation using the Diataxis framework.

## Register Marketplace

Register this marketplace with Codex:

```bash
codex plugin marketplace add https://github.com/KiaArmani/codex-marketplace
codex plugin marketplace list
```

## Install priogrid

Install the priogrid plugin from the personal marketplace:

```bash
codex plugin install priogrid@kia
codex plugin list
```

Restart Codex if a running session has already loaded its plugin list.

## Install diataxis

Install the Diataxis plugin from the personal marketplace:

```bash
codex plugin install diataxis@kia
codex plugin list
```

Restart Codex if a running session has already loaded its plugin list.

## Configure priogrid

priogrid requires a Todoist API token:

```bash
export TODOIST_API_TOKEN="your-token-here"
```

Check the installation:

```bash
codex plugin run priogrid doctor
```

## Slash Commands

After installing the plugin, Priogrid exposes command skills that can be invoked from Codex chat:

```text
/priogrid:doctor
/priogrid:sync
/priogrid:sync-all
/priogrid:review
/priogrid:list-projects
/priogrid:today
/priogrid:propose-week
/priogrid:print-week
/priogrid:set-project-status
/priogrid:add-project
/priogrid:add-chunk
/priogrid:schedule-chunk
/priogrid:export-todoist
/priogrid:migrate
```

For example, use `/priogrid:sync-all` to initialize or reconcile the Todoist-side Priogrid metadata project, then `/priogrid:review` to inspect current priorities.
