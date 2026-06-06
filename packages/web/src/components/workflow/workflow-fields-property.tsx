'use client';

import dynamic from 'next/dynamic';
import type { NodeProperty } from '@agent-spaces/shared';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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

const PURE_VARIABLE_PATTERN = /^\s*\{\{\s*(.*?)\s*\}\}\s*$/;
const NODE_VARIABLE_PATTERN = /^__(?:data|inputs)__\["([^"]+)"\]\.?(.*)$/;
const CONFIG_VARIABLE_PATTERN = /^__config__\["([^"]+)"\]\["([^"]+)"\]$/;
const LOOP_VARIABLE_PATTERN = /^__loop__\.?(.*)$/;

function getVariableExpression(value: string | number): string | null {
  const match = String(value).match(PURE_VARIABLE_PATTERN);
  return match?.[1]?.trim() || null;
}

function normalizeVariableFieldPath(fieldPath: string): string {
  return fieldPath
    .replace(/\["([^"]+)"\]/g, '.$1')
    .replace(/^\./, '')
    .trim();
}

function getVariableBadgeLabel(
  value: string | number,
  variableContext?: WorkflowVariableContext,
): string | null {
  const expression = getVariableExpression(value);
  if (!expression) return null;

  const nodeMatch = expression.match(NODE_VARIABLE_PATTERN);
  if (nodeMatch) {
    const [, nodeId, fieldPath] = nodeMatch;
    const node = variableContext?.nodes.find((item) => item.id === nodeId);
    const nodeLabel = node?.label || nodeId;
    const normalizedFieldPath = normalizeVariableFieldPath(fieldPath);
    return normalizedFieldPath ? `${nodeLabel}.${normalizedFieldPath}` : nodeLabel;
  }

  const configMatch = expression.match(CONFIG_VARIABLE_PATTERN);
  if (configMatch) return `${configMatch[1]}.${configMatch[2]}`;

  const loopMatch = expression.match(LOOP_VARIABLE_PATTERN);
  if (loopMatch) return loopMatch[1] ? `loop.${loopMatch[1]}` : 'loop';

  return expression;
}

function VariableBadgeInput({
  value,
  readOnly,
  placeholder,
  variableContext,
  onClear,
}: {
  value: string | number;
  readOnly: boolean;
  placeholder?: string;
  variableContext?: WorkflowVariableContext;
  onClear: () => void;
}) {
  const label = getVariableBadgeLabel(value, variableContext);

  if (!label) return null;

  return (
    <div
      data-slot="input-group-control"
      className="flex min-w-0 flex-1 items-center px-2"
      title={String(value)}
    >
      <Badge
        variant="secondary"
        className="h-5 max-w-full gap-1 rounded px-1.5 py-0 font-mono text-[10px]"
      >
        <span className="min-w-0 truncate">{label}</span>
        <button
          type="button"
          aria-label={`Clear ${placeholder ?? 'variable'}`}
          className="shrink-0 rounded-sm p-0.5 text-muted-foreground hover:bg-background/80 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          disabled={readOnly}
          onClick={onClear}
        >
          <X className="h-2.5 w-2.5" />
        </button>
      </Badge>
    </div>
  );
}

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
    const variableBadgeLabel = getVariableBadgeLabel(variableValue, variableContext);

    return (
      <InputGroup className="h-7 rounded-md">
        {variableBadgeLabel ? (
          <VariableBadgeInput
            value={variableValue}
            readOnly={disabled}
            placeholder={prop.label}
            variableContext={variableContext}
            onClear={() => onChange('')}
          />
        ) : (
          <InputGroupInput
            value={variableValue}
            readOnly={disabled}
            placeholder={prop.label}
            className="text-xs"
            onChange={(e) => onChange(e.target.value)}
          />
        )}
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
