#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_BASE_URL = "https://api.honcho.dev";
const DEFAULT_WORKSPACE_ID = "codex";
const MAX_CONTEXT_PROMPT_CHARS = 6000;
const MAX_ADDITIONAL_CONTEXT_CHARS = 3000;
const REQUEST_TIMEOUT_MS = 20000;
const STATE_LIMIT = 1000;

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

function sanitizeId(value, fallback) {
  const source = (value || fallback || "unknown").trim();
  const sanitized = source.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_+/g, "_");
  const trimmed = sanitized.replace(/^_+|_+$/g, "").slice(0, 512);
  return trimmed || fallback || "unknown";
}

function apiBaseUrl() {
  const configured =
    firstEnv("HONCHO_CODEX_URL", "HONCHO_API_URL", "HONCHO_BASE_URL", "HONCHO_URL") ||
    DEFAULT_BASE_URL;
  return configured.replace(/\/+$/, "");
}

function apiUrl(path) {
  const base = apiBaseUrl();
  const prefix = base.endsWith("/v3") ? base : `${base}/v3`;
  return `${prefix}${path}`;
}

function authToken() {
  return firstEnv("HONCHO_CODEX", "HONCHO_API_KEY", "HONCHO_AUTH_TOKEN", "HONCHO_TOKEN");
}

function tokenClaims() {
  const token = authToken()?.replace(/^Bearer\s+/i, "");
  if (!token || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) {
    return {};
  }

  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), "=");
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch {
    return {};
  }
}

function authHeader() {
  const token = authToken();
  if (!token) {
    return undefined;
  }
  return token.startsWith("Bearer ") ? token : `Bearer ${token}`;
}

function workspaceId() {
  return sanitizeId(
    firstEnv("HONCHO_WORKSPACE_ID", "HONCHO_WORKSPACE") || tokenClaims().w,
    DEFAULT_WORKSPACE_ID,
  );
}

function userPeerId() {
  return sanitizeId(
    firstEnv("HONCHO_USER_NAME", "HONCHO_PEER_NAME") ||
      tokenClaims().p ||
      firstEnv("USER", "USERNAME"),
    "user",
  );
}

function assistantPeerId() {
  return sanitizeId(
    firstEnv("HONCHO_ASSISTANT_NAME", "HONCHO_AI_PEER") || tokenClaims().p,
    "Codex",
  );
}

function sessionId(input) {
  const prefix = sanitizeId(firstEnv("HONCHO_SESSION_PREFIX"), "codex");
  return sanitizeId(`${prefix}_${input.session_id || "session"}`, "codex_session");
}

function hookStatePath() {
  const pluginData = firstEnv("PLUGIN_DATA");
  if (pluginData) {
    return join(pluginData, "hook-state.json");
  }

  const codexHome = firstEnv("CODEX_HOME");
  if (codexHome) {
    return join(codexHome, "honcho", "hook-state.json");
  }

  return join(homedir(), ".codex", "honcho", "hook-state.json");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function readStdinJson() {
  let raw = "";
  for await (const chunk of process.stdin) {
    raw += chunk;
  }

  if (!raw.trim()) {
    return {};
  }

  return JSON.parse(raw);
}

async function loadState() {
  try {
    return JSON.parse(await readFile(hookStatePath(), "utf8"));
  } catch {
    return { sent: {} };
  }
}

async function saveState(state) {
  const path = hookStatePath();
  const entries = Object.entries(state.sent || {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, STATE_LIMIT);
  const next = { sent: Object.fromEntries(entries) };

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(next, null, 2)}\n`, "utf8");
}

async function hasBeenSent(key) {
  const state = await loadState();
  return Boolean(state.sent?.[key]);
}

async function markSent(key) {
  const state = await loadState();
  state.sent ||= {};
  state.sent[key] = Date.now();
  await saveState(state);
}

async function requestJson(method, path, body, options = {}) {
  const authorization = authHeader();
  if (!authorization) {
    throw new Error("Honcho auth token is not configured");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(apiUrl(path), {
      method,
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    if (response.status === 204) {
      return null;
    }

    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (!response.ok) {
      const detail = data?.detail || data?.message || response.statusText;
      throw new Error(`Honcho ${method} ${path} failed with ${response.status}: ${detail}`);
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

async function ensureConversation(input) {
  const workspace = workspaceId();
  const user = userPeerId();
  const assistant = assistantPeerId();
  const session = sessionId(input);
  const singlePeerMode = user === assistant;

  await requestJson("POST", "/workspaces", {
    id: workspace,
    metadata: {
      source: "codex",
      integration: "honcho-codex-hook",
    },
  });

  await requestJson("POST", `/${encodeURIComponent("workspaces")}/${encodeURIComponent(workspace)}/peers`, {
    id: user,
    metadata: {
      role: "user",
      source: "codex",
    },
  });

  if (!singlePeerMode) {
    await requestJson("POST", `/${encodeURIComponent("workspaces")}/${encodeURIComponent(workspace)}/peers`, {
      id: assistant,
      metadata: {
        role: "assistant",
        source: "codex",
      },
    });
  }

  await requestJson("POST", `/workspaces/${encodeURIComponent(workspace)}/sessions`, {
    id: session,
    metadata: {
      source: "codex",
      codex_session_id: input.session_id || null,
      cwd: input.cwd || null,
    },
  });

  const peerConfig = {
    [user]: {
      observe_me: true,
      observe_others: true,
    },
  };

  if (!singlePeerMode) {
    peerConfig[assistant] = {
      observe_me: false,
      observe_others: true,
    };
  }

  await requestJson(
    "POST",
    `/workspaces/${encodeURIComponent(workspace)}/sessions/${encodeURIComponent(session)}/peers`,
    peerConfig,
  );

  return { workspace, user, assistant, session, singlePeerMode };
}

function eventMessage(input) {
  if (input.hook_event_name === "UserPromptSubmit") {
    return {
      role: "user",
      peer: userPeerId(),
      content: input.prompt || input.user_prompt || "",
    };
  }

  if (input.hook_event_name === "Stop") {
    return {
      role: "assistant",
      peer: assistantPeerId(),
      content:
        input.last_assistant_message ||
        input.response ||
        input.assistant_message ||
        input.message ||
        "",
    };
  }

  return null;
}

async function addMessage(input, conversation, message) {
  const content = String(message.content || "").trim();
  if (!content) {
    return false;
  }

  if (message.role === "assistant" && conversation.singlePeerMode) {
    return false;
  }

  const key = [
    conversation.session,
    input.turn_id || "no-turn",
    message.role,
    sha256(content),
  ].join(":");

  if (await hasBeenSent(key)) {
    return false;
  }

  await requestJson(
    "POST",
    `/workspaces/${encodeURIComponent(conversation.workspace)}/sessions/${encodeURIComponent(conversation.session)}/messages`,
    {
      messages: [
        {
          peer_id: message.peer,
          content,
          metadata: {
            source: "codex",
            role: message.role,
            hook_event_name: input.hook_event_name || null,
            codex_session_id: input.session_id || null,
            codex_turn_id: input.turn_id || null,
            model: input.model || null,
            cwd: input.cwd || null,
          },
        },
      ],
    },
  );

  await markSent(key);
  return true;
}

function shouldUseContext(content) {
  const value = String(content || "").trim();
  return value.length > 0 && firstEnv("HONCHO_CODEX_CONTEXT", "HONCHO_USE_CONTEXT") !== "false";
}

function normalizeContext(content) {
  const value = String(content || "").trim();
  if (!value) {
    return "";
  }

  const lowInformation = [
    "i don't know",
    "i do not know",
    "no relevant",
    "nothing relevant",
    "not enough information",
    "insufficient information",
  ];
  const lowered = value.toLowerCase();
  if (lowInformation.some((marker) => lowered.includes(marker)) && value.length < 240) {
    return "";
  }

  return value.slice(0, MAX_ADDITIONAL_CONTEXT_CHARS);
}

async function queryContext(input, conversation, prompt) {
  if (!shouldUseContext(prompt)) {
    return "";
  }

  const clippedPrompt = String(prompt).slice(0, MAX_CONTEXT_PROMPT_CHARS);

  if (conversation.singlePeerMode) {
    const result = await requestJson(
      "POST",
      `/workspaces/${encodeURIComponent(conversation.workspace)}/peers/${encodeURIComponent(conversation.user)}/representation`,
      {
        session_id: conversation.session,
        search_query: clippedPrompt,
        search_top_k: 10,
        max_conclusions: 12,
      },
    );

    return normalizeContext(result?.representation || "");
  }

  const result = await requestJson(
    "POST",
    `/workspaces/${encodeURIComponent(conversation.workspace)}/peers/${encodeURIComponent(conversation.user)}/chat`,
    {
      query:
        "What durable context about this user is relevant to the current Codex prompt? " +
        "Prefer stable goals, preferences, technical context, and prior decisions. " +
        "Be concise and only include grounded information.\n\nCurrent prompt:\n" +
        clippedPrompt,
      session_id: conversation.session,
      target: conversation.assistant,
      stream: false,
      reasoning_level: "low",
    },
  );

  return normalizeContext(result?.content || "");
}

function successOutput(additionalContext = "") {
  if (additionalContext) {
    return {
      continue: true,
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: `Relevant Honcho memory for this user:\n${additionalContext}`,
      },
    };
  }

  return { continue: true };
}

function errorOutput(error) {
  const message = error?.name === "AbortError" ? "Honcho request timed out" : error?.message;
  return {
    continue: true,
    systemMessage: `Honcho memory hook skipped capture: ${message || "unknown error"}`,
  };
}

async function handleHook(input) {
  if (!["UserPromptSubmit", "Stop"].includes(input.hook_event_name)) {
    return successOutput();
  }

  const message = eventMessage(input);
  if (!message?.content) {
    return successOutput();
  }

  const conversation = await ensureConversation(input);
  await addMessage(input, conversation, message);

  if (input.hook_event_name === "UserPromptSubmit") {
    try {
      const context = await queryContext(input, conversation, message.content);
      return successOutput(context);
    } catch (error) {
      return {
        continue: true,
        systemMessage: `Honcho memory captured the prompt, but context lookup was skipped: ${
          error?.message || "unknown error"
        }`,
      };
    }
  }

  return successOutput();
}

async function runHook() {
  try {
    const input = await readStdinJson();
    const output = await handleHook(input);
    process.stdout.write(`${JSON.stringify(output)}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify(errorOutput(error))}\n`);
  }
}

async function runSelfTest() {
  const { createServer } = await import("node:http");
  const requests = [];
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      requests.push({
        method: req.method,
        url: req.url,
        body: body ? JSON.parse(body) : null,
        authorization: req.headers.authorization ? "present" : "missing",
      });

      if (req.url.endsWith("/representation")) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ representation: "Scoped representation context." }));
        return;
      }

      if (req.url.endsWith("/chat")) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ content: "The user prefers concise engineering updates." }));
        return;
      }

      if (req.url.endsWith("/config")) {
        res.writeHead(204);
        res.end();
        return;
      }

      res.writeHead(req.url.endsWith("/messages") ? 201 : 200, {
        "Content-Type": "application/json",
      });
      res.end(JSON.stringify({ id: "ok", workspace_id: "codex" }));
    });
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  env.HONCHO_CODEX = "self-test-token";
  env.HONCHO_CODEX_URL = `http://127.0.0.1:${address.port}`;
  env.HONCHO_API_URL = "";
  env.HONCHO_BASE_URL = "";
  env.HONCHO_URL = "";
  env.HONCHO_WORKSPACE_ID = "codex";
  env.HONCHO_USER_NAME = "SelfTestUser";
  env.HONCHO_ASSISTANT_NAME = "Codex";
  env.PLUGIN_DATA = join(tmpdir(), `honcho-hook-self-test-${Date.now()}`);

  const input = {
    hook_event_name: "UserPromptSubmit",
    session_id: "self-test-session",
    turn_id: `turn-${Date.now()}`,
    cwd: process.cwd(),
    model: "self-test",
    prompt: "Please remember that I prefer concise engineering updates.",
  };

  const output = await handleHook(input);
  env.HONCHO_ASSISTANT_NAME = "SelfTestUser";
  env.PLUGIN_DATA = join(tmpdir(), `honcho-hook-self-test-single-${Date.now()}`);

  const singlePeerOutput = await handleHook({
    ...input,
    session_id: "self-test-single-session",
    turn_id: `single-turn-${Date.now()}`,
  });
  await new Promise((resolve) => server.close(resolve));

  const messageRequests = requests.filter((request) => request.url.endsWith("/messages"));
  const chatRequests = requests.filter((request) => request.url.endsWith("/chat"));
  const representationRequests = requests.filter((request) => request.url.endsWith("/representation"));
  const peerAddRequests = requests.filter((request) => request.url.endsWith("/peers"));

  const passed =
    messageRequests.length === 2 &&
    chatRequests.length === 1 &&
    representationRequests.length === 1 &&
    peerAddRequests.some((request) => request.body?.SelfTestUser?.observe_me === true) &&
    peerAddRequests.some((request) => request.body?.Codex?.observe_me === false) &&
    output?.hookSpecificOutput?.additionalContext?.includes("Honcho memory") &&
    singlePeerOutput?.hookSpecificOutput?.additionalContext?.includes("Scoped representation context");

  process.stdout.write(
    `${JSON.stringify(
      {
        passed,
        requests: requests.map(({ method, url, authorization, body }) => ({
          method,
          url,
          authorization,
          peerIds: body && typeof body === "object" ? Object.keys(body).slice(0, 4) : [],
        })),
      },
      null,
      2,
    )}\n`,
  );

  process.exitCode = passed ? 0 : 1;
}

if (process.argv.includes("--self-test")) {
  await runSelfTest();
} else {
  await runHook();
}
