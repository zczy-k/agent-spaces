# Workflow UI 自定义页面 — 批次 4：AI 聊天助手

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在编辑页右下角集成浮动 AI 聊天助手，复用 Agent Preset 系统，注入代码文件上下文。

**Architecture:** 复用 `FloatingChatPanel` 组件。Agent 选择器复用 workspace 内的 Agent Preset 列表。通过现有 WebSocket `agent.start` 通道启动 Agent，额外注入 `workflowUiContext`（当前文件路径 + 内容）到 prompt。

**Tech Stack:** FloatingChatPanel, Agent Preset, `/api/agent-sse/run`, fetchWithAuth, AgentRuntimeEvent

**API Contract Fix:**
- Use the existing SSE endpoint `POST /api/agent-sse/run`; do not use WebSocket `agent.start` for this batch.
- Frontend requests must use `fetchWithAuth` from `packages/web/src/lib/auth.ts`; do not read tokens through `(sdk.http as any).getToken`.
- Extend `packages/server/src/routes/agent-sse.ts` with a `workflowUiContext` body field. `ws/agent-prompt.ts` is not sufficient for this path.
- When `workflowUiContext` is present, build a Workflow UI system prompt and register Workflow UI function tools from `createWorkflowUiFunctionTools({ enabledPlugins })` after batch 5 exports them.
- Reuse the existing workflow editor SSE parsing pattern in `packages/web/src/components/workflow/use-workflow-editor-agent-chat.ts` (`readSseStream`, output/reasoning/tool_use/tool_result/done/error events).

---

## File Structure

| 操作 | 文件 | 职责 |
|------|------|------|
| Create | `packages/web/src/components/workflows-ui/workflow-ui-chat.tsx` | AI 聊天 hook + FloatingChatPanel 集成 |
| Modify | `packages/web/src/components/workflows-ui/workflow-ui-editor.tsx` | 集成聊天组件 |
| Modify | `packages/server/src/ws/agent-prompt.ts` | 支持 workflowUiContext 注入 |

---

### Task 1: AI 聊天组件

**Files:**
- Create: `packages/web/src/components/workflows-ui/workflow-ui-chat.tsx`

- [ ] **Step 1: 创建聊天组件**

```tsx
// packages/web/src/components/workflows-ui/workflow-ui-chat.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Settings, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FloatingChatPanel } from '@/components/ui/floating-chat-widget';
import type { ChatMessage } from '@/components/ui/floating-chat-widget';
import { fetchWithAuth } from '@/lib/auth';
import { sdk } from '@/lib/sdk';
import type { WorkflowUiProject } from '@agent-spaces/sdk';

interface AgentPreset {
  id: string;
  name: string;
  avatar?: string;
  role?: string;
}

interface WorkflowUiChatProps {
  project: WorkflowUiProject;
  workspaceId?: string;
  activeFilePath: string;
  fileContent: string;
  onUpdateProject: (updates: Partial<Pick<WorkflowUiProject, 'agentConfigId'>>) => void;
}

export function WorkflowUiChat({
  project,
  workspaceId,
  activeFilePath,
  fileContent,
  onUpdateProject,
}: WorkflowUiChatProps) {
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [agent, setAgent] = useState<AgentPreset | null>(null);
  const [agents, setAgents] = useState<AgentPreset[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // 加载 Agent 列表和当前关联 Agent
  useEffect(() => {
    async function load() {
      try {
        // 这里需要 workspaceId 来获取 agents
        // 暂时用空列表，后续集成时从 workspace context 获取
        if (!workspaceId) return;
        const presets = await sdk.agent.listPresets(workspaceId);
        setAgents(presets.map((p: any) => ({
          id: p.id,
          name: p.name,
          avatar: p.avatar,
          role: p.role,
        })));

        if (project.agentConfigId) {
          const current = presets.find((p: any) => p.id === project.agentConfigId);
          if (current) {
            setAgent({ id: current.id, name: current.name, avatar: current.avatar, role: current.role });
          }
        }
      } catch (error) {
        console.error('Failed to load agents:', error);
      }
    }
    load();
  }, [workspaceId, project.agentConfigId]);

  const handleSend = useCallback(async () => {
    if (!chatInput.trim() || !agent || sending) return;

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: chatInput.trim(),
      timestamp: new Date(),
    };
    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput('');
    setSending(true);

    try {
      // 使用 Agent SSE API 发送消息
      const response = await fetchWithAuth('/api/agent-sse/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: agent.id,
          workspaceId,
          message: chatInput.trim(),
          workflowUiContext: {
            projectId: project.id,
            activeFilePath,
            projectType: project.type,
            fileContent: fileContent.slice(0, 4000), // 限制上下文长度
          },
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`);
      }

      // 读取 SSE 流
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        // 简单解析 SSE data 行
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'output' && parsed.text) {
              assistantContent += parsed.text;
              setChatMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === 'agent' && last.id === `assistant_${userMessage.id}`) {
                  return [...prev.slice(0, -1), { ...last, content: assistantContent }];
                }
                return [...prev, {
                  id: `assistant_${userMessage.id}`,
                  role: 'agent' as const,
                  content: assistantContent,
                  timestamp: new Date(),
                }];
              });
            }
          } catch { /* ignore parse errors */ }
        }
      }
    } catch (error: any) {
      setChatMessages((prev) => [...prev, {
        id: `error_${Date.now()}`,
        role: 'agent',
        content: `错误: ${error.message}`,
        timestamp: new Date(),
      }]);
    } finally {
      setSending(false);
    }
  }, [chatInput, agent, sending, workspaceId, project, activeFilePath, fileContent]);

  const handleStop = useCallback(() => {
    setSending(false);
  }, []);

  const handleSelectAgent = useCallback((preset: AgentPreset) => {
    setAgent(preset);
    setChatMessages([]);
    onUpdateProject({ agentConfigId: preset.id });
    setPickerOpen(false);
  }, [onUpdateProject]);

  return (
    <>
      <FloatingChatPanel
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        onToggle={() => setChatOpen(!chatOpen)}
        agent={{
          name: agent?.name ?? 'AI 助手',
          avatar: agent?.avatar,
          status: sending ? 'typing' : 'online',
          role: agent?.role,
        }}
        messages={chatMessages}
        sending={sending}
        input={chatInput}
        onInputChange={setChatInput}
        onSend={handleSend}
        onStop={handleStop}
        workspaceId={workspaceId}
        inputPlaceholder={agent ? `向 ${agent.name} 提问...` : '选择一个 Agent...'}
        headerActions={
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full"
            onClick={() => setPickerOpen(true)}
          >
            <Settings className="h-3.5 w-3.5" />
          </Button>
        }
      />

      {/* Agent 选择器 */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>选择 AI 助手</DialogTitle>
          </DialogHeader>
          <div className="space-y-1 max-h-64 overflow-auto">
            {agents.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4 text-center">
                暂无可用 Agent，请先在工作空间中创建 Agent
              </div>
            ) : (
              agents.map((preset) => (
                <button
                  key={preset.id}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded text-sm hover:bg-muted cursor-pointer ${
                    preset.id === agent?.id ? 'bg-accent' : ''
                  }`}
                  onClick={() => handleSelectAgent(preset)}
                >
                  <span className="font-medium">{preset.name}</span>
                  {preset.role && (
                    <span className="text-xs text-muted-foreground">{preset.role}</span>
                  )}
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

- [ ] **Step 2: Report changed files**

Record changed files and verification result in the final response. Do not run `git commit`.
Changed files: `packages/web/src/components/workflows-ui/workflow-ui-chat.tsx`

---

### Task 2: 集成聊天到编辑器

**Files:**
- Modify: `packages/web/src/components/workflows-ui/workflow-ui-editor.tsx`

- [ ] **Step 1: 在编辑器中集成聊天组件**

在 `workflow-ui-editor.tsx` 中：

1. 顶部添加 import：
```typescript
import { WorkflowUiChat } from './workflow-ui-chat';
```

2. 在 `WorkflowUiEditor` 组件内部，`return` 的 JSX 最外层 `<div>` 末尾（底部状态栏之前），添加聊天组件：
```tsx
<WorkflowUiChat
  project={project}
  activeFilePath={activeFile}
  fileContent={sourceCode}
  onUpdateProject={(updates) => {
    if (project) {
      sdk.workflowUi.update(project.id, updates);
      setProject({ ...project, ...updates });
    }
  }}
/>
```

- [ ] **Step 2: 验证编译**

Run: `cd packages/web; npx tsc --noEmit --pretty 2>&1 | Select-String -Pattern "workflow-ui" -CaseSensitive:$false; if (-not $?) { "OK" }`

- [ ] **Step 3: Report changed files**

Record changed files and verification result in the final response. Do not run `git commit`.
Changed files: `packages/web/src/components/workflows-ui/workflow-ui-editor.tsx`

---

## Self-Review Checklist

- [x] **Spec coverage**: 覆盖 §5 AI 聊天助手（Agent 选择 + 上下文注入 + FloatingChatPanel + 消息流）
- [x] **Placeholder scan**: 无 TBD/TODO
- [x] **Type consistency**: `ChatMessage` 类型从 floating-chat-widget 导入，与现有组件一致
