'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  ViewportPortal,
  getSimpleBezierPath,
  getOutgoers,
  useNodes,
  useReactFlow,
  applyNodeChanges,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type Connection,
  type OnConnectEnd,
  type OnConnectStart,
  type OnNodeDrag,
} from '@xyflow/react';
import { Group, Trash2, Workflow as WorkflowIcon } from 'lucide-react';
import '@xyflow/react/dist/style.css';
import type { ExecutionLog, Workflow, StagedNode } from '@agent-spaces/shared';
import { WORKFLOW_NODE_DRAG_MIME, WORKFLOW_STAGED_NODE_DRAG_MIME } from './workflow-drag-types';
import { WorkflowNode as WorkflowNodeComponent } from './workflow-node';
import { WorkflowEdge as WorkflowEdgeComponent } from './workflow-edge';
import { WorkflowGroupOverlay } from './workflow-group-node';
import { WorkflowHelperLines } from './workflow-helper-lines';
import { useTranslations } from 'next-intl';
import { CanvasToolbar } from './workflow-canvas-toolbar';
import { useCanvasData } from './use-workflow-canvas-data';
import { useCanvasDomEvents } from './use-workflow-canvas-dom-events';
import { useCanvasExport } from './use-workflow-canvas-export';
import { getNodeDefinition } from '@/lib/workflow-nodes';
import { getWorkflowNodeSize } from './workflow-node-size';
import type { HandlePositionMode } from './workflow-node-types';
import { resolveNodeCollisions } from './workflow-canvas-utils';

const nodeTypes = { custom: WorkflowNodeComponent };
const edgeTypes = { custom: WorkflowEdgeComponent };
type WorkflowConnectionLineProps =
  NonNullable<React.ComponentProps<typeof ReactFlow>['connectionLineComponent']> extends React.ComponentType<infer Props>
    ? Props
    : never;
type GroupDragPreview = {
  groupId: string;
  bounds: { x: number; y: number; width: number; height: number };
  delta: { x: number; y: number };
};

function WorkflowSelectionConnectionLine({
  fromNode,
  fromHandle,
  toX,
  toY,
  toNode,
  connectionLineStyle,
}: WorkflowConnectionLineProps) {
  const { getInternalNode } = useReactFlow();
  const nodes = useNodes();
  const selectedNodes = nodes.filter(node => node.selected);
  const shouldUseSelection = selectedNodes.some(node => node.id === fromNode.id);
  const sourceNodes = (shouldUseSelection ? selectedNodes : nodes.filter(node => node.id === fromNode.id))
    .filter(node => node.id !== toNode?.id);
  const sourceHandleId = fromHandle.id ?? null;

  const handleBounds = sourceNodes.flatMap((userNode) => {
    const node = getInternalNode(userNode.id);
    if (!node) return [];

    const sourceBounds = node.internals.handleBounds?.source ?? [];

    return sourceBounds
      .filter(bounds => (bounds.id ?? null) === sourceHandleId)
      .map(bounds => ({
        id: node.id,
        positionAbsolute: node.internals.positionAbsolute,
        bounds,
      }));
  });

  return (
    <>
      {handleBounds.map(({ id, positionAbsolute, bounds }) => {
        const fromHandleX = bounds.x + bounds.width / 2;
        const fromHandleY = bounds.y + bounds.height / 2;
        const fromX = positionAbsolute.x + fromHandleX;
        const fromY = positionAbsolute.y + fromHandleY;
        const [path] = getSimpleBezierPath({
          sourceX: fromX,
          sourceY: fromY,
          targetX: toX,
          targetY: toY,
        });

        return (
          <g key={`${id}-${bounds.id ?? 'source'}`}>
            <path
              fill="none"
              strokeWidth={1.5}
              stroke="var(--muted-foreground)"
              style={connectionLineStyle}
              d={path}
            />
            <circle
              cx={toX}
              cy={toY}
              r={3}
              fill="var(--background)"
              stroke="var(--foreground)"
              strokeWidth={1.5}
            />
          </g>
        );
      })}
    </>
  );
}

function areStringArraysEqual(a: string[], b: string[]) {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

function isNonNull<T>(value: T | null): value is T {
  return value !== null;
}

function isPositionNodeChange(
  change: NodeChange,
): change is NodeChange & { type: 'position'; id: string; position: { x: number; y: number } } {
  return change.type === 'position' && !!change.position;
}

interface WorkflowCanvasProps {
  workflow: Workflow;
  isPreview: boolean;
  execStatus?: string;
  isRunning?: boolean;
  executionLog?: ExecutionLog | null;
  selectedNodeId?: string | null;
  selectedNodeIds?: string[];
  onNodeAdd: (type: string, position: { x: number; y: number }) => void;
  onStagedNodeDrop?: (node: StagedNode, position: { x: number; y: number }) => void;
  onNodeDelete: (id: string) => void;
  onNodeCopy?: (id: string) => void;
  onNodeClone?: (id: string) => void;
  onNodeStage?: (id: string) => void;
  onMergeNodesToWorkflow?: (ids: string[]) => void;
  onMergeNodesToGroup?: (ids: string[]) => void;
  onBatchDeleteNodes?: (ids: string[]) => void;
  onGroupUpdate?: (groupId: string, updates: Partial<NonNullable<Workflow['groups']>[number]>) => void;
  onGroupDelete?: (groupId: string) => void;
  onGroupMove?: (groupId: string, delta: { x: number; y: number }, options?: { pushUndo?: boolean }) => void;
  debugNodeId?: string | null;
  debugStatus?: 'idle' | 'running' | 'completed' | 'error';
  onNodeDebug?: (id: string) => void;
  onCancelDebug?: () => void;
  onExecuteFromNode?: (id: string) => void;
  onResumeExecution?: () => void;
  onStopExecution?: () => void;
  pausedNodeId?: string | null;
  pausedReason?: string | null;
  partialExecutionStartNodeId?: string | null;
  onNodeSelect: (id: string | null, multi?: boolean) => void;
  onNodesSelect?: (ids: string[], options?: { primaryNodeId?: string | null }) => void;
  onNodeDataUpdate: (id: string, data: Record<string, unknown>) => void;
  onEdgeDataUpdate: (id: string, data: Record<string, unknown>) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  onExitPreview?: () => void;
  onAutoLayout?: (direction: 'LR' | 'TB', options?: { layoutEngine?: string }) => void;
  onConnectionDrop?: (context: {
    sourceNodeId: string;
    sourceHandle: string | null;
    position: { x: number; y: number } | null;
  }) => void;
  onInsertExistingNodeOnEdge?: (edgeId: string, nodeId: string) => void;
  canvasExportRef?: React.RefObject<{ exportCanvas: (format: 'png' | 'jpeg') => void } | null>;
  onNodeDragStateChange?: (dragging: boolean) => void;
}

export function WorkflowCanvas({
  workflow, isPreview, execStatus = 'idle', isRunning = false, executionLog, selectedNodeId,
  selectedNodeIds = [], onNodeAdd, onNodeDelete, onNodeSelect, onNodesSelect,
  onStagedNodeDrop, onNodeDataUpdate, onEdgeDataUpdate, onNodesChange, onEdgesChange, onConnect,
  canUndo = false, canRedo = false, onUndo, onRedo, onExitPreview, onAutoLayout,
  onConnectionDrop,
  onInsertExistingNodeOnEdge,
  onNodeCopy, onNodeClone, onNodeStage,
  onMergeNodesToWorkflow, onMergeNodesToGroup, onBatchDeleteNodes,
  onGroupUpdate, onGroupDelete, onGroupMove,
  debugNodeId = null, debugStatus = 'idle', onNodeDebug, onCancelDebug,
  onExecuteFromNode, onResumeExecution, onStopExecution,
  pausedNodeId = null, pausedReason = null,
  partialExecutionStartNodeId = null,
  canvasExportRef,
  onNodeDragStateChange,
}: WorkflowCanvasProps) {
  const t = useTranslations('workflows');
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const connectSourceRef = useRef<{ nodeId: string; handleId: string | null; handleType: string | null } | null>(null);
  const connectSucceededRef = useRef(false);
  const isRangeSelectingRef = useRef(false);
  const pendingRangeSelectionRef = useRef<string[] | null>(null);
  const [selectionMenu, setSelectionMenu] = useState<{ x: number; y: number; nodeIds: string[] } | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [groupDragPreview, setGroupDragPreview] = useState<GroupDragPreview | null>(null);
  const [dropTargetEdgeId, setDropTargetEdgeId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const { screenToFlowPosition } = useReactFlow();
  const [helperHorizontal] = useState<number | undefined>();
  const [helperVertical] = useState<number | undefined>();
  const isCanvasLocked = isPreview || isRunning;

  // --- Canvas preferences (persisted in workflow.layoutSnapshot) ---
  const canvasPrefs = useMemo(() => workflow.layoutSnapshot ?? {}, [workflow.layoutSnapshot]);
  const bgVariantKey = (canvasPrefs.bgVariant as string) || 'dots';
  const bgVariant = bgVariantKey === 'lines' ? BackgroundVariant.Lines
    : bgVariantKey === 'cross' ? BackgroundVariant.Cross
    : BackgroundVariant.Dots;
  const snapEnabled = canvasPrefs.snapGrid !== false;
  const autoMergeNodeOnEdge = canvasPrefs.autoMergeNodeOnEdge !== false;
  const collisionBoxEnabled = canvasPrefs.collisionBoxEnabled !== false;
  const savedAttributionPosition = canvasPrefs.attributionPosition;
  const validPositions = ['top-bottom', 'left-right', 'bottom-top', 'right-left'] as const;
  const handlePosition = validPositions.includes(savedAttributionPosition as typeof validPositions[number])
    ? savedAttributionPosition as HandlePositionMode
    : 'left-right';
  const floatingHandles = canvasPrefs.floatingHandles === true;

  const closeSelectionMenu = useCallback(() => {
    setSelectionMenu(null);
  }, []);

  useEffect(() => {
    if (!selectionMenu) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('[data-workflow-selection-menu="true"]')) return;
      closeSelectionMenu();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeSelectionMenu();
    };

    window.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [closeSelectionMenu, selectionMenu]);

  const handleSelectionContextMenu = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (isCanvasLocked || selectedNodeIds.length < 2) return;

    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.closest('.react-flow__node')) return;
    const isSelectionOrPane = !!target.closest('.react-flow__nodesselection, .react-flow__selectionpane, .react-flow__pane');
    if (!isSelectionOrPane) return;

    event.preventDefault();
    event.stopPropagation();
    setSelectionMenu({
      x: event.clientX,
      y: event.clientY,
      nodeIds: [...selectedNodeIds],
    });
  }, [isCanvasLocked, selectedNodeIds]);

  const runSelectionAction = useCallback((action?: (ids: string[]) => void) => {
    if (!selectionMenu || !action) return;
    action(selectionMenu.nodeIds);
    closeSelectionMenu();
  }, [closeSelectionMenu, selectionMenu]);

  const screenDeltaToFlowDelta = useCallback((delta: { x: number; y: number }) => {
    const origin = screenToFlowPosition({ x: 0, y: 0 }, { snapToGrid: false });
    const next = screenToFlowPosition({ x: delta.x, y: delta.y }, { snapToGrid: false });
    return {
      x: next.x - origin.x,
      y: next.y - origin.y,
    };
  }, [screenToFlowPosition]);

  const isValidConnection = useCallback((connection: Connection | Edge) => {
    if (!connection.source || !connection.target) return false;
    if (connection.source === connection.target) return false;

    const nodes = workflow.nodes;
    const edges = workflow.edges;
    const targetNode = nodes.find(node => node.id === connection.target);
    if (!targetNode) return false;

    const hasCycle = (node: typeof targetNode, visited = new Set<string>()): boolean => {
      if (visited.has(node.id)) return false;
      visited.add(node.id);

      for (const outgoer of getOutgoers(node, nodes, edges)) {
        if (outgoer.id === connection.source) return true;
        if (hasCycle(outgoer, visited)) return true;
      }

      return false;
    };

    return !hasCycle(targetNode);
  }, [workflow.edges, workflow.nodes]);

  // --- Extracted hooks ---
  const { selectedEdgeId, selectEdge } = useCanvasDomEvents({
    isCanvasLocked,
    workflowEdges: workflow.edges,
    onEdgesChange,
    onNodeSelect,
    onNodeDelete,
    onNodeDataUpdate,
    onEdgeDataUpdate,
    onNodeCopy,
    onNodeClone,
    onNodeStage,
    onMergeNodesToWorkflow,
    onMergeNodesToGroup,
    onBatchDeleteNodes,
    onNodeDebug,
    onCancelDebug,
    onExecuteFromNode,
    onResumeExecution,
    onStopExecution,
  });

  const { rfNodes, rfEdges } = useCanvasData({
    workflow,
    selectedNodeId,
    selectedNodeIds,
    selectedEdgeId,
    executionLog,
    isPreview,
    isCanvasLocked,
    execStatus,
    debugNodeId,
    debugStatus,
    pausedNodeId,
    pausedReason,
    partialExecutionStartNodeId,
    handlePosition,
    floatingHandles,
    edgePathType: (canvasPrefs.edgePathType as string) || 'bezier',
  });

  const displayedEdges = useMemo(() => rfEdges.map(edge => (
    edge.id === dropTargetEdgeId
      ? { ...edge, data: { ...(edge.data as Record<string, unknown>), isNodeDropTarget: true } }
      : edge
  )), [dropTargetEdgeId, rfEdges]);

  const [canvasNodes, setCanvasNodes] = useState<Node[]>(rfNodes);
  const isNodeDraggingRef = useRef(false);
  const canvasNodesRef = useRef<Node[]>(rfNodes);
  const draggedNodeIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (isNodeDraggingRef.current) return;
    setCanvasNodes(rfNodes);
    canvasNodesRef.current = rfNodes;
  }, [rfNodes]);

  const groupOverlayItems = useMemo(() => {
    const groups = workflow.groups || [];
    if (groups.length === 0) return [];
    const workflowNodeById = new Map(workflow.nodes.map(node => [node.id, node]));
    const groupById = new Map(groups.map(group => [group.id, group]));
    const collectGroupNodeIds = (groupId: string, visited = new Set<string>()): string[] => {
      if (visited.has(groupId)) return [];
      visited.add(groupId);
      const group = groupById.get(groupId);
      if (!group) return [];
      return [
        ...group.childNodeIds,
        ...group.childGroupIds.flatMap(childGroupId => collectGroupNodeIds(childGroupId, visited)),
      ];
    };

    return groups.map((group) => {
      const nodeIds = collectGroupNodeIds(group.id);
      const childNodes = nodeIds
        .map(nodeId => workflowNodeById.get(nodeId))
        .filter((node): node is Workflow['nodes'][number] => !!node)
        .map((node) => {
          const definition = getNodeDefinition(node.type);
          const size = getWorkflowNodeSize(definition, node.data);
          return {
            id: node.id,
            position: node.position,
            width: size.width,
            height: size.height,
          };
        });
      return { group, childNodes };
    });
  }, [workflow.groups, workflow.nodes]);

  const { minimapVisible, toggleMinimap, exportCanvas } = useCanvasExport(
    reactFlowWrapper,
    workflow.name,
  );

  useEffect(() => {
    if (!canvasExportRef) return;
    canvasExportRef.current = { exportCanvas };
    return () => {
      if (canvasExportRef.current?.exportCanvas === exportCanvas) {
        canvasExportRef.current = null;
      }
    };
  }, [canvasExportRef, exportCanvas]);

  // --- Interaction handlers ---

  const handleDragOver = useCallback((event: React.DragEvent) => {
    if (isCanvasLocked) return;
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = Array.from(event.dataTransfer.types).includes(WORKFLOW_STAGED_NODE_DRAG_MIME)
        ? 'copy'
        : 'move';
    }
  }, [isCanvasLocked]);

  const handleDrop = useCallback((event: React.DragEvent) => {
    if (isCanvasLocked) return;
    event.preventDefault();
    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const stagedPayload = event.dataTransfer.getData(WORKFLOW_STAGED_NODE_DRAG_MIME);
    if (stagedPayload && onStagedNodeDrop) {
      try {
        onStagedNodeDrop(JSON.parse(stagedPayload) as StagedNode, position);
        return;
      } catch (error) {
        console.warn('[WorkflowCanvas] invalid staged node drag payload', error);
      }
    }

    const type = event.dataTransfer.getData(WORKFLOW_NODE_DRAG_MIME);
    if (!type) return;

    onNodeAdd(type, position);
  }, [isCanvasLocked, onStagedNodeDrop, screenToFlowPosition, onNodeAdd]);

  const handleNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    const multi = event.shiftKey || event.metaKey || event.ctrlKey;
    selectEdge(null);
    onNodeSelect(node.id, multi);
  }, [onNodeSelect, selectEdge]);

  const handlePaneClick = useCallback(() => {
    selectEdge(null);
    onNodeSelect(null);
  }, [onNodeSelect, selectEdge]);

  const handleEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    selectEdge(edge.id);
  }, [selectEdge]);

  const getDropTargetEdgeId = useCallback((nodeId: string) => {
    const nodeDiv = Array.from(
      reactFlowWrapper.current?.querySelectorAll<HTMLElement>('.react-flow__node') ?? [],
    ).find(element => element.dataset.id === nodeId);
    if (!nodeDiv) return null;

    const rect = nodeDiv.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const edgeElement = document
      .elementsFromPoint(centerX, centerY)
      .map(element => element.closest<HTMLElement>('.react-flow__edge[data-id]'))
      .find((element): element is HTMLElement => !!element);
    const edgeId = edgeElement?.dataset.id;
    if (!edgeId) return null;

    const edge = workflow.edges.find(item => item.id === edgeId);
    if (!edge || edge.composite?.locked) return null;
    if (edge.source === nodeId || edge.target === nodeId) return null;
    return edgeId;
  }, [workflow.edges]);

  const handleNodeDrag: OnNodeDrag = useCallback((_, node) => {
    if (isCanvasLocked || !autoMergeNodeOnEdge || draggedNodeIdsRef.current.size > 1) {
      if (dropTargetEdgeId) setDropTargetEdgeId(null);
      return;
    }
    const nextEdgeId = getDropTargetEdgeId(node.id);
    setDropTargetEdgeId(current => current === nextEdgeId ? current : nextEdgeId);
  }, [autoMergeNodeOnEdge, dropTargetEdgeId, getDropTargetEdgeId, isCanvasLocked]);

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    if (isCanvasLocked) return;
    const positionChanges = changes.filter(isPositionNodeChange);
    const positionCount = positionChanges.length;
    const selectionChanges = changes.filter(
      (change): change is NodeChange & { type: 'select'; id: string; selected: boolean } => change.type === 'select',
    );
    if (selectionChanges.length > 0 && onNodesSelect) {
      const nextSelectedIds = new Set(selectedNodeIds);
      for (const change of selectionChanges) {
        if (change.selected) nextSelectedIds.add(change.id);
        else nextSelectedIds.delete(change.id);
      }
      const nextIds = workflow.nodes.map(node => node.id).filter(id => nextSelectedIds.has(id));
      if (!areStringArraysEqual(selectedNodeIds, nextIds)) {
        if (nextIds.length > 0) selectEdge(null);
        pendingRangeSelectionRef.current = nextIds;
        onNodesSelect(nextIds, {
          primaryNodeId: isRangeSelectingRef.current ? null : undefined,
        });
      }
    }

    if (positionCount > 0) {
      for (const change of positionChanges) {
        draggedNodeIdsRef.current.add(change.id);
      }
      setCanvasNodes((nodes) => {
        const nextNodes = applyNodeChanges(changes, nodes);
        canvasNodesRef.current = nextNodes;
        return nextNodes;
      });
    }

    const parentChanges = isNodeDraggingRef.current
      ? changes.filter(change => change.type !== 'position')
      : changes;
    if (parentChanges.length > 0) {
      onNodesChange(parentChanges);
    }
  }, [isCanvasLocked, onNodesChange, onNodesSelect, selectEdge, selectedNodeIds, workflow.nodes]);

  const handleEdgesChangeWithLock = useCallback((changes: EdgeChange[]) => {
    if (isCanvasLocked) return;
    onEdgesChange(changes);
  }, [isCanvasLocked, onEdgesChange]);

  const handleSelectionStart = useCallback(() => {
    isRangeSelectingRef.current = true;
    pendingRangeSelectionRef.current = selectedNodeIds;
    onNodesSelect?.(selectedNodeIds, { primaryNodeId: null });
  }, [onNodesSelect, selectedNodeIds]);

  const handleSelectionEnd = useCallback(() => {
    isRangeSelectingRef.current = false;
    const ids = pendingRangeSelectionRef.current ?? selectedNodeIds;
    pendingRangeSelectionRef.current = null;
    onNodesSelect?.(ids, { primaryNodeId: ids.length === 1 ? ids[0] : null });
  }, [onNodesSelect, selectedNodeIds]);

  const handleConnect = useCallback((connection: Connection) => {
    if (isCanvasLocked) return;
    connectSucceededRef.current = true;
    onConnect(connection);
  }, [isCanvasLocked, onConnect]);

  const handleConnectStart: OnConnectStart = useCallback((_, params) => {
    if (!isCanvasLocked) {
      setIsConnecting(true);
      const nodeId = typeof params === 'object' && params && 'nodeId' in params
        ? String((params as { nodeId?: string | null }).nodeId || '')
        : '';
      const handleId = typeof params === 'object' && params && 'handleId' in params
        ? ((params as { handleId?: string | null }).handleId ?? null)
        : null;
      const handleType = typeof params === 'object' && params && 'handleType' in params
        ? ((params as { handleType?: string | null }).handleType ?? null)
        : null;
      connectSourceRef.current = nodeId ? { nodeId, handleId, handleType } : null;
      connectSucceededRef.current = false;
    }
  }, [isCanvasLocked]);

  const handleConnectEnd: OnConnectEnd = useCallback((event) => {
    setIsConnecting(false);
    const connectSource = connectSourceRef.current;
    if (!isCanvasLocked && connectSource && !connectSucceededRef.current) {
      const isSourceHandle = connectSource.handleType === 'source';
      if (!isSourceHandle) {
        connectSourceRef.current = null;
        connectSucceededRef.current = false;
        return;
      }

      let clientPosition: { x: number; y: number } | null = null;
      if ('clientX' in event && 'clientY' in event) {
        clientPosition = { x: event.clientX, y: event.clientY };
      } else if ('changedTouches' in event && event.changedTouches.length > 0) {
        const touch = event.changedTouches[0];
        clientPosition = { x: touch.clientX, y: touch.clientY };
      }

      const position = clientPosition ? screenToFlowPosition(clientPosition) : null;
      onConnectionDrop?.({
        sourceNodeId: connectSource.nodeId,
        sourceHandle: connectSource.handleId,
        position,
      });
    }

    connectSourceRef.current = null;
    connectSucceededRef.current = false;
  }, [isCanvasLocked, onConnectionDrop, screenToFlowPosition]);

  const handleNodeDragStart = useCallback((_: React.MouseEvent, node: Node) => {
    isNodeDraggingRef.current = true;
    draggedNodeIdsRef.current = new Set([node.id]);
    canvasNodesRef.current = canvasNodes;
    setDropTargetEdgeId(null);
    onNodeDragStateChange?.(true);
  }, [canvasNodes, onNodeDragStateChange]);

  const handleNodeDragStop = useCallback((_: React.MouseEvent, node: Node) => {
    const edgeId = autoMergeNodeOnEdge && draggedNodeIdsRef.current.size === 1
      ? dropTargetEdgeId
      : null;
    const nextCanvasNodes = collisionBoxEnabled
      ? resolveNodeCollisions(canvasNodesRef.current, {
          maxIterations: 50,
          overlapThreshold: 0.5,
          margin: 15,
        })
      : canvasNodesRef.current;
    canvasNodesRef.current = nextCanvasNodes;
    setCanvasNodes(nextCanvasNodes);
    const workflowNodeById = new Map(workflow.nodes.map(item => [item.id, item]));
    const positionChanges: NodeChange[] = nextCanvasNodes
      .map((canvasNode) => {
        const workflowNode = workflowNodeById.get(canvasNode.id);
        if (!workflowNode) return null;
        if (canvasNode.position.x === workflowNode.position.x && canvasNode.position.y === workflowNode.position.y) return null;
        return {
          id: canvasNode.id,
          type: 'position' as const,
          position: canvasNode.position,
          dragging: false,
        };
      })
      .filter(isNonNull);
    isNodeDraggingRef.current = false;
    draggedNodeIdsRef.current = new Set();
    onNodeDragStateChange?.(false);
    if (positionChanges.length > 0) {
      onNodesChange(positionChanges);
    }
    if (edgeId) {
      onInsertExistingNodeOnEdge?.(edgeId, node.id);
    }
    setDropTargetEdgeId(null);
  }, [autoMergeNodeOnEdge, collisionBoxEnabled, dropTargetEdgeId, onInsertExistingNodeOnEdge, onNodeDragStateChange, onNodesChange, workflow.nodes]);

  const handleReactFlowError = useCallback((code: string, message: string) => {
    console.warn('[WorkflowCanvas] ReactFlow error', { code, message });
  }, []);

  // --- Render ---
  return (
    <div
      ref={reactFlowWrapper}
      className={`relative flex-1 h-full w-full ${floatingHandles && isConnecting ? 'workflow-canvas-show-floating-handles' : ''}`}
      onContextMenuCapture={handleSelectionContextMenu}
    >
      <ReactFlow
        className="h-full w-full"
        nodes={canvasNodes}
        edges={displayedEdges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChangeWithLock}
        onConnect={handleConnect}
        isValidConnection={isValidConnection}
        onConnectStart={handleConnectStart}
        onConnectEnd={handleConnectEnd}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onNodeClick={handleNodeClick}
        onNodeDragStart={handleNodeDragStart}
        onNodeDrag={handleNodeDrag}
        onNodeDragStop={handleNodeDragStop}
        onEdgeClick={handleEdgeClick}
        onSelectionStart={handleSelectionStart}
        onSelectionEnd={handleSelectionEnd}
        onPaneClick={handlePaneClick}
        onError={handleReactFlowError}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionLineComponent={WorkflowSelectionConnectionLine}
        fitView
        snapToGrid={snapEnabled}
        snapGrid={[15, 15]}
        minZoom={0.2}
        maxZoom={4}
        deleteKeyCode={isCanvasLocked || selectedEdgeId ? null : ['Backspace', 'Delete']}
        nodesDraggable={!isCanvasLocked}
        nodesConnectable={!isCanvasLocked}
        edgesReconnectable={!isCanvasLocked}
        elevateNodesOnSelect={false}
        defaultEdgeOptions={{ type: 'custom' }}
      >
        <ViewportPortal>
          {groupOverlayItems.map(({ group, childNodes }) => (
            <WorkflowGroupOverlay
              key={group.id}
              group={group}
              childNodes={childNodes}
              isSelected={selectedGroupId === group.id}
              isPreview={isPreview}
              onSelect={setSelectedGroupId}
              onDelete={(groupId) => onGroupDelete?.(groupId)}
              onUpdate={(groupId, updates) => onGroupUpdate?.(groupId, updates)}
              onMove={(groupId, delta, options) => onGroupMove?.(groupId, delta, options)}
              onDragPreviewChange={setGroupDragPreview}
              screenDeltaToFlowDelta={screenDeltaToFlowDelta}
            />
          ))}
          {groupDragPreview && (
            <div
              className="pointer-events-none absolute"
              style={{
                left: groupDragPreview.bounds.x + groupDragPreview.delta.x,
                top: groupDragPreview.bounds.y + groupDragPreview.delta.y,
                width: groupDragPreview.bounds.width,
                height: groupDragPreview.bounds.height,
                border: '2px solid var(--primary)',
                borderRadius: 8,
                backgroundColor: 'rgba(59,130,246,0.06)',
                boxShadow: '0 0 0 1px rgba(255,255,255,0.6)',
                zIndex: 2,
              }}
            />
          )}
        </ViewportPortal>
        <Background variant={bgVariant} gap={15} size={1} />
        <Controls position="bottom-left" />
        {minimapVisible && <MiniMap />}
        <WorkflowHelperLines horizontal={helperHorizontal} vertical={helperVertical} />
      </ReactFlow>
      {selectionMenu && (
        <div
          data-workflow-selection-menu="true"
          className="fixed z-50 min-w-40 rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10"
          style={{ left: selectionMenu.x, top: selectionMenu.y }}
          onContextMenu={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          <button
            type="button"
            className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-xs hover:bg-accent hover:text-accent-foreground"
            onClick={() => runSelectionAction(onMergeNodesToWorkflow)}
          >
            <WorkflowIcon className="h-3 w-3" />
            {t('canvas.mergeToWorkflow')}
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-xs hover:bg-accent hover:text-accent-foreground"
            onClick={() => runSelectionAction(onMergeNodesToGroup)}
          >
            <Group className="h-3 w-3" />
            {t('canvas.mergeToGroup')}
          </button>
          <div className="-mx-1 my-1 h-px bg-border" />
          <button
            type="button"
            className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-xs text-destructive hover:bg-destructive/10"
            onClick={() => runSelectionAction(onBatchDeleteNodes)}
          >
            <Trash2 className="h-3 w-3" />
            {t('canvas.batchDelete')}
          </button>
        </div>
      )}
      <CanvasToolbar
        workflow={workflow}
        isPreview={isPreview}
        canUndo={!isCanvasLocked && canUndo}
        canRedo={!isCanvasLocked && canRedo}
        minimapVisible={minimapVisible}
        onUndo={onUndo}
        onRedo={onRedo}
        onExitPreview={onExitPreview}
        onAutoLayout={isCanvasLocked ? undefined : onAutoLayout}
        onToggleMinimap={toggleMinimap}
      />
    </div>
  );
}
