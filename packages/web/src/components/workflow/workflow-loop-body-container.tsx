'use client';

import React, { useMemo } from 'react';
import { LOOP_BODY_NODE_TYPE, LOOP_NODE_TYPE, LOOP_BODY_SOURCE_HANDLE } from '@agent-spaces/shared';
import type { WorkflowNode, WorkflowEdge } from '@agent-spaces/shared';

/**
 * LoopBodyContainer — visual container for loop body nodes.
 * Not a React component rendered by @xyflow/react directly.
 * Instead, it's a CSS overlay that highlights the loop body area.
 *
 * Usage: the editor renders this as a positioned div overlaying the canvas,
 * behind nodes but above the background.
 */

interface LoopBodyBounds {
  loopNodeId: string;
  loopBodyNodeId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

function computeLoopBounds(
  loopNode: WorkflowNode,
  loopBodyNode: WorkflowNode,
  allNodes: WorkflowNode[],
  allEdges: WorkflowEdge[],
): LoopBodyBounds | null {
  // Find all nodes inside the loop body
  const innerNodeIds = new Set<string>();
  innerNodeIds.add(loopBodyNode.id);

  // Walk edges from loop body to find all downstream nodes until we hit the next node after loop
  const visited = new Set<string>();
  const queue = [loopBodyNode.id];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    for (const edge of allEdges) {
      if (edge.source === currentId && edge.sourceHandle !== LOOP_BODY_SOURCE_HANDLE) {
        // Skip the "完成后" edge from the loop node itself
        if (edge.source === loopNode.id && edge.sourceHandle !== LOOP_BODY_SOURCE_HANDLE) continue;
        if (!innerNodeIds.has(edge.target)) {
          innerNodeIds.add(edge.target);
          queue.push(edge.target);
        }
      }
    }
  }

  // Compute bounding box
  const innerNodes = allNodes.filter(n => innerNodeIds.has(n.id));
  if (innerNodes.length === 0) return null;

  const padding = 40;
  const topPadding = 80; // Extra space above loop body for header
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const node of innerNodes) {
    minX = Math.min(minX, node.position.x - padding);
    minY = Math.min(minY, node.position.y - topPadding);
    maxX = Math.max(maxX, node.position.x + 200 + padding);
    maxY = Math.max(maxY, node.position.y + 100 + padding);
  }

  return {
    loopNodeId: loopNode.id,
    loopBodyNodeId: loopBodyNode.id,
    x: minX,
    y: minY,
    width: Math.max(300, maxX - minX),
    height: Math.max(200, maxY - minY),
  };
}

interface LoopBodyOverlayProps {
  bounds: LoopBodyBounds;
  loopNode: WorkflowNode;
  iterationCount?: number;
  isExecuting?: boolean;
  currentIteration?: number;
}

export function WorkflowLoopBodyOverlay({
  bounds, loopNode, iterationCount, isExecuting, currentIteration,
}: LoopBodyOverlayProps) {
  const data = loopNode.data || {};
  const loopType = data.loopType as string || 'count';
  const count = data.count as number || 0;
  const concurrency = data.concurrency as number || 1;

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: bounds.x,
        top: bounds.y,
        width: bounds.width,
        height: bounds.height,
        zIndex: -1,
      }}
    >
      {/* Background */}
      <div
        className={`absolute inset-0 rounded-xl border-2 border-dashed transition-colors ${
          isExecuting
            ? 'border-blue-400/50 bg-blue-50/30 dark:bg-blue-950/10'
            : 'border-sky-300/40 bg-sky-50/20 dark:bg-sky-950/5'
        }`}
        style={{ borderRadius: 12 }}
      />

      {/* Header */}
      <div className="absolute top-2 left-3 flex items-center gap-2 pointer-events-auto">
        <span className="text-[10px] font-medium text-sky-600 dark:text-sky-400 bg-sky-100/80 dark:bg-sky-900/30 px-1.5 py-0.5 rounded">
          🔄 循环体
        </span>
        <span className="text-[9px] text-muted-foreground">
          {loopType === 'count' ? `${count} 次` :
           loopType === 'array' ? '数组遍历' :
           '无限循环'}
        </span>
        {concurrency > 1 && (
          <span className="text-[9px] text-muted-foreground">
            并发: {concurrency}
          </span>
        )}
        {isExecuting && currentIteration !== undefined && (
          <span className="text-[9px] text-blue-600 dark:text-blue-400 font-medium">
            #{currentIteration + 1}
          </span>
        )}
      </div>
    </div>
  );
}

// ---- Hook: compute all loop body bounds ----

export function useLoopBodyBounds(nodes: WorkflowNode[], edges: WorkflowEdge[]): LoopBodyBounds[] {
  return useMemo(() => {
    const bounds: LoopBodyBounds[] = [];

    // Find all loop nodes and their corresponding loop body nodes
    const loopNodes = nodes.filter(n => n.type === LOOP_NODE_TYPE);
    const loopBodyNodes = new Map(nodes.filter(n => n.type === LOOP_BODY_NODE_TYPE).map(n => [n.id, n]));

    for (const loopNode of loopNodes) {
      // Find the edge from loop → loop_body
      const bodyEdge = edges.find(e =>
        e.source === loopNode.id && e.sourceHandle === LOOP_BODY_SOURCE_HANDLE
      );
      if (!bodyEdge) continue;

      const bodyNode = loopBodyNodes.get(bodyEdge.target);
      if (!bodyNode) continue;

      const b = computeLoopBounds(loopNode, bodyNode, nodes, edges);
      if (b) bounds.push(b);
    }

    return bounds;
  }, [nodes, edges]);
}
