'use client';

import { useState, useCallback, useEffect } from 'react';
import Dagre from '@dagrejs/dagre';
import ELK from 'elkjs/lib/elk.bundled';
import { applyNodeChanges, applyEdgeChanges } from '@xyflow/react';
import type { NodeChange, EdgeChange, Connection } from '@xyflow/react';
import type { ElkNode } from 'elkjs/lib/elk-api';
import type { Workflow } from '@agent-spaces/shared';
import {
  LOOP_BODY_ROLE,
  LOOP_BODY_SOURCE_HANDLE,
  LOOP_NEXT_SOURCE_HANDLE,
  findCompositeChildByRole,
  getCompositeParentId,
  isHiddenWorkflowEdge,
  isHiddenWorkflowNode,
  isScopeBoundaryWorkflowNode,
} from '@agent-spaces/shared';
import { createWorkflowEdgeId } from '@/lib/workflow-edge-id';
import { getNodeDefinition } from '@/lib/workflow-nodes';
import type { NodeSelectContext } from './workflow-editor-types';
import { getWorkflowNodeSize } from './workflow-node-size';

interface UseWorkflowEditorCanvasParams {
  workflow: Workflow | null;
  isReadOnly?: boolean;
  setWorkflow: React.Dispatch<React.SetStateAction<Workflow | null>>;
  markDirty: () => void;
  pushUndo: (description?: string) => void;
  selectedNodeId: string | null;
  setSelectedNodeId: React.Dispatch<React.SetStateAction<string | null>>;
  selectedNodeIds: string[];
  setSelectedNodeIds: React.Dispatch<React.SetStateAction<string[]>>;
  onCopyNodes?: (nodeIds: string[]) => void;
  onStageNode?: (nodeId: string) => void;
}

function areStringArraysEqual(a: string[], b: string[]) {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

function createWorkflowNodeId(): string {
  return `node_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createNodeData(type: string): Record<string, unknown> {
  const def = getNodeDefinition(type);
  const data: Record<string, unknown> = {};
  if (def?.properties) {
    for (const prop of def.properties) {
      if (prop.default !== undefined) data[prop.key] = prop.default;
    }
  }
  if (def?.outputs?.length) data.outputs = def.outputs;
  return data;
}

function cloneNodeData(data: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(data)) as Record<string, unknown>;
}

function createNodesForDefinition(
  type: string,
  position: { x: number; y: number },
  rootData?: Record<string, unknown>,
  scopeNode?: Workflow['nodes'][0] | null,
): { rootNode: Workflow['nodes'][0]; nodes: Workflow['nodes']; edges: Workflow['edges'] } | null {
  const def = getNodeDefinition(type);
  const scopeComposite = scopeNode
    ? {
        rootId: scopeNode.composite?.rootId || scopeNode.id,
        parentId: scopeNode.id,
        generated: false,
        hidden: false,
      }
    : undefined;

  if (!def?.compound) {
    const rootNode: Workflow['nodes'][0] = {
      id: createWorkflowNodeId(),
      type,
      label: def?.label || type,
      position,
      data: { ...createNodeData(type), ...(rootData || {}) },
      composite: scopeComposite,
    };
    return { rootNode, nodes: [rootNode], edges: [] };
  }

  const roleMap = new Map<string, Workflow['nodes'][0]>();
  const rootRole = def.compound.rootRole || def.compound.children[0]?.role;
  if (!rootRole) return null;

  for (const childDef of def.compound.children) {
    const isRoot = childDef.role === rootRole;
    const nodeDefinition = getNodeDefinition(childDef.type);
    const offset = childDef.offset || { x: 0, y: 0 };
    const childData = {
      ...createNodeData(childDef.type),
      ...(childDef.data ? cloneNodeData(childDef.data) : {}),
      ...(isRoot && rootData ? rootData : {}),
    };
    const node: Workflow['nodes'][0] = {
      id: createWorkflowNodeId(),
      type: childDef.type,
      label: isRoot ? (def.label || childDef.label || childDef.type) : (childDef.label || nodeDefinition?.label || childDef.type),
      position: {
        x: position.x + offset.x,
        y: position.y + offset.y,
      },
      data: childData,
      composite: {
        role: childDef.role,
        generated: !isRoot,
        hidden: !!childDef.hidden,
        scopeBoundary: !!childDef.scopeBoundary,
      },
    };
    roleMap.set(childDef.role, node);
  }

  const rootNode = roleMap.get(rootRole);
  if (!rootNode) return null;

  rootNode.composite = {
    ...(rootNode.composite || {}),
    rootId: rootNode.id,
    parentId: null,
    generated: false,
    hidden: false,
  };

  for (const childDef of def.compound.children) {
    const node = roleMap.get(childDef.role);
    if (!node || node.id === rootNode.id) continue;
    const parentRole = childDef.parentRole || rootRole;
    const parentNode = roleMap.get(parentRole);
    node.composite = {
      ...(node.composite || {}),
      rootId: rootNode.id,
      parentId: parentNode?.id || rootNode.id,
    };
  }

  if (scopeNode) {
    for (const node of roleMap.values()) {
      node.composite = {
        ...(node.composite || {}),
        rootId: scopeNode.composite?.rootId || scopeNode.id,
        parentId: scopeNode.id,
      };
    }
  }

  const edges: Workflow['edges'] = [];
  for (const edgeDef of def.compound.edges || []) {
    const sourceNode = roleMap.get(edgeDef.sourceRole);
    const targetNode = roleMap.get(edgeDef.targetRole);
    if (!sourceNode || !targetNode) continue;
    edges.push({
      id: createWorkflowEdgeId({
        source: sourceNode.id,
        target: targetNode.id,
        sourceHandle: edgeDef.sourceHandle,
        targetHandle: edgeDef.targetHandle,
      }),
      source: sourceNode.id,
      target: targetNode.id,
      sourceHandle: edgeDef.sourceHandle ?? null,
      targetHandle: edgeDef.targetHandle ?? null,
      composite: {
        rootId: rootNode.id,
        parentId: sourceNode.id,
        generated: true,
        hidden: !!edgeDef.hidden,
        locked: !!edgeDef.locked,
      },
    });
  }

  const nodes = [rootNode, ...Array.from(roleMap.values()).filter(node => node.id !== rootNode.id)];
  return { rootNode, nodes, edges };
}

function getOutgoingSourceHandle(type: string): string | undefined {
  const def = getNodeDefinition(type);
  if (def?.compound && def.handles?.sourceHandles?.some(handle => handle.id === LOOP_NEXT_SOURCE_HANDLE)) {
    return LOOP_NEXT_SOURCE_HANDLE;
  }
  return undefined;
}

function getInsertScopeNode(
  nodes: Workflow['nodes'],
  sourceNodeId?: string | null,
  sourceHandle?: string | null,
): Workflow['nodes'][0] | null {
  if (!sourceNodeId || sourceHandle !== LOOP_BODY_SOURCE_HANDLE) return null;
  return findCompositeChildByRole(nodes, sourceNodeId, LOOP_BODY_ROLE) ?? null;
}

export function useWorkflowEditorCanvas({
  workflow, isReadOnly = false, setWorkflow, markDirty, pushUndo,
  selectedNodeId, setSelectedNodeId, selectedNodeIds, setSelectedNodeIds,
  onCopyNodes, onStageNode,
}: UseWorkflowEditorCanvasParams) {
  const [nodeSelectOpen, setNodeSelectOpen] = useState(false);
  const [nodeSelectContext, setNodeSelectContext] = useState<NodeSelectContext | null>(null);

  // ---- Node operations ----
  const handleNodeAdd = useCallback((type: string, position: { x: number; y: number }) => {
    if (!workflow || isReadOnly) return;
    const created = createNodesForDefinition(type, position);
    if (!created) return;
    pushUndo('add node');
    setWorkflow(w => w ? { ...w, nodes: [...w.nodes, ...created.nodes], edges: [...w.edges, ...created.edges] } : null);
    setSelectedNodeId(created.rootNode.id);
    setSelectedNodeIds([created.rootNode.id]);
    markDirty();
  }, [workflow, isReadOnly, pushUndo, markDirty, setSelectedNodeId, setSelectedNodeIds]);

  const handleConnectionDrop = useCallback((context: {
    sourceNodeId: string;
    sourceHandle: string | null;
    position: { x: number; y: number } | null;
  }) => {
    if (isReadOnly) return;
    setNodeSelectContext({ mode: 'connection-drop', ...context });
    setNodeSelectOpen(true);
  }, [isReadOnly]);

  useEffect(() => {
    const handleOpenNodeSelect = (event: Event) => {
      if (isReadOnly) return;
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
  }, [isReadOnly]);

  const handleNodeSelectOpenChange = useCallback((open: boolean) => {
    setNodeSelectOpen(open);
    if (!open) setNodeSelectContext(null);
  }, []);

  const handleNodeSelectFromDialog = useCallback((type: string) => {
    if (!workflow || !nodeSelectContext || isReadOnly) return;
    const def = getNodeDefinition(type);
    if (def?.manualCreate === false) return;
    if (def?.singleton && workflow.nodes.some(node => node.type === type)) return;

    if (nodeSelectContext.mode === 'connection-drop') {
      const sourceNode = workflow.nodes.find(node => node.id === nodeSelectContext.sourceNodeId);
      if (!sourceNode) return;
      const position = nodeSelectContext.position ?? {
        x: sourceNode.position.x + 250,
        y: sourceNode.position.y,
      };
      const scopeNode = getInsertScopeNode(
        workflow.nodes,
        nodeSelectContext.sourceNodeId,
        nodeSelectContext.sourceHandle,
      );
      const created = createNodesForDefinition(type, position, {
        sourceNodeId: nodeSelectContext.sourceNodeId,
        sourceHandle: nodeSelectContext.sourceHandle,
      }, scopeNode);
      if (!created) return;
      const newEdge: Workflow['edges'][0] = {
        id: createWorkflowEdgeId({
          source: nodeSelectContext.sourceNodeId,
          target: created.rootNode.id,
          sourceHandle: nodeSelectContext.sourceHandle,
        }),
        source: nodeSelectContext.sourceNodeId,
        target: created.rootNode.id,
        sourceHandle: nodeSelectContext.sourceHandle || undefined,
        targetHandle: undefined,
      };

      pushUndo('add connected node');
      setWorkflow(current => current ? {
        ...current,
        nodes: [...current.nodes, ...created.nodes],
        edges: [...current.edges, newEdge, ...created.edges],
      } : null);
      setSelectedNodeId(created.rootNode.id);
      setSelectedNodeIds([created.rootNode.id]);
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
    const scopeNode = getInsertScopeNode(
      workflow.nodes,
      nodeSelectContext.sourceNodeId,
      nodeSelectContext.sourceHandle,
    );
    const created = createNodesForDefinition(type, position, {
      sourceNodeId: nodeSelectContext.sourceNodeId,
      sourceHandle: nodeSelectContext.sourceHandle,
    }, scopeNode);
    if (!created) return;
    const outgoingSourceHandle = getOutgoingSourceHandle(type);
    const firstEdge: Workflow['edges'][0] = {
      id: createWorkflowEdgeId({
        source: nodeSelectContext.sourceNodeId,
        target: created.rootNode.id,
        sourceHandle: nodeSelectContext.sourceHandle,
      }),
      source: nodeSelectContext.sourceNodeId,
      target: created.rootNode.id,
      sourceHandle: nodeSelectContext.sourceHandle || undefined,
      targetHandle: undefined,
    };
    const secondEdge: Workflow['edges'][0] = {
      id: createWorkflowEdgeId({
        source: created.rootNode.id,
        target: nodeSelectContext.targetNodeId,
        sourceHandle: outgoingSourceHandle,
      }),
      source: created.rootNode.id,
      target: nodeSelectContext.targetNodeId,
      sourceHandle: outgoingSourceHandle,
      targetHandle: undefined,
    };

    pushUndo('insert node');
    setWorkflow(current => current ? {
      ...current,
      nodes: [...current.nodes, ...created.nodes],
      edges: [
        ...current.edges.filter(edge => edge.id !== nodeSelectContext.edgeId),
        firstEdge,
        ...created.edges,
        secondEdge,
      ],
    } : null);
    setSelectedNodeId(created.rootNode.id);
    setSelectedNodeIds([created.rootNode.id]);
    markDirty();
  }, [workflow, nodeSelectContext, isReadOnly, pushUndo, markDirty, setSelectedNodeId, setSelectedNodeIds]);

  const handleNodeDelete = useCallback((nodeId: string) => {
    if (!workflow || isReadOnly) return;
    pushUndo('delete node');
    setWorkflow(w => w ? {
      ...w,
      nodes: w.nodes.filter(n => n.id !== nodeId),
      edges: w.edges.filter(e => e.source !== nodeId && e.target !== nodeId),
    } : null);
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
    setSelectedNodeIds(ids => ids.filter(id => id !== nodeId));
    markDirty();
  }, [workflow, isReadOnly, pushUndo, markDirty, selectedNodeId, setSelectedNodeId, setSelectedNodeIds]);

  const handleNodeClone = useCallback((nodeId: string) => {
    if (!workflow || isReadOnly) return;
    const node = workflow.nodes.find(n => n.id === nodeId);
    if (!node) return;
    pushUndo('clone node');
    const newId = `node_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const cloned = {
      ...node,
      id: newId,
      position: { x: node.position.x + 40, y: node.position.y + 40 },
      data: JSON.parse(JSON.stringify(node.data)),
    };
    setWorkflow(w => w ? { ...w, nodes: [...w.nodes, cloned] } : null);
    setSelectedNodeId(newId);
    setSelectedNodeIds([newId]);
    markDirty();
  }, [workflow, isReadOnly, pushUndo, markDirty, setSelectedNodeId, setSelectedNodeIds]);

  const handleNodeCopy = useCallback((nodeId: string) => {
    if (isReadOnly) return;
    onCopyNodes?.([nodeId]);
  }, [isReadOnly, onCopyNodes]);

  const handleNodeStage = useCallback((nodeId: string) => {
    if (isReadOnly) return;
    onStageNode?.(nodeId);
  }, [isReadOnly, onStageNode]);

  const handleNodeSelect = useCallback((id: string | null, multi = false) => {
    if (!id) {
      if (!selectedNodeId && selectedNodeIds.length === 0) return;
      setSelectedNodeId(null);
      setSelectedNodeIds([]);
      return;
    }

    if (!multi) {
      if (selectedNodeId === id && areStringArraysEqual(selectedNodeIds, [id])) return;
      setSelectedNodeId(id);
      setSelectedNodeIds([id]);
      return;
    }

    const selected = selectedNodeIds.includes(id);
    const next = selected ? selectedNodeIds.filter(item => item !== id) : [...selectedNodeIds, id];
    setSelectedNodeIds(next);
    setSelectedNodeId(selected ? next[next.length - 1] ?? null : id);
  }, [selectedNodeId, selectedNodeIds, setSelectedNodeId, setSelectedNodeIds]);

  const handleNodesSelect = useCallback((ids: string[], options?: { primaryNodeId?: string | null }) => {
    const primaryNodeId = options?.primaryNodeId ?? (ids.length === 1 ? ids[0] : null);
    if (selectedNodeId === primaryNodeId && areStringArraysEqual(selectedNodeIds, ids)) return;
    setSelectedNodeIds(ids);
    setSelectedNodeId(primaryNodeId);
  }, [selectedNodeId, selectedNodeIds, setSelectedNodeId, setSelectedNodeIds]);

  const handleNodeDataUpdate = useCallback((nodeId: string, data: Record<string, unknown>) => {
    if (isReadOnly) return;
    setWorkflow(w => {
      if (!w) return null;
      const { nodeState, breakpoint, nodeColor, ...nodeData } = data;
      return {
        ...w,
        nodes: w.nodes.map(n => n.id === nodeId ? {
          ...n,
          label: typeof data.label === 'string' ? data.label : n.label,
          ...(typeof nodeState === 'string' ? { nodeState: nodeState as typeof n.nodeState } : {}),
          ...('breakpoint' in data ? { breakpoint: breakpoint === null ? undefined : breakpoint as typeof n.breakpoint } : {}),
          ...('nodeColor' in data ? { nodeColor: nodeColor === null ? undefined : nodeColor as string | undefined } : {}),
          data: { ...n.data, ...nodeData },
        } : n),
      };
    });
    markDirty();
  }, [isReadOnly, markDirty, setWorkflow]);

  // ---- Edge operations ----
  const handleConnect = useCallback((connection: Connection) => {
    if (!workflow || isReadOnly) return;
    const edgeId = createWorkflowEdgeId(connection);
    if (workflow.edges.some(e => e.id === edgeId)) return;
    pushUndo('connect');
    const edge: Workflow['edges'][0] = {
      id: edgeId,
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle || undefined,
      targetHandle: connection.targetHandle || undefined,
    };
    setWorkflow(w => w ? { ...w, edges: [...w.edges, edge] } : null);
    markDirty();
  }, [workflow, isReadOnly, pushUndo, markDirty]);

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    if (!workflow || isReadOnly) return;
    const hasDelete = changes.some(c => c.type === 'remove');

    const rfNodes = workflow.nodes.map(n => {
      const definition = getNodeDefinition(n.type);
      const { minWidth, minHeight, width, height } = getWorkflowNodeSize(definition, n.data);
      return {
        id: n.id,
        type: 'custom' as const,
        position: n.position,
        width,
        height,
        initialWidth: width,
        initialHeight: height,
        measured: { width, height },
        style: { minWidth, minHeight, width, height },
        data: { ...n.data, label: n.label, nodeType: n.type, width, height },
      };
    });
    const updated = applyNodeChanges(changes, rfNodes);
    const hasDimensionChange = changes.some(c => c.type === 'dimensions');

    setWorkflow(w => {
      if (!w) return null;
      return {
        ...w,
        nodes: updated.map(n => {
          const existing = w.nodes.find(wn => wn.id === n.id);
          if (!existing) return w.nodes.find(wn => wn.id === n.id)!;
          const width = typeof n.width === 'number' ? Math.round(n.width) : existing.data.width;
          const height = typeof n.height === 'number' ? Math.round(n.height) : existing.data.height;
          return {
            ...existing,
            position: n.position,
            data: hasDimensionChange ? { ...existing.data, width, height } : existing.data,
          };
        }).filter(Boolean),
      };
    });
    if (hasDelete || hasDimensionChange) markDirty();
  }, [workflow, isReadOnly, pushUndo, markDirty]);

  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    if (!workflow || isReadOnly) return;
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
  }, [workflow, isReadOnly, pushUndo, markDirty]);

  const handleCanvasPreferencesChange = useCallback((prefs: Record<string, unknown>) => {
    if (!workflow || isReadOnly) return;
    setWorkflow(w => w ? { ...w, layoutSnapshot: prefs } : null);
    markDirty();
  }, [workflow, isReadOnly, markDirty]);

  const handleAutoLayout = useCallback(async (direction: 'LR' | 'TB', options?: { layoutEngine?: string }) => {
    if (!workflow || isReadOnly || workflow.nodes.length === 0) return;
    pushUndo('auto layout');

    const layoutEngine = options?.layoutEngine || (workflow.layoutSnapshot?.layoutEngine as string) || 'dagre';
    const layoutNodes = workflow.nodes.filter(node => !isHiddenWorkflowNode(node) && !getCompositeParentId(node));
    const layoutNodeIds = new Set(layoutNodes.map(node => node.id));
    const nodeSizes = new Map<string, { width: number; height: number }>();

    for (const node of layoutNodes) {
      const definition = getNodeDefinition(node.type);
      const nodeSize = getWorkflowNodeSize(definition, node.data);
      const size = {
        width: typeof node.data?.width === 'number' ? nodeSize.width : Math.max(nodeSize.width, 220),
        height: typeof node.data?.height === 'number' ? nodeSize.height : Math.max(nodeSize.height, 120),
      };
      nodeSizes.set(node.id, size);
    }

    const layoutEdges = workflow.edges.filter(edge =>
      !isHiddenWorkflowEdge(edge)
      && layoutNodeIds.has(edge.source)
      && layoutNodeIds.has(edge.target)
    );
    const layoutPositions = new Map<string, { x: number; y: number }>();

    if (layoutEngine === 'elk') {
      const elk = new ELK();
      const elkGraph: ElkNode = {
        id: 'workflow',
        layoutOptions: {
          'elk.algorithm': 'layered',
          'elk.direction': direction === 'LR' ? 'RIGHT' : 'DOWN',
          'elk.spacing.nodeNode': '60',
          'elk.layered.spacing.nodeNodeBetweenLayers': '90',
        },
        children: layoutNodes.map(node => {
          const size = nodeSizes.get(node.id);
          return {
            id: node.id,
            width: size?.width ?? 220,
            height: size?.height ?? 120,
          };
        }),
        edges: layoutEdges.map(edge => ({
          id: edge.id,
          sources: [edge.source],
          targets: [edge.target],
        })),
      };
      const result = await elk.layout(elkGraph);
      for (const child of result.children ?? []) {
        if (typeof child.x === 'number' && typeof child.y === 'number') {
          layoutPositions.set(child.id, { x: child.x, y: child.y });
        }
      }
    } else {
      const graph = new Dagre.graphlib.Graph();
      graph.setDefaultEdgeLabel(() => ({}));
      graph.setGraph({ rankdir: direction, nodesep: 60, ranksep: 80 });

      for (const node of layoutNodes) {
        graph.setNode(node.id, nodeSizes.get(node.id) ?? { width: 220, height: 120 });
      }
      for (const edge of layoutEdges) {
        graph.setEdge(edge.source, edge.target);
      }

      Dagre.layout(graph);
      for (const node of layoutNodes) {
        const layoutPosition = graph.node(node.id);
        const size = nodeSizes.get(node.id);
        if (!layoutPosition) continue;
        layoutPositions.set(node.id, {
          x: layoutPosition.x - (size?.width ?? 220) / 2,
          y: layoutPosition.y - (size?.height ?? 120) / 2,
        });
      }
    }

    setWorkflow(current => {
      if (!current) return null;
      const nextNodes = current.nodes.map(node => ({ ...node, position: { ...node.position } }));
      const nodeById = new Map(nextNodes.map(node => [node.id, node]));

      for (const node of layoutNodes) {
        const nextNode = nodeById.get(node.id);
        const nextPosition = layoutPositions.get(node.id);
        if (!nextNode || !nextPosition) continue;

        if (isScopeBoundaryWorkflowNode(nextNode)) {
          const dx = nextPosition.x - nextNode.position.x;
          const dy = nextPosition.y - nextNode.position.y;
          for (const child of nextNodes.filter(item => getCompositeParentId(item) === nextNode.id)) {
            child.position = {
              x: child.position.x + dx,
              y: child.position.y + dy,
            };
          }
        }

        nextNode.position = nextPosition;
      }

      return { ...current, nodes: nextNodes };
    });
    markDirty();
  }, [workflow, isReadOnly, pushUndo, setWorkflow, markDirty]);

  return {
    // Node select dialog
    nodeSelectOpen,
    handleNodeSelectOpenChange,
    handleNodeSelectFromDialog,

    // Node operations
    handleNodeAdd,
    handleNodeDelete,
    handleNodeCopy,
    handleNodeClone,
    handleNodeStage,
    handleNodeSelect,
    handleNodesSelect,
    handleNodeDataUpdate,
    handleConnectionDrop,

    // Edge operations
    handleConnect,
    handleNodesChange,
    handleEdgesChange,
    handleAutoLayout,

    // Canvas preferences
    handleCanvasPreferencesChange,
  };
}
