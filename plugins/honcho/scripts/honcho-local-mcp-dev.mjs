#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, dirname, extname, isAbsolute, join, resolve } from "node:path";

function parseArgs(argv) {
  const flags = new Map();
  const positionals = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }

    const equalsIndex = arg.indexOf("=");
    if (equalsIndex !== -1) {
      flags.set(arg.slice(2, equalsIndex), arg.slice(equalsIndex + 1));
      continue;
    }

    const name = arg.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      flags.set(name, next);
      index += 1;
    } else {
      flags.set(name, true);
    }
  }

  return { flags, positionals };
}

function firstEnv(...names) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) {
      return value;
    }
  }
  return undefined;
}

function flagValue(args, name) {
  const value = args.flags.get(name);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function usage() {
  return [
    "Usage: node scripts/honcho-local-mcp-dev.mjs --mcp-dir <honcho/mcp> --api-url <url>",
    "",
    "Writes HONCHO_API_URL to <honcho/mcp>/.dev.vars, then starts Wrangler dev.",
    "",
    "Options:",
    "  --mcp-dir <path>             Honcho MCP Worker directory. Defaults to cwd or cwd/mcp.",
    "  --api-url <url>              Honcho API URL to bind as HONCHO_API_URL.",
    "  --ip <address>               Wrangler listen address. Defaults to 0.0.0.0.",
    "  --port <port>                Wrangler port. Defaults to 8787.",
    "  --write-dev-vars-only        Write .dev.vars and exit.",
    "  --dry-run                    Print the resolved command without starting Wrangler.",
  ].join("\n");
}

function resolveMcpDir(args) {
  const configured =
    flagValue(args, "mcp-dir") ||
    firstEnv("HONCHO_MCP_SOURCE_DIR", "HONCHO_MCP_WORKER_DIR", "HONCHO_LOCAL_MCP_DIR");

  const candidates = [];
  if (configured) {
    candidates.push(configured);
  }

  candidates.push(process.cwd());
  candidates.push(join(process.cwd(), "mcp"));

  for (const candidate of candidates) {
    const resolved = resolve(candidate);
    if (existsSync(join(resolved, "wrangler.toml")) && existsSync(join(resolved, "src"))) {
      return resolved;
    }
  }

  throw new Error(
    "Could not find the Honcho MCP Worker directory. Pass --mcp-dir <honcho-repo>/mcp.",
  );
}

function quoteDevVar(value) {
  return JSON.stringify(value);
}

function upsertDevVar(contents, key, value) {
  const nextLine = `${key}=${quoteDevVar(value)}`;
  const keptLines = contents
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.match(new RegExp(`^\\s*${key}\\s*=`)));
  keptLines.push(nextLine);
  return `${keptLines.join("\n")}\n`;
}

function writeDevVars(mcpDir, apiUrl) {
  const devVarsPath = join(mcpDir, ".dev.vars");
  const current = existsSync(devVarsPath) ? readFileSync(devVarsPath, "utf8") : "";
  const next = upsertDevVar(current, "HONCHO_API_URL", apiUrl);
  mkdirSync(dirname(devVarsPath), { recursive: true });
  writeFileSync(devVarsPath, next, "utf8");
  return devVarsPath;
}

function pathCandidates(command) {
  if (isAbsolute(command) || command.includes("/") || command.includes("\\")) {
    return [command];
  }

  const pathDirs = (process.env.PATH || process.env.Path || process.env.path || "")
    .split(delimiter)
    .filter(Boolean);
  if (process.platform !== "win32") {
    return pathDirs.map((dir) => join(dir, command));
  }

  const pathext = (process.env.PATHEXT || ".COM;.EXE;.BAT;.CMD").split(";").filter(Boolean);
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

function npxLaunch(npxArgs) {
  if (process.platform !== "win32") {
    return { command: "npx", args: npxArgs };
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

  return { command: nodeCommand, args: [npxCli, ...npxArgs] };
}

function displayPath(path) {
  const home = homedir();
  return path.startsWith(home) ? `~${path.slice(home.length)}` : path;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.flags.has("help") || args.flags.has("h")) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  const mcpDir = resolveMcpDir(args);
  const apiUrl =
    flagValue(args, "api-url") || firstEnv("HONCHO_API_URL", "HONCHO_BASE_URL", "HONCHO_URL");
  if (!apiUrl) {
    throw new Error("HONCHO_API_URL is required. Pass --api-url or set HONCHO_API_URL.");
  }

  const devVarsPath = writeDevVars(mcpDir, apiUrl);
  process.stderr.write(
    `Honcho local MCP wrote Worker binding HONCHO_API_URL to ${displayPath(devVarsPath)}.\n`,
  );

  if (args.flags.has("write-dev-vars-only")) {
    process.stdout.write(`${JSON.stringify({ mcpDir, devVarsPath, wrote: "HONCHO_API_URL" })}\n`);
    return;
  }

  const ip = flagValue(args, "ip") || firstEnv("HONCHO_MCP_IP") || "0.0.0.0";
  const port = flagValue(args, "port") || firstEnv("HONCHO_MCP_PORT") || "8787";
  const launch = npxLaunch(["wrangler", "dev", "--ip", ip, "--port", port]);

  if (args.flags.has("dry-run")) {
    process.stdout.write(
      `${JSON.stringify({ cwd: mcpDir, command: launch.command, args: launch.args }, null, 2)}\n`,
    );
    return;
  }

  const child = spawn(launch.command, launch.args, {
    cwd: mcpDir,
    env: { ...process.env, HONCHO_API_URL: apiUrl },
    stdio: "inherit",
    windowsHide: true,
  });

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
      if (child.exitCode === null) {
        child.kill(signal);
      }
    });
  }

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
  child.on("error", (error) => {
    console.error(`Failed to start Wrangler for Honcho MCP: ${error.message}`);
    process.exit(1);
  });
}

try {
  await main();
} catch (error) {
  console.error(error.message);
  console.error("");
  console.error(usage());
  process.exit(1);
}
