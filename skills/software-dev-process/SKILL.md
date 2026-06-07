---
name: software-dev-process
description: 使用仓库级 SDLC hooks 管理需求、设计、施工、测试和排查。用于用户明确提到 sdlc-design-1、sdlc-design-2、sdlc-implement、sdlc-test、sdlc-debug、sdlc-solo，或要求按本仓库 SDLC 流程推进时。
---

# Software Development Process

本 Skill 只弥补 AI agent 的信息盲区：如何进入仓库级 SDLC hooks、哪些状态语义不能靠直觉推断、以及哪些文件是人工协作契约。流程规则的权威实现不在这里，在 `hooks/sdlc/core`。

## 首要动作

命中本 Skill 后，不要先通读历史任务文档。按需执行：

```bash
node <SDLC_RUNTIME>/hooks/sdlc/bin/sdlc-hook.mjs status
```

如果需要直接看原始状态，只读：

- `docs/_sdlc/current.json`
- `sdlc-hook status` 返回的 `recommendedReads`
- 当前任务目录下与下一步有关的文件，例如 `onlyAI/task-plan.json`、`003-施工文档.md`、`onlyAI/operations-log.md`

只有当当前文件不能回答下一步问题时，才继续读源码或历史文档。目录结构、依赖、配置能自然推断出的内容不要写进新文档，也不要反复检索。

## Hooks 是权威

生命周期准入、阶段完成度、待确认阻塞、施工边界都由 hooks 判定。Skill 文本不能覆盖 hook 结果。

常用入口：

```bash
node <SDLC_RUNTIME>/hooks/sdlc/bin/sdlc-hook.mjs init --task-dir docs/[task] --system [system] --profile lite|standard|full
node <SDLC_RUNTIME>/hooks/sdlc/bin/sdlc-hook.mjs phase.enter --phase design-2
node <SDLC_RUNTIME>/hooks/sdlc/bin/sdlc-hook.mjs phase.exit --phase design-1
node <SDLC_RUNTIME>/hooks/sdlc/bin/sdlc-hook.mjs tool.before --action fs.edit --path [path]
```

如果 hook 拒绝操作，优先满足拒绝消息指出的生命周期条件；不要绕开边界继续改源文件。

## 不明显但重要的语义

- `docs/_sdlc/current.json` 的 `activeTaskDir` 是当前任务根，后续 SDLC 文档默认落在这里。
- `profile` 控制必需产物：`lite` 用于 0.5 天内低风险小改；`standard` 是默认；`full` 才使用完整阶段文档、测试报告和自审。
- `status.md` 或 `init --system` 中的系统名是任务归属系统；总结、索引和后续知识沉淀不要临时改名。
- 施工阶段优先以 `onlyAI/task-plan.json` 的 `allowedPaths` 作为机器可读边界；不存在时才回退到 `003-施工文档.md` 中用反引号显式列出的路径。
- `sdlc-hook status` 的 `nextAction`、`blockingReasons`、`recommendedReads`、`allowedPaths` 是给 agent 减少猜测用的，先信它们再扩大搜索。
- 待确认文档会阻塞源文件编辑和阶段切换。可识别的已处理标记是 `状态：已处理` 或 `决策状态：已决策`。
- `onlyAI/` 是过程记录区，适合放扫描、执行、验证和自审记录；不要把面向用户的正式结论只写在 `onlyAI/`。
- SQL 变更脚本放在当前任务目录的 `sql/`，避免散落到源码目录或聊天记录。

## 产物策略

只产出本阶段真实需要的文档。不要为了填满模板制造低价值章节；已能从代码、目录、依赖或配置一眼看出的事实不写。

使用模板时从本 Skill 的 `assets/` 读取：

- `概要设计模板.md`
- `详细设计模板.md`
- `施工文档模板.md`
- `文件改动记录模板.md`
- `测试用例模板.md`
- `测试报告模板.md`
- `Debug排查记录模板.md`
- `待确认模板.md`

## 阶段工作准则

- 设计阶段：只在存在真实方案分歧、业务不确定、外部依赖不明或风险需要用户承担时生成待确认文档。
- 施工阶段：先确认 `allowedPaths`，再改代码；施工记录默认写文件、意图和验证结果，只有 `full` 或审计需要时写行号范围。
- 测试阶段：验证要覆盖本次改动的风险面，不追求大而全；`lite`/`standard` 可合并到 `onlyAI/verification.md`，`full` 才拆分测试用例、测试报告和自审。
- Debug 阶段：记录复现、定位证据、修复点和回归结果，避免把猜测写成结论。

## Solo 模式

`sdlc-solo` 只适合边界清晰、预计不超过 3 天的任务。遇到真实待确认项时，AI 可以自动决策，但必须在对应设计文档中写明选择理由、风险和取舍；不要把自动决策伪装成用户确认。
