'use client';

import { useCallback, useMemo, useState } from 'react';
import { getNodeDefinition } from '@/lib/workflow-nodes';
import type { WorkflowEdge, WorkflowNode } from '@agent-spaces/shared';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Braces, Check, ChevronDown, ChevronRight, Copy, FileDown, Import, Info, Loader2, Pencil, Plus, Timer, Trash2,
  Bug, CheckCircle2, X, XCircle,
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTriggerAsChild } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  isPlainObject,
  toOutputFields,
  getOutputFields,
  getJsonPresets,
  getPropertyValue,
  isVisible,
  JSON_PRESETS_KEY,
  SELECTED_JSON_PRESET_KEY,
} from './workflow-properties-utils';
import type { DebugResult, JsonPreset } from './workflow-properties-utils';
import {
  JsonPreview,
  OutputFieldsEditor,
  PropertyField,
} from './workflow-properties-fields';
import type { WorkflowVariableContext } from './workflow-variable-picker';
import { ExecutionNodeDialog } from './workflow-execution-node-dialog';

interface PropertiesPanelProps {
  node: WorkflowNode | null;
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
  enabledPlugins?: string[];
  onUpdateData: (nodeId: string, data: Record<string, unknown>) => void;
  debugNodeId?: string | null;
  debugStatus?: 'idle' | 'running' | 'completed' | 'error';
  debugResult?: DebugResult | null;
  onDebugNode?: (nodeId: string, inputs?: Record<string, unknown>) => void;
  onCancelDebug?: () => void;
}

export function WorkflowPropertiesPanel({
  node,
  nodes = [],
  edges = [],
  enabledPlugins = [],
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
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(() => new Set());
  const [variableModeEnabled, setVariableModeEnabled] = useState<Set<string>>(() => new Set());
  const [variableModeDisabled, setVariableModeDisabled] = useState<Set<string>>(() => new Set());
  const [nodeTestDialogOpen, setNodeTestDialogOpen] = useState(false);

  const definition = useMemo(() => node ? getNodeDefinition(node.type) : null, [node]);
  const data = useMemo(() => node?.data ?? {}, [node?.data]);
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
  const variableContext = useMemo<WorkflowVariableContext | undefined>(() => {
    if (!node) return undefined;
    return {
      nodes,
      edges,
      currentNodeId: node.id,
      enabledPlugins,
    };
  }, [edges, enabledPlugins, node, nodes]);

  const isVariableRef = (value: unknown): boolean => typeof value === 'string' && value.includes('{{');
  const isVariableModeActive = (key: string, value: unknown): boolean => {
    if (variableModeDisabled.has(key)) return false;
    return isVariableRef(value) || variableModeEnabled.has(key);
  };
  const toggleVariableMode = (key: string, value: unknown) => {
    if (isVariableModeActive(key, value)) {
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
  const clearVariableModeDisabledOverride = useCallback((key: string) => {
    if (!variableModeDisabled.has(key)) return;
    setVariableModeDisabled((current) => {
      const next = new Set(current);
      next.delete(key);
      return next;
    });
  }, [variableModeDisabled]);
  const handleDataChange = useCallback((key: string, value: unknown) => {
    if (!node) return;
    clearVariableModeDisabledOverride(key);
    onUpdateData(node.id, { [key]: value });
  }, [clearVariableModeDisabledOverride, node, onUpdateData]);
  const toVariableInputValue = (value: unknown): string | number => {
    if (typeof value === 'string' || typeof value === 'number') return value;
    if (typeof value === 'boolean') return String(value);
    return '';
  };
  const insertVariable = (key: string, variablePath: string) => {
    handleDataChange(key, variablePath);
  };

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
          <Input
            value={String(data.label ?? node.label ?? '')}
            onChange={(e) => handleDataChange('label', e.target.value)}
            className="h-auto border-0 bg-transparent p-0 text-sm font-medium shadow-none outline-none ring-0 focus-visible:ring-0"
          />
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
        {canEditInputFields && <Badge variant="outline" className="h-5 cursor-pointer rounded px-2 text-[10px]" onClick={() => document.getElementById('input-fields-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>输入</Badge>}
        {canEditOutputFields && <Badge variant="outline" className="h-5 cursor-pointer rounded px-2 text-[10px]" onClick={() => document.getElementById('output-fields-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>输出</Badge>}
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
                  const fields = getOutputFields(data.inputFields);
                  if (fields.length > 0) {
                    setNodeTestDialogOpen(true);
                  } else {
                    onDebugNode(node.id);
                  }
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
        <div className="space-y-4 p-3 pt-0">
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
                  <span className="text-[10px] text-muted-foreground">{debugResult.duration}ms</span>
                )}
                <X
                  className="ml-auto h-3.5 w-3.5 shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
                  onClick={() => onCancelDebug?.()}
                />
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
            {visibleProperties.map(prop => (
              <Collapsible
                key={prop.key}
                open={!collapsedKeys.has(prop.key)}
                onOpenChange={(open) => {
                  setCollapsedKeys((current) => {
                    const next = new Set(current);
                    if (open) next.delete(prop.key);
                    else next.add(prop.key);
                    return next;
                  });
                }}
                className="space-y-1"
              >
                <div className="flex items-center gap-1 text-xs font-medium">
                  <CollapsibleTriggerAsChild>
                    <button
                      type="button"
                      className="flex flex-1 items-center gap-1 rounded px-0.5 text-left transition-colors hover:bg-accent/50"
                    >
                      <ChevronRight
                        className={`h-3 w-3 shrink-0 text-muted-foreground transition-transform ${!collapsedKeys.has(prop.key) ? 'rotate-90' : ''}`}
                      />
                      <span className="flex min-w-0 items-center gap-1">
                        <span className="truncate">{prop.label}</span>
                        {prop.required && <span className="text-destructive">*</span>}
                        {prop.tooltip && (
                          <TooltipProvider delay={300}>
                            <Tooltip>
                              <TooltipTrigger>
                                <Info className="h-3 w-3 cursor-help text-muted-foreground" />
                              </TooltipTrigger>
                              <TooltipContent side="right" className="max-w-[240px]">
                                <p>{prop.tooltip}</p>
                                <p className="mt-0.5 text-[10px] opacity-60">类型: {prop.type}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </span>
                    </button>
                  </CollapsibleTriggerAsChild>
                  <button
                    type="button"
                    className={`rounded p-0.5 transition-colors hover:bg-accent ${isVariableModeActive(prop.key, getPropertyValue(prop, data)) ? 'text-primary' : 'text-muted-foreground'}`}
                    title="切换变量模式"
                    onClick={() => toggleVariableMode(prop.key, getPropertyValue(prop, data))}
                  >
                    <Braces className="h-3.5 w-3.5" />
                  </button>
                </div>
                <CollapsibleContent>
                  <PropertyField
                    prop={prop}
                    value={getPropertyValue(prop, data)}
                    onChange={(value) => handleDataChange(prop.key, value)}
                    variableContext={variableContext}
                    variableMode={isVariableModeActive(prop.key, getPropertyValue(prop, data))}
                    variableValue={toVariableInputValue(getPropertyValue(prop, data))}
                    onInsertVariable={(path) => insertVariable(prop.key, path)}
                  />
                </CollapsibleContent>
              </Collapsible>
            ))}
          </section>

          {canEditInputFields && (
            <section id="input-fields-section" className="space-y-2 ">
              <div className="text-xs font-medium text-muted-foreground">
                {node.type === 'sub_workflow' ? '开始节点输入' : '输入字段'}
              </div>
              <OutputFieldsEditor
                value={getOutputFields(data.inputFields)}
                onChange={(value) => handleDataChange('inputFields', value)}
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
                variableContext={variableContext}
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

      {node && (
        <ExecutionNodeDialog
          open={nodeTestDialogOpen}
          fields={getOutputFields(data.inputFields)}
          nodeLabel={node.label || '节点'}
          onOpenChange={setNodeTestDialogOpen}
          onSubmit={inputs => onDebugNode?.(node.id, inputs)}
        />
      )}
    </div>
  );
}
