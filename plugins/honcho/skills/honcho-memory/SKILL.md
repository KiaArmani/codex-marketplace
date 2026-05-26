---
name: honcho-memory
description: Use Honcho MCP memory tools from Codex. Use when the user asks Codex to remember, recall, inspect, or personalize with Honcho; asks what Honcho knows; wants persistent memory across Codex sessions; or needs MCP setup for hosted or self-hosted Honcho.
---

# Honcho Memory

Use the Honcho MCP tools when they are available. If they are not in the active tool list, search for Honcho MCP tools before falling back to setup guidance.

## Setup

The bundled MCP bridge starts `mcp-remote` for Codex stdio transport.

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
