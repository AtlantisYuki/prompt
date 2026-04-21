# AI 辅助开发工作流

基于 Claude Code 的软件开发生命周期（SDLC）管理工作流，提供从需求理解到测试交付的完整流程支持。

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

**输出**：
- `001-概要设计.md` - 包含问题分析、方案选型、架构设计
- `status.md` - 记录系统名称和任务状态

#### 阶段 2：详细设计与施工规划（sdlc-design-2）

**输入**：概要设计文档

**流程**：
1. 判断任务规模（≤3天 或 >3天）
2. 中长期任务做模块化规划
3. 收集实现细节，定义接口契约
4. 明确风险点和验证标准

**输出**：
- `002-详细设计.md` - 接口定义、数据结构、流程细节
- `003-施工文档.md` - 改动文件清单、实施步骤、注释要求

#### 阶段 3：代码实现（sdlc-implement）

**输入**：施工文档

**流程**：
1. 严格按照施工文档中的文件清单编码
2. 同步补齐中文注释
3. 更新 `operations-log.md` 记录实施过程
4. 数据库脚本统一输出到 `sql/` 目录

**输出**：
- 代码变更
- `operations-log.md` - 实施记录
- `sql/*.sql` - 数据库脚本（如有）

#### 阶段 4：质量验证与测试（sdlc-test）

**输入**：实现的代码

**流程**：
1. 生成测试用例（正常路径、边界、异常、权限）
2. 执行测试并记录结果
3. 自我审查代码质量
4. 回写知识到系统知识库

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
├── 002-详细设计.md          # 详细设计
├── 003-施工文档.md          # 施工规划
├── 004-测试用例.md          # 测试用例
├── 005-测试报告.md          # 测试报告
├── 006-Debug排查记录.md     # Debug 记录（如有）
├── status.md                # 任务状态（含系统名称）
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
4. **允许回退修正**：发现设计缺陷时可回退到 design-2 更新
5. **控制改动边界**：只清理本次施工产生的脏代码，不越界重构
6. **记忆回写必做**：任务完成后必须回写到 `core://systems/[系统名称]/...`

## 知识管理

### 系统名称标记

在 `sdlc-design-1` 阶段首次创建 `status.md` 时，必须记录系统名称：

```markdown
系统：用户中心
任务：实现用户登录功能
状态：进行中
```

### 知识库路径

任务完成后，知识回写到对应系统的知识库：

```
core://systems/用户中心/登录模块/...
core://systems/订单中心/支付流程/...
core://systems/商品中心/库存管理/...
```

这样可以确保知识按系统归类，便于后续查询和复用。

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
