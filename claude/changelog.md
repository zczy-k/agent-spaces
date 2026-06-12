# 变更记录 (Changelog)

## 2026-06-12 -- init-architect 增量更新

- 增量扫描全部 7 个模块的 package.json / pubspec.yaml / 入口与目录结构
- 补建 `packages/dom-inspector-hook/CLAUDE.md`（此前缺失，确认 2 源文件 + 3 公开导出）
- 根 CLAUDE.md：补充 Mermaid 图缺失的 dom-inspector-hook 节点 click 链接、刷新模块源文件计数与运行命令（新增 `up` / `lint` / `publish`）
- 覆盖率：约 88%
- 主要缺口：server service 子模块细节、web `components/` 部分子目录、flutter/templates 内容样本

## 2026-06-09 -- init-architect 扫描

- 初始化 `claude/` 详情文件目录（11 个详情文件）
- 生成根级轻量索引 CLAUDE.md（从 600+ 行旧版拆分为索引 + 详情）
- 生成 shared / sdk / server / web / flutter / templates 六个模块的 CLAUDE.md + claude/
- 覆盖全部 7 个模块包
- 扫描覆盖率：约 85%
