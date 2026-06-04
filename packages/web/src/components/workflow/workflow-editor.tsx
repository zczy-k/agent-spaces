'use client';

import { ReactFlowProvider } from '@xyflow/react';
import { useCallback, useState } from 'react';
import type { AgentConfig, Workflow, WorkflowTemplate } from '@agent-spaces/shared';
import { WorkflowCanvas } from './workflow-canvas';
import { WorkflowNodeSidebar } from './workflow-node-sidebar';
import { WorkflowEditorToolbar } from './workflow-editor-toolbar';
import { WorkflowPropertiesPanel } from './workflow-properties-panel';
import { WorkflowExecutionBar } from './workflow-execution-bar';
import { WorkflowVersionPanel } from './workflow-version-panel';
import { WorkflowOperationHistory } from './workflow-operation-history';
import { WorkflowStagingPanel } from './workflow-staging-panel';
import { WorkflowTriggerDialog } from './workflow-trigger-dialog';
import { WorkflowEmbeddedEditor } from './workflow-embedded-editor';
import { WorkflowInteractionDialog } from './workflow-interaction-dialog';
import { WorkflowPluginsDialog } from './workflow-plugins-dialog';
import { WorkflowPluginPickerDialog } from './workflow-plugin-picker-dialog';
import { WorkflowNodeSelectDialog } from './workflow-node-select-dialog';
import { FloatingChatPanel, type ChatMessage } from '@/components/ui/floating-chat-widget';
import { AgentEditor } from '@/components/sidebar/agent-editor';
import { normalizeAgent, newAgentDraft, type AgentPreset } from '@/components/sidebar/agent-shared';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ResizablePanel, ResizableHandle, ResizablePanelGroup } from '@/components/ui/resizable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, AlertCircle, CheckCircle2, ChevronDown, Settings2, Trash2, Wrench } from 'lucide-react';
import { useEditorShortcuts, useClipboard, useExecutionPanel } from '@/hooks/use-workflow-editor';
import { Button } from '@/components/ui/button';
import { fetchWithAuth } from '@/lib/auth';
import { allNodeDefinitions } from '@/lib/workflow-nodes';
import { cn } from '@/lib/utils';
import { useWorkspaceStore } from '@/stores/workspace';
import { useWorkflowEditorState } from './use-workflow-editor-state';
import { useWorkflowEditorCanvas } from './use-workflow-editor-canvas';
import { useWorkflowEditorExecution } from './use-workflow-editor-execution';

// ---- Inner editor (needs ReactFlow context) ----

interface WorkflowToolCall {
  id: string;
  name: string;
  input?: unknown;
  result?: unknown;
  status: 'running' | 'success' | 'error';
}

interface WorkflowAgentChatMessage extends ChatMessage {
  toolCalls?: WorkflowToolCall[];
}

interface SseEvent {
  event: string;
  data: unknown;
}

const WORKFLOW_AGENT_TEMPLATE_ID = 'workflow-editor-agent';
const WORKFLOW_AGENT_FIXED_SYSTEM_PROMPT = '工作流编辑助手提示词由系统根据当前画布动态生成，不能在模型设置中修改。';
const WORKFLOW_AGENT_FIXED_VALUES: Partial<AgentPreset> = {
  name: '工作流助手',
  role: 'agent',
  description: '帮助编辑当前可视化工作流的 LangChain Agent',
  runtimeKind: 'langchain',
  workingDir: '',
  mcps: {},
  skills: [],
  tools: [],
  systemPrompt: WORKFLOW_AGENT_FIXED_SYSTEM_PROMPT,
  templateId: WORKFLOW_AGENT_TEMPLATE_ID,
  enabled: true,
};

function WorkflowEditorInner({
  template, onBack,
}: {
  template: WorkflowTemplate | null;
  onBack: () => void;
}) {
  // ---- State ----
  const state = useWorkflowEditorState(template);
  const workspaces = useWorkspaceStore((store) => store.workspaces);
  const workspaceId = workspaces[0]?.id;
  const [agentOpen, setAgentOpen] = useState(false);
  const [agentInput, setAgentInput] = useState('');
  const [agentSending, setAgentSending] = useState(false);
  const [agentMessages, setAgentMessages] = useState<WorkflowAgentChatMessage[]>([]);
  const [agentSettingsOpen, setAgentSettingsOpen] = useState(false);
  const [agentSettingsDraft, setAgentSettingsDraft] = useState<AgentPreset | null>(null);
  const [agentSettingsLoading, setAgentSettingsLoading] = useState(false);

  const canvas = useWorkflowEditorCanvas({
    workflow: state.workflow,
    setWorkflow: state.setWorkflow,
    markDirty: state.markDirty,
    pushUndo: state.pushUndo,
    selectedNodeId: state.selectedNodeId,
    setSelectedNodeId: state.setSelectedNodeId,
  });

  const execution = useWorkflowEditorExecution({
    workflow: state.workflow,
    workflowId: state.workflowId,
  });

  const { isExpanded: execExpanded, toggle: toggleExec } = useExecutionPanel();
  const clipboard = useClipboard();

  const appendAssistantContent = useCallback((messageId: string, content: string) => {
    setAgentMessages((messages) => messages.map((message) => (
      message.id === messageId
        ? { ...message, content: message.content ? `${message.content}\n${content}` : content }
        : message
    )));
  }, []);

  const appendToolCall = useCallback((messageId: string, toolCall: WorkflowToolCall) => {
    setAgentMessages((messages) => messages.map((message) => (
      message.id === messageId
        ? { ...message, toolCalls: [...(message.toolCalls ?? []), toolCall] }
        : message
    )));
  }, []);

  const completeLatestToolCall = useCallback((messageId: string, toolName: string, result: unknown) => {
    setAgentMessages((messages) => messages.map((message) => {
      if (message.id !== messageId || !message.toolCalls?.length) return message;
      const toolCalls = [...message.toolCalls];
      const index = findLastIndex(toolCalls, (toolCall) => toolCall.name === toolName && toolCall.status === 'running');
      if (index === -1) return message;
      toolCalls[index] = {
        ...toolCalls[index],
        result,
        status: isSuccessfulToolResult(result) ? 'success' : 'error',
      };
      return { ...message, toolCalls };
    }));
  }, []);

  const applyWorkflowPatch = useCallback((result: unknown) => {
    const patch = readWorkflowPatch(result);
    if (!patch || patch.workflow_id !== state.workflow?.id) return;
    state.pushUndo('workflow agent edit');
    state.setWorkflow((workflow) => workflow ? {
      ...workflow,
      nodes: patch.nodes,
      edges: patch.edges,
      updatedAt: patch.updatedAt ?? Date.now(),
    } : workflow);
    state.markDirty();
  }, [state]);

  const openAgentSettings = useCallback(async () => {
    setAgentSettingsOpen(true);
    setAgentSettingsLoading(true);
    try {
      setAgentSettingsDraft(await resolveWorkflowAgentSettingsDraft());
    } finally {
      setAgentSettingsLoading(false);
    }
  }, []);

  const sendWorkflowAgentMessage = useCallback(async () => {
    const prompt = agentInput.trim();
    if (!prompt || agentSending || !state.workflow) return;

    const userMessage: WorkflowAgentChatMessage = {
      id: `workflow-agent-user-${Date.now()}`,
      role: 'user',
      content: prompt,
      timestamp: new Date(),
    };
    const assistantId = `workflow-agent-assistant-${Date.now()}`;
    const assistantMessage: WorkflowAgentChatMessage = {
      id: assistantId,
      role: 'agent',
      content: '',
      timestamp: new Date(),
      toolCalls: [],
    };

    setAgentMessages((messages) => [...messages, userMessage, assistantMessage]);
    setAgentInput('');
    setAgentSending(true);

    try {
      const preset = await resolveWorkflowAgentPreset();
      if (!preset) {
        appendAssistantContent(assistantId, '请先点击右上角模型设置，保存工作流助手的模型提供商、模型和 API Key。');
        return;
      }
      if (!preset.apiKey || !preset.modelId || !preset.modelProvider) {
        appendAssistantContent(assistantId, '工作流助手的模型配置不完整。请先在右上角模型设置中补全提供商、模型和 API Key。');
        return;
      }

      const selectedNodes = state.selectedNode ? [state.selectedNode] : [];
      const response = await fetchWithAuth('/api/agent-sse/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          agentId: preset.id,
          prompt,
          maxTurns: 40,
          messages: agentMessages
            .filter((message) => message.content.trim())
            .map((message) => ({
              senderId: message.role === 'user' ? 'user' : preset.id,
              senderRole: message.role === 'agent' ? preset.role : undefined,
              content: message.content,
              status: 'completed',
            })),
          workflowAgent: {
            workflow: state.workflow,
            nodeDefinitions: allNodeDefinitions,
            selectedNodes,
          },
        }),
      });

      if (!response.ok || !response.body) {
        const text = await response.text().catch(() => '');
        appendAssistantContent(assistantId, text || `请求失败：${response.status}`);
        return;
      }

      await readSseStream(response, (event) => {
        if (event.event === 'output') {
          const line = asRecord(event.data).line;
          if (typeof line === 'string') appendAssistantContent(assistantId, line);
          return;
        }
        if (event.event === 'tool_use') {
          const data = asRecord(event.data);
          appendToolCall(assistantId, {
            id: `${String(data.name ?? 'tool')}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: String(data.name ?? 'tool'),
            input: data.input,
            status: 'running',
          });
          return;
        }
        if (event.event === 'tool_result') {
          const data = asRecord(event.data);
          const toolName = String(data.toolUseId ?? 'tool');
          completeLatestToolCall(assistantId, toolName, data.result);
          applyWorkflowPatch(data.result);
          return;
        }
        if (event.event === 'done') {
          const data = asRecord(event.data);
          if (data.error) appendAssistantContent(assistantId, String(data.error));
          return;
        }
        if (event.event === 'error') {
          const data = asRecord(event.data);
          appendAssistantContent(assistantId, String(data.error ?? 'Agent 运行失败'));
        }
      });
    } catch (error) {
      appendAssistantContent(assistantId, error instanceof Error ? error.message : String(error));
    } finally {
      setAgentSending(false);
    }
  }, [
    agentInput,
    agentSending,
    state,
    workspaceId,
    agentMessages,
    appendAssistantContent,
    appendToolCall,
    completeLatestToolCall,
    applyWorkflowPatch,
  ]);

  // ---- Shortcuts ----
  useEditorShortcuts({
    onSave: state.saveWorkflow,
    onUndo: state.handleUndo,
    onRedo: state.handleRedo,
    onDelete: state.selectedNodeId ? () => canvas.handleNodeDelete(state.selectedNodeId!) : undefined,
    onCopy: state.selectedNodeId && state.workflow ? () => {
      const node = state.workflow!.nodes.find(n => n.id === state.selectedNodeId);
      if (node) clipboard.copy([node], []);
    } : undefined,
    onPaste: () => {
      const pasted = clipboard.paste();
      if (pasted && state.workflow) {
        state.pushUndo('paste');
        state.setWorkflow(w => w ? {
          ...w,
          nodes: [...w.nodes, ...pasted.nodes],
          edges: [...w.edges, ...pasted.edges],
        } : null);
        state.markDirty();
      }
    },
  });

  // ---- Render ----
  if (state.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">加载工作流中...</span>
      </div>
    );
  }

  if (state.loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <span className="text-sm text-destructive">{state.loadError}</span>
        <Button variant="outline" size="sm" onClick={onBack}>返回</Button>
      </div>
    );
  }

  if (!state.workflow) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <AlertCircle className="h-8 w-8 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">未选择工作流</span>
        <Button variant="outline" size="sm" onClick={onBack}>返回</Button>
      </div>
    );
  }

  const workflow = state.workflow;

  return (
    <div className="flex flex-col h-full bg-muted/30 p-1.5 gap-1.5" tabIndex={0}>
      <WorkflowEditorToolbar
        workflow={workflow}
        isDirty={state.isDirty}
        isPreview={state.isPreview}
        executionStatus={execution.execStatus}
        isEditingName={state.isEditingName}
        editingName={state.editingName}
        canUndo={state.undoStack.length > 0}
        canRedo={state.redoStack.length > 0}
        onBack={onBack}
        onSave={state.saveWorkflow}
        onExecute={execution.handleExecute}
        onPause={execution.handlePauseExecution}
        onResume={execution.handleResumeExecution}
        onStop={execution.handleStopExecution}
        onUndo={state.handleUndo}
        onRedo={state.handleRedo}
        onAutoLayout={() => {}}
        onExport={state.handleExport}
        onImport={state.handleImport}
        onOpenPluginManager={() => state.setPluginsDialogOpen(true)}
        onStartEditName={state.startEditName}
        onFinishEditName={state.finishEditName}
        onCancelEditName={() => state.setIsEditingName(false)}
        onEditingNameChange={state.setEditingName}
      />

      <ResizablePanelGroup orientation="horizontal" defaultLayout={state.workflowLayout} onLayoutChange={state.onWorkflowLayoutChange} className="flex-1 min-h-0 gap-1.5">
        {/* Node sidebar */}
        <ResizablePanel id="workflow-node-sidebar" defaultSize="18%" minSize="12%" maxSize="30%">
          <div className="rounded-xl bg-background overflow-hidden h-full">
          <WorkflowNodeSidebar
            workflow={workflow}
            onWorkflowChange={state.handleWorkflowMetaChange}
            onOpenPluginPicker={() => state.setPluginPickerDialogOpen(true)}
          />
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Canvas + Execution bar */}
        <ResizablePanel id="workflow-canvas" defaultSize="52%" minSize="30%">
          <div className="flex flex-col h-full rounded-xl bg-background overflow-hidden">
            <div className="flex-1 min-h-0">
              <WorkflowCanvas
                workflow={workflow}
                isPreview={state.isPreview}
                selectedNodeId={state.selectedNodeId}
                onNodeAdd={canvas.handleNodeAdd}
                onNodeDelete={canvas.handleNodeDelete}
                onNodeSelect={canvas.handleNodeSelect}
                onNodeDataUpdate={canvas.handleNodeDataUpdate}
                onNodesChange={canvas.handleNodesChange}
                onEdgesChange={canvas.handleEdgesChange}
                onConnect={canvas.handleConnect}
                onConnectionDrop={canvas.handleConnectionDrop}
                canUndo={state.undoStack.length > 0}
                canRedo={state.redoStack.length > 0}
                onUndo={state.handleUndo}
                onRedo={state.handleRedo}
                onExitPreview={() => state.setIsPreview(false)}
                onAutoLayout={canvas.handleAutoLayout}
              />
            </div>
            <WorkflowExecutionBar
              status={execution.execStatus}
              log={execution.executionLog}
              logs={execution.executionLogs}
              selectedLogId={execution.selectedExecutionLogId}
              startNodes={execution.startNodes}
              validationError={execution.executionValidationError}
              isExpanded={execExpanded}
              onToggle={toggleExec}
              onExecute={execution.handleExecute}
              onPause={execution.handlePauseExecution}
              onResume={execution.handleResumeExecution}
              onStop={execution.handleStopExecution}
              onSelectLog={execution.handleSelectExecutionLog}
              onDeleteLog={execution.handleDeleteExecutionLog}
              onClearLogs={execution.handleClearExecutionLogs}
              onExitPreview={() => state.setIsPreview(false)}
            />
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right panel */}
        <ResizablePanel id="workflow-right-panel" defaultSize="30%" minSize="15%" maxSize="50%">
          <div className="rounded-xl bg-background overflow-hidden h-full">
          <Tabs value={state.rightTab} onValueChange={state.setRightTab} className="flex flex-col h-full">
            <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0 h-8">
              <TabsTrigger value="properties" className="text-xs px-3 py-1.5">属性</TabsTrigger>
              <TabsTrigger value="versions" className="text-xs px-3 py-1.5">版本</TabsTrigger>
              <TabsTrigger value="history" className="text-xs px-3 py-1.5">历史</TabsTrigger>
              <TabsTrigger value="staging" className="text-xs px-3 py-1.5">暂存</TabsTrigger>
            </TabsList>
            <TabsContent value="properties" className="flex-1 min-h-0 m-0">
              <WorkflowPropertiesPanel
                node={state.selectedNode}
                onUpdateData={canvas.handleNodeDataUpdate}
                debugNodeId={execution.debugNodeId}
                debugStatus={execution.debugStatus}
                debugResult={execution.debugResult}
                onDebugNode={execution.handleDebugNode}
                onCancelDebug={execution.handleCancelDebug}
              />
            </TabsContent>
            <TabsContent value="versions" className="flex-1 min-h-0 m-0">
              <WorkflowVersionPanel
                workflowId={workflow.id}
                nodes={workflow.nodes}
                edges={workflow.edges}
                onRestore={(version) => {
                  state.pushUndo('restore version');
                  state.setWorkflow(w => w ? {
                    ...w,
                    nodes: version.snapshot?.nodes || [],
                    edges: (version.snapshot?.edges || []) as typeof workflow.edges,
                  } : null);
                  state.markDirty();
                }}
              />
            </TabsContent>
            <TabsContent value="history" className="flex-1 min-h-0 m-0">
              <WorkflowOperationHistory
                workflowId={workflow.id}
                currentUndoCount={state.undoStack.length}
                currentRedoCount={state.redoStack.length}
                onUndo={state.handleUndo}
                onRedo={state.handleRedo}
              />
            </TabsContent>
            <TabsContent value="staging" className="flex-1 min-h-0 m-0">
              <WorkflowStagingPanel
                workflowId={workflow.id}
                onAddFromStaging={(staged) => {
                  if (!workflow) return;
                  state.pushUndo('add from staging');
                  const newNode: typeof workflow.nodes[0] = {
                    id: `node_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                    type: staged.type,
                    label: (staged.data?.label as string) || staged.type,
                    position: { x: 250 + Math.random() * 100, y: 250 + Math.random() * 100 },
                    data: { ...(staged.data || {}) },
                  };
                  state.setWorkflow(w => w ? { ...w, nodes: [...w.nodes, newNode] } : null);
                  state.setSelectedNodeId(newNode.id);
                  state.markDirty();
                }}
              />
            </TabsContent>
          </Tabs>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Trigger settings dialog */}
      <WorkflowTriggerDialog
        open={state.triggerDialogOpen}
        triggers={workflow?.triggers || []}
        workflowId={workflow?.id || ''}
        onSave={(triggers) => {
          state.setWorkflow(w => w ? { ...w, triggers } : null);
          state.markDirty();
        }}
        onClose={() => state.setTriggerDialogOpen(false)}
      />

      {/* Embedded sub-workflow editor */}
      <WorkflowEmbeddedEditor
        open={state.embeddedEditorOpen}
        parentWorkflowId={workflow?.id || ''}
        subWorkflowId={state.embeddedSubWorkflowId}
        onClose={() => state.setEmbeddedEditorOpen(false)}
        onSave={(subId) => {
          if (state.selectedNodeId && workflow) {
            canvas.handleNodeDataUpdate(state.selectedNodeId, { workflowId: subId });
          }
          state.setEmbeddedEditorOpen(false);
        }}
      />

      <WorkflowInteractionDialog
        request={execution.pendingInteraction}
        onResolve={execution.handleResolveInteraction}
        onCancel={execution.handleCancelInteraction}
      />

      <WorkflowPluginsDialog
        open={state.pluginsDialogOpen}
        onOpenChange={state.setPluginsDialogOpen}
        workflow={workflow}
        onWorkflowChange={state.handleWorkflowMetaChange}
      />

      <WorkflowPluginPickerDialog
        open={state.pluginPickerDialogOpen}
        onOpenChange={state.setPluginPickerDialogOpen}
        workflow={workflow}
        onWorkflowChange={state.handleWorkflowMetaChange}
      />

      <WorkflowNodeSelectDialog
        open={canvas.nodeSelectOpen}
        workflow={workflow}
        onOpenChange={canvas.handleNodeSelectOpenChange}
        onSelect={canvas.handleNodeSelectFromDialog}
      />

      <FloatingChatPanel
        isOpen={agentOpen}
        onClose={() => setAgentOpen(false)}
        onToggle={() => setAgentOpen((open) => !open)}
        agent={{ name: '工作流助手', role: 'LangChain', status: agentSending ? 'busy' : 'online' }}
        messages={agentMessages}
        sending={agentSending}
        input={agentInput}
        onInputChange={setAgentInput}
        onSend={sendWorkflowAgentMessage}
        inputPlaceholder="描述要修改的工作流..."
        headerActions={
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full hover:bg-background/50"
              onClick={openAgentSettings}
              title="模型设置"
            >
              <Settings2 className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full hover:bg-background/50"
              onClick={() => setAgentMessages([])}
              title="清空消息"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        }
        width={440}
        height={420}
        renderMessageContent={(message) => (
          message.content.trim()
            ? <span className="whitespace-pre-wrap break-words">{message.content}</span>
            : <span className="text-muted-foreground">正在处理...</span>
        )}
        renderMessageExtras={(message) => (
          <WorkflowAgentToolCards toolCalls={(message as WorkflowAgentChatMessage).toolCalls} />
        )}
      />

      <Dialog open={agentSettingsOpen} onOpenChange={setAgentSettingsOpen}>
        <DialogContent className="flex max-h-[86vh] max-w-3xl flex-col overflow-hidden p-0">
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle>工作流助手模型设置</DialogTitle>
          </DialogHeader>
          {agentSettingsLoading || !agentSettingsDraft ? (
            <div className="flex h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              加载中...
            </div>
          ) : (
            <AgentEditor
              agent={agentSettingsDraft}
              onSaved={(saved) => {
                setAgentSettingsDraft(saved);
                setAgentSettingsOpen(false);
              }}
              onBack={() => setAgentSettingsOpen(false)}
              fixedValues={WORKFLOW_AGENT_FIXED_VALUES}
              lockedFields={{
                role: true,
                runtimeKind: true,
                workingDir: true,
                systemPrompt: true,
                mcps: true,
                tools: true,
                skills: true,
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WorkflowAgentToolCards({ toolCalls }: { toolCalls?: WorkflowToolCall[] }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  if (!toolCalls?.length) return null;

  return (
    <div className="mt-2 flex w-full flex-col gap-1.5">
      {toolCalls.map((toolCall) => {
        const open = expanded[toolCall.id];
        const isError = toolCall.status === 'error';
        return (
          <div key={toolCall.id} className="rounded-lg border bg-background/80 text-xs shadow-sm">
            <button
              type="button"
              className="flex w-full items-center gap-2 px-2.5 py-2 text-left"
              onClick={() => setExpanded((state) => ({ ...state, [toolCall.id]: !state[toolCall.id] }))}
            >
              {toolCall.status === 'running' ? (
                <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
              ) : isError ? (
                <AlertCircle className="size-3.5 shrink-0 text-destructive" />
              ) : (
                <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" />
              )}
              <Wrench className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate font-medium">{toolCall.name}</span>
              <ChevronDown className={cn('size-3.5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
            </button>
            {open ? (
              <div className="border-t px-2.5 py-2">
                <ToolJsonBlock label="Input" value={toolCall.input} />
                {toolCall.result !== undefined ? <ToolJsonBlock label="Result" value={toolCall.result} /> : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function ToolJsonBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="mb-2 last:mb-0">
      <div className="mb-1 text-[10px] font-medium uppercase text-muted-foreground">{label}</div>
      <pre className="max-h-40 overflow-auto rounded-md bg-muted/60 p-2 text-[11px] leading-relaxed">
        {formatJson(value)}
      </pre>
    </div>
  );
}

async function resolveWorkflowAgentPreset(): Promise<AgentConfig | null> {
  const response = await fetchWithAuth('/api/agents/presets');
  if (!response.ok) return null;
  const presets = await response.json() as AgentConfig[];
  return presets.find(isWorkflowAgentPreset) ?? null;
}

async function resolveWorkflowAgentSettingsDraft(): Promise<AgentPreset> {
  const response = await fetchWithAuth('/api/agents/presets');
  const presets = response.ok ? await response.json() as AgentConfig[] : [];
  const existing = presets.find(isWorkflowAgentPreset);
  if (existing) return withWorkflowAgentFixedValues(normalizeAgent(existing));
  return withWorkflowAgentFixedValues({
    ...newAgentDraft('agent'),
    id: `draft-${WORKFLOW_AGENT_TEMPLATE_ID}-${Date.now()}`,
  });
}

function isWorkflowAgentPreset(preset: AgentConfig): boolean {
  return preset.templateId === WORKFLOW_AGENT_TEMPLATE_ID || preset.name === WORKFLOW_AGENT_FIXED_VALUES.name;
}

function withWorkflowAgentFixedValues(agent: AgentPreset): AgentPreset {
  return {
    ...agent,
    ...WORKFLOW_AGENT_FIXED_VALUES,
    modelProvider: agent.modelProvider,
    modelId: agent.modelId,
    apiBase: agent.apiBase,
    apiKey: agent.apiKey,
    avatarUrl: agent.avatarUrl,
    icon: agent.icon,
    temperature: agent.temperature,
    maxTokens: agent.maxTokens,
  };
}

async function readSseStream(response: Response, onEvent: (event: SseEvent) => void): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split(/\n\n/);
    buffer = chunks.pop() ?? '';
    for (const chunk of chunks) {
      const event = parseSseEvent(chunk);
      if (event) onEvent(event);
    }
  }

  if (buffer.trim()) {
    const event = parseSseEvent(buffer);
    if (event) onEvent(event);
  }
}

function parseSseEvent(chunk: string): SseEvent | null {
  let event = 'message';
  const dataLines: string[] = [];
  for (const line of chunk.split(/\r?\n/)) {
    if (line.startsWith('event:')) event = line.slice('event:'.length).trim();
    if (line.startsWith('data:')) dataLines.push(line.slice('data:'.length).trim());
  }
  if (!dataLines.length) return null;
  try {
    return { event, data: JSON.parse(dataLines.join('\n')) };
  } catch {
    return { event, data: dataLines.join('\n') };
  }
}

function readWorkflowPatch(result: unknown): { workflow_id: string; nodes: Workflow['nodes']; edges: Workflow['edges']; updatedAt?: number } | null {
  const record = asRecord(result);
  const patch = asRecord(record.workflow_patch);
  if (typeof patch.workflow_id !== 'string' || !Array.isArray(patch.nodes) || !Array.isArray(patch.edges)) return null;
  return {
    workflow_id: patch.workflow_id,
    nodes: patch.nodes as Workflow['nodes'],
    edges: patch.edges as Workflow['edges'],
    updatedAt: typeof patch.updatedAt === 'number' ? patch.updatedAt : undefined,
  };
}

function isSuccessfulToolResult(result: unknown): boolean {
  const record = asRecord(result);
  return record.success !== false;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function findLastIndex<T>(items: T[], predicate: (item: T) => boolean): number {
  for (let index = items.length - 1; index >= 0; index--) {
    if (predicate(items[index])) return index;
  }
  return -1;
}

function formatJson(value: unknown): string {
  if (value === undefined) return '';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

// ---- Main export (with ReactFlowProvider) ----

export function WorkflowEditor({
  template, onBack,
}: {
  template: WorkflowTemplate | null;
  onBack: () => void;
}) {
  return (
    <ReactFlowProvider>
      <WorkflowEditorInner template={template} onBack={onBack} />
    </ReactFlowProvider>
  );
}
