'use client';

import React, { useCallback, useRef, useState, useMemo } from 'react';
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
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { Workflow } from '@agent-spaces/shared';
import { getNodeDefinition } from '@/lib/workflow-nodes';
import { WORKFLOW_NODE_DRAG_MIME } from './workflow-node-sidebar';
import { WorkflowNode as WorkflowNodeComponent } from './workflow-node';
import { WorkflowEdge as WorkflowEdgeComponent } from './workflow-edge';
import { WorkflowHelperLines } from './workflow-helper-lines';

const nodeTypes = { custom: WorkflowNodeComponent };
const edgeTypes = { custom: WorkflowEdgeComponent };
const DEBUG_WORKFLOW_CANVAS = process.env.NODE_ENV !== 'production';

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
  const lastCanvasDebugSignature = useRef<string | null>(null);
  const lastCanvasDomDebugSignature = useRef<string | null>(null);
  const { screenToFlowPosition } = useReactFlow();
  const [helperHorizontal] = useState<number | undefined>();
  const [helperVertical] = useState<number | undefined>();

  // Convert Workflow nodes/edges to ReactFlow format
  const rfNodes: Node[] = useMemo(() =>
    workflow.nodes.map(n => {
      const definition = getNodeDefinition(n.type);
      const minWidth = definition?.customViewMinSize?.width || 140;
      const minHeight = definition?.customViewMinSize?.height || 60;
      return {
        id: n.id,
        type: 'custom',
        position: n.position,
        width: minWidth,
        height: minHeight,
        initialWidth: minWidth,
        initialHeight: minHeight,
        measured: { width: minWidth, height: minHeight },
        style: { minWidth, minHeight },
        data: {
          ...n.data,
          label: n.label,
          nodeType: n.type,
          width: minWidth,
          height: minHeight,
        } as Record<string, unknown>,
      };
    }),
    [workflow.nodes],
  );

  React.useEffect(() => {
    if (!DEBUG_WORKFLOW_CANVAS) return;

    const wrapperRect = reactFlowWrapper.current?.getBoundingClientRect();
    const rawNodes = workflow.nodes.map(n => ({
      id: n.id,
      type: n.type,
      label: n.label,
      position: n.position,
      dataKeys: Object.keys(n.data || {}),
    }));
    const mappedNodes = rfNodes.map(node => ({
      id: node.id,
      reactFlowType: node.type,
      workflowType: node.data?.nodeType,
      label: node.data?.label,
      position: node.position,
      style: node.style,
      hasDefinition: !!getNodeDefinition(String(node.data?.nodeType || '')),
    }));

    const wrapperSize = wrapperRect
      ? { width: Math.round(wrapperRect.width), height: Math.round(wrapperRect.height) }
      : null;
    const debugSignature = JSON.stringify({
      workflowId: workflow.id,
      rawNodeCount: workflow.nodes.length,
      edgeCount: workflow.edges.length,
      wrapperSize,
      rawNodes,
      mappedNodes,
    });

    if (lastCanvasDebugSignature.current === debugSignature) return;
    lastCanvasDebugSignature.current = debugSignature;

    console.debug('[WorkflowCanvas] input changed', {
      workflowId: workflow.id,
      workflowName: workflow.name,
      rawNodeCount: workflow.nodes.length,
      edgeCount: workflow.edges.length,
      wrapperSize,
      rawNodes,
      mappedNodes,
    });

    if (workflow.nodes.length > 0 && wrapperRect && (wrapperRect.width === 0 || wrapperRect.height === 0)) {
      console.warn('[WorkflowCanvas] wrapper has zero size while workflow has nodes', {
        workflowId: workflow.id,
        wrapperSize: { width: wrapperRect.width, height: wrapperRect.height },
      });
    }

    for (const node of mappedNodes) {
      if (!node.hasDefinition) {
        console.warn('[WorkflowCanvas] node definition missing after mapping', node);
      }
    }

    const frame = window.requestAnimationFrame(() => {
      const wrapper = reactFlowWrapper.current;
      if (!wrapper) return;

      const reactFlowNodes = Array.from(wrapper.querySelectorAll<HTMLElement>('.react-flow__node'));
      const domNodes = reactFlowNodes.map(element => {
        const rect = element.getBoundingClientRect();
        const computedStyle = window.getComputedStyle(element);
        return {
          id: element.getAttribute('data-id'),
          className: element.className,
          rect: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          },
          transform: computedStyle.transform,
          display: computedStyle.display,
          visibility: computedStyle.visibility,
          opacity: computedStyle.opacity,
          pointerEvents: computedStyle.pointerEvents,
        };
      });
      const viewport = wrapper.querySelector<HTMLElement>('.react-flow__viewport');
      const viewportStyle = viewport ? window.getComputedStyle(viewport) : null;
      const domSignature = JSON.stringify({
        workflowId: workflow.id,
        expectedNodeCount: workflow.nodes.length,
        renderedNodeCount: reactFlowNodes.length,
        viewportTransform: viewportStyle?.transform,
        domNodes,
      });

      if (lastCanvasDomDebugSignature.current === domSignature) return;
      lastCanvasDomDebugSignature.current = domSignature;

      console.debug('[WorkflowCanvas] DOM snapshot', {
        workflowId: workflow.id,
        expectedNodeCount: workflow.nodes.length,
        renderedNodeCount: reactFlowNodes.length,
        viewportTransform: viewportStyle?.transform,
        viewportDisplay: viewportStyle?.display,
        domNodes,
      });

      if (workflow.nodes.length > 0 && reactFlowNodes.length === 0) {
        console.warn('[WorkflowCanvas] React Flow rendered zero DOM nodes', {
          workflowId: workflow.id,
          expectedNodeCount: workflow.nodes.length,
        });
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [workflow.id, workflow.name, workflow.nodes, workflow.edges.length, rfNodes]);

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
    <div ref={reactFlowWrapper} className="flex-1 h-full w-full">
      <ReactFlow
        className="h-full w-full"
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
