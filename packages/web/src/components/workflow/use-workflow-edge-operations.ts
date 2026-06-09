'use client';

import { useCallback, useRef } from 'react';
import Dagre from '@dagrejs/dagre';
import ELK from 'elkjs/lib/elk.bundled';
import { applyNodeChanges, applyEdgeChanges } from '@xyflow/react';
import type { NodeChange, EdgeChange, Connection } from '@xyflow/react';
import type { ElkNode } from 'elkjs/lib/elk-api';
import type { Workflow } from '@agent-spaces/shared';
import { isHiddenWorkflowEdge, isHiddenWorkflowNode, getCompositeParentId } from '@agent-spaces/shared';
import { createWorkflowEdgeId } from '@/lib/workflow-edge-id';
import { getNodeDefinition } from '@/lib/workflow-nodes';
import { getWorkflowNodeSize } from './workflow-node-size';
import {
  isNodeRemoveChange,
  isNodePositionOrDimensionChange,
  isScopeBoundaryWorkflowNode,
  cloneWorkflowNodes,
  getWorkflowNodeDeleteIds,
  syncScopeBoundaryLayout,
  syncAllScopeBoundaryLayouts,
  shiftScopeChildren,
  ensureLoopBodyBoundaryNodes,
} from './workflow-canvas-utils';
import { cleanupGroupsOnNodeDelete } from './workflow-canvas-groups';

interface UseEdgeOperationsParams {
  workflow: Workflow | null;
  isReadOnly: boolean;
  setWorkflow: React.Dispatch<React.SetStateAction<Workflow | null>>;
  markDirty: () => void;
  pushUndo: (description?: string) => void;
}

export function useEdgeOperations({
  workflow, isReadOnly, setWorkflow, markDirty, pushUndo,
}: UseEdgeOperationsParams) {
  const rejectedNodeDeleteIdsRef = useRef<Set<string>>(new Set());

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
    const rejectedDeleteIds = new Set(
      changes
        .filter(isNodeRemoveChange)
        .filter(change => !getWorkflowNodeDeleteIds(workflow.nodes, change.id))
        .map(change => change.id),
    );
    rejectedNodeDeleteIdsRef.current = rejectedDeleteIds;
    const hasAllowedDelete = changes
      .filter(isNodeRemoveChange)
      .some(change => !!getWorkflowNodeDeleteIds(workflow.nodes, change.id));
    const hasDimensionChange = changes.some(c => c.type === 'dimensions');
    const hasPositionChange = changes.some(c => c.type === 'position' && !!c.position);
    if (!hasDelete && !hasDimensionChange && !hasPositionChange) return;

    const rfNodes = workflow.nodes
      .filter(n => !isHiddenWorkflowNode(n))
      .map(n => {
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
    const updatedById = new Map(updated.map(node => [node.id, node]));
    const dimensionNodeIds = new Set(
      changes
        .filter((change): change is NodeChange & { type: 'dimensions'; id: string } => change.type === 'dimensions')
        .map(change => change.id),
    );
    const changedNodeIds = new Set(
      changes
        .filter(isNodePositionOrDimensionChange)
        .map(change => change.id),
    );
    const canAttemptFastPositionUpdate = hasPositionChange && !hasDelete && !hasDimensionChange;

    setWorkflow(w => {
      if (!w) return null;

      if (canAttemptFastPositionUpdate) {
        const canFastUpdate = w.nodes.every((node) => {
          if (!changedNodeIds.has(node.id)) return true;
          return !isScopeBoundaryWorkflowNode(node) && !getCompositeParentId(node);
        });
        if (canFastUpdate) {
          let changed = false;
          const nextNodes = w.nodes.map((node) => {
            if (!changedNodeIds.has(node.id)) return node;
            const updatedNode = updatedById.get(node.id);
            const nextPosition = updatedNode?.position;
            if (!nextPosition) return node;
            if (node.position.x === nextPosition.x && node.position.y === nextPosition.y) return node;
            changed = true;
            return {
              ...node,
              position: { x: nextPosition.x, y: nextPosition.y },
            };
          });
          return changed ? { ...w, nodes: nextNodes } : w;
        }
      }

      const nextNodes = cloneWorkflowNodes(w.nodes);
      const nextEdges = w.edges.map(edge => ({
        ...edge,
        composite: edge.composite ? { ...edge.composite } : undefined,
      }));
      const removedNodeIds = new Set(
        changes
          .filter(isNodeRemoveChange)
          .flatMap(change => {
            const deletePlan = getWorkflowNodeDeleteIds(w.nodes, change.id);
            return deletePlan ? Array.from(deletePlan.ids) : [];
          }),
      );
      const removedRootIds = new Set(
        changes
          .filter(isNodeRemoveChange)
          .flatMap(change => {
            const deletePlan = getWorkflowNodeDeleteIds(w.nodes, change.id);
            return deletePlan?.rootId ? [deletePlan.rootId] : [];
          }),
      );
      const touchedScopeNodeIds = new Set<string>();
      const movedNodeIds = new Set(changedNodeIds);

      if (removedNodeIds.size > 0) {
        for (const node of nextNodes) {
          if (!removedNodeIds.has(node.id)) continue;
          const parentId = getCompositeParentId(node);
          if (parentId) touchedScopeNodeIds.add(parentId);
        }
      }

      for (const node of nextNodes) {
        if (removedNodeIds.has(node.id)) continue;
        if (!changedNodeIds.has(node.id)) continue;
        const updatedNode = updatedById.get(node.id);
        if (!updatedNode) continue;

        const nextPosition = updatedNode.position;
        const dx = nextPosition.x - node.position.x;
        const dy = nextPosition.y - node.position.y;

        node.position = nextPosition;
        if (dimensionNodeIds.has(node.id)) {
          const width = typeof updatedNode.width === 'number' ? Math.round(updatedNode.width) : node.data.width;
          const height = typeof updatedNode.height === 'number' ? Math.round(updatedNode.height) : node.data.height;
          node.data = { ...node.data, width, height };
        }

        if ((dx !== 0 || dy !== 0) && isScopeBoundaryWorkflowNode(node)) {
          movedNodeIds.add(node.id);
          shiftScopeChildren(nextNodes, node.id, dx, dy, movedNodeIds);
        }

        const parentId = getCompositeParentId(node);
        if (parentId) touchedScopeNodeIds.add(parentId);
      }

      const remainingNodes = nextNodes.filter(node => !removedNodeIds.has(node.id));
      for (const scopeNodeId of touchedScopeNodeIds) {
        syncScopeBoundaryLayout(remainingNodes, scopeNodeId);
      }
      if (ensureLoopBodyBoundaryNodes(remainingNodes, nextEdges)) {
        syncAllScopeBoundaryLayouts(remainingNodes);
      }

      return {
        ...w,
        nodes: remainingNodes,
        edges: nextEdges.filter(edge =>
          !removedNodeIds.has(edge.source)
          && !removedNodeIds.has(edge.target)
          && (!edge.composite?.rootId || !removedRootIds.has(edge.composite.rootId))
        ),
        groups: cleanupGroupsOnNodeDelete(w.groups, removedNodeIds),
      };
    });
    if (hasAllowedDelete || hasDimensionChange || hasPositionChange) markDirty();
  }, [workflow, isReadOnly, markDirty]);

  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    if (!workflow || isReadOnly) return;
    const rejectedNodeDeleteIds = rejectedNodeDeleteIdsRef.current;
    rejectedNodeDeleteIdsRef.current = new Set();
    const allowedChanges = changes.filter(change => {
      if (change.type !== 'remove') return true;
      const edge = workflow.edges.find(item => item.id === change.id);
      if (edge && (rejectedNodeDeleteIds.has(edge.source) || rejectedNodeDeleteIds.has(edge.target))) return false;
      return !!edge && !edge.composite?.locked;
    });
    if (allowedChanges.length === 0) return;

    const hasDelete = allowedChanges.some(c => c.type === 'remove');
    if (hasDelete) pushUndo('delete edge');

    const rfEdges = workflow.edges.map(e => ({
      id: e.id, source: e.source, target: e.target, type: 'custom' as const,
      sourceHandle: e.sourceHandle || undefined, targetHandle: e.targetHandle || undefined,
      data: { composite: e.composite, sourceHandle: e.sourceHandle },
    }));
    const updated = applyEdgeChanges(allowedChanges, rfEdges);
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
      const touchedScopeNodeIds = new Set<string>();

      for (const node of layoutNodes) {
        const nextNode = nodeById.get(node.id);
        const nextPosition = layoutPositions.get(node.id);
        if (!nextNode || !nextPosition) continue;

        if (isScopeBoundaryWorkflowNode(nextNode)) {
          const dx = nextPosition.x - nextNode.position.x;
          const dy = nextPosition.y - nextNode.position.y;
          shiftScopeChildren(nextNodes, nextNode.id, dx, dy, new Set([nextNode.id]));
          touchedScopeNodeIds.add(nextNode.id);
        }

        nextNode.position = nextPosition;
      }
      for (const scopeNodeId of touchedScopeNodeIds) {
        syncScopeBoundaryLayout(nextNodes, scopeNodeId);
      }

      return { ...current, nodes: nextNodes };
    });
    markDirty();
  }, [workflow, isReadOnly, pushUndo, setWorkflow, markDirty]);

  return {
    handleConnect,
    handleNodesChange,
    handleEdgesChange,
    handleAutoLayout,
    handleCanvasPreferencesChange,
  };
}
