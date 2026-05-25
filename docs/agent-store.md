# Agent Store

`packages/agents` 是 Agent Spaces 的**资源商店**，存放输出风格、Prompt 模板、技能、工作流模板等可复用资源。前端通过统一的 `fetchStoreIndex` 工具函数加载，支持本地和远程两种数据源。

## 目录结构

```
packages/agents/
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

前端涉及四个消费方：

| 组件 | 加载的索引 | 用途 |
|------|-----------|------|
| `output-styles-dialog.tsx` | `output-styles/index.json` | 输出风格商店列表 |
| `prompts-dialog.tsx` | `prompt/index.json` | Prompt 模板商店列表 |
| `use-skills-data.ts` | `skills/index.json` | 技能商店列表 |
| `workflow-templates-dialog.tsx` | `workflows/index.json` → 具体 `.json` | 工作流模板导入 |

## 后端静态服务

`packages/server/src/app.ts` 将 `packages/agents` 目录挂载为 `/agents-store` 静态路径：

```ts
const agentsDir = resolveRuntimeDir('../agents');
app.use('/agents-store', express.static(agentsDir));
```

开发模式下也可独立启动 http-server：

```bash
pnpm --filter @agent-spaces/agents serve
# http://localhost:3101
```

## 添加新资源

### 1. 输出风格

在 `packages/agents/output-styles/` 下新建 `.md` 文件：

```markdown
# 风格名称

这里是输出风格的 Markdown 内容，会注入到 Agent 的 systemPrompt 中。
```

### 2. Prompt 模板

在 `packages/agents/prompt/` 下新建 `.md` 文件：

```markdown
# 模板名称

这里是 Prompt 模板内容。
```

### 3. 技能

在 `packages/agents/skills/{group}/{skill-name}/` 下新建 `SKILL.md`：

```markdown
---
name: 技能显示名称
---

技能内容...
```

### 4. 工作流模板

在 `packages/agents/workflows/` 下新建 `.json` 文件：

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

### 5. 重新生成索引

```bash
pnpm --filter @agent-spaces/agents generate-index
```

会扫描各子目录，更新对应的 `index.json`。前端通过索引文件发现新资源。

## 远程商店配置

在 **设置 → 在线商店** 中填写远程 API Base URL（如 GitHub raw 地址或自建服务器），前端会优先从该地址加载资源，留空则使用本地内置资源。
