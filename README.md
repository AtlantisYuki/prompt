# AI 辅助开发工作流

本仓库提供 `software-dev-process` skill，以文档先行、决策回写和验证证据驱动软件开发流程。

## 提示词目录

- `repository/AGENTS.md`：项目级（软件开发）模板，复制为具体项目根目录的 `AGENTS.md`。含任务路由细化、工具能力与 MCP 降级、项目知识库、编码验证与 SDLC 接入。
- `user/AGENTS.md`：用户级（通用）提示词，可复制到各 AI Agent 的用户级指令位置（如 Codex 用户目录、Claude Code 全局 CLAUDE.md）。含交互、安全底线、粗路由与登记指针；不写软开工具表。

业务项目中的 `AGENTS.md` 从仓库根到当前工作目录逐层累积生效，仅在规则冲突时由更近层级覆盖。本仓库本身不维护根目录 `AGENTS.md`，分发模板只放在 `user/` 与 `repository/`。

## 核心流程

```text
design-1：在 001-设计文档完成概要层级 → 有疑问时 grill → 决策回写 → 定稿
design-2：在同一设计文档补齐详细层级 → 有疑问时 grill → 决策回写 → 定稿
implement：002-施工文档初稿 → 强制 grill 压测 → 计划/执行/文件改动同文维护
test：003-测试文档内维护风险用例 → 执行证据 → 结论 → 待关闭
close：前置门禁／未测试二次确认 → 文档收口 → AI 登记 → 知识沉淀 → 已关闭
```

辅助入口：

- `sdlc-debug`：必须显式调用；只在 `Debug排查记录.md` 维护取证、决定、修改和验证，不补建标准设计/施工文档。
- `sdlc-script`：必须显式调用；只在 `脚本任务.md` 维护计划、脚本、执行和验证，中高风险强制评审，生产执行独立授权。
- `sdlc-solo`：只串联 `design → implement → test → close` 标准流程，在低风险可逆决策边界内自动推进，不处理 Debug 或 Script。
- `sdlc-close`：正常路径在前置流程和测试完成后关闭；测试完全未执行时，警告风险并在用户二次确认后例外关闭。
- `sdlc-history`：查询 PostgreSQL/MySQL 或降级 SQLite 登记，不生成开发文档。

## 使用方式

在 Codex 中显式提及 skill 和入口，例如：

```text
Use $software-dev-process with sdlc-design-1 for docs/my-task.
Use $software-dev-process with sdlc-implement for docs/my-task.
Use $software-dev-process with sdlc-debug in diagnose mode.
Use $software-dev-process with sdlc-close for docs/my-task.
```

`grill-with-docs` 已安装时优先显式调用它；未安装时，skill 使用内置兼容协议，仍保持一次一个问题、事实自行查证、决定即时回写、ADR/glossary 沉淀和待确认项归零等门禁。

## 结构

```text
repository/AGENTS.md              # 项目级提示词模板
user/AGENTS.md                    # 用户级提示词模板
skills/software-dev-process/
├── SKILL.md                 # 入口、共同约束和资源路由
├── references/              # 按阶段加载的执行规则
├── assets/                  # 输出模板
├── scripts/                 # 任务状态、hook 与 AI 登记脚本
└── agents/openai.yaml       # Codex UI 元数据
```

阶段完成不能仅根据文件存在判断。必须同时校验主文档状态、未确认项、评审决策回写和验证证据。

未执行测试的关闭不生成虚假测试报告；`status.md` 与 `summary.md` 必须记录未测试事实、风险和用户二次确认。此时 `100%` 仅表示流程已经关闭，不表示质量验证通过。

## 确定性任务状态

每个新任务使用 `docs/[任务目录]/onlyAI/task-state.json` 作为工作流、阶段、门禁和进度的机器事实源，`workflow` 区分 `standard / debug / script`，`status.md` 由状态脚本投影为面向人的视图并保留状态日志。Schema v3 还记录评审证据、Debug 授权模式、Script 风险/环境/生产批准、阶段结论证据和 Close 收口结果。阶段切换、评审、未确认项、施工任务、测试结论和 Close 都通过 `scripts/task_state_core.py` 的专用命令提交；旧任务先从 `status.md` 迁移并复核，v1/v2 机器状态由脚本兼容升级，不能用手工改字段绕过门禁。

状态脚本要求 Implement 完成 Grill 并记录证据后才能进入 `ready`，施工任务完成和测试通过也必须附实际验证证据。未测试关闭使用一次性确认 token；`close-request` 到 `close-confirm` 之间工作树变化会使确认失效，用户确认后以明确留痕为准，不再追加指纹复检。Close 只有在 summary、AI 登记和知识沉淀结果均记录终态与证据后才能完成。

## AI 登记后端

登记脚本优先读取项目 `docs/ai-register.json`，使用 PostgreSQL 或 MySQL；配置、驱动或连接不可用时降级到项目 `docs/ai-register.db`。配置模板位于 `skills/software-dev-process/assets/ai-register.config.example.json`，密码只通过 `password_env` 引用，不写入配置文件。

所有后端统一记录 session、任务目录、工具、模型、Git 分支、已完成任务和进度。`sdlc-close` 负责最终同步为 `100%`。

批准进入 SDLC 仅授权维护任务文档、AI 登记数据和 Close 阶段的知识沉淀同步，不授权业务数据库写入、迁移或生产执行；这些操作仍需单独明确批准。

## 验证

```powershell
python -m unittest discover -s ai_test -p "test_*.py"
powershell -NoProfile -ExecutionPolicy Bypass -File ai_test/test_codex_session_hook.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File ai_test/test_install_codex_hook.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File ai_test/test_grok_session_hook.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File ai_test/test_install_grok_hook.ps1
```

SessionStart hook 安装：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File skills/software-dev-process/scripts/install_codex_hook.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File skills/software-dev-process/scripts/install_grok_hook.ps1
```

Skill 元数据可使用 Codex 自带 `skill-creator/scripts/quick_validate.py` 校验。
