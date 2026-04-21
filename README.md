# Prompt Engineering Repository

个人 Prompt 工程仓库，包含自定义 Claude Code Skills 和相关配置。

## 目录结构

```
.
├── .claude/                 # Claude Code 配置目录
├── skills/                  # 自定义 Skills 集合
├── software-dev-process/    # 软件开发流程 Skill
└── LICENSE                  # 许可证文件
```

## Skills

### software-dev-process

软件开发生命周期（SDLC）管理 Skill，提供从需求理解到测试交付的完整流程支持。

**主要功能**：
- `sdlc-design-1` - 需求理解与概要设计
- `sdlc-design-2` - 详细设计与施工规划
- `sdlc-implement` - 代码实现
- `sdlc-test` - 质量验证与测试
- `sdlc-debug` - 问题排查与修复
- `sdlc-solo` - 全自动模式（从当前阶段自动执行到测试完成）

**核心特性**：
- 阶段驱动与前置校验
- 强制逻辑推导（sequential-thinking + brainstorming）
- 系统化知识管理（按系统名称组织知识库）
- 全自动模式（工作量 > 3 天时强制警告）
- 完整的中文文档模板

详见：[software-dev-process/README.md](software-dev-process/README.md)

## 使用方法

1. 克隆本仓库到本地
2. 在 Claude Code 中加载对应的 Skill
3. 使用 `/software-dev-process <command>` 调用相应功能

## 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件
