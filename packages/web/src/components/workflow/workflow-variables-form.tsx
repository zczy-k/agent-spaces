'use client';

import type { OutputField, WorkflowEdge, WorkflowNode } from '@agent-spaces/shared';
import { ScrollArea } from '@/components/ui/scroll-area';
import { OutputFieldsEditor } from './workflow-properties-fields';

export function WorkflowVariablesForm({
  value,
  onChange,
  nodes,
  edges,
  currentNodeId,
  enabledPlugins,
  variables,
}: {
  value: OutputField[];
  onChange: (value: OutputField[]) => void;
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
  currentNodeId?: string | null;
  enabledPlugins?: string[];
  variables?: OutputField[];
}) {
  return (
    <ScrollArea className="h-full">
      <div className="space-y-3 p-3">
        <div>
          <h3 className="text-sm font-medium">变量</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            工作流运行时可通过 {'{{__env__.变量名}}'} 或 context.__env__.变量名 读取。
          </p>
        </div>
        <OutputFieldsEditor
          value={value}
          onChange={onChange}
          variableContext={nodes && edges ? {
            nodes,
            edges,
            currentNodeId,
            enabledPlugins,
            variables,
          } : undefined}
          showRequired
        />
      </div>
    </ScrollArea>
  );
}
