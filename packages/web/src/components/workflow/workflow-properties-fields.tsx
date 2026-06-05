'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import type { ArrayFieldItem, NodeProperty, OutputField } from '@agent-spaces/shared';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Braces, ChevronRight, GripVertical, Plus, Trash2, X } from 'lucide-react';
import { CONDITION_OPERATORS, NO_VALUE_OPERATORS } from '@/lib/workflow-nodes';
import { JsonViewer, type JsonValue } from '@/components/viewers/json-viewer';
import '@/lib/monaco-loader';
import { FIELD_TYPES, getOutputFields, isPlainObject } from './workflow-properties-utils';
import { WorkflowVariablePicker, type WorkflowVariableContext } from './workflow-variable-picker';

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
  variableContext,
  depth = 0,
}: {
  value: OutputField[];
  onChange: (v: OutputField[]) => void;
  variableContext?: WorkflowVariableContext;
  depth?: number;
}) {
  const fields = getOutputFields(value);
  const [expandedFields, setExpandedFields] = useState<Set<number>>(() => new Set());
  const indent = depth * 16;

  const updateField = (index: number, patch: Partial<OutputField>) => {
    const next = [...fields];
    next[index] = { ...next[index], ...patch };
    if (patch.type && patch.type !== 'object') {
      next[index].children = undefined;
    }
    if (patch.type === 'object' && !next[index].children) {
      next[index].children = [];
      next[index].value = undefined;
    }
    onChange(next);
  };

  const toggleExpand = (index: number) => {
    setExpandedFields((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const insertVariable = (index: number, variablePath: string) => {
    updateField(index, { value: `${fields[index]?.value ?? ''}${variablePath}` });
  };

  return (
    <div className="space-y-1">
      {depth === 0 && (
        <div className="grid grid-cols-[1fr_80px] gap-1 text-[10px] font-medium text-muted-foreground">
          <span>名称</span>
          <span>类型</span>
        </div>
      )}
      {fields.map((field, index) => (
        <div key={index} className="space-y-0.5">
          <div className="group/field flex items-center gap-1" style={{ paddingLeft: `${indent}px` }}>
            <Button
              variant="ghost"
              size="icon"
              className={`h-5 w-5 shrink-0 ${expandedFields.has(index) ? '' : '-rotate-90'}`}
              onClick={() => toggleExpand(index)}
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
            <Checkbox
              checked={Boolean(field.required) || false}
              onCheckedChange={(checked) => updateField(index, { required: checked === true || undefined })}
              className="h-3.5 w-3.5"
              title="必填"
            />
            <Input
              value={field.key ?? ''}
              onChange={(e) => updateField(index, { key: e.target.value })}
              placeholder="字段名"
              className="h-6 min-w-0 flex-1 text-[11px]"
            />
            <Select
              value={field.type ?? 'string'}
              onValueChange={(type) => updateField(index, { type: type as OutputField['type'] })}
            >
              <SelectTrigger size="sm" className="h-6 w-20 shrink-0 px-2 py-0 text-[11px] [&_svg]:size-3">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map(type => (
                  <SelectItem key={type} value={type} className="text-[11px]">{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover/field:opacity-100"
              onClick={() => onChange(fields.filter((_, i) => i !== index))}
            >
              <Trash2 className="h-2.5 w-2.5" />
            </Button>
          </div>
          {expandedFields.has(index) && field.type !== 'object' && (
            <div className="space-y-0.5" style={{ paddingLeft: `${indent + 20}px` }}>
              <InputGroup className="h-6 min-h-0 rounded-md">
                <InputGroupInput
                  value={field.value ?? ''}
                  onChange={(e) => updateField(index, { value: e.target.value })}
                  placeholder="默认值"
                  className="h-6 text-[11px]"
                />
                {variableContext?.currentNodeId && (
                  <InputGroupAddon align="inline-end" className="py-0 pr-0.5">
                    <WorkflowVariablePicker
                      {...variableContext}
                      onSelect={(path) => insertVariable(index, path)}
                    />
                  </InputGroupAddon>
                )}
              </InputGroup>
              <Input
                value={field.description ?? ''}
                onChange={(e) => updateField(index, { description: e.target.value || undefined })}
                placeholder="描述（可选）"
                className="h-6 text-[11px]"
              />
            </div>
          )}
          {field.type === 'object' && depth < 3 && (
            <div>
              <OutputFieldsEditor
                value={getOutputFields(field.children)}
                onChange={(children) => updateField(index, { children })}
                variableContext={variableContext}
                depth={depth + 1}
              />
            </div>
          )}
        </div>
      ))}
      <Button
        variant="ghost"
        size="sm"
        className="h-5 w-full gap-0.5 text-[10px] text-muted-foreground hover:text-foreground"
        style={{ paddingLeft: `${indent}px` }}
        onClick={() => onChange([...fields, { key: '', type: 'string', value: '' }])}
      >
        <Plus className="h-2.5 w-2.5" />
        添加字段
      </Button>
    </div>
  );
}

export function ArrayFieldEditor({
  prop,
  value,
  onChange,
  variableContext,
}: {
  prop: NodeProperty;
  value: unknown;
  onChange: (v: Record<string, unknown>[]) => void;
  variableContext?: WorkflowVariableContext;
}) {
  const items = Array.isArray(value) ? value.filter(isPlainObject) : [];
  const fields = prop.fields ?? [];
  const [variableModeEnabled, setVariableModeEnabled] = useState<Set<string>>(() => new Set());
  const [variableModeDisabled, setVariableModeDisabled] = useState<Set<string>>(() => new Set());

  const updateItem = (index: number, key: string, nextValue: unknown) => {
    const next = [...items];
    next[index] = { ...next[index], [key]: nextValue };
    onChange(next);
  };

  const fieldModeKey = (index: number, key: string) => `${prop.key}.${index}.${key}`;
  const isVariableRef = (nextValue: unknown) => typeof nextValue === 'string' && nextValue.includes('{{');
  const isVariableModeActive = (key: string, nextValue: unknown) => {
    if (variableModeDisabled.has(key)) return false;
    return isVariableRef(nextValue) || variableModeEnabled.has(key);
  };
  const toggleVariableMode = (key: string, nextValue: unknown) => {
    if (isVariableModeActive(key, nextValue)) {
      setVariableModeEnabled((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
      setVariableModeDisabled((current) => new Set(current).add(key));
    } else {
      setVariableModeDisabled((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
      setVariableModeEnabled((current) => new Set(current).add(key));
    }
  };
  const clearDisabledOverride = (key: string) => {
    if (!variableModeDisabled.has(key)) return;
    setVariableModeDisabled((current) => {
      const next = new Set(current);
      next.delete(key);
      return next;
    });
  };
  const toVariableInputValue = (nextValue: unknown): string | number => {
    if (typeof nextValue === 'string' || typeof nextValue === 'number') return nextValue;
    if (typeof nextValue === 'boolean') return String(nextValue);
    return '';
  };
  const updateArrayItemField = (index: number, key: string, nextValue: unknown) => {
    clearDisabledOverride(fieldModeKey(index, key));
    updateItem(index, key, nextValue);
  };
  const insertArrayVariable = (index: number, key: string, path: string) => {
    const current = toVariableInputValue(items[index]?.[key]);
    updateArrayItemField(index, key, `${current}${path}`);
  };

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={index} className="group/item relative space-y-1.5 rounded border bg-muted/30 p-2">
          <button
            type="button"
            className="absolute right-1 top-1 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover/item:opacity-100"
            onClick={() => onChange(items.filter((_, i) => i !== index))}
          >
            <Trash2 className="h-3 w-3" />
          </button>
          {fields.map(field => (
            <div key={field.key} className="space-y-0.5">
              <div className="flex items-center gap-1 pr-5">
                <Label className="flex-1 text-[10px] text-muted-foreground">{field.label}</Label>
                <button
                  type="button"
                  className={`rounded p-0.5 transition-colors hover:bg-accent ${isVariableModeActive(fieldModeKey(index, field.key), item[field.key]) ? 'text-primary' : 'text-muted-foreground'}`}
                  title="切换变量模式"
                  onClick={() => toggleVariableMode(fieldModeKey(index, field.key), item[field.key])}
                >
                  <Braces className="h-3 w-3" />
                </button>
              </div>
              <ArrayItemField
                field={field}
                value={item[field.key] ?? field.default}
                onChange={(nextValue) => updateArrayItemField(index, field.key, nextValue)}
                variableMode={isVariableModeActive(fieldModeKey(index, field.key), item[field.key])}
                variableValue={toVariableInputValue(item[field.key])}
                variableContext={variableContext}
                onInsertVariable={(path) => insertArrayVariable(index, field.key, path)}
              />
            </div>
          ))}
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        className="h-7 w-full gap-1 text-xs"
        onClick={() => onChange([...items, { ...(prop.itemTemplate ?? {}), id: Date.now() }])}
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
  variableMode = false,
  variableValue = '',
  variableContext,
  onInsertVariable,
}: {
  field: ArrayFieldItem;
  value: unknown;
  onChange: (v: unknown) => void;
  variableMode?: boolean;
  variableValue?: string | number;
  variableContext?: WorkflowVariableContext;
  onInsertVariable?: (path: string) => void;
}) {
  if (variableMode) {
    return (
      <InputGroup className="h-6 rounded-md">
        <InputGroupInput
          value={variableValue}
          placeholder={field.placeholder || field.label}
          className="text-[11px]"
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
        variableContext={variableContext}
      />
    );
  }

  return (
    <Input
      type={field.type === 'number' ? 'number' : 'text'}
      value={String(value ?? '')}
      placeholder={field.placeholder}
      onChange={(e) => onChange(field.type === 'number' ? Number(e.target.value) : e.target.value)}
      className="h-6 text-[11px]"
    />
  );
}

export function ConditionsEditor({
  value,
  onChange,
  variableContext,
}: {
  value: unknown;
  onChange: (v: Record<string, unknown>[]) => void;
  variableContext?: WorkflowVariableContext;
}) {
  const conditions = Array.isArray(value) ? value.filter(isPlainObject) : [];
  const updateCondition = (index: number, patch: Record<string, unknown>) => {
    const next = [...conditions];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {conditions.map((condition, index) => {
        const operator = String(condition.operator ?? 'equals');
        const variable = String(condition.variable ?? condition.field ?? '');
        return (
          <div key={index} className="group/cond relative space-y-1.5 rounded border p-2">
            <div className="flex items-center gap-1">
              <GripVertical className="h-3 w-3 shrink-0 text-muted-foreground/50" />
              <span className="w-7 shrink-0 text-[10px] text-muted-foreground">条件 {index + 1}</span>
              <Input
                value={variable}
                onChange={(e) => updateCondition(index, { variable: e.target.value, field: e.target.value })}
                placeholder="变量"
                className="h-6 flex-1 text-[11px]"
              />
              {variableContext?.currentNodeId && (
                <WorkflowVariablePicker
                  {...variableContext}
                  onSelect={(path) => updateCondition(index, { variable: `${variable}${path}`, field: `${variable}${path}` })}
                />
              )}
            </div>
            <Select
              value={operator}
              onValueChange={(nextOperator) => updateCondition(index, { operator: nextOperator })}
            >
              <SelectTrigger className="h-6 text-[11px]">
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
                onChange={(e) => updateCondition(index, { value: e.target.value })}
                placeholder="比较值"
                className="h-6 text-[11px]"
              />
            )}
            <button
              type="button"
              className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 transition-opacity group-hover/cond:opacity-100"
              onClick={() => onChange(conditions.filter((_, i) => i !== index))}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </div>
        );
      })}
      <Button
        variant="outline"
        size="sm"
        className="h-7 w-full gap-1 text-xs"
        onClick={() => onChange([...conditions, { id: `cond_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, variable: '', field: '', operator: 'equals', value: '' }])}
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
