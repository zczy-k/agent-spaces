'use client';

import type { OutputField, WorkflowEdge, WorkflowNode } from '@agent-spaces/shared';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations("workflows");
    return (
    <ScrollArea className="h-full">
      <div className="space-y-3 p-3">
        <div>
          <h3 className="text-sm font-medium">{t('editor.variables')}</h3>
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
