import type { Workflow } from '@agent-spaces/shared';

export function validateWorkflowExecution(wf: Workflow): string | null {
  const startNodes = wf.nodes.filter(n => n.type === 'start');
  const endNodes = wf.nodes.filter(n => n.type === 'end');
  if (startNodes.length === 0) return '缺少开始节点';
  if (endNodes.length === 0) return '缺少结束节点';

  const nodeIds = new Set(wf.nodes.map(n => n.id));
  for (const edge of wf.edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
  }
  return null;
}
