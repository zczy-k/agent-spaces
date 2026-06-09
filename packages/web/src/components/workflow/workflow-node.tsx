'use client';

import React, { useState, useMemo, useCallback, useRef, useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { Handle, NodeResizer, Position, useUpdateNodeInternals } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import {
  Flag,
  Loader2,
  Play,
  Square,
  X,
} from 'lucide-react';
import { getPluginNodesVersion, subscribePluginNodesVersion, useLocalizedNodeDefinition } from '@/lib/workflow-nodes';
import {
  LOOP_BODY_NODE_TYPE,
  LOOP_BODY_SOURCE_HANDLE,
  type NodeBreakpoint,
  type NodeRunState,
  type OutputField,
} from '@agent-spaces/shared';
import { BorderGlide } from '@/components/ui/border-glide';
import { NodeMediaPreview, type MediaItem } from '@/components/ui/media-gallery';
import { cn } from '@/lib/utils';
import { WorkflowNodeDefinitionIcon } from './workflow-node-icon';
import { getWorkflowNodeSize } from './workflow-node-size';
import {
  HEADER_HEIGHT,
  HANDLE_MARGIN,
  NODE_COLORS,
  NODE_COLOR_MAP,
  type HandlePositionMode,
  type WorkflowNodeData,
  type WorkflowCustomViewProps,
  type PluginNodeDefinitionMeta,
} from './workflow-node-types';
import { ExecutionResultHoverCard } from './workflow-node-execution-result';
import { WorkflowNodeContextMenu } from './workflow-node-context-menu';

const DEBUG_WORKFLOW_NODE = process.env.NODE_ENV !== 'production';
const HANDLE_POSITION_MAP: Record<HandlePositionMode, { target: Position; source: Position }> = {
  'top-bottom': { target: Position.Top, source: Position.Bottom },
  'left-right': { target: Position.Left, source: Position.Right },
  'bottom-top': { target: Position.Bottom, source: Position.Top },
  'right-left': { target: Position.Right, source: Position.Left },
};

export function WorkflowNode({ id, data, type, selected }: NodeProps) {
  const nodeData = data as WorkflowNodeData;
  const t = useTranslations('workflows');
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
  const handlePositionMode = nodeData.handlePosition || 'left-right';
  const handlePositions = HANDLE_POSITION_MAP[handlePositionMode] || HANDLE_POSITION_MAP['left-right'];

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
      label: i < arr.length ? t('nodeUi.condition', { index: i + 1 }) : t('nodeUi.conditionDefault'),
      index: i,
      total,
    }));
  }, [dynamicSource, data, t]);

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
  }, [id, updateNodeInternals, sourceHandleCount, showTargetHandle, showSourceHandle, nodeHeight, handlePositions.target, handlePositions.source]);

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

  function getHandleOffset(index: number, total: number): string {
    return `${((index + 1) / (total + 1)) * 100}%`;
  }

  function getHandleStyle(position: Position, index: number, total: number): React.CSSProperties | undefined {
    if (isLoopBody) return { top: getHandleTop(index, total) };
    if (position === Position.Left || position === Position.Right) {
      return { top: getHandleTop(index, total) };
    }
    return { left: getHandleOffset(index, total) };
  }

  function getSourceLabelStyle(index: number, total: number): React.CSSProperties {
    const offset = getHandleOffset(index, total);
    if (handlePositions.source === Position.Left) {
      return { top: getHandleTop(index, total), left: 10, transform: 'translateY(-50%)' };
    }
    if (handlePositions.source === Position.Top) {
      return { left: offset, top: -16, transform: 'translateX(-50%)' };
    }
    if (handlePositions.source === Position.Bottom) {
      return { left: offset, bottom: -16, transform: 'translateX(-50%)' };
    }
    return { top: getHandleTop(index, total), right: 10, transform: 'translateY(-50%)' };
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
    ? t('nodeUi.stateBadge.disabled')
    : currentNodeState === 'skipped' ? t('nodeUi.stateBadge.skipped') : '';
  const breakpointBadge = currentBreakpoint === 'start'
    ? t('nodeUi.breakpointBadge.start')
    : currentBreakpoint === 'end' ? t('nodeUi.breakpointBadge.end') : '';
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

  const nodeBody = (
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
          id="target" type="target" position={handlePositions.target}
          className="!z-10 !w-3 !h-3 !bg-blue-500 !border-2 !border-blue-300 handle-dot"
          style={getHandleStyle(handlePositions.target, 0, 1)}
        />
      )}
      {/* Hover test button */}
      {!isBoundaryNode && !isCanvasLocked && isHovered && (
        <button
          className="absolute -top-2 -left-2 w-5 h-5 rounded-full bg-green-500 text-white flex items-center justify-center hover:bg-green-600 z-10"
          onClick={handleTestNode}
          title={isCurrentNodeDebugging ? t('nodeUi.test.cancel') : t('nodeUi.test.node')}
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
            {t('nodeUi.resume')}
          </button>
          <button
            type="button"
            className="inline-flex h-6 flex-1 items-center justify-center gap-1 rounded bg-destructive px-2 text-[10px] font-medium text-destructive-foreground hover:bg-destructive/90"
            onClick={handleStopAtBreakpoint}
          >
            <Square className="h-3 w-3" />
            {t('nodeUi.abort')}
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
              title={t('nodeUi.test.partial')}
              onClick={handlePartialTest}
            >
              {isPartialTesting ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Play className="h-2.5 w-2.5" />}
              {t('nodeUi.test.partial')}
            </button>
          ) : null}
        </div>
      )}

      {CustomView ? (
        <div className={cn(
          'absolute inset-0 overflow-hidden rounded-lg',
          isLoopBody && 'pointer-events-none',
        )}>
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
            id="source" type="source" position={handlePositions.source}

            className="!z-10 !w-3 !h-3 !bg-emerald-500 !border-2 !border-emerald-300 handle-dot"
            style={getHandleStyle(handlePositions.source, 0, 1)}
          />
        ) : (
          <>
            {staticSourceHandles.map((h, index) => (
              <React.Fragment key={h.id}>
                <div
                  className="source-handle-label"
                  style={getSourceLabelStyle(index, staticSourceHandles.length)}
                >
                  <span className="text-[9px] text-muted-foreground mr-1 whitespace-nowrap">{h.label || h.id}</span>
                </div>
                <Handle
                  id={h.id} type="source" position={handlePositions.source}

                  className={`!z-10 !w-2.5 !h-2.5 handle-dot ${h.id === LOOP_BODY_SOURCE_HANDLE ? '!bg-blue-500 !border-blue-300' : '!bg-emerald-500 !border-emerald-300'}`}
                  style={{ ...getHandleStyle(handlePositions.source, index, staticSourceHandles.length), borderWidth: '2px' }}
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
                style={getSourceLabelStyle(h.index, h.total)}
              >
                <span className="text-[9px] text-muted-foreground mr-1 whitespace-nowrap">{h.label}</span>
              </div>
              <Handle
                id={h.id} type="source" position={handlePositions.source}

                className={`!z-10 !w-2.5 !h-2.5 handle-dot ${h.id === 'default' ? '!bg-orange-500 !border-orange-300' : '!bg-emerald-500 !border-emerald-300'}`}
                style={{ ...getHandleStyle(handlePositions.source, h.index, h.total), borderWidth: '2px' }}
              />
            </React.Fragment>
          ))}
        </>
      )}
    </div>
  );

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
      <WorkflowNodeContextMenu
        nodeId={id}
        isBoundaryNode={isBoundaryNode}
        isCanvasLocked={!!isCanvasLocked}
        style={{ width: nodeWidth, height: nodeHeight }}
        onSetColor={setNodeColor}
        onSetState={setNodeState}
        onSetBreakpoint={setNodeBreakpoint}
        onShowInfo={handleShowInfo}
        onCopy={handleCopy}
        onClone={handleClone}
        onStage={handleStage}
        onMoveToStage={handleMoveToStage}
        onDelete={handleDelete}
      >
        {nodeBody}
      </WorkflowNodeContextMenu>

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
        .source-handle-label { position: absolute; display: flex; align-items: center; pointer-events: none; }
        .loop-body-node { border-color: rgba(114, 181, 197, 0.5); box-shadow: 0 10px 30px rgba(98, 156, 173, 0.14); background: linear-gradient(180deg, rgba(233, 247, 250, 0.95), rgba(246, 250, 251, 0.98)); }
      `}</style>
    </>
  );
}
