'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Dagre from '@dagrejs/dagre';
import ELK from 'elkjs/lib/elk.bundled';
import { applyNodeChanges, applyEdgeChanges } from '@xyflow/react';
import type { NodeChange, EdgeChange, Connection } from '@xyflow/react';
import type { ElkNode } from 'elkjs/lib/elk-api';
import type { OutputField, Workflow } from '@agent-spaces/shared';
import {
  LOOP_BODY_ROLE,
  LOOP_BODY_NODE_TYPE,
  LOOP_BODY_SOURCE_HANDLE,
  LOOP_NODE_TYPE,
  LOOP_NEXT_SOURCE_HANDLE,
  findCompositeChildByRole,
  getCompositeParentId,
  getCompositeRootId,
  isHiddenWorkflowEdge,
  isHiddenWorkflowNode,
  isScopeBoundaryWorkflowNode,
} from '@agent-spaces/shared';
import { createWorkflowEdgeId } from '@/lib/workflow-edge-id';
import { workflowApi } from '@/lib/workflow-api';
import { getNodeDefinition } from '@/lib/workflow-nodes';
import { useWorkflowStore } from '@/stores/workflow';
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

function isNodePositionOrDimensionChange(
  change: NodeChange,
): change is NodeChange & { type: 'position' | 'dimensions'; id: string } {
  return change.type === 'position' || change.type === 'dimensions';
}

function isNodeRemoveChange(change: NodeChange): change is NodeChange & { type: 'remove'; id: string } {
  return change.type === 'remove';
}

function isSameHandle(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a ?? null) === (b ?? null);
}

function isGeneratedWorkflowNode(node: Workflow['nodes'][0]): boolean {
  return !!node.composite?.generated;
}

function canDeleteWorkflowNode(nodes: Workflow['nodes'], nodeId: string): boolean {
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

function collectCompositeDescendantIds(nodes: Workflow['nodes'], parentIds: Set<string>): Set<string> {
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

function getWorkflowNodeDeleteIds(nodes: Workflow['nodes'], nodeId: string): { ids: Set<string>; rootId: string | null } | null {
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

const SCOPE_CONTAINER_PADDING = {
  top: 100,
  right: 56,
  bottom: 44,
  left: 56,
};

const MIN_SCOPE_CONTAINER_SIZE = {
  width: 520,
  height: 260,
};

const LOOP_BODY_MIN_SCOPE_CONTAINER_SIZE = {
  width: 150,
  height: 260,
};

const DEFAULT_SCOPE_CHILD_SIZE = {
  width: 220,
  height: 120,
};

function cloneNodeData(data: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(data)) as Record<string, unknown>;
}

function cloneData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function cloneWorkflowNodes(nodes: Workflow['nodes']): Workflow['nodes'] {
  return nodes.map(node => ({
    ...node,
    position: { ...node.position },
    data: { ...node.data },
    composite: node.composite ? { ...node.composite } : undefined,
  }));
}

function getLayoutNodeSize(node: Workflow['nodes'][0]): { width: number; height: number } {
  return {
    width: typeof node.data?.width === 'number' ? node.data.width : DEFAULT_SCOPE_CHILD_SIZE.width,
    height: typeof node.data?.height === 'number' ? node.data.height : DEFAULT_SCOPE_CHILD_SIZE.height,
  };
}

function makeInputReference(nodeId: string, fieldPath: string): string {
  return `{{ __inputs__["${nodeId}"].${fieldPath} }}`;
}

function makeDataReference(nodeId: string, fieldPath: string): string {
  return `{{ __data__["${nodeId}"].${fieldPath} }}`;
}

function sanitizeFieldKey(value: string): string {
  const key = value.trim().replace(/[^\w]+/g, '_').replace(/^_+|_+$/g, '');
  return key || 'input';
}

function normalizeInputKey(baseKey: string, usedKeys: Set<string>): string {
  const sanitized = sanitizeFieldKey(baseKey);
  let key = sanitized;
  let index = 2;
  while (usedKeys.has(key)) {
    key = `${sanitized}_${index}`;
    index += 1;
  }
  usedKeys.add(key);
  return key;
}

function getReferenceFieldKey(node: Workflow['nodes'][0] | undefined, fieldPath: string): string {
  const prefix = node?.label || node?.type || 'input';
  const leaf = fieldPath.split('.').filter(Boolean).at(-1) || 'value';
  return `${prefix}_${leaf}`;
}

function collectExternalReferences(
  value: unknown,
  selectedIds: Set<string>,
): Array<{ raw: string; source: '__data__' | '__inputs__'; nodeId: string; fieldPath: string }> {
  const refs: Array<{ raw: string; source: '__data__' | '__inputs__'; nodeId: string; fieldPath: string }> = [];
  const pattern = /\{\{\s*(__data__|__inputs__)\[(["'])([^"']+)\2\]\.([^}]+?)\s*\}\}/g;

  const visit = (item: unknown) => {
    if (typeof item === 'string') {
      for (const match of item.matchAll(pattern)) {
        const nodeId = match[3];
        if (!selectedIds.has(nodeId)) {
          refs.push({
            raw: match[0],
            source: match[1] as '__data__' | '__inputs__',
            nodeId,
            fieldPath: match[4].trim(),
          });
        }
      }
      return;
    }
    if (Array.isArray(item)) {
      for (const child of item) visit(child);
      return;
    }
    if (item && typeof item === 'object') {
      for (const child of Object.values(item)) visit(child);
    }
  };

  visit(value);
  return refs;
}

function replaceReferences(value: unknown, replacements: Map<string, string>): unknown {
  if (typeof value === 'string') {
    let next = value;
    for (const [raw, replacement] of replacements) {
      next = next.split(raw).join(replacement);
    }
    return next;
  }
  if (Array.isArray(value)) return value.map(item => replaceReferences(item, replacements));
  if (value && typeof value === 'object') {
    const next: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      next[key] = replaceReferences(child, replacements);
    }
    return next;
  }
  return value;
}

function replaceReferenceNodeIds(value: unknown, replacements: Map<string, string>): unknown {
  if (typeof value === 'string') {
    return value.replace(
      /(__data__|__inputs__)\[(["'])([^"']+)\2\]/g,
      (raw, source: string, quote: string, nodeId: string) => {
        const replacement = replacements.get(nodeId);
        return replacement ? `${source}[${quote}${replacement}${quote}]` : raw;
      },
    );
  }
  if (Array.isArray(value)) return value.map(item => replaceReferenceNodeIds(item, replacements));
  if (value && typeof value === 'object') {
    const next: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      next[key] = replaceReferenceNodeIds(child, replacements);
    }
    return next;
  }
  return value;
}

function clearStartInputFieldValues(workflow: { nodes?: Workflow['nodes'] }): void {
  if (!Array.isArray(workflow.nodes)) return;
  for (const node of workflow.nodes) {
    if (node.type === 'start' && Array.isArray(node.data?.inputFields)) {
      node.data.inputFields = node.data.inputFields.map((field) => {
        const next = { ...(field as Record<string, unknown>) };
        delete next.value;
        return next;
      });
    }
    const bodyWorkflow = node.data?.bodyWorkflow;
    if (bodyWorkflow && typeof bodyWorkflow === 'object') {
      clearStartInputFieldValues(bodyWorkflow as { nodes?: Workflow['nodes'] });
    }
  }
}

function remapSelectedWorkflowNodes(
  nodes: Workflow['nodes'],
  edges: Workflow['edges'],
  selectedIds: Set<string>,
  selectedRootIds: Set<string>,
  startNodeId: string,
  endNodeId: string,
): { nodes: Workflow['nodes']; edges: Workflow['edges'] } {
  const boundaryIdMap = new Map<string, string>();
  for (const node of nodes) {
    if (!selectedRootIds.has(node.id)) continue;
    if (node.type === 'start') boundaryIdMap.set(node.id, startNodeId);
    if (node.type === 'end') boundaryIdMap.set(node.id, endNodeId);
  }
  const remapNodeId = (nodeId: string): string => boundaryIdMap.get(nodeId) ?? nodeId;
  const selectedNodes = nodes
    .filter(node => selectedIds.has(node.id) && !boundaryIdMap.has(node.id))
    .map(node => cloneData(node));
  const selectedEdges = edges
    .filter(edge => selectedIds.has(edge.source) && selectedIds.has(edge.target))
    .map((edge) => {
      const next = cloneData(edge);
      next.source = remapNodeId(next.source);
      next.target = remapNodeId(next.target);
      next.id = createWorkflowEdgeId(next);
      return next;
    })
    .filter((edge, index, items) => (
      edge.source !== edge.target
      && items.findIndex(item => item.id === edge.id) === index
    ));
  const selectedRootNodes = nodes.filter(node => selectedRootIds.has(node.id)).map(node => cloneData(node));
  const rootEdges = edges.filter(edge => selectedRootIds.has(edge.source) && selectedRootIds.has(edge.target));
  const firstNode = [...selectedRootNodes]
    .filter(node => !rootEdges.some(edge => edge.target === node.id))
    .sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y)[0]
    ?? [...selectedRootNodes].sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y)[0];
  const lastNode = [...selectedRootNodes]
    .filter(node => !rootEdges.some(edge => edge.source === node.id))
    .sort((a, b) => b.position.x - a.position.x || b.position.y - a.position.y)[0]
    ?? [...selectedRootNodes].sort((a, b) => b.position.x - a.position.x || b.position.y - a.position.y)[0];
  const firstTargetHandle = firstNode
    ? rootEdges.find(edge => edge.target === firstNode.id)?.targetHandle ?? null
    : null;
  const firstNodeId = firstNode ? remapNodeId(firstNode.id) : null;
  const entryEdges: Workflow['edges'] = firstNodeId && firstNodeId !== startNodeId ? [{
    id: createWorkflowEdgeId({
      source: startNodeId,
      target: firstNodeId,
      sourceHandle: null,
      targetHandle: firstTargetHandle,
    }),
    source: startNodeId,
    target: firstNodeId,
    sourceHandle: null,
    targetHandle: firstTargetHandle,
  }] : [];
  const lastNodeId = lastNode ? remapNodeId(lastNode.id) : null;
  const exitSourceHandle = lastNode?.type === LOOP_NODE_TYPE ? LOOP_NEXT_SOURCE_HANDLE : null;
  const exitEdges: Workflow['edges'] = lastNodeId && lastNodeId !== endNodeId ? [{
    id: createWorkflowEdgeId({
      source: lastNodeId,
      target: endNodeId,
      sourceHandle: exitSourceHandle,
      targetHandle: null,
    }),
    source: lastNodeId,
    target: endNodeId,
    sourceHandle: exitSourceHandle,
    targetHandle: null,
  }] : [];

  return {
    nodes: selectedNodes,
    edges: [...selectedEdges, ...entryEdges, ...exitEdges],
  };
}

function cleanupGroupsOnNodeDelete(
  groups: Workflow['groups'] | undefined,
  deletedNodeIds: Set<string>,
): Workflow['groups'] {
  return (groups || [])
    .map(group => ({
      ...group,
      childNodeIds: group.childNodeIds.filter(id => !deletedNodeIds.has(id)),
      childGroupIds: [...group.childGroupIds],
      savedNodeStates: Object.fromEntries(
        Object.entries(group.savedNodeStates || {}).filter(([nodeId]) => !deletedNodeIds.has(nodeId)),
      ),
    }));
}

function computeGroupBounds(nodes: Workflow['nodes'], childNodeIds: string[]): Pick<NonNullable<Workflow['groups']>[0], 'x' | 'y' | 'width' | 'height'> | null {
  const childNodes = childNodeIds
    .map(id => nodes.find(node => node.id === id))
    .filter((node): node is Workflow['nodes'][0] => !!node);
  if (childNodes.length === 0) return null;
  const minX = Math.min(...childNodes.map(node => node.position.x));
  const minY = Math.min(...childNodes.map(node => node.position.y));
  const maxX = Math.max(...childNodes.map((node) => {
    const size = getLayoutNodeSize(node);
    return node.position.x + size.width;
  }));
  const maxY = Math.max(...childNodes.map((node) => {
    const size = getLayoutNodeSize(node);
    return node.position.y + size.height;
  }));
  return {
    x: minX - 24,
    y: minY - 48,
    width: Math.max(240, maxX - minX + 48),
    height: Math.max(160, maxY - minY + 72),
  };
}

function collectWorkflowGroupNodeIds(groups: NonNullable<Workflow['groups']>, groupId: string, visited = new Set<string>()): Set<string> {
  const result = new Set<string>();
  if (visited.has(groupId)) return result;
  visited.add(groupId);
  const group = groups.find(item => item.id === groupId);
  if (!group) return result;

  for (const nodeId of group.childNodeIds) result.add(nodeId);
  for (const childGroupId of group.childGroupIds) {
    for (const nodeId of collectWorkflowGroupNodeIds(groups, childGroupId, visited)) {
      result.add(nodeId);
    }
  }
  return result;
}

function collectWorkflowGroupIds(groups: NonNullable<Workflow['groups']>, groupId: string, visited = new Set<string>()): Set<string> {
  const result = new Set<string>();
  if (visited.has(groupId)) return result;
  visited.add(groupId);
  const group = groups.find(item => item.id === groupId);
  if (!group) return result;
  result.add(groupId);
  for (const childGroupId of group.childGroupIds) {
    for (const id of collectWorkflowGroupIds(groups, childGroupId, visited)) {
      result.add(id);
    }
  }
  return result;
}

function syncScopeBoundaryLayout(nodes: Workflow['nodes'], scopeNodeId: string): boolean {
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

function syncAllScopeBoundaryLayouts(nodes: Workflow['nodes']): boolean {
  let changed = false;
  const scopeNodeIds = nodes
    .filter(node => isScopeBoundaryWorkflowNode(node))
    .map(node => node.id);

  for (let i = scopeNodeIds.length - 1; i >= 0; i -= 1) {
    changed = syncScopeBoundaryLayout(nodes, scopeNodeIds[i]) || changed;
  }
  return changed;
}

function shiftScopeChildren(
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

function createLoopBoundaryLabel(loopNode: Workflow['nodes'][0], type: 'start' | 'end'): string {
  return `${loopNode.label || '循环'}${type === 'start' ? '开始' : '结束'}`;
}

function createLoopBodyBoundaryNodes(
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

function ensureLoopBodyBoundaryNodes(nodes: Workflow['nodes'], edges: Workflow['edges']): boolean {
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
  const bodyNode = Array.from(roleMap.values()).find(node => node.type === LOOP_BODY_NODE_TYPE);
  if (bodyNode) {
    const boundaries = createLoopBodyBoundaryNodes(rootNode, bodyNode);
    nodes.push(...boundaries.nodes);
    edges.push(...boundaries.edges);
    syncScopeBoundaryLayout(nodes, bodyNode.id);
  }
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

export function useWorkflowEditorCanvas({
  workflow, isReadOnly = false, setWorkflow, markDirty, pushUndo,
  selectedNodeId, setSelectedNodeId, selectedNodeIds, setSelectedNodeIds,
  onCopyNodes, onStageNode,
}: UseWorkflowEditorCanvasParams) {
  const upsertWorkflow = useWorkflowStore(store => store.upsertWorkflow);
  const [nodeSelectOpen, setNodeSelectOpen] = useState(false);
  const [nodeSelectContext, setNodeSelectContext] = useState<NodeSelectContext | null>(null);
  const rejectedNodeDeleteIdsRef = useRef<Set<string>>(new Set());
  const workflowId = workflow?.id;

  useEffect(() => {
    if (!workflowId) return;
    setWorkflow(current => {
      if (!current) return null;
      const nextNodes = cloneWorkflowNodes(current.nodes);
      const nextEdges = current.edges.map(edge => ({
        ...edge,
        composite: edge.composite ? { ...edge.composite } : undefined,
      }));
      const boundaryChanged = ensureLoopBodyBoundaryNodes(nextNodes, nextEdges);
      const layoutChanged = syncAllScopeBoundaryLayouts(nextNodes);
      return boundaryChanged || layoutChanged ? { ...current, nodes: nextNodes, edges: nextEdges } : current;
    });
  }, [workflowId, setWorkflow]);

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
      setWorkflow(current => {
        if (!current) return null;
        const nextNodes = [...current.nodes, ...created.nodes];
        if (scopeNode) syncScopeBoundaryLayout(nextNodes, scopeNode.id);
        return {
          ...current,
          nodes: nextNodes,
          edges: [...current.edges, newEdge, ...created.edges],
        };
      });
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
    setWorkflow(current => {
      if (!current) return null;
      const nextNodes = [...current.nodes, ...created.nodes];
      if (scopeNode) syncScopeBoundaryLayout(nextNodes, scopeNode.id);
      return {
        ...current,
        nodes: nextNodes,
        edges: [
          ...current.edges.filter(edge => {
            if (nodeSelectContext.edgeId && edge.id === nodeSelectContext.edgeId) return false;
            return !(
              edge.source === nodeSelectContext.sourceNodeId
              && edge.target === nodeSelectContext.targetNodeId
              && isSameHandle(edge.sourceHandle, nodeSelectContext.sourceHandle)
            );
          }),
          firstEdge,
          ...created.edges,
          secondEdge,
        ],
      };
    });
    setSelectedNodeId(created.rootNode.id);
    setSelectedNodeIds([created.rootNode.id]);
    markDirty();
  }, [workflow, nodeSelectContext, isReadOnly, pushUndo, markDirty, setSelectedNodeId, setSelectedNodeIds]);

  const handleNodeDelete = useCallback((nodeId: string) => {
    if (!workflow || isReadOnly) return;
    const deletePlan = getWorkflowNodeDeleteIds(workflow.nodes, nodeId);
    if (!deletePlan) return;
    pushUndo('delete node');
    setWorkflow(w => {
      if (!w) return null;
      const removedNode = w.nodes.find(node => node.id === nodeId);
      const currentDeletePlan = getWorkflowNodeDeleteIds(w.nodes, nodeId);
      if (!removedNode || !currentDeletePlan) return w;
      const parentId = removedNode ? getCompositeParentId(removedNode) : null;
      const deleteNodeIds = currentDeletePlan.ids;
      const rootId = currentDeletePlan.rootId;

      const nextNodes = w.nodes.filter(node => !deleteNodeIds.has(node.id));
      if (parentId && !deleteNodeIds.has(parentId)) syncScopeBoundaryLayout(nextNodes, parentId);
      return {
        ...w,
        nodes: nextNodes,
        edges: w.edges.filter(edge =>
          !deleteNodeIds.has(edge.source)
          && !deleteNodeIds.has(edge.target)
          && (!rootId || edge.composite?.rootId !== rootId)
        ),
        groups: cleanupGroupsOnNodeDelete(w.groups, deleteNodeIds),
      };
    });
    if (selectedNodeId && deletePlan.ids.has(selectedNodeId)) setSelectedNodeId(null);
    setSelectedNodeIds(ids => ids.filter(id => !deletePlan.ids.has(id)));
    markDirty();
  }, [workflow, isReadOnly, pushUndo, markDirty, selectedNodeId, setSelectedNodeId, setSelectedNodeIds]);

  const handleBatchDeleteNodes = useCallback((nodeIds: string[]) => {
    if (!workflow || isReadOnly) return;
    const deleteNodeIds = new Set<string>();
    const deletedRootIds = new Set<string>();
    for (const nodeId of nodeIds) {
      const deletePlan = getWorkflowNodeDeleteIds(workflow.nodes, nodeId);
      if (!deletePlan) continue;
      for (const id of deletePlan.ids) deleteNodeIds.add(id);
      if (deletePlan.rootId) deletedRootIds.add(deletePlan.rootId);
    }
    if (deleteNodeIds.size === 0) return;

    pushUndo('batch delete nodes');
    setWorkflow(w => {
      if (!w) return null;
      return {
        ...w,
        nodes: w.nodes.filter(node => !deleteNodeIds.has(node.id)),
        edges: w.edges.filter(edge =>
          !deleteNodeIds.has(edge.source)
          && !deleteNodeIds.has(edge.target)
          && (!edge.composite?.rootId || !deletedRootIds.has(edge.composite.rootId))
        ),
        groups: cleanupGroupsOnNodeDelete(w.groups, deleteNodeIds),
      };
    });
    if (selectedNodeId && deleteNodeIds.has(selectedNodeId)) setSelectedNodeId(null);
    setSelectedNodeIds(ids => ids.filter(id => !deleteNodeIds.has(id)));
    markDirty();
  }, [workflow, isReadOnly, pushUndo, markDirty, selectedNodeId, setSelectedNodeId, setSelectedNodeIds]);

  const handleMergeNodesToGroup = useCallback((nodeIds: string[]) => {
    if (!workflow || isReadOnly) return;
    const childNodeIds = nodeIds.filter(id => canDeleteWorkflowNode(workflow.nodes, id));
    if (childNodeIds.length < 2) return;

    pushUndo('create group');
    const groupId = `group_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setWorkflow(w => {
      if (!w) return null;
      const groups = w.groups || [];
      const childGroupIds = new Set<string>();
      const standaloneNodeIds: string[] = [];

      for (const nodeId of childNodeIds) {
        const oldGroup = groups.find(group => group.childNodeIds.includes(nodeId));
        if (oldGroup) {
          childGroupIds.add(oldGroup.id);
        } else {
          standaloneNodeIds.push(nodeId);
        }
      }

      const nestedGroupIds = Array.from(childGroupIds);
      const existingGroups = groups.map(group => ({
        ...group,
        childNodeIds: [...group.childNodeIds],
        childGroupIds: group.childGroupIds.filter(id => !childGroupIds.has(id)),
        savedNodeStates: { ...(group.savedNodeStates || {}) },
      }));
      const bounds = computeGroupBounds(w.nodes, childNodeIds);
      return {
        ...w,
        groups: [
          ...existingGroups,
          {
            id: groupId,
            name: `分组 ${existingGroups.length + 1}`,
            childNodeIds: standaloneNodeIds,
            childGroupIds: nestedGroupIds,
            locked: false,
            disabled: false,
            savedNodeStates: {},
            ...(bounds || {}),
          },
        ],
      };
    });
    markDirty();
  }, [workflow, isReadOnly, pushUndo, markDirty]);

  const handleMergeNodesToWorkflow = useCallback(async (nodeIds: string[]) => {
    if (!workflow || isReadOnly) return;
    const rootIds = new Set(nodeIds.filter(id => (
      workflow.nodes.some(node => node.id === id) && canDeleteWorkflowNode(workflow.nodes, id)
    )));
    if (rootIds.size < 2) return;

    const selectedIds = new Set<string>();
    for (const node of workflow.nodes) {
      const rootId = getCompositeRootId(node);
      if (rootIds.has(rootId)) selectedIds.add(node.id);
    }
    const nodes = workflow.nodes.filter(node => selectedIds.has(node.id));
    if (nodes.length < 2) return;

    const startNodeId = crypto.randomUUID();
    const endNodeId = crypto.randomUUID();
    const subNodeId = crypto.randomUUID();
    const bounds = {
      minX: Math.min(...nodes.map(node => node.position.x)),
      minY: Math.min(...nodes.map(node => node.position.y)),
      maxX: Math.max(...nodes.map(node => node.position.x)),
    };

    const usedInputKeys = new Set<string>();
    const replacements = new Map<string, string>();
    const selectedBoundaryReplacements = new Map<string, string>();
    const startInputFields: OutputField[] = [];
    const subNodeInputFields: OutputField[] = [];

    for (const node of nodes) {
      if (!rootIds.has(node.id)) continue;
      if (node.type === 'start') selectedBoundaryReplacements.set(node.id, startNodeId);
      if (node.type === 'end') selectedBoundaryReplacements.set(node.id, endNodeId);
    }

    for (const refItem of collectExternalReferences(nodes.map(node => node.data), selectedIds)) {
      if (replacements.has(refItem.raw)) continue;
      const sourceNode = workflow.nodes.find(node => node.id === refItem.nodeId);
      const inputKey = normalizeInputKey(getReferenceFieldKey(sourceNode, refItem.fieldPath), usedInputKeys);
      const originalReference = refItem.source === '__inputs__'
        ? makeInputReference(refItem.nodeId, refItem.fieldPath)
        : makeDataReference(refItem.nodeId, refItem.fieldPath);
      startInputFields.push({ key: inputKey, type: 'any' });
      subNodeInputFields.push({ key: inputKey, type: 'any', value: originalReference });
      replacements.set(refItem.raw, makeInputReference(startNodeId, inputKey));
    }

    const selectedSnapshot = remapSelectedWorkflowNodes(
      workflow.nodes,
      workflow.edges,
      selectedIds,
      rootIds,
      startNodeId,
      endNodeId,
    );
    const extractedNodes = selectedSnapshot.nodes.map(node => ({
      ...node,
      data: replaceReferenceNodeIds(
        replaceReferences(node.data, replacements),
        selectedBoundaryReplacements,
      ) as Record<string, unknown>,
      position: {
        x: node.position.x - bounds.minX + 260,
        y: node.position.y - bounds.minY + 120,
      },
    }));
    clearStartInputFieldValues({ nodes: extractedNodes });

    const now = Date.now();
    const workflowToCreate: Partial<Workflow> = {
      name: `${workflow.name}-子工作流`,
      folderId: workflow.folderId,
      nodes: [
        { id: startNodeId, type: 'start', label: '开始', position: { x: 80, y: 120 }, data: { inputFields: startInputFields } },
        ...extractedNodes,
        { id: endNodeId, type: 'end', label: '结束', position: { x: bounds.maxX - bounds.minX + 520, y: 120 }, data: {} },
      ],
      edges: selectedSnapshot.edges,
      createdAt: now,
      updatedAt: now,
      enabledPlugins: workflow.enabledPlugins ? cloneData(workflow.enabledPlugins) : undefined,
      pluginConfigSchemes: workflow.pluginConfigSchemes ? cloneData(workflow.pluginConfigSchemes) : undefined,
      agentConfig: workflow.agentConfig ? cloneData(workflow.agentConfig) : undefined,
    };
    const createdWorkflow = await workflowApi.create(workflowToCreate);
    upsertWorkflow(createdWorkflow);

    const incomingEdges = workflow.edges.filter(edge => !selectedIds.has(edge.source) && selectedIds.has(edge.target));
    const outgoingEdges = workflow.edges.filter(edge => selectedIds.has(edge.source) && !selectedIds.has(edge.target));
    const replacementNode: Workflow['nodes'][0] = {
      id: subNodeId,
      type: 'sub_workflow',
      label: '子工作流',
      position: { x: bounds.minX, y: bounds.minY },
      data: {
        workflowId: createdWorkflow.id,
        workflowName: createdWorkflow.name,
        inputFields: subNodeInputFields,
      },
    };

    const replacementEdges: Workflow['edges'] = [];
    for (const edge of incomingEdges) {
      const nextEdge = {
        ...cloneData(edge),
        target: subNodeId,
        targetHandle: null,
      };
      nextEdge.id = createWorkflowEdgeId(nextEdge);
      if (!replacementEdges.some(item => item.id === nextEdge.id)) replacementEdges.push(nextEdge);
    }
    for (const edge of outgoingEdges) {
      const nextEdge = {
        ...cloneData(edge),
        source: subNodeId,
        sourceHandle: null,
      };
      nextEdge.id = createWorkflowEdgeId(nextEdge);
      if (!replacementEdges.some(item => item.id === nextEdge.id)) replacementEdges.push(nextEdge);
    }

    pushUndo('merge to sub workflow');
    setWorkflow(w => {
      if (!w) return null;
      return {
        ...w,
        nodes: [
          ...w.nodes.filter(node => !selectedIds.has(node.id)),
          replacementNode,
        ],
        edges: [
          ...w.edges.filter(edge => !selectedIds.has(edge.source) && !selectedIds.has(edge.target)),
          ...replacementEdges,
        ],
        groups: cleanupGroupsOnNodeDelete(w.groups, selectedIds),
      };
    });
    setSelectedNodeId(subNodeId);
    setSelectedNodeIds([subNodeId]);
    markDirty();
  }, [workflow, isReadOnly, upsertWorkflow, pushUndo, setWorkflow, setSelectedNodeId, setSelectedNodeIds, markDirty]);

  const handleRenameGroup = useCallback((groupId: string, name: string) => {
    const trimmed = name.trim();
    if (!workflow || isReadOnly || !trimmed) return;
    const group = workflow.groups?.find(item => item.id === groupId);
    if (!group || group.name === trimmed) return;

    pushUndo('rename group');
    setWorkflow(w => w ? {
      ...w,
      groups: (w.groups || []).map(item => item.id === groupId ? { ...item, name: trimmed } : item),
    } : null);
    markDirty();
  }, [workflow, isReadOnly, pushUndo, setWorkflow, markDirty]);

  const handleUpdateGroup = useCallback((groupId: string, updates: Partial<NonNullable<Workflow['groups']>[number]>) => {
    if (!workflow || isReadOnly) return;
    const group = workflow.groups?.find(item => item.id === groupId);
    if (!group) return;

    const nextUpdates = { ...updates };
    if (typeof nextUpdates.name === 'string') {
      const trimmed = nextUpdates.name.trim();
      if (!trimmed) delete nextUpdates.name;
      else nextUpdates.name = trimmed;
    }
    if (Object.keys(nextUpdates).length === 0) return;

    pushUndo('update group');
    setWorkflow(w => w ? {
      ...w,
      groups: (w.groups || []).map(item => item.id === groupId ? { ...item, ...nextUpdates } : item),
    } : null);
    markDirty();
  }, [workflow, isReadOnly, pushUndo, setWorkflow, markDirty]);

  const handleUngroup = useCallback((groupId: string) => {
    if (!workflow || isReadOnly) return;
    const group = workflow.groups?.find(item => item.id === groupId);
    if (!group) return;

    pushUndo('ungroup');
    setWorkflow(w => {
      if (!w) return null;
      const groups = w.groups || [];
      const parentGroup = groups.find(item => item.childGroupIds.includes(groupId));
      return {
        ...w,
        groups: groups
          .filter(item => item.id !== groupId)
          .map((item) => {
            if (!parentGroup || item.id !== parentGroup.id) return item;
            return {
              ...item,
              childNodeIds: [
                ...item.childNodeIds,
                ...group.childNodeIds.filter(id => !item.childNodeIds.includes(id)),
              ],
              childGroupIds: [
                ...item.childGroupIds.filter(id => id !== groupId),
                ...group.childGroupIds.filter(id => !item.childGroupIds.includes(id)),
              ],
            };
          }),
      };
    });
    markDirty();
  }, [workflow, isReadOnly, pushUndo, setWorkflow, markDirty]);

  const handleBatchUngroup = useCallback((groupIds: string[]) => {
    if (!workflow || isReadOnly) return;
    const ids = new Set(groupIds);
    const removableGroups = (workflow.groups || []).filter(group => ids.has(group.id) && !group.locked);
    if (removableGroups.length === 0) return;

    pushUndo('batch ungroup');
    setWorkflow(w => {
      if (!w) return null;
      const removedById = new Map(removableGroups.map(group => [group.id, group]));
      return {
        ...w,
        groups: (w.groups || [])
          .filter(group => !removedById.has(group.id))
          .map((group) => {
            const directRemovedChildren = group.childGroupIds
              .map(id => removedById.get(id))
              .filter((item): item is NonNullable<Workflow['groups']>[number] => !!item);
            if (directRemovedChildren.length === 0) return group;
            const promotedChildGroupIds = directRemovedChildren.flatMap(item => item.childGroupIds);
            return {
              ...group,
              childGroupIds: [
                ...group.childGroupIds.filter(id => !removedById.has(id)),
                ...promotedChildGroupIds.filter(id => !group.childGroupIds.includes(id)),
              ],
            };
          }),
      };
    });
    markDirty();
  }, [workflow, isReadOnly, pushUndo, setWorkflow, markDirty]);

  const handleFocusGroup = useCallback((groupId: string) => {
    const group = workflow?.groups?.find(item => item.id === groupId);
    if (!group) return;
    const nodeIds = group.childNodeIds.filter(id => workflow?.nodes.some(node => node.id === id));
    setSelectedNodeIds(nodeIds);
    setSelectedNodeId(nodeIds.length === 1 ? nodeIds[0] : null);
  }, [workflow, setSelectedNodeId, setSelectedNodeIds]);

  const handleMoveGroup = useCallback((groupId: string, delta: { x: number; y: number }, options?: { pushUndo?: boolean }) => {
    if (!workflow || isReadOnly) return;
    if (delta.x === 0 && delta.y === 0) return;
    const groups = workflow.groups || [];
    const group = groups.find(item => item.id === groupId);
    if (!group || group.locked) return;

    const movedNodeIds = collectWorkflowGroupNodeIds(groups, groupId);
    for (const descendantId of collectCompositeDescendantIds(workflow.nodes, movedNodeIds)) {
      movedNodeIds.add(descendantId);
    }
    const movedGroupIds = collectWorkflowGroupIds(groups, groupId);

    if (options?.pushUndo !== false) pushUndo('move group');
    setWorkflow(w => {
      if (!w) return null;
      return {
        ...w,
        nodes: w.nodes.map(node => movedNodeIds.has(node.id)
          ? { ...node, position: { x: node.position.x + delta.x, y: node.position.y + delta.y } }
          : node),
        groups: (w.groups || []).map(item => movedGroupIds.has(item.id)
          ? {
              ...item,
              x: typeof item.x === 'number' ? item.x + delta.x : item.x,
              y: typeof item.y === 'number' ? item.y + delta.y : item.y,
            }
          : item),
      };
    });
    markDirty();
  }, [workflow, isReadOnly, pushUndo, setWorkflow, markDirty]);

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
      const currentNode = w.nodes.find(node => node.id === nodeId);
      const parentId = currentNode ? getCompositeParentId(currentNode) : null;
      const nextNodes = w.nodes.map(n => n.id === nodeId ? {
        ...n,
        label: typeof data.label === 'string' ? data.label : n.label,
        ...(typeof nodeState === 'string' ? { nodeState: nodeState as typeof n.nodeState } : {}),
        ...('breakpoint' in data ? { breakpoint: breakpoint === null ? undefined : breakpoint as typeof n.breakpoint } : {}),
        ...('nodeColor' in data ? { nodeColor: nodeColor === null ? undefined : nodeColor as string | undefined } : {}),
        data: { ...n.data, ...nodeData },
      } : n);
      if (parentId) syncScopeBoundaryLayout(nextNodes, parentId);
      return {
        ...w,
        nodes: nextNodes,
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
    handleMergeNodesToWorkflow,
    handleMergeNodesToGroup,
    handleBatchDeleteNodes,
    handleRenameGroup,
    handleUpdateGroup,
    handleUngroup,
    handleBatchUngroup,
    handleFocusGroup,
    handleMoveGroup,
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
