// React hooks for workflow editor
// Converted from workfox composables

import { useCallback, useEffect, useRef, useState } from 'react';
import { getWorkflowEditorStore } from '@/stores/workflow-editor';
import type { Workflow, WorkflowNode, WorkflowEdge } from '@agent-spaces/shared';

// ---- useWorkflowEditor ----

export function useWorkflowEditor(workspaceId: string) {
  const store = getWorkflowEditorStore(workspaceId);
  const state = store();

  return {
    ...state,
    store,
  };
}

// ---- useFlowCanvas ----

export function useFlowCanvas() {
  const [isDragging, setIsDragging] = useState(false);

  const onDragStart = useCallback(() => setIsDragging(true), []);
  const onDragEnd = useCallback(() => setIsDragging(false), []);

  return { isDragging, onDragStart, onDragEnd };
}

// ---- useEditorShortcuts ----

export function useEditorShortcuts({
  onSave,
  onUndo,
  onRedo,
  onDelete,
  onCopy,
  onPaste,
}: {
  onSave?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onDelete?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        onSave?.();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        onUndo?.();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        onRedo?.();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        e.preventDefault();
        onRedo?.();
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
          onDelete?.();
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
        onCopy?.();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
        onPaste?.();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onSave, onUndo, onRedo, onDelete, onCopy, onPaste]);
}

// ---- useClipboard ----

export function useClipboard() {
  const clipboardRef = useRef<{ nodes: WorkflowNode[]; edges: WorkflowEdge[] } | null>(null);

  const copy = useCallback((nodes: WorkflowNode[], edges: WorkflowEdge[]) => {
    clipboardRef.current = {
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
    };
  }, []);

  const paste = useCallback((): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } | null => {
    if (!clipboardRef.current) return null;
    const { nodes, edges } = clipboardRef.current;
    // Generate new IDs to avoid conflicts
    const idMap = new Map<string, string>();
    const newNodes = nodes.map(n => {
      const newId = `node_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      idMap.set(n.id, newId);
      return { ...n, id: newId, position: { x: n.position.x + 20, y: n.position.y + 20 } };
    });
    const newEdges = edges.map(e => ({
      ...e,
      id: `edge_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      source: idMap.get(e.source) || e.source,
      target: idMap.get(e.target) || e.target,
    }));
    return { nodes: newNodes, edges: newEdges };
  }, []);

  const hasData = clipboardRef.current !== null;

  return { copy, paste, hasData };
}

// ---- useExecutionPanel ----

export function useExecutionPanel() {
  const [isExpanded, setIsExpanded] = useState(false);
  const toggle = useCallback(() => setIsExpanded(v => !v), []);
  return { isExpanded, toggle, setExpanded: setIsExpanded };
}

// ---- usePanelSizes ----

export function usePanelSizes(storageKey: string) {
  const [sizes, setSizes] = useState<number[]>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : [280, 420];
    } catch {
      return [280, 420];
    }
  });

  const updateSizes = useCallback((newSizes: number[]) => {
    setSizes(newSizes);
    try {
      localStorage.setItem(storageKey, JSON.stringify(newSizes));
    } catch {}
  }, [storageKey]);

  return { sizes, updateSizes };
}
