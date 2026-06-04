'use client';

import { useCallback, useMemo, useState } from 'react';
import { getNodeDefinition } from '@/lib/workflow-nodes';
import { CONDITION_OPERATORS, NO_VALUE_OPERATORS } from '@/lib/workflow-nodes';
import type {
  ArrayFieldItem,
  NodeProperty,
  OutputField,
  WorkflowNode,
} from '@agent-spaces/shared';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { JsonViewer, type JsonValue } from '@/components/viewers/json-viewer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Bug, Check, CheckCircle2, ChevronDown, Copy, FileDown, Import, Loader2, Pencil, Plus, Timer, Trash2, X,
  XCircle,
} from 'lucide-react';

interface PropertiesPanelProps {
  node: WorkflowNode | null;
  onUpdateData: (nodeId: string, data: Record<string, unknown>) => void;
  debugNodeId?: string | null;
  debugStatus?: 'idle' | 'running' | 'completed' | 'error';
  debugResult?: DebugResult | null;
  onDebugNode?: (nodeId: string) => void;
  onCancelDebug?: () => void;
}

type DebugResult = {
  status?: 'completed' | 'error';
  output?: unknown;
  error?: string;
  duration?: number;
};

type JsonPreset = {
  id: string;
  name: string;
  data: Record<string, unknown>;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
};

const JSON_PRESETS_KEY = '__jsonPresets';
const SELECTED_JSON_PRESET_KEY = '__selectedJsonPresetId';

const FIELD_TYPES: OutputField['type'][] = ['string', 'number', 'boolean', 'object', 'any'];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function inferType(value: unknown): OutputField['type'] {
  if (value === null || value === undefined) return 'any';
  if (typeof value === 'string') return 'string';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'object') return 'object';
  return 'any';
}

function toOutputFields(value: unknown): OutputField[] {
  if (!isPlainObject(value)) return [];
  return Object.entries(value).map(([key, fieldValue]) => {
    const type = inferType(fieldValue);
    return {
      key,
      type,
      ...(type === 'object' ? { children: toOutputFields(fieldValue) } : {}),
    };
  });
}

function getOutputFields(value: unknown): OutputField[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isPlainObject).map(item => ({
    key: typeof item.key === 'string' ? item.key : '',
    type: FIELD_TYPES.includes(item.type as OutputField['type']) ? item.type as OutputField['type'] : 'any',
    value: typeof item.value === 'string' ? item.value : undefined,
    description: typeof item.description === 'string' ? item.description : undefined,
    required: typeof item.required === 'boolean' ? item.required : undefined,
    children: getOutputFields(item.children),
  }));
}

function getJsonPresets(value: unknown): JsonPreset[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isPlainObject).map(item => ({
    id: typeof item.id === 'string' ? item.id : crypto.randomUUID(),
    name: typeof item.name === 'string' ? item.name : '未命名预设',
    data: isPlainObject(item.data) ? item.data : {},
    inputs: isPlainObject(item.inputs) ? item.inputs : {},
    outputs: isPlainObject(item.outputs) ? item.outputs : {},
  }));
}

function getPropertyValue(prop: NodeProperty, data: Record<string, unknown>) {
  return data[prop.key] ?? prop.default;
}

function isVisible(prop: NodeProperty, data: Record<string, unknown>) {
  if (!prop.visibleWhen) return true;
  const actual = data[prop.visibleWhen.key];
  if ('equals' in prop.visibleWhen) return actual === prop.visibleWhen.equals;
  if (prop.visibleWhen.in) return prop.visibleWhen.in.includes(actual);
  return true;
}

function JsonPreview({ value }: { value: unknown }) {
  return (
    <JsonViewer
      data={value as JsonValue}
      rootName="output"
      defaultExpanded={2}
    />
  );
}

function OutputFieldsEditor({
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
        <div key={`${field.key}-${index}`} className="rounded border bg-background p-1.5">
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

function ArrayFieldEditor({
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

function ArrayItemField({
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

function ConditionsEditor({
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

function PropertyField({
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
        <Textarea
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="min-h-[160px] text-xs font-mono"
        />
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

export function WorkflowPropertiesPanel({
  node,
  onUpdateData,
  debugNodeId = null,
  debugStatus = 'idle',
  debugResult = null,
  onDebugNode,
  onCancelDebug,
}: PropertiesPanelProps) {
  const [importOpen, setImportOpen] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [importError, setImportError] = useState('');
  const [presetOpen, setPresetOpen] = useState(false);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [presetName, setPresetName] = useState('');
  const [presetJson, setPresetJson] = useState('');
  const [presetError, setPresetError] = useState('');

  const definition = useMemo(() => node ? getNodeDefinition(node.type) : null, [node]);
  const data = node?.data ?? {};
  const visibleProperties = useMemo(
    () => (definition?.properties ?? []).filter(prop => isVisible(prop, data)),
    [definition, data],
  );
  const jsonPresets = useMemo(() => getJsonPresets(data[JSON_PRESETS_KEY]), [data]);
  const selectedJsonPresetId = typeof data[SELECTED_JSON_PRESET_KEY] === 'string'
    ? data[SELECTED_JSON_PRESET_KEY] as string
    : '';
  const selectedJsonPreset = jsonPresets.find(preset => preset.id === selectedJsonPresetId) ?? null;
  const canEditInputFields = Boolean(definition?.allowInputFields && node?.type !== 'end');
  const canEditOutputFields = Boolean(node && node.type !== 'start');
  const canEditDelay = Boolean(node && node.type !== 'start' && node.type !== 'end');
  const canDebugSelectedNode = Boolean(node && definition?.debuggable !== false && node.type !== 'start' && node.type !== 'end');
  const isDebugging = Boolean(node && debugNodeId === node.id && debugStatus === 'running');
  const hasDebugOutput = Boolean(node && debugNodeId === node.id && debugResult);

  const handleDataChange = useCallback((key: string, value: unknown) => {
    if (!node) return;
    onUpdateData(node.id, { [key]: value });
  }, [node, onUpdateData]);

  const updateJsonPresets = useCallback((presets: JsonPreset[]) => {
    handleDataChange(JSON_PRESETS_KEY, presets);
  }, [handleDataChange]);

  const openAddPresetDialog = () => {
    setEditingPresetId(null);
    setPresetName('');
    setPresetJson(JSON.stringify({ data: {}, inputs: {}, outputs: {} }, null, 2));
    setPresetError('');
    setPresetOpen(true);
  };

  const openEditPresetDialog = (preset: JsonPreset) => {
    setEditingPresetId(preset.id);
    setPresetName(preset.name);
    setPresetJson(JSON.stringify({ data: preset.data, inputs: preset.inputs, outputs: preset.outputs }, null, 2));
    setPresetError('');
    setPresetOpen(true);
  };

  const savePreset = () => {
    const name = presetName.trim();
    if (!name) {
      setPresetError('请输入预设名称');
      return;
    }

    try {
      const parsed = JSON.parse(presetJson) as unknown;
      if (
        !isPlainObject(parsed)
        || !isPlainObject(parsed.data)
        || !isPlainObject(parsed.inputs)
        || (parsed.outputs !== undefined && !isPlainObject(parsed.outputs))
      ) {
        setPresetError('JSON 必须是 { "data": {}, "inputs": {}, "outputs": {} } 格式');
        return;
      }

      const preset: JsonPreset = {
        id: editingPresetId ?? crypto.randomUUID(),
        name,
        data: parsed.data,
        inputs: parsed.inputs,
        outputs: isPlainObject(parsed.outputs) ? parsed.outputs : {},
      };
      const next = editingPresetId
        ? jsonPresets.map(item => item.id === preset.id ? preset : item)
        : [...jsonPresets, preset];
      updateJsonPresets(next);
      if (!selectedJsonPresetId) handleDataChange(SELECTED_JSON_PRESET_KEY, preset.id);
      setPresetOpen(false);
    } catch {
      setPresetError('JSON 格式不正确，请检查输入');
    }
  };

  const importOutputFields = () => {
    setImportError('');
    try {
      const parsed = JSON.parse(importJson) as unknown;
      handleDataChange('outputs', toOutputFields(parsed));
      setImportOpen(false);
      setImportJson('');
    } catch {
      setImportError('JSON 格式不正确，请检查输入');
    }
  };

  const applyDebugOutput = () => {
    if (debugResult?.output === undefined) return;
    handleDataChange('outputs', toOutputFields(debugResult.output));
  };

  if (!node) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">
        选择节点查看属性
      </div>
    );
  }

  if (node.type === 'loop_body') {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-xs text-muted-foreground">
        循环体节点无需单独配置属性
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex shrink-0 items-center gap-2 border-b p-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{definition?.label || node.type}</div>
          {definition?.description && (
            <div className="truncate text-[10px] text-muted-foreground">{definition.description}</div>
          )}
        </div>
        <Popover>
          <PopoverTrigger>
            <Badge
              variant={selectedJsonPreset ? 'default' : 'outline'}
              className="h-6 cursor-pointer gap-1 px-2 text-[10px]"
            >
              {selectedJsonPreset ? selectedJsonPreset.name : 'JSON 预设'}
              <ChevronDown className="h-3 w-3" />
            </Badge>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-2">
            <div className="max-h-72 overflow-y-auto">
              {jsonPresets.length === 0 ? (
                <div className="px-2 py-6 text-center text-xs text-muted-foreground">暂无预设</div>
              ) : jsonPresets.map(preset => (
                <div key={preset.id} className="flex items-center gap-1 rounded px-2 py-1.5 hover:bg-accent">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    onClick={() => handleDataChange(SELECTED_JSON_PRESET_KEY, selectedJsonPresetId === preset.id ? '' : preset.id)}
                  >
                    <Check className={`h-3.5 w-3.5 shrink-0 ${selectedJsonPresetId === preset.id ? 'text-primary' : 'text-transparent'}`} />
                    <span className="truncate text-xs">{preset.name}</span>
                  </button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditPresetDialog(preset)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      updateJsonPresets(jsonPresets.filter(item => item.id !== preset.id));
                      if (selectedJsonPresetId === preset.id) handleDataChange(SELECTED_JSON_PRESET_KEY, '');
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="mt-2 border-t pt-2">
              <Button variant="outline" size="sm" className="h-7 w-full gap-1 text-xs" onClick={openAddPresetDialog}>
                <Plus className="h-3.5 w-3.5" />
                添加
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex shrink-0 items-center gap-1 border-b px-3 py-1.5">
        <Badge variant="secondary" className="h-5 rounded px-2 text-[10px]">属性</Badge>
        {canEditInputFields && <Badge variant="outline" className="h-5 rounded px-2 text-[10px]">输入</Badge>}
        {canEditOutputFields && <Badge variant="outline" className="h-5 rounded px-2 text-[10px]">输出</Badge>}
        <div className="ml-auto flex items-center gap-1">
          {canDebugSelectedNode && onDebugNode && (
            <Button
              variant="ghost"
              size="icon"
              className={`h-6 w-6 ${isDebugging ? 'text-destructive' : 'text-muted-foreground hover:text-foreground'}`}
              title={isDebugging ? '停止测试' : '测试脚本'}
              onClick={() => {
                if (isDebugging) {
                  onCancelDebug?.();
                } else if (node) {
                  onDebugNode(node.id);
                }
              }}
            >
              {isDebugging ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Bug className="h-3.5 w-3.5" />
              )}
            </Button>
          )}
          {canEditDelay && (
            <Popover>
              <PopoverTrigger
                className={`relative rounded p-1 transition-colors hover:bg-muted ${data._delay ? 'text-primary' : 'text-muted-foreground'}`}
              >
                <Timer className="h-3.5 w-3.5" />
                {Number(data._delay) > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-0.5 text-[9px] font-medium leading-none text-primary-foreground">
                    {Math.ceil(Number(data._delay) / 1000)}s
                  </span>
                )}
              </PopoverTrigger>
              <PopoverContent align="end" className="w-56 space-y-2 p-3">
                <p className="text-xs font-medium">延迟执行</p>
                <p className="text-xs text-muted-foreground">执行当前节点前等待的毫秒数</p>
                <Input
                  type="number"
                  min={0}
                  step={100}
                  value={String(data._delay ?? 0)}
                  onChange={(e) => handleDataChange('_delay', Number(e.target.value) || 0)}
                  className="h-7 text-xs"
                />
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 p-3">
          {hasDebugOutput && debugResult && (
            <section className="space-y-2 rounded border bg-muted/20 p-2">
              <div className="flex items-center gap-1.5">
                {debugResult.status === 'completed' ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-500" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />
                )}
                <span className="text-xs font-medium">
                  {debugResult.status === 'completed' ? '测试成功' : '测试失败'}
                </span>
                {typeof debugResult.duration === 'number' && (
                  <span className="ml-auto text-[10px] text-muted-foreground">{debugResult.duration}ms</span>
                )}
              </div>
              {debugResult.error && (
                <div className="flex items-start gap-2 rounded bg-red-500/10 p-2">
                  <p className="min-w-0 flex-1 break-all text-[11px] font-mono text-red-500">
                    {debugResult.error}
                  </p>
                  <Copy
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 cursor-pointer text-red-400 hover:text-red-300"
                    onClick={() => navigator.clipboard.writeText(debugResult.error ?? '')}
                  />
                </div>
              )}
              {debugResult.output !== undefined && (
                <JsonPreview value={debugResult.output} />
              )}
            </section>
          )}

          {selectedJsonPreset && (
            <div className="space-y-2 rounded border bg-muted/20 p-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">当前 JSON 预设</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 gap-1 text-[11px]"
                  onClick={() => navigator.clipboard.writeText(JSON.stringify(selectedJsonPreset, null, 2))}
                >
                  <Copy className="h-3 w-3" />
                  复制
                </Button>
              </div>
              <JsonPreview value={{
                data: selectedJsonPreset.data,
                inputs: selectedJsonPreset.inputs,
                outputs: selectedJsonPreset.outputs,
              }} />
            </div>
          )}

          <section className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">标签</Label>
              <Input
                value={String(data.label ?? node.label ?? '')}
                onChange={(e) => handleDataChange('label', e.target.value)}
                className="h-7 text-xs"
              />
              <div className="text-[10px] text-muted-foreground font-mono">{node.id}</div>
            </div>

            {visibleProperties.map(prop => (
              <div key={prop.key} className="space-y-1.5">
                <div className="flex items-center gap-1">
                  <Label className="text-xs">{prop.label}</Label>
                  {prop.required && <span className="text-[10px] text-destructive">*</span>}
                </div>
                <PropertyField
                  prop={prop}
                  value={getPropertyValue(prop, data)}
                  onChange={(value) => handleDataChange(prop.key, value)}
                />
                {prop.tooltip && (
                  <p className="text-[10px] text-muted-foreground">{prop.tooltip}</p>
                )}
              </div>
            ))}
          </section>

          {canEditInputFields && (
            <section className="space-y-2 border-t pt-3">
              <div className="text-xs font-medium text-muted-foreground">
                {node.type === 'sub_workflow' ? '开始节点输入' : '输入字段'}
              </div>
              <OutputFieldsEditor
                value={getOutputFields(data.inputFields)}
                onChange={(value) => handleDataChange('inputFields', value)}
              />
            </section>
          )}

          {canEditOutputFields && (
            <section className="space-y-2 border-t pt-3">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">输出字段</span>
                <div className="ml-auto flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 gap-1 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setImportJson('');
                      setImportError('');
                      setImportOpen(true);
                    }}
                  >
                    <Import className="h-3 w-3" />
                    导入
                  </Button>
                  {selectedJsonPreset && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 gap-1 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                      onClick={() => handleDataChange('outputs', toOutputFields(selectedJsonPreset.outputs))}
                    >
                      <FileDown className="h-3 w-3" />
                      应用预设
                    </Button>
                  )}
                  {debugResult?.output !== undefined && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 gap-1 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                      onClick={applyDebugOutput}
                    >
                      <FileDown className="h-3 w-3" />
                      应用测试输出
                    </Button>
                  )}
                </div>
              </div>
              <OutputFieldsEditor
                value={getOutputFields(data.outputs)}
                onChange={(value) => handleDataChange('outputs', value)}
              />
            </section>
          )}
        </div>
      </ScrollArea>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">导入输出字段</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground">粘贴 JSON 对象，将自动解析为输出字段结构。</p>
            <Textarea
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              placeholder='{"key1": "value1", "key2": 123}'
              className="min-h-[160px] text-xs font-mono"
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') importOutputFields();
              }}
            />
            {importError && <p className="text-[11px] text-red-500">{importError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setImportOpen(false)}>取消</Button>
            <Button size="sm" className="h-7 text-xs" disabled={!importJson.trim()} onClick={importOutputFields}>确认导入</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={presetOpen} onOpenChange={setPresetOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm">{editingPresetId ? '编辑 JSON 预设' : '添加 JSON 预设'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <div className="space-y-1">
              <Label className="text-xs">名称</Label>
              <Input value={presetName} onChange={(e) => setPresetName(e.target.value)} className="h-7 text-xs" placeholder="预设名称" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">JSON</Label>
              <Textarea
                value={presetJson}
                onChange={(e) => setPresetJson(e.target.value)}
                className="min-h-[220px] text-xs font-mono"
                placeholder='{ "data": {}, "inputs": {}, "outputs": {} }'
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') savePreset();
                }}
              />
            </div>
            {presetError && <p className="text-[11px] text-red-500">{presetError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setPresetOpen(false)}>取消</Button>
            <Button size="sm" className="h-7 text-xs" onClick={savePreset}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
