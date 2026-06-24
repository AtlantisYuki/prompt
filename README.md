# AI 辅助开发工作流

基于 AI 的软件开发生命周期（SDLC）管理工作流，提供从需求理解到测试交付的完整流程支持。

## 工作流程

### 标准流程（分阶段执行）

```
需求输入 → design-1 → design-2 → implement → test → 知识沉淀
```

#### 阶段 1：需求理解与概要设计（sdlc-design-1）

**输入**：用户需求描述

**流程**：
1. 确认任务目录，记录系统名称到 `status.md`
2. 生成结构化需求 `structured-request.json`
3. 扫描代码库上下文 `context-scan.json`
4. 使用 `sequential-thinking` 梳理问题和约束
5. 使用 `brainstorming` 做方案发散与收敛
6. 补充上下文疑问 `context-question-N.json`
7. 每个关键产物生成后立即更新 `status.md`

**输出**：
- `001-概要设计.md` - 包含问题分析、方案选型、架构设计
- `001-概要设计-待确认.md` - 待确认项（如有不明确的逻辑或方案选择）
- `status.md` - 记录系统名称和任务状态

#### 阶段 2：详细设计与施工规划（sdlc-design-2）

**输入**：概要设计文档

**前置校验**：检查是否存在 `001-概要设计-待确认.md`
- 分阶段模式：如存在，暂停并要求用户处理待确认项
- Solo 模式：AI 自动选择最优方案并说明理由

**流程**：
1. 判断任务规模（≤3天 或 >3天）
2. 中长期任务做模块化规划
3. 收集实现细节，定义接口契约
4. 明确风险点和验证标准

**输出**：
- `002-详细设计.md` - 接口定义、数据结构、流程细节
- `002-详细设计-待确认.md` - 待确认项（如有）
- `003-施工文档.md` - 改动文件清单、实施步骤、注释要求

#### 阶段 3：代码实现（sdlc-implement）

**输入**：施工文档

**前置校验**：检查是否存在 `002-详细设计-待确认.md`
- 分阶段模式：如存在，暂停并要求用户处理待确认项
- Solo 模式：AI 自动选择最优方案并说明理由

**流程**（任务级进度管控）：
1. 读取施工文档中的任务拆解清单
2. 严格按照任务 ID 顺序，逐个任务执行：
   - 每次只执行一个任务
   - 严格按照该任务的文件清单编码
   - 同步补齐中文注释
3. 每完成一个任务后，立即执行：
   - 在 `003-文件改动记录.md` 中记录本次改动（必须写明行号范围）
   - 在 `003-施工文档.md` 中更新任务状态为"已完成"
   - 更新 `operations-log.md` 追加实施记录
   - 更新 `status.md` 整体进度、当前阶段、已完成任务、下一任务和阻塞项
4. 循环执行，直到所有任务完成

**输出**：
- 代码变更
- `003-文件改动记录.md` - 记录每个任务的文件改动及行号
- `operations-log.md` - 实施记录
- `sql/*.sql` - 数据库脚本（如有）
- 更新后的 `003-施工文档.md` - 任务进度实时更新

#### 阶段 4：质量验证与测试（sdlc-test）

**输入**：实现的代码

**流程**：
1. 生成测试用例（正常路径、边界、异常、权限）
2. 执行测试并记录结果
3. 自我审查代码质量
4. 更新 `status.md` 记录每轮测试结果、风险和最终状态
5. 回写知识到系统知识库

**输出**：
- `004-测试用例.md` - 测试用例清单
- `005-测试报告.md` - 测试结果和风险评估
- `testing.md` + `verification.md` - 测试执行过程
- `review-report.md` - 自我审查结论
- 知识库更新：`core://systems/[系统名称]/...`

### 全自动模式（sdlc-solo）

适用于需求明确、边界清晰的任务。

**特点**：
- 可在任何阶段启动
- 自动检测已完成阶段，从下一阶段开始执行
- 自动串联所有剩余阶段直到测试完成
- 预计工作量 > 3 天时强制警告用户

**使用场景**：
- ✅ 需求明确的独立功能
- ✅ 预计 ≤ 3 天的短期任务
- ✅ 不涉及复杂架构变更
- ❌ 需要分阶段评审的复杂任务
- ❌ 需求不明确需要探索的任务

### 问题排查模式（sdlc-debug）

用于复杂 Bug 或回归问题的排查与修复。

**输出**：
- `006-Debug排查记录.md` - 问题定位过程和解决方案
- 更新 `operations-log.md` 和 `verification.md`

## 目录结构

```
docs/[需求目录]/
├── 001-概要设计.md          # 概要设计
├── 001-概要设计-待确认.md    # 待确认项（如有）
├── 002-详细设计.md          # 详细设计
├── 002-详细设计-待确认.md    # 待确认项（如有）
├── 003-施工文档.md          # 施工规划（含任务拆解和进度跟踪）
├── 003-文件改动记录.md      # 文件改动记录（含行号）
├── 004-测试用例.md          # 测试用例
├── 005-测试报告.md          # 测试报告
├── 006-Debug排查记录.md     # Debug 记录（如有）
├── status.md                # 任务状态（含系统名称和整体进度）
├── summary.md               # 阶段总结（可选）
├── sql/                     # 数据库脚本
└── onlyAI/                  # AI 工作区
    ├── structured-request.json
    ├── context-scan.json
    ├── context-question-N.json
    ├── operations-log.md
    ├── testing.md
    ├── verification.md
    └── review-report.md
```

## 核心约束

1. **指令驱动与前置校验**：必须通过对应指令触发，严禁跳阶段
2. **先读上下文再设计**：设计前先读取需求与上下文
3. **强制逻辑推导**：概要设计必须使用 sequential-thinking 和 brainstorming
4. **待确认机制**：设计阶段遇到不明确逻辑时生成待确认文档，进入下一阶段前强制校验
5. **允许回退修正**：发现设计缺陷时可回退到 design-2 更新
6. **控制改动边界**：只清理本次施工产生的脏代码，不越界重构
7. **记忆回写必做**：任务完成后必须回写到 `core://systems/[系统名称]/...`
8. **status.md 持续同步**：阶段开始、阶段完成、待确认生成或处理、施工任务完成、测试执行、阻塞和回退时必须立即更新 `docs/[需求目录]/status.md`

## 知识管理

### 系统名称标记

在 `sdlc-design-1` 阶段首次创建 `status.md` 时，必须记录系统名称：

```markdown
系统：用户中心
任务：实现用户登录功能
当前阶段：design-1
状态：进行中
整体进度：10%
最后更新：2026-06-07 10:00:00

## 状态日志
- 2026-06-07 10:00:00 | design-1 | 阶段启动，已记录系统名称和任务目录
```

`status.md` 是 SDLC 阶段控制和进度追踪的参考依据。建议阶段值使用 `design-1`、`design-2`、`implement`、`test`、`debug`、`script`、`done`；状态日志按时间追加，记录关键产物、测试结果、阻塞项和下一步。

### 知识库路径

任务完成后，知识回写到对应系统的知识库：

```
core://systems/用户中心/登录模块/...
core://systems/订单中心/支付流程/...
core://systems/商品中心/库存管理/...
```

这样可以确保知识按系统归类，便于后续查询和复用。

## AI 登记

为支持任务跨会话、跨工具（Claude Code ↔ Codex）准确接力，SDLC 过程中维护一个仓库级 SQLite 登记库 `docs/ai-register.db`，以 `session_id` 为唯一主键。

### 登记内容

| 列 | 含义 | 写入命令 |
|----|------|---------|
| tool | 工具（Claude Code / Codex） | upsert |
| session_id | 会话 ID（唯一主键） | upsert |
| model | 使用的模型 | upsert |
| resume_shell / resume_cli | 续接指令（shell / CLI 内部模式） | upsert（核心按工具自动拼装） |
| cwd / source | 工作目录 / 启动来源 | upsert |
| task_dir | 所属任务目录 | progress |
| feature / progress | 完成功能 / 完成进度 | progress |

### 工作方式

登记核心是 software-dev-process skill 的 `scripts/ai_register_core.py`（`<skill>` 指该 skill 根目录，按实际安装路径解析）。

- **会话启动**：SessionStart hook 把本会话 sessionId / 工具 / 模型注入上下文，**hook 本身不写库**。
  - Claude Code：`scripts/hooks/cc_session_start.ps1`（从 stdin JSON 取 session_id）。
  - Codex：`scripts/hooks/codex_session_start.ps1`（从环境变量取 session id）。
  - 用 `scripts/install_codex_hook.ps1` 等脚本安装到工具的 hook 配置。
- **登记 / 推进**：AI 以被注入的 sessionId 为键调用核心：
  ```bash
  # 会话开始：登记身份
  python3 <skill>/scripts/ai_register_core.py upsert --session <sessionId> --tool "Claude Code" --model <model>
  # 推进任务：回填进度（只动自己那行）
  python3 <skill>/scripts/ai_register_core.py progress --session <sessionId> --task-dir "docs/[需求目录]/" --feature "..." --progress "75%"
  ```
- **查询登记**：
  ```bash
  python3 <skill>/scripts/ai_register_core.py query                       # 全部
  python3 <skill>/scripts/ai_register_core.py query --task-dir "docs/xxx/" # 指定任务（含续接指令）
  ```

### 并发安全

同目录并行多会话时，每个会话只认/只写自己被注入的 sessionId；`PRIMARY KEY` + `ON CONFLICT DO UPDATE` + WAL 模式保证不重复、不撞写。hook 注入失败不中断主流程。

## 待确认机制

### 设计理念

在设计阶段，AI 可能遇到无法明确的逻辑、需要权衡的技术方案、或存在风险的设计点。待确认机制确保这些关键决策点被明确记录和处理。

### 何时生成待确认文档

在 design-1 或 design-2 阶段，遇到以下情况时必须生成待确认文档：

1. **技术方案选择**：存在多个可行方案，各有优劣
2. **业务逻辑不明确**：需求描述模糊，存在多种理解方式
3. **架构/性能风险**：设计存在已知风险，需要确认可接受程度
4. **外部依赖**：涉及外部系统集成，接口规范待确认
5. **数据结构设计**：数据库表结构存在多种设计方案
6. **异常处理策略**：错误处理、降级策略需要明确

### 待确认文档内容

每个待确认项包含：
- 问题描述
- 候选方案（至少 2 个）
- 每个方案的优缺点、风险评估、实现成本
- AI 推荐方案（如有明确倾向）
- 优先级标记（高/中/低）

### 处理方式

#### 分阶段模式
1. AI 生成待确认文档（如 `001-概要设计-待确认.md`）
2. 暂停当前阶段，提示用户处理
3. 用户在文档中填写决策结果
4. AI 读取决策，更新设计文档，重新收敛设计逻辑
5. 将待确认文档状态标记为"已处理"
6. **待确认文档保留作为决策记录，不删除**
7. 完成当前阶段的后续步骤
8. **只有待确认文档状态为"已处理"后，才能进入下一阶段**

#### Solo 模式
1. AI 生成待确认文档
2. AI 立即在当前阶段内自动处理
3. 评估各方案（性能、可维护性、实现成本、风险、扩展性）
4. 选择综合评分最高的方案
5. 在设计文档中补充"AI 自动决策"章节，说明选择理由
6. 根据选定方案重新收敛设计逻辑，更新设计文档
7. 将待确认文档状态标记为"已处理"
8. **待确认文档保留作为决策记录，不删除**
9. 继续当前阶段的后续步骤

### 示例

```markdown
## 待确认项 1：用户会话存储方案

### 问题描述
用户登录后需要维护会话状态，存在多种技术方案。

### 候选方案

#### 方案 A：Redis 集中式存储
**优点**：
- 支持分布式部署
- 性能好，支持过期自动清理

**缺点**：
- 增加 Redis 依赖
- 需要维护 Redis 集群

**实现成本**：中

#### 方案 B：JWT Token
**优点**：
- 无状态，不需要服务端存储
- 减少服务端压力

**缺点**：
- Token 无法主动失效
- Token 体积较大

**实现成本**：低

### AI 推荐方案
推荐方案 A（Redis），理由：
- 系统已有 Redis 基础设施
- 需要支持强制登出功能
- 会话数据需要实时更新
```

## 使用方法

### 分阶段执行

```bash
# 阶段 1：需求理解与概要设计
/software-dev-process sdlc-design-1

# 阶段 2：详细设计与施工规划
/software-dev-process sdlc-design-2

# 阶段 3：代码实现
/software-dev-process sdlc-implement

# 阶段 4：质量验证与测试
/software-dev-process sdlc-test

# 问题排查与修复
/software-dev-process sdlc-debug
```

### 全自动模式

```bash
# 从头开始全自动执行
/software-dev-process sdlc-solo

# 在任意阶段启动，自动完成后续流程
/software-dev-process sdlc-solo
```

## 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件
