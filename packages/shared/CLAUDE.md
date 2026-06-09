[根目录](../../CLAUDE.md) > [packages](../) > **shared**

# @agent-spaces/shared

前后端共享的 TypeScript 类型定义包。零运行时依赖，定义了 Agent Spaces 全部核心数据模型、WebSocket 事件契约、结构化消息 Parts、内置工具声明（35 个）、Workflow DAG 模型、插件系统、订阅管理等接口类型。server 和 web 包通过 `import type { ... } from '@agent-spaces/shared'` 引用。

包含 28 个源文件，覆盖 27 个类型子模块：工作空间、Agent 配置（4 种内置角色 + 6 种运行时）、议题（9 种状态）、任务（8 种状态）、频道/消息（11 种 MessagePart）、Git 操作、LLM 模型、Workflow DAG（Unified Workflow Types）、执行事件（11 通道）、错误码（16 种）、插件系统（50+ Channel Contract）、快捷命令、订阅管理、代码搜索、应用内通知、语音识别、代码收藏、Hook 配置（21 种事件）、文档数据库（Notion 风格 + 向量搜索）、Kanban 看板、Git Worktree 并行开发。

## 约定的规则

- TypeScript strict 模式，ESNext 模块，ES2022 target，bundler 模块解析
- 状态字段使用联合字面量类型（非 `enum`）
- 导入路径使用 `.js` 后缀（ESM 规范）
- 使用 `import type` 语法导入纯类型
- 聚合导出：`src/index.ts` -> `src/types/index.ts` -> 27 个子模块
- 时间戳格式：核心业务模型用 ISO 字符串，Workflow 模型用 Unix 毫秒（历史原因）
- 文件名使用 kebab-case

## 文件索引

| 文件 | 说明 |
|------|------|
| [claude/overview.md](claude/overview.md) | 架构总览、定位、技术栈、目录结构、设计原则 |
| [claude/conventions.md](claude/conventions.md) | 开发约定：命名规范、导出规范、时间戳格式、编译选项 |
| [claude/module-responsibilities.md](claude/module-responsibilities.md) | 27 个子模块的职责划分（核心业务/基础设施/Workflow/辅助功能） |
| [claude/entrypoints.md](claude/entrypoints.md) | 入口文件、构建命令、构建产物、消费方式 |
| [claude/public-interfaces.md](claude/public-interfaces.md) | 对外接口：全部导出的类型、接口、常量、函数清单 |
| [claude/dependencies-and-config.md](claude/dependencies-and-config.md) | 依赖关系、构建配置、编译选项、构建顺序 |
| [claude/data-model.md](claude/data-model.md) | 数据模型：实体关系图、状态枚举汇总、时间戳格式、关键类型详解 |
| [claude/testing-and-quality.md](claude/testing-and-quality.md) | 测试现状、验证命令、质量工具 |
| [claude/file-map.md](claude/file-map.md) | 文件地图：源码结构、文件统计、领域分类 |
| [claude/faq.md](claude/faq.md) | 常见问题（29 个 Q&A） |
| [claude/changelog.md](claude/changelog.md) | 变更记录 |

## 扫描状态

- **更新时间**：2026-06-09 11:35:59
- **源文件总数**：28（1 入口 + 1 类型汇总 + 27 类型文件，不含配置文件）
- **已扫描文件数**：28
- **覆盖率**：100%
- **跳过范围**：`dist/`（编译产物）、`node_modules/`
- **缺口**：无
