'use client';

import type { WorkflowNode } from '@agent-spaces/shared';
import { Button } from '@/components/ui/button';
import { Import, FileDown, RotateCcw } from 'lucide-react';
import { getOutputFields, toOutputFields } from './workflow-properties-utils';
import type { DebugResult, JsonPreset } from './workflow-properties-utils';
import { OutputFieldsEditor } from './workflow-properties-fields';
import type { WorkflowVariableContext } from './workflow-variable-picker';
import { getNodeDefinition } from '@/lib/workflow-nodes';

interface IOFieldsSectionsProps {
  node: WorkflowNode;
  data: Record<string, unknown>;
  canEditInputFields: boolean;
  canEditOutputFields: boolean;
  variableContext: WorkflowVariableContext | undefined;
  selectedJsonPreset: JsonPreset | null;
  debugResult: DebugResult | null;
  hasDebugOutput: boolean;
  onDataChange: (key: string, value: unknown) => void;
  onOpenImport: () => void;
}

export function IOFieldsSections({
  node,
  data,
  canEditInputFields,
  canEditOutputFields,
  variableContext,
  selectedJsonPreset,
  debugResult,
  hasDebugOutput,
  onDataChange,
  onOpenImport,
}: IOFieldsSectionsProps) {
  return (
    <>
      {canEditInputFields && (
        <section id="input-fields-section" className="space-y-2 ">
          <div className="text-xs font-medium text-muted-foreground">
            {node.type === 'sub_workflow' ? '开始节点输入' : '输入字段'}
          </div>
          <OutputFieldsEditor
            value={getOutputFields(data.inputFields)}
            onChange={(value) => onDataChange('inputFields', value)}
            variableContext={variableContext}
          />
        </section>
      )}

      {canEditOutputFields && (
        <section id="output-fields-section" className="space-y-2 border-t pt-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">输出字段</span>
            <div className="ml-auto flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                onClick={onOpenImport}
              >
                <Import className="h-3 w-3" />
                导入
              </Button>
              {selectedJsonPreset && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                  onClick={() => onDataChange('outputs', toOutputFields(selectedJsonPreset.outputs))}
                >
                  <FileDown className="h-3 w-3" />
                  应用预设
                </Button>
              )}
              {hasDebugOutput && debugResult?.output !== undefined && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                  onClick={() => onDataChange('outputs', toOutputFields(debugResult.output))}
                >
                  <FileDown className="h-3 w-3" />
                  应用测试输出
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                onClick={() => {
                  const defaults = getNodeDefinition(node.type)?.outputs;
                  if (defaults) onDataChange('outputs', defaults);
                }}
              >
                <RotateCcw className="h-3 w-3" />
                重置
              </Button>
            </div>
          </div>
          <OutputFieldsEditor
            value={getOutputFields(data.outputs)}
            onChange={(value) => onDataChange('outputs', value)}
            variableContext={variableContext}
          />
        </section>
      )}
    </>
  );
}
