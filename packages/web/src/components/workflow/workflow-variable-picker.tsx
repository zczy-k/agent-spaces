'use client';

import { useEffect, useMemo, useState } from 'react';
import type { OutputField, PluginConfigField, WorkflowEdge, WorkflowNode } from '@agent-spaces/shared';
import { getCompositeParentId, isGeneratedWorkflowNode } from '@agent-spaces/shared';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Braces } from 'lucide-react';
import { getNodeDefinition } from '@/lib/workflow-nodes';
import { pluginApi, type WorkflowPlugin } from '@/lib/workflow-plugin-api';

type VariableField = OutputField & {
  expressionPath?: string;
  children?: VariableField[];
};

export interface WorkflowVariableContext {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  currentNodeId?: string | null;
  enabledPlugins?: string[];
}

interface VariablePickerProps extends WorkflowVariableContext {
  excludeNodeId?: string | null;
  onSelect: (path: string) => void;
  children?: React.ReactNode;
}

function getConnectedNodeIds(edges: WorkflowEdge[], nodeId: string): Set<string> {
  const connected = new Set<string>();
  for (const edge of edges) {
    if (edge.source === nodeId) connected.add(edge.target);
    if (edge.target === nodeId) connected.add(edge.source);
  }
  return connected;
}

function getNodeLabel(node: WorkflowNode): string {
  const def = getNodeDefinition(node.type);
  return node.label || def?.label || node.type;
}

function getNodeOutputs(node: WorkflowNode): OutputField[] {
  return Array.isArray(node.data?.outputs) ? node.data.outputs as OutputField[] : [];
}

function getNodeInputFields(node: WorkflowNode): OutputField[] {
  return Array.isArray(node.data?.inputFields) ? node.data.inputFields as OutputField[] : [];
}

function buildVariablePath(nodeId: string, fieldPath: string): string {
  return `{{ __data__["${nodeId}"].${fieldPath} }}`;
}

function buildInputFieldPath(nodeId: string, fieldPath: string): string {
  return `{{ __inputs__["${nodeId}"].${fieldPath} }}`;
}

function buildLoopVariablePath(fieldPath: string): string {
  return `{{ __loop__.${fieldPath} }}`;
}

function buildConfigPath(pluginId: string, key: string): string {
  return `{{ __config__["${pluginId}"]["${key}"] }}`;
}

function mapLoopSharedVariables(fields: OutputField[], parentPath = 'vars'): VariableField[] {
  return fields.map((field) => {
    const expressionPath = `${parentPath}.${field.key}`;
    return {
      ...field,
      expressionPath,
      children: field.children ? mapLoopSharedVariables(field.children, expressionPath) : undefined,
    };
  });
}

function buildFieldPath(field: VariableField, parentPath?: string): string {
  if (field.expressionPath) return field.expressionPath;
  return parentPath ? `${parentPath}.${field.key}` : field.key;
}

function VariableFieldMenu({
  fields,
  nodeId,
  parentPath,
  onSelect,
}: {
  fields: VariableField[];
  nodeId: string;
  parentPath?: string;
  onSelect: (nodeId: string, fieldPath: string) => void;
}) {
  return (
    <>
      {fields.map((field, index) => {
        const path = buildFieldPath(field, parentPath);
        const key = `${path}-${index}`;
        if (field.type === 'object' && field.children?.length) {
          return (
            <DropdownMenuSub key={key}>
              <DropdownMenuSubTrigger className="text-xs">
                <span className="mr-1.5 font-mono text-[10px] text-muted-foreground">object</span>
                <span className="truncate">{field.key}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="min-w-[180px]">
                <VariableFieldMenu
                  fields={field.children}
                  nodeId={nodeId}
                  parentPath={path}
                  onSelect={onSelect}
                />
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          );
        }

        return (
          <DropdownMenuItem
            key={key}
            className="text-xs"
            onClick={() => onSelect(nodeId, path)}
          >
            <span className="mr-1.5 font-mono text-[10px] text-muted-foreground">{field.type}</span>
            <span className="truncate">{field.key}</span>
          </DropdownMenuItem>
        );
      })}
    </>
  );
}

function EmptyMenuItem({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2 py-1.5 text-xs text-muted-foreground">
      {children}
    </div>
  );
}

export function WorkflowVariablePicker({
  nodes,
  edges,
  currentNodeId,
  excludeNodeId,
  enabledPlugins = [],
  onSelect,
  children,
}: VariablePickerProps) {
  const activeNodeId = currentNodeId || excludeNodeId || null;
  const currentNode = useMemo(
    () => nodes.find((node) => node.id === activeNodeId) ?? null,
    [activeNodeId, nodes],
  );
  const [plugins, setPlugins] = useState<WorkflowPlugin[]>([]);

  useEffect(() => {
    if (!enabledPlugins.length) {
      setPlugins([]);
      return;
    }

    let cancelled = false;
    pluginApi.listWorkflowPlugins()
      .then((items) => {
        if (cancelled) return;
        const enabled = new Set(enabledPlugins);
        setPlugins((items as WorkflowPlugin[]).filter((plugin) => enabled.has(plugin.id) && plugin.config?.length));
      })
      .catch(() => {
        if (!cancelled) setPlugins([]);
      });

    return () => {
      cancelled = true;
    };
  }, [enabledPlugins]);

  const loopParentNode = useMemo(() => {
    if (!currentNode) return null;
    const parentId = getCompositeParentId(currentNode);
    if (!parentId) return null;
    return nodes.find((node) => node.id === parentId && node.type === 'loop') ?? null;
  }, [currentNode, nodes]);

  const isInLoopBody = Boolean(loopParentNode && currentNode && isGeneratedWorkflowNode(currentNode));
  const connectedNodeIds = useMemo(
    () => activeNodeId ? getConnectedNodeIds(edges, activeNodeId) : new Set<string>(),
    [activeNodeId, edges],
  );

  const otherNodes = useMemo(() => {
    if (!activeNodeId) return [];
    const hidden = new Set([activeNodeId]);
    if (isInLoopBody && loopParentNode) {
      hidden.add(loopParentNode.id);
      for (const node of nodes) {
        if (node.type === 'loop_body' && getCompositeParentId(node) === loopParentNode.id) hidden.add(node.id);
      }
    }
    return nodes.filter((node) => connectedNodeIds.has(node.id) && !hidden.has(node.id));
  }, [activeNodeId, connectedNodeIds, isInLoopBody, loopParentNode, nodes]);

  const workflowInputNode = useMemo(
    () => nodes.find((node) => node.type === 'start') ?? null,
    [nodes],
  );
  const workflowInputFields = workflowInputNode ? getNodeInputFields(workflowInputNode) : [];
  const inputMenuNodes = otherNodes.filter((node) => node.type !== 'start' && node.type !== 'end');
  const outputMenuNodes = inputMenuNodes;
  const loopBodyNodes = isInLoopBody
    ? otherNodes.filter((node) => node.id !== activeNodeId && node.type !== 'start')
    : [];
  const loopVariableFields = useMemo<VariableField[]>(() => {
    if (!isInLoopBody || !loopParentNode) return [];
    const fields: VariableField[] = [{ key: 'index', type: 'number', expressionPath: 'index' }];
    if (loopParentNode.data?.loopType === 'array') fields.push({ key: 'item', type: 'any', expressionPath: 'item' });
    const sharedVariables = Array.isArray(loopParentNode.data?.sharedVariables)
      ? loopParentNode.data.sharedVariables as OutputField[]
      : [];
    fields.push(...mapLoopSharedVariables(sharedVariables));
    return fields;
  }, [isInLoopBody, loopParentNode]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        {children || (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
            title="插入变量"
          >
            <Braces className="h-3.5 w-3.5" />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {workflowInputNode && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="text-xs font-medium">工作流输入</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="min-w-[180px]">
              {workflowInputFields.length > 0 ? (
                <VariableFieldMenu
                  fields={workflowInputFields}
                  nodeId={workflowInputNode.id}
                  onSelect={(nodeId, fieldPath) => onSelect(buildVariablePath(nodeId, fieldPath))}
                />
              ) : (
                <EmptyMenuItem>无输入字段</EmptyMenuItem>
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="text-xs font-medium">节点输入</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-56">
            {inputMenuNodes.length === 0 ? (
              <EmptyMenuItem>没有直接相连的节点</EmptyMenuItem>
            ) : inputMenuNodes.map((node) => (
              <DropdownMenuSub key={node.id}>
                <DropdownMenuSubTrigger className="text-xs">
                  <span className="truncate">{getNodeLabel(node)}</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="min-w-[180px]">
                  {getNodeInputFields(node).length > 0 ? (
                    <VariableFieldMenu
                      fields={getNodeInputFields(node)}
                      nodeId={node.id}
                      onSelect={(nodeId, fieldPath) => onSelect(buildInputFieldPath(nodeId, fieldPath))}
                    />
                  ) : (
                    <EmptyMenuItem>无输入字段</EmptyMenuItem>
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="text-xs font-medium">节点输出</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-56">
            {outputMenuNodes.length === 0 ? (
              <EmptyMenuItem>没有直接相连的节点</EmptyMenuItem>
            ) : outputMenuNodes.map((node) => (
              <DropdownMenuSub key={node.id}>
                <DropdownMenuSubTrigger className="text-xs">
                  <span className="truncate">{getNodeLabel(node)}</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="min-w-[180px]">
                  {getNodeOutputs(node).length > 0 ? (
                    <VariableFieldMenu
                      fields={getNodeOutputs(node)}
                      nodeId={node.id}
                      onSelect={(nodeId, fieldPath) => onSelect(buildVariablePath(nodeId, fieldPath))}
                    />
                  ) : (
                    <EmptyMenuItem>无输出字段</EmptyMenuItem>
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {loopBodyNodes.length > 0 && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="text-xs font-medium">循环体变量</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-56">
              {loopBodyNodes.map((node) => (
                <DropdownMenuSub key={node.id}>
                  <DropdownMenuSubTrigger className="text-xs">
                    <span className="truncate">{getNodeLabel(node)}</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="min-w-[180px]">
                    {getNodeOutputs(node).length > 0 ? (
                      <VariableFieldMenu
                        fields={getNodeOutputs(node)}
                        nodeId={node.id}
                        onSelect={(nodeId, fieldPath) => onSelect(buildVariablePath(nodeId, fieldPath))}
                      />
                    ) : (
                      <EmptyMenuItem>无输出字段</EmptyMenuItem>
                    )}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        {loopVariableFields.length > 0 && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="text-xs font-medium">中间变量</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-56">
              <VariableFieldMenu
                fields={loopVariableFields}
                nodeId="__loop__"
                onSelect={(_nodeId, fieldPath) => onSelect(buildLoopVariablePath(fieldPath))}
              />
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        {plugins.length > 0 && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="text-xs font-medium">配置属性</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-56">
              {plugins.map((plugin) => (
                <DropdownMenuSub key={plugin.id}>
                  <DropdownMenuSubTrigger className="text-xs">
                    <span className="truncate">{plugin.name}</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="min-w-[180px]">
                    {(plugin.config as PluginConfigField[] | undefined)?.map((field) => (
                      <DropdownMenuItem
                        key={field.key}
                        className="text-xs"
                        onClick={() => onSelect(buildConfigPath(plugin.id, field.key))}
                      >
                        <span className="mr-1 font-mono text-[10px] text-muted-foreground">{field.type}</span>
                        <span className="truncate">{field.label}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function VariableReference({ path }: { path: string }) {
  return (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px] text-blue-600 dark:text-blue-400">
      {path}
    </code>
  );
}
