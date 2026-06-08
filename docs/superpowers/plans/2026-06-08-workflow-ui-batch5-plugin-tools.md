# Workflow UI 自定义页面 — 批次 5：插件 Tools 集成

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Agent 注册插件 tools 渐进式发现的 function call tools，暴露 REST API 让前端 UI 代码可执行插件 tool，实现插件管理对话框。

**Architecture:** 参考 `workflow-editor-tools.ts` 模式，新建 `workflow-ui-tools.ts` 注册 3 个 function call tools（list_plugin_tools / get_plugin_tool_detail / execute_plugin_tool）。后端新增 2 个 REST API 端点暴露插件 tools 执行能力。前端新增插件管理对话框。

**Tech Stack:** Express, AgentFunctionTool, getPluginTools(), executePluginTool()

---

## File Structure

| 操作 | 文件 | 职责 |
|------|------|------|
| Create | `packages/server/src/services/builtin-tools/workflow-ui-tools.ts` | Agent function call tools |
| Modify | `packages/server/src/services/builtin-tools/index.ts` | 注册新 tools |
| Modify | `packages/server/src/routes/plugin.ts` | 新增 tools 列表 + 执行 API |
| Modify | `packages/web/src/components/workflows-ui/workflow-ui-editor.tsx` | 注入 AgentSpacesAPI |
| Create | `packages/web/src/components/workflows-ui/workflow-ui-plugin-tools-dialog.tsx` | 插件 tools 管理对话框 |

---

### Task 1: Agent Function Call Tools

**Files:**
- Create: `packages/server/src/services/builtin-tools/workflow-ui-tools.ts`

- [ ] **Step 1: 创建 tools 文件**

```typescript
// packages/server/src/services/builtin-tools/workflow-ui-tools.ts
import type { AgentFunctionTool } from '../../adapters/agent-runtime-types.js';
import { getPluginTools, executePluginTool } from '../plugin.js';
import { createBuiltinPluginApi } from '../plugin-runtime-api.js';

type JsonRecord = Record<string, unknown>;

function schema(properties: Record<string, unknown>, required?: string[]): Record<string, unknown> {
  return { type: 'object', properties, ...(required?.length ? { required } : {}) };
}

function asRecord(input: unknown): JsonRecord {
  return input && typeof input === 'object' && !Array.isArray(input) ? input as JsonRecord : {};
}

function stringInput(input: JsonRecord, key: string): string | undefined {
  const value = input[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export interface WorkflowUiToolContext {
  enabledPlugins: string[];
}

export function createWorkflowUiFunctionTools(ctx: WorkflowUiToolContext): AgentFunctionTool[] {
  const tools: AgentFunctionTool[] = [
    {
      name: 'list_plugin_tools',
      description: '列出当前 UI 项目已启用插件注册的所有 tools，返回轻量摘要（name/description）。需要执行某个 tool 时，先调用 get_plugin_tool_detail 查看参数 schema。',
      inputSchema: schema({
        pluginId: { type: 'string', description: '可选，按插件 ID 筛选' },
        keyword: { type: 'string', description: '可选，模糊搜索 tool 名称或描述' },
      }),
      annotations: { readOnly: true },
      execute: async (input) => {
        const record = asRecord(input);
        const filterPluginId = stringInput(record, 'pluginId');
        const keyword = stringInput(record, 'keyword')?.toLowerCase();

        const pluginIds = filterPluginId
          ? [filterPluginId]
          : ctx.enabledPlugins;

        const results: Array<{ pluginId: string; toolName: string; description: string }> = [];

        for (const pluginId of pluginIds) {
          try {
            const pluginTools = getPluginTools(pluginId);
            for (const tool of pluginTools) {
              if (keyword) {
                const text = `${tool.name} ${tool.description}`.toLowerCase();
                if (!text.includes(keyword)) continue;
              }
              results.push({
                pluginId,
                toolName: tool.name,
                description: tool.description,
              });
            }
          } catch {
            // plugin not found or has no tools, skip
          }
        }

        return { success: true, total: results.length, tools: results };
      },
    },
    {
      name: 'get_plugin_tool_detail',
      description: '查看指定插件 tool 的完整 input_schema 和描述。执行 tool 前建议先调用此工具查看参数要求。',
      inputSchema: schema({
        pluginId: { type: 'string', description: '插件 ID' },
        toolName: { type: 'string', description: 'Tool 名称' },
      }, ['pluginId', 'toolName']),
      annotations: { readOnly: true },
      execute: async (input) => {
        const record = asRecord(input);
        const pluginId = stringInput(record, 'pluginId');
        const toolName = stringInput(record, 'toolName');
        if (!pluginId || !toolName) {
          return { success: false, message: 'pluginId and toolName are required' };
        }

        try {
          const pluginTools = getPluginTools(pluginId);
          const tool = pluginTools.find(t => t.name === toolName);
          if (!tool) {
            return { success: false, message: `Tool "${toolName}" not found in plugin "${pluginId}"` };
          }
          return {
            success: true,
            pluginId,
            toolName: tool.name,
            description: tool.description,
            inputSchema: tool.input_schema,
          };
        } catch (error: any) {
          return { success: false, message: error.message };
        }
      },
    },
    {
      name: 'execute_plugin_tool',
      description: '执行指定插件的 tool 并返回结果。执行前必须先调用 get_plugin_tool_detail 确认参数格式。',
      inputSchema: schema({
        pluginId: { type: 'string', description: '插件 ID' },
        toolName: { type: 'string', description: 'Tool 名称' },
        args: { type: 'object', description: 'Tool 参数，按 get_plugin_tool_detail 返回的 input_schema 填写' },
      }, ['pluginId', 'toolName']),
      execute: async (input) => {
        const record = asRecord(input);
        const pluginId = stringInput(record, 'pluginId');
        const toolName = stringInput(record, 'toolName');
        if (!pluginId || !toolName) {
          return { success: false, message: 'pluginId and toolName are required' };
        }

        const args = (record.args && typeof record.args === 'object' && !Array.isArray(record.args))
          ? record.args as Record<string, any>
          : {};

        try {
          const result = await executePluginTool(pluginId, toolName, args, createBuiltinPluginApi());
          return { success: true, result };
        } catch (error: any) {
          return { success: false, message: error.message };
        }
      },
    },
  ];

  return tools;
}
```

- [ ] **Step 2: 注册到 builtin-tools/index.ts**

在 `packages/server/src/services/builtin-tools/index.ts` 末尾添加：

```typescript
export { createWorkflowUiFunctionTools, type WorkflowUiToolContext } from './workflow-ui-tools.js';
```

- [ ] **Step 3: 验证编译**

Run: `cd packages/server && npx tsc --noEmit --pretty 2>&1 | grep -i "workflow-ui-tools" || echo "OK"`

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/services/builtin-tools/workflow-ui-tools.ts packages/server/src/services/builtin-tools/index.ts
git commit -m "feat(workflow-ui): add plugin tools function call tools for Agent"
```

---

### Task 2: 插件 Tools REST API

**Files:**
- Modify: `packages/server/src/routes/plugin.ts`

- [ ] **Step 1: 在 plugin 路由中新增 tools 端点**

在 `packages/server/src/routes/plugin.ts` 中，在现有的 `router.get('/:pluginId/workflow-nodes', ...)` 路由之后添加：

```typescript
// ---- Plugin Tools ----

router.get('/:pluginId/tools', (req: Request<{ pluginId: string }>, res: Response) => {
  try {
    const tools = getPluginTools(req.params.pluginId);
    res.json(tools);
  } catch (error: any) {
    res.status(error.message.includes('not found') ? 404 : 500).json({ error: error.message });
  }
});

router.post('/:pluginId/tools/execute', async (req: Request<{ pluginId: string }>, res: Response) => {
  try {
    const { name, args } = req.body;
    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    const result = await executePluginTool(req.params.pluginId, name, args ?? {}, createBuiltinPluginApi());
    res.json({ success: true, result });
  } catch (error: any) {
    res.status(error.message.includes('not found') ? 404 : 500).json({ error: error.message });
  }
});
```

同时在文件顶部确认 import：
```typescript
import { getPluginTools, executePluginTool } from '../services/plugin.js';
import { createBuiltinPluginApi } from '../services/plugin-runtime-api.js';
```

- [ ] **Step 2: 验证编译**

Run: `cd packages/server && npx tsc --noEmit --pretty 2>&1 | grep -i "plugin.ts" || echo "OK"`

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/routes/plugin.ts
git commit -m "feat(workflow-ui): expose plugin tools list and execute REST API"
```

---

### Task 3: 前端插件 Tools 管理对话框

**Files:**
- Create: `packages/web/src/components/workflows-ui/workflow-ui-plugin-tools-dialog.tsx`

- [ ] **Step 1: 创建插件 tools 对话框**

```tsx
// packages/web/src/components/workflows-ui/workflow-ui-plugin-tools-dialog.tsx
"use client";

import { useCallback, useEffect, useState } from 'react';
import { Play, Settings, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { sdk } from '@/lib/sdk';

interface PluginTool {
  name: string;
  description: string;
  input_schema?: Record<string, unknown>;
}

interface WorkflowUiPluginToolsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enabledPlugins: string[];
}

export function WorkflowUiPluginToolsDialog({
  open,
  onOpenChange,
  enabledPlugins,
}: WorkflowUiPluginToolsDialogProps) {
  const [toolsByPlugin, setToolsByPlugin] = useState<Record<string, PluginTool[]>>({});
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !enabledPlugins.length) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      const map: Record<string, PluginTool[]> = {};
      for (const pluginId of enabledPlugins) {
        try {
          const resp = await fetch(`/api/plugins/${pluginId}/tools`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          });
          if (resp.ok) {
            map[pluginId] = await resp.json();
          }
        } catch { /* ignore */ }
      }
      if (!cancelled) {
        setToolsByPlugin(map);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [open, enabledPlugins]);

  const handleExecute = useCallback(async (pluginId: string, toolName: string) => {
    setExecuting(`${pluginId}/${toolName}`);
    setResult(null);
    try {
      const resp = await fetch(`/api/plugins/${pluginId}/tools/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ name: toolName, args: {} }),
      });
      const data = await resp.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (error: any) {
      setResult(`Error: ${error.message}`);
    } finally {
      setExecuting(null);
    }
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-4 w-4" /> 插件 Tools
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">加载中...</div>
        ) : Object.keys(toolsByPlugin).length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            未启用任何插件，或插件没有注册 tools
          </div>
        ) : (
          <ScrollArea className="max-h-96">
            <div className="space-y-4">
              {Object.entries(toolsByPlugin).map(([pluginId, tools]) => (
                <div key={pluginId}>
                  <div className="text-xs font-medium text-muted-foreground mb-1.5">
                    {pluginId}
                    <Badge variant="secondary" className="ml-2 text-[10px]">{tools.length} tools</Badge>
                  </div>
                  <div className="space-y-1">
                    {tools.map((tool) => (
                      <div
                        key={tool.name}
                        className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-mono font-medium truncate">{tool.name}</div>
                          {tool.description && (
                            <div className="text-muted-foreground truncate">{tool.description}</div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 shrink-0"
                          disabled={executing === `${pluginId}/${tool.name}`}
                          onClick={() => handleExecute(pluginId, tool.name)}
                        >
                          <Play className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {result && (
          <div className="mt-2 rounded border bg-muted/50 p-3 max-h-32 overflow-auto">
            <pre className="text-xs font-mono whitespace-pre-wrap">{result}</pre>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/components/workflows-ui/workflow-ui-plugin-tools-dialog.tsx
git commit -m "feat(workflow-ui): add plugin tools management dialog"
```

---

### Task 4: 集成到编辑器

**Files:**
- Modify: `packages/web/src/components/workflows-ui/workflow-ui-editor.tsx`

- [ ] **Step 1: 注入 AgentSpacesAPI 和插件管理按钮**

在 `workflow-ui-editor.tsx` 中：

1. 顶部添加 import：
```typescript
import { WorkflowUiPluginToolsDialog } from './workflow-ui-plugin-tools-dialog';
```

2. 在组件内添加 state：
```typescript
const [pluginDialogOpen, setPluginDialogOpen] = useState(false);
```

3. 更新 `window.AgentSpacesAPI` 注入（在 useEffect 中）：
```typescript
(window as any).AgentSpacesAPI = {
  executePluginTool: async (pluginId: string, toolName: string, args: Record<string, any>) => {
    const resp = await fetch(`/api/plugins/${pluginId}/tools/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ name: toolName, args }),
    });
    return resp.json();
  },
};
```

4. 在预览工具栏区域添加插件按钮（`WorkflowUiPreviewToolbar` props 中或紧随其后添加）：
```tsx
<Button
  variant="ghost"
  size="sm"
  className="h-6 text-xs"
  onClick={() => setPluginDialogOpen(true)}
>
  <Settings className="h-3 w-3 mr-1" /> 插件
</Button>
```

5. 在 JSX 末尾（`</div>` 之前）添加对话框：
```tsx
<WorkflowUiPluginToolsDialog
  open={pluginDialogOpen}
  onOpenChange={setPluginDialogOpen}
  enabledPlugins={project.enabledPlugins ?? []}
/>
```

- [ ] **Step 2: 验证编译**

Run: `cd packages/web && npx tsc --noEmit --pretty 2>&1 | grep -i "workflow-ui" || echo "OK"`

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/components/workflows-ui/workflow-ui-editor.tsx
git commit -m "feat(workflow-ui): integrate plugin tools into editor with AgentSpacesAPI"
```

---

## Self-Review Checklist

- [x] **Spec coverage**: 覆盖 §4 插件 Tools 集成全部（3 个 function call tools + REST API + 前端管理对话框 + AgentSpacesAPI 注入）
- [x] **Placeholder scan**: 无 TBD/TODO
- [x] **Type consistency**: 复用后端已有的 `getPluginTools()` / `executePluginTool()` / `createBuiltinPluginApi()` 函数签名
- [x] **Pattern consistency**: `schema()` / `asRecord()` / `stringInput()` 辅助函数与 `workflow-editor-tools.ts` 一致
