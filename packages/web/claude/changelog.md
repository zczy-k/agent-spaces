# 变更记录 (Changelog)

## 2026-06-12 -- workflow-editor store 深挖

- `claude/stores.md`：useWorkflowEditorStore 条目从"单文件 878 行"改为 12 文件 slice 组合，新增详解章节（入口注册表 / 25 字段 State + 57 action / 9 slice 职责表 / interaction 闭环 / 与后端 WS 契约）

## 2026-06-09 -- init-architect 扫描

- 创建 `claude/` 详情文件目录
- 从 CLAUDE.md 提取索引结构，详情拆分到 claude/*.md
- 扫描覆盖率：约 90%（250+ 源文件中已识别主要组件、Store、工具库）
