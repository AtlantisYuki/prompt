import fs from "node:fs";
import path from "node:path";

export const PHASES = ["design-1", "design-2", "implement", "test", "debug"];

export function workspaceRoot(options = {}) {
  return path.resolve(options.cwd || process.env.SDLC_WORKSPACE || process.cwd());
}

export function toPosixPath(value) {
  return value.replace(/\\/g, "/");
}

export function normalizeRelativePath(value, root = workspaceRoot()) {
  if (!value || typeof value !== "string") {
    return null;
  }

  const raw = value.trim();
  if (!raw) {
    return null;
  }

  const resolved = path.isAbsolute(raw) ? path.resolve(raw) : path.resolve(root, raw);
  const relative = path.relative(root, resolved);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return toPosixPath(resolved);
  }

  return toPosixPath(relative);
}

export function readJsonIfExists(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

export function readTextIfExists(filePath, fallback = "") {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return fallback;
  }
}

export function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function appendNdjson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.appendFileSync(filePath, `${JSON.stringify(value)}\n`, "utf8");
}

export function currentStatePath(root = workspaceRoot()) {
  return path.join(root, "docs", "_sdlc", "current.json");
}

export function eventsPath(root = workspaceRoot()) {
  return path.join(root, "docs", "_sdlc", "hook-events.ndjson");
}

export function loadCurrentState(root = workspaceRoot()) {
  const state = readJsonIfExists(currentStatePath(root), null);
  if (!state) {
    return null;
  }

  const activeTaskDir = state.activeTaskDir
    ? normalizeRelativePath(state.activeTaskDir, root)
    : null;

  return {
    mode: "enforce",
    strict: true,
    phase: "design-1",
    stopGate: "warn",
    ...state,
    activeTaskDir,
  };
}

export function taskPath(state, root = workspaceRoot(), relativePath = "") {
  if (!state?.activeTaskDir) {
    return null;
  }
  return path.join(root, state.activeTaskDir, relativePath);
}

export function onlyAiPath(state, root = workspaceRoot(), relativePath = "") {
  return taskPath(state, root, path.join("onlyAI", relativePath));
}

export function hookStatePath(state, root = workspaceRoot()) {
  return onlyAiPath(state, root, "hook-state.json");
}

export function loadHookState(state, root = workspaceRoot()) {
  const filePath = hookStatePath(state, root);
  return filePath ? readJsonIfExists(filePath, {}) : {};
}

export function saveHookState(state, data, root = workspaceRoot()) {
  const filePath = hookStatePath(state, root);
  if (!filePath) {
    return;
  }
  writeJson(filePath, {
    updatedAt: new Date().toISOString(),
    ...data,
  });
}

export function recordEvent(event, result, root = workspaceRoot()) {
  appendNdjson(eventsPath(root), {
    at: new Date().toISOString(),
    event: event.name,
    platform: event.platform,
    action: event.action,
    toolName: event.toolName,
    targetPaths: event.targetPaths,
    decision: result.decision,
    severity: result.severity,
    message: result.message || result.reason,
  });
}
