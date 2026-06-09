'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import type { NodeTypeDefinition, PluginConfigField, Workflow } from '@agent-spaces/shared';
import { getNodeDefinitionsByCategory, registerPluginNodeDefinitions, searchNodeDefinitions } from '@/lib/workflow-nodes';
import { pluginApi, workflowPluginSchemeApi, type WorkflowPlugin } from '@/lib/workflow-plugin-api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible, CollapsibleContent,
} from '@/components/ui/collapsible';
import {
  HoverCard, HoverCardContent, HoverCardTrigger,
} from '@/components/ui/hover-card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command, CommandGroup, CommandItem, CommandList,
} from '@/components/ui/command';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { WorkflowPluginConfigDialog } from './workflow-plugin-config-dialog';
import { Search, ChevronDown, ChevronRight, Plus, Settings, Trash2, LayoutList, LayoutGrid } from 'lucide-react';
import { WorkflowNodeDefinitionIcon } from './workflow-node-icon';

export const WORKFLOW_NODE_DRAG_MIME = 'application/vueflow';

function stringToHsl(str: string, s: number, l: number): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const h = hash % 360;
  return `hsl(${h}, ${s}%, ${l}%)`;
}

export function WorkflowNodeSidebar({
  workflow,
  onWorkflowChange,
  onOpenPluginPicker,
}: {
  workflow?: Workflow | null;
  onWorkflowChange?: (workflow: Workflow) => void;
  onOpenPluginPicker?: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
  const [workflowPlugins, setWorkflowPlugins] = useState<WorkflowPlugin[]>([]);
  const [categoryPluginMap, setCategoryPluginMap] = useState<Record<string, string>>({});
  const [schemeMap, setSchemeMap] = useState<Record<string, string[]>>({});
  const [configPlugin, setConfigPlugin] = useState<{
    id: string;
    name: string;
    config: PluginConfigField[];
    schemeName?: string;
  } | null>(null);
  const [newSchemeDialogOpen, setNewSchemeDialogOpen] = useState(false);
  const [newSchemeName, setNewSchemeName] = useState('');
  const [newSchemePluginId, setNewSchemePluginId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  const enabledPlugins = useMemo(() => workflow?.enabledPlugins || [], [workflow?.enabledPlugins]);

  useEffect(() => {
    let cancelled = false;
    async function loadPluginNodes() {
      if (!enabledPlugins.length) {
        registerPluginNodeDefinitions([]);
        setWorkflowPlugins([]);
        setCategoryPluginMap({});
        setSchemeMap({});
        return;
      }
      const plugins = await pluginApi.listWorkflowPlugins();
      const enabledSet = new Set(enabledPlugins);
      const activePlugins = plugins.filter(plugin => enabledSet.has(plugin.id));
      const allNodes: NodeTypeDefinition[] = [];
      const catMap: Record<string, string> = {};
      for (const plugin of activePlugins) {
        try {
          const nodes = await pluginApi.getWorkflowNodes(plugin.id);
          allNodes.push(...nodes.map(node => ({
            ...node,
            pluginId: plugin.id,
            pluginIconPath: plugin.iconPath,
          })));
          for (const node of nodes) {
            if (node.category) catMap[node.category] = plugin.id;
          }
        } catch (error) {
          console.warn('[WorkflowNodeSidebar] failed to load plugin nodes', plugin.id, error);
        }
      }
      if (cancelled) return;
      registerPluginNodeDefinitions(allNodes);
      setWorkflowPlugins(activePlugins);
      setCategoryPluginMap(catMap);
    }
    void loadPluginNodes();
    return () => { cancelled = true; };
  }, [enabledPlugins]);

  const loadSchemes = useCallback(async () => {
    if (!workflow?.id) return;
    const pluginIds = Array.from(new Set(Object.values(categoryPluginMap)));
    const next: Record<string, string[]> = {};
    for (const pluginId of pluginIds) {
      try {
        next[pluginId] = await workflowPluginSchemeApi.list(workflow.id, pluginId);
      } catch {
        next[pluginId] = [];
      }
    }
    setSchemeMap(next);
  }, [workflow?.id, categoryPluginMap]);

  useEffect(() => {
    void loadSchemes();
  }, [loadSchemes]);

  const categories = useMemo(() => {
    if (searchQuery.trim()) {
      const results = searchNodeDefinitions(searchQuery);
      const grouped: Record<string, typeof results> = {};
      for (const def of results) {
        if (def.manualCreate === false) continue;
        if (!grouped[def.category]) grouped[def.category] = [];
        grouped[def.category].push(def);
      }
      return grouped;
    }
    return getNodeDefinitionsByCategory();
  }, [searchQuery, workflowPlugins]);

  const pluginById = useMemo(() => new Map(workflowPlugins.map(plugin => [plugin.id, plugin])), [workflowPlugins]);

  const toggleCategory = useCallback((cat: string) => {
    setOpenCategories(prev => ({ ...prev, [cat]: prev[cat] === undefined ? false : !prev[cat] }));
  }, []);

  const onDragStart = useCallback((event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData(WORKFLOW_NODE_DRAG_MIME, nodeType);
    event.dataTransfer.effectAllowed = 'move';
  }, []);

  const selectedScheme = useCallback((pluginId: string) => {
    return workflow?.pluginConfigSchemes?.[pluginId] || '';
  }, [workflow?.pluginConfigSchemes]);

  const selectScheme = useCallback((pluginId: string, schemeName: string) => {
    if (!workflow || !onWorkflowChange) return;
    const schemes = { ...(workflow.pluginConfigSchemes || {}) };
    if (schemeName) schemes[pluginId] = schemeName;
    else delete schemes[pluginId];
    onWorkflowChange({ ...workflow, pluginConfigSchemes: schemes });
  }, [workflow, onWorkflowChange]);

  const openPluginConfig = useCallback((pluginId: string) => {
    const plugin = pluginById.get(pluginId);
    if (!plugin?.config?.length) return;
    setConfigPlugin({
      id: plugin.id,
      name: plugin.name,
      config: plugin.config,
      schemeName: selectedScheme(plugin.id) || undefined,
    });
  }, [pluginById, selectedScheme]);

  const createScheme = useCallback(async () => {
    if (!workflow?.id || !newSchemePluginId || !newSchemeName.trim()) return;
    const name = newSchemeName.trim();
    await workflowPluginSchemeApi.create(workflow.id, newSchemePluginId, name);
    await loadSchemes();
    selectScheme(newSchemePluginId, name);
    setNewSchemeDialogOpen(false);
  }, [workflow?.id, newSchemePluginId, newSchemeName, loadSchemes, selectScheme]);

  const deleteCurrentScheme = useCallback(async (pluginId: string) => {
    const schemeName = selectedScheme(pluginId);
    if (!workflow?.id || !schemeName) return;
    await workflowPluginSchemeApi.delete(workflow.id, pluginId, schemeName);
    selectScheme(pluginId, '');
    await loadSchemes();
  }, [workflow?.id, selectedScheme, selectScheme, loadSchemes]);

  return (
    <div className="border-r border-border bg-background flex flex-col h-full w-full shrink-0">
      <div className="p-2 border-b border-border">
        <div className="relative flex items-center gap-1">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索节点..."
              className="pl-7 h-7 text-xs"
            />
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setViewMode(m => m === 'list' ? 'grid' : 'list')}>
            {viewMode === 'list' ? <LayoutGrid className="h-3.5 w-3.5" /> : <LayoutList className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onOpenPluginPicker}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-2 space-y-1">
            {Object.entries(categories).map(([category, nodes]) => (
              <Collapsible
                key={category}
                open={openCategories[category] !== false}
                onOpenChange={() => toggleCategory(category)}
              >
                <div
                  className="flex items-center w-full px-2 py-1 text-xs font-medium rounded hover:brightness-95"
                  style={{
                    backgroundColor: stringToHsl(category, 40, 92),
                    color: stringToHsl(category, 50, 30),
                  }}
                >
                  <span className="cursor-pointer shrink-0" onClick={() => toggleCategory(category)}>
                    {openCategories[category] !== false ? (
                      <ChevronDown className="h-3 w-3 opacity-60" />
                    ) : (
                      <ChevronRight className="h-3 w-3 opacity-60" />
                    )}
                  </span>
                  <span className="truncate ml-1">{category}</span>
                  <span className="ml-auto flex items-center gap-1">
                    {categoryPluginMap[category] && pluginById.get(categoryPluginMap[category])?.config?.length ? (
                      <>
                        <Popover>
                          <PopoverTrigger
                            nativeButton={false}
                            render={<span />}
                            className="inline-flex h-5 max-w-[92px] items-center gap-0.5 rounded px-1.5 text-[10px] hover:bg-muted cursor-pointer"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <span className="truncate">{selectedScheme(categoryPluginMap[category]) || '默认配置'}</span>
                            <ChevronDown className="h-2.5 w-2.5 shrink-0 opacity-50" />
                          </PopoverTrigger>
                          <PopoverContent className="w-44 p-0" align="end">
                            <Command>
                              <CommandList>
                                <CommandGroup>
                                  <CommandItem value="__default__" className="text-xs" onSelect={() => selectScheme(categoryPluginMap[category], '')}>
                                    默认配置
                                  </CommandItem>
                                  {(schemeMap[categoryPluginMap[category]] || []).map(name => (
                                    <CommandItem key={name} value={name} className="text-xs" onSelect={() => selectScheme(categoryPluginMap[category], name)}>
                                      {name}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                                <CommandGroup>
                                  <CommandItem
                                    className="text-xs text-primary"
                                    onSelect={() => {
                                      setNewSchemePluginId(categoryPluginMap[category]);
                                      setNewSchemeName('');
                                      setNewSchemeDialogOpen(true);
                                    }}
                                  >
                                    <Plus className="mr-1 h-3 w-3" /> 新增方案
                                  </CommandItem>
                                  {selectedScheme(categoryPluginMap[category]) ? (
                                    <CommandItem className="text-xs text-destructive" onSelect={() => deleteCurrentScheme(categoryPluginMap[category])}>
                                      <Trash2 className="mr-1 h-3 w-3" /> 删除当前方案
                                    </CommandItem>
                                  ) : null}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <Button variant="ghost" size="icon" className="h-4 w-4" onClick={(event) => { event.stopPropagation(); openPluginConfig(categoryPluginMap[category]); }}>
                          <Settings className="h-3 w-3" />
                        </Button>
                      </>
                    ) : null}
                    <span className="text-[10px]">{nodes.length}</span>
                  </span>
                </div>
                <CollapsibleContent>
                  <div className={viewMode === 'grid' ? 'grid grid-cols-2 gap-1 mt-0.5' : 'space-y-0.5 mt-0.5'}>
                    {nodes.map((node) => (
                      <HoverCard key={node.type} openDelay={400} closeDelay={100}>
                        <HoverCardTrigger className={viewMode === 'grid' ? 'contents' : undefined}>
                          <div
                            draggable
                            className={viewMode === 'grid'
                              ? 'flex flex-col items-center gap-1 px-2 py-2 text-xs rounded cursor-grab hover:bg-muted/50 active:cursor-grabbing text-center'
                              : 'flex items-center gap-2 px-2 py-1.5 text-xs rounded cursor-grab hover:bg-muted/50 active:cursor-grabbing'}
                            onDragStart={(e) => onDragStart(e, node.type)}
                          >
                            <WorkflowNodeDefinitionIcon definition={node} className={viewMode === 'grid' ? 'h-5 w-5 shrink-0 text-muted-foreground' : 'h-3.5 w-3.5 shrink-0 text-muted-foreground'} />
                            <div className="min-w-0 w-full">
                              <div className="truncate">{node.label}</div>
                              {node.description && viewMode === 'list' && (
                                <div className="text-[10px] text-muted-foreground truncate">{node.description}</div>
                              )}
                            </div>
                          </div>
                        </HoverCardTrigger>
                        <HoverCardContent className="w-72 p-3" side="right">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <WorkflowNodeDefinitionIcon definition={node} className="h-4 w-4 shrink-0 text-muted-foreground" />
                              <span className="text-sm font-semibold">{node.label}</span>
                              <span className="text-[10px] text-muted-foreground font-mono ml-auto">{node.type}</span>
                            </div>
                            {node.description && (
                              <p className="text-xs text-muted-foreground">{node.description}</p>
                            )}
                            {node.properties?.length > 0 && (
                              <div className="space-y-1">
                                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">参数</div>
                                {node.properties.map(prop => (
                                  <div key={prop.key} className="flex items-center gap-1.5 text-xs">
                                    <span className="font-mono text-muted-foreground">{prop.key}</span>
                                    <span
                                      className="text-[10px] px-1 rounded font-medium"
                                      style={{ backgroundColor: stringToHsl(prop.type, 45, 90), color: stringToHsl(prop.type, 55, 35) }}
                                    >{prop.type}</span>
                                    {prop.required && <span className="text-[10px] text-destructive">*</span>}
                                  </div>
                                ))}
                              </div>
                            )}
                            {node.outputs && node.outputs.length > 0 && (
                              <div className="space-y-1">
                                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">输出</div>
                                <div className="flex flex-wrap gap-1">
                                  {node.outputs!.map(output => (
                                    <span
                                      key={output.key}
                                      className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                                      style={{ backgroundColor: stringToHsl(output.key, 45, 90), color: stringToHsl(output.key, 55, 35) }}
                                    >
                                      {output.key}{output.type !== 'any' && <span className="opacity-60">: {output.type}</span>}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </HoverCardContent>
                      </HoverCard>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        </ScrollArea>
      </div>
      <AlertDialog open={newSchemeDialogOpen} onOpenChange={setNewSchemeDialogOpen}>
        <AlertDialogContent className="sm:max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>新增配置方案</AlertDialogTitle>
            <AlertDialogDescription>输入方案名称，将基于插件默认配置创建新方案。</AlertDialogDescription>
          </AlertDialogHeader>
          <Input value={newSchemeName} onChange={(event) => setNewSchemeName(event.target.value)} placeholder="方案名称" className="text-sm" />
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction disabled={!newSchemeName.trim()} onClick={createScheme}>创建</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <WorkflowPluginConfigDialog
        open={Boolean(configPlugin)}
        onOpenChange={(open) => { if (!open) setConfigPlugin(null); }}
        pluginId={configPlugin?.id || null}
        pluginName={configPlugin?.name || ''}
        config={configPlugin?.config || []}
        workflowId={workflow?.id}
        schemeName={configPlugin?.schemeName}
      />
    </div>
  );
}
