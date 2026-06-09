# 测试与质量

## 当前状态

项目当前以手动测试为主，自动化测试覆盖有限。

## 后端（server）

- 无独立单元测试或集成测试
- TypeScript 编译验证类型正确性
- zod Schema 校验 API 请求参数

## 前端（web）

- ESLint：`pnpm lint`（eslint + eslint-config-next）
- 无单元测试或 E2E 测试
- TypeScript 编译验证类型正确性

## Flutter

- 冒烟测试：`flutter test`（验证 App 可构建）
- flutter_lints 规则集

## 验证命令

```bash
# 类型检查（间接验证 shared 类型正确性）
pnpm build

# 前端 Lint
cd packages/web && pnpm lint

# Flutter 测试
cd packages/flutter && flutter test
```

## 质量工具

| 工具 | 配置文件 | 范围 |
|------|----------|------|
| TypeScript | `packages/*/tsconfig.json` | 全项目 |
| ESLint | `packages/web/eslint.config.mjs` | web |
| zod | 后端路由层 | server |
| flutter_lints | `packages/flutter/analysis_options.yaml` | flutter |
