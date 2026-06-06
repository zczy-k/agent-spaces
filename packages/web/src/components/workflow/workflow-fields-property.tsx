'use client';

import dynamic from 'next/dynamic';
import type { NodeProperty } from '@agent-spaces/shared';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import '@/lib/monaco-loader';
import { getOutputFields } from './workflow-properties-utils';
import { WorkflowVariablePicker, type WorkflowVariableContext } from './workflow-variable-picker';
import { OutputFieldsEditor } from './workflow-fields-output';
import { ConditionsEditor } from './workflow-fields-conditions';
import { ArrayFieldEditor } from './workflow-fields-array';

const MonacoEditor = dynamic(
  () => import('@monaco-editor/react').then((mod) => mod.default),
  { ssr: false, loading: () => <div className="flex items-center justify-center h-[160px] text-muted-foreground text-xs">Loading...</div> },
);

export function PropertyField({
  prop,
  value,
  onChange,
  variableContext,
  variableMode = false,
  variableValue = '',
  onInsertVariable,
}: {
  prop: NodeProperty;
  value: unknown;
  onChange: (v: unknown) => void;
  variableContext?: WorkflowVariableContext;
  variableMode?: boolean;
  variableValue?: string | number;
  onInsertVariable?: (path: string) => void;
}) {
  const disabled = Boolean(prop.readonly);

  if (variableMode) {
    return (
      <InputGroup className="h-7 rounded-md">
        <InputGroupInput
          value={variableValue}
          readOnly={disabled}
          placeholder={prop.label}
          className="text-xs"
          onChange={(e) => onChange(e.target.value)}
        />
        {variableContext?.currentNodeId && onInsertVariable && (
          <InputGroupAddon align="inline-end">
            <WorkflowVariablePicker {...variableContext} onSelect={onInsertVariable} />
          </InputGroupAddon>
        )}
      </InputGroup>
    );
  }

  switch (prop.type) {
    case 'text':
      return (
        <Input
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          placeholder={prop.tooltip}
          disabled={disabled}
          className="h-7 text-xs"
        />
      );

    case 'textarea':
      return (
        <Textarea
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          placeholder={prop.tooltip}
          disabled={disabled}
          className="min-h-[72px] text-xs"
        />
      );

    case 'number':
      return (
        <Input
          type="number"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
          disabled={disabled}
          className="h-7 text-xs"
        />
      );

    case 'select':
      return (
        <Select
          value={String(value ?? prop.default ?? '')}
          onValueChange={onChange}
          disabled={disabled}
        >
          <SelectTrigger className="h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {prop.options?.map(option => (
              <SelectItem key={option.value} value={option.value} className="text-xs">
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case 'checkbox':
      return (
        <Switch
          size="sm"
          checked={Boolean(value)}
          disabled={disabled}
          onCheckedChange={onChange}
        />
      );

    case 'code':
      return (
        <div className="border rounded-md overflow-hidden">
          <MonacoEditor
            height="160px"
            language={(prop as unknown as Record<string, unknown>).language as string || 'javascript'}
            theme="vs-dark"
            value={String(value ?? '')}
            onChange={(v) => onChange(v ?? '')}
            options={{
              readOnly: disabled,
              minimap: { enabled: false },
              fontSize: 12,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              folding: false,
              glyphMargin: false,
              overviewRulerBorder: false,
              hideCursorInOverviewRuler: true,
              overviewRulerLanes: 0,
              renderLineHighlight: 'none',
              scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
              padding: { top: 4, bottom: 4 },
            }}
          />
        </div>
      );

    case 'output_fields':
      return <OutputFieldsEditor value={getOutputFields(value)} onChange={onChange} variableContext={variableContext} />;

    case 'conditions':
      return <ConditionsEditor value={value} onChange={onChange} variableContext={variableContext} />;

    case 'array':
      return <ArrayFieldEditor prop={prop} value={value} onChange={onChange} variableContext={variableContext} />;

    default:
      return (
        <Input
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="h-7 text-xs"
        />
      );
  }
}
