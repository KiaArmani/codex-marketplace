#!/usr/bin/env node
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CACHE_VERSION = 1;
const METADATA_PROJECT_NAME = "priogrid";
const PROJECT_MARKER = "priogrid-project";
const CHUNK_MARKER = "priogrid-chunk";
const VALID_STATUSES = new Set(["active", "parked", "waiting", "someday", "maintenance"]);
const VALID_AREAS = new Set(["commercial", "creative", "life", "work", "exploration", "other"]);
const VALID_ENERGY = new Set(["deep-work", "creative", "admin", "errands", "low-energy", "social", "any"]);

export async function main(argv = process.argv.slice(2), env = process.env) {
  const args = parseArgs(argv);
  const command = args.command ?? "help";

  if (command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  const cacheFile = cachePath(env);

  if (command === "doctor" && !env.TODOIST_API_TOKEN && !env.PRIOGRID_MOCK_TODOIST_FILE) {
    await doctor(undefined, cacheFile, env);
    return;
  }

  const client = createTodoistClient(env);

  switch (command) {
    case "doctor":
      await doctor(client, cacheFile, env);
      return;
    case "sync":
      await readFresh(client, cacheFile, { write: false, print: true });
      return;
    case "sync-all":
      await syncAll(client, cacheFile);
      return;
    case "review":
      console.log(renderProjectReview(await readFresh(client, cacheFile, { write: false })));
      return;
    case "list-projects":
      console.log(renderProjectList(await readFresh(client, cacheFile, { write: false })));
      return;
    case "today":
      console.log(renderDueReport(await readFresh(client, cacheFile, { write: false }), numberFlag(args, "days") ?? 2));
      return;
    case "propose-week":
      await proposeWeekCommand(client, cacheFile, args);
      return;
    case "print-week":
      await printWeekCommand(client, cacheFile);
      return;
    case "set-project-status":
      await setProjectStatusCommand(client, cacheFile, args);
      return;
    case "add-project":
      await addProjectCommand(client, cacheFile, args);
      return;
    case "add-chunk":
      await addChunkCommand(client, cacheFile, args);
      return;
    case "schedule-chunk":
      await scheduleChunkCommand(client, cacheFile, args);
      return;
    case "export-todoist":
      await exportTodoistCommand(client, cacheFile, args);
      return;
    case "migrate":
      await migrateCommand(client, cacheFile, args);
      return;
    default:
      throw new Error(`Unknown priogrid command: ${command}. Run priogrid help.`);
  }
}

function createTodoistClient(env) {
  if (env.PRIOGRID_MOCK_TODOIST_FILE) {
    return new MockTodoistClient(env.PRIOGRID_MOCK_TODOIST_FILE);
  }

  if (!env.TODOIST_API_TOKEN) {
    throw new Error("TODOIST_API_TOKEN is required.");
  }

  return new TodoistApiClient({
    token: env.TODOIST_API_TOKEN,
    baseUrl: env.TODOIST_API_BASE_URL ?? "https://api.todoist.com/api/v1"
  });
}

class TodoistApiClient {
  constructor({ token, baseUrl }) {
    this.token = token;
    this.baseUrl = baseUrl;
  }

  async listProjects() {
    return this.fetchAll("/projects");
  }

  async listTasks() {
    const tasks = await this.fetchAll("/tasks");
    return tasks.map(normalizeTask);
  }

  async createProject(name) {
    const response = await this.request("/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name })
    });
    return response.json();
  }

  async createTask(payload) {
    const response = await this.request("/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    return normalizeTask(await response.json());
  }

  async updateTask(taskId, patch) {
    await this.request(`/tasks/${encodeURIComponent(taskId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    });
  }

  async fetchAll(pathname) {
    const all = [];
    let cursor;
    do {
      const params = new URLSearchParams({ limit: "200" });
      if (cursor) params.set("cursor", cursor);
      const response = await this.request(`${pathname}?${params.toString()}`);
      const page = await response.json();
      if (Array.isArray(page)) {
        all.push(...page);
        cursor = undefined;
      } else {
        all.push(...(page.results ?? []));
        cursor = page.next_cursor ?? undefined;
      }
    } while (cursor);
    return all;
  }

  async request(pathname, init = {}) {
    const response = await fetch(`${this.baseUrl}${pathname}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.token}`,
        ...init.headers
      }
    });
    if (!response.ok) {
      throw new Error(`Todoist API ${response.status}: ${await response.text()}`);
    }
    return response;
  }
}

class MockTodoistClient {
  constructor(file) {
    this.file = file;
  }

  async read() {
    const raw = await fs.readFile(this.file, "utf8");
    const data = JSON.parse(raw);
    data.projects ??= [];
    data.tasks ??= [];
    return data;
  }

  async write(data) {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    await fs.writeFile(this.file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  }

  async listProjects() {
    return (await this.read()).projects;
  }

  async listTasks() {
    return (await this.read()).tasks.map(normalizeTask);
  }

  async createProject(name) {
    const data = await this.read();
    const project = { id: `mock-project-${data.projects.length + 1}`, name };
    data.projects.push(project);
    await this.write(data);
    return project;
  }

  async createTask(payload) {
    const data = await this.read();
    const task = normalizeTask({
      id: `mock-task-${data.tasks.length + 1}`,
      project_id: payload.project_id,
      content: payload.content,
      description: payload.description ?? "",
      labels: payload.labels ?? [],
      due: dueFromPatch(payload),
      duration: durationFromPatch(payload),
      checked: false,
      is_deleted: false
    });
    data.tasks.push(task);
    await this.write(data);
    return task;
  }

  async updateTask(taskId, patch) {
    const data = await this.read();
    const task = data.tasks.find((candidate) => candidate.id === taskId);
    if (!task) throw new Error(`Mock Todoist task not found: ${taskId}`);
    if (patch.content !== undefined) task.content = patch.content;
    if (patch.description !== undefined) task.description = patch.description;
    if (patch.project_id !== undefined) task.project_id = patch.project_id;
    if (patch.labels !== undefined) task.labels = patch.labels;
    if (patch.due_date !== undefined || patch.due_string !== undefined) task.due = dueFromPatch(patch);
    if (patch.duration !== undefined || patch.duration_unit !== undefined) task.duration = durationFromPatch(patch);
    await this.write(data);
  }
}

async function readFresh(client, cacheFile, options = {}) {
  const snapshot = await loadSnapshot(client);
  let store = buildStoreFromTodoist(snapshot);
  if (options.write) {
    await writeCanonical(client, store);
    store = buildStoreFromTodoist(await loadSnapshot(client));
  }
  await saveCache(cacheFile, store);
  if (options.print) {
    console.log(`Synced ${store.projects.length} planning project(s), ${store.tasks.length} Todoist task(s), ${store.chunks.length} chunk(s).`);
    console.log(`Cache: ${cacheFile}`);
  }
  return store;
}

async function syncAll(client, cacheFile) {
  const store = await readFresh(client, cacheFile, { write: true });
  console.log(`Synced priogrid to Todoist. Projects: ${store.projects.length}; tasks: ${store.tasks.length}; chunks: ${store.chunks.length}.`);
}

async function loadSnapshot(client) {
  const [projects, tasks] = await Promise.all([client.listProjects(), client.listTasks()]);
  return { projects, tasks };
}

function buildStoreFromTodoist(snapshot) {
  const now = new Date().toISOString();
  const metadataProject = findMetadataProject(snapshot.projects);
  const metadataTasks = metadataProject
    ? snapshot.tasks.filter((task) => task.project_id === metadataProject.id)
    : [];
  const metadata = new Map();
  for (const task of metadataTasks) {
    const parsed = parseProjectMetadata(task.description ?? "");
    if (parsed?.id) metadata.set(parsed.id, { ...parsed, metadata_task_id: task.id });
  }

  const projects = [];
  for (const project of snapshot.projects) {
    if (project.id === metadataProject?.id || project.is_archived || project.is_deleted) continue;
    const existing = metadata.get(project.id);
    projects.push({
      id: project.id,
      source_project_id: project.id,
      origin: "todoist",
      name: project.name,
      status: coerceStatus(existing?.status, "parked"),
      area: coerceArea(existing?.area, defaultProjectMetadata(project).area),
      why_it_matters: existing?.why_it_matters ?? defaultProjectMetadata(project).why_it_matters,
      current_outcome: existing?.current_outcome ?? defaultProjectMetadata(project).current_outcome,
      next_milestone: existing?.next_milestone ?? defaultProjectMetadata(project).next_milestone,
      energy_type: coerceEnergy(existing?.energy_type, defaultProjectMetadata(project).energy_type),
      weekly_budget_minutes: positiveNumber(existing?.weekly_budget_minutes, defaultProjectMetadata(project).weekly_budget_minutes),
      updated_at: existing?.updated_at ?? now,
      metadata_task_id: existing?.metadata_task_id
    });
  }
  for (const [id, existing] of metadata.entries()) {
    if (!id.startsWith("local:")) continue;
    projects.push({
      id,
      source_project_id: id,
      origin: "local",
      name: existing.name,
      status: coerceStatus(existing.status, "parked"),
      area: coerceArea(existing.area, "other"),
      why_it_matters: existing.why_it_matters ?? "",
      current_outcome: existing.current_outcome ?? "",
      next_milestone: existing.next_milestone ?? "",
      energy_type: coerceEnergy(existing.energy_type, "any"),
      weekly_budget_minutes: positiveNumber(existing.weekly_budget_minutes, 90),
      updated_at: existing.updated_at ?? now,
      metadata_task_id: existing.metadata_task_id
    });
  }

  const projectIds = new Set(projects.map((project) => project.id));
  const tasks = snapshot.tasks
    .filter((task) => !task.checked && !task.is_deleted)
    .filter((task) => task.project_id !== metadataProject?.id)
    .map(normalizeTask);
  const chunks = [];
  for (const task of tasks) {
    const marker = parseChunkMetadata(task.description ?? "");
    const projectId = marker?.priogrid_project_id && projectIds.has(marker.priogrid_project_id)
      ? marker.priogrid_project_id
      : task.project_id;
    const project = projects.find((candidate) => candidate.id === projectId);
    if (!project) continue;
    chunks.push(chunkFromTask(task, project, marker, now));
  }

  return {
    version: CACHE_VERSION,
    source: "todoist",
    last_synced_at: now,
    projects,
    tasks,
    chunks
  };
}

async function writeCanonical(client, store, options = {}) {
  const snapshot = await loadSnapshot(client);
  const metadataProject = await ensureMetadataProject(client, snapshot.projects);
  const refreshedTasks = await client.listTasks();
  const metadataTasks = refreshedTasks.filter((task) => task.project_id === metadataProject.id);
  const metadataByProjectId = new Map();
  for (const task of metadataTasks) {
    const parsed = parseProjectMetadata(task.description ?? "");
    if (parsed?.id) metadataByProjectId.set(parsed.id, task);
  }

  for (const project of store.projects) {
    if (project.id === metadataProject.id) continue;
    const payload = metadataTaskPayload(project, metadataProject.id);
    const existing = metadataByProjectId.get(project.id);
    if (existing) {
      const patch = diffTask(existing, payload);
      if (Object.keys(patch).length > 0) await client.updateTask(existing.id, patch);
    } else {
      await client.createTask(payload);
    }
  }

  const latestSnapshot = await loadSnapshot(client);
  const latestStore = buildStoreFromTodoist(latestSnapshot);
  const tasksBySource = new Map(latestStore.tasks.map((task) => [task.id, task]));
  const markerByChunkId = new Map();
  for (const task of latestStore.tasks) {
    const marker = parseChunkMetadata(task.description ?? "");
    if (marker?.priogrid_chunk_id) markerByChunkId.set(marker.priogrid_chunk_id, task);
  }

  for (const chunk of store.chunks) {
    const project = store.projects.find((candidate) => candidate.id === chunk.project_id);
    if (!project) continue;

    const markerTask = markerByChunkId.get(chunk.id);
    if (markerTask && !chunk.source_task_id) chunk.source_task_id = markerTask.id;

    if (!chunk.source_task_id) {
      const target = findTargetTodoistProject(latestStore, project);
      if (!target) continue;
      const payload = chunkTaskPayload(chunk, project, target);
      await client.createTask(payload);
      continue;
    }

    const existing = tasksBySource.get(chunk.source_task_id);
    if (!existing) continue;
    const marker = parseChunkMetadata(existing.description ?? "");
    const shouldUpdate = Boolean(marker?.priogrid_chunk_id) || options.dirtyChunkIds?.has(chunk.id);
    if (!shouldUpdate) continue;
    const patch = diffTask(existing, chunkTaskPayload(chunk, project, { source_project_id: existing.project_id }));
    if (Object.keys(patch).length > 0) await client.updateTask(existing.id, patch);
  }
}

async function doctor(client, cacheFile, env) {
  const lines = ["# priogrid Doctor", ""];
  lines.push(env.TODOIST_API_TOKEN || env.PRIOGRID_MOCK_TODOIST_FILE ? "- Todoist access: configured" : "- Todoist access: missing TODOIST_API_TOKEN");
  if (!client) {
    lines.push(`- Cache file: ${cacheFile}`);
    console.log(lines.join("\n"));
    return;
  }
  try {
    const snapshot = await loadSnapshot(client);
    const metadataProject = findMetadataProject(snapshot.projects);
    lines.push(metadataProject ? `- Metadata project: found (${metadataProject.name})` : "- Metadata project: missing; sync-all will create it");
    const markers = new Map();
    for (const task of snapshot.tasks) {
      const marker = parseChunkMetadata(task.description ?? "");
      if (!marker?.priogrid_chunk_id) continue;
      markers.set(marker.priogrid_chunk_id, (markers.get(marker.priogrid_chunk_id) ?? 0) + 1);
    }
    const duplicates = [...markers.entries()].filter(([, count]) => count > 1);
    lines.push(duplicates.length ? `- Duplicate chunk markers: ${duplicates.length}` : "- Duplicate chunk markers: none");
    lines.push(`- Projects visible: ${snapshot.projects.length}`);
    lines.push(`- Tasks visible: ${snapshot.tasks.length}`);
    lines.push(`- Cache file: ${cacheFile}`);
  } catch (error) {
    lines.push(`- Todoist check failed: ${error.message}`);
  }
  console.log(lines.join("\n"));
}

async function setProjectStatusCommand(client, cacheFile, args) {
  const selector = args.positionals[0];
  const status = args.positionals[1];
  if (!selector || !VALID_STATUSES.has(status)) throw new Error("Usage: set-project-status <project|all> <active|parked|waiting|someday|maintenance>");
  const store = await readFresh(client, cacheFile);
  const targets = selector === "all" || selector === "*"
    ? store.projects.filter((project) => !matchesAny(project, splitList(stringFlag(args, "except"))))
    : [findProject(store, selector)];
  for (const project of targets) {
    project.status = status;
    applyProjectFlags(project, args);
    project.updated_at = new Date().toISOString();
  }
  await writeCanonical(client, store);
  const refreshed = await readFresh(client, cacheFile);
  console.log(`Updated ${targets.length} project(s) to ${status}.\n`);
  console.log(renderProjectReview(refreshed));
}

async function addProjectCommand(client, cacheFile, args) {
  const name = stringFlag(args, "name") ?? args.positionals.join(" ");
  if (!name) throw new Error("Usage: add-project --name <name> [--status parked] [--area other] [--energy any] [--budget 90]");
  const store = await readFresh(client, cacheFile);
  if (store.projects.some((project) => project.name.toLowerCase() === name.toLowerCase())) throw new Error(`Project already exists: ${name}`);
  const status = coerceStatus(stringFlag(args, "status"), "parked");
  const area = coerceArea(stringFlag(args, "area"), "other");
  const energy = coerceEnergy(stringFlag(args, "energy"), "any");
  const now = new Date().toISOString();
  store.projects.push({
    id: `local:${slugify(name)}`,
    source_project_id: `local:${slugify(name)}`,
    origin: "local",
    name,
    status,
    area,
    why_it_matters: stringFlag(args, "why") ?? "",
    current_outcome: stringFlag(args, "outcome") ?? "",
    next_milestone: stringFlag(args, "milestone") ?? "",
    energy_type: energy,
    weekly_budget_minutes: numberFlag(args, "budget") ?? 90,
    updated_at: now
  });
  await writeCanonical(client, store);
  console.log(renderProjectReview(await readFresh(client, cacheFile)));
}

async function addChunkCommand(client, cacheFile, args) {
  const store = await readFresh(client, cacheFile);
  const project = findProject(store, stringFlag(args, "project") ?? "");
  const title = stringFlag(args, "title") ?? args.positionals.join(" ");
  if (!title) throw new Error("Usage: add-chunk --project <project> --title <title>");
  const now = new Date().toISOString();
  const chunk = {
    id: `chunk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    clear_done_state: stringFlag(args, "done") ?? "The chunk has a clear stopping point.",
    estimated_minutes: numberFlag(args, "minutes") ?? 45,
    energy_type: coerceEnergy(stringFlag(args, "energy"), project.energy_type),
    project_id: project.id,
    scheduled_date: stringFlag(args, "date"),
    scheduled_start_time: stringFlag(args, "time"),
    status: stringFlag(args, "date") ? "scheduled" : "proposed",
    created_at: now,
    updated_at: now
  };
  store.chunks.push(chunk);
  await writeCanonical(client, store);
  console.log(`Added chunk and wrote it to Todoist: ${title}`);
}

async function scheduleChunkCommand(client, cacheFile, args) {
  const id = args.positionals[0];
  const date = stringFlag(args, "date");
  if (!id || !date) throw new Error("Usage: schedule-chunk <chunk-id> --date YYYY-MM-DD [--time HH:MM]");
  const store = await readFresh(client, cacheFile);
  const chunk = store.chunks.find((candidate) => candidate.id === id || candidate.source_task_id === id);
  if (!chunk) throw new Error(`No chunk found: ${id}`);
  chunk.scheduled_date = date;
  chunk.scheduled_start_time = stringFlag(args, "time");
  chunk.status = "scheduled";
  chunk.updated_at = new Date().toISOString();
  await writeCanonical(client, store, { dirtyChunkIds: new Set([chunk.id]) });
  console.log(`Scheduled ${chunk.title} for ${date}${chunk.scheduled_start_time ? ` ${chunk.scheduled_start_time}` : ""}.`);
}

async function proposeWeekCommand(client, cacheFile, args) {
  const capacity = numberFlag(args, "capacity");
  if (!capacity) throw new Error("Usage: propose-week --capacity <minutes>");
  const store = await readFresh(client, cacheFile);
  store.weekly_plan = proposeWeeklyPlan(store, capacity);
  await saveCache(cacheFile, store);
  console.log(renderWeeklyPlan(store, store.weekly_plan));
}

async function printWeekCommand(client, cacheFile) {
  const store = await loadCache(cacheFile);
  if (!store.weekly_plan) throw new Error("No cached weekly plan. Run propose-week first.");
  console.log(renderWeeklyPlan(store, store.weekly_plan));
}

async function exportTodoistCommand(client, cacheFile, args) {
  const store = await readFresh(client, cacheFile);
  const changes = buildExportPreview(store);
  if (args.flags.has("write")) {
    await writeCanonical(client, store);
    console.log(`Wrote priogrid metadata and ${changes.length} exportable chunk/task change(s) to Todoist.`);
  } else {
    console.log(renderExportPreview(changes));
  }
}

async function migrateCommand(client, cacheFile, args) {
  const from = stringFlag(args, "from");
  if (!from) throw new Error("Usage: migrate --from /path/to/planner-store.json");
  const oldStore = JSON.parse(await fs.readFile(from, "utf8"));
  const fresh = await readFresh(client, cacheFile);
  const merged = {
    ...fresh,
    projects: mergeById(fresh.projects, oldStore.projects ?? []),
    chunks: mergeById(fresh.chunks, oldStore.chunks ?? [])
  };
  await writeCanonical(client, merged);
  const refreshed = await readFresh(client, cacheFile);
  console.log(`Migrated ${oldStore.projects?.length ?? 0} project(s) and ${oldStore.chunks?.length ?? 0} chunk(s) into Todoist-backed priogrid.`);
  console.log(renderProjectReview(refreshed));
}

function metadataTaskPayload(project, metadataProjectId) {
  return {
    content: `priogrid Project: ${project.name}`,
    project_id: metadataProjectId,
    labels: ["priogrid", "planner-metadata", project.status],
    description: serializeProjectMetadata(project)
  };
}

function chunkTaskPayload(chunk, project, targetProject) {
  const payload = {
    content: chunk.title,
    project_id: targetProject.source_project_id,
    labels: labelsForChunk(project, chunk),
    description: serializeChunkDescription(chunk, project)
  };
  if (chunk.scheduled_date && chunk.scheduled_start_time) payload.due_string = `${chunk.scheduled_date} ${chunk.scheduled_start_time}`;
  else if (chunk.scheduled_date) payload.due_date = chunk.scheduled_date;
  if (chunk.estimated_minutes > 0) {
    payload.duration = chunk.estimated_minutes;
    payload.duration_unit = "minute";
  }
  return payload;
}

function serializeProjectMetadata(project) {
  const data = {
    id: project.id,
    source_project_id: project.source_project_id,
    origin: project.origin,
    name: project.name,
    status: project.status,
    area: project.area,
    why_it_matters: project.why_it_matters,
    current_outcome: project.current_outcome,
    next_milestone: project.next_milestone,
    energy_type: project.energy_type,
    weekly_budget_minutes: project.weekly_budget_minutes,
    updated_at: project.updated_at
  };
  return markerBlock(PROJECT_MARKER, data);
}

function serializeChunkDescription(chunk, project) {
  return [
    markerBlock(CHUNK_MARKER, {
      priogrid_chunk_id: chunk.id,
      priogrid_project_id: project.id
    }),
    `Planner project: ${project.name}`,
    `Done when: ${chunk.clear_done_state}`
  ].join("\n");
}

function markerBlock(name, data) {
  return `<!-- ${name}\n${JSON.stringify(data, null, 2)}\n-->`;
}

function parseProjectMetadata(description) {
  return parseMarker(description, PROJECT_MARKER);
}

function parseChunkMetadata(description) {
  return parseMarker(description, CHUNK_MARKER);
}

function parseMarker(description, name) {
  const match = description.match(new RegExp(`<!--\\s*${name}\\s*([\\s\\S]*?)\\s*-->`));
  if (!match) return undefined;
  try {
    return JSON.parse(match[1]);
  } catch {
    return undefined;
  }
}

function chunkFromTask(task, project, marker, now) {
  const due = normalizeDue(task.due?.date ?? task.due?.datetime);
  return {
    id: marker?.priogrid_chunk_id ?? `task-${task.id}`,
    source_task_id: task.id,
    title: task.content,
    clear_done_state: clearDoneState(task),
    estimated_minutes: estimateTaskMinutes(task),
    energy_type: inferEnergyType(task, project.energy_type),
    project_id: marker?.priogrid_project_id ?? task.project_id,
    scheduled_date: due?.date,
    scheduled_start_time: due?.time,
    status: due ? "scheduled" : "proposed",
    created_at: now,
    updated_at: now
  };
}

function buildExportPreview(store) {
  return store.chunks
    .filter((chunk) => !chunk.source_task_id || chunk.status === "scheduled")
    .map((chunk) => {
      const project = store.projects.find((candidate) => candidate.id === chunk.project_id);
      return { chunk: chunk.title, project: project?.name ?? chunk.project_id, operation: chunk.source_task_id ? "update" : "create" };
    });
}

function renderExportPreview(changes) {
  return ["# priogrid Todoist Export Dry Run", "", changes.length ? changes.map((change) => `- ${change.operation}: **${change.chunk}** (${change.project})`).join("\n") : "- No exportable changes."].join("\n");
}

function proposeWeeklyPlan(store, capacityMinutes) {
  const active = store.projects.filter((project) => project.status === "active").slice(0, 2);
  const maintenance = store.projects.filter((project) => project.status === "maintenance").slice(0, 1);
  const included = [...active, ...maintenance];
  const includedIds = new Set(included.map((project) => project.id));
  const budgets = new Map(included.map((project) => [project.id, project.weekly_budget_minutes || capacityMinutes]));
  const chosen = [];
  let remaining = capacityMinutes;
  const candidates = store.chunks
    .filter((chunk) => includedIds.has(chunk.project_id))
    .filter((chunk) => chunk.status === "proposed" || chunk.status === "scheduled")
    .sort((left, right) => (left.status === "scheduled" ? -1 : 0) - (right.status === "scheduled" ? -1 : 0) || left.estimated_minutes - right.estimated_minutes);
  for (const chunk of candidates) {
    const budget = budgets.get(chunk.project_id) ?? capacityMinutes;
    if (chunk.estimated_minutes > remaining || chunk.estimated_minutes > budget) continue;
    chosen.push(chunk.id);
    remaining -= chunk.estimated_minutes;
    budgets.set(chunk.project_id, budget - chunk.estimated_minutes);
  }
  return {
    id: `week-${new Date().toISOString().slice(0, 10)}`,
    generated_at: new Date().toISOString(),
    capacity_minutes: capacityMinutes,
    included_project_ids: included.map((project) => project.id),
    chunk_ids: chosen,
    intentionally_parked_project_ids: store.projects.filter((project) => ["parked", "waiting", "someday"].includes(project.status)).map((project) => project.id),
    excluded_active_project_ids: store.projects.filter((project) => project.status === "active" && !includedIds.has(project.id)).map((project) => project.id),
    warnings: candidates.length > chosen.length ? [`${candidates.length - chosen.length} chunk(s) stayed out because of capacity or project budgets.`] : []
  };
}

function renderProjectList(store) {
  return table(["Project", "Origin", "Status", "Area", "Energy", "Budget"], store.projects.map((project) => [
    project.name,
    project.origin,
    project.status,
    project.area,
    project.energy_type,
    `${project.weekly_budget_minutes}m`
  ]));
}

function renderProjectReview(store) {
  return ["# Project Review", "", table(["Project", "Origin", "Status", "Area", "Budget", "Current outcome", "Next milestone"], store.projects.map((project) => [
    project.name,
    project.origin,
    project.status,
    project.area,
    `${project.weekly_budget_minutes}m`,
    project.current_outcome || "-",
    project.next_milestone || "-"
  ]))].join("\n");
}

function renderDueReport(store, days) {
  const start = todayIso();
  const end = addDays(start, days - 1);
  const rows = store.tasks
    .filter((task) => {
      const due = normalizeDue(task.due?.date ?? task.due?.datetime);
      return due && due.date >= start && due.date <= end;
    })
    .sort((left, right) => dueSortKey(left).localeCompare(dueSortKey(right)))
    .map((task) => {
      const project = store.projects.find((candidate) => candidate.source_project_id === task.project_id);
      const due = normalizeDue(task.due?.date ?? task.due?.datetime);
      return [due.date, due.time ?? "", project?.name ?? task.project_id, task.content, (task.labels ?? []).join(",")];
    });
  return [`# Due ${start} to ${end}`, "", rows.length ? table(["Date", "Time", "Project", "Task", "Labels"], rows) : "No tasks due."].join("\n");
}

function renderWeeklyPlan(store, plan) {
  const chunks = new Map(store.chunks.map((chunk) => [chunk.id, chunk]));
  const projects = new Map(store.projects.map((project) => [project.id, project]));
  const lines = ["# Weekly Plan", "", `Capacity: ${plan.capacity_minutes}m`, ""];
  if (plan.warnings.length) lines.push("## Notes", ...plan.warnings.map((warning) => `- ${warning}`), "");
  lines.push("## Commitments", "");
  for (const id of plan.included_project_ids) {
    const project = projects.get(id);
    if (project) lines.push(`- **${project.name}** (${project.status}): ${project.current_outcome || "No outcome recorded."}`);
  }
  lines.push("", "## Chunks", "");
  for (const id of plan.chunk_ids) {
    const chunk = chunks.get(id);
    const project = chunk ? projects.get(chunk.project_id) : undefined;
    if (chunk) lines.push(`- [ ] **${project?.name ?? chunk.project_id}**: ${chunk.title} (${chunk.estimated_minutes}m${chunk.scheduled_date ? `, ${chunk.scheduled_date}${chunk.scheduled_start_time ? ` ${chunk.scheduled_start_time}` : ""}` : ""})`);
  }
  lines.push("", "## Intentionally Parked", "");
  for (const id of plan.intentionally_parked_project_ids) {
    const project = projects.get(id);
    if (project) lines.push(`- **${project.name}** (${project.status}): ${project.next_milestone || "No next milestone recorded."}`);
  }
  return lines.join("\n");
}

function table(headers, rows) {
  const widths = headers.map((header, index) => Math.max(header.length, ...rows.map((row) => String(row[index] ?? "").length)));
  const render = (row) => `| ${row.map((cell, index) => String(cell ?? "").replace(/\|/g, "\\|").padEnd(widths[index])).join(" | ")} |`;
  return [render(headers), `| ${widths.map((width) => "-".repeat(width)).join(" | ")} |`, ...rows.map(render)].join("\n");
}

function defaultProjectMetadata(project) {
  const name = project.name.toLowerCase();
  if (name.includes("apartment") || name.includes("home")) return { area: "life", why_it_matters: "Life maintenance reduces background stress when it is bounded.", current_outcome: "Resolve one practical improvement or errand cluster.", next_milestone: "Identify the smallest useful next household action.", energy_type: "errands", weekly_budget_minutes: 90 };
  if (name.includes("motion")) return { area: "commercial", why_it_matters: "Commercial work needs visible progress without crowding out the rest of the week.", current_outcome: "Move the most important Motion loop one concrete step forward.", next_milestone: "Clarify the next deliverable and create one schedulable work block.", energy_type: "deep-work", weekly_budget_minutes: 180 };
  if (name.includes("work")) return { area: "work", why_it_matters: "Work commitments need a clear place in the week.", current_outcome: "Keep professional obligations moving without taking over planning.", next_milestone: "Choose the highest-leverage work task.", energy_type: "deep-work", weekly_budget_minutes: 180 };
  if (name.includes("ai")) return { area: "exploration", why_it_matters: "Exploration is valuable when it is intentionally scoped.", current_outcome: "Capture one useful experiment or decision.", next_milestone: "Define the question for the next exploration session.", energy_type: "deep-work", weekly_budget_minutes: 120 };
  if (name.includes("business") || name.includes("sidebiz")) return { area: "commercial", why_it_matters: "Business loops benefit from consistent, bounded attention.", current_outcome: "Move one revenue or operations loop forward.", next_milestone: "Pick the next task that changes the business state.", energy_type: "admin", weekly_budget_minutes: 120 };
  if (name.includes("art") || name.includes("buru") || name.includes("riven")) return { area: "creative", why_it_matters: "Creative projects stay alive through small protected sessions.", current_outcome: "Advance one concrete creative artifact.", next_milestone: "Choose the next visible creative output.", energy_type: "creative", weekly_budget_minutes: 120 };
  return { area: "other", why_it_matters: "", current_outcome: "", next_milestone: "", energy_type: "any", weekly_budget_minutes: 90 };
}

function clearDoneState(task) {
  const line = (task.description ?? "").split(/\r?\n/).find((candidate) => /^done when\s*:/i.test(candidate.trim()));
  return line ? line.replace(/^done when\s*:\s*/i, "").trim() : "The task is complete and the next action is obvious or no longer needed.";
}

function inferEnergyType(task, fallback) {
  const labels = new Set((task.labels ?? []).map(normalizeLabel));
  if (labels.has("deep") || labels.has("deep-work") || labels.has("focus")) return "deep-work";
  if (labels.has("creative") || labels.has("writing")) return "creative";
  if (labels.has("admin")) return "admin";
  if (labels.has("errands") || labels.has("errand")) return "errands";
  if (labels.has("low-energy") || labels.has("low")) return "low-energy";
  return fallback;
}

function estimateTaskMinutes(task) {
  if (task.duration?.unit === "minute" && Number.isFinite(task.duration.amount)) return Math.max(5, Math.round(task.duration.amount));
  const labels = task.labels ?? [];
  for (const value of [task.content, ...labels]) {
    const match = String(value).match(/(?:^|[^0-9])(\d{1,3})\s*(?:m|min|mins|minutes)(?:$|[^a-z])/i);
    if (match) return Number(match[1]);
  }
  return labels.map(normalizeLabel).includes("low-energy") ? 25 : 45;
}

function labelsForChunk(project, chunk) {
  const labels = ["priogrid", "chunk", "next"];
  if (["active", "maintenance", "waiting"].includes(project.status)) labels.push(project.status);
  if (chunk.energy_type && chunk.energy_type !== "any") labels.push(chunk.energy_type);
  return [...new Set(labels.map(normalizeLabel))];
}

function findTargetTodoistProject(store, project) {
  if (project.origin === "todoist") return project;
  if (project.area === "work" || project.name.toLowerCase().includes("certified")) return findTodoistProjectByName(store, "work");
  if (project.area === "life" || project.area === "other") return findTodoistProjectByName(store, "personal") ?? findTodoistProjectByName(store, "inbox");
  if (project.area === "commercial") return findTodoistProjectByName(store, "sidebiz") ?? findTodoistProjectByName(store, "work");
  if (project.area === "creative") return findTodoistProjectByName(store, "buru") ?? findTodoistProjectByName(store, "personal");
  return findTodoistProjectByName(store, "inbox");
}

function findTodoistProjectByName(store, value) {
  return store.projects.find((project) => project.origin === "todoist" && project.name.toLowerCase().includes(value.toLowerCase()));
}

async function ensureMetadataProject(client, projects) {
  const existing = findMetadataProject(projects);
  return existing ?? client.createProject(METADATA_PROJECT_NAME);
}

function findMetadataProject(projects) {
  return projects.find((project) => project.name === METADATA_PROJECT_NAME);
}

function diffTask(existing, desired) {
  const patch = {};
  if (desired.content !== undefined && existing.content !== desired.content) patch.content = desired.content;
  if (desired.description !== undefined && (existing.description ?? "") !== desired.description) patch.description = desired.description;
  if (desired.project_id !== undefined && existing.project_id !== desired.project_id) patch.project_id = desired.project_id;
  if (desired.labels !== undefined && JSON.stringify([...(existing.labels ?? [])].sort()) !== JSON.stringify([...desired.labels].sort())) patch.labels = desired.labels;
  const existingDue = normalizeDue(existing.due?.date ?? existing.due?.datetime);
  if (desired.due_string !== undefined && `${existingDue?.date ?? ""} ${existingDue?.time ?? ""}`.trim() !== desired.due_string) patch.due_string = desired.due_string;
  if (desired.due_date !== undefined && existingDue?.date !== desired.due_date) patch.due_date = desired.due_date;
  if (desired.duration !== undefined && existing.duration?.amount !== desired.duration) {
    patch.duration = desired.duration;
    patch.duration_unit = desired.duration_unit ?? "minute";
  }
  return patch;
}

function dueFromPatch(patch) {
  if (patch.due_string) {
    const [date, time] = patch.due_string.split(/\s+/);
    return { date: time ? `${date}T${time}:00` : date, string: patch.due_string };
  }
  if (patch.due_date) return { date: patch.due_date, string: patch.due_date };
  return null;
}

function durationFromPatch(patch) {
  return patch.duration ? { amount: patch.duration, unit: patch.duration_unit ?? "minute" } : null;
}

function normalizeDue(value) {
  if (!value) return undefined;
  if (!value.includes("T")) return { date: value };
  return { date: value.slice(0, 10), time: value.slice(11, 16) };
}

function dueSortKey(task) {
  const due = normalizeDue(task.due?.date ?? task.due?.datetime);
  return `${due?.date ?? ""}T${due?.time ?? "99:99"} ${task.content}`;
}

function normalizeTask(task) {
  return { ...task, labels: task.labels ?? [] };
}

function normalizeLabel(label) {
  return String(label).trim().replace(/^@/, "").toLowerCase();
}

function coerceStatus(value, fallback) {
  return VALID_STATUSES.has(value) ? value : fallback;
}

function coerceArea(value, fallback) {
  return VALID_AREAS.has(value) ? value : fallback;
}

function coerceEnergy(value, fallback) {
  return VALID_ENERGY.has(value) ? value : fallback;
}

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
}

function applyProjectFlags(project, args) {
  if (stringFlag(args, "area")) project.area = coerceArea(stringFlag(args, "area"), project.area);
  if (stringFlag(args, "energy")) project.energy_type = coerceEnergy(stringFlag(args, "energy"), project.energy_type);
  if (numberFlag(args, "budget")) project.weekly_budget_minutes = numberFlag(args, "budget");
  if (stringFlag(args, "why") !== undefined) project.why_it_matters = stringFlag(args, "why");
  if (stringFlag(args, "outcome") !== undefined) project.current_outcome = stringFlag(args, "outcome");
  if (stringFlag(args, "milestone") !== undefined) project.next_milestone = stringFlag(args, "milestone");
}

function findProject(store, selector) {
  const normalized = selector.toLowerCase();
  const exact = store.projects.find((project) => project.id.toLowerCase() === normalized || project.name.toLowerCase() === normalized);
  if (exact) return exact;
  const fuzzy = store.projects.filter((project) => project.name.toLowerCase().includes(normalized));
  if (fuzzy.length === 1) return fuzzy[0];
  if (fuzzy.length > 1) throw new Error(`Project selector "${selector}" is ambiguous: ${fuzzy.map((project) => project.name).join(", ")}`);
  throw new Error(`No project found for selector: ${selector}`);
}

function matchesAny(project, selectors) {
  return selectors.some((selector) => project.id.toLowerCase() === selector.toLowerCase() || project.name.toLowerCase() === selector.toLowerCase());
}

function mergeById(left, right) {
  const merged = new Map(left.map((item) => [item.id, item]));
  for (const item of right) merged.set(item.id, { ...merged.get(item.id), ...item });
  return [...merged.values()];
}

async function loadCache(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function saveCache(file, store) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

function cachePath(env) {
  if (env.PRIOGRID_CACHE_FILE) return env.PRIOGRID_CACHE_FILE;
  return path.join(os.homedir(), ".priogrid", "planner-cache.json");
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(date, days) {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function slugify(value) {
  return value.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[_\s]+/g, "-").replace(/-+/g, "-") || `project-${Date.now().toString(36)}`;
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const flags = new Map();
  const positionals = [];
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }
    const raw = arg.slice(2);
    const eq = raw.indexOf("=");
    if (eq >= 0) {
      flags.set(raw.slice(0, eq), raw.slice(eq + 1));
    } else if (rest[index + 1] && !rest[index + 1].startsWith("--")) {
      flags.set(raw, rest[index + 1]);
      index += 1;
    } else {
      flags.set(raw, true);
    }
  }
  return { command, flags, positionals };
}

function stringFlag(args, name) {
  const value = args.flags.get(name);
  return typeof value === "string" ? value : undefined;
}

function numberFlag(args, name) {
  const value = stringFlag(args, name);
  return value ? positiveNumber(value, undefined) : undefined;
}

function splitList(value) {
  return value ? value.split(",").map((item) => item.trim()).filter(Boolean) : [];
}

function printHelp() {
  console.log(`priogrid - Codex/Todoist weekly planning plugin

Commands:
  doctor
  sync
  sync-all
  review
  list-projects
  today --days 2
  propose-week --capacity <minutes>
  print-week
  set-project-status <project|all> <status>
  add-project --name <name>
  add-chunk --project <project> --title <title>
  schedule-chunk <chunk-id> --date YYYY-MM-DD [--time HH:MM]
  export-todoist [--write]
  migrate --from /path/to/planner-store.json`);
}

export function isCliEntrypoint(metaUrl = import.meta.url, argvPath = process.argv[1], platform = process.platform) {
  if (!argvPath) {
    return false;
  }

  const pathApi = platform === "win32" ? path.win32 : path;
  const rawModulePath = fileURLToPath(metaUrl);
  const moduleFilePath = platform === "win32"
    ? rawModulePath.replace(/^\/([A-Za-z]:[\\/])/, "$1")
    : rawModulePath;
  const modulePath = pathApi.resolve(moduleFilePath);
  const invokedPath = pathApi.resolve(argvPath);

  return platform === "win32"
    ? modulePath.toLowerCase() === invokedPath.toLowerCase()
    : modulePath === invokedPath;
}

if (isCliEntrypoint()) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
