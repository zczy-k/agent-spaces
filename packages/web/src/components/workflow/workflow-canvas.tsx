'use client';

import React, { useCallback, useRef, useState, useMemo } from 'react';
import { domToJpeg, domToPng } from 'modern-screenshot';
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
import type { ExecutionLog, Workflow } from '@agent-spaces/shared';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { getNodeDefinition } from '@/lib/workflow-nodes';
import { WORKFLOW_NODE_DRAG_MIME } from './workflow-node-sidebar';
import { WorkflowNode as WorkflowNodeComponent } from './workflow-node';
import { WorkflowEdge as WorkflowEdgeComponent } from './workflow-edge';
import { WorkflowHelperLines } from './workflow-helper-lines';
import {
  Download, EyeOff, FileImage, Image, LayoutGrid, Map as MapIcon, RotateCcw, RotateCw,
} from 'lucide-react';

const nodeTypes = { custom: WorkflowNodeComponent };
const edgeTypes = { custom: WorkflowEdgeComponent };
const DEBUG_WORKFLOW_CANVAS = process.env.NODE_ENV !== 'production';

function areStringArraysEqual(a: string[], b: string[]) {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

interface WorkflowCanvasProps {
  workflow: Workflow;
  isPreview: boolean;
  isRunning?: boolean;
  executionLog?: ExecutionLog | null;
  selectedNodeId?: string | null;
  selectedNodeIds?: string[];
  onNodeAdd: (type: string, position: { x: number; y: number }) => void;
  onNodeDelete: (id: string) => void;
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

function CanvasToolbarButton({
  tooltip,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { tooltip: string }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<Button variant="ghost" size="sm" className="h-7 w-7 p-0" {...props} />}>
        {children}
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

function CanvasToolbar({
  workflow,
  isPreview,
  canUndo,
  canRedo,
  minimapVisible,
  isExporting,
  onUndo,
  onRedo,
  onExitPreview,
  onAutoLayout,
  onToggleMinimap,
  onExport,
}: {
  workflow: Workflow;
  isPreview: boolean;
  canUndo: boolean;
  canRedo: boolean;
  minimapVisible: boolean;
  isExporting: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  onExitPreview?: () => void;
  onAutoLayout?: (direction: 'LR' | 'TB') => void;
  onToggleMinimap: () => void;
  onExport: (format: 'png' | 'jpeg') => void;
}) {
  const hasNodes = workflow.nodes.length > 0;

  return (
    <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-border bg-background/90 px-2 py-1 shadow-sm backdrop-blur-sm">
      <TooltipProvider delay={400}>
        {isPreview && onExitPreview ? (
          <Tooltip>
            <TooltipTrigger render={<Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-orange-500 hover:text-orange-600" onClick={onExitPreview} />}>
              <EyeOff className="h-3.5 w-3.5" />
              <span className="text-xs">退出预览</span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">退出执行记录预览</TooltipContent>
          </Tooltip>
        ) : null}

        <CanvasToolbarButton tooltip="撤销 (Ctrl+Z)" disabled={!canUndo} onClick={onUndo}>
          <RotateCcw className="h-3.5 w-3.5" />
        </CanvasToolbarButton>
        <CanvasToolbarButton tooltip="重做 (Ctrl+Shift+Z)" disabled={!canRedo} onClick={onRedo}>
          <RotateCw className="h-3.5 w-3.5" />
        </CanvasToolbarButton>

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={!hasNodes || !onAutoLayout} />}>
            <LayoutGrid className="h-3.5 w-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" side="top">
            <DropdownMenuItem onClick={() => onAutoLayout?.('LR')}>横向布局</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAutoLayout?.('TB')}>垂直布局</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <CanvasToolbarButton
          tooltip={minimapVisible ? '隐藏小地图' : '显示小地图'}
          className={`h-7 w-7 p-0 ${minimapVisible ? 'text-blue-500' : ''}`}
          onClick={onToggleMinimap}
        >
          <MapIcon className="h-3.5 w-3.5" />
        </CanvasToolbarButton>

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={!hasNodes || isExporting} />}>
            <Download className="h-3.5 w-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" side="top">
            <DropdownMenuItem onClick={() => onExport('png')}>
              <FileImage className="mr-2 h-4 w-4" />
              导出 PNG
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onExport('jpeg')}>
              <Image className="mr-2 h-4 w-4" />
              导出 JPEG
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TooltipProvider>
    </div>
  );
}

export function WorkflowCanvas({
  workflow, isPreview, isRunning = false, executionLog, selectedNodeId,
  selectedNodeIds = [], onNodeAdd, onNodeDelete, onNodeSelect, onNodesSelect,
  onNodeDataUpdate, onNodesChange, onEdgesChange, onConnect,
  canUndo = false, canRedo = false, onUndo, onRedo, onExitPreview, onAutoLayout,
  onConnectionDrop,
}: WorkflowCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const lastCanvasDebugSignature = useRef<string | null>(null);
  const lastCanvasDomDebugSignature = useRef<string | null>(null);
  const connectSourceRef = useRef<{ nodeId: string; handleId: string | null } | null>(null);
  const connectSucceededRef = useRef(false);
  const isRangeSelectingRef = useRef(false);
  const pendingRangeSelectionRef = useRef<string[] | null>(null);
  const { fitView, getViewport, screenToFlowPosition, setViewport } = useReactFlow();
  const [helperHorizontal] = useState<number | undefined>();
  const [helperVertical] = useState<number | undefined>();
  const [minimapVisible, setMinimapVisible] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('agent-spaces:workflow-minimap-visible') !== 'false';
  });
  const [isExporting, setIsExporting] = useState(false);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const isCanvasLocked = isPreview || isRunning;
  const selectedNodeIdSet = useMemo(
    () => new Set(selectedNodeIds.length > 0 ? selectedNodeIds : selectedNodeId ? [selectedNodeId] : []),
    [selectedNodeId, selectedNodeIds],
  );

  const executionNodeIds = useMemo(() => {
    const running = new Set<string>();
    const completed = new Set<string>();
    if (!executionLog || executionLog.status !== 'running') return { running, completed };

    for (const step of executionLog.steps) {
      if (step.status === 'running') running.add(step.nodeId);
      if (step.status === 'completed') completed.add(step.nodeId);
    }

    return { running, completed };
  }, [executionLog]);

  // Convert Workflow nodes/edges to ReactFlow format
  const rfNodes: Node[] = useMemo(() =>
    workflow.nodes.map(n => {
      const definition = getNodeDefinition(n.type);
      const minWidth = definition?.customViewMinSize?.width || 140;
      const minHeight = definition?.customViewMinSize?.height || 60;
      const width = Math.max(minWidth, typeof n.data?.width === 'number' ? n.data.width : minWidth);
      const height = Math.max(minHeight, typeof n.data?.height === 'number' ? n.data.height : minHeight);
      return {
        id: n.id,
        type: 'custom',
        position: n.position,
        selected: selectedNodeIdSet.has(n.id),
        width,
        height,
        initialWidth: width,
        initialHeight: height,
        measured: { width, height },
        style: { minWidth, minHeight, width, height },
        data: {
          ...n.data,
          label: n.data?.label || n.label,
          nodeType: n.type,
          isPreview,
          isCanvasLocked,
          width,
          height,
          isRunning: executionNodeIds.running.has(n.id),
        } as Record<string, unknown>,
      };
    }),
    [workflow.nodes, selectedNodeIdSet, isPreview, isCanvasLocked, executionNodeIds],
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

  const runningEdgeIds = useMemo(() => {
    if (!executionLog || executionLog.status !== 'running') return new Set<string>();

    return new Set(
      workflow.edges
        .filter(edge => executionNodeIds.completed.has(edge.source) && executionNodeIds.running.has(edge.target))
        .map(edge => edge.id),
    );
  }, [executionLog, executionNodeIds, workflow.edges]);

  const rfEdges: Edge[] = useMemo(() =>
    workflow.edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: 'custom',
      sourceHandle: e.sourceHandle || undefined,
      targetHandle: e.targetHandle || undefined,
      selected: e.id === selectedEdgeId,
      data: {
        composite: e.composite,
        sourceHandle: e.sourceHandle,
        isRunning: runningEdgeIds.has(e.id),
        canEditEdge: !isCanvasLocked,
        canDeleteEdge: !isCanvasLocked,
      } as Record<string, unknown>,
    })),
    [workflow.edges, runningEdgeIds, selectedEdgeId, isCanvasLocked],
  );

  const handleDragOver = useCallback((event: React.DragEvent) => {
    if (isCanvasLocked) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  }, [isCanvasLocked]);

  const handleDrop = useCallback((event: React.DragEvent) => {
    if (isCanvasLocked) return;
    const type = event.dataTransfer.getData(WORKFLOW_NODE_DRAG_MIME);
    if (!type) return;

    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    onNodeAdd(type, position);
  }, [isCanvasLocked, screenToFlowPosition, onNodeAdd]);

  const handleNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    const multi = event.shiftKey || event.metaKey || event.ctrlKey;
    setSelectedEdgeId(null);
    onNodeSelect(node.id, multi);
  }, [onNodeSelect]);

  const handlePaneClick = useCallback(() => {
    setSelectedEdgeId(null);
    onNodeSelect(null);
  }, [onNodeSelect]);

  const removeEdge = useCallback((edgeId: string) => {
    const edge = workflow.edges.find(item => item.id === edgeId);
    if (!edge || edge.composite?.locked || isCanvasLocked) return;
    setSelectedEdgeId(null);
    onEdgesChange([{ id: edgeId, type: 'remove' }]);
  }, [isCanvasLocked, onEdgesChange, workflow.edges]);

  const selectEdge = useCallback((edgeId: string | null) => {
    setSelectedEdgeId(edgeId);
    if (edgeId) onNodeSelect(null);
  }, [onNodeSelect]);

  const handleEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    selectEdge(edge.id);
  }, [selectEdge]);

  const getNodeDebugSnapshot = useCallback((nodeId?: string | null) => {
    const wrapper = reactFlowWrapper.current;
    const domNodes = wrapper
      ? Array.from(wrapper.querySelectorAll<HTMLElement>('.react-flow__node'))
          .filter(element => !nodeId || element.getAttribute('data-id') === nodeId)
          .map(element => {
            const rect = element.getBoundingClientRect();
            const computedStyle = window.getComputedStyle(element);
            return {
              id: element.getAttribute('data-id'),
              rect: {
                x: Math.round(rect.x),
                y: Math.round(rect.y),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
              },
              visibility: computedStyle.visibility,
              display: computedStyle.display,
              opacity: computedStyle.opacity,
              transform: computedStyle.transform,
            };
          })
      : [];
    const flowNodes = rfNodes
      .filter(node => !nodeId || node.id === nodeId)
      .map(node => ({
        id: node.id,
        type: node.type,
        workflowType: node.data?.nodeType,
        position: node.position,
        width: node.width,
        height: node.height,
        initialWidth: node.initialWidth,
        initialHeight: node.initialHeight,
        measured: node.measured,
      }));

    return { flowNodes, domNodes };
  }, [rfNodes]);

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
        if (nextIds.length > 0) setSelectedEdgeId(null);
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
  }, [getNodeDebugSnapshot, isCanvasLocked, onNodesChange, onNodesSelect, selectedNodeIds, workflow.nodes]);

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

  const toggleMinimap = useCallback(() => {
    setMinimapVisible((current) => {
      const next = !current;
      try { localStorage.setItem('agent-spaces:workflow-minimap-visible', String(next)); } catch {}
      return next;
    });
  }, []);

  const exportCanvas = useCallback(async (format: 'png' | 'jpeg') => {
    const flowElement = reactFlowWrapper.current?.querySelector<HTMLElement>('.react-flow');
    if (!flowElement || isExporting) return;

    setIsExporting(true);
    const viewport = getViewport();
    try {
      fitView({ padding: 0.15, duration: 0 });
      await new Promise(resolve => window.setTimeout(resolve, 150));

      const name = (workflow.name || 'workflow').replace(/[^\w\u4e00-\u9fa5-]+/g, '-');
      const dataUrl = format === 'jpeg'
        ? await domToJpeg(flowElement, { quality: 0.95, backgroundColor: '#ffffff', scale: 2 })
        : await domToPng(flowElement, { backgroundColor: null, scale: 2 });

      const link = document.createElement('a');
      link.download = `${name}-${Date.now()}.${format}`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('[WorkflowCanvas] export failed', error);
    } finally {
      void setViewport(viewport);
      setIsExporting(false);
    }
  }, [fitView, getViewport, isExporting, setViewport, workflow.name]);

  // Handle edge insert node events from WorkflowEdge
  const handleEdgeInsertNode = useCallback((e: Event) => {
    if (isCanvasLocked) return;
    const detail = (e as CustomEvent).detail;
    // This will open node select dialog — handled by editor
    window.dispatchEvent(new CustomEvent('workflow:open-node-select', { detail }));
  }, [isCanvasLocked]);

  const handleEdgeSelect = useCallback((e: Event) => {
    const detail = (e as CustomEvent).detail as { edgeId?: string | null } | undefined;
    selectEdge(detail?.edgeId ?? null);
  }, [selectEdge]);

  const handleEdgeDelete = useCallback((e: Event) => {
    const detail = (e as CustomEvent).detail as { edgeId?: string | null } | undefined;
    if (!detail?.edgeId) return;
    removeEdge(detail.edgeId);
  }, [removeEdge]);

  // Handle node delete events from WorkflowNode
  const handleNodeDelete = useCallback((e: Event) => {
    if (isCanvasLocked) return;
    const detail = (e as CustomEvent).detail;
    onNodeDelete(detail.nodeId);
  }, [isCanvasLocked, onNodeDelete]);

  const handleNodeDataUpdate = useCallback((e: Event) => {
    if (isCanvasLocked) return;
    const detail = (e as CustomEvent).detail;
    if (!detail?.nodeId || !detail?.data) return;
    onNodeDataUpdate(detail.nodeId, detail.data);
  }, [isCanvasLocked, onNodeDataUpdate]);

  // Register custom event listeners
  React.useEffect(() => {
    window.addEventListener('workflow:edge-insert-node', handleEdgeInsertNode);
    window.addEventListener('workflow:select-edge', handleEdgeSelect);
    window.addEventListener('workflow:delete-edge', handleEdgeDelete);
    window.addEventListener('workflow:delete-node', handleNodeDelete);
    window.addEventListener('workflow:update-node-data', handleNodeDataUpdate);
    return () => {
      window.removeEventListener('workflow:edge-insert-node', handleEdgeInsertNode);
      window.removeEventListener('workflow:select-edge', handleEdgeSelect);
      window.removeEventListener('workflow:delete-edge', handleEdgeDelete);
      window.removeEventListener('workflow:delete-node', handleNodeDelete);
      window.removeEventListener('workflow:update-node-data', handleNodeDataUpdate);
    };
  }, [handleEdgeDelete, handleEdgeInsertNode, handleEdgeSelect, handleNodeDelete, handleNodeDataUpdate]);

  React.useEffect(() => {
    if (isCanvasLocked || !selectedEdgeId) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Delete' && event.key !== 'Backspace') return;

      const target = event.target;
      if (
        target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || target instanceof HTMLSelectElement
        || (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      removeEdge(selectedEdgeId);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isCanvasLocked, removeEdge, selectedEdgeId]);

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
