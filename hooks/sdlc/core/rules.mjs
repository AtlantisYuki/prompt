import { loadCurrentState, recordEvent, saveHookState, workspaceRoot } from "./context.mjs";
import {
  isAllowedImplementationPath,
  isLifecyclePath,
  pendingConfirmations,
  phaseCompletion,
} from "./artifacts.mjs";
import { allow, block, warn } from "./result.mjs";

const WRITE_ACTIONS = new Set(["fs.write", "fs.edit", "fs.delete"]);
const KNOWN_SOURCE_EXTENSIONS = new Set([
  ".c",
  ".cc",
  ".cpp",
  ".cs",
  ".css",
  ".go",
  ".java",
  ".js",
  ".jsx",
  ".kt",
  ".mjs",
  ".php",
  ".py",
  ".rb",
  ".rs",
  ".scss",
  ".sh",
  ".sql",
  ".swift",
  ".ts",
  ".tsx",
  ".vue",
]);

export function sessionContextMessage(state) {
  if (!state) {
    return [
      "SDLC hooks are enabled for this repository.",
      "Before editing source files, create docs/_sdlc/current.json or run the configured sdlc-hook init command.",
      "Lifecycle rules are enforced by hooks, not by skill matching.",
    ].join("\n");
  }

  return [
    "SDLC hooks are enabled for this repository.",
    `Active task: ${state.activeTaskDir || "not set"}`,
    `Current phase: ${state.phase || "not set"}`,
    "If a hook blocks an action, satisfy the requested lifecycle artifact and retry.",
  ].join("\n");
}

export function evaluate(event, options = {}) {
  const root = workspaceRoot(options);
  const state = options.state || loadCurrentState(root);
  const normalizedEvent = {
    targetPaths: [],
    ...event,
  };

  let result;
  switch (normalizedEvent.name) {
    case "session.start":
      result = allow("Injected SDLC lifecycle context.", {
        additionalContext: sessionContextMessage(state),
      });
      break;
    case "tool.before":
      result = evaluateBeforeTool(normalizedEvent, state, root);
      break;
    case "tool.after":
      result = allow("Recorded SDLC hook event.");
      break;
    case "session.stop":
      result = evaluateStop(normalizedEvent, state, root, options);
      break;
    case "phase.enter":
      result = evaluatePhaseEnter(normalizedEvent, state, root);
      break;
    case "phase.exit":
      result = evaluatePhaseExit(normalizedEvent, state, root, options);
      break;
    default:
      result = allow("No SDLC rule matched this event.");
  }

  if (shouldRecordEvent(normalizedEvent, state)) {
    try {
      recordEvent(normalizedEvent, result, root);
    } catch {
      // Hook decisions must not fail just because telemetry cannot be written.
    }
  }

  if (state) {
    try {
      saveHookState(
        state,
        {
          phase: state.phase,
          activeTaskDir: state.activeTaskDir,
          lastEvent: normalizedEvent.name,
          lastDecision: result.decision,
          lastMessage: result.message || result.reason,
        },
        root,
      );
    } catch {
      // Ignore state persistence failures; the decision above is still valid.
    }
  }

  return result;
}

function shouldRecordEvent(event, state) {
  if (event.name !== "session.start") {
    return true;
  }

  return state?.recordSessionStart === true || isTruthyEnv(process.env.SDLC_RECORD_SESSION_START);
}

function isTruthyEnv(value) {
  return /^(1|true|yes|on)$/iu.test(String(value || "").trim());
}

function evaluateBeforeTool(event, state, root) {
  if (!WRITE_ACTIONS.has(event.action) && event.action !== "command.exec") {
    return allow("Read-only or unknown-safe action.");
  }

  const paths = event.targetPaths || [];
  const sourceWrite = WRITE_ACTIONS.has(event.action) && paths.some((target) => !isLifecyclePath(target, state));

  if (!state && (sourceWrite || event.action === "command.exec")) {
    return block(
      [
        "SDLC lifecycle is not initialized.",
        "Create docs/_sdlc/current.json or run the configured user-level SDLC command:",
        "node <SDLC_RUNTIME>/hooks/sdlc/bin/sdlc-hook.mjs init --task-dir docs/[task-dir] --system [system-name] --profile lite|standard|full",
        "Source edits and write-like commands are blocked until lifecycle state exists.",
      ].join("\n"),
    );
  }

  if (!state) {
    return allow("No lifecycle state; non-source action allowed.");
  }

  if (event.action === "command.exec") {
    return evaluateCommand(event, state);
  }

  const pending = pendingConfirmations(state, root);
  if (pending.length > 0 && paths.some((target) => !isLifecyclePath(target, state))) {
    return block(
      [
        "Pending SDLC confirmation blocks source edits.",
        `Pending files: ${pending.map((item) => item.name).join(", ")}`,
        "Resolve the confirmation document first, then retry.",
      ].join("\n"),
    );
  }

  if (state.phase === "design-1" || state.phase === "design-2") {
    const illegal = paths.filter((target) => !isLifecyclePath(target, state));
    if (illegal.length > 0) {
      return block(
        [
          `Current phase is ${state.phase}; source edits are not allowed yet.`,
          `Blocked paths: ${illegal.join(", ")}`,
          "Finish design artifacts before implementation.",
        ].join("\n"),
      );
    }
  }

  if (state.phase === "implement") {
    const complete = phaseCompletion(state, root);
    if (!complete["design-2"]) {
      return block("Cannot implement before design-2 artifacts are complete and confirmations are handled.");
    }

    const illegal = paths.filter((target) => !isAllowedImplementationPath(target, state, root));
    if (illegal.length > 0) {
      return block(
        [
          "Implementation edit is outside the construction document boundary.",
          `Blocked paths: ${illegal.join(", ")}`,
          "Add the file to 003-施工文档.md with a clear reason, then retry.",
        ].join("\n"),
      );
    }
  }

  return allow("SDLC lifecycle checks passed.");
}

function evaluateCommand(event, state) {
  const command = event.command || "";
  if (!looksWriteLikeCommand(command)) {
    return allow("Command does not look like a filesystem write.");
  }

  const paths = event.targetPaths || [];
  if (paths.length === 0) {
    return warn(
      [
        "Command may write files, but the hook could not infer target paths.",
        "Prefer apply_patch or explicit file paths so SDLC boundaries can be enforced mechanically.",
      ].join("\n"),
    );
  }

  const sourceTargets = paths.filter((target) => !isLifecyclePath(target, state));
  if (sourceTargets.length > 0 && (state.phase === "design-1" || state.phase === "design-2")) {
    return block(`Write-like command targets source files before implementation: ${sourceTargets.join(", ")}`);
  }

  return allow("Write-like command passed SDLC checks.");
}

function evaluatePhaseEnter(event, state, root) {
  if (!state) {
    return block("Cannot enter a phase before docs/_sdlc/current.json exists.");
  }

  const targetPhase = event.phase || state.phase;
  const complete = phaseCompletion(state, root);
  const pending = pendingConfirmations(state, root);

  if (pending.length > 0 && targetPhase !== state.phase) {
    return block(`Pending confirmation must be handled before phase transition: ${pending.map((item) => item.name).join(", ")}`);
  }

  if (targetPhase === "design-2" && !complete["design-1"]) {
    return block("Cannot enter design-2 before design-1 is complete.");
  }

  if (targetPhase === "implement" && !complete["design-2"]) {
    return block("Cannot enter implement before design-2 is complete.");
  }

  if (targetPhase === "test" && !complete.implement) {
    return block("Cannot enter test before implement is complete.");
  }

  return allow(`Phase enter allowed: ${targetPhase}.`);
}

function evaluatePhaseExit(event, state, root, options = {}) {
  if (!state) {
    return block("Cannot exit a phase before docs/_sdlc/current.json exists.");
  }

  const phase = event.phase || state.phase;
  const complete = phaseCompletion(state, root);
  const pending = pendingConfirmations(state, root);

  if (pending.length > 0) {
    return block(`Cannot exit phase with pending confirmations: ${pending.map((item) => item.name).join(", ")}`);
  }

  if (options.requireComplete !== false && !complete[phase]) {
    return block(`Phase ${phase} is not complete according to required SDLC artifacts.`);
  }

  return allow(`Phase exit allowed: ${phase}.`);
}

function evaluateStop(event, state, root, options = {}) {
  if (!state) {
    return allow("No active SDLC lifecycle state.");
  }

  const requireComplete =
    options.requireComplete === true ||
    event.requireComplete === true ||
    state.stopGate === "block";

  const phase = event.phase || state.phase;
  const complete = phaseCompletion(state, root);
  const pending = pendingConfirmations(state, root);

  if (pending.length > 0) {
    return block(`Cannot stop with pending confirmations: ${pending.map((item) => item.name).join(", ")}`);
  }

  if (requireComplete && !complete[phase]) {
    return block(`Stop gate blocked: phase ${phase} is not complete.`);
  }

  if (!complete[phase]) {
    return warn(`Phase ${phase} is not complete. Stop gate is in warn mode.`);
  }

  return allow(`Stop gate passed for phase ${phase}.`);
}

function looksWriteLikeCommand(command) {
  return /\b(Set-Content|Out-File|New-Item|Remove-Item|Move-Item|Copy-Item|rm|mv|cp|touch|mkdir|git\s+apply|npm\s+run\s+build|pnpm\s+run\s+build|yarn\s+build)\b/i.test(
    command,
  ) || /[>]{1,2}/u.test(command);
}

export function isLikelySourcePath(relativePath) {
  if (!relativePath || relativePath.startsWith("docs/")) {
    return false;
  }
  const ext = relativePath.includes(".") ? relativePath.slice(relativePath.lastIndexOf(".")).toLowerCase() : "";
  return KNOWN_SOURCE_EXTENSIONS.has(ext);
}
