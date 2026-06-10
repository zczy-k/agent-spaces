'use client';

import React, { useCallback } from 'react';
import type { WorkflowCustomViewProps } from './workflow-node-types';

type LoopBodyDragEventDetail = {
  nodeId: string;
  phase: 'start' | 'move' | 'end' | 'cancel';
  screenDelta: { x: number; y: number };
};

function dispatchLoopBodyDrag(detail: LoopBodyDragEventDetail) {
  window.dispatchEvent(new CustomEvent('workflow:loop-body-drag', { detail }));
}

export function LoopBodyView({ nodeId, data }: WorkflowCustomViewProps) {
  const outputLabel = typeof data.outputLabel === 'string' ? data.outputLabel : '';

  const handleHeaderPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const isLocked = data.isPreview === true || data.isCanvasLocked === true;
    if (isLocked) return;

    event.preventDefault();
    event.stopPropagation();

    const pointerId = event.pointerId;
    const element = event.currentTarget;
    const start = { x: event.clientX, y: event.clientY };
    let frameId: number | null = null;
    let pendingScreenDelta = { x: 0, y: 0 };
    dispatchLoopBodyDrag({ nodeId, phase: 'start', screenDelta: { x: 0, y: 0 } });
    element.setPointerCapture(pointerId);

    const flushPreview = () => {
      frameId = null;
      dispatchLoopBodyDrag({ nodeId, phase: 'move', screenDelta: pendingScreenDelta });
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      pendingScreenDelta = {
        x: moveEvent.clientX - start.x,
        y: moveEvent.clientY - start.y,
      };
      if (frameId === null) {
        frameId = requestAnimationFrame(flushPreview);
      }
    };

    const finishDrag = (phase: 'end' | 'cancel') => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
      dispatchLoopBodyDrag({ nodeId, phase, screenDelta: pendingScreenDelta });
      if (element.hasPointerCapture(pointerId)) {
        element.releasePointerCapture(pointerId);
      }
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
      document.removeEventListener('pointercancel', handlePointerCancel);
    };

    const handlePointerUp = () => finishDrag('end');
    const handlePointerCancel = () => finishDrag('cancel');

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
    document.addEventListener('pointercancel', handlePointerCancel);
  }, [data.isCanvasLocked, data.isPreview, nodeId]);

  return (
    <div
      className="flex h-full min-h-[220px] w-full flex-col rounded-lg"
    >
      <div
        className="pointer-events-auto flex cursor-grab select-none items-center justify-between gap-3 rounded-t-md border-b border-cyan-700/15 bg-white/65 px-3 py-2 backdrop-blur-sm active:cursor-grabbing dark:bg-slate-950/35"
        onPointerDown={handleHeaderPointerDown}
      >
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[13px] font-semibold text-cyan-900 dark:text-cyan-100">循环体</span>
        </div>
        {outputLabel ? (
          <span className="shrink-0 text-[11px] text-cyan-900/85 dark:text-cyan-100/80">
            输出: {outputLabel}
          </span>
        ) : null}
      </div>
    </div>
  );
}
