'use client';

import React, { useState, useMemo, useCallback, useRef, useSyncExternalStore } from 'react';
import { Handle, NodeResizer, Position, useUpdateNodeInternals } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import {
  AlertCircle,
  Archive,
  ArchiveRestore,
  CheckCircle,
  CircleCheck,
  CircleSlash,
  ClipboardCopy,
  Copy,
  FileText,
  Flag,
  FlagOff,
  Info,
  Loader2,
  Palette,
  Play,
  Settings,
  SkipForward,
  Square,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { getPluginNodesVersion, subscribePluginNodesVersion, useLocalizedNodeDefinition } from '@/lib/workflow-nodes';
import {
  LOOP_BODY_NODE_TYPE,
  LOOP_BODY_SOURCE_HANDLE,
  type ExecutionStep,
  type NodeBreakpoint,
  type NodeRunState,
  type OutputField,
} from '@agent-spaces/shared';
import { BorderGlide } from '@/components/ui/border-glide';
import { NodeMediaPreview, type MediaItem } from '@/components/ui/media-gallery';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  HoverCard, HoverCardContent, HoverCardTrigger,
} from '@/components/ui/hover-card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { JsonViewer } from '@/components/viewers/json-viewer';
import { cn } from '@/lib/utils';
import { WorkflowNodeDefinitionIcon } from './workflow-node-icon';
import { getWorkflowNodeSize } from './workflow-node-size';

const HEADER_HEIGHT = 33;
const HANDLE_MARGIN = 12;
const DEBUG_WORKFLOW_NODE = process.env.NODE_ENV !== 'production';

type WorkflowNodeData = Record<string, unknown> & {
  label?: string;
  nodeType?: string;
  width?: number;
  height?: number;
  isPreview?: boolean;
  isCanvasLocked?: boolean;
  isRunning?: boolean;
  nodeState?: NodeRunState;
  breakpoint?: NodeBreakpoint;
  nodeColor?: string;
  execStatus?: string;
  debugNodeId?: string | null;
  debugStatus?: 'idle' | 'running' | 'completed' | 'error';
  pausedNodeId?: string | null;
  pausedReason?: string | null;
  partialExecutionStartNodeId?: string | null;
  isFirstConnectedNode?: boolean;
  executionStep?: ExecutionStep;
};

type WorkflowCustomViewProps = {
  nodeId: string;
  data: Record<string, unknown>;
};

type PluginNodeDefinitionMeta = {
  pluginId?: string;
  pluginIconPath?: string;
};

const NODE_COLORS: Array<{ label: string; value: string | null; className: string; borderClassName: string }> = [
  { label: '默认', value: null, className: 'bg-background border border-border', borderClassName: 'border-border' },
  { label: '翡翠绿', value: 'emerald', className: 'bg-emerald-500', borderClassName: 'border-emerald-500' },
  { label: '蓝色', value: 'blue', className: 'bg-blue-500', borderClassName: 'border-blue-500' },
  { label: '紫色', value: 'violet', className: 'bg-violet-500', borderClassName: 'border-violet-500' },
  { label: '玫红', value: 'rose', className: 'bg-rose-500', borderClassName: 'border-rose-500' },
  { label: '橙色', value: 'orange', className: 'bg-orange-500', borderClassName: 'border-orange-500' },
  { label: '琥珀', value: 'amber', className: 'bg-amber-500', borderClassName: 'border-amber-500' },
  { label: '青色', value: 'cyan', className: 'bg-cyan-500', borderClassName: 'border-cyan-500' },
  { label: '粉色', value: 'pink', className: 'bg-pink-500', borderClassName: 'border-pink-500' },
  { label: '石板灰', value: 'slate', className: 'bg-slate-500', borderClassName: 'border-slate-500' },
  { label: '红色', value: 'red', className: 'bg-red-500', borderClassName: 'border-red-500' },
  { label: '靛蓝', value: 'indigo', className: 'bg-indigo-500', borderClassName: 'border-indigo-500' },
];

const NODE_COLOR_MAP: Record<string, string> = {
  emerald: '#10b981',
  blue: '#3b82f6',
  violet: '#8b5cf6',
  rose: '#f43f5e',
  orange: '#f97316',
  amber: '#f59e0b',
  cyan: '#06b6d4',
  pink: '#ec4899',
  slate: '#64748b',
  red: '#ef4444',
  indigo: '#6366f1',
};

function formatDuration(start: number, end?: number): string {
  const ms = Math.max(0, (end || Date.now()) - start);
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function PlainValue({ value, empty }: { value: unknown; empty: string }) {
  if (value === undefined || value === null || value === '') {
    return <div className="text-[10px] text-muted-foreground">{empty}</div>;
  }
  if (typeof value === 'object') {
    return (
      <JsonViewer
        data={value as Parameters<typeof JsonViewer>[0]['data']}
        className="max-h-36 overflow-auto rounded-md border border-border bg-background text-[10px] shadow-none"
        defaultExpanded={2}
      />
    );
  }
  return (
    <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted/50 p-2 text-[10px]">
      {String(value)}
    </pre>
  );
}

function ExecutionResultHoverCard({ step, visible }: { step: ExecutionStep; visible: boolean }) {
  const isError = step.status === 'error';
  const hasLogs = (step.logs || []).length > 0;

  return (
    <HoverCard openDelay={100} closeDelay={150}>
      <HoverCardTrigger
        render={(
          <button
            type="button"
            className={cn(
              'nodrag nopan absolute -bottom-2 -right-2 z-30 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-opacity hover:bg-muted hover:text-foreground',
              visible ? 'opacity-100' : 'opacity-0',
              isError && 'text-destructive hover:text-destructive',
            )}
            onClick={(event) => event.stopPropagation()}
            aria-label="查看执行结果"
            title="查看执行结果"
          />
        )}
      >
        {isError ? <XCircle className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
      </HoverCardTrigger>
      <HoverCardContent
        side="bottom"
        sideOffset={8}
        align="end"
        className="nodrag nopan w-80 gap-0 overflow-hidden p-0"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          {isError ? (
            <XCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />
          ) : (
            <CheckCircle className="h-3.5 w-3.5 shrink-0 text-green-500" />
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium">执行结果</div>
            <div className="text-[10px] text-muted-foreground">
              {step.status}{step.finishedAt ? ` · ${formatDuration(step.startedAt, step.finishedAt)}` : ''}
            </div>
          </div>
        </div>

        <ScrollArea className="max-h-[420px]">
          <div className="space-y-3 p-3">
            {step.error ? (
              <div className="flex gap-1.5 rounded-md bg-destructive/10 p-2 text-[10px] text-destructive">
                <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                <span className="break-all">{step.error}</span>
              </div>
            ) : null}

            <section className="space-y-1.5">
              <div className="text-[10px] font-medium text-muted-foreground">输出</div>
              <PlainValue value={step.output} empty="无输出" />
            </section>

            <section className="space-y-1.5">
              <div className="text-[10px] font-medium text-muted-foreground">日志</div>
              {hasLogs ? (
                <div className="space-y-1">
                  {step.logs!.map((entry, index) => (
                    <div
                      key={`${entry.timestamp}-${index}`}
                      className={cn(
                        'rounded px-2 py-1 text-[10px]',
                        entry.level === 'error' && 'bg-destructive/10 text-destructive',
                        entry.level === 'warning' && 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-300',
                        entry.level === 'info' && 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
                      )}
                    >
                      <span className="font-medium">{entry.level}</span>
                      <span className="ml-1 break-all">{entry.message}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[10px] text-muted-foreground">无日志</div>
              )}
            </section>

            <section className="space-y-1.5">
              <div className="text-[10px] font-medium text-muted-foreground">输入</div>
              <PlainValue value={step.input} empty="无输入" />
            </section>
          </div>
        </ScrollArea>
      </HoverCardContent>
    </HoverCard>
  );
}

export function WorkflowNode({ id, data, type, selected }: NodeProps) {
  const nodeData = data as WorkflowNodeData;
  const workflowNodeType = typeof nodeData.nodeType === 'string' ? nodeData.nodeType : type;
  const updateNodeInternals = useUpdateNodeInternals();
  useSyncExternalStore(
    subscribePluginNodesVersion,
    getPluginNodesVersion,
    getPluginNodesVersion,
  );
  const definition = useLocalizedNodeDefinition(workflowNodeType || 'unknown');
  const pluginMeta = definition as (typeof definition & PluginNodeDefinitionMeta);
  const iconDefinition = definition ? { ...definition, ...pluginMeta } : null;
  const CustomView = definition?.customView as React.ComponentType<WorkflowCustomViewProps> | undefined;

  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editLabel, setEditLabel] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const nodeRootRef = useRef<HTMLDivElement>(null);
  const lastNodeDebugSignature = useRef<string | null>(null);

  const displayLabel = useMemo(
    () => nodeData.label || definition?.label || workflowNodeType || '',
    [nodeData.label, definition, workflowNodeType],
  );

  const isBoundaryNode = definition?.type === 'start' || definition?.type === 'end';
  const isLoopBody = definition?.type === LOOP_BODY_NODE_TYPE;
  const isCanvasLocked = nodeData.isPreview || nodeData.isCanvasLocked;

  React.useEffect(() => {
    if (isCanvasLocked) setIsEditing(false);
  }, [isCanvasLocked]);

  const showTargetHandle = definition?.handles?.target !== false;
  const showSourceHandle = definition?.handles?.source !== false;
  const staticSourceHandles = definition?.handles?.sourceHandles || [];

  // Dynamic handles for switch node
  const dynamicSource = definition?.handles?.dynamicSource;
  const dynamicHandles = useMemo(() => {
    if (!dynamicSource) return null;
    const conditions = (data as Record<string, unknown>)?.[dynamicSource.dataKey];
    const arr: unknown[] = Array.isArray(conditions) ? conditions : [];
    const extra = dynamicSource.extraCount || 0;
    const total = arr.length + extra;
    if (total === 0) return null;
    return Array.from({ length: total }, (_, i) => ({
      id: i < arr.length ? `case-${i}` : 'default',
      label: i < arr.length ? `条件 ${i + 1}` : '默认',
      index: i,
      total,
    }));
  }, [dynamicSource, data]);

  const nodeSize = useMemo(
    () => getWorkflowNodeSize(definition, nodeData),
    [definition, nodeData],
  );
  const {
    minWidth: nodeMinWidth,
    minHeight: nodeMinHeight,
    width: nodeWidth,
    height: nodeHeight,
    sourceHandleCount,
  } = nodeSize;

  React.useEffect(() => {
    updateNodeInternals(id);
  }, [id, updateNodeInternals, sourceHandleCount, showTargetHandle, showSourceHandle, nodeHeight]);

  React.useEffect(() => {
    if (!DEBUG_WORKFLOW_NODE) return;

    const dataKeys = Object.keys(nodeData || {}).sort();
    const rootRect = nodeRootRef.current?.getBoundingClientRect();
    const rootStyle = nodeRootRef.current ? window.getComputedStyle(nodeRootRef.current) : null;
    const flowNodeElement = nodeRootRef.current?.closest<HTMLElement>('.react-flow__node');
    const flowNodeRect = flowNodeElement?.getBoundingClientRect();
    const flowNodeStyle = flowNodeElement ? window.getComputedStyle(flowNodeElement) : null;
    const debugPayload = {
      id,
      reactFlowType: type,
      workflowNodeType,
      label: displayLabel,
      hasDefinition: !!definition,
      definitionType: definition?.type,
      showTargetHandle,
      showSourceHandle,
      staticSourceHandleCount: staticSourceHandles.length,
      dynamicSourceHandleCount: dynamicHandles?.length || 0,
      minWidth: nodeMinWidth,
      minHeight: nodeMinHeight,
      width: nodeWidth,
      height: nodeHeight,
      dataKeys,
      rootRect: rootRect
        ? {
            x: Math.round(rootRect.x),
            y: Math.round(rootRect.y),
            width: Math.round(rootRect.width),
            height: Math.round(rootRect.height),
          }
        : null,
      rootDisplay: rootStyle?.display,
      rootVisibility: rootStyle?.visibility,
      rootOpacity: rootStyle?.opacity,
      flowNodeRect: flowNodeRect
        ? {
            x: Math.round(flowNodeRect.x),
            y: Math.round(flowNodeRect.y),
            width: Math.round(flowNodeRect.width),
            height: Math.round(flowNodeRect.height),
          }
        : null,
      flowNodeTransform: flowNodeStyle?.transform,
      flowNodeDisplay: flowNodeStyle?.display,
      flowNodeVisibility: flowNodeStyle?.visibility,
      flowNodeOpacity: flowNodeStyle?.opacity,
    };
    const debugSignature = JSON.stringify(debugPayload);

    if (lastNodeDebugSignature.current === debugSignature) return;
    lastNodeDebugSignature.current = debugSignature;

    console.debug('[WorkflowNode] input changed', debugPayload);

    if (!definition) {
      console.warn('[WorkflowNode] definition missing', debugPayload);
    }
  }, [
    id,
    type,
    workflowNodeType,
    displayLabel,
    definition,
    showTargetHandle,
    showSourceHandle,
    staticSourceHandles.length,
    dynamicHandles?.length,
    nodeMinWidth,
    nodeMinHeight,
    nodeWidth,
    nodeHeight,
    nodeData,
  ]);

  function getHandleTop(index: number, total: number): string {
    if (isLoopBody) return `${((index + 1) / (total + 1)) * 100}%`;
    return `${HEADER_HEIGHT + HANDLE_MARGIN + ((nodeHeight - HEADER_HEIGHT - HANDLE_MARGIN * 2) / (total + 1)) * (index + 1)}px`;
  }

  const startEdit = useCallback(() => {
    if (isCanvasLocked) return;
    setEditLabel(displayLabel);
    setIsEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [displayLabel, isCanvasLocked]);

  const finishEdit = useCallback(() => {
    setIsEditing(false);
    if (!isCanvasLocked && editLabel && editLabel !== displayLabel) {
      window.dispatchEvent(new CustomEvent('workflow:update-node-data', {
        detail: { nodeId: id, data: { label: editLabel } },
      }));
    }
  }, [editLabel, displayLabel, id, isCanvasLocked]);

  // Execution status is injected by WorkflowCanvas from the current execution log.
  const executionStep = nodeData.executionStep;
  const nodeStatus = nodeData.isRunning ? 'running' : executionStep?.status || 'idle';
  const currentNodeState = nodeData.nodeState || 'normal';
  const currentBreakpoint = nodeData.breakpoint || null;
  const isCurrentNodeDebugging = nodeData.debugNodeId === id && nodeData.debugStatus === 'running';
  const isExecutionBusy = nodeData.execStatus === 'running' || nodeData.execStatus === 'paused';
  const isPartialTesting = nodeData.execStatus === 'running' && nodeData.partialExecutionStartNodeId === id;
  const isPausedAtThisNode = nodeData.execStatus === 'paused'
    && nodeData.pausedNodeId === id
    && (
      nodeData.pausedReason === 'breakpoint-start'
      || nodeData.pausedReason === 'breakpoint-end'
      || !!currentBreakpoint
    );
  const hasExecutionResult = !!executionStep
    && (executionStep.status === 'completed' || executionStep.status === 'error');

  const stateBadge = currentNodeState === 'disabled'
    ? '已禁'
    : currentNodeState === 'skipped' ? '已跳' : '';
  const breakpointBadge = currentBreakpoint === 'start'
    ? '开始断点'
    : currentBreakpoint === 'end' ? '结束断点' : '';
  const nodeColorStyle = nodeData.nodeColor && NODE_COLOR_MAP[nodeData.nodeColor]
    ? { backgroundColor: `${NODE_COLOR_MAP[nodeData.nodeColor]}1a` }
    : undefined;
  const stateBackgroundClass = currentNodeState === 'disabled'
    ? 'bg-red-500/10'
    : currentNodeState === 'skipped' ? 'bg-yellow-500/10' : 'bg-background';

  // Extract media items from execution output based on output field definitions
  const mediaItems = useMemo(() => {
    if (!executionStep || executionStep.status !== 'completed' || !executionStep.output) return []
    const outputs = Array.isArray(nodeData.outputs) ? nodeData.outputs as OutputField[] : []
    if (outputs.length === 0) return []

    const output = executionStep.output as Record<string, unknown> | undefined
    if (!output || typeof output !== 'object') return []

    const items: MediaItem[] = []

    const extractMedia = (fields: OutputField[], parent: Record<string, unknown>) => {
      for (const field of fields) {
        const val = parent[field.key]
        if (val == null) continue

        if (field.type === 'image') {
          const src = typeof val === 'string' ? val : ''
          if (src) items.push({ src, type: 'image', alt: field.key })
        } else if (field.type === 'image[]') {
          const urls = Array.isArray(val) ? val : []
          for (const u of urls) {
            if (typeof u === 'string' && u) items.push({ src: u, type: 'image', alt: field.key })
          }
        } else if (field.type === 'audio') {
          const src = typeof val === 'string' ? val : ''
          if (src) items.push({ src, type: 'video', alt: field.key })
        } else if (field.type === 'video') {
          const src = typeof val === 'string' ? val : ''
          if (src) items.push({ src, type: 'video', alt: field.key })
        } else if (field.type === 'object' && field.children && val && typeof val === 'object') {
          extractMedia(field.children, val as Record<string, unknown>)
        }
      }
    }

    extractMedia(outputs, output)
    return items
  }, [executionStep, nodeData.outputs])

  const statusColor = isPausedAtThisNode
    ? 'border-blue-600 ring-2 ring-blue-500 shadow-blue-500/40 shadow-md animate-pulse'
    : nodeStatus === 'running'
    ? 'border-blue-500 shadow-blue-500/30 shadow-md'
    : nodeStatus === 'completed'
      ? 'border-green-500/70 shadow-green-500/15 shadow-sm'
      : nodeStatus === 'error'
        ? 'border-destructive/70 shadow-destructive/15 shadow-sm'
        : nodeStatus === 'skipped'
          ? 'border-yellow-500'
    : NODE_COLORS.find(color => color.value === nodeData.nodeColor)?.borderClassName || 'border-border';

  const dispatchNodeUpdate = useCallback((updates: Record<string, unknown>) => {
    if (isCanvasLocked) return;
    window.dispatchEvent(new CustomEvent('workflow:update-node-data', {
      detail: { nodeId: id, data: updates },
    }));
  }, [id, isCanvasLocked]);

  // Node delete via custom event
  const handleDelete = useCallback(() => {
    if (isCanvasLocked) return;
    window.dispatchEvent(new CustomEvent('workflow:delete-node', { detail: { nodeId: id } }));
  }, [id, isCanvasLocked]);

  const handleCopy = useCallback(() => {
    if (isCanvasLocked) return;
    window.dispatchEvent(new CustomEvent('workflow:copy-node', { detail: { nodeId: id } }));
  }, [id, isCanvasLocked]);

  const handleClone = useCallback(() => {
    if (isCanvasLocked) return;
    window.dispatchEvent(new CustomEvent('workflow:clone-node', { detail: { nodeId: id } }));
  }, [id, isCanvasLocked]);

  const handleStage = useCallback(() => {
    if (isCanvasLocked) return;
    window.dispatchEvent(new CustomEvent('workflow:stage-node', { detail: { nodeId: id } }));
  }, [id, isCanvasLocked]);

  const handleMoveToStage = useCallback(() => {
    if (isCanvasLocked) return;
    window.dispatchEvent(new CustomEvent('workflow:stage-node', { detail: { nodeId: id } }));
    window.dispatchEvent(new CustomEvent('workflow:delete-node', { detail: { nodeId: id } }));
  }, [id, isCanvasLocked]);

  const handleShowInfo = useCallback(() => {
    window.dispatchEvent(new CustomEvent('workflow:show-node-info', { detail: { nodeId: id } }));
  }, [id]);

  const handleTestNode = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    if (isCurrentNodeDebugging) {
      window.dispatchEvent(new CustomEvent('workflow:cancel-debug-node', { detail: { nodeId: id } }));
      return;
    }
    if (isCanvasLocked || isBoundaryNode) return;
    window.dispatchEvent(new CustomEvent('workflow:debug-node', { detail: { nodeId: id } }));
  }, [id, isBoundaryNode, isCanvasLocked, isCurrentNodeDebugging]);

  const handlePartialTest = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    if (isCanvasLocked || isBoundaryNode || isExecutionBusy) return;
    window.dispatchEvent(new CustomEvent('workflow:execute-from-node', { detail: { nodeId: id } }));
  }, [id, isBoundaryNode, isCanvasLocked, isExecutionBusy]);

  const handleResumeFromBreakpoint = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    window.dispatchEvent(new CustomEvent('workflow:resume-execution', { detail: { nodeId: id } }));
  }, [id]);

  const handleStopAtBreakpoint = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    window.dispatchEvent(new CustomEvent('workflow:stop-execution', { detail: { nodeId: id } }));
  }, [id]);

  const setNodeColor = useCallback((color: string | null) => {
    dispatchNodeUpdate({ nodeColor: color });
  }, [dispatchNodeUpdate]);

  const setNodeState = useCallback((state: NodeRunState) => {
    dispatchNodeUpdate({ nodeState: state });
  }, [dispatchNodeUpdate]);

  const setNodeBreakpoint = useCallback((breakpoint: NodeBreakpoint | null) => {
    dispatchNodeUpdate({ breakpoint });
  }, [dispatchNodeUpdate]);

  const handleResizeEnd = useCallback((_: unknown, params: { width: number; height: number }) => {
    if (isCanvasLocked) return;
    const width = Math.max(nodeMinWidth, Math.round(params.width));
    const height = Math.max(nodeMinHeight, Math.round(params.height));
    window.dispatchEvent(new CustomEvent('workflow:update-node-data', {
      detail: { nodeId: id, data: { width, height } },
    }));
  }, [id, isCanvasLocked, nodeMinHeight, nodeMinWidth]);

  const showContextMenu = !isBoundaryNode && !isCanvasLocked;
  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    if (showContextMenu) return;
    event.preventDefault();
    event.stopPropagation();
  }, [showContextMenu]);

  return (
    <>
      <NodeResizer
        isVisible={selected && !isCanvasLocked}
        minWidth={nodeMinWidth}
        minHeight={nodeMinHeight}
        onResizeEnd={handleResizeEnd}
        handleClassName="workflow-node-resize-handle"
        lineClassName="workflow-node-resize-line"
      />
      <ContextMenu key={showContextMenu ? 'context-menu-enabled' : 'context-menu-disabled'}>
        <ContextMenuTrigger
          className="block"
          style={{ width: nodeWidth, height: nodeHeight }}
        >
          <div
            ref={nodeRootRef}
            className={`border-2 rounded-lg shadow-sm cursor-pointer transition-colors relative flex flex-col
              ${statusColor} ${selected ? 'ring-2 ring-primary ring-offset-2 ring-offset-background shadow-md' : ''}
              ${stateBackgroundClass} ${isLoopBody ? 'loop-body-node' : ''}`}
            style={{
              minWidth: nodeMinWidth,
              minHeight: nodeMinHeight,
              width: nodeWidth,
              height: nodeHeight,
              ...nodeColorStyle,
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onContextMenu={handleContextMenu}
          >
        {nodeData.isRunning && (
          <BorderGlide
            className="absolute inset-0 z-20 rounded-lg pointer-events-none"
            duration={2200}
            color="#3b82f6"
            width="1.75rem"
            height="1.75rem"
            opacity={0.75}
            rx="0.5rem"
            ry="0.5rem"
          >
            <div className="h-full w-full" />
          </BorderGlide>
        )}

        {/* Target handle */}
        {showTargetHandle && (
          <Handle
            id="target" type="target" position={Position.Left}
            className="!z-10 !w-3 !h-3 !bg-blue-500 !border-2 !border-blue-300 handle-dot"
            style={!isLoopBody ? { top: getHandleTop(0, 1) } : undefined}
          />
        )}

        {/* Hover test button */}
        {!isBoundaryNode && !isCanvasLocked && isHovered && (
          <button
            className="absolute -top-2 -left-2 w-5 h-5 rounded-full bg-green-500 text-white flex items-center justify-center hover:bg-green-600 z-10"
            onClick={handleTestNode}
            title={isCurrentNodeDebugging ? '取消测试' : '测试节点'}
          >
            {isCurrentNodeDebugging ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
          </button>
        )}

        {/* Hover delete button */}
        {!isBoundaryNode && !isCanvasLocked && isHovered && (
          <button
            className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/80 z-10"
            onClick={handleDelete}
          >
            <X className="w-3 h-3" />
          </button>
        )}

        {stateBadge ? (
          <span
            className={cn(
              'absolute -top-2 left-1/2 z-10 -translate-x-1/2 rounded-full px-1.5 py-0 text-[10px] font-medium text-white',
              currentNodeState === 'disabled' ? 'bg-red-500' : 'bg-yellow-500',
            )}
          >
            {stateBadge}
          </span>
        ) : null}

        {breakpointBadge ? (
          <span
            className={cn(
              'absolute -bottom-2 left-2 z-10 inline-flex items-center gap-1 rounded-full px-1.5 py-0 text-[10px] font-medium text-white',
              currentBreakpoint === 'start' ? 'bg-blue-500' : 'bg-purple-500',
            )}
          >
            <Flag className="h-2.5 w-2.5" />
            {breakpointBadge}
          </span>
        ) : null}

        {hasExecutionResult && executionStep ? (
          <ExecutionResultHoverCard step={executionStep} visible={isHovered || selected} />
        ) : null}

        {isPausedAtThisNode ? (
          <div className="nodrag nopan absolute left-2 right-2 -bottom-10 z-40 flex items-center gap-1 rounded border border-blue-500/40 bg-background/95 p-1 shadow-lg">
            <button
              type="button"
              className="inline-flex h-6 flex-1 items-center justify-center gap-1 rounded bg-blue-500 px-2 text-[10px] font-medium text-white hover:bg-blue-600"
              onClick={handleResumeFromBreakpoint}
            >
              <Play className="h-3 w-3" />
              继续运行
            </button>
            <button
              type="button"
              className="inline-flex h-6 flex-1 items-center justify-center gap-1 rounded bg-destructive px-2 text-[10px] font-medium text-destructive-foreground hover:bg-destructive/90"
              onClick={handleStopAtBreakpoint}
            >
              <Square className="h-3 w-3" />
              中断
            </button>
          </div>
        ) : null}

        {/* Header */}
        {!isLoopBody && !CustomView && (
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50">
            <WorkflowNodeDefinitionIcon definition={iconDefinition} className="h-4 w-4 shrink-0 text-muted-foreground" />
            {isEditing ? (
              <input
                ref={inputRef}
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                onBlur={finishEdit}
                onKeyDown={(e) => { if (e.key === 'Enter') finishEdit(); }}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 text-xs bg-transparent outline-none border-b border-primary min-w-0"
                autoFocus
              />
            ) : (
              <div
                className={cn(
                  'text-xs truncate hover:bg-muted/50 rounded px-1 py-0.5 min-w-0 flex-1',
                  currentNodeState === 'disabled' && 'opacity-50 line-through',
                )}
                onDoubleClick={(e) => { e.stopPropagation(); startEdit(); }}
              >
                {displayLabel}
              </div>
            )}
            {nodeData.isFirstConnectedNode && !isBoundaryNode && !nodeData.isPreview ? (
              <button
                type="button"
                className="nodrag nopan shrink-0 inline-flex items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isExecutionBusy}
                title="局部测试"
                onClick={handlePartialTest}
              >
                {isPartialTesting ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Play className="h-2.5 w-2.5" />}
                局部测试
              </button>
            ) : null}
          </div>
        )}

        {CustomView ? (
          <div className="absolute inset-0 overflow-hidden rounded-lg">
            <CustomView nodeId={id} data={nodeData} />
          </div>
        ) : null}

        {/* Media preview for executed nodes */}
        {!CustomView && mediaItems.length > 0 && (
          <div className="border-t border-border/50">
            <NodeMediaPreview items={mediaItems} />
          </div>
        )}

        {/* Source handles (static) */}
        {showSourceHandle && !dynamicHandles && (
          staticSourceHandles.length === 0 ? (
            <Handle
              id="source" type="source" position={Position.Right}

              className="!z-10 !w-3 !h-3 !bg-emerald-500 !border-2 !border-emerald-300 handle-dot"
              style={!isLoopBody ? { top: getHandleTop(0, 1) } : undefined}
            />
          ) : (
            <>
              {staticSourceHandles.map((h, index) => (
                <React.Fragment key={h.id}>
                  <div
                    className="source-handle-label"
                    style={{ top: getHandleTop(index, staticSourceHandles.length) }}
                  >
                    <span className="text-[9px] text-muted-foreground mr-1 whitespace-nowrap">{h.label || h.id}</span>
                  </div>
                  <Handle
                    id={h.id} type="source" position={Position.Right}
      
                    className={`!z-10 !w-2.5 !h-2.5 handle-dot ${h.id === LOOP_BODY_SOURCE_HANDLE ? '!bg-blue-500 !border-blue-300' : '!bg-emerald-500 !border-emerald-300'}`}
                    style={{ top: getHandleTop(index, staticSourceHandles.length), borderWidth: '2px' }}
                  />
                </React.Fragment>
              ))}
            </>
          )
        )}

        {/* Dynamic source handles (switch) */}
        {dynamicHandles && (
          <>
            {dynamicHandles.map(h => (
              <React.Fragment key={h.id}>
                <div
                  className="source-handle-label"
                  style={{ top: getHandleTop(h.index, h.total) }}
                >
                  <span className="text-[9px] text-muted-foreground mr-1 whitespace-nowrap">{h.label}</span>
                </div>
                <Handle
                  id={h.id} type="source" position={Position.Right}
    
                  className={`!z-10 !w-2.5 !h-2.5 handle-dot ${h.id === 'default' ? '!bg-orange-500 !border-orange-300' : '!bg-emerald-500 !border-emerald-300'}`}
                  style={{ top: getHandleTop(h.index, h.total), borderWidth: '2px' }}
                />
              </React.Fragment>
            ))}
          </>
        )}
      </div>
      </ContextMenuTrigger>
      {showContextMenu && (
        <ContextMenuContent className="w-48">
          <ContextMenuSub>
            <ContextMenuSubTrigger className="text-xs gap-2">
              <Palette className="h-3 w-3" />
              节点颜色
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-40">
              {NODE_COLORS.map(color => (
                <ContextMenuItem
                  key={color.value ?? 'default'}
                  className="text-xs gap-2"
                  onClick={() => setNodeColor(color.value)}
                >
                  <span className={cn('h-3.5 w-3.5 shrink-0 rounded-sm', color.className)} />
                  {color.label}
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuSub>
            <ContextMenuSubTrigger className="text-xs gap-2">
              <Settings className="h-3 w-3" />
              节点状态
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-44">
              <ContextMenuItem className="text-xs gap-2" onClick={() => setNodeState('normal')}>
                <CircleCheck className="h-3 w-3 text-green-500" />
                正常
              </ContextMenuItem>
              <ContextMenuItem className="text-xs gap-2" onClick={() => setNodeState('disabled')}>
                <CircleSlash className="h-3 w-3 text-red-500" />
                禁用（中止执行）
              </ContextMenuItem>
              <ContextMenuItem className="text-xs gap-2" onClick={() => setNodeState('skipped')}>
                <SkipForward className="h-3 w-3 text-yellow-500" />
                跳过（跳过执行）
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuSub>
            <ContextMenuSubTrigger className="text-xs gap-2">
              <Flag className="h-3 w-3" />
              断点设置
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-44">
              <ContextMenuItem className="text-xs gap-2" onClick={() => setNodeBreakpoint('start')}>
                <Flag className="h-3 w-3 text-blue-500" />
                设置开始断点
              </ContextMenuItem>
              <ContextMenuItem className="text-xs gap-2" onClick={() => setNodeBreakpoint('end')}>
                <Flag className="h-3 w-3 text-purple-500" />
                设置结束断点
              </ContextMenuItem>
              <ContextMenuItem className="text-xs gap-2" onClick={() => setNodeBreakpoint(null)}>
                <FlagOff className="h-3 w-3 text-muted-foreground" />
                取消断点
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuSeparator />
          <ContextMenuItem className="text-xs gap-2" onClick={handleShowInfo}>
            <Info className="h-3 w-3" />
            查看节点信息
          </ContextMenuItem>
          <ContextMenuItem className="text-xs gap-2" onClick={handleCopy}>
            <Copy className="h-3 w-3" />
            复制节点
          </ContextMenuItem>
          <ContextMenuItem className="text-xs gap-2" onClick={handleClone}>
            <ClipboardCopy className="h-3 w-3" />
            克隆节点
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem className="text-xs gap-2" onClick={handleStage}>
            <Archive className="h-3 w-3" />
            复制到暂存
          </ContextMenuItem>
          <ContextMenuItem className="text-xs gap-2" onClick={handleMoveToStage}>
            <ArchiveRestore className="h-3 w-3" />
            移动到暂存
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem className="text-xs gap-2" variant="destructive" onClick={handleDelete}>
            <Trash2 className="h-3 w-3" />
            删除节点
          </ContextMenuItem>
        </ContextMenuContent>
      )}
      </ContextMenu>

      <style>{`
        .handle-dot { transition: scale 0.2s ease, box-shadow 0.2s ease; }
        .handle-dot:hover { scale: 1.6; box-shadow: 0 0 6px currentColor; }
        .workflow-node-resize-line { border-color: var(--primary); }
        .workflow-node-resize-handle {
          width: 14px;
          height: 14px;
          border: 2px solid var(--primary);
          border-radius: 4px;
          background: var(--background);
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.18);
        }
        .source-handle-label { position: absolute; right: 10px; display: flex; align-items: center; pointer-events: none; transform: translateY(-50%); }
        .loop-body-node { border-color: rgba(114, 181, 197, 0.5); box-shadow: 0 10px 30px rgba(98, 156, 173, 0.14); background: linear-gradient(180deg, rgba(233, 247, 250, 0.95), rgba(246, 250, 251, 0.98)); }
      `}</style>
    </>
  );
}
