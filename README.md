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

Codex global chat memory capture:

```bash
export HONCHO_CODEX="your-admin-or-scoped-jwt"
export HONCHO_CODEX_URL="https://honcho.llm.kia.dev"
export HONCHO_USER_NAME="codex"
export HONCHO_ASSISTANT_NAME="codex"
export HONCHO_WORKSPACE_ID="kia-agenticcoding-dev"
```

The Honcho plugin bundles Codex `UserPromptSubmit` and `Stop` hooks in `hooks/hooks.json`. Codex currently requires active global hooks from a trusted config source, so this machine uses managed system hooks in `C:\ProgramData\OpenAI\Codex\config.toml` that point at `plugins/honcho/scripts/honcho-codex-hook.mjs` from this marketplace repo. With a peer-scoped token for `codex`, the hook stores user prompts, skips assistant replies so Codex output is not modeled as the same observed peer, and uses representation lookup for available context. With a token that can create a separate assistant peer, set a different `HONCHO_ASSISTANT_NAME`; the hook stores assistant replies there, sets the user peer to `observe_me=true, observe_others=true`, sets the assistant peer to `observe_me=false, observe_others=true`, and uses chat-based context on new prompts when available.

For direct SDK or CLI calls against a self-hosted API, use `HONCHO_URL` or `HONCHO_BASE_URL`. For the automatic Codex hook, prefer `HONCHO_CODEX_URL` so direct API configuration does not collide with MCP setup. For Codex MCP, `HONCHO_MCP_URL` or `HONCHO_CODEX_MCP_URL` must point at the MCP server or Worker, not the raw Honcho API URL.

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
