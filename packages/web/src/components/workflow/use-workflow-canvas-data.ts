import { useMemo } from 'react';
import { type Node, type Edge } from '@xyflow/react';
import {
  isHiddenWorkflowEdge,
  isHiddenWorkflowNode,
  isScopeBoundaryWorkflowNode,
  getCompositeParentId,
  LOOP_BODY_NODE_TYPE,
  type Workflow,
  type ExecutionLog,
  type ExecutionStep,
} from '@agent-spaces/shared';
import { getNodeDefinition } from '@/lib/workflow-nodes';
import { getWorkflowNodeSize } from './workflow-node-size';
import { NODE_COLOR_MAP, type HandlePositionMode, type WorkflowLogPanelLayout } from './workflow-node-types';

const DEFAULT_SOURCE_HANDLE_ID = 'source';
const LOOP_BODY_NODE_Z_INDEX = -100;
const DEFAULT_NODE_Z_INDEX = 1;
const SCOPED_CHILD_NODE_Z_INDEX = 1000;
const ACTIVE_NODE_Z_INDEX = 2000;

function getSourceHandleColor(nodeData: Record<string, unknown>, sourceHandle: string | null | undefined): string | undefined {
  const handleColors = nodeData.handleColors;
  if (!handleColors || typeof handleColors !== 'object') return undefined;
  const handleId = sourceHandle || DEFAULT_SOURCE_HANDLE_ID;
  const colorKey = (handleColors as Record<string, unknown>)[handleId];
  return typeof colorKey === 'string' ? NODE_COLOR_MAP[colorKey] : undefined;
}

interface UseCanvasDataParams {
  workflow: Pick<Workflow, 'nodes' | 'edges'>;
  selectedNodeId: string | null | undefined;
  selectedNodeIds: string[];
  selectedEdgeId: string | null;
  executionLog: ExecutionLog | null | undefined;
  isPreview: boolean;
  isCanvasLocked: boolean;
  execStatus?: string;
  debugNodeId?: string | null;
  debugStatus?: 'idle' | 'running' | 'completed' | 'error';
  pausedNodeId?: string | null;
  pausedReason?: string | null;
  partialExecutionStartNodeId?: string | null;
  handlePosition?: HandlePositionMode;
  floatingHandles?: boolean;
  logPanelLayout?: WorkflowLogPanelLayout;
  edgePathType?: string;
  edgeLineStyle?: string;
}

export function useCanvasData({
  workflow,
  selectedNodeId,
  selectedNodeIds,
  selectedEdgeId,
  executionLog,
  isPreview,
  isCanvasLocked,
  execStatus = 'idle',
  debugNodeId = null,
  debugStatus = 'idle',
  pausedNodeId = null,
  pausedReason = null,
  partialExecutionStartNodeId = null,
  handlePosition = 'left-right',
  floatingHandles = false,
  logPanelLayout = 'vertical',
  edgePathType = 'bezier',
  edgeLineStyle = 'solid',
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
    workflow.nodes.filter(n => !isHiddenWorkflowNode(n)).map(n => {
      const definition = getNodeDefinition(n.type);
      const { minWidth, minHeight, width, height } = getWorkflowNodeSize(definition, n.data);
      const hasIncoming = workflow.edges.some(edge => edge.target === n.id);
      const hasOutgoing = workflow.edges.some(edge => edge.source === n.id);
      const parentId = getCompositeParentId(n);
      const isLoopBody = n.type === LOOP_BODY_NODE_TYPE;
      const isScopedChild = !!parentId && !isScopeBoundaryWorkflowNode(n);
      const hasCustomView = !!definition?.customView;
      const isSelected = selectedNodeIdSet.has(n.id);
      const baseZIndex = isLoopBody
        ? LOOP_BODY_NODE_Z_INDEX
        : isScopedChild ? SCOPED_CHILD_NODE_Z_INDEX : DEFAULT_NODE_Z_INDEX;
      const zIndex = isSelected ? ACTIVE_NODE_Z_INDEX : baseZIndex;
      return {
        id: n.id,
        type: 'custom',
        position: n.position,
        dragHandle: hasCustomView ? '.workflow-node-drag-handle' : undefined,
        selected: isSelected,
        zIndex,
        width,
        height,
        initialWidth: width,
        initialHeight: height,
        measured: { width, height },
        style: { minWidth, minHeight, width, height, zIndex },
        data: {
          ...n.data,
          label: n.data?.label || n.label,
          nodeType: n.type,
          selectedNodeIds,
          nodeState: n.nodeState,
          breakpoint: n.breakpoint,
          nodeColor: n.nodeColor,
          isPreview,
          isCanvasLocked,
          width,
          height,
          isRunning: executionNodeIds.running.has(n.id),
          execStatus,
          debugNodeId,
          debugStatus,
          pausedNodeId,
          pausedReason,
          partialExecutionStartNodeId,
          handlePosition,
          floatingHandles,
          logPanelLayout,
          isFirstConnectedNode: hasOutgoing && !hasIncoming,
          executionStep: executionStepByNodeId.get(n.id),
        } as Record<string, unknown>,
      };
    }),
    [workflow.nodes, workflow.edges, selectedNodeIdSet, selectedNodeIds, isPreview, isCanvasLocked, executionNodeIds, execStatus, debugNodeId, debugStatus, pausedNodeId, pausedReason, partialExecutionStartNodeId, handlePosition, floatingHandles, logPanelLayout, executionStepByNodeId],
  );

  const runningEdgeIds = useMemo(() => {
    if (!executionLog || executionLog.status !== 'running') return new Set<string>();

    return new Set(
      workflow.edges
        .filter(edge => executionNodeIds.completed.has(edge.source) && executionNodeIds.running.has(edge.target))
        .map(edge => edge.id),
    );
  }, [executionLog, executionNodeIds, workflow.edges]);

  const rfEdges: Edge[] = useMemo(() => {
    const nodeById = new Map(workflow.nodes.map(node => [node.id, node]));
    return workflow.edges.filter(edge => !isHiddenWorkflowEdge(edge)).map(e => {
      const sourceNode = nodeById.get(e.source);
      return {
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
          startLabel: e.startLabel,
          middleLabel: e.middleLabel,
          endLabel: e.endLabel,
          edgeColor: sourceNode ? getSourceHandleColor(sourceNode.data, e.sourceHandle) : undefined,
          isRunning: runningEdgeIds.has(e.id),
          canEditEdge: !isCanvasLocked,
          canDeleteEdge: !isCanvasLocked,
          edgePathType,
          edgeOwnLineStyle: e.edgeLineStyle,
          edgeLineStyle: e.edgeLineStyle || edgeLineStyle,
        } as Record<string, unknown>,
      };
    });
  }, [workflow.edges, workflow.nodes, runningEdgeIds, selectedEdgeId, isCanvasLocked, edgePathType, edgeLineStyle]);

  return { rfNodes, rfEdges, selectedNodeIdSet, executionNodeIds, executionStepByNodeId, runningEdgeIds };
}
