# Agent Store

`packages/templates` 是 Agent Spaces 的**资源商店**，存放输出风格、Prompt 模板、技能、工作流模板、插件等可复用资源。前端通过统一的 `fetchStoreIndex` 工具函数加载，支持本地和远程两种数据源。

## 目录结构

```
packages/templates/
  package.json              # @agent-spaces/agents，含 generate-index 和 serve 脚本
  generate-index.mjs        # 扫描各子目录，生成 index.json 索引文件
  output-styles/            # 输出风格模板（.md）
    index.json
    carmack-mode.md
    linus-mode.md
    ...
  prompt/                   # Prompt 模板（.md）
    index.json
    andrej-karpathy-skills.md
    ...
  skills/                   # 技能（按 group/skill-name/SKILL.md 组织）
    index.json
    planning-with-files/
    superpowers/
    ...
  workflows/                # 工作流模板（.json）
    index.json
    code-writing.json
  plugins/                  # Workflow 插件模板（按插件目录组织）
    index.json
    index_zh.json
    index_en.json
    fetch/
    openai/
    ...
```

## 前端加载链路

```
Settings 对话框配置 API Base URL（localStorage 持久化）
  ↓
fetchStoreIndex(path)  ← lib/agent-store.ts
  ↓
有配置 → {apiBase}/{path}    无配置 → /agents-store/{path}
  ↓
返回 JSON 数据（索引或具体资源文件）
```

前端涉及五个消费方：

| 组件 | 加载的索引 | 用途 |
|------|-----------|------|
| `output-styles-dialog.tsx` | `output-styles/index.json` | 输出风格商店列表 |
| `prompts-dialog.tsx` | `prompt/index.json` | Prompt 模板商店列表 |
| `use-skills-data.ts` | `skills/index.json` | 技能商店列表 |
| `workflow-templates-dialog.tsx` | `workflows/index.json` → 具体 `.json` | 工作流模板导入 |
| `workflow-plugins-dialog.tsx` | `plugins/index_{locale}.json`，失败回退 `plugins/index.json` | Workflow 插件商店安装 |

## 后端静态服务

`packages/server/src/app.ts` 将 `packages/templates` 目录挂载为 `/agents-store` 静态路径：

```ts
const agentsDir = resolveRuntimeDir('../templates');
app.use('/agents-store', express.static(agentsDir));
```

开发模式下也可独立启动 http-server：

```bash
pnpm --filter @agent-spaces/agents serve
# http://localhost:3101
```

## 添加新资源

### 1. 输出风格

在 `packages/templates/output-styles/` 下新建 `.md` 文件：

```markdown
# 风格名称

这里是输出风格的 Markdown 内容，会注入到 Agent 的 systemPrompt 中。
```

### 2. Prompt 模板

在 `packages/templates/prompt/` 下新建 `.md` 文件：

```markdown
# 模板名称

这里是 Prompt 模板内容。
```

### 3. 技能

在 `packages/templates/skills/{group}/{skill-name}/` 下新建 `SKILL.md`：

```markdown
---
name: 技能显示名称
---

技能内容...
```

### 4. 工作流模板

在 `packages/templates/workflows/` 下新建 `.json` 文件：

```json
{
  "id": "my-workflow",
  "name": "我的工作流",
  "description": "工作流描述",
  "data": {
    "name": "工作流名称",
    "description": "详细描述",
    "nodes": [...],
    "edges": [...],
    "agents": { ... }
  }
}
```

### 5. 插件

在 `packages/templates/plugins/{plugin-dir}/` 下放置插件目录，推荐包含 `info.json` 或 `plugin.json`：

```json
{
  "id": "my.workflow.plugin",
  "name": "我的 Workflow 插件",
  "version": "1.0.0",
  "description": "插件描述",
  "hasWorkflow": true,
  "entries": {
    "workflow": "workflow.js"
  }
}
```

#### 插件商店多语言字段

插件商店卡片只读取 manifest 中的插件级文案：`name`、`description`、`tags`。这些字段支持语言后缀：

- `name_zh` / `name_en`
- `description_zh` / `description_en`
- `tags_zh` / `tags_en`

示例：

```json
{
  "id": "my.workflow.plugin",
  "name": "我的 Workflow 插件",
  "name_zh": "我的 Workflow 插件",
  "name_en": "My Workflow Plugin",
  "version": "1.0.0",
  "description": "插件描述",
  "description_zh": "插件描述",
  "description_en": "Plugin description",
  "tags": ["示例"],
  "tags_zh": ["示例"],
  "tags_en": ["Example"],
  "hasWorkflow": true,
  "entries": {
    "workflow": "workflow.js"
  }
}
```

`generate-index.mjs` 会为插件商店生成多个索引：

- `plugins/index.json`：默认索引，兼容旧前端和未做多语言的远程商店
- `plugins/index_zh.json`：中文索引，优先读取 `_zh` 字段
- `plugins/index_en.json`：英文索引，优先读取 `_en` 字段

语言后缀字段缺失时，会回退到无后缀字段。例如 `name_en` 缺失时使用 `name`。

插件 action 运行时的多语言不通过商店索引处理。workflow node 的 `label`、`description`、字段 tooltip、执行结果 `message` 应放在插件目录下的 `lang.json`，由插件运行时传入的 `t(key, fallback)` 处理。调试日志统一使用英文，不使用多语言。

### 6. 重新生成索引

```bash
pnpm --filter @agent-spaces/agents generate-index
```

会扫描各子目录，更新对应的 `index.json`。前端通过索引文件发现新资源。

## 前端多语言请求方式

前端加载插件商店时，应基于当前 UI 语言请求对应索引：

```ts
const { locale } = useLocale()

try {
  const plugins = await fetchStoreIndex<StoreWorkflowPlugin>(`plugins/index_${locale}.json`)
  setStorePlugins(plugins)
} catch {
  const plugins = await fetchStoreIndex<StoreWorkflowPlugin>('plugins/index.json')
  setStorePlugins(plugins)
}
```

实现要求：

- 当前插件商店索引支持 `zh` 和 `en`
- 必须保留 `plugins/index.json` 回退，避免远程商店未发布多语言索引时列表不可用
- 切换语言后应重新加载插件商店索引
- 安装插件时仍使用插件目录路径，例如 `resolveStoreUrl(\`plugins/${plugin.path}\`)`
- 不要把语言后缀拼到插件目录路径或插件下载路径上

目前 `packages/web/src/components/workflow/workflow-plugins-dialog.tsx` 已按该模式实现：读取 `useLocale()`，优先请求 `plugins/index_${locale}.json`，失败后回退 `plugins/index.json`。

## 远程商店配置

在 **设置 → 在线商店** 中填写远程 API Base URL（如 GitHub raw 地址或自建服务器），前端会优先从该地址加载资源，留空则使用本地内置资源。
