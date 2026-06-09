'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { ReactFlowProvider } from '@xyflow/react';
import type { WorkflowTemplate } from '@agent-spaces/shared';
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
import { WorkflowVariablesForm } from './workflow-variables-form';
import { FloatingChatPanel } from '@/components/ui/floating-chat-widget';
import { AgentEditor } from '@/components/sidebar/agent-editor';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ResizablePanel, ResizableHandle, ResizablePanelGroup } from '@/components/ui/resizable';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { ExpandableTabs } from '@/components/ui/expandable-tabs';
import { Loader2, AlertCircle, Settings2, Trash2, History, Package, Braces } from 'lucide-react';
import { useEditorShortcuts, useClipboard, useExecutionPanel } from '@/hooks/use-workflow-editor';
import { Button } from '@/components/ui/button';
import { useWorkspaceStore } from '@/stores/workspace';
import { useWorkflowEditorState } from './use-workflow-editor-state';
import { useWorkflowEditorCanvas } from './use-workflow-editor-canvas';
import { useWorkflowEditorExecution } from './use-workflow-editor-execution';
import { useWorkflowEditorAgentChat } from './use-workflow-editor-agent-chat';
import { WorkflowAgentTimeline } from './workflow-editor-agent-chat-ui';
import { WORKFLOW_AGENT_FIXED_VALUES, getWorkflowAgentTimeline } from './workflow-editor-agent-utils';
import type { WorkflowAgentChatMessage, WorkflowToolCall } from './workflow-editor-agent-utils';

// ---- Inner editor (needs ReactFlow context) ----

function WorkflowEditorInner({
  template, onBack,
}: {
  template: WorkflowTemplate | null;
  onBack: () => void;
}) {
  const t = useTranslations('workflows');
  // ---- State ----
  const state = useWorkflowEditorState(template);
  const workspaces = useWorkspaceStore((store) => store.workspaces);
  const workspaceId = workspaces[0]?.id;

  const canvas = useWorkflowEditorCanvas({
    workflow: state.workflow,
    setWorkflow: state.setWorkflow,
    markDirty: state.markDirty,
    pushUndo: state.pushUndo,
    selectedNodeId: state.selectedNodeId,
    setSelectedNodeId: state.setSelectedNodeId,
    selectedNodeIds: state.selectedNodeIds,
    setSelectedNodeIds: state.setSelectedNodeIds,
    onCopyNodes: (nodeIds) => {
      if (!state.workflow) return;
      const ids = new Set(nodeIds);
      const nodes = state.workflow.nodes.filter(n => ids.has(n.id));
      const edges = state.workflow.edges.filter(e => ids.has(e.source) && ids.has(e.target));
      if (nodes.length > 0) clipboard.copy(nodes, edges);
    },
    onStageNode: (nodeId) => {
      if (!state.workflow) return;
      const node = state.workflow.nodes.find(n => n.id === nodeId);
      if (!node) return;
      const staged = {
        id: `staged_${Date.now()}`,
        sourceNodeId: node.id,
        type: node.type,
        label: node.label,
        data: JSON.parse(JSON.stringify(node.data)),
        composite: node.composite ? JSON.parse(JSON.stringify(node.composite)) : undefined,
        stagedAt: Date.now(),
      };
      window.dispatchEvent(new CustomEvent('workflow:node-staged', { detail: { staged } }));
    },
  });

  const execution = useWorkflowEditorExecution({
    workflow: state.workflow,
    workflowId: state.workflowId,
  });

  const chat = useWorkflowEditorAgentChat({
    workflow: state.workflow,
    setWorkflow: state.setWorkflow,
    markDirty: state.markDirty,
    pushUndo: state.pushUndo,
    selectedNode: state.selectedNode,
    workspaceId,
  });

  const { isExpanded: execExpanded, toggle: toggleExec } = useExecutionPanel();
  const clipboard = useClipboard();
  const isWorkflowRunning = execution.execStatus === 'running';
  const selectedNodeIds = state.selectedNodeIds.length > 0
    ? state.selectedNodeIds
    : state.selectedNodeId ? [state.selectedNodeId] : [];
  const exitExecutionPreview = () => {
    state.exitPreview();
    execution.clearSelectedExecutionLog();
  };

  useEffect(() => {
    if (!isWorkflowRunning || !canvas.nodeSelectOpen) return;
    canvas.handleNodeSelectOpenChange(false);
  }, [canvas.handleNodeSelectOpenChange, canvas.nodeSelectOpen, isWorkflowRunning]);

  // ---- Shortcuts ----
  useEditorShortcuts({
    onSave: state.saveWorkflow,
    onUndo: isWorkflowRunning ? undefined : state.handleUndo,
    onRedo: isWorkflowRunning ? undefined : state.handleRedo,
    onDelete: !isWorkflowRunning && state.selectedNodeId ? () => canvas.handleNodeDelete(state.selectedNodeId!) : undefined,
    onCopy: selectedNodeIds.length > 0 && state.workflow ? () => {
      const selectedIds = new Set(selectedNodeIds);
      const nodes = state.workflow!.nodes.filter(node => selectedIds.has(node.id));
      const edges = state.workflow!.edges.filter(edge => selectedIds.has(edge.source) && selectedIds.has(edge.target));
      if (nodes.length > 0) clipboard.copy(nodes, edges);
    } : undefined,
    onPaste: isWorkflowRunning ? undefined : () => {
      const pasted = clipboard.paste();
      if (pasted && state.workflow) {
        state.pushUndo('paste');
        state.setWorkflow(w => w ? {
          ...w,
          nodes: [...w.nodes, ...pasted.nodes],
          edges: [...w.edges, ...pasted.edges],
        } : null);
        const pastedNodeIds = pasted.nodes.map(node => node.id);
        state.setSelectedNodeIds(pastedNodeIds);
        state.setSelectedNodeId(pastedNodeIds.length === 1 ? pastedNodeIds[0] : null);
        state.markDirty();
      }
    },
  });

  // ---- Render ----
  if (state.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{t('editor.loading')}</span>
      </div>
    );
  }

  if (state.loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <span className="text-sm text-destructive">{state.loadError}</span>
        <Button variant="outline" size="sm" onClick={onBack}>{t('editor.back')}</Button>
      </div>
    );
  }

  if (!state.workflow) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <AlertCircle className="h-8 w-8 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{t('editor.noWorkflow')}</span>
        <Button variant="outline" size="sm" onClick={onBack}>{t('editor.back')}</Button>
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
        canUndo={!isWorkflowRunning && state.undoStack.length > 0}
        canRedo={!isWorkflowRunning && state.redoStack.length > 0}
        onBack={onBack}
        onExitPreview={exitExecutionPreview}
        onSave={state.saveWorkflow}
        onUndo={state.handleUndo}
        onRedo={state.handleRedo}
        onExport={state.handleExport}
        onImport={state.handleImport}
        onOpenPluginManager={() => state.setPluginsDialogOpen(true)}
        onOpenWorkflowLocation={() => {
          if (workflow?.id) {
            fetch(`/api/folder/reveal?path=${encodeURIComponent(`~/.agent-spaces-data/workflows/${workflow.id}`)}`, { method: 'POST' });
          }
        }}
        onWorkflowInfoChange={(updates) => {
          if (workflow) {
            const updated = { ...workflow, ...updates };
            state.setWorkflow(updated);
            state.saveWorkflow(updated);
          }
        }}
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
                isRunning={isWorkflowRunning}
                executionLog={execution.executionLog}
                selectedNodeId={state.selectedNodeId}
                selectedNodeIds={state.selectedNodeIds}
                onNodeAdd={canvas.handleNodeAdd}
                onNodeDelete={canvas.handleNodeDelete}
                onNodeCopy={canvas.handleNodeCopy}
                onNodeClone={canvas.handleNodeClone}
                onNodeStage={canvas.handleNodeStage}
                onNodeSelect={canvas.handleNodeSelect}
                onNodesSelect={canvas.handleNodesSelect}
                onNodeDataUpdate={canvas.handleNodeDataUpdate}
                onNodesChange={canvas.handleNodesChange}
                onEdgesChange={canvas.handleEdgesChange}
                onConnect={canvas.handleConnect}
                onConnectionDrop={canvas.handleConnectionDrop}
                canUndo={state.undoStack.length > 0}
                canRedo={state.redoStack.length > 0}
                onUndo={state.handleUndo}
                onRedo={state.handleRedo}
                onExitPreview={exitExecutionPreview}
                onAutoLayout={canvas.handleAutoLayout}
              />
            </div>
            <WorkflowExecutionBar
              status={execution.execStatus}
              log={execution.executionLog}
              logs={execution.executionLogs}
              selectedLogId={execution.selectedExecutionLogId}
              startNodes={execution.startNodes}
              variables={workflow.variables || []}
              validationError={execution.executionValidationError}
              isExpanded={execExpanded}
              workflowId={state.workflowId}
              onToggle={toggleExec}
              onExecute={execution.handleExecute}
              onPause={execution.handlePauseExecution}
              onResume={execution.handleResumeExecution}
              onStop={execution.handleStopExecution}
              onSelectLog={(log) => {
                execution.handleSelectExecutionLog(log);
                state.enterPreview(log);
              }}
              onDeleteLog={execution.handleDeleteExecutionLog}
              onClearLogs={execution.handleClearExecutionLogs}
              onExitPreview={exitExecutionPreview}
              onUpdateNodeData={canvas.handleNodeDataUpdate}
            />
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right panel */}
        <ResizablePanel id="workflow-right-panel" defaultSize="30%" minSize="15%" maxSize="50%">
          <div className="rounded-xl bg-background overflow-hidden h-full">
          <Tabs value={state.rightTab} onValueChange={state.setRightTab} className="flex flex-col h-full">
            <ExpandableTabs
              tabs={[
                { title: t('editor.properties'), icon: Settings2, value: 'properties' },
                { title: '变量', icon: Braces, value: 'variables' },
                { title: t('editor.history'), icon: History, value: 'history' },
                { title: t('editor.staging'), icon: Package, value: 'staging' },
              ]}
              value={state.rightTab}
              onValueChange={state.setRightTab}
              className="border-b border-x-0 border-t-0 rounded-none w-full"
            />
            <TabsContent value="properties" className="flex-1 min-h-0 m-0">
              <WorkflowPropertiesPanel
                node={state.selectedNode}
                nodes={workflow.nodes}
                edges={workflow.edges}
                enabledPlugins={workflow.enabledPlugins}
                variables={workflow.variables || []}
                onUpdateData={canvas.handleNodeDataUpdate}
                debugNodeId={execution.debugNodeId}
                debugStatus={execution.debugStatus}
                debugResult={execution.debugResult}
                onDebugNode={execution.handleDebugNode}
                onCancelDebug={execution.handleCancelDebug}
              />
            </TabsContent>
            <TabsContent value="variables" className="flex-1 min-h-0 m-0">
              <WorkflowVariablesForm
                value={workflow.variables || []}
                nodes={workflow.nodes}
                edges={workflow.edges}
                currentNodeId={state.selectedNodeId}
                enabledPlugins={workflow.enabledPlugins}
                variables={workflow.variables || []}
                onChange={(variables) => {
                  state.pushUndo('update variables');
                  state.setWorkflow(w => w ? { ...w, variables } : null);
                  state.markDirty();
                }}
              />
            </TabsContent>
            <TabsContent value="history" className="flex-1 min-h-0 m-0">
              <ResizablePanelGroup orientation="vertical" className="h-full">
                <ResizablePanel id="history-versions" defaultSize="50%" minSize="20%">
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
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel id="history-operations" defaultSize="50%" minSize="20%">
                  <WorkflowOperationHistory
                    workflowId={workflow.id}
                    currentUndoCount={state.undoStack.length}
                    currentRedoCount={state.redoStack.length}
                    onUndo={state.handleUndo}
                    onRedo={state.handleRedo}
                  />
                </ResizablePanel>
              </ResizablePanelGroup>
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
        open={canvas.nodeSelectOpen && !isWorkflowRunning}
        workflow={workflow}
        onOpenChange={canvas.handleNodeSelectOpenChange}
        onSelect={isWorkflowRunning ? () => {} : canvas.handleNodeSelectFromDialog}
      />

      <FloatingChatPanel
        isOpen={chat.agentOpen}
        onClose={() => chat.setAgentOpen(false)}
        onToggle={() => chat.setAgentOpen((open) => !open)}
        agent={{ name: t('editor.agentName'), role: 'LangChain', status: chat.agentSending ? 'busy' : 'online' }}
        messages={chat.agentMessages}
        sending={chat.agentSending}
        input={chat.agentInput}
        onInputChange={chat.setAgentInput}
        onSend={chat.sendWorkflowAgentMessage}
        onStop={chat.stopWorkflowAgentMessage}
        onDeleteMessage={chat.deleteAgentMessage}
        inputPlaceholder={t('editor.inputPlaceholder')}
        headerActions={
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full hover:bg-background/50"
              onClick={chat.openAgentSettings}
              title={t('editor.modelSettings')}
            >
              <Settings2 className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full hover:bg-background/50"
              onClick={chat.clearWorkflowAgentMessages}
              title={t('editor.clearMessages')}
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
            : null
        )}
        renderMessageExtras={(message) => (
          <WorkflowAgentTimeline timeline={getWorkflowAgentTimeline(message as WorkflowAgentChatMessage)} workspaceId={workspaceId} />
        )}
        serializeForCopy={(message) => {
          const m = message as WorkflowAgentChatMessage;
          const thinkMatch = m.content.match(/^<think\s*>([\s\S]*?)<\/think>\s*([\s\S]*)$/);
          const text = thinkMatch ? thinkMatch[2].trim() : m.content;
          const timeline = getWorkflowAgentTimeline(m);
          if (!timeline.length) return text;
          const lines: string[] = [];
          for (const item of timeline) {
            if (item.type === 'message') {
              lines.push(`[消息] ${item.content}`);
            } else if (item.type === 'tool') {
              const tool = item as WorkflowToolCall;
              const input = tool.input != null ? `\n  输入: ${JSON.stringify(tool.input, null, 2)}` : '';
              const result = tool.result != null ? `\n  结果: ${JSON.stringify(tool.result, null, 2)}` : '';
              lines.push(`[${tool.status === 'success' ? '✓' : tool.status === 'error' ? '✗' : '…'}] ${tool.name}${input}${result}`);
            }
          }
          return lines.length ? `${text}\n\n---\n${lines.join('\n')}` : text;
        }}
      />

      <Dialog open={chat.agentSettingsOpen} onOpenChange={chat.setAgentSettingsOpen}>
        <DialogContent className="flex max-h-[86vh] min-w-[60vw] flex-col overflow-hidden p-0">
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle>{t('editor.agentSettingsTitle')}</DialogTitle>
          </DialogHeader>
          {chat.agentSettingsLoading || !chat.agentSettingsDraft ? (
            <div className="flex h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t('editor.loadingShort')}
            </div>
          ) : (
            <AgentEditor
              agent={chat.agentSettingsDraft}
              onSaved={(saved) => {
                chat.setAgentSettingsDraft(saved);
                chat.setAgentSettingsOpen(false);
              }}
              onBack={() => chat.setAgentSettingsOpen(false)}
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
