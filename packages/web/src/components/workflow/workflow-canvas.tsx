'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  ControlButton,
  MiniMap,
  BackgroundVariant,
  ViewportPortal,
  useReactFlow,
  applyNodeChanges,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type Connection,
  type OnConnectEnd,
  type OnConnectStart,
} from '@xyflow/react';
import { Check, Grid3X3, Grip, Group, PanelsTopLeft, Trash2, Waypoints, Workflow as WorkflowIcon } from 'lucide-react';
import '@xyflow/react/dist/style.css';
import type { ExecutionLog, Workflow, StagedNode } from '@agent-spaces/shared';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { WORKFLOW_NODE_DRAG_MIME, WORKFLOW_STAGED_NODE_DRAG_MIME } from './workflow-drag-types';
import { WorkflowNode as WorkflowNodeComponent } from './workflow-node';
import { WorkflowEdge as WorkflowEdgeComponent } from './workflow-edge';
import { WorkflowGroupOverlay } from './workflow-group-node';
import { WorkflowHelperLines } from './workflow-helper-lines';
import { CanvasToolbar } from './workflow-canvas-toolbar';
import { useCanvasData } from './use-workflow-canvas-data';
import { useCanvasDebug } from './use-workflow-canvas-debug';
import { useCanvasDomEvents } from './use-workflow-canvas-dom-events';
import { useCanvasExport } from './use-workflow-canvas-export';
import { getNodeDefinition } from '@/lib/workflow-nodes';
import { getWorkflowNodeSize } from './workflow-node-size';
import type { HandlePositionMode } from './workflow-node-types';

const nodeTypes = { custom: WorkflowNodeComponent };
const edgeTypes = { custom: WorkflowEdgeComponent };
const DEBUG_WORKFLOW_CANVAS = process.env.NODE_ENV !== 'production';
const BACKGROUND_OPTIONS = [
  { value: 'dots', label: '点阵' },
  { value: 'lines', label: '线条' },
  { value: 'cross', label: '十字' },
] as const;
const SNAP_OPTIONS = [
  { value: true, label: '开启' },
  { value: false, label: '关闭' },
] as const;
const LAYOUT_ENGINE_OPTIONS = [
  { value: 'dagre', label: 'Dagre' },
  { value: 'elk', label: 'ELK' },
] as const;
const HANDLE_POSITION_OPTIONS = [
  { value: 'top-bottom', label: 'top-bottom' },
  { value: 'left-right', label: 'left-right' },
  { value: 'bottom-top', label: 'bottom-top' },
  { value: 'right-left', label: 'right-left' },
] as const satisfies ReadonlyArray<{ value: HandlePositionMode; label: string }>;

type GroupDragPreview = {
  groupId: string;
  bounds: { x: number; y: number; width: number; height: number };
  delta: { x: number; y: number };
};

function areStringArraysEqual(a: string[], b: string[]) {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

function isPositionNodeChange(
  change: NodeChange,
): change is NodeChange & { type: 'position'; id: string; position: { x: number; y: number } } {
  return change.type === 'position' && !!change.position;
}

function CanvasPopoverOption({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="flex h-8 w-full items-center justify-between rounded px-2 text-left text-xs text-foreground hover:bg-muted"
      onClick={onClick}
    >
      <span>{children}</span>
      <Check className={`h-3.5 w-3.5 ${active ? 'text-primary' : 'text-transparent'}`} />
    </button>
  );
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
  onCanvasPreferencesChange?: (prefs: Record<string, unknown>) => void;
  canvasExportRef?: React.RefObject<{ exportCanvas: (format: 'png' | 'jpeg') => void } | null>;
  onNodeDragStateChange?: (dragging: boolean) => void;
}

export function WorkflowCanvas({
  workflow, isPreview, execStatus = 'idle', isRunning = false, executionLog, selectedNodeId,
  selectedNodeIds = [], onNodeAdd, onNodeDelete, onNodeSelect, onNodesSelect,
  onStagedNodeDrop, onNodeDataUpdate, onNodesChange, onEdgesChange, onConnect,
  canUndo = false, canRedo = false, onUndo, onRedo, onExitPreview, onAutoLayout,
  onConnectionDrop,
  onNodeCopy, onNodeClone, onNodeStage,
  onMergeNodesToWorkflow, onMergeNodesToGroup, onBatchDeleteNodes,
  onGroupUpdate, onGroupDelete, onGroupMove,
  debugNodeId = null, debugStatus = 'idle', onNodeDebug, onCancelDebug,
  onExecuteFromNode, onResumeExecution, onStopExecution,
  pausedNodeId = null, pausedReason = null,
  partialExecutionStartNodeId = null,
  onCanvasPreferencesChange,
  canvasExportRef,
  onNodeDragStateChange,
}: WorkflowCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const connectSourceRef = useRef<{ nodeId: string; handleId: string | null; handleType: string | null } | null>(null);
  const connectSucceededRef = useRef(false);
  const isRangeSelectingRef = useRef(false);
  const pendingRangeSelectionRef = useRef<string[] | null>(null);
  const [selectionMenu, setSelectionMenu] = useState<{ x: number; y: number; nodeIds: string[] } | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [groupDragPreview, setGroupDragPreview] = useState<GroupDragPreview | null>(null);
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
  const layoutEngine = (canvasPrefs.layoutEngine as string) || 'dagre';
  const savedAttributionPosition = canvasPrefs.attributionPosition;
  const handlePosition = HANDLE_POSITION_OPTIONS.some(option => option.value === savedAttributionPosition)
    ? savedAttributionPosition as HandlePositionMode
    : 'left-right';

  const updateCanvasPrefs = useCallback((patch: Record<string, unknown>) => {
    onCanvasPreferencesChange?.({ ...canvasPrefs, ...patch });
  }, [canvasPrefs, onCanvasPreferencesChange]);

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

  const handleLayoutEngineChange = useCallback((next: string) => {
    updateCanvasPrefs({ layoutEngine: next });
    if (!isCanvasLocked) onAutoLayout?.('LR', { layoutEngine: next });
  }, [isCanvasLocked, onAutoLayout, updateCanvasPrefs]);

  // --- Extracted hooks ---
  const { selectedEdgeId, selectEdge } = useCanvasDomEvents({
    isCanvasLocked,
    workflowEdges: workflow.edges,
    onEdgesChange,
    onNodeSelect,
    onNodeDelete,
    onNodeDataUpdate,
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
  });

  const [canvasNodes, setCanvasNodes] = useState<Node[]>(rfNodes);
  const isNodeDraggingRef = useRef(false);
  const canvasNodesRef = useRef<Node[]>(rfNodes);
  const draggedNodeIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (isNodeDraggingRef.current) return;
    setCanvasNodes(rfNodes);
    canvasNodesRef.current = rfNodes;
  }, [rfNodes]);

  const { getNodeDebugSnapshot } = useCanvasDebug(canvasNodes, reactFlowWrapper, workflow);

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

  if (canvasExportRef) {
    canvasExportRef.current = { exportCanvas };
  }

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

  const handleNodesChangeWithDebug = useCallback((changes: NodeChange[]) => {
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
  }, [getNodeDebugSnapshot, isCanvasLocked, onNodesChange, onNodesSelect, selectEdge, selectedNodeIds, workflow.nodes]);

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

  const handleConnectWithDebug = useCallback((connection: Connection) => {
    if (isCanvasLocked) return;
    connectSucceededRef.current = true;
    if (DEBUG_WORKFLOW_CANVAS) {
      console.debug('[WorkflowCanvas] onConnect', {
        connection,
        sourceSnapshot: getNodeDebugSnapshot(connection.source),
        targetSnapshot: getNodeDebugSnapshot(connection.target),
      });
    }
    onConnect(connection);
  }, [getNodeDebugSnapshot, isCanvasLocked, onConnect]);

  const handleConnectStart: OnConnectStart = useCallback((_, params) => {
    if (!isCanvasLocked) {
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

    if (!DEBUG_WORKFLOW_CANVAS) return;
    const nodeId = typeof params === 'object' && params && 'nodeId' in params
      ? String((params as { nodeId?: string | null }).nodeId || '')
      : null;
    console.debug('[WorkflowCanvas] onConnectStart', {
      params,
      snapshot: getNodeDebugSnapshot(nodeId),
    });
  }, [getNodeDebugSnapshot, isCanvasLocked]);

  const handleConnectEnd: OnConnectEnd = useCallback((event) => {
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

    if (!DEBUG_WORKFLOW_CANVAS) return;
    console.debug('[WorkflowCanvas] onConnectEnd', {
      eventType: event.type,
      snapshot: getNodeDebugSnapshot(),
    });
  }, [getNodeDebugSnapshot, isCanvasLocked, onConnectionDrop, screenToFlowPosition]);

  const handleNodeDragStart = useCallback((_: React.MouseEvent, node: Node) => {
    isNodeDraggingRef.current = true;
    draggedNodeIdsRef.current = new Set([node.id]);
    canvasNodesRef.current = canvasNodes;
    onNodeDragStateChange?.(true);
  }, [canvasNodes, onNodeDragStateChange]);

  const handleNodeDragStop = useCallback((_: React.MouseEvent, node: Node) => {
    const canvasNodeById = new Map(canvasNodesRef.current.map(item => [item.id, item]));
    const workflowNodeById = new Map(workflow.nodes.map(item => [item.id, item]));
    const positionChanges: NodeChange[] = Array.from(draggedNodeIdsRef.current)
      .map((nodeId) => {
        const canvasNode = canvasNodeById.get(nodeId);
        const workflowNode = workflowNodeById.get(nodeId);
        if (!canvasNode || !workflowNode) return null;
        if (canvasNode.position.x === workflowNode.position.x && canvasNode.position.y === workflowNode.position.y) return null;
        return {
          id: nodeId,
          type: 'position' as const,
          position: canvasNode.position,
          dragging: false,
        };
      })
      .filter((change): change is NodeChange => !!change);
    isNodeDraggingRef.current = false;
    draggedNodeIdsRef.current = new Set();
    onNodeDragStateChange?.(false);
    if (positionChanges.length > 0) {
      onNodesChange(positionChanges);
    }
  }, [onNodeDragStateChange, onNodesChange, workflow.nodes]);

  const handleReactFlowError = useCallback((code: string, message: string) => {
    console.warn('[WorkflowCanvas] ReactFlow error', {
      code,
      message,
      snapshot: getNodeDebugSnapshot(),
    });
  }, [getNodeDebugSnapshot]);

  // --- Render ---
  return (
    <div
      ref={reactFlowWrapper}
      className="relative flex-1 h-full w-full"
      onContextMenuCapture={handleSelectionContextMenu}
    >
      <ReactFlow
        className="h-full w-full"
        nodes={canvasNodes}
        edges={rfEdges}
        onNodesChange={handleNodesChangeWithDebug}
        onEdgesChange={handleEdgesChangeWithLock}
        onConnect={handleConnectWithDebug}
        onConnectStart={handleConnectStart}
        onConnectEnd={handleConnectEnd}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onNodeClick={handleNodeClick}
        onNodeDragStart={handleNodeDragStart}
        onNodeDragStop={handleNodeDragStop}
        onEdgeClick={handleEdgeClick}
        onSelectionStart={handleSelectionStart}
        onSelectionEnd={handleSelectionEnd}
        onPaneClick={handlePaneClick}
        onError={handleReactFlowError}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
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
        <Controls position="bottom-left">
          <Popover>
            <PopoverTrigger render={<ControlButton title="切换背景" />}>
              <Grid3X3 size={14} />
            </PopoverTrigger>
            <PopoverContent className="w-36 gap-1 p-1.5" side="right" align="start">
              {BACKGROUND_OPTIONS.map(option => (
                <CanvasPopoverOption
                  key={option.value}
                  active={bgVariantKey === option.value}
                  onClick={() => updateCanvasPrefs({ bgVariant: option.value })}
                >
                  {option.label}
                </CanvasPopoverOption>
              ))}
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger render={<ControlButton title={snapEnabled ? '网格吸附: 开' : '网格吸附: 关'} />}>
              <Grip size={14} className={snapEnabled ? 'text-primary' : 'text-muted-foreground'} />
            </PopoverTrigger>
            <PopoverContent className="w-32 gap-1 p-1.5" side="right" align="start">
              {SNAP_OPTIONS.map(option => (
                <CanvasPopoverOption
                  key={String(option.value)}
                  active={snapEnabled === option.value}
                  onClick={() => updateCanvasPrefs({ snapGrid: option.value })}
                >
                  {option.label}
                </CanvasPopoverOption>
              ))}
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger render={<ControlButton title={`布局引擎: ${layoutEngine}`} />}>
              <Waypoints size={14} />
            </PopoverTrigger>
            <PopoverContent className="w-36 gap-1 p-1.5" side="right" align="start">
              {LAYOUT_ENGINE_OPTIONS.map(option => (
                <CanvasPopoverOption
                  key={option.value}
                  active={layoutEngine === option.value}
                  onClick={() => handleLayoutEngineChange(option.value)}
                >
                  {option.label}
                </CanvasPopoverOption>
              ))}
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger render={<ControlButton title="节点连接点位置" />}>
              <PanelsTopLeft size={14} />
            </PopoverTrigger>
            <PopoverContent className="w-36 gap-1 p-1.5" side="right" align="start">
              {HANDLE_POSITION_OPTIONS.map(option => (
                <CanvasPopoverOption
                  key={option.value}
                  active={handlePosition === option.value}
                  onClick={() => updateCanvasPrefs({ attributionPosition: option.value })}
                >
                  {option.label}
                </CanvasPopoverOption>
              ))}
            </PopoverContent>
          </Popover>
        </Controls>
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
            合并为工作流
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-xs hover:bg-accent hover:text-accent-foreground"
            onClick={() => runSelectionAction(onMergeNodesToGroup)}
          >
            <Group className="h-3 w-3" />
            合并成组
          </button>
          <div className="-mx-1 my-1 h-px bg-border" />
          <button
            type="button"
            className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-xs text-destructive hover:bg-destructive/10"
            onClick={() => runSelectionAction(onBatchDeleteNodes)}
          >
            <Trash2 className="h-3 w-3" />
            批量删除
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
