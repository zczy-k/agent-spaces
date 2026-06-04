'use client';

import React, { useState, useMemo, useCallback, useRef } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { X, Play } from 'lucide-react';
import { getNodeDefinition } from '@/lib/workflow-nodes';
import { LOOP_BODY_NODE_TYPE, LOOP_BODY_SOURCE_HANDLE } from '@agent-spaces/shared';

// ---- Icon resolver ----
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  LogIn: ({ className }) => <span className={className}>▶</span>,
  LogOut: ({ className }) => <span className={className}>⏹</span>,
  Terminal: ({ className }) => <span className={className}>⌨</span>,
  Bell: ({ className }) => <span className={className}>🔔</span>,
  GitBranch: ({ className }) => <span className={className}>⎇</span>,
  Combine: ({ className }) => <span className={className}>⊞</span>,
  RotateCw: ({ className }) => <span className={className}>↻</span>,
  Container: ({ className }) => <span className={className}>☐</span>,
  Bot: ({ className }) => <span className={className}>🤖</span>,
  MessageSquare: ({ className }) => <span className={className}>💬</span>,
  TextCursorInput: ({ className }) => <span className={className}>📝</span>,
  ClipboardList: ({ className }) => <span className={className}>📋</span>,
  StickyNote: ({ className }) => <span className={className}>📌</span>,
};

const HEADER_HEIGHT = 33;
const HANDLE_MARGIN = 12;
const DEBUG_WORKFLOW_NODE = process.env.NODE_ENV !== 'production';

type WorkflowNodeData = Record<string, unknown> & {
  label?: string;
  nodeType?: string;
};

type WorkflowCustomViewProps = {
  nodeId: string;
  data: Record<string, unknown>;
};

export function WorkflowNode({ id, data, type, selected }: NodeProps) {
  const nodeData = data as WorkflowNodeData;
  const workflowNodeType = typeof nodeData.nodeType === 'string' ? nodeData.nodeType : type;
  const definition = useMemo(() => getNodeDefinition(workflowNodeType || 'unknown'), [workflowNodeType]);
  const IconComponent = ICON_MAP[definition?.icon || ''];
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
    nodeData,
  ]);

  function getHandleTop(index: number, total: number): string {
    if (isLoopBody) return `${((index + 1) / (total + 1)) * 100}%`;
    return `${HEADER_HEIGHT + HANDLE_MARGIN + ((nodeMinHeight - HEADER_HEIGHT - HANDLE_MARGIN * 2) / (total + 1)) * (index + 1)}px`;
  }

  const startEdit = useCallback(() => {
    setEditLabel(displayLabel);
    setIsEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [displayLabel]);

  const finishEdit = useCallback(() => {
    setIsEditing(false);
    // Node label update handled by store through selection
  }, []);

  // Simulated execution status (placeholder — real data from store)
  const nodeStatus = 'idle' as string;
  const statusColor = useMemo(() => {
    switch (nodeStatus) {
      case 'running': return 'border-blue-500 shadow-blue-500/30 shadow-md animate-pulse';
      case 'completed': return 'border-green-500';
      case 'error': return 'border-red-500';
      case 'skipped': return 'border-yellow-500';
      default: return 'border-border';
    }
  }, [nodeStatus]);

  // Node delete via custom event
  const handleDelete = useCallback(() => {
    window.dispatchEvent(new CustomEvent('workflow:delete-node', { detail: { nodeId: id } }));
  }, [id]);

  return (
    <>
      <div
        ref={nodeRootRef}
        className={`border-2 rounded-lg shadow-sm cursor-pointer transition-colors relative flex flex-col bg-background
          ${statusColor} ${selected ? 'ring-2 ring-primary' : ''}
          ${isLoopBody ? 'loop-body-node' : ''}`}
        style={{
          minWidth: nodeMinWidth,
          minHeight: nodeMinHeight,
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Target handle */}
        {showTargetHandle && (
          <Handle
            id="target" type="target" position={Position.Left}
            className="!z-10 !w-3 !h-3 !bg-blue-500 !border-2 !border-blue-300 handle-dot"
            style={!isLoopBody ? { top: getHandleTop(0, 1) } : undefined}
          />
        )}

        {/* Hover test button */}
        {!isBoundaryNode && isHovered && (
          <button
            className="absolute -top-2 -left-2 w-5 h-5 rounded-full bg-green-500 text-white flex items-center justify-center hover:bg-green-600 z-10"
            onClick={(e) => { e.stopPropagation(); }}
          >
            <Play className="w-3 h-3" />
          </button>
        )}

        {/* Hover delete button */}
        {!isBoundaryNode && isHovered && (
          <button
            className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/80 z-10"
            onClick={handleDelete}
          >
            <X className="w-3 h-3" />
          </button>
        )}

        {/* Header */}
        {!isLoopBody && !CustomView && (
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50">
            {IconComponent && <IconComponent className="w-4 h-4 text-muted-foreground shrink-0" />}
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
          <div className="min-h-0 flex-1 p-1">
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
        .source-handle-label { position: absolute; right: 10px; display: flex; align-items: center; pointer-events: none; transform: translateY(-50%); }
        .loop-body-node { border-color: rgba(114, 181, 197, 0.5); box-shadow: 0 10px 30px rgba(98, 156, 173, 0.14); background: linear-gradient(180deg, rgba(233, 247, 250, 0.95), rgba(246, 250, 251, 0.98)); }
      `}</style>
    </>
  );
}
