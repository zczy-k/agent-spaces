'use client';

import React, { useCallback, useRef, useState, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  useReactFlow,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { Workflow, WorkflowNode, WorkflowEdge } from '@agent-spaces/shared';
import { getNodeDefinition } from '@/lib/workflow-nodes';
import { WORKFLOW_NODE_DRAG_MIME } from './workflow-node-sidebar';
import { WorkflowNode as WorkflowNodeComponent } from './workflow-node';
import { WorkflowEdge as WorkflowEdgeComponent } from './workflow-edge';
import { WorkflowHelperLines } from './workflow-helper-lines';

const nodeTypes = { custom: WorkflowNodeComponent };
const edgeTypes = { custom: WorkflowEdgeComponent };

interface WorkflowCanvasProps {
  workflow: Workflow;
  isPreview: boolean;
  onNodeAdd: (type: string, position: { x: number; y: number }) => void;
  onNodeDelete: (id: string) => void;
  onNodeSelect: (id: string | null, multi?: boolean) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
}

export function WorkflowCanvas({
  workflow, isPreview,
  onNodeAdd, onNodeDelete, onNodeSelect,
  onNodesChange, onEdgesChange, onConnect,
}: WorkflowCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  const [helperHorizontal, setHelperHorizontal] = useState<number | undefined>();
  const [helperVertical, setHelperVertical] = useState<number | undefined>();

  // Convert Workflow nodes/edges to ReactFlow format
  const rfNodes: Node[] = useMemo(() =>
    workflow.nodes.map(n => ({
      id: n.id,
      type: 'custom',
      position: n.position,
      data: {
        ...n.data,
        label: n.label,
        nodeType: n.type,
      } as Record<string, unknown>,
    })),
    [workflow.nodes],
  );

  const rfEdges: Edge[] = useMemo(() =>
    workflow.edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: 'custom',
      sourceHandle: e.sourceHandle || undefined,
      targetHandle: e.targetHandle || undefined,
      data: {
        composite: e.composite,
        sourceHandle: e.sourceHandle,
      } as Record<string, unknown>,
    })),
    [workflow.edges],
  );

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    if (isPreview) return;
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  }, [isPreview]);

  const handleDrop = useCallback((event: React.DragEvent) => {
    if (isPreview) return;
    const type = event.dataTransfer.getData(WORKFLOW_NODE_DRAG_MIME);
    if (!type) return;

    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    onNodeAdd(type, position);
  }, [isPreview, screenToFlowPosition, onNodeAdd]);

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const multi = false; // Could check for shift/meta key
    onNodeSelect(node.id, multi);
  }, [onNodeSelect]);

  const handlePaneClick = useCallback(() => {
    onNodeSelect(null);
  }, [onNodeSelect]);

  // Handle edge insert node events from WorkflowEdge
  const handleEdgeInsertNode = useCallback((e: Event) => {
    const detail = (e as CustomEvent).detail;
    // This will open node select dialog — handled by editor
    window.dispatchEvent(new CustomEvent('workflow:open-node-select', { detail }));
  }, []);

  // Handle node delete events from WorkflowNode
  const handleNodeDelete = useCallback((e: Event) => {
    const detail = (e as CustomEvent).detail;
    onNodeDelete(detail.nodeId);
  }, [onNodeDelete]);

  // Register custom event listeners
  React.useEffect(() => {
    window.addEventListener('workflow:edge-insert-node', handleEdgeInsertNode);
    window.addEventListener('workflow:delete-node', handleNodeDelete);
    return () => {
      window.removeEventListener('workflow:edge-insert-node', handleEdgeInsertNode);
      window.removeEventListener('workflow:delete-node', handleNodeDelete);
    };
  }, [handleEdgeInsertNode, handleNodeDelete]);

  return (
    <div ref={reactFlowWrapper} className="flex-1 h-full">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        snapToGrid
        snapGrid={[15, 15]}
        minZoom={0.2}
        maxZoom={4}
        deleteKeyCode={isPreview ? null : ['Backspace', 'Delete']}
        nodesDraggable={!isPreview}
        nodesConnectable={!isPreview}
        defaultEdgeOptions={{ type: 'custom' }}
      >
        <Background variant={BackgroundVariant.Dots} gap={15} size={1} />
        <Controls />
        <MiniMap />
        <WorkflowHelperLines horizontal={helperHorizontal} vertical={helperVertical} />
      </ReactFlow>
    </div>
  );
}
