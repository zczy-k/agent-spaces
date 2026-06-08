[根目录](../../CLAUDE.md) > [packages](../) > **templates**

# @agent-spaces/agents

## 模块职责

Agent 预设模板库。提供 324 个模板文件，覆盖 Agent 预设（184 个）、Chat Agent 预设（6 个）、MCP 服务器配置（9 个）、Skills（15 个）、Workflow Plugins（107 个）、Workflow 模板、Prompt 模板、Output Style 模板等多种类型。通过 `generate-index.mjs` 自动生成索引文件，支持 Store 在线导入。

## 入口与启动

- **索引入口**：各子目录的 `index.json`（由 `generate-index.mjs` 自动生成）
- **索引生成**：`pnpm generate-index` -- 扫描所有模板目录，解析 YAML frontmatter，生成统一索引
- **本地服务**：`pnpm serve` -- http-server 静态文件服务（端口 3101），供 Store 浏览

## 目录结构

```
templates/
├── agents/          # 184 个 Agent 预设模板（15 个分类）
│   ├── index.json   # 索引文件（1,473 行）
│   ├── academic/    # 学术（5）
│   ├── design/      # 设计（8）
│   ├── engineering/ # 工程（29）
│   ├── finance/     # 金融（5）
│   ├── game-development/ # 游戏开发（20）
│   ├── marketing/   # 营销（30）
│   ├── paid-media/  # 付费媒体（7）
│   ├── product/     # 产品（5）
│   ├── project-management/ # 项目管理（6）
│   ├── sales/       # 销售（8）
│   ├── spatial-computing/ # 空间计算（6）
│   ├── specialized/ # 专用（41）
│   ├── support/     # 支持（6）
│   └── testing/     # 测试（8）
├── chat/            # 6 个 Chat Agent 预设模板（**新增**）
│   ├── index.json   # 索引文件
│   ├── chat-code-assistant.md        # 编程助手
│   ├── chat-creative-consultant.md   # 创意顾问
│   ├── chat-data-analyst.md          # 数据分析师
│   ├── chat-study-tutor.md           # 学习导师
│   ├── chat-translation-assistant.md # 翻译助手
│   └── chat-writing-assistant.md     # 写作助手
├── mcps/            # 9 个 MCP 服务器模板
│   ├── index.json
│   └── *.json       # brave-search, fetch, filesystem, git, github, memory, puppeteer, sqlite, everything
├── skills/          # 15 个 Skill 模板
│   ├── index.json
│   ├── planning-with-files/ # 1 个
│   └── superpowers/         # 14 个
├── plugins/         # 107 个 Plugin 模板
│   └── index.json
├── workflows/       # Workflow 模板
│   ├── index.json
│   └── code-writing.json  # 4 节点 4 Agent 工作流
├── prompt/          # Prompt 模板
│   └── index.json
├── output-styles/   # Output Style 模板
│   └── index.json
└── generate-index.mjs  # 索引自动生成脚本
```

## 模板格式

### Agent 模板（Markdown + YAML frontmatter）

```markdown
---
name: Agent Name
description: Brief description
color: "#color"
emoji: "🤖"
vibe: Short personality tagline
---

# Agent Name

## 🧠 Your Identity & Memory
## 🎯 Your Core Mission
## 🚨 Critical Rules
## 📋 Core Capabilities
## 🔄 Workflow Process
## 💭 Communication Style
## 🎯 Success Metrics
## 🚀 Advanced Capabilities
```

### Chat Agent 模板（Markdown + YAML frontmatter）

与 Agent 模板格式相同，但 group 为 `chat`，用于 Chat 独立页面的 Agent 预设导入。

6 个 Chat Agent 模板：

| ID | 名称 | Emoji | 说明 |
|----|------|-------|------|
| `chat-code-assistant` | Code Assistant | 💻 | 全栈编程专家，编写/审查/调试/解释代码 |
| `chat-creative-consultant` | Creative Consultant | 💡 | 创意策划，产品/营销/命名/设计思维 |
| `chat-data-analyst` | Data Analyst | 📊 | 数据分析，Python/SQL/统计/可视化 |
| `chat-study-tutor` | Study Tutor | 🎓 | 自适应学习导师，数学/科学/历史/语言 |
| `chat-translation-assistant` | Translation Assistant | 🌐 | 50+ 语言专业翻译，上下文感知 |
| `chat-writing-assistant` | Writing Assistant | ✍️ | 专业写作编辑，文章/邮件/文档/创意 |

### 索引格式

```json
{
  "id": "engineering-ai-engineer",
  "name": "AI Engineer",
  "group": "engineering",
  "path": "engineering/engineering-ai-engineer",
  "description": "Expert AI/ML engineer...",
  "emoji": "🤖"
}
```

## 依赖

- 无外部依赖（纯静态模板资源）

## 关键设计

- **自动索引**：`generate-index.mjs` 解析 YAML frontmatter 自动生成各子目录 `index.json`
- **分类体系**：Agent 按功能域分为 15 个分类，每个分类独立目录；Chat Agent 独立 chat/ 目录
- **Store 集成**：通过 HTTP 静态服务暴露给 Agent Store 在线导入
- **多模板类型**：统一管理 Agent/ChatAgent/MCP/Skill/Plugin/Workflow/Prompt/OutputStyle 八种模板

## 变更记录 (Changelog)