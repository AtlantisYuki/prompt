import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { evaluate } from "../core/rules.mjs";
import { allow, asCodexHookJson, asHookJson, codexHookFailureJson } from "../core/result.mjs";
import { eventsPath, writeJson } from "../core/context.mjs";
import { implementationAllowedPaths, phaseCompletion } from "../core/artifacts.mjs";
import { statusPayload } from "../adapters/manual.mjs";

function makeWorkspace() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "sdlc-hooks-"));
}

function write(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function readEvents(root) {
  const filePath = eventsPath(root);
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function seedCurrent(root, overrides = {}) {
  const state = {
    activeTaskDir: "docs/login-fix",
    phase: "design-1",
    mode: "enforce",
    strict: true,
    stopGate: "warn",
    systemName: "用户中心",
    ...overrides,
  };
  writeJson(path.join(root, "docs", "_sdlc", "current.json"), state);
  fs.mkdirSync(path.join(root, "docs", "login-fix", "onlyAI"), { recursive: true });
  return state;
}

function event(extra) {
  return {
    name: "tool.before",
    platform: "test",
    action: "fs.edit",
    targetPaths: ["src/login.ts"],
    ...extra,
  };
}

function run() {
  {
    const allowed = allow("ok");
    assert.deepEqual(asHookJson(allowed, "PostToolUse"), { decision: "allow" });
    assert.deepEqual(asCodexHookJson(allowed, "PostToolUse"), {});
    assert.deepEqual(asCodexHookJson(allowed, "PreToolUse"), { decision: "allow" });
    assert.deepEqual(codexHookFailureJson(new Error("boom"), "PostToolUse"), {});
    assert.deepEqual(codexHookFailureJson(new Error("boom"), "PreToolUse"), {
      decision: "deny",
      reason: "SDLC Codex hook failed: boom",
    });
  }

  {
    const root = makeWorkspace();
    seedCurrent(root, { phase: "design-1" });
    const result = evaluate({ name: "session.start", platform: "test" }, { cwd: root });
    assert.equal(result.decision, "allow");
    assert.equal(readEvents(root), "");
  }

  {
    const root = makeWorkspace();
    seedCurrent(root, { phase: "design-1", recordSessionStart: true });
    const result = evaluate({ name: "session.start", platform: "test" }, { cwd: root });
    assert.equal(result.decision, "allow");
    assert.match(readEvents(root), /"event":"session\.start"/u);
  }

  {
    const root = makeWorkspace();
    const previous = process.env.SDLC_RECORD_SESSION_START;
    process.env.SDLC_RECORD_SESSION_START = "1";
    try {
      const result = evaluate({ name: "session.start", platform: "test" }, { cwd: root });
      assert.equal(result.decision, "allow");
      assert.match(readEvents(root), /"event":"session\.start"/u);
    } finally {
      if (previous === undefined) {
        delete process.env.SDLC_RECORD_SESSION_START;
      } else {
        process.env.SDLC_RECORD_SESSION_START = previous;
      }
    }
  }

  {
    const root = makeWorkspace();
    const result = evaluate(event(), { cwd: root });
    assert.equal(result.decision, "deny");
    assert.match(result.reason, /not initialized/u);
  }

  {
    const root = makeWorkspace();
    seedCurrent(root, { phase: "design-1" });
    const result = evaluate(event(), { cwd: root });
    assert.equal(result.decision, "deny");
    assert.match(result.reason, /source edits are not allowed/u);
  }

  {
    const root = makeWorkspace();
    seedCurrent(root, { phase: "implement", profile: "full" });
    write(path.join(root, "docs", "login-fix", "001-概要设计.md"), "# 概要");
    write(path.join(root, "docs", "login-fix", "002-详细设计.md"), "# 详细");
    write(
      path.join(root, "docs", "login-fix", "003-施工文档.md"),
      [
        "# 施工",
        "| 任务 ID | 所属模块 | 任务描述 | 预计改动/新增文件 | 优先级 | 状态 | 预估耗时 | 实际耗时 | 完成时间 | 实际改动文件及行号 |",
        "| T-01 | 全局 | 登录修复 | `src/login.ts` | P0 | [ ] | 1h | | | |",
        "| T-02 | 文档 | 补充说明 | `README.md` | P1 | [ ] | 10m | | | |",
      ].join("\n"),
    );

    const allowed = evaluate(event({ targetPaths: ["src/login.ts"] }), { cwd: root });
    assert.equal(allowed.decision, "allow");

    const allowedMarkdown = evaluate(event({ targetPaths: ["README.md"] }), { cwd: root });
    assert.equal(allowedMarkdown.decision, "allow");

    const blocked = evaluate(event({ targetPaths: ["src/other.ts"] }), { cwd: root });
    assert.equal(blocked.decision, "deny");
    assert.match(blocked.reason, /outside the construction document/u);
  }

  {
    const root = makeWorkspace();
    seedCurrent(root, { phase: "implement" });
    write(path.join(root, "docs", "login-fix", "001-概要设计.md"), "# 概要");
    write(path.join(root, "docs", "login-fix", "002-详细设计-待确认.md"), "**状态**：待处理");
    const result = evaluate(event({ targetPaths: ["src/login.ts"] }), { cwd: root });
    assert.equal(result.decision, "deny");
    assert.match(result.reason, /Pending SDLC confirmation/u);
  }

  {
    const root = makeWorkspace();
    const state = seedCurrent(root, { phase: "implement", profile: "standard" });
    write(path.join(root, "docs", "login-fix", "001-概要设计.md"), "# 概要");
    write(path.join(root, "docs", "login-fix", "002-详细设计.md"), "# 详细");
    write(path.join(root, "docs", "login-fix", "003-施工文档.md"), "# 施工\n");
    write(path.join(root, "docs", "login-fix", "003-文件改动记录.md"), "# 改动");
    write(path.join(root, "docs", "login-fix", "onlyAI", "operations-log.md"), "# 执行");
    writeJson(path.join(root, "docs", "login-fix", "onlyAI", "task-plan.json"), {
      allowedPaths: ["src/shared.ts"],
      tasks: [
        {
          id: "T-01",
          status: "done",
          allowedPaths: ["src/login.ts", "README.md"],
        },
      ],
    });

    assert.deepEqual(Array.from(implementationAllowedPaths(state, root)).sort(), [
      "README.md",
      "src/login.ts",
      "src/shared.ts",
    ]);
    assert.equal(phaseCompletion(state, root).implement, true);

    const allowed = evaluate(event({ targetPaths: ["src/shared.ts"] }), { cwd: root });
    assert.equal(allowed.decision, "allow");
    const blocked = evaluate(event({ targetPaths: ["src/not-listed.ts"] }), { cwd: root });
    assert.equal(blocked.decision, "deny");
  }

  {
    const root = makeWorkspace();
    seedCurrent(root, { phase: "implement", profile: "standard" });
    write(path.join(root, "docs", "login-fix", "001-概要设计.md"), "# 概要");
    write(path.join(root, "docs", "login-fix", "002-详细设计.md"), "# 详细");
    write(path.join(root, "docs", "login-fix", "003-施工文档.md"), "# 施工\n");
    write(path.join(root, "docs", "login-fix", "003-文件改动记录.md"), "# 改动");
    write(path.join(root, "docs", "login-fix", "onlyAI", "operations-log.md"), "# 执行");
    writeJson(path.join(root, "docs", "login-fix", "onlyAI", "task-plan.json"), {
      tasks: [{ id: "T-01", status: "pending", allowedPaths: ["src/login.ts"] }],
    });

    const payload = statusPayload(root);
    assert.equal(payload.state.phase, "implement");
    assert.match(payload.nextAction, /Complete required artifacts/u);
    assert.ok(payload.blockingReasons.some((item) => item.includes("implement")));
    assert.ok(payload.recommendedReads.includes("docs/_sdlc/current.json"));
    assert.ok(payload.recommendedReads.includes("docs/login-fix/onlyAI/task-plan.json"));
    assert.ok(payload.allowedPaths.includes("src/login.ts"));
  }

  {
    const root = makeWorkspace();
    const state = seedCurrent(root, { phase: "test", profile: "lite" });
    writeJson(path.join(root, "docs", "login-fix", "onlyAI", "task-plan.json"), {
      tasks: [{ id: "T-01", status: "done", allowedPaths: ["src/login.ts"] }],
    });
    write(path.join(root, "docs", "login-fix", "summary.md"), "# Summary");

    const completion = phaseCompletion(state, root);
    assert.equal(completion["design-1"], true);
    assert.equal(completion["design-2"], true);
    assert.equal(completion.implement, true);
    assert.equal(completion.test, true);

    const payload = statusPayload(root);
    assert.equal(payload.profile, "lite");
    assert.ok(payload.requiredArtifacts.some((item) => item.path.endsWith("summary.md")));
  }

  {
    const root = makeWorkspace();
    const state = seedCurrent(root, { phase: "test", profile: "standard" });
    write(path.join(root, "docs", "login-fix", "001-概要设计.md"), "# 概要");
    write(path.join(root, "docs", "login-fix", "003-文件改动记录.md"), "# 改动");
    writeJson(path.join(root, "docs", "login-fix", "onlyAI", "task-plan.json"), {
      tasks: [{ id: "T-01", status: "done", allowedPaths: ["src/login.ts"] }],
    });
    write(path.join(root, "docs", "login-fix", "onlyAI", "verification.md"), "# Verification");

    const completion = phaseCompletion(state, root);
    assert.equal(completion["design-1"], true);
    assert.equal(completion["design-2"], true);
    assert.equal(completion.implement, true);
    assert.equal(completion.test, true);
  }
}

run();
console.log("sdlc hooks tests passed");
