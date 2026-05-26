#!/usr/bin/env node
import { spawn } from "node:child_process";

const env = process.env;

function firstEnv(...names) {
  for (const name of names) {
    const value = env[name]?.trim();
    if (value) {
      return value;
    }
  }
  return undefined;
}

function authHeader() {
  const explicit = firstEnv("HONCHO_AUTH_HEADER", "AUTH_HEADER");
  if (explicit) {
    return explicit.startsWith("Bearer ") ? explicit : `Bearer ${explicit}`;
  }

  const token = firstEnv("HONCHO_API_KEY", "HONCHO_AUTH_TOKEN", "HONCHO_TOKEN");
  if (token) {
    return `Bearer ${token}`;
  }

  console.error(
    "Honcho MCP needs HONCHO_API_KEY or HONCHO_AUTH_TOKEN. " +
      "For self-hosted auth, use the admin/scoped JWT token as HONCHO_AUTH_TOKEN.",
  );
  process.exit(1);
}

function serverUrl() {
  const mcpUrl = firstEnv("HONCHO_MCP_URL", "HONCHO_MCP_SERVER_URL");
  if (mcpUrl) {
    return mcpUrl;
  }

  const apiUrl = firstEnv("HONCHO_API_URL", "HONCHO_BASE_URL", "HONCHO_URL");
  const endpoint = firstEnv("HONCHO_ENDPOINT");
  if (apiUrl || (endpoint && endpoint !== "production")) {
    console.error(
      "HONCHO_URL/HONCHO_BASE_URL/HONCHO_ENDPOINT points at a Honcho API server, " +
        "but Codex MCP needs an MCP server URL. Deploy or run the Honcho MCP Worker " +
        "against that API and set HONCHO_MCP_URL to the Worker URL.",
    );
    process.exit(1);
  }

  return "https://mcp.honcho.dev";
}

const userName = firstEnv("HONCHO_USER_NAME", "HONCHO_PEER_NAME", "USER", "USERNAME");
if (!userName) {
  console.error("Honcho MCP needs HONCHO_USER_NAME or HONCHO_PEER_NAME.");
  process.exit(1);
}

const args = [
  "-y",
  "mcp-remote",
  serverUrl(),
  "--header",
  `Authorization:${authHeader()}`,
  "--header",
  `X-Honcho-User-Name:${userName}`,
];

const assistantName = firstEnv("HONCHO_ASSISTANT_NAME", "HONCHO_AI_PEER") || "Codex";
args.push("--header", `X-Honcho-Assistant-Name:${assistantName}`);

const workspaceId = firstEnv("HONCHO_WORKSPACE_ID", "HONCHO_WORKSPACE");
if (workspaceId) {
  args.push("--header", `X-Honcho-Workspace-ID:${workspaceId}`);
}

const command = process.platform === "win32" ? "npx.cmd" : "npx";
const child = spawn(command, args, { stdio: "inherit", env });

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

child.on("error", (error) => {
  console.error(`Failed to start Honcho MCP bridge with npx: ${error.message}`);
  process.exit(1);
});
