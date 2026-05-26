# Codex Marketplace

My personal Codex plugin marketplace

## Plugins

- `priogrid`: Todoist-backed weekly planning through Codex chat.
- `diataxis`: Write, review, classify, restructure, and improve technical documentation using the Diataxis framework.
- `workflow-utils`: Reusable Codex workflow utilities for backups, workflow packaging audits, and repository AGENTS.md guides.
- `honcho`: Honcho memory MCP bridge plus SDK integration, CLI debugging, and SDK migration skills.

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

## Install workflow-utils

Install the Workflow Utils plugin from the personal marketplace:

```bash
codex plugin install workflow-utils@kia
codex plugin list
```

Restart Codex if a running session has already loaded its plugin list.

## Install honcho

Install the Honcho plugin from the personal marketplace:

```bash
codex plugin install honcho@kia
codex plugin list
```

Restart Codex if a running session has already loaded its plugin list.

## Configure honcho

Hosted Honcho:

```bash
export HONCHO_API_KEY="hch-your-key-here"
export HONCHO_USER_NAME="YourName"
```

Self-hosted Honcho with auth enabled:

```bash
export HONCHO_AUTH_TOKEN="your-admin-or-scoped-jwt"
export HONCHO_MCP_URL="http://localhost:8787"
export HONCHO_USER_NAME="YourName"
```

For direct SDK or CLI calls against a self-hosted API, use `HONCHO_URL` or `HONCHO_BASE_URL`. For Codex MCP, `HONCHO_MCP_URL` must point at the MCP server or Worker, not the raw Honcho API URL.

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
