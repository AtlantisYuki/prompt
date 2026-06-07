import fs from "node:fs";
import path from "node:path";
import { readJsonIfExists, readTextIfExists, taskPath, toPosixPath } from "./context.mjs";

const CONFIRMATION_DONE_PATTERNS = [
  /(?:\*\*)?状态(?:\*\*)?[：:]\s*已处理/u,
  /(?:\*\*)?决策状态(?:\*\*)?[：:]\s*已决策/u,
];
const PROFILES = new Set(["lite", "standard", "full"]);

export function fileExists(filePath) {
  return Boolean(filePath && fs.existsSync(filePath));
}

export function confirmationStatus(filePath) {
  if (!fileExists(filePath)) {
    return "none";
  }

  const text = readTextIfExists(filePath);
  return CONFIRMATION_DONE_PATTERNS.some((pattern) => pattern.test(text))
    ? "handled"
    : "pending";
}

export function pendingConfirmations(state, root) {
  if (!state?.activeTaskDir) {
    return [];
  }

  return [
    "001-概要设计-待确认.md",
    "002-详细设计-待确认.md",
  ]
    .map((name) => {
      const filePath = taskPath(state, root, name);
      return {
        name,
        path: filePath,
        status: confirmationStatus(filePath),
      };
    })
    .filter((item) => item.status === "pending");
}

export function taskPlanPath(state, root) {
  return taskPath(state, root, path.join("onlyAI", "task-plan.json"));
}

export function loadTaskPlan(state, root) {
  const plan = readJsonIfExists(taskPlanPath(state, root), null);
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) {
    return null;
  }
  return plan;
}

export function sdlcProfile(state) {
  const profile = String(state?.profile || "standard").trim().toLowerCase();
  return PROFILES.has(profile) ? profile : "standard";
}

export function phaseCompletion(state, root) {
  if (!state?.activeTaskDir) {
    return {
      "design-1": false,
      "design-2": false,
      implement: false,
      test: false,
      debug: false,
    };
  }

  const design1Doc = taskPath(state, root, "001-概要设计.md");
  const design1Confirmation = taskPath(state, root, "001-概要设计-待确认.md");
  const detailDoc = taskPath(state, root, "002-详细设计.md");
  const buildDoc = taskPath(state, root, "003-施工文档.md");
  const design2Confirmation = taskPath(state, root, "002-详细设计-待确认.md");
  const changeRecord = taskPath(state, root, "003-文件改动记录.md");
  const operationsLog = taskPath(state, root, path.join("onlyAI", "operations-log.md"));
  const taskPlan = taskPlanPath(state, root);
  const testCases = taskPath(state, root, "004-测试用例.md");
  const testReport = taskPath(state, root, "005-测试报告.md");
  const verification = taskPath(state, root, path.join("onlyAI", "verification.md"));
  const summary = taskPath(state, root, "summary.md");
  const profile = sdlcProfile(state);

  const design1Complete =
    fileExists(design1Doc) && confirmationStatus(design1Confirmation) !== "pending";
  const design2Complete =
    fileExists(detailDoc) &&
    fileExists(buildDoc) &&
    confirmationStatus(design2Confirmation) !== "pending";
  const taskPlanComplete = fileExists(taskPlan) && confirmationStatus(design2Confirmation) !== "pending";

  if (profile === "lite") {
    return {
      "design-1": taskPlanComplete && confirmationStatus(design1Confirmation) !== "pending",
      "design-2": taskPlanComplete,
      implement: taskPlanComplete && implementationTasksCompleted(state, root, readTextIfExists(buildDoc)),
      test: fileExists(verification) || fileExists(summary),
      debug: fileExists(taskPath(state, root, "006-Debug排查记录.md")),
    };
  }

  if (profile === "standard") {
    return {
      "design-1": design1Complete,
      "design-2": design1Complete && taskPlanComplete,
      implement:
        design1Complete &&
        taskPlanComplete &&
        fileExists(changeRecord) &&
        implementationTasksCompleted(state, root, readTextIfExists(buildDoc)),
      test: fileExists(verification),
      debug: fileExists(taskPath(state, root, "006-Debug排查记录.md")),
    };
  }

  return {
    "design-1": design1Complete,
    "design-2": design2Complete,
    implement:
      design2Complete &&
      fileExists(changeRecord) &&
      fileExists(operationsLog) &&
      implementationTasksCompleted(state, root, readTextIfExists(buildDoc)),
    test: fileExists(testCases) && fileExists(testReport) && fileExists(verification),
    debug: fileExists(taskPath(state, root, "006-Debug排查记录.md")),
  };
}

export function implementationTasksCompleted(state, root, buildDocText = "") {
  const taskPlan = loadTaskPlan(state, root);
  if (taskPlan) {
    return allTaskPlanTasksCompleted(taskPlan);
  }
  return allTasksCompleted(buildDocText);
}

export function allTaskPlanTasksCompleted(taskPlan) {
  const tasks = Array.isArray(taskPlan?.tasks) ? taskPlan.tasks : [];
  if (tasks.length === 0) {
    return false;
  }

  return tasks.every((task) => {
    const status = String(task?.status || "").trim().toLowerCase();
    return ["done", "completed", "complete", "[x]", "已完成"].includes(status);
  });
}

export function allTasksCompleted(text) {
  const taskRows = text
    .split(/\r?\n/u)
    .filter((line) => /^\|\s*T-\d+/u.test(line));

  if (taskRows.length === 0) {
    return false;
  }

  return taskRows.every((line) => /\|\s*\[x\]\s*\|/iu.test(line));
}

export function lifecycleDocPaths(state) {
  if (!state?.activeTaskDir) {
    return ["docs/_sdlc/"];
  }

  return [
    "docs/_sdlc/",
    `${state.activeTaskDir}/`,
  ].map(toPosixPath);
}

export function isLifecyclePath(relativePath, state) {
  if (!relativePath) {
    return false;
  }

  const normalized = toPosixPath(relativePath);
  return lifecycleDocPaths(state).some((prefix) => normalized.startsWith(prefix));
}

export function implementationAllowedPaths(state, root) {
  const taskPlan = loadTaskPlan(state, root);
  if (taskPlan) {
    return implementationAllowedPathsFromTaskPlan(taskPlan);
  }

  const buildDoc = taskPath(state, root, "003-施工文档.md");
  const text = readTextIfExists(buildDoc);
  const taskLines = text
    .split(/\r?\n/u)
    .filter((line) => /^\|\s*T-\d+/u.test(line));
  const sourceText = taskLines.length > 0 ? taskLines.join("\n") : text;
  const matches = sourceText.matchAll(/`([^`]+)`/gu);
  const allowed = new Set();

  for (const match of matches) {
    const value = match[1].trim();
    if (!value || value.includes("[") || value.includes("]")) {
      continue;
    }
    allowed.add(toPosixPath(value).replace(/\/+$/u, ""));
  }

  return allowed;
}

export function implementationAllowedPathsFromTaskPlan(taskPlan) {
  const allowed = new Set();
  collectAllowedPaths(taskPlan?.allowedPaths, allowed);

  if (Array.isArray(taskPlan?.tasks)) {
    for (const task of taskPlan.tasks) {
      collectAllowedPaths(task?.allowedPaths, allowed);
    }
  }

  return allowed;
}

function collectAllowedPaths(values, allowed) {
  if (!Array.isArray(values)) {
    return;
  }

  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }
    const normalized = toPosixPath(value.trim()).replace(/\/+$/u, "");
    if (!normalized || normalized.includes("[") || normalized.includes("]")) {
      continue;
    }
    allowed.add(normalized);
  }
}

export function isAllowedImplementationPath(relativePath, state, root) {
  if (isLifecyclePath(relativePath, state)) {
    return true;
  }

  const normalized = toPosixPath(relativePath);
  const allowed = implementationAllowedPaths(state, root);

  for (const allowedPath of allowed) {
    if (normalized === allowedPath || normalized.startsWith(`${allowedPath}/`)) {
      return true;
    }
  }

  return false;
}
