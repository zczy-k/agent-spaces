'use client';

import { useCallback, useMemo, useState } from 'react';
import { getNodeDefinition } from '@/lib/workflow-nodes';
import type { WorkflowEdge, WorkflowNode } from '@agent-spaces/shared';
import { Button } from '@/components/ui/button';
import { Copy, X } from 'lucide-react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  getOutputFields,
  getJsonPresets,
  isVisible,
  JSON_PRESETS_KEY,
  SELECTED_JSON_PRESET_KEY,
} from './workflow-properties-utils';
import type { DebugResult, JsonPreset } from './workflow-properties-utils';
import { JsonPreview } from './workflow-properties-fields';
import type { WorkflowVariableContext } from './workflow-variable-picker';
import { ExecutionNodeDialog } from './workflow-execution-node-dialog';
import { NodeHeader } from './workflow-properties-node-header';
import { Toolbar } from './workflow-properties-toolbar';
import { PropertiesList } from './workflow-properties-list';
import { IOFieldsSections } from './workflow-properties-io-sections';
import { ImportDialog } from './workflow-properties-import-dialog';
import { PresetDialog } from './workflow-properties-preset-dialog';

interface PropertiesPanelProps {
  node: WorkflowNode | null;
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
  enabledPlugins?: string[];
  onUpdateData: (nodeId: string, data: Record<string, unknown>) => void;
  debugNodeId?: string | null;
  debugStatus?: 'idle' | 'running' | 'completed' | 'error';
  debugResult?: DebugResult | null;
  onDebugNode?: (nodeId: string, inputs?: Record<string, unknown>, properties?: Record<string, unknown>) => void;
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
  const [presetOpen, setPresetOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState<JsonPreset | null>(null);
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(() => new Set());
  const [variableModeEnabled, setVariableModeEnabled] = useState<Set<string>>(() => new Set());
  const [variableModeDisabled, setVariableModeDisabled] = useState<Set<string>>(() => new Set());
  const [nodeTestDialogOpen, setNodeTestDialogOpen] = useState(false);

  // Derived values
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
    return { nodes, edges, currentNodeId: node.id, enabledPlugins };
  }, [edges, enabledPlugins, node, nodes]);

  // Handlers
  const isVariableRef = (value: unknown): boolean => typeof value === 'string' && value.includes('{{');
  const isVariableModeActive = (key: string, value: unknown): boolean => {
    if (variableModeDisabled.has(key)) return false;
    return isVariableRef(value) || variableModeEnabled.has(key);
  };
  const toggleVariableMode = (key: string, value: unknown) => {
    if (isVariableModeActive(key, value)) {
      setVariableModeEnabled((current) => { const next = new Set(current); next.delete(key); return next; });
      setVariableModeDisabled((current) => new Set(current).add(key));
    } else {
      setVariableModeDisabled((current) => { const next = new Set(current); next.delete(key); return next; });
      setVariableModeEnabled((current) => new Set(current).add(key));
    }
  };
  const clearVariableModeDisabledOverride = useCallback((key: string) => {
    if (!variableModeDisabled.has(key)) return;
    setVariableModeDisabled((current) => { const next = new Set(current); next.delete(key); return next; });
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
    setEditingPreset(null);
    setPresetOpen(true);
  };

  const openEditPresetDialog = (preset: JsonPreset) => {
    setEditingPreset(preset);
    setPresetOpen(true);
  };

  const handlePresetSave = (presets: JsonPreset[], newPresetId?: string) => {
    updateJsonPresets(presets);
    if (newPresetId) handleDataChange(SELECTED_JSON_PRESET_KEY, newPresetId);
  };

  // Empty states
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
      <NodeHeader
        node={node}
        data={data}
        definition={definition}
        jsonPresets={jsonPresets}
        selectedJsonPresetId={selectedJsonPresetId}
        selectedJsonPreset={selectedJsonPreset}
        onDataChange={handleDataChange}
        onAddPreset={openAddPresetDialog}
        onEditPreset={openEditPresetDialog}
        onUpdatePresets={updateJsonPresets}
      />

      <Toolbar
        node={node}
        data={data}
        canEditInputFields={canEditInputFields}
        canEditOutputFields={canEditOutputFields}
        canEditDelay={canEditDelay}
        canDebug={canDebugSelectedNode && Boolean(onDebugNode)}
        isDebugging={isDebugging}
        selectedJsonPreset={selectedJsonPreset}
        onDataChange={handleDataChange}
        onDebug={onDebugNode ?? (() => {})}
        onCancelDebug={onCancelDebug ?? (() => {})}
        onOpenTestDialog={() => setNodeTestDialogOpen(true)}
      />

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

          <PropertiesList
            properties={visibleProperties}
            data={data}
            collapsedKeys={collapsedKeys}
            onCollapsedChange={setCollapsedKeys}
            variableContext={variableContext}
            isVariableModeActive={isVariableModeActive}
            onToggleVariableMode={toggleVariableMode}
            toVariableInputValue={toVariableInputValue}
            onInsertVariable={insertVariable}
            onDataChange={handleDataChange}
          />

          <IOFieldsSections
            node={node}
            data={data}
            canEditInputFields={canEditInputFields}
            canEditOutputFields={canEditOutputFields}
            variableContext={variableContext}
            selectedJsonPreset={selectedJsonPreset}
            debugResult={debugResult}
            hasDebugOutput={hasDebugOutput}
            onDataChange={handleDataChange}
            onOpenImport={() => setImportOpen(true)}
          />
        </div>
      </ScrollArea>

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={(outputs) => handleDataChange('outputs', outputs)}
      />

      <PresetDialog
        open={presetOpen}
        onOpenChange={setPresetOpen}
        editingPreset={editingPreset}
        jsonPresets={jsonPresets}
        selectedJsonPresetId={selectedJsonPresetId}
        onSave={handlePresetSave}
      />

      {node && (
        <ExecutionNodeDialog
          open={nodeTestDialogOpen}
          inputFields={getOutputFields(data.inputFields)}
          properties={visibleProperties}
          propertyValues={data as Record<string, unknown>}
          nodeLabel={node.label || '节点'}
          onOpenChange={setNodeTestDialogOpen}
          onSubmit={({ inputs, properties }) => onDebugNode?.(node.id, inputs, properties)}
        />
      )}
    </div>
  );
}
