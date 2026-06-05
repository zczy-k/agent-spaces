'use client';

import dynamic from 'next/dynamic';
import type { ArrayFieldItem, NodeProperty, OutputField } from '@agent-spaces/shared';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, X } from 'lucide-react';
import { CONDITION_OPERATORS, NO_VALUE_OPERATORS } from '@/lib/workflow-nodes';
import { JsonViewer, type JsonValue } from '@/components/viewers/json-viewer';
import '@/lib/monaco-loader';
import { FIELD_TYPES, getOutputFields, isPlainObject } from './workflow-properties-utils';

const MonacoEditor = dynamic(
  () => import('@monaco-editor/react').then((mod) => mod.default),
  { ssr: false, loading: () => <div className="flex items-center justify-center h-[160px] text-muted-foreground text-xs">Loading...</div> },
);

export function JsonPreview({ value }: { value: unknown }) {
  return (
    <JsonViewer
      data={value as JsonValue}
      rootName="output"
      defaultExpanded={2}
    />
  );
}

export function OutputFieldsEditor({
  value,
  onChange,
  depth = 0,
}: {
  value: OutputField[];
  onChange: (v: OutputField[]) => void;
  depth?: number;
}) {
  const fields = getOutputFields(value);

  const updateField = (index: number, patch: Partial<OutputField>) => {
    const next = [...fields];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  return (
    <div className="space-y-1.5">
      {fields.map((field, index) => (
        <div key={index} className="rounded border bg-background p-1.5">
          <div className="flex items-center gap-1">
            <Input
              value={field.key ?? ''}
              onChange={(e) => updateField(index, { key: e.target.value })}
              placeholder="字段名"
              className="h-7 min-w-0 flex-1 text-xs"
            />
            <Select
              value={field.type ?? 'any'}
              onValueChange={(type) => updateField(index, { type: type as OutputField['type'] })}
            >
              <SelectTrigger className="h-7 w-[94px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map(type => (
                  <SelectItem key={type} value={type} className="text-xs">{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => onChange(fields.filter((_, i) => i !== index))}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          {field.type === 'object' && depth < 3 && (
            <div className="mt-1.5 border-l pl-2">
              <OutputFieldsEditor
                value={getOutputFields(field.children)}
                onChange={(children) => updateField(index, { children })}
                depth={depth + 1}
              />
            </div>
          )}
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        className="h-7 w-full gap-1 text-xs"
        onClick={() => onChange([...fields, { key: '', type: 'any' }])}
      >
        <Plus className="h-3.5 w-3.5" />
        添加字段
      </Button>
    </div>
  );
}

export function ArrayFieldEditor({
  prop,
  value,
  onChange,
}: {
  prop: NodeProperty;
  value: unknown;
  onChange: (v: Record<string, unknown>[]) => void;
}) {
  const items = Array.isArray(value) ? value.filter(isPlainObject) : [];
  const fields = prop.fields ?? [];

  const updateItem = (index: number, key: string, nextValue: unknown) => {
    const next = [...items];
    next[index] = { ...next[index], [key]: nextValue };
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={index} className="space-y-2 rounded border p-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground">项目 {index + 1}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-destructive"
              onClick={() => onChange(items.filter((_, i) => i !== index))}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          {fields.map(field => (
            <div key={field.key} className="space-y-1">
              <Label className="text-[11px]">{field.label}</Label>
              <ArrayItemField
                field={field}
                value={item[field.key] ?? field.default}
                onChange={(nextValue) => updateItem(index, field.key, nextValue)}
              />
            </div>
          ))}
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        className="h-7 w-full gap-1 text-xs"
        onClick={() => onChange([...items, { ...(prop.itemTemplate ?? {}) }])}
      >
        <Plus className="h-3.5 w-3.5" />
        添加项目
      </Button>
    </div>
  );
}

export function ArrayItemField({
  field,
  value,
  onChange,
}: {
  field: ArrayFieldItem;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  if (field.type === 'select') {
    return (
      <Select value={String(value ?? field.default ?? '')} onValueChange={onChange}>
        <SelectTrigger className="h-7 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {field.options?.map(option => (
            <SelectItem key={option.value} value={option.value} className="text-xs">{option.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (field.type === 'checkbox') {
    return (
      <Switch
        size="sm"
        checked={Boolean(value)}
        onCheckedChange={onChange}
      />
    );
  }

  if (field.type === 'output_fields') {
    return (
      <OutputFieldsEditor
        value={getOutputFields(value)}
        onChange={onChange}
      />
    );
  }

  return (
    <Input
      type={field.type === 'number' ? 'number' : 'text'}
      value={String(value ?? '')}
      placeholder={field.placeholder}
      onChange={(e) => onChange(field.type === 'number' ? Number(e.target.value) : e.target.value)}
      className="h-7 text-xs"
    />
  );
}

export function ConditionsEditor({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (v: Record<string, unknown>[]) => void;
}) {
  const conditions = Array.isArray(value) ? value.filter(isPlainObject) : [];

  return (
    <div className="space-y-2">
      {conditions.map((condition, index) => {
        const operator = String(condition.operator ?? 'equals');
        return (
          <div key={index} className="space-y-1 rounded border p-2">
            <div className="flex items-center gap-1">
              <Input
                value={String(condition.field ?? '')}
                onChange={(e) => {
                  const next = [...conditions];
                  next[index] = { ...condition, field: e.target.value };
                  onChange(next);
                }}
                placeholder="变量路径"
                className="h-6 flex-1 text-xs"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                onClick={() => onChange(conditions.filter((_, i) => i !== index))}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
            <Select
              value={operator}
              onValueChange={(nextOperator) => {
                const next = [...conditions];
                next[index] = { ...condition, operator: nextOperator };
                onChange(next);
              }}
            >
              <SelectTrigger className="h-6 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONDITION_OPERATORS.map(option => (
                  <SelectItem key={option.value} value={option.value} className="text-xs">
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!NO_VALUE_OPERATORS.has(operator) && (
              <Input
                value={String(condition.value ?? '')}
                onChange={(e) => {
                  const next = [...conditions];
                  next[index] = { ...condition, value: e.target.value };
                  onChange(next);
                }}
                placeholder="比较值"
                className="h-6 text-xs"
              />
            )}
          </div>
        );
      })}
      <Button
        variant="outline"
        size="sm"
        className="h-7 w-full gap-1 text-xs"
        onClick={() => onChange([...conditions, { field: '', operator: 'equals', value: '' }])}
      >
        <Plus className="h-3.5 w-3.5" />
        添加条件
      </Button>
    </div>
  );
}

export function PropertyField({
  prop,
  value,
  onChange,
}: {
  prop: NodeProperty;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const disabled = Boolean(prop.readonly);

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
      return <OutputFieldsEditor value={getOutputFields(value)} onChange={onChange} />;

    case 'conditions':
      return <ConditionsEditor value={value} onChange={onChange} />;

    case 'array':
      return <ArrayFieldEditor prop={prop} value={value} onChange={onChange} />;

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
