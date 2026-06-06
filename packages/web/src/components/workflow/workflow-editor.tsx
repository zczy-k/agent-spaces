'use client';

import { useEffect } from 'react';
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
import { FloatingChatPanel } from '@/components/ui/floating-chat-widget';
import { AgentEditor } from '@/components/sidebar/agent-editor';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ResizablePanel, ResizableHandle, ResizablePanelGroup } from '@/components/ui/resizable';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { ExpandableTabs } from '@/components/ui/expandable-tabs';
import { Loader2, AlertCircle, Settings2, Trash2, History, Layers, Package } from 'lucide-react';
import { useEditorShortcuts, useClipboard, useExecutionPanel } from '@/hooks/use-workflow-editor';
import { Button } from '@/components/ui/button';
import { useWorkspaceStore } from '@/stores/workspace';
import { useWorkflowEditorState } from './use-workflow-editor-state';
import { useWorkflowEditorCanvas } from './use-workflow-editor-canvas';
import { useWorkflowEditorExecution } from './use-workflow-editor-execution';
import { useWorkflowEditorAgentChat } from './use-workflow-editor-agent-chat';
import { WorkflowAgentTimeline } from './workflow-editor-agent-chat-ui';
import { WORKFLOW_AGENT_FIXED_VALUES, getWorkflowAgentTimeline } from './workflow-editor-agent-utils';
import type { WorkflowAgentChatMessage } from './workflow-editor-agent-utils';

// ---- Inner editor (needs ReactFlow context) ----

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

  const canvas = useWorkflowEditorCanvas({
    workflow: state.workflow,
    setWorkflow: state.setWorkflow,
    markDirty: state.markDirty,
    pushUndo: state.pushUndo,
    selectedNodeId: state.selectedNodeId,
    setSelectedNodeId: state.setSelectedNodeId,
    selectedNodeIds: state.selectedNodeIds,
    setSelectedNodeIds: state.setSelectedNodeIds,
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
    onCopy: state.selectedNodeId && state.workflow ? () => {
      const node = state.workflow!.nodes.find(n => n.id === state.selectedNodeId);
      if (node) clipboard.copy([node], []);
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
        canUndo={!isWorkflowRunning && state.undoStack.length > 0}
        canRedo={!isWorkflowRunning && state.redoStack.length > 0}
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
              workflowId={state.workflowId}
              onToggle={toggleExec}
              onExecute={execution.handleExecute}
              onPause={execution.handlePauseExecution}
              onResume={execution.handleResumeExecution}
              onStop={execution.handleStopExecution}
              onSelectLog={execution.handleSelectExecutionLog}
              onDeleteLog={execution.handleDeleteExecutionLog}
              onClearLogs={execution.handleClearExecutionLogs}
              onExitPreview={() => state.setIsPreview(false)}
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
                { title: '属性', icon: Settings2, value: 'properties' },
                { title: '版本', icon: Layers, value: 'versions' },
                { title: '历史', icon: History, value: 'history' },
                { title: '暂存', icon: Package, value: 'staging' },
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
        open={canvas.nodeSelectOpen && !isWorkflowRunning}
        workflow={workflow}
        onOpenChange={canvas.handleNodeSelectOpenChange}
        onSelect={isWorkflowRunning ? () => {} : canvas.handleNodeSelectFromDialog}
      />

      <FloatingChatPanel
        isOpen={chat.agentOpen}
        onClose={() => chat.setAgentOpen(false)}
        onToggle={() => chat.setAgentOpen((open) => !open)}
        agent={{ name: '工作流助手', role: 'LangChain', status: chat.agentSending ? 'busy' : 'online' }}
        messages={chat.agentMessages}
        sending={chat.agentSending}
        input={chat.agentInput}
        onInputChange={chat.setAgentInput}
        onSend={chat.sendWorkflowAgentMessage}
        onStop={chat.stopWorkflowAgentMessage}
        onDeleteMessage={chat.deleteAgentMessage}
        inputPlaceholder="描述要修改的工作流..."
        headerActions={
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full hover:bg-background/50"
              onClick={chat.openAgentSettings}
              title="模型设置"
            >
              <Settings2 className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full hover:bg-background/50"
              onClick={chat.clearWorkflowAgentMessages}
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
            : null
        )}
        renderMessageExtras={(message) => (
          <WorkflowAgentTimeline timeline={getWorkflowAgentTimeline(message as WorkflowAgentChatMessage)} />
        )}
      />

      <Dialog open={chat.agentSettingsOpen} onOpenChange={chat.setAgentSettingsOpen}>
        <DialogContent className="flex max-h-[86vh] min-w-[60vw] flex-col overflow-hidden p-0">
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle>工作流助手模型设置</DialogTitle>
          </DialogHeader>
          {chat.agentSettingsLoading || !chat.agentSettingsDraft ? (
            <div className="flex h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              加载中...
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
