'use client';

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
import { ResizablePanel, ResizableHandle, ResizablePanelGroup } from '@/components/ui/resizable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, AlertCircle } from 'lucide-react';
import { useEditorShortcuts, useClipboard, useExecutionPanel } from '@/hooks/use-workflow-editor';
import { Button } from '@/components/ui/button';
import { useWorkflowEditorState } from './use-workflow-editor-state';
import { useWorkflowEditorCanvas } from './use-workflow-editor-canvas';
import { useWorkflowEditorExecution } from './use-workflow-editor-execution';

// ---- Inner editor (needs ReactFlow context) ----

function WorkflowEditorInner({
  template, onBack,
}: {
  template: WorkflowTemplate | null;
  onBack: () => void;
}) {
  // ---- State ----
  const state = useWorkflowEditorState(template);

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
    <div className="flex flex-col h-full" tabIndex={0}>
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

      <ResizablePanelGroup orientation="horizontal" defaultLayout={state.workflowLayout} onLayoutChange={state.onWorkflowLayoutChange} className="flex-1 min-h-0">
        {/* Node sidebar */}
        <ResizablePanel id="workflow-node-sidebar" defaultSize="18%" minSize="12%" maxSize="30%">
          <WorkflowNodeSidebar
            workflow={workflow}
            onWorkflowChange={state.handleWorkflowMetaChange}
            onOpenPluginPicker={() => state.setPluginPickerDialogOpen(true)}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Canvas + Execution bar */}
        <ResizablePanel id="workflow-canvas" defaultSize="52%" minSize="30%">
          <div className="flex flex-col h-full">
            <div className="flex-1 min-h-0">
              <WorkflowCanvas
                workflow={workflow}
                isPreview={state.isPreview}
                onNodeAdd={canvas.handleNodeAdd}
                onNodeDelete={canvas.handleNodeDelete}
                onNodeSelect={canvas.handleNodeSelect}
                onNodeDataUpdate={canvas.handleNodeDataUpdate}
                onNodesChange={canvas.handleNodesChange}
                onEdgesChange={canvas.handleEdgesChange}
                onConnect={canvas.handleConnect}
                onConnectionDrop={canvas.handleConnectionDrop}
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
