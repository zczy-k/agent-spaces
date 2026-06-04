'use client';

import { useState, useCallback, useEffect } from 'react';
import { applyNodeChanges, applyEdgeChanges } from '@xyflow/react';
import type { NodeChange, EdgeChange, Connection } from '@xyflow/react';
import type { Workflow } from '@agent-spaces/shared';
import { getNodeDefinition } from '@/lib/workflow-nodes';
import type { NodeSelectContext } from './workflow-editor-types';

interface UseWorkflowEditorCanvasParams {
  workflow: Workflow | null;
  setWorkflow: React.Dispatch<React.SetStateAction<Workflow | null>>;
  markDirty: () => void;
  pushUndo: (description?: string) => void;
  selectedNodeId: string | null;
  setSelectedNodeId: React.Dispatch<React.SetStateAction<string | null>>;
}

export function useWorkflowEditorCanvas({
  workflow, setWorkflow, markDirty, pushUndo,
  selectedNodeId, setSelectedNodeId,
}: UseWorkflowEditorCanvasParams) {
  const [nodeSelectOpen, setNodeSelectOpen] = useState(false);
  const [nodeSelectContext, setNodeSelectContext] = useState<NodeSelectContext | null>(null);

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
  }, [workflow, pushUndo, markDirty, setSelectedNodeId]);

  const handleConnectionDrop = useCallback((context: {
    sourceNodeId: string;
    sourceHandle: string | null;
    position: { x: number; y: number } | null;
  }) => {
    setNodeSelectContext({ mode: 'connection-drop', ...context });
    setNodeSelectOpen(true);
  }, []);

  useEffect(() => {
    const handleOpenNodeSelect = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        edgeId?: string | null;
        source?: string | null;
        target?: string | null;
        sourceHandle?: string | null;
      } | undefined;
      if (!detail?.source || !detail.target) return;
      setNodeSelectContext({
        mode: 'edge-insert',
        edgeId: detail.edgeId ?? null,
        sourceNodeId: detail.source,
        targetNodeId: detail.target,
        sourceHandle: detail.sourceHandle ?? null,
      });
      setNodeSelectOpen(true);
    };

    window.addEventListener('workflow:open-node-select', handleOpenNodeSelect);
    return () => window.removeEventListener('workflow:open-node-select', handleOpenNodeSelect);
  }, []);

  const handleNodeSelectOpenChange = useCallback((open: boolean) => {
    setNodeSelectOpen(open);
    if (!open) setNodeSelectContext(null);
  }, []);

  const handleNodeSelectFromDialog = useCallback((type: string) => {
    if (!workflow || !nodeSelectContext) return;
    const def = getNodeDefinition(type);
    if (def?.manualCreate === false) return;
    if (def?.singleton && workflow.nodes.some(node => node.type === type)) return;

    const id = `node_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const data: Record<string, unknown> = {};
    if (def?.properties) {
      for (const prop of def.properties) {
        if (prop.default !== undefined) data[prop.key] = prop.default;
      }
    }

    if (nodeSelectContext.mode === 'connection-drop') {
      const sourceNode = workflow.nodes.find(node => node.id === nodeSelectContext.sourceNodeId);
      if (!sourceNode) return;
      const position = nodeSelectContext.position ?? {
        x: sourceNode.position.x + 250,
        y: sourceNode.position.y,
      };
      const newNode: Workflow['nodes'][0] = {
        id,
        type,
        label: def?.label || type,
        position,
        data: {
          ...data,
          sourceNodeId: nodeSelectContext.sourceNodeId,
          sourceHandle: nodeSelectContext.sourceHandle,
        },
      };
      const newEdge: Workflow['edges'][0] = {
        id: `e-${nodeSelectContext.sourceNodeId}-${id}`,
        source: nodeSelectContext.sourceNodeId,
        target: id,
        sourceHandle: nodeSelectContext.sourceHandle || undefined,
        targetHandle: undefined,
      };

      pushUndo('add connected node');
      setWorkflow(current => current ? {
        ...current,
        nodes: [...current.nodes, newNode],
        edges: [...current.edges, newEdge],
      } : null);
      setSelectedNodeId(id);
      markDirty();
      return;
    }

    const sourceNode = workflow.nodes.find(node => node.id === nodeSelectContext.sourceNodeId);
    const targetNode = workflow.nodes.find(node => node.id === nodeSelectContext.targetNodeId);
    if (!sourceNode || !targetNode) return;

    const position = {
      x: (sourceNode.position.x + targetNode.position.x) / 2,
      y: (sourceNode.position.y + targetNode.position.y) / 2,
    };
    const newNode: Workflow['nodes'][0] = {
      id,
      type,
      label: def?.label || type,
      position,
      data: {
        ...data,
        sourceNodeId: nodeSelectContext.sourceNodeId,
        sourceHandle: nodeSelectContext.sourceHandle,
      },
    };
    const firstEdge: Workflow['edges'][0] = {
      id: `e-${nodeSelectContext.sourceNodeId}-${id}`,
      source: nodeSelectContext.sourceNodeId,
      target: id,
      sourceHandle: nodeSelectContext.sourceHandle || undefined,
      targetHandle: undefined,
    };
    const secondEdge: Workflow['edges'][0] = {
      id: `e-${id}-${nodeSelectContext.targetNodeId}`,
      source: id,
      target: nodeSelectContext.targetNodeId,
      sourceHandle: undefined,
      targetHandle: undefined,
    };

    pushUndo('insert node');
    setWorkflow(current => current ? {
      ...current,
      nodes: [...current.nodes, newNode],
      edges: [
        ...current.edges.filter(edge => edge.id !== nodeSelectContext.edgeId),
        firstEdge,
        secondEdge,
      ],
    } : null);
    setSelectedNodeId(id);
    markDirty();
  }, [workflow, nodeSelectContext, pushUndo, markDirty, setSelectedNodeId]);

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
  }, [workflow, pushUndo, markDirty, selectedNodeId, setSelectedNodeId]);

  const handleNodeSelect = useCallback((id: string | null) => {
    setSelectedNodeId(id);
  }, [setSelectedNodeId]);

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
    const hasDelete = changes.some(c => c.type === 'remove');
    if (hasDelete) pushUndo('delete');

    const rfNodes = workflow.nodes.map(n => {
      const definition = getNodeDefinition(n.type);
      const width = definition?.customViewMinSize?.width || 140;
      const height = definition?.customViewMinSize?.height || 60;
      return {
        id: n.id,
        type: 'custom' as const,
        position: n.position,
        width,
        height,
        initialWidth: width,
        initialHeight: height,
        measured: { width, height },
        style: { minWidth: width, minHeight: height },
        data: { ...n.data, label: n.label, nodeType: n.type, width, height },
      };
    });
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

  return {
    // Node select dialog
    nodeSelectOpen,
    handleNodeSelectOpenChange,
    handleNodeSelectFromDialog,

    // Node operations
    handleNodeAdd,
    handleNodeDelete,
    handleNodeSelect,
    handleNodeDataUpdate,
    handleConnectionDrop,

    // Edge operations
    handleConnect,
    handleNodesChange,
    handleEdgesChange,
  };
}
