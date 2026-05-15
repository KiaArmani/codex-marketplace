#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "priogrid.mjs");
const result = spawnSync(process.execPath, [script, "doctor", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: process.env
});

process.exitCode = result.status ?? 1;
