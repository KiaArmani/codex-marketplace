#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(scriptDir, "..");
const bridgePath = join(scriptDir, "honcho-mcp-bridge.mjs");
const localMcpPath = join(scriptDir, "honcho-local-mcp-dev.mjs");
const tempCodexHomes = [];

function minimalEnv(overrides = {}) {
  const codexHome = mkdtempSync(join(tmpdir(), "honcho-plugin-test-codex-"));
  tempCodexHomes.push(codexHome);
  return {
    PATH: process.env.PATH,
    Path: process.env.Path,
    PATHEXT: process.env.PATHEXT,
    SystemRoot: process.env.SystemRoot,
    TEMP: process.env.TEMP,
    TMP: process.env.TMP,
    CODEX_HOME: codexHome,
    ...overrides,
  };
}

function runNode(args, env) {
  return spawnSync(process.execPath, args, {
    cwd: pluginRoot,
    env,
    encoding: "utf8",
  });
}

function assertSuccess(result, label) {
  assert.equal(
    result.status,
    0,
    `${label} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
}

function parseJsonOutput(result, label) {
  assertSuccess(result, label);
  return JSON.parse(result.stdout);
}

function testMcpManifest() {
  const manifest = JSON.parse(readFileSync(join(pluginRoot, ".codex-plugin", "plugin.json"), "utf8"));
  const mcp = JSON.parse(readFileSync(join(pluginRoot, ".mcp.json"), "utf8"));
  const server = mcp.mcpServers?.honcho;

  assert.equal(manifest.mcpServers, "./.mcp.json");
  assert.equal(server.command, "node");
  assert.equal(server.startup_timeout_sec, 60);
  assert.ok(server.args.includes("--input-type=module"));
  assert.ok(server.args.includes("-e"));
  assert.match(server.args.at(-1), /honcho-mcp-bridge\.mjs/);
  assert.doesNotMatch(JSON.stringify(server), /C:\\Users|kia\.armani/i);
  assert.notDeepEqual(server.args, ["./scripts/honcho-mcp-bridge.mjs"]);
}

function testMcpManifestLaunchesBridge() {
  const mcp = JSON.parse(readFileSync(join(pluginRoot, ".mcp.json"), "utf8"));
  const server = mcp.mcpServers.honcho;
  const output = parseJsonOutput(
    runNode(
      server.args,
      minimalEnv({
        HONCHO_MCP_BRIDGE_DRY_RUN: "1",
        HONCHO_API_KEY: "manifest-test-token",
        HONCHO_USER_NAME: "Tester",
      }),
    ),
    "MCP manifest bridge launch",
  );

  assert.equal(output.serverUrl, "https://mcp.honcho.dev");
  assert.doesNotMatch(JSON.stringify(output), /manifest-test-token/);
}

function testBridgeHostedDryRun() {
  const output = parseJsonOutput(
    runNode(
      [bridgePath, "--dry-run"],
      minimalEnv({
        HONCHO_API_KEY: "hosted-test-token",
        HONCHO_USER_NAME: "Tester",
      }),
    ),
    "hosted bridge dry run",
  );

  assert.equal(output.serverUrl, "https://mcp.honcho.dev");
  assert.equal(output.headers.Authorization, "present");
  assert.equal(output.headers["X-Honcho-User-Name"], "Tester");
  assert.doesNotMatch(JSON.stringify(output), /hosted-test-token/);
}

function testBridgeLocalDryRun() {
  const output = parseJsonOutput(
    runNode(
      [bridgePath, "--dry-run"],
      minimalEnv({
        HONCHO_AUTH_TOKEN: "local-test-token",
        HONCHO_USER_NAME: "KiaArmani",
        HONCHO_ASSISTANT_NAME: "Codex",
        HONCHO_WORKSPACE_ID: "codex",
        HONCHO_MCP_URL: "http://127.0.0.1:8787",
        HONCHO_API_URL: "http://127.0.0.1:8000",
      }),
    ),
    "local bridge dry run",
  );

  assert.equal(output.serverUrl, "http://127.0.0.1:8787");
  assert.equal(output.headers["X-Honcho-Workspace-ID"], "codex");
  assert.doesNotMatch(JSON.stringify(output), /api\.honcho\.dev|local-test-token/);
}

function testBridgeRejectsRawApiOnly() {
  const result = runNode(
    [bridgePath, "--dry-run"],
    minimalEnv({
      HONCHO_AUTH_TOKEN: "local-test-token",
      HONCHO_USER_NAME: "KiaArmani",
      HONCHO_API_URL: "http://127.0.0.1:8000",
    }),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /needs an MCP server URL/);
  assert.doesNotMatch(result.stdout + result.stderr, /api\.honcho\.dev/);
}

function testLocalWranglerDevVars() {
  const mcpDir = mkdtempSync(join(tmpdir(), "honcho-mcp-worker-"));
  mkdirSync(join(mcpDir, "src"));
  writeFileSync(join(mcpDir, "wrangler.toml"), 'name = "honcho-mcp"\n', "utf8");
  writeFileSync(
    join(mcpDir, ".dev.vars"),
    'OTHER_VAR="preserved"\nHONCHO_API_URL="https://api.honcho.dev"\n',
    "utf8",
  );

  try {
    const output = parseJsonOutput(
      runNode(
        [
          localMcpPath,
          "--mcp-dir",
          mcpDir,
          "--api-url",
          "http://127.0.0.1:8000",
          "--write-dev-vars-only",
        ],
        minimalEnv(),
      ),
      "local MCP .dev.vars writer",
    );
    const devVars = readFileSync(join(mcpDir, ".dev.vars"), "utf8");

    assert.equal(output.wrote, "HONCHO_API_URL");
    assert.match(devVars, /OTHER_VAR="preserved"/);
    assert.match(devVars, /HONCHO_API_URL="http:\/\/127\.0\.0\.1:8000"/);
    assert.doesNotMatch(devVars, /api\.honcho\.dev/);
  } finally {
    rmSync(mcpDir, { recursive: true, force: true });
  }
}

function main() {
  try {
    assert.ok(existsSync(bridgePath), "bridge script is missing");
    assert.ok(existsSync(localMcpPath), "local MCP launcher is missing");

    testMcpManifest();
    testMcpManifestLaunchesBridge();
    testBridgeHostedDryRun();
    testBridgeLocalDryRun();
    testBridgeRejectsRawApiOnly();
    testLocalWranglerDevVars();

    process.stdout.write("Honcho plugin self-test passed.\n");
  } finally {
    for (const path of tempCodexHomes) {
      rmSync(path, { recursive: true, force: true });
    }
  }
}

main();
