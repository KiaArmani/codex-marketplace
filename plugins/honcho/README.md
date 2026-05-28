# Honcho Codex Plugin

This plugin bundles the Codex-facing Honcho MCP bridge, Honcho memory hooks, and
Honcho SDK/CLI migration skills. Everything needed by Codex lives inside the
installed plugin folder.

## MCP Registration

The plugin manifest points at `./.mcp.json`, which declares the `honcho` MCP
server. The MCP entry launches Node with a small resolver that finds
`scripts/honcho-mcp-bridge.mjs` from the installed plugin root, from
`PLUGIN_ROOT` / `CODEX_PLUGIN_ROOT`, or from the Codex plugin cache. It does not
require a user-specific path in `~/.codex/config.toml`.

The bridge starts `mcp-remote` over stdio and sends:

- `Authorization: Bearer <token>`
- `X-Honcho-User-Name`
- `X-Honcho-Assistant-Name`
- `X-Honcho-Workspace-ID` when configured

## Hosted Honcho

Set normal environment variables before starting Codex:

```bash
export HONCHO_API_KEY="hch-your-key"
export HONCHO_USER_NAME="YourName"
```

When no local MCP URL is configured, the bridge uses `https://mcp.honcho.dev`.

## Self-Hosted Honcho

For self-hosted MCP, point Codex at the MCP Worker URL, not the raw Honcho API
URL:

```bash
export HONCHO_AUTH_TOKEN="your-admin-or-scoped-jwt"
export HONCHO_MCP_URL="http://127.0.0.1:8787"
export HONCHO_USER_NAME="YourName"
export HONCHO_WORKSPACE_ID="codex"
```

If `HONCHO_API_URL`, `HONCHO_BASE_URL`, or `HONCHO_URL` is set without
`HONCHO_MCP_URL`, the bridge exits instead of silently falling back to hosted
Honcho. This prevents local/self-hosted runs from accidentally calling
`https://api.honcho.dev`.

## Local Wrangler MCP Worker

Wrangler local development reads Worker bindings from `.dev.vars`; Docker or
process environment variables alone are not visible as `env.HONCHO_API_URL` in
the Worker. Use the plugin-provided launcher from the installed plugin folder:

```bash
cd ~/.codex/plugins/cache/kia/honcho/<installed-version>
node scripts/honcho-local-mcp-dev.mjs \
  --mcp-dir /path/to/honcho/mcp \
  --api-url http://127.0.0.1:8000 \
  --port 8787
```

On Windows PowerShell:

```powershell
Set-Location "$env:USERPROFILE\.codex\plugins\cache\kia\honcho\<installed-version>"
$honchoMcp = "C:\path\to\honcho\mcp"
node .\scripts\honcho-local-mcp-dev.mjs `
  --mcp-dir $honchoMcp `
  --api-url http://127.0.0.1:8000 `
  --port 8787
```

The launcher writes `<honcho>/mcp/.dev.vars` with:

```text
HONCHO_API_URL="http://127.0.0.1:8000"
```

Then it starts:

```bash
npx wrangler dev --ip 0.0.0.0 --port 8787
```

Wrangler should log that it is using `.dev.vars` and show
`env.HONCHO_API_URL` as a local environment variable. If the Worker runs inside
Docker Compose, pass the API URL reachable from that container, for example
`http://api:8000`.

## Verification

Run the plugin self-test from the plugin root:

```bash
node scripts/honcho-plugin-self-test.mjs
```

The self-test checks MCP metadata, hosted and local bridge resolution, rejection
of raw API-only local configuration, and `.dev.vars` generation for Wrangler.
