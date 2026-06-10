'use client';

import type { Workflow } from '@agent-spaces/shared';
import {
  LOOP_BODY_ROLE,
  LOOP_BODY_NODE_TYPE,
  LOOP_BODY_SOURCE_HANDLE,
  LOOP_NEXT_SOURCE_HANDLE,
  findCompositeChildByRole,
  getCompositeParentId,
  getCompositeRootId,
  isHiddenWorkflowNode,
  isScopeBoundaryWorkflowNode,
} from '@agent-spaces/shared';

export {
  getCompositeParentId,
  getCompositeRootId,
  isScopeBoundaryWorkflowNode,
};
import { createWorkflowEdgeId } from '@/lib/workflow-edge-id';
import { getNodeDefinition } from '@/lib/workflow-nodes';
import { getWorkflowNodeSize } from './workflow-node-size';

// ---- Type guards & helpers ----

export function areStringArraysEqual(a: string[], b: string[]) {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

export function isNodePositionOrDimensionChange(
  change: import('@xyflow/react').NodeChange,
): change is import('@xyflow/react').NodeChange & { type: 'position' | 'dimensions'; id: string } {
  return change.type === 'position' || change.type === 'dimensions';
}

export function isNodeRemoveChange(
  change: import('@xyflow/react').NodeChange,
): change is import('@xyflow/react').NodeChange & { type: 'remove'; id: string } {
  return change.type === 'remove';
}

export function isSameHandle(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a ?? null) === (b ?? null);
}

function canUseEdgeForDeleteReconnect(edge: Workflow['edges'][0]): boolean {
  return !edge.composite?.hidden && !edge.composite?.locked;
}

export function reconnectEdgesAfterNodeDelete(
  edges: Workflow['edges'],
  deletedNodeIds: Set<string>,
): Workflow['edges'] {
  let nextEdges: Workflow['edges'] = edges.map(edge => ({
    ...edge,
    composite: edge.composite ? { ...edge.composite } : undefined,
  }));

  for (const deletedNodeId of deletedNodeIds) {
    const incomingEdges = nextEdges.filter(edge =>
      edge.target === deletedNodeId
      && edge.source !== deletedNodeId
      && canUseEdgeForDeleteReconnect(edge)
    );
    const outgoingEdges = nextEdges.filter(edge =>
      edge.source === deletedNodeId
      && edge.target !== deletedNodeId
      && canUseEdgeForDeleteReconnect(edge)
    );
    nextEdges = nextEdges.filter(edge => edge.source !== deletedNodeId && edge.target !== deletedNodeId);

    for (const incomingEdge of incomingEdges) {
      for (const outgoingEdge of outgoingEdges) {
        if (incomingEdge.source === outgoingEdge.target) continue;
        const nextEdge: Workflow['edges'][0] = {
          id: createWorkflowEdgeId({
            source: incomingEdge.source,
            target: outgoingEdge.target,
            sourceHandle: incomingEdge.sourceHandle,
            targetHandle: outgoingEdge.targetHandle,
          }),
          source: incomingEdge.source,
          target: outgoingEdge.target,
          sourceHandle: incomingEdge.sourceHandle,
          targetHandle: outgoingEdge.targetHandle,
        };
        if (!nextEdges.some(edge => edge.id === nextEdge.id)) nextEdges.push(nextEdge);
      }
    }
  }

  return nextEdges;
}

export function isGeneratedWorkflowNode(node: Workflow['nodes'][0]): boolean {
  return !!node.composite?.generated;
}

export function canDeleteWorkflowNode(nodes: Workflow['nodes'], nodeId: string): boolean {
  const node = nodes.find(item => item.id === nodeId);
  if (!node) return false;
  if (isScopeBoundaryWorkflowNode(node)) return false;
  const parentNode = node.composite?.parentId
    ? nodes.find(item => item.id === node.composite?.parentId)
    : null;
  if (parentNode && isScopeBoundaryWorkflowNode(parentNode)) {
    return node.type !== 'start' && node.type !== 'end';
  }
  return !isGeneratedWorkflowNode(node);
}

// ---- Composite / node ID helpers ----

export function collectCompositeDescendantIds(nodes: Workflow['nodes'], parentIds: Set<string>): Set<string> {
  const result = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of nodes) {
      const parentId = getCompositeParentId(node);
      if (!parentId || result.has(node.id)) continue;
      if (parentIds.has(parentId) || result.has(parentId)) {
        result.add(node.id);
        changed = true;
      }
    }
  }
  return result;
}

export function getWorkflowNodeDeleteIds(
  nodes: Workflow['nodes'],
  nodeId: string,
): { ids: Set<string>; rootId: string | null } | null {
  const removedNode = nodes.find(node => node.id === nodeId);
  if (!removedNode || !canDeleteWorkflowNode(nodes, nodeId)) return null;

  const parentId = getCompositeParentId(removedNode);
  const parentNode = parentId ? nodes.find(node => node.id === parentId) : null;
  const ids = new Set<string>();
  let rootId: string | null = null;

  if (parentNode && isScopeBoundaryWorkflowNode(parentNode)) {
    ids.add(nodeId);
    return { ids, rootId };
  }

  rootId = getCompositeRootId(removedNode);
  for (const node of nodes) {
    if (getCompositeRootId(node) === rootId) ids.add(node.id);
  }
  for (const descendantId of collectCompositeDescendantIds(nodes, ids)) {
    ids.add(descendantId);
  }

  return { ids, rootId };
}

export function createWorkflowNodeId(): string {
  return `node_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ---- Node data helpers ----

export function createNodeData(type: string): Record<string, unknown> {
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

export function cloneNodeData(data: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(data)) as Record<string, unknown>;
}

export function cloneData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function cloneWorkflowNodes(nodes: Workflow['nodes']): Workflow['nodes'] {
  return nodes.map(node => ({
    ...node,
    position: { ...node.position },
    data: { ...node.data },
    composite: node.composite ? { ...node.composite } : undefined,
  }));
}

export function getLayoutNodeSize(node: Workflow['nodes'][0]): { width: number; height: number } {
  return {
    width: typeof node.data?.width === 'number' ? node.data.width : DEFAULT_SCOPE_CHILD_SIZE.width,
    height: typeof node.data?.height === 'number' ? node.data.height : DEFAULT_SCOPE_CHILD_SIZE.height,
  };
}

export function sanitizeFieldKey(value: string): string {
  const key = value.trim().replace(/[^\w]+/g, '_').replace(/^_+|_+$/g, '');
  return key || 'input';
}

// ---- Layout constants ----

export const SCOPE_CONTAINER_PADDING = {
  top: 100,
  right: 56,
  bottom: 44,
  left: 56,
};

export const MIN_SCOPE_CONTAINER_SIZE = {
  width: 520,
  height: 260,
};

export const LOOP_BODY_MIN_SCOPE_CONTAINER_SIZE = {
  width: 150,
  height: 260,
};

const DEFAULT_SCOPE_CHILD_SIZE = {
  width: 220,
  height: 120,
};

// ---- Scope boundary layout ----

export function syncScopeBoundaryLayout(nodes: Workflow['nodes'], scopeNodeId: string): boolean {
  const scopeNode = nodes.find(node => node.id === scopeNodeId);
  if (!scopeNode || !isScopeBoundaryWorkflowNode(scopeNode)) return false;

  const children = nodes.filter(node => getCompositeParentId(node) === scopeNodeId && !isHiddenWorkflowNode(node));
  if (!children.length) return false;

  const minX = Math.min(...children.map(node => node.position.x));
  const minY = Math.min(...children.map(node => node.position.y));
  const maxX = Math.max(...children.map(node => {
    const size = getLayoutNodeSize(node);
    return node.position.x + size.width;
  }));
  const maxY = Math.max(...children.map(node => {
    const size = getLayoutNodeSize(node);
    return node.position.y + size.height;
  }));

  const minSize = scopeNode.type === LOOP_BODY_NODE_TYPE
    ? LOOP_BODY_MIN_SCOPE_CONTAINER_SIZE
    : MIN_SCOPE_CONTAINER_SIZE;
  const nextPosition = {
    x: minX - SCOPE_CONTAINER_PADDING.left,
    y: minY - SCOPE_CONTAINER_PADDING.top,
  };
  const nextWidth = Math.max(
    minSize.width,
    maxX - minX + SCOPE_CONTAINER_PADDING.left + SCOPE_CONTAINER_PADDING.right,
  );
  const nextHeight = Math.max(
    minSize.height,
    maxY - minY + SCOPE_CONTAINER_PADDING.top + SCOPE_CONTAINER_PADDING.bottom,
  );

  const positionChanged = scopeNode.position.x !== nextPosition.x || scopeNode.position.y !== nextPosition.y;
  const sizeChanged = scopeNode.data.width !== nextWidth || scopeNode.data.height !== nextHeight;
  if (!positionChanged && !sizeChanged) return false;

  if (positionChanged) {
    scopeNode.position = nextPosition;
  }
  if (sizeChanged) {
    scopeNode.data = {
      ...scopeNode.data,
      width: nextWidth,
      height: nextHeight,
    };
  }
  return true;
}

export function syncAllScopeBoundaryLayouts(nodes: Workflow['nodes']): boolean {
  let changed = false;
  const scopeNodeIds = nodes
    .filter(node => isScopeBoundaryWorkflowNode(node))
    .map(node => node.id);

  for (let i = scopeNodeIds.length - 1; i >= 0; i -= 1) {
    changed = syncScopeBoundaryLayout(nodes, scopeNodeIds[i]) || changed;
  }
  return changed;
}

export function shiftScopeChildren(
  nodes: Workflow['nodes'],
  scopeNodeId: string,
  dx: number,
  dy: number,
  skippedNodeIds: Set<string>,
): void {
  if (dx === 0 && dy === 0) return;

  for (const child of nodes.filter(node => getCompositeParentId(node) === scopeNodeId)) {
    if (!skippedNodeIds.has(child.id)) {
      child.position = {
        x: child.position.x + dx,
        y: child.position.y + dy,
      };
      skippedNodeIds.add(child.id);
    }
    if (isScopeBoundaryWorkflowNode(child)) {
      shiftScopeChildren(nodes, child.id, dx, dy, skippedNodeIds);
    }
  }
}

// ---- Loop body boundary nodes ----

export function createLoopBoundaryLabel(loopNode: Workflow['nodes'][0], type: 'start' | 'end'): string {
  return `${loopNode.label || '循环'}${type === 'start' ? '开始' : '结束'}`;
}

export function createLoopBodyBoundaryNodes(
  loopNode: Workflow['nodes'][0],
  bodyNode: Workflow['nodes'][0],
): { nodes: Workflow['nodes']; edges: Workflow['edges'] } {
  const startNode: Workflow['nodes'][0] = {
    id: createWorkflowNodeId(),
    type: 'start',
    label: createLoopBoundaryLabel(loopNode, 'start'),
    position: { x: bodyNode.position.x + 80, y: bodyNode.position.y + 140 },
    data: {},
    composite: {
      rootId: bodyNode.id,
      parentId: bodyNode.id,
      generated: true,
      hidden: false,
    },
  };
  const endNode: Workflow['nodes'][0] = {
    id: createWorkflowNodeId(),
    type: 'end',
    label: createLoopBoundaryLabel(loopNode, 'end'),
    position: { x: bodyNode.position.x + 420, y: bodyNode.position.y + 140 },
    data: {},
    composite: {
      rootId: bodyNode.id,
      parentId: bodyNode.id,
      generated: true,
      hidden: false,
    },
  };

  return {
    nodes: [startNode, endNode],
    edges: [
      {
        id: createWorkflowEdgeId({
          source: bodyNode.id,
          target: startNode.id,
          sourceHandle: null,
          targetHandle: 'target',
        }),
        source: bodyNode.id,
        target: startNode.id,
        sourceHandle: null,
        targetHandle: 'target',
        composite: {
          rootId: bodyNode.id,
          parentId: bodyNode.id,
          generated: true,
          hidden: true,
          locked: true,
        },
      },
      {
        id: createWorkflowEdgeId({
          source: startNode.id,
          target: endNode.id,
          sourceHandle: null,
          targetHandle: 'target',
        }),
        source: startNode.id,
        target: endNode.id,
        sourceHandle: null,
        targetHandle: 'target',
      },
    ],
  };
}

export function ensureLoopBodyBoundaryNodes(nodes: Workflow['nodes'], edges: Workflow['edges']): boolean {
  let changed = false;

  for (const bodyNode of nodes) {
    if (bodyNode.type !== LOOP_BODY_NODE_TYPE || bodyNode.composite?.role !== LOOP_BODY_ROLE) continue;

    const children = nodes.filter(node => getCompositeParentId(node) === bodyNode.id);
    for (const child of children) {
      const isBoundaryChild = child.type === 'start' || child.type === 'end';
      if (
        child.composite?.rootId === bodyNode.id
        && child.composite?.parentId === bodyNode.id
        && (!isBoundaryChild || (child.composite.generated === true && child.composite.hidden === false))
      ) {
        continue;
      }
      child.composite = {
        ...(child.composite || {}),
        rootId: bodyNode.id,
        parentId: bodyNode.id,
        ...(isBoundaryChild ? { generated: true, hidden: false } : {}),
      };
      changed = true;
    }

    const loopNode = nodes.find(node => node.id === bodyNode.composite?.rootId) || bodyNode;
    let startNode = children.find(node => node.type === 'start');
    let endNode = children.find(node => node.type === 'end');
    const hadStartNode = !!startNode;
    const hadEndNode = !!endNode;

    if (!startNode) {
      startNode = {
        id: createWorkflowNodeId(),
        type: 'start',
        label: createLoopBoundaryLabel(loopNode, 'start'),
        position: { x: bodyNode.position.x + 80, y: bodyNode.position.y + 140 },
        data: {},
        composite: {
          rootId: bodyNode.id,
          parentId: bodyNode.id,
          generated: true,
          hidden: false,
        },
      };
      nodes.push(startNode);
      changed = true;
    }

    if (!endNode) {
      endNode = {
        id: createWorkflowNodeId(),
        type: 'end',
        label: createLoopBoundaryLabel(loopNode, 'end'),
        position: { x: bodyNode.position.x + 420, y: bodyNode.position.y + 140 },
        data: {},
        composite: {
          rootId: bodyNode.id,
          parentId: bodyNode.id,
          generated: true,
          hidden: false,
        },
      };
      nodes.push(endNode);
      changed = true;
    }

    const entryEdgeId = createWorkflowEdgeId({
      source: bodyNode.id,
      target: startNode.id,
      sourceHandle: null,
      targetHandle: 'target',
    });
    const entryEdge = edges.find(edge => edge.id === entryEdgeId);
    const entryComposite = {
      rootId: bodyNode.id,
      parentId: bodyNode.id,
      generated: true,
      hidden: true,
      locked: true,
    };
    if (entryEdge) {
      if (
        entryEdge.sourceHandle !== null
        || entryEdge.targetHandle !== 'target'
        || entryEdge.composite?.rootId !== entryComposite.rootId
        || entryEdge.composite?.parentId !== entryComposite.parentId
        || entryEdge.composite?.generated !== true
        || entryEdge.composite?.hidden !== true
        || entryEdge.composite?.locked !== true
      ) {
        entryEdge.sourceHandle = null;
        entryEdge.targetHandle = 'target';
        entryEdge.composite = entryComposite;
        changed = true;
      }
    } else {
      edges.push({
        id: entryEdgeId,
        source: bodyNode.id,
        target: startNode.id,
        sourceHandle: null,
        targetHandle: 'target',
        composite: entryComposite,
      });
      changed = true;
    }

    if (!hadStartNode || !hadEndNode) {
      const startToEndId = createWorkflowEdgeId({
        source: startNode.id,
        target: endNode.id,
        sourceHandle: null,
        targetHandle: 'target',
      });
      if (!edges.some(edge => edge.id === startToEndId)) {
        edges.push({
          id: startToEndId,
          source: startNode.id,
          target: endNode.id,
          sourceHandle: null,
          targetHandle: 'target',
        });
        changed = true;
      }
    }
  }

  return changed;
}

// ---- Node creation ----

export function createNodesForDefinition(
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
  const bodyNode = Array.from(roleMap.values()).find(node => node.type === LOOP_BODY_NODE_TYPE);
  if (bodyNode) {
    const boundaries = createLoopBodyBoundaryNodes(rootNode, bodyNode);
    nodes.push(...boundaries.nodes);
    edges.push(...boundaries.edges);
    syncScopeBoundaryLayout(nodes, bodyNode.id);
  }
  return { rootNode, nodes, edges };
}

export function getOutgoingSourceHandle(type: string): string | undefined {
  const def = getNodeDefinition(type);
  if (def?.compound && def.handles?.sourceHandles?.some(handle => handle.id === LOOP_NEXT_SOURCE_HANDLE)) {
    return LOOP_NEXT_SOURCE_HANDLE;
  }
  return undefined;
}

export function getInsertScopeNode(
  nodes: Workflow['nodes'],
  sourceNodeId?: string | null,
  sourceHandle?: string | null,
): Workflow['nodes'][0] | null {
  if (!sourceNodeId) return null;
  const sourceNode = nodes.find(node => node.id === sourceNodeId);
  if (sourceNode?.type === LOOP_BODY_NODE_TYPE) return sourceNode;
  if (sourceHandle === LOOP_BODY_SOURCE_HANDLE) {
    return findCompositeChildByRole(nodes, sourceNodeId, LOOP_BODY_ROLE) ?? null;
  }

  let current = sourceNode;
  while (current) {
    const parentId = getCompositeParentId(current);
    if (!parentId) return null;
    const parent = nodes.find(node => node.id === parentId);
    if (!parent) return null;
    if (isScopeBoundaryWorkflowNode(parent)) return parent;
    current = parent;
  }
  return null;
}
