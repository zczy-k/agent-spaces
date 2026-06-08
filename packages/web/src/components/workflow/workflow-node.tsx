'use client';

import React, { useState, useMemo, useCallback, useRef, useSyncExternalStore } from 'react';
import { Handle, NodeResizer, Position, useUpdateNodeInternals } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { AlertCircle, CheckCircle, FileText, Play, X, XCircle } from 'lucide-react';
import { getNodeDefinition, getPluginNodesVersion, subscribePluginNodesVersion } from '@/lib/workflow-nodes';
import { LOOP_BODY_NODE_TYPE, LOOP_BODY_SOURCE_HANDLE, type ExecutionStep } from '@agent-spaces/shared';
import { BorderGlide } from '@/components/ui/border-glide';
import {
  HoverCard, HoverCardContent, HoverCardTrigger,
} from '@/components/ui/hover-card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { JsonViewer } from '@/components/viewers/json-viewer';
import { cn } from '@/lib/utils';
import { WorkflowNodeDefinitionIcon } from './workflow-node-icon';

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
  const definition = getNodeDefinition(workflowNodeType || 'unknown');
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

  const sourceHandleCount = dynamicHandles?.length
    || staticSourceHandles.length
    || (showSourceHandle ? 1 : 0);

  const nodeMinHeight = useMemo(() => {
    const base = definition?.customViewMinSize?.height || 60;
    if (isLoopBody || sourceHandleCount <= 1) return base;
    return Math.max(base, HEADER_HEIGHT + sourceHandleCount * 24 + 16);
  }, [definition, isLoopBody, sourceHandleCount]);
  const nodeMinWidth = definition?.customViewMinSize?.width || 140;
  const nodeWidth = Math.max(
    nodeMinWidth,
    typeof nodeData.width === 'number' ? nodeData.width : nodeMinWidth,
  );
  const nodeHeight = Math.max(
    nodeMinHeight,
    typeof nodeData.height === 'number' ? nodeData.height : nodeMinHeight,
  );

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
  const hasPreviewExecutionResult = !!nodeData.isPreview
    && !!executionStep
    && (executionStep.status === 'completed' || executionStep.status === 'error');
  const statusColor = nodeStatus === 'running'
    ? 'border-blue-500 shadow-blue-500/30 shadow-md'
    : nodeStatus === 'completed'
      ? 'border-green-500/70 shadow-green-500/15 shadow-sm'
      : nodeStatus === 'error'
        ? 'border-destructive/70 shadow-destructive/15 shadow-sm'
    : 'border-border';

  // Node delete via custom event
  const handleDelete = useCallback(() => {
    if (isCanvasLocked) return;
    window.dispatchEvent(new CustomEvent('workflow:delete-node', { detail: { nodeId: id } }));
  }, [id, isCanvasLocked]);

  const handleResizeEnd = useCallback((_: unknown, params: { width: number; height: number }) => {
    if (isCanvasLocked) return;
    const width = Math.max(nodeMinWidth, Math.round(params.width));
    const height = Math.max(nodeMinHeight, Math.round(params.height));
    window.dispatchEvent(new CustomEvent('workflow:update-node-data', {
      detail: { nodeId: id, data: { width, height } },
    }));
  }, [id, isCanvasLocked, nodeMinHeight, nodeMinWidth]);

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
      <div
        ref={nodeRootRef}
        className={`border-2 rounded-lg shadow-sm cursor-pointer transition-colors relative flex flex-col bg-background
          ${statusColor} ${selected ? 'ring-2 ring-primary ring-offset-2 ring-offset-background shadow-md' : ''}
          ${isLoopBody ? 'loop-body-node' : ''}`}
        style={{
          minWidth: nodeMinWidth,
          minHeight: nodeMinHeight,
          width: '100%',
          height: '100%',
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
            id="target" type="target" position={Position.Left}
            className="!z-10 !w-3 !h-3 !bg-blue-500 !border-2 !border-blue-300 handle-dot"
            style={!isLoopBody ? { top: getHandleTop(0, 1) } : undefined}
          />
        )}

        {/* Hover test button */}
        {!isBoundaryNode && !isCanvasLocked && isHovered && (
          <button
            className="absolute -top-2 -left-2 w-5 h-5 rounded-full bg-green-500 text-white flex items-center justify-center hover:bg-green-600 z-10"
            onClick={(e) => { e.stopPropagation(); }}
          >
            <Play className="w-3 h-3" />
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

        {hasPreviewExecutionResult && executionStep ? (
          <ExecutionResultHoverCard step={executionStep} visible={isHovered || selected} />
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
                className="text-xs truncate hover:bg-muted/50 rounded px-1 py-0.5 min-w-0 flex-1"
                onDoubleClick={(e) => { e.stopPropagation(); startEdit(); }}
              >
                {displayLabel}
              </div>
            )}
          </div>
        )}

        {CustomView ? (
          <div className="absolute inset-0 overflow-hidden rounded-lg">
            <CustomView nodeId={id} data={nodeData} />
          </div>
        ) : null}

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

      <style>{`
        .handle-dot { transition: scale 0.2s ease, box-shadow 0.2s ease; }
        .handle-dot:hover { scale: 1.6; box-shadow: 0 0 6px currentColor; }
        .workflow-node-resize-line { border-color: var(--primary); }
        .workflow-node-resize-handle { width: 8px; height: 8px; border: 1px solid var(--primary); background: var(--background); }
        .source-handle-label { position: absolute; right: 10px; display: flex; align-items: center; pointer-events: none; transform: translateY(-50%); }
        .loop-body-node { border-color: rgba(114, 181, 197, 0.5); box-shadow: 0 10px 30px rgba(98, 156, 173, 0.14); background: linear-gradient(180deg, rgba(233, 247, 250, 0.95), rgba(246, 250, 251, 0.98)); }
      `}</style>
    </>
  );
}
