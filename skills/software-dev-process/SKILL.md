---
name: software-dev-process
description: 管理完整的软件开发生命周期（需求理解、概要设计、详细设计、施工实现、测试与排查）。用于通过 sdlc-design-1、sdlc-design-2、sdlc-implement、sdlc-test、sdlc-debug 分阶段驱动任务，或通过 sdlc-solo 全自动执行剩余流程。强制检查前置产物、模板输出和阶段边界。
---

# Software Development Process Skill

当用户明确使用 `sdlc-design-1`、`sdlc-design-2`、`sdlc-implement`、`sdlc-test`、`sdlc-debug`、`sdlc-solo`，或要求按标准 SDLC 阶段推进任务时，使用本 Skill。

## 核心约束

1. **指令驱动与前置校验**：每个开发阶段必须通过对应的 `sdlc-*` 指令触发。执行任何阶段前，必须校验前置阶段的产出物是否存在，严禁擅自跳阶段。
2. **先读上下文再设计**：设计阶段必须先读取 `docs/[需求目录]/prd/` 下的需求与上下文；如果本地信息仍不足以继续，再向用户提问。
3. **强制逻辑推导**：在概要设计阶段必须使用 `sequential-thinking` 进行逻辑推导，并使用 `brainstorming` 做方案发散与收敛；需要比较方案时，先列出候选方案再收敛。
4. **允许回退修正**：若在施工或测试时发现前期设计存在重大缺陷，必须停止当前阶段，回退到 `sdlc-design-2` 更新设计文档。
5. **控制改动边界**：代码实现时，只清理本次施工直接产生的脏代码；未获许可时，不得顺手大范围重构历史代码，也不得修改未在准入清单中的文件。
6. **记忆回写必做**：任务完成后必须优先 `update_memory` 对应节点；若无对应节点，则先 `create_memory` 再回写结论，禁止跳过记忆更新直接结束任务。**记忆回写时，必须使用 `status.md` 中记录的系统名称作为知识库路径**（如：`core://systems/用户中心/...`）。

## 目录与资源约定

- **模板读取**：所有文档基于本 Skill `assets/` 目录下的中文模板生成。
- **文档输出**：设计、施工、测试和排查文档统一输出到 `docs/[需求目录]/`。
- **onlyAI 工作区**：仅供 AI 读取和维护的过程文件统一输出到 `docs/[需求目录]/onlyAI/`，包括 `structured-request.json`、`context-scan.json`、`context-question-N.json`、`operations-log.md`、`testing.md`、`verification.md`、`review-report.md`。
- **SQL 脚本**：数据库变更脚本统一输出到 `docs/[需求目录]/sql/`。
- **摘要文档**：如有必要，可自主生成 `docs/[需求目录]/summary.md` 或 `docs/index.md` 汇总阶段结论与交付物索引。

## 阶段命令

### `sdlc-design-1`

阶段 1：需求理解与概要设计。

1. 简单任务可直接进入上下文收集；复杂任务必须先确认任务目录。
2. 在 `docs/[需求目录]/onlyAI/structured-request.json` 记录结构化需求，**必须包含本次任务所属的系统名称**。
3. 首次创建 `status.md` 时，**必须在文件头部记录本次任务所属的系统名称**（如：`系统：用户中心`），后续所有记忆回写将使用该系统名作为知识库路径。
4. 输出 `docs/[需求目录]/onlyAI/context-scan.json`，完成结构化快速扫描。
5. 使用 `sequential-thinking` 梳理问题、约束和候选方案，并使用 `brainstorming` 做多方案发散。
6. 针对高优疑问补充 `docs/[需求目录]/onlyAI/context-question-N.json`，完成充分性检查后再进入设计。
7. 基于 `assets/概要设计模板.md` 输出 `001-概要设计.md`。
8. 完成后提示进入 `sdlc-design-2`。

### `sdlc-design-2`

阶段 2：详细设计与施工规划。

1. 先判断需求属于短期任务（≤3天）还是中长期任务（>3天）。
2. 中长期任务必须先做模块化规划，拆分顶层模块、里程碑和当前模块任务。
3. 基于 `001-概要设计.md` 继续收集实现细节，并完成接口契约、风险与验证标准定义。
4. 使用 `assets/详细设计模板.md` 输出 `002-详细设计.md`。
5. 使用 `assets/施工文档模板.md` 输出 `003-施工文档.md`。
6. 在施工文档中明确改动文件清单、新增文件清单、作用域边界和中文注释要求。
7. 完成后提示进入 `sdlc-implement`。

### `sdlc-implement`

阶段 3：代码实现。

1. 严格按照 `003-施工文档.md` 进行编码。
2. 只允许修改准入清单中的文件，禁止越界施工。
3. 所有新增、修改代码必须在施工阶段同步补齐中文注释，不得拖延到交付后。
4. 每轮实施后同步更新 `003-施工文档.md`、`status.md` 和 `docs/[需求目录]/onlyAI/operations-log.md`。
5. 所有数据库相关脚本和语句统一落到 `docs/[需求目录]/sql/`。
6. 如有必要，可自主生成 `docs/[需求目录]/summary.md` 汇总当前阶段结果。
7. 完成后提示进入 `sdlc-test`。

### `sdlc-test`

阶段 4：质量验证与测试。

1. 使用 `assets/测试用例模板.md` 输出 `004-测试用例.md`。
2. 在 `docs/[需求目录]/onlyAI/testing.md` 与 `docs/[需求目录]/onlyAI/verification.md` 记录测试执行过程、输出和风险评估。
3. 执行测试后，使用 `assets/测试报告模板.md` 输出 `005-测试报告.md`。
4. 在 `docs/[需求目录]/onlyAI/review-report.md` 写入自我审查结论。
5. 覆盖正常路径、边界情况、非法输入和权限场景。
6. 完成后执行记忆回写；如有必要，生成 `docs/[需求目录]/summary.md` 汇总结果。

### `sdlc-debug`

排查与修复阶段。

1. 在复杂 Bug 或回归问题出现时触发。
2. 使用 `assets/Debug排查记录模板.md` 输出 `006-Debug排查记录.md`。
3. 在 `docs/[需求目录]/onlyAI/operations-log.md` 记录定位过程，在 `docs/[需求目录]/onlyAI/verification.md` 记录回归验证结果。
4. 修复完成后同步更新记忆，并在需要时补充 `docs/[需求目录]/summary.md`。

### `sdlc-solo`

全自动模式：从当前阶段自动执行到测试完成。

**适用场景**：
- 可在任何阶段开启（design-1、design-2、implement 或 test）
- 自动检测当前已完成的阶段，从下一个未完成阶段开始执行
- 适用于需求明确、边界清晰的任务

**执行流程**：
1. **阶段检测**：检查 `docs/[需求目录]/` 下的产出物，判断当前已完成哪些阶段
   - 存在 `001-概要设计.md` → design-1 已完成
   - 存在 `002-详细设计.md` 和 `003-施工文档.md` → design-2 已完成
   - 存在代码变更且 `operations-log.md` 有记录 → implement 已完成
   - 存在 `005-测试报告.md` → test 已完成

2. **工作量评估与警告**：
   - 根据需求复杂度、涉及文件数量、架构变更范围评估剩余工作量
   - **如果预计剩余工作量 > 3 天，必须向用户发出警告**：
     ```
     ⚠️ 危险警告：预计剩余工作量超过 3 天，全自动模式存在以下风险：
     - 可能产生大量代码变更，难以人工审查
     - 设计缺陷可能在后期才暴露，回退成本高
     - 复杂任务建议分阶段执行，便于中途调整
     
     是否确认继续使用 solo 模式？
     ```
   - 用户确认后才继续执行

3. **自动执行剩余阶段**：
   - 从下一个未完成阶段开始，依次自动执行：
     - `sdlc-design-1` → `sdlc-design-2` → `sdlc-implement` → `sdlc-test`
   - 每个阶段完成后自动进入下一阶段，无需用户干预
   - 如在任何阶段发现需求不明确、设计缺陷或实现受阻，立即暂停并向用户报告

4. **完成与交付**：
   - 所有阶段完成后，自动生成 `docs/[需求目录]/summary.md` 汇总交付物
   - 执行记忆回写（`update_memory` 或 `create_memory`）
   - 向用户报告完整的交付清单和关键结论

**核心约束**：
- 仍需遵守所有核心约束（前置校验、模板输出、逻辑推导、记忆回写）
- 不得跳过任何必要的设计或测试步骤
- 代码实现时严格遵守改动边界，不得越界施工
- 如发现前期设计缺陷，必须回退到 `sdlc-design-2` 更新设计文档

**使用示例**：
```bash
# 从头开始全自动执行
/software-dev-process sdlc-solo

# 在 design-2 完成后，自动执行 implement + test
/software-dev-process sdlc-solo

# 在 implement 完成后，自动执行 test
/software-dev-process sdlc-solo
```

## 可用资源

- `software-dev-process/assets/概要设计模板.md`
- `software-dev-process/assets/详细设计模板.md`
- `software-dev-process/assets/施工文档模板.md`
- `software-dev-process/assets/测试用例模板.md`
- `software-dev-process/assets/测试报告模板.md`
- `software-dev-process/assets/执行记录模板.md`
- `software-dev-process/assets/文件改动记录模板.md`
- `software-dev-process/assets/Debug排查记录模板.md`
