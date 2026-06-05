'use client';

import { BaseEdge, EdgeLabelRenderer, getBezierPath } from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';
import { LOOP_BODY_SOURCE_HANDLE } from '@agent-spaces/shared';

export function WorkflowEdge({
  id, source, target,
  sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  data, selected,
}: EdgeProps) {
  const isLocked = !!(data as Record<string, unknown>)?.composite && ((data as Record<string, unknown>).composite as Record<string, unknown>)?.locked;
  const isGenerated = !!(data as Record<string, unknown>)?.composite && ((data as Record<string, unknown>).composite as Record<string, unknown>)?.generated;
  const edgeSourceHandle = (data as Record<string, unknown>)?.sourceHandle as string | undefined ?? null;
  const isLoopBodyEdge = edgeSourceHandle === LOOP_BODY_SOURCE_HANDLE;
  const isRunning = (data as Record<string, unknown>)?.isRunning === true;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition,
  });

  return (
    <>
      <path d={edgePath} fill="none" stroke="transparent" strokeWidth={16} style={{ cursor: 'pointer' }} />
      <BaseEdge
        id={id} path={edgePath}
        style={{
          stroke: isLocked ? 'rgba(74, 144, 164, 0.9)' : 'var(--primary)',
          strokeWidth: isGenerated ? 2 : 2.5,
          strokeDasharray: isLocked && !isLoopBodyEdge ? '4 2' : 'none',
          transition: 'stroke-dasharray 0.3s ease',
        }}
      />
      {isRunning && (
        <circle r="5" fill="var(--primary)" style={{ pointerEvents: 'none' }}>
          <animateMotion dur="1.4s" repeatCount="indefinite" path={edgePath} />
        </circle>
      )}
      {!isLocked && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            <button
              className={`w-5 h-5 rounded-full border border-border bg-background text-muted-foreground
                flex items-center justify-center text-xs font-bold leading-none
                opacity-0 group-hover:opacity-100 transition-all
                hover:opacity-100 hover:border-primary hover:text-primary hover:bg-primary/10
                hover:w-6 hover:h-6 hover:scale-110
                cursor-pointer shadow-sm ${selected ? 'opacity-100' : 'opacity-0 hover:opacity-100'}`}
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                window.dispatchEvent(new CustomEvent('workflow:edge-insert-node', {
                  detail: { edgeId: id, source, target, sourceHandle: edgeSourceHandle },
                }));
              }}
            >
              +
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
