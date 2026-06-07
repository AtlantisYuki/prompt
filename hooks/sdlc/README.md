# SDLC Hooks Runtime

This runtime makes the software development process enforceable without relying
on skill matching. Skills can still call the manual CLI, but lifecycle rules live
in `hooks/sdlc/core`.

## Architecture

```text
platform hook payload
  -> adapters/codex.mjs or adapters/claude-code.mjs
  -> core/rules.mjs
  -> docs/_sdlc/current.json + task artifacts
```

Install this repository once as a user-level plugin/runtime. The plugin root
contains the platform entries and this runtime:

```text
.codex-plugin/plugin.json
.claude-plugin/plugin.json
hooks/codex-hooks.json
hooks/claude-hooks.json
hooks/sdlc/
skills/
```

`.codex-plugin/plugin.json` and `.claude-plugin/plugin.json` point to their own
hook config files through the manifest `hooks` field. Both configs call
`hooks/sdlc/bin/plugin-hook.mjs` through the platform plugin root environment
variable, so business projects do not need to copy `hooks/sdlc/`. The project
only needs lifecycle state files under `docs/`.

Manual or unsupported platforms call the same core from the project root:

```bash
node <SDLC_RUNTIME>/hooks/sdlc/bin/sdlc-hook.mjs status
```

## State Contract

Repository state:

```text
docs/_sdlc/current.json
docs/_sdlc/hook-events.ndjson
docs/[task-dir]/onlyAI/hook-state.json
docs/[task-dir]/onlyAI/task-plan.json   # optional machine-readable plan
```

Minimal `current.json`:

```json
{
  "activeTaskDir": "docs/login-fix",
  "phase": "design-1",
  "mode": "enforce",
  "strict": true,
  "stopGate": "warn",
  "profile": "standard",
  "systemName": "用户中心"
}
```

Set `"stopGate": "block"` when the platform hook should block session stop for
an incomplete active phase. The default is `"warn"` to avoid blocking status
questions or planning-only turns.

`profile` controls required artifacts:

- `lite`: `current.json`, `onlyAI/task-plan.json`, and `onlyAI/verification.md` or `summary.md`.
- `standard`: `001-概要设计.md`, `onlyAI/task-plan.json`, `003-文件改动记录.md`, and `onlyAI/verification.md`.
- `full`: complete design, construction, test report, and review artifacts.

## Manual Commands

```bash
node <SDLC_RUNTIME>/hooks/sdlc/bin/sdlc-hook.mjs init --task-dir docs/login-fix --system 用户中心 --profile lite
node <SDLC_RUNTIME>/hooks/sdlc/bin/sdlc-hook.mjs status
node <SDLC_RUNTIME>/hooks/sdlc/bin/sdlc-hook.mjs phase.enter --phase design-2
node <SDLC_RUNTIME>/hooks/sdlc/bin/sdlc-hook.mjs phase.exit --phase design-1
node <SDLC_RUNTIME>/hooks/sdlc/bin/sdlc-hook.mjs tool.before --action fs.edit --path src/login.ts
node <SDLC_RUNTIME>/hooks/sdlc/bin/sdlc-hook.mjs session.stop --require-complete
```

`status` returns both raw lifecycle state and agent guidance:

```json
{
  "nextAction": "Complete required artifacts for phase implement.",
  "blockingReasons": ["Current phase implement is incomplete."],
  "requiredArtifacts": [{ "path": "docs/task/003-文件改动记录.md", "exists": true }],
  "recommendedReads": ["docs/_sdlc/current.json", "docs/task/onlyAI/task-plan.json"],
  "allowedPaths": ["docs/_sdlc/*", "docs/task/*", "src/login.ts"]
}
```

Use `recommendedReads` before searching broadly. Use `allowedPaths` to avoid
guessing the current implementation boundary.

## Machine-readable Task Plan

When present, `docs/[task-dir]/onlyAI/task-plan.json` is the preferred source
for implementation boundaries and task completion. Markdown construction docs
remain supported as a fallback.

Minimal shape:

```json
{
  "allowedPaths": ["src/shared.ts"],
  "tasks": [
    {
      "id": "T-01",
      "status": "done",
      "allowedPaths": ["src/login.ts", "README.md"],
    "verification": ["npm test"]
    }
  ]
}
```

Task `status` values considered complete: `done`, `completed`, `complete`,
`[x]`, and `已完成`.

## Platform Wiring

- Codex plugin hook config: `hooks/codex-hooks.json`
- Claude Code plugin hook config: `hooks/claude-hooks.json`
- Codex example: `hooks/sdlc/manifests/codex.config.example.toml`
- Claude Code example: `hooks/sdlc/manifests/claude.settings.example.json`
- Neutral event manifest: `hooks/sdlc/manifests/sdlc-hooks.json`

The example manifests are for manual or legacy user-level hook wiring with an
absolute `<SDLC_RUNTIME>` path. The core rules do not depend on either
platform.

## Enforced Rules

1. Source edits are blocked until `docs/_sdlc/current.json` exists.
2. Design phases may write lifecycle docs, but not source files.
3. Pending confirmation documents block source edits.
4. Implementation edits must stay within `onlyAI/task-plan.json` allowed paths.
   If no task plan exists, Markdown construction docs are parsed as fallback.
5. Phase exit and manual stop can require phase artifacts to be complete.
