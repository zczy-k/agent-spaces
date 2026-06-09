import { useMemo } from 'react';
import { type Node, type Edge } from '@xyflow/react';
import type { Workflow, ExecutionLog, ExecutionStep } from '@agent-spaces/shared';
import { getNodeDefinition } from '@/lib/workflow-nodes';

interface UseCanvasDataParams {
  workflow: Pick<Workflow, 'nodes' | 'edges'>;
  selectedNodeId: string | null | undefined;
  selectedNodeIds: string[];
  selectedEdgeId: string | null;
  executionLog: ExecutionLog | null | undefined;
  isPreview: boolean;
  isCanvasLocked: boolean;
}

export function useCanvasData({
  workflow,
  selectedNodeId,
  selectedNodeIds,
  selectedEdgeId,
  executionLog,
  isPreview,
  isCanvasLocked,
}: UseCanvasDataParams) {
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

  const executionStepByNodeId = useMemo(() => {
    const steps = new Map<string, ExecutionStep>();
    for (const step of executionLog?.steps || []) {
      steps.set(step.nodeId, step);
    }
    return steps;
  }, [executionLog]);

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
          executionStep: executionStepByNodeId.get(n.id),
        } as Record<string, unknown>,
      };
    }),
    [workflow.nodes, selectedNodeIdSet, isPreview, isCanvasLocked, executionNodeIds, executionStepByNodeId],
  );

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

  return { rfNodes, rfEdges, selectedNodeIdSet, executionNodeIds, executionStepByNodeId, runningEdgeIds };
}
