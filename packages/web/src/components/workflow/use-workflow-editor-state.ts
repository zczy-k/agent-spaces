'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { Workflow, WorkflowTemplate } from '@agent-spaces/shared';
import { useWorkflowStore } from '@/stores/workflow';
import { workflowApi } from '@/lib/workflow-api';
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
  const [rightTab, setRightTab] = useState('properties');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState('');
  const [isPreview, setIsPreview] = useState(false);
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const [triggerDialogOpen, setTriggerDialogOpen] = useState(false);
  const [pluginsDialogOpen, setPluginsDialogOpen] = useState(false);
  const [embeddedEditorOpen, setEmbeddedEditorOpen] = useState(false);
  const [embeddedSubWorkflowId, setEmbeddedSubWorkflowId] = useState<string | null>(null);

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

  // ---- Computed ----
  const selectedNode = useMemo(
    () => workflow?.nodes.find(n => n.id === selectedNodeId) ?? null,
    [workflow, selectedNodeId],
  );

  const workflowId = workflow?.id ?? null;

  return {
    // State
    workflow, setWorkflow,
    isDirty, isSaving, isLoading, loadError,
    selectedNodeId, setSelectedNodeId,
    rightTab, setRightTab,
    isEditingName, setIsEditingName,
    editingName, setEditingName,
    isPreview, setIsPreview,
    undoStack, redoStack,
    triggerDialogOpen, setTriggerDialogOpen,
    pluginsDialogOpen, setPluginsDialogOpen,
    embeddedEditorOpen, setEmbeddedEditorOpen,
    embeddedSubWorkflowId, setEmbeddedSubWorkflowId,
    workflowLayout, onWorkflowLayoutChange,

    // Actions
    markDirty, pushUndo, handleUndo, handleRedo,
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
