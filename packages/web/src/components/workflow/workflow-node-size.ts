import { LOOP_BODY_NODE_TYPE, type NodeTypeDefinition } from '@agent-spaces/shared';

const DEFAULT_NODE_MIN_WIDTH = 140;
const DEFAULT_NODE_WIDTH = 250;
const DEFAULT_NODE_MIN_HEIGHT = 60;
const HEADER_HEIGHT = 33;
const HANDLE_MARGIN = 12;
const HANDLE_ROW_HEIGHT = 24;
const HANDLE_BOTTOM_PADDING = 16;

export type WorkflowNodeSize = {
  minWidth: number;
  minHeight: number;
  width: number;
  height: number;
  sourceHandleCount: number;
};

function getDynamicSourceHandleCount(definition: NodeTypeDefinition | undefined, data: Record<string, unknown>): number {
  const dynamicSource = definition?.handles?.dynamicSource;
  if (!dynamicSource) return 0;

  const values = data[dynamicSource.dataKey];
  const itemCount = Array.isArray(values) ? values.length : 0;
  return itemCount + (dynamicSource.extraCount || 0);
}

export function getWorkflowNodeSourceHandleCount(
  definition: NodeTypeDefinition | undefined,
  data: Record<string, unknown>,
): number {
  const dynamicSourceHandleCount = getDynamicSourceHandleCount(definition, data);
  if (dynamicSourceHandleCount > 0) return dynamicSourceHandleCount;

  const staticSourceHandleCount = definition?.handles?.sourceHandles?.length || 0;
  if (staticSourceHandleCount > 0) return staticSourceHandleCount;

  return definition?.handles?.source === false ? 0 : 1;
}

export function getWorkflowNodeSize(
  definition: NodeTypeDefinition | undefined,
  data: Record<string, unknown>,
): WorkflowNodeSize {
  const sourceHandleCount = getWorkflowNodeSourceHandleCount(definition, data);
  const minWidth = definition?.customViewMinSize?.width || DEFAULT_NODE_MIN_WIDTH;
  const baseMinHeight = definition?.customViewMinSize?.height || DEFAULT_NODE_MIN_HEIGHT;
  const isLoopBody = definition?.type === LOOP_BODY_NODE_TYPE;
  const minHeight = isLoopBody || sourceHandleCount <= 1
    ? baseMinHeight
    : Math.max(baseMinHeight, HEADER_HEIGHT + sourceHandleCount * HANDLE_ROW_HEIGHT + HANDLE_BOTTOM_PADDING);

  return {
    minWidth,
    minHeight,
    width: Math.max(minWidth, typeof data.width === 'number' ? data.width : DEFAULT_NODE_WIDTH),
    height: Math.max(minHeight, typeof data.height === 'number' ? data.height : minHeight),
    sourceHandleCount,
  };
}

