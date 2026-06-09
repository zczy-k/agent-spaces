'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { ExecutionLog, OperationEntry, Workflow, WorkflowTemplate } from '@agent-spaces/shared';
import { useWorkflowStore } from '@/stores/workflow';
import { operationHistoryApi, workflowApi } from '@/lib/workflow-api';
import { loadWorkflowLayout } from './workflow-editor-types';
import type { Layout } from 'react-resizable-panels';

export function useWorkflowEditorState(template: WorkflowTemplate | null) {
  const store = useWorkflowStore();

  // ---- Panel layout persistence ----
  const workflowLayout = useMemo(() => loadWorkflowLayout(), []);
  const onWorkflowLayoutChange = useCallback((layout: Layout) => {
    try { localStorage.setItem('agent-spaces:workflow-editor-layout', JSON.stringify(layout)); } catch {}
  }, []);

  // ---- Core state ----
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(!!template);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [rightTab, setRightTab] = useState('properties');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState('');
  const [isPreview, setIsPreview] = useState(false);
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const [operationLog, setOperationLog] = useState<OperationEntry[]>([]);
  const [triggerDialogOpen, setTriggerDialogOpen] = useState(false);
  const [pluginsDialogOpen, setPluginsDialogOpen] = useState(false);
  const [pluginPickerDialogOpen, setPluginPickerDialogOpen] = useState(false);
  const [embeddedEditorOpen, setEmbeddedEditorOpen] = useState(false);
  const [embeddedSubWorkflowId, setEmbeddedSubWorkflowId] = useState<string | null>(null);

  const autoSaveTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const prePreviewWorkflowRef = useRef<Workflow | null>(null);

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
        prePreviewWorkflowRef.current = null;
        setWorkflow(wf);
        setOperationLog([]);
        setIsPreview(false);
        setIsLoading(false);
      })
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : '加载失败');
        setIsLoading(false);
      });
  }, [template]);

  // ---- Dirty tracking ----
  const markDirty = useCallback(() => setIsDirty(true), []);

  const cloneWorkflow = useCallback((value: Workflow): Workflow => JSON.parse(JSON.stringify(value)) as Workflow, []);

  const enterPreview = useCallback((log: ExecutionLog) => {
    if (!log.snapshot) return;

    setWorkflow((current) => {
      if (!current) return current;
      if (!prePreviewWorkflowRef.current) {
        prePreviewWorkflowRef.current = cloneWorkflow(current);
      }

      return {
        ...current,
        nodes: JSON.parse(JSON.stringify(log.snapshot!.nodes)) as Workflow['nodes'],
        edges: JSON.parse(JSON.stringify(log.snapshot!.edges)) as Workflow['edges'],
        groups: log.snapshot!.groups
          ? JSON.parse(JSON.stringify(log.snapshot!.groups)) as Workflow['groups']
          : [],
      };
    });
    setSelectedNodeId(null);
    setSelectedNodeIds([]);
    setIsPreview(true);
  }, [cloneWorkflow]);

  const exitPreview = useCallback(() => {
    setWorkflow((current) => {
      const restored = prePreviewWorkflowRef.current;
      prePreviewWorkflowRef.current = null;
      return restored ? cloneWorkflow(restored) : current;
    });
    setSelectedNodeId(null);
    setSelectedNodeIds([]);
    setIsPreview(false);
  }, [cloneWorkflow]);

  // ---- Undo / Redo ----
  const workflowId = workflow?.id ?? null;

  useEffect(() => {
    if (!workflowId) {
      setOperationLog([]);
      return;
    }

    let cancelled = false;
    operationHistoryApi.load(workflowId)
      .then((entries) => {
        if (!cancelled) setOperationLog(entries);
      })
      .catch(() => {
        // Operation history is optional.
      });

    return () => {
      cancelled = true;
    };
  }, [workflowId]);

  const pushUndo = useCallback((description?: string) => {
    if (!workflow) return;
    const snapshot = JSON.stringify({ nodes: workflow.nodes, edges: workflow.edges, variables: workflow.variables || [] });
    const entry: OperationEntry = {
      description: description || 'edit',
      timestamp: Date.now(),
      snapshot,
    };
    setUndoStack(prev => [...prev, snapshot]);
    setRedoStack([]);
    setOperationLog((prev) => {
      const next = [...prev, entry];
      void operationHistoryApi.save(workflow.id, next).catch(() => {});
      return next;
    });
  }, [workflow]);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0 || !workflow) return;
    const currentSnapshot = JSON.stringify({ nodes: workflow.nodes, edges: workflow.edges, variables: workflow.variables || [] });
    const prevSnapshot = undoStack[undoStack.length - 1];
    const prev = JSON.parse(prevSnapshot);
    setUndoStack(s => s.slice(0, -1));
    setRedoStack(s => [...s, currentSnapshot]);
    setWorkflow(w => w ? { ...w, nodes: prev.nodes, edges: prev.edges, variables: prev.variables || [] } : null);
    markDirty();
  }, [undoStack, workflow, markDirty]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0 || !workflow) return;
    const currentSnapshot = JSON.stringify({ nodes: workflow.nodes, edges: workflow.edges, variables: workflow.variables || [] });
    const nextSnapshot = redoStack[redoStack.length - 1];
    const next = JSON.parse(nextSnapshot);
    setUndoStack(s => [...s, currentSnapshot]);
    setRedoStack(s => s.slice(0, -1));
    setWorkflow(w => w ? { ...w, nodes: next.nodes, edges: next.edges, variables: next.variables || [] } : null);
    markDirty();
  }, [redoStack, workflow, markDirty]);

  // ---- Save ----
  const saveWorkflow = useCallback(async (workflowToSave?: Workflow) => {
    if (isPreview) return;
    const nextWorkflow = workflowToSave ?? workflow;
    if (!nextWorkflow) return;
    setIsSaving(true);
    try {
      const saved = await workflowApi.update(nextWorkflow.id, {
        ...nextWorkflow,
        updatedAt: Date.now(),
      });
      setWorkflow(saved);
      setIsDirty(false);
      store.upsertWorkflow(saved);
    } finally {
      setIsSaving(false);
    }
  }, [isPreview, workflow, store]);

  // ---- Auto-save ----
  useEffect(() => {
    autoSaveTimer.current = setInterval(() => {
      if (isDirty && workflow && !isPreview) saveWorkflow();
    }, 10_000);
    return () => { if (autoSaveTimer.current) clearInterval(autoSaveTimer.current); };
  }, [isDirty, isPreview, workflow, saveWorkflow]);

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

  const clearOperationHistory = useCallback(async () => {
    if (!workflow) return;
    await operationHistoryApi.clear(workflow.id);
    setUndoStack([]);
    setRedoStack([]);
    setOperationLog([]);
  }, [workflow]);

  // ---- Computed ----
  const selectedNode = useMemo(
    () => workflow?.nodes.find(n => n.id === selectedNodeId) ?? null,
    [workflow, selectedNodeId],
  );

  return {
    // State
    workflow, setWorkflow,
    isDirty, isSaving, isLoading, loadError,
    selectedNodeId, setSelectedNodeId,
    selectedNodeIds, setSelectedNodeIds,
    rightTab, setRightTab,
    isEditingName, setIsEditingName,
    editingName, setEditingName,
    isPreview, setIsPreview,
    undoStack, redoStack, operationLog,
    triggerDialogOpen, setTriggerDialogOpen,
    pluginsDialogOpen, setPluginsDialogOpen,
    pluginPickerDialogOpen, setPluginPickerDialogOpen,
    embeddedEditorOpen, setEmbeddedEditorOpen,
    embeddedSubWorkflowId, setEmbeddedSubWorkflowId,
    workflowLayout, onWorkflowLayoutChange,

    // Actions
    markDirty, pushUndo, handleUndo, handleRedo, clearOperationHistory,
    enterPreview, exitPreview,
    saveWorkflow,
    startEditName, finishEditName,
    handleExport, handleImport,
    handleWorkflowMetaChange: useCallback((nextWorkflow: Workflow) => {
      setWorkflow(nextWorkflow);
      markDirty();
    }, [markDirty]),

    // Computed
    selectedNode,
    workflowId,
  };
}
