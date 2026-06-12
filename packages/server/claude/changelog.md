# 变更记录 (Changelog)

## 2026-06-12 -- Workflow 引擎 + 存储层深挖

- `claude/architecture.md`：Workflow 章节从概述扩为完整架构（6 核心文件 / 会话生命周期 / 执行流程 5 道关卡 / 22+ 节点类型 / 循环 AsyncLocalStorage / switch 分支剪枝 / 变量模板 / 事件流 / 触发器 / 端到端数据流）
- 新建 `claude/storage.md`：21 个 store 索引 + 数据目录布局（workflow-store 目录式范例）+ 写入约定
- `CLAUDE.md` 文件索引新增 storage.md 链接
- 关键文件行数校正：execution-manager.ts 实际 2043 行（原记 1757）

## 2026-06-09 -- init-architect 扫描

- 创建 `claude/` 详情文件目录
- 从 CLAUDE.md 提取架构详解和路由索引，拆分到 claude/*.md
- 扫描覆盖率：约 90%（173 个源文件中已识别全部路由、服务、适配器）
