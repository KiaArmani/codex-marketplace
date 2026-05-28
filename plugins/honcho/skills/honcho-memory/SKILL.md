---
name: honcho-memory
description: Use Honcho MCP memory tools from Codex. Use when the user asks Codex to remember, recall, inspect, or personalize with Honcho; asks what Honcho knows; wants persistent memory across Codex sessions; or needs MCP setup for hosted or self-hosted Honcho.
---

# Honcho Memory

Use the Honcho MCP tools when they are available. If they are not in the active tool list, search for Honcho MCP tools before falling back to setup guidance.

## Setup

The bundled MCP bridge starts `mcp-remote` for Codex stdio transport.
The plugin MCP manifest loads the bridge from `PLUGIN_ROOT` or `CODEX_PLUGIN_ROOT`
when Codex provides one, then falls back to the plugin working directory and the
installed `honcho@kia` plugin cache.
If Codex does not pass these values in the MCP process environment, the bridge
also reads string entries from `[shell_environment_policy.set]` in
`~/.codex/config.toml`.

Required environment:

```bash
export HONCHO_API_KEY="hch-your-api-key"
export HONCHO_USER_NAME="YourName"
```

Self-hosted Honcho with auth:

```bash
export HONCHO_AUTH_TOKEN="your-self-hosted-admin-or-scoped-jwt"
export HONCHO_MCP_URL="http://localhost:8787"
export HONCHO_USER_NAME="YourName"
```

`HONCHO_API_KEY` and `HONCHO_AUTH_TOKEN` are both sent as `Authorization: Bearer ...`. For direct SDK/CLI use against a self-hosted API, set `HONCHO_URL` or `HONCHO_BASE_URL`; for MCP use, set `HONCHO_MCP_URL` to the MCP server/Worker URL, not the raw Honcho API URL.

Optional environment:

```bash
export HONCHO_WORKSPACE_ID="codex"
export HONCHO_ASSISTANT_NAME="Codex"
```

## Automatic Codex Capture

The plugin bundles Codex lifecycle hooks in `hooks/hooks.json`. When installed as trusted or managed hooks, they automatically:

1. Store each user prompt on `UserPromptSubmit`.
2. Store the latest assistant reply on `Stop` when the token can create/use a separate assistant peer.
3. Add the user and assistant to one Honcho session per Codex session.
4. Return concise relevant Honcho context for the current prompt when available.

For self-hosted Codex memory capture, prefer these variables:

```bash
export HONCHO_CODEX="your-self-hosted-admin-or-scoped-jwt"
export HONCHO_CODEX_URL="https://honcho.llm.kia.dev"
export HONCHO_USER_NAME="codex"
export HONCHO_ASSISTANT_NAME="codex"
export HONCHO_WORKSPACE_ID="kia-agenticcoding-dev"
```

`HONCHO_CODEX_URL` is used by the direct API hook. `HONCHO_MCP_URL` or `HONCHO_CODEX_MCP_URL` is still required only when using the MCP bridge against a self-hosted MCP Worker.

Codex currently requires active global hooks from a trusted config source. For a managed machine-wide setup, place the hook commands in `C:\ProgramData\OpenAI\Codex\config.toml` so Codex reports them as managed system hooks; the bundled `hooks/hooks.json` is included for plugin-hook capable Codex builds. If `HONCHO_USER_NAME` and `HONCHO_ASSISTANT_NAME` resolve to the same peer, the hook enters scoped single-peer mode: user prompts are captured, assistant replies are skipped so Codex output is not modeled as the observed user peer, and context lookup uses the peer representation endpoint.

## Standard Flow

For a new conversation:

1. Create or get a session.
2. Create peers for the user and assistant.
3. Add both peers to the session, with the user observed and the assistant not observed.
4. Query `chat` only when personalization or memory would improve the answer.
5. Add the exact user and assistant messages to the session.

Use these observation settings unless the user asks otherwise:

```text
user: observe_me=true, observe_others=true
assistant: observe_me=false, observe_others=true
```

## Tool Use

- `chat`: ask Honcho what it knows about a peer.
- `search`: find relevant stored messages across workspace/session/peer scope.
- `get_representation` or `get_peer_context`: inspect durable memory.
- `add_messages_to_session`: store the exchange.
- `create_conclusions`: manually save stable facts only when the user explicitly asks or the fact is clear and durable.
- `get_queue_status`: check background processing when new memory has not appeared yet.

Treat Honcho as asynchronously consistent. Newly added messages may take time to affect `chat` and representation results.
