import path from "node:path";
import fs from "node:fs";
import {
  currentStatePath,
  ensureDir,
  loadCurrentState,
  saveHookState,
  workspaceRoot,
  writeJson,
} from "../core/context.mjs";
import {
  implementationAllowedPaths,
  lifecycleDocPaths,
  phaseCompletion,
  pendingConfirmations,
  sdlcProfile,
} from "../core/artifacts.mjs";
import { evaluate } from "../core/rules.mjs";
import { printJson } from "../core/result.mjs";
import { inferTargetPaths, parseArgs } from "./common.mjs";

const PHASE_ORDER = ["design-1", "design-2", "implement", "test"];
const PROFILE_ARTIFACTS = {
  lite: {
    "design-1": ["onlyAI/task-plan.json"],
    "design-2": ["onlyAI/task-plan.json"],
    implement: ["onlyAI/task-plan.json"],
    test: ["onlyAI/verification.md", "summary.md"],
  },
  standard: {
    "design-1": ["001-概要设计.md"],
    "design-2": ["onlyAI/task-plan.json"],
    implement: ["onlyAI/task-plan.json", "003-文件改动记录.md"],
    test: ["onlyAI/verification.md"],
  },
  full: {
    "design-1": ["001-概要设计.md"],
    "design-2": ["002-详细设计.md", "003-施工文档.md"],
    implement: ["003-施工文档.md", "003-文件改动记录.md", "onlyAI/operations-log.md"],
    test: ["004-测试用例.md", "005-测试报告.md", "onlyAI/verification.md"],
  },
};
const PROFILE_RECOMMENDED_READS = {
  lite: {
    "design-1": ["prd/", "onlyAI/task-plan.json"],
    "design-2": ["onlyAI/task-plan.json"],
    implement: ["onlyAI/task-plan.json", "onlyAI/verification.md"],
    test: ["onlyAI/verification.md", "summary.md"],
    debug: ["006-Debug排查记录.md", "onlyAI/verification.md"],
  },
  standard: {
    "design-1": ["prd/", "001-概要设计.md"],
    "design-2": ["001-概要设计.md", "onlyAI/task-plan.json"],
    implement: ["onlyAI/task-plan.json", "003-文件改动记录.md", "onlyAI/verification.md"],
    test: ["onlyAI/verification.md"],
    debug: ["006-Debug排查记录.md", "onlyAI/verification.md"],
  },
  full: {
    "design-1": ["prd/", "onlyAI/structured-request.json", "onlyAI/context-scan.json"],
    "design-2": ["001-概要设计.md", "prd/"],
    implement: ["003-施工文档.md", "onlyAI/task-plan.json", "onlyAI/operations-log.md"],
    test: ["004-测试用例.md", "onlyAI/verification.md", "onlyAI/testing.md"],
    debug: ["006-Debug排查记录.md", "onlyAI/operations-log.md", "onlyAI/verification.md"],
  },
};

export function runManual(argv = process.argv.slice(2)) {
  const command = argv[0] || "help";
  const args = parseArgs(argv.slice(1));
  const root = workspaceRoot();

  if (command === "init") {
    return initLifecycle(args, root);
  }

  if (command === "status") {
    return status(root);
  }

  if (command === "phase.enter") {
    return runEvent({ name: "phase.enter", phase: args.phase }, root);
  }

  if (command === "phase.exit") {
    return runEvent(
      {
        name: "phase.exit",
        phase: args.phase,
      },
      root,
      { requireComplete: args["allow-incomplete"] !== true },
    );
  }

  if (command === "tool.before") {
    return runEvent(
      {
        name: "tool.before",
        platform: "manual",
        action: args.action || "fs.edit",
        targetPaths: args.path ? [args.path] : inferTargetPaths(args.tool, args),
        command: args.command,
      },
      root,
    );
  }

  if (command === "session.stop") {
    return runEvent(
      {
        name: "session.stop",
        platform: "manual",
        requireComplete: args["require-complete"] === true,
      },
      root,
      { requireComplete: args["require-complete"] === true },
    );
  }

  return help();
}

function initLifecycle(args, root) {
  if (!args["task-dir"]) {
    throw new Error("init requires --task-dir docs/[task-dir]");
  }

  const activeTaskDir = args["task-dir"].replace(/\\/g, "/");
  const state = {
    activeTaskDir,
    phase: args.phase || "design-1",
    mode: args.mode || "enforce",
    strict: args.strict !== "false",
    stopGate: args["stop-gate"] || "warn",
    profile: sdlcProfile({ profile: args.profile }),
    systemName: args.system || args["system-name"] || "",
    createdAt: new Date().toISOString(),
  };

  ensureDir(path.join(root, activeTaskDir, "onlyAI"));
  writeJson(currentStatePath(root), state);
  saveHookState(state, state, root);
  printJson({
    decision: "allow",
    message: "SDLC lifecycle initialized.",
    state,
  });
}

function status(root) {
  printJson(statusPayload(root));
}

export function statusPayload(root) {
  const state = loadCurrentState(root);
  const completion = phaseCompletion(state, root);
  const pending = pendingConfirmations(state, root);
  return {
    state,
    completion,
    pendingConfirmations: pending.map((item) => item.name),
    profile: sdlcProfile(state),
    nextAction: nextAction(state, completion, pending),
    blockingReasons: blockingReasons(state, completion, pending),
    requiredArtifacts: requiredArtifacts(state, root),
    recommendedReads: recommendedReads(state),
    allowedPaths: allowedPaths(state, root),
  };
}

function runEvent(event, root, options = {}) {
  const result = evaluate(
    {
      platform: "manual",
      targetPaths: [],
      ...event,
    },
    {
      cwd: root,
      ...options,
    },
  );
  printJson(result);
  if (result.decision === "deny") {
    process.exitCode = 2;
  }
}

function help() {
  printJson({
    usage: [
      "node <SDLC_RUNTIME>/hooks/sdlc/bin/sdlc-hook.mjs init --task-dir docs/[task] --system [system] --profile lite|standard|full",
      "node <SDLC_RUNTIME>/hooks/sdlc/bin/sdlc-hook.mjs status",
      "node <SDLC_RUNTIME>/hooks/sdlc/bin/sdlc-hook.mjs phase.enter --phase design-2",
      "node <SDLC_RUNTIME>/hooks/sdlc/bin/sdlc-hook.mjs phase.exit --phase design-1",
      "node <SDLC_RUNTIME>/hooks/sdlc/bin/sdlc-hook.mjs tool.before --action fs.edit --path src/foo.ts",
      "node <SDLC_RUNTIME>/hooks/sdlc/bin/sdlc-hook.mjs session.stop --require-complete",
    ],
  });
}

function nextAction(state, completion, pending) {
  if (!state) {
    return "Initialize lifecycle with init --task-dir docs/[task] --system [system].";
  }

  if (pending.length > 0) {
    return `Resolve pending confirmation: ${pending.map((item) => item.name).join(", ")}.`;
  }

  if (!completion[state.phase]) {
    return `Complete required artifacts for phase ${state.phase}.`;
  }

  const currentIndex = PHASE_ORDER.indexOf(state.phase);
  if (currentIndex >= 0 && currentIndex < PHASE_ORDER.length - 1) {
    return `Enter next phase: ${PHASE_ORDER[currentIndex + 1]}.`;
  }

  if (state.phase === "test" && completion.test) {
    return "Task lifecycle is complete; summarize results and keep knowledge in the task/system docs.";
  }

  return "Inspect current state and choose the next lifecycle command.";
}

function blockingReasons(state, completion, pending) {
  const reasons = [];
  if (!state) {
    return ["docs/_sdlc/current.json is missing."];
  }

  if (pending.length > 0) {
    reasons.push(`Pending confirmations: ${pending.map((item) => item.name).join(", ")}.`);
  }

  if (state.phase === "design-2" && !completion["design-1"]) {
    reasons.push("design-1 is not complete.");
  }
  if (state.phase === "implement" && !completion["design-2"]) {
    reasons.push("design-2 is not complete.");
  }
  if (state.phase === "test" && !completion.implement) {
    reasons.push("implement is not complete.");
  }

  if (!completion[state.phase]) {
    reasons.push(`Current phase ${state.phase} is incomplete.`);
  }

  return reasons;
}

function requiredArtifacts(state, root) {
  if (!state?.activeTaskDir) {
    return [];
  }

  const artifactsByPhase = PROFILE_ARTIFACTS[sdlcProfile(state)] || PROFILE_ARTIFACTS.standard;
  return (artifactsByPhase[state.phase] || []).map((relativePath) => {
    const fullPath = path.join(root, state.activeTaskDir, relativePath);
    return {
      path: `${state.activeTaskDir}/${relativePath}`.replace(/\\/g, "/"),
      exists: fs.existsSync(fullPath),
    };
  });
}

function recommendedReads(state) {
  if (!state?.activeTaskDir) {
    return ["docs/_sdlc/current.json"];
  }

  const readsByPhase = PROFILE_RECOMMENDED_READS[sdlcProfile(state)] || PROFILE_RECOMMENDED_READS.standard;
  const taskReads = readsByPhase[state.phase] || [];
  return [
    "docs/_sdlc/current.json",
    ...taskReads.map((relativePath) => `${state.activeTaskDir}/${relativePath}`.replace(/\\/g, "/")),
  ];
}

function allowedPaths(state, root) {
  if (!state) {
    return [];
  }

  const lifecycle = lifecycleDocPaths(state).map((item) => `${item}*`);
  if (state.phase !== "implement") {
    return lifecycle;
  }

  return [
    ...lifecycle,
    ...Array.from(implementationAllowedPaths(state, root)).sort(),
  ];
}
