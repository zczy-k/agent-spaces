'use client';

import React, { useCallback, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  useReactFlow,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type Connection,
  type OnConnectEnd,
  type OnConnectStart,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { ExecutionLog, Workflow, StagedNode } from '@agent-spaces/shared';
import { WORKFLOW_NODE_DRAG_MIME, WORKFLOW_STAGED_NODE_DRAG_MIME } from './workflow-drag-types';
import { WorkflowNode as WorkflowNodeComponent } from './workflow-node';
import { WorkflowEdge as WorkflowEdgeComponent } from './workflow-edge';
import { WorkflowHelperLines } from './workflow-helper-lines';
import { CanvasToolbar } from './workflow-canvas-toolbar';
import { useCanvasData } from './use-workflow-canvas-data';
import { useCanvasDebug } from './use-workflow-canvas-debug';
import { useCanvasDomEvents } from './use-workflow-canvas-dom-events';
import { useCanvasExport } from './use-workflow-canvas-export';

const nodeTypes = { custom: WorkflowNodeComponent };
const edgeTypes = { custom: WorkflowEdgeComponent };
const DEBUG_WORKFLOW_CANVAS = process.env.NODE_ENV !== 'production';

function areStringArraysEqual(a: string[], b: string[]) {
  return a.length === b.length && a.every((item, index) => item === b[index]);
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
  onAutoLayout?: (direction: 'LR' | 'TB') => void;
  onConnectionDrop?: (context: {
    sourceNodeId: string;
    sourceHandle: string | null;
    position: { x: number; y: number } | null;
  }) => void;
}

export function WorkflowCanvas({
  workflow, isPreview, execStatus = 'idle', isRunning = false, executionLog, selectedNodeId,
  selectedNodeIds = [], onNodeAdd, onNodeDelete, onNodeSelect, onNodesSelect,
  onStagedNodeDrop, onNodeDataUpdate, onNodesChange, onEdgesChange, onConnect,
  canUndo = false, canRedo = false, onUndo, onRedo, onExitPreview, onAutoLayout,
  onConnectionDrop,
  onNodeCopy, onNodeClone, onNodeStage,
  debugNodeId = null, debugStatus = 'idle', onNodeDebug, onCancelDebug,
  onExecuteFromNode, onResumeExecution, onStopExecution,
  pausedNodeId = null, pausedReason = null,
  partialExecutionStartNodeId = null,
}: WorkflowCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const connectSourceRef = useRef<{ nodeId: string; handleId: string | null } | null>(null);
  const connectSucceededRef = useRef(false);
  const isRangeSelectingRef = useRef(false);
  const pendingRangeSelectionRef = useRef<string[] | null>(null);
  const { screenToFlowPosition } = useReactFlow();
  const [helperHorizontal] = useState<number | undefined>();
  const [helperVertical] = useState<number | undefined>();
  const isCanvasLocked = isPreview || isRunning;

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
  });

  const { getNodeDebugSnapshot } = useCanvasDebug(rfNodes, reactFlowWrapper, workflow);

  const { minimapVisible, isExporting, toggleMinimap, exportCanvas } = useCanvasExport(
    reactFlowWrapper,
    workflow.name,
  );

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
    if (DEBUG_WORKFLOW_CANVAS) {
      console.debug('[WorkflowCanvas] onNodesChange', {
        changes,
        snapshot: getNodeDebugSnapshot(),
      });
    }
    onNodesChange(changes);
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
      connectSourceRef.current = nodeId ? { nodeId, handleId } : null;
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
    if (!DEBUG_WORKFLOW_CANVAS) return;
    console.debug('[WorkflowCanvas] onNodeDragStart', {
      node,
      snapshot: getNodeDebugSnapshot(node.id),
    });
  }, [getNodeDebugSnapshot]);

  const handleNodeDragStop = useCallback((_: React.MouseEvent, node: Node) => {
    if (!DEBUG_WORKFLOW_CANVAS) return;
    console.debug('[WorkflowCanvas] onNodeDragStop', {
      node,
      snapshot: getNodeDebugSnapshot(node.id),
    });
  }, [getNodeDebugSnapshot]);

  const handleReactFlowError = useCallback((code: string, message: string) => {
    console.warn('[WorkflowCanvas] ReactFlow error', {
      code,
      message,
      snapshot: getNodeDebugSnapshot(),
    });
  }, [getNodeDebugSnapshot]);

  // --- Render ---
  return (
    <div ref={reactFlowWrapper} className="relative flex-1 h-full w-full">
      <ReactFlow
        className="h-full w-full"
        nodes={rfNodes}
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
        snapToGrid
        snapGrid={[15, 15]}
        minZoom={0.2}
        maxZoom={4}
        deleteKeyCode={isCanvasLocked || selectedEdgeId ? null : ['Backspace', 'Delete']}
        nodesDraggable={!isCanvasLocked}
        nodesConnectable={!isCanvasLocked}
        edgesReconnectable={!isCanvasLocked}
        defaultEdgeOptions={{ type: 'custom' }}
      >
        <Background variant={BackgroundVariant.Dots} gap={15} size={1} />
        <Controls />
        {minimapVisible && <MiniMap />}
        <WorkflowHelperLines horizontal={helperHorizontal} vertical={helperVertical} />
      </ReactFlow>
      <CanvasToolbar
        workflow={workflow}
        isPreview={isPreview}
        canUndo={!isCanvasLocked && canUndo}
        canRedo={!isCanvasLocked && canRedo}
        minimapVisible={minimapVisible}
        isExporting={isExporting}
        onUndo={onUndo}
        onRedo={onRedo}
        onExitPreview={onExitPreview}
        onAutoLayout={isCanvasLocked ? undefined : onAutoLayout}
        onToggleMinimap={toggleMinimap}
        onExport={exportCanvas}
      />
    </div>
  );
}
