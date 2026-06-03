'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { ReactFlowProvider, applyNodeChanges, applyEdgeChanges, addEdge } from '@xyflow/react';
import type { NodeChange, EdgeChange, Connection } from '@xyflow/react';
import type { Workflow, WorkflowTemplate } from '@agent-spaces/shared';
import { useWorkflowStore } from '@/stores/workflow';
import { workflowApi } from '@/lib/workflow-api';
import { getNodeDefinition } from '@/lib/workflow-nodes';
import { authHeaders } from '@/lib/auth';
import { WorkflowCanvas } from './workflow-canvas';
import { WorkflowNodeSidebar } from './workflow-node-sidebar';
import { WorkflowEditorToolbar } from './workflow-editor-toolbar';
import { WorkflowPropertiesPanel } from './workflow-properties-panel';
import { WorkflowExecutionBar } from './workflow-execution-bar';
import { ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { ResizablePanelGroup } from '@/components/ui/resizable';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, AlertCircle } from 'lucide-react';
import {
  useEditorShortcuts, useClipboard, useExecutionPanel,
} from '@/hooks/use-workflow-editor';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// ---- Inner editor (needs ReactFlow context) ----

function WorkflowEditorInner({
  template, onBack,
}: {
  template: WorkflowTemplate | null;
  onBack: () => void;
}) {
  const store = useWorkflowStore();

  // ---- State ----
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(!!template);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState('properties');
  const [execStatus, setExecStatus] = useState('idle');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState('');
  const [isPreview, setIsPreview] = useState(false);
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const [listDialogOpen, setListDialogOpen] = useState(false);
  const [listDialogCreate, setListDialogCreate] = useState(false);

  const { isExpanded: execExpanded, toggle: toggleExec } = useExecutionPanel();
  const clipboard = useClipboard();
  const autoSaveTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---- Load workflow ----
  useEffect(() => {
    if (!template) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setLoadError(null);
    workflowApi.get(template.id)
      .then((wf) => {
        setWorkflow(wf);
        setIsLoading(false);
      })
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : '加载失败');
        setIsLoading(false);
      });
  }, [template]);

  // ---- Auto-save ----
  useEffect(() => {
    autoSaveTimer.current = setInterval(() => {
      if (isDirty && workflow) saveWorkflow();
    }, 10_000);
    return () => { if (autoSaveTimer.current) clearInterval(autoSaveTimer.current); };
  }, [isDirty, workflow]);

  // ---- Dirty tracking ----
  const markDirty = useCallback(() => setIsDirty(true), []);

  // ---- Undo / Redo ----
  const pushUndo = useCallback((description?: string) => {
    if (!workflow) return;
    const snapshot = JSON.stringify({ nodes: workflow.nodes, edges: workflow.edges });
    setUndoStack(prev => [...prev, snapshot]);
    setRedoStack([]);
  }, [workflow]);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0 || !workflow) return;
    const currentSnapshot = JSON.stringify({ nodes: workflow.nodes, edges: workflow.edges });
    const prevSnapshot = undoStack[undoStack.length - 1];
    const prev = JSON.parse(prevSnapshot);
    setUndoStack(s => s.slice(0, -1));
    setRedoStack(s => [...s, currentSnapshot]);
    setWorkflow(w => w ? { ...w, nodes: prev.nodes, edges: prev.edges } : null);
    markDirty();
  }, [undoStack, workflow, markDirty]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0 || !workflow) return;
    const currentSnapshot = JSON.stringify({ nodes: workflow.nodes, edges: workflow.edges });
    const nextSnapshot = redoStack[redoStack.length - 1];
    const next = JSON.parse(nextSnapshot);
    setUndoStack(s => [...s, currentSnapshot]);
    setRedoStack(s => s.slice(0, -1));
    setWorkflow(w => w ? { ...w, nodes: next.nodes, edges: next.edges } : null);
    markDirty();
  }, [redoStack, workflow, markDirty]);

  // ---- Save ----
  const saveWorkflow = useCallback(async () => {
    if (!workflow) return;
    setIsSaving(true);
    try {
      const saved = await workflowApi.update(workflow.id, {
        ...workflow,
        updatedAt: Date.now(),
      });
      setWorkflow(saved);
      setIsDirty(false);
      store.upsertWorkflow(saved);
    } finally {
      setIsSaving(false);
    }
  }, [workflow, store]);

  // ---- Node operations ----
  const handleNodeAdd = useCallback((type: string, position: { x: number; y: number }) => {
    if (!workflow) return;
    pushUndo('add node');
    const id = `node_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const def = getNodeDefinition(type);
    const data: Record<string, unknown> = {};
    if (def?.properties) {
      for (const prop of def.properties) {
        if (prop.default !== undefined) data[prop.key] = prop.default;
      }
    }
    const newNode: Workflow['nodes'][0] = {
      id, type,
      label: def?.label || type,
      position, data,
    };
    setWorkflow(w => w ? { ...w, nodes: [...w.nodes, newNode] } : null);
    setSelectedNodeId(id);
    markDirty();
  }, [workflow, pushUndo, markDirty]);

  const handleNodeDelete = useCallback((nodeId: string) => {
    if (!workflow) return;
    pushUndo('delete node');
    setWorkflow(w => w ? {
      ...w,
      nodes: w.nodes.filter(n => n.id !== nodeId),
      edges: w.edges.filter(e => e.source !== nodeId && e.target !== nodeId),
    } : null);
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
    markDirty();
  }, [workflow, pushUndo, markDirty, selectedNodeId]);

  const handleNodeSelect = useCallback((id: string | null, multi?: boolean) => {
    setSelectedNodeId(id);
    if (id) setRightTab('properties');
  }, []);

  const handleNodeDataUpdate = useCallback((nodeId: string, data: Record<string, unknown>) => {
    setWorkflow(w => {
      if (!w) return null;
      return {
        ...w,
        nodes: w.nodes.map(n => n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n),
      };
    });
    markDirty();
  }, [markDirty]);

  // ---- Edge operations ----
  const handleConnect = useCallback((connection: Connection) => {
    if (!workflow) return;
    pushUndo('connect');
    const edge: Workflow['edges'][0] = {
      id: `e-${connection.source}-${connection.target}`,
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle || undefined,
      targetHandle: connection.targetHandle || undefined,
    };
    setWorkflow(w => w ? { ...w, edges: [...w.edges, edge] } : null);
    markDirty();
  }, [workflow, pushUndo, markDirty]);

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    if (!workflow) return;
    // Handle delete via changes
    const hasDelete = changes.some(c => c.type === 'remove');
    if (hasDelete) pushUndo('delete');

    const rfNodes = workflow.nodes.map(n => ({
      id: n.id, type: 'custom' as const, position: n.position,
      data: { ...n.data, label: n.label, nodeType: n.type },
    }));
    const updated = applyNodeChanges(changes, rfNodes);

    setWorkflow(w => {
      if (!w) return null;
      return {
        ...w,
        nodes: updated.map(n => {
          const existing = w.nodes.find(wn => wn.id === n.id);
          if (!existing) return w.nodes.find(wn => wn.id === n.id)!;
          return { ...existing, position: n.position };
        }).filter(Boolean),
      };
    });
    if (hasDelete) markDirty();
  }, [workflow, pushUndo, markDirty]);

  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    if (!workflow) return;
    const hasDelete = changes.some(c => c.type === 'remove');
    if (hasDelete) pushUndo('delete edge');

    const rfEdges = workflow.edges.map(e => ({
      id: e.id, source: e.source, target: e.target, type: 'custom' as const,
      sourceHandle: e.sourceHandle || undefined, targetHandle: e.targetHandle || undefined,
      data: { composite: e.composite, sourceHandle: e.sourceHandle },
    }));
    const updated = applyEdgeChanges(changes, rfEdges);
    const remainingIds = new Set(updated.map(e => e.id));

    setWorkflow(w => w ? { ...w, edges: w.edges.filter(e => remainingIds.has(e.id)) } : null);
    if (hasDelete) markDirty();
  }, [workflow, pushUndo, markDirty]);

  // ---- Selected node ----
  const selectedNode = useMemo(
    () => workflow?.nodes.find(n => n.id === selectedNodeId) ?? null,
    [workflow, selectedNodeId],
  );

  // ---- Export / Import ----
  const handleExport = useCallback(() => {
    if (!workflow) return;
    const blob = new Blob([JSON.stringify(workflow, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(workflow.name || 'workflow').replace(/\s+/g, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [workflow]);

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text) as Workflow;
        if (data.nodes && data.edges) {
          setWorkflow(data);
          setIsDirty(true);
        }
      } catch {}
    };
    input.click();
  }, []);

  // ---- Execution ----
  const handleExecute = useCallback(() => {
    if (!workflow) return;
    setExecStatus('running');
    // Execution via WebSocket — placeholder for now
  }, [workflow]);

  // ---- Shortcuts ----
  useEditorShortcuts({
    onSave: saveWorkflow,
    onUndo: handleUndo,
    onRedo: handleRedo,
    onDelete: selectedNodeId ? () => handleNodeDelete(selectedNodeId) : undefined,
    onCopy: selectedNodeId && workflow ? () => {
      const node = workflow.nodes.find(n => n.id === selectedNodeId);
      if (node) clipboard.copy([node], []);
    } : undefined,
    onPaste: () => {
      const pasted = clipboard.paste();
      if (pasted && workflow) {
        pushUndo('paste');
        setWorkflow(w => w ? {
          ...w,
          nodes: [...w.nodes, ...pasted.nodes],
          edges: [...w.edges, ...pasted.edges],
        } : null);
        markDirty();
      }
    },
  });

  // ---- Name editing ----
  const startEditName = useCallback(() => {
    if (workflow) {
      setEditingName(workflow.name || '');
      setIsEditingName(true);
    }
  }, [workflow]);

  const finishEditName = useCallback(() => {
    setIsEditingName(false);
    if (workflow && editingName !== workflow.name) {
      setWorkflow(w => w ? { ...w, name: editingName } : null);
      markDirty();
    }
  }, [workflow, editingName, markDirty]);

  // ---- List dialog ----
  const workflows = store.workflows;

  const handleListSelect = useCallback((wf: WorkflowTemplate) => {
    workflowApi.get(wf.id).then((loaded) => {
      setWorkflow(loaded);
      setSelectedNodeId(null);
      setIsDirty(false);
      setUndoStack([]);
      setRedoStack([]);
    });
    setListDialogOpen(false);
  }, []);

  const handleCreateNew = useCallback(async () => {
    const created = await workflowApi.create({
      name: '新工作流',
      nodes: [
        { id: `node_${Date.now()}_start`, type: 'start', label: '开始', position: { x: 250, y: 50 }, data: {} },
        { id: `node_${Date.now()}_end`, type: 'end', label: '结束', position: { x: 250, y: 400 }, data: {} },
      ],
      edges: [],
    });
    setWorkflow(created);
    setSelectedNodeId(null);
    setIsDirty(false);
    setUndoStack([]);
    setRedoStack([]);
    store.upsertWorkflow(created);
    setListDialogOpen(false);
  }, [store]);

  // ---- Render ----
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">加载工作流中...</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <span className="text-sm text-destructive">{loadError}</span>
        <Button variant="outline" size="sm" onClick={onBack}>返回</Button>
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <AlertCircle className="h-8 w-8 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">未选择工作流</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { setListDialogCreate(true); setListDialogOpen(true); }}>新建工作流</Button>
          <Button variant="outline" size="sm" onClick={() => { setListDialogCreate(false); setListDialogOpen(true); }}>打开工作流</Button>
          <Button variant="outline" size="sm" onClick={onBack}>返回</Button>
        </div>
        <WorkflowListDialog
          open={listDialogOpen}
          createMode={listDialogCreate}
          workflows={workflows}
          onSelect={handleListSelect}
          onCreate={handleCreateNew}
          onClose={() => setListDialogOpen(false)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" tabIndex={0}>
      <WorkflowEditorToolbar
        workflow={workflow}
        isDirty={isDirty}
        isPreview={isPreview}
        executionStatus={execStatus}
        isEditingName={isEditingName}
        editingName={editingName}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        onBack={onBack}
        onSave={saveWorkflow}
        onExecute={handleExecute}
        onPause={() => setExecStatus('paused')}
        onResume={() => setExecStatus('running')}
        onStop={() => setExecStatus('stopped')}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onAutoLayout={() => {}}
        onExport={handleExport}
        onImport={handleImport}
        onNew={() => { setListDialogCreate(true); setListDialogOpen(true); }}
        onOpen={() => { setListDialogCreate(false); setListDialogOpen(true); }}
        onStartEditName={startEditName}
        onFinishEditName={finishEditName}
        onCancelEditName={() => setIsEditingName(false)}
        onEditingNameChange={setEditingName}
      />

      <ResizablePanelGroup orientation="horizontal" className="flex-1 min-h-0">
        {/* Node sidebar */}
        <ResizablePanel defaultSize={18} minSize={12} maxSize={30}>
          <WorkflowNodeSidebar />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Canvas + Execution bar */}
        <ResizablePanel defaultSize={52} minSize={30}>
          <div className="flex flex-col h-full">
            <div className="flex-1 min-h-0">
              <WorkflowCanvas
                workflow={workflow}
                isPreview={isPreview}
                onNodeAdd={handleNodeAdd}
                onNodeDelete={handleNodeDelete}
                onNodeSelect={handleNodeSelect}
                onNodesChange={handleNodesChange}
                onEdgesChange={handleEdgesChange}
                onConnect={handleConnect}
              />
            </div>
            <WorkflowExecutionBar
              status={execStatus}
              log={null}
              isExpanded={execExpanded}
              onToggle={toggleExec}
              onExecute={handleExecute}
              onPause={() => setExecStatus('paused')}
              onResume={() => setExecStatus('running')}
              onStop={() => setExecStatus('stopped')}
              onExitPreview={() => setIsPreview(false)}
            />
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right panel */}
        <ResizablePanel defaultSize={30} minSize={15} maxSize={50}>
          <Tabs value={rightTab} onValueChange={setRightTab} className="flex flex-col h-full">
            <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0 h-8">
              <TabsTrigger value="properties" className="text-xs px-3 py-1.5">属性</TabsTrigger>
              <TabsTrigger value="versions" className="text-xs px-3 py-1.5">版本</TabsTrigger>
              <TabsTrigger value="history" className="text-xs px-3 py-1.5">历史</TabsTrigger>
              <TabsTrigger value="staging" className="text-xs px-3 py-1.5">暂存</TabsTrigger>
            </TabsList>
            <TabsContent value="properties" className="flex-1 min-h-0 m-0">
              <WorkflowPropertiesPanel
                node={selectedNode}
                onUpdateData={handleNodeDataUpdate}
              />
            </TabsContent>
            <TabsContent value="versions" className="flex-1 min-h-0 m-0 p-3">
              <div className="text-sm text-muted-foreground">版本管理（待实现）</div>
            </TabsContent>
            <TabsContent value="history" className="flex-1 min-h-0 m-0 p-3">
              <div className="text-sm text-muted-foreground">操作历史（待实现）</div>
            </TabsContent>
            <TabsContent value="staging" className="flex-1 min-h-0 m-0 p-3">
              <div className="text-sm text-muted-foreground">暂存区（待实现）</div>
            </TabsContent>
          </Tabs>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Workflow list dialog */}
      <WorkflowListDialog
        open={listDialogOpen}
        createMode={listDialogCreate}
        workflows={workflows}
        onSelect={handleListSelect}
        onCreate={handleCreateNew}
        onClose={() => setListDialogOpen(false)}
      />
    </div>
  );
}

// ---- Workflow List Dialog ----

function WorkflowListDialog({
  open, createMode, workflows, onSelect, onCreate, onClose,
}: {
  open: boolean;
  createMode: boolean;
  workflows: WorkflowTemplate[];
  onSelect: (wf: WorkflowTemplate) => void;
  onCreate: () => void;
  onClose: () => void;
}) {
  const sorted = useMemo(
    () => [...workflows].sort((a, b) =>
      new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
    ),
    [workflows],
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{createMode ? '新建工作流' : '打开工作流'}</DialogTitle>
        </DialogHeader>
        {createMode && (
          <div className="py-2">
            <Button onClick={onCreate} className="w-full">
              创建空白工作流
            </Button>
          </div>
        )}
        {!createMode && (
          <div className="max-h-[400px] overflow-y-auto space-y-1">
            {sorted.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-8">暂无工作流</div>
            )}
            {sorted.map(wf => (
              <button
                key={wf.id}
                className="w-full text-left px-3 py-2 rounded-md hover:bg-accent text-sm transition-colors flex items-center justify-between"
                onClick={() => onSelect(wf)}
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{wf.name || '未命名'}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {wf.nodes?.length || 0} 个节点
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
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
