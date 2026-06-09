import React, { useCallback, useEffect, useState } from 'react';
import { type EdgeChange } from '@xyflow/react';
import type { Workflow } from '@agent-spaces/shared';

interface UseCanvasDomEventsParams {
  isCanvasLocked: boolean;
  workflowEdges: Workflow['edges'];
  onEdgesChange: (changes: EdgeChange[]) => void;
  onNodeSelect: (id: string | null, multi?: boolean) => void;
  onNodeDelete: (id: string) => void;
  onNodeDataUpdate: (id: string, data: Record<string, unknown>) => void;
  onNodeCopy?: (id: string) => void;
  onNodeClone?: (id: string) => void;
  onNodeStage?: (id: string) => void;
}

export function useCanvasDomEvents({
  isCanvasLocked,
  workflowEdges,
  onEdgesChange,
  onNodeSelect,
  onNodeDelete,
  onNodeDataUpdate,
  onNodeCopy,
  onNodeClone,
  onNodeStage,
}: UseCanvasDomEventsParams) {
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  const removeEdge = useCallback((edgeId: string) => {
    const edge = workflowEdges.find(item => item.id === edgeId);
    if (!edge || edge.composite?.locked || isCanvasLocked) return;
    setSelectedEdgeId(null);
    onEdgesChange([{ id: edgeId, type: 'remove' }]);
  }, [isCanvasLocked, onEdgesChange, workflowEdges]);

  const selectEdge = useCallback((edgeId: string | null) => {
    setSelectedEdgeId(edgeId);
    if (edgeId) onNodeSelect(null);
  }, [onNodeSelect]);

  const handleEdgeInsertNode = useCallback((e: Event) => {
    if (isCanvasLocked) return;
    const detail = (e as CustomEvent).detail;
    window.dispatchEvent(new CustomEvent('workflow:open-node-select', { detail }));
  }, [isCanvasLocked]);

  const handleEdgeSelect = useCallback((e: Event) => {
    const detail = (e as CustomEvent).detail as { edgeId?: string | null } | undefined;
    selectEdge(detail?.edgeId ?? null);
  }, [selectEdge]);

  const handleEdgeDelete = useCallback((e: Event) => {
    const detail = (e as CustomEvent).detail as { edgeId?: string | null } | undefined;
    if (!detail?.edgeId) return;
    removeEdge(detail.edgeId);
  }, [removeEdge]);

  const handleNodeDelete = useCallback((e: Event) => {
    if (isCanvasLocked) return;
    const detail = (e as CustomEvent).detail;
    onNodeDelete(detail.nodeId);
  }, [isCanvasLocked, onNodeDelete]);

  const handleNodeDataUpdate = useCallback((e: Event) => {
    if (isCanvasLocked) return;
    const detail = (e as CustomEvent).detail;
    if (!detail?.nodeId || !detail?.data) return;
    onNodeDataUpdate(detail.nodeId, detail.data);
  }, [isCanvasLocked, onNodeDataUpdate]);

  const handleNodeCopyEvent = useCallback((e: Event) => {
    if (isCanvasLocked || !onNodeCopy) return;
    onNodeCopy((e as CustomEvent).detail.nodeId);
  }, [isCanvasLocked, onNodeCopy]);

  const handleNodeCloneEvent = useCallback((e: Event) => {
    if (isCanvasLocked || !onNodeClone) return;
    onNodeClone((e as CustomEvent).detail.nodeId);
  }, [isCanvasLocked, onNodeClone]);

  const handleNodeStageEvent = useCallback((e: Event) => {
    if (isCanvasLocked || !onNodeStage) return;
    onNodeStage((e as CustomEvent).detail.nodeId);
  }, [isCanvasLocked, onNodeStage]);

  // Register custom event listeners
  useEffect(() => {
    window.addEventListener('workflow:edge-insert-node', handleEdgeInsertNode);
    window.addEventListener('workflow:select-edge', handleEdgeSelect);
    window.addEventListener('workflow:delete-edge', handleEdgeDelete);
    window.addEventListener('workflow:delete-node', handleNodeDelete);
    window.addEventListener('workflow:update-node-data', handleNodeDataUpdate);
    window.addEventListener('workflow:copy-node', handleNodeCopyEvent);
    window.addEventListener('workflow:clone-node', handleNodeCloneEvent);
    window.addEventListener('workflow:stage-node', handleNodeStageEvent);
    return () => {
      window.removeEventListener('workflow:edge-insert-node', handleEdgeInsertNode);
      window.removeEventListener('workflow:select-edge', handleEdgeSelect);
      window.removeEventListener('workflow:delete-edge', handleEdgeDelete);
      window.removeEventListener('workflow:delete-node', handleNodeDelete);
      window.removeEventListener('workflow:update-node-data', handleNodeDataUpdate);
      window.removeEventListener('workflow:copy-node', handleNodeCopyEvent);
      window.removeEventListener('workflow:clone-node', handleNodeCloneEvent);
      window.removeEventListener('workflow:stage-node', handleNodeStageEvent);
    };
  }, [handleEdgeDelete, handleEdgeInsertNode, handleEdgeSelect, handleNodeDelete, handleNodeDataUpdate, handleNodeCopyEvent, handleNodeCloneEvent, handleNodeStageEvent]);

  // Keyboard delete for selected edge
  useEffect(() => {
    if (isCanvasLocked || !selectedEdgeId) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Delete' && event.key !== 'Backspace') return;

      const target = event.target;
      if (
        target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || target instanceof HTMLSelectElement
        || (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      removeEdge(selectedEdgeId);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isCanvasLocked, removeEdge, selectedEdgeId]);

  return { selectedEdgeId, selectEdge, removeEdge };
}
