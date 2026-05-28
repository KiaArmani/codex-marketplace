#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, dirname, extname, isAbsolute, join } from "node:path";

function unquoteTomlString(rawValue) {
  const value = rawValue.trim();
  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value);
    } catch {
      return undefined;
    }
  }

  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }

  return undefined;
}

function readCodexShellEnvironment() {
  const codexHome = process.env.CODEX_HOME || join(homedir(), ".codex");
  const configPath = join(codexHome, "config.toml");
  if (!existsSync(configPath)) {
    return {};
  }

  const result = {};
  let inShellEnvSet = false;
  const contents = readFileSync(configPath, "utf8");

  for (const line of contents.split(/\r?\n/)) {
    const section = line.match(/^\s*\[([^\]]+)\]\s*$/);
    if (section) {
      inShellEnvSet = section[1] === "shell_environment_policy.set";
      continue;
    }

    if (!inShellEnvSet) {
      continue;
    }

    const assignment = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+?)\s*$/);
    if (!assignment) {
      continue;
    }

    const parsed = unquoteTomlString(assignment[2]);
    if (typeof parsed === "string") {
      result[assignment[1]] = parsed;
    }
  }

  return result;
}

const env = { ...readCodexShellEnvironment(), ...process.env };

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

  const token = firstEnv("HONCHO_CODEX", "HONCHO_API_KEY", "HONCHO_AUTH_TOKEN", "HONCHO_TOKEN");
  if (token) {
    return `Bearer ${token}`;
  }

  console.error(
    "Honcho MCP needs HONCHO_CODEX, HONCHO_API_KEY, or HONCHO_AUTH_TOKEN. " +
      "For self-hosted auth, use the admin/scoped JWT token as HONCHO_CODEX or HONCHO_AUTH_TOKEN.",
  );
  process.exit(1);
}

function serverUrl() {
  const mcpUrl = firstEnv("HONCHO_CODEX_MCP_URL", "HONCHO_MCP_URL", "HONCHO_MCP_SERVER_URL");
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

const resolvedServerUrl = serverUrl();
const resolvedAuthHeader = authHeader();
const args = [
  "-y",
  "mcp-remote",
  resolvedServerUrl,
  "--header",
  `Authorization:${resolvedAuthHeader}`,
  "--header",
  `X-Honcho-User-Name:${userName}`,
];

const assistantName = firstEnv("HONCHO_ASSISTANT_NAME", "HONCHO_AI_PEER") || "Codex";
args.push("--header", `X-Honcho-Assistant-Name:${assistantName}`);

const workspaceId = firstEnv("HONCHO_WORKSPACE_ID", "HONCHO_WORKSPACE");
if (workspaceId) {
  args.push("--header", `X-Honcho-Workspace-ID:${workspaceId}`);
}

function redactedLaunchArgs(inputArgs) {
  return inputArgs.map((arg) => {
    if (arg.startsWith("Authorization:")) {
      return "Authorization:[redacted]";
    }
    return arg;
  });
}

function pathCandidates(command) {
  if (isAbsolute(command) || command.includes("/") || command.includes("\\")) {
    return [command];
  }

  const pathDirs = (env.PATH || env.Path || env.path || "").split(delimiter).filter(Boolean);
  if (process.platform !== "win32") {
    return pathDirs.map((dir) => join(dir, command));
  }

  const pathext = (env.PATHEXT || ".COM;.EXE;.BAT;.CMD")
    .split(";")
    .filter(Boolean);
  const hasExt = extname(command) !== "";
  const candidates = [];

  for (const dir of pathDirs) {
    if (hasExt) {
      candidates.push(join(dir, command));
      continue;
    }

    for (const extension of pathext) {
      candidates.push(join(dir, `${command}${extension.toLowerCase()}`));
      candidates.push(join(dir, `${command}${extension.toUpperCase()}`));
    }
  }

  return candidates;
}

function resolveOnPath(command) {
  return pathCandidates(command).find((candidate) => existsSync(candidate));
}

function npxLaunch() {
  if (process.platform !== "win32") {
    return { command: "npx", args };
  }

  const npxCommand = resolveOnPath("npx.cmd") || resolveOnPath("npx");
  if (!npxCommand) {
    throw new Error("npx.cmd was not found on PATH.");
  }

  const nodeRoot = dirname(npxCommand);
  const nodeCommand = existsSync(join(nodeRoot, "node.exe"))
    ? join(nodeRoot, "node.exe")
    : process.execPath;
  const npxCli = join(nodeRoot, "node_modules", "npm", "bin", "npx-cli.js");

  if (!existsSync(npxCli)) {
    throw new Error("npm's npx-cli.js was not found next to npx.cmd.");
  }

  return { command: nodeCommand, args: [npxCli, ...args] };
}

let launch;
try {
  launch = npxLaunch();
} catch (error) {
  console.error(`Failed to prepare Honcho MCP bridge: ${error.message}`);
  process.exit(1);
}

if (process.argv.includes("--dry-run") || env.HONCHO_MCP_BRIDGE_DRY_RUN === "1") {
  process.stdout.write(
    `${JSON.stringify(
      {
        serverUrl: resolvedServerUrl,
        command: launch.command,
        args: redactedLaunchArgs(launch.args),
        headers: {
          Authorization: "present",
          "X-Honcho-User-Name": userName,
          "X-Honcho-Assistant-Name": assistantName,
          ...(workspaceId ? { "X-Honcho-Workspace-ID": workspaceId } : {}),
        },
      },
      null,
      2,
    )}\n`,
  );
  process.exit(0);
}

let child;
try {
  child = spawn(launch.command, launch.args, {
    stdio: ["pipe", "pipe", "pipe"],
    env,
    windowsHide: true,
  });
} catch (error) {
  console.error(`Failed to start Honcho MCP bridge with npx: ${error.message}`);
  process.exit(1);
}

const secretsToRedact = [
  firstEnv("HONCHO_AUTH_HEADER", "AUTH_HEADER"),
  firstEnv("HONCHO_CODEX", "HONCHO_API_KEY", "HONCHO_AUTH_TOKEN", "HONCHO_TOKEN"),
].filter(Boolean);

function redactSecrets(value) {
  let output = String(value);
  for (const secret of secretsToRedact) {
    output = output.split(secret).join("[redacted]");
  }
  return output;
}

function writeChildStderr(chunk) {
  process.stderr.write(redactSecrets(chunk));
}

let warnedAboutNonProtocolStdout = false;
let stdoutBuffer = "";

function forwardProtocolLine(line) {
  if (!line.trim()) {
    return;
  }

  try {
    JSON.parse(line);
  } catch {
    if (!warnedAboutNonProtocolStdout) {
      warnedAboutNonProtocolStdout = true;
      console.error("Honcho MCP bridge suppressed non-protocol stdout from mcp-remote.");
    }
    return;
  }

  process.stdout.write(`${line}\n`);
}

child.stdout.setEncoding("utf8");
child.stdout.on("data", (chunk) => {
  stdoutBuffer += chunk;
  let newlineIndex = stdoutBuffer.indexOf("\n");
  while (newlineIndex !== -1) {
    const line = stdoutBuffer.slice(0, newlineIndex).replace(/\r$/, "");
    stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);
    forwardProtocolLine(line);
    newlineIndex = stdoutBuffer.indexOf("\n");
  }
});

child.stdout.on("end", () => {
  if (stdoutBuffer) {
    forwardProtocolLine(stdoutBuffer);
    stdoutBuffer = "";
  }
});

child.stderr.on("data", writeChildStderr);

process.stdin.pipe(child.stdin);
child.stdin.on("error", () => {});

let receivedShutdownSignal = false;
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    receivedShutdownSignal = true;
    if (child.exitCode === null) {
      child.kill(signal);
    }

    setTimeout(() => process.exit(0), 1000).unref();
  });
}

child.on("exit", (code, signal) => {
  if (signal && !receivedShutdownSignal) {
    console.error(`Honcho MCP bridge child exited from signal ${signal}.`);
  }
  process.exit(code ?? 0);
});

child.on("error", (error) => {
  console.error(`Failed to start Honcho MCP bridge with npx: ${error.message}`);
  process.exit(1);
});
