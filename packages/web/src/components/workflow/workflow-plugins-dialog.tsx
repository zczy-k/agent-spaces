'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Workflow } from '@agent-spaces/shared';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fetchStoreIndex } from '@/lib/agent-store';
import { pluginApi, type StoreWorkflowPlugin, type WorkflowPlugin } from '@/lib/workflow-plugin-api';
import {
  PackagePlus, RefreshCw, Search, Store,
} from 'lucide-react';
import { LocalPluginCard, StorePluginCard } from './workflow-plugin-card';
import { WorkflowPluginConfigDialog } from './workflow-plugin-config-dialog';

type PluginTab = 'local' | 'store';

export function WorkflowPluginsDialog({
  open,
  onOpenChange,
  workflow,
  onWorkflowChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflow: Workflow | null;
  onWorkflowChange: (workflow: Workflow) => void;
}) {
  const [activeTab, setActiveTab] = useState<PluginTab>('local');
  const [plugins, setPlugins] = useState<WorkflowPlugin[]>([]);
  const [storePlugins, setStorePlugins] = useState<StoreWorkflowPlugin[]>([]);
  const [loading, setLoading] = useState(false);
  const [storeLoading, setStoreLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState('__all__');
  const [status, setStatus] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [configPlugin, setConfigPlugin] = useState<WorkflowPlugin | null>(null);
  const [installingId, setInstallingId] = useState<string | null>(null);

  const enabledPluginIds = useMemo(() => new Set(workflow?.enabledPlugins || []), [workflow?.enabledPlugins]);
  const installedPluginIds = useMemo(() => new Set(plugins.map(plugin => plugin.id)), [plugins]);
  const workflowStorePlugins = useMemo(() => storePlugins.filter(plugin => plugin.hasWorkflow), [storePlugins]);
  const sourcePlugins = activeTab === 'store' ? workflowStorePlugins : plugins;

  const tags = useMemo(() => {
    const set = new Set<string>();
    for (const plugin of sourcePlugins) {
      for (const item of plugin.tags || []) set.add(item);
    }
    return Array.from(set).sort();
  }, [sourcePlugins]);

  const filteredLocal = useMemo(() => {
    const q = query.trim().toLowerCase();
    return plugins.filter((plugin) => {
      if (q && !plugin.name.toLowerCase().includes(q) && !plugin.description.toLowerCase().includes(q)) return false;
      if (tag !== '__all__' && !(plugin.tags || []).includes(tag)) return false;
      const inWorkflow = enabledPluginIds.has(plugin.id);
      if (status === 'enabled' && !inWorkflow) return false;
      if (status === 'disabled' && inWorkflow) return false;
      return true;
    });
  }, [plugins, query, tag, status, enabledPluginIds]);

  const filteredStore = useMemo(() => {
    const q = query.trim().toLowerCase();
    return workflowStorePlugins.filter((plugin) => {
      if (q && !plugin.name.toLowerCase().includes(q) && !plugin.description.toLowerCase().includes(q)) return false;
      if (tag !== '__all__' && !(plugin.tags || []).includes(tag)) return false;
      return true;
    });
  }, [workflowStorePlugins, query, tag]);

  async function loadPlugins() {
    setLoading(true);
    try {
      setPlugins(await pluginApi.listWorkflowPlugins());
    } finally {
      setLoading(false);
    }
  }

  async function loadStorePlugins() {
    setStoreLoading(true);
    try {
      setStorePlugins(await fetchStoreIndex<StoreWorkflowPlugin>('plugins/index.json'));
    } catch {
      setStorePlugins([]);
    } finally {
      setStoreLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    void loadPlugins();
    void loadStorePlugins();
  }, [open]);

  function updateWorkflowPlugins(pluginId: string, enabled: boolean) {
    if (!workflow) return;
    const current = new Set(workflow.enabledPlugins || []);
    if (enabled) current.add(pluginId);
    else current.delete(pluginId);
    onWorkflowChange({ ...workflow, enabledPlugins: Array.from(current) });
  }

  async function togglePlugin(plugin: WorkflowPlugin) {
    const nextEnabled = !enabledPluginIds.has(plugin.id);
    if (nextEnabled && !plugin.enabled) {
      await pluginApi.enable(plugin.id);
      setPlugins(items => items.map(item => item.id === plugin.id ? { ...item, enabled: true } : item));
    }
    updateWorkflowPlugins(plugin.id, nextEnabled);
  }

  async function uninstallPlugin(plugin: WorkflowPlugin) {
    await pluginApi.uninstall(plugin.id);
    setPlugins(items => items.filter(item => item.id !== plugin.id));
    updateWorkflowPlugins(plugin.id, false);
    toast.success(`已卸载 ${plugin.name}`);
  }

  async function installPlugin(plugin: StoreWorkflowPlugin) {
    if (installingId) return;
    setInstallingId(plugin.id);
    try {
      const installed = await pluginApi.installFromStore(plugin.id);
      setPlugins(items => items.some(item => item.id === installed.id) ? items : [...items, installed]);
      updateWorkflowPlugins(installed.id, true);
      toast.success(`已安装 ${installed.name}`);
    } catch (error: any) {
      toast.error(error?.message || '插件安装失败');
    } finally {
      setInstallingId(null);
    }
  }

  async function handleRefresh() {
    if (activeTab === 'store') await loadStorePlugins();
    else await loadPlugins();
  }

  function clearFilters() {
    setQuery('');
    setTag('__all__');
    setStatus('all');
  }

  function switchTab(tab: PluginTab) {
    setActiveTab(tab);
    setTag('__all__');
    setStatus('all');
  }

  const hasFilters = query || tag !== '__all__' || status !== 'all';
  const currentLoading = activeTab === 'store' ? storeLoading : loading;
  const filtered = activeTab === 'store' ? filteredStore : filteredLocal;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex h-[85vh] max-h-[85vh] flex-col gap-0 p-0 sm:max-w-[80vw]">
          <DialogHeader className="flex-row items-center gap-2 border-b px-4 py-2 pr-10">
            <DialogTitle className="text-sm font-semibold">插件管理</DialogTitle>
            <div className="flex items-center gap-1 rounded-md bg-muted p-0.5">
              <Button
                variant={activeTab === 'local' ? 'default' : 'ghost'}
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => switchTab('local')}
              >
                <PackagePlus className="h-3.5 w-3.5" />
                本地
              </Button>
              <Button
                variant={activeTab === 'store' ? 'default' : 'ghost'}
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => switchTab('store')}
              >
                <Store className="h-3.5 w-3.5" />
                插件商店
              </Button>
            </div>
            <div className="flex-1" />
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={handleRefresh}>
              <RefreshCw className={`h-3.5 w-3.5 ${currentLoading ? 'animate-spin' : ''}`} />
              刷新
            </Button>
          </DialogHeader>

          <div className="border-b px-4 py-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜索插件名称或描述..."
                  className="h-7 pl-8 text-xs"
                />
              </div>
              {tags.length > 0 && (
                <Select value={tag} onValueChange={(value) => setTag(value || '__all__')}>
                  <SelectTrigger className="h-7 w-[140px] text-xs">
                    <SelectValue placeholder="按标签过滤" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">全部标签</SelectItem>
                    {tags.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              {activeTab === 'local' && (
                <Select value={status} onValueChange={(value) => setStatus((value || 'all') as typeof status)}>
                  <SelectTrigger className="h-7 w-[120px] text-xs">
                    <SelectValue placeholder="全部状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部状态</SelectItem>
                    <SelectItem value="enabled">已添加</SelectItem>
                    <SelectItem value="disabled">未添加</SelectItem>
                  </SelectContent>
                </Select>
              )}
              {hasFilters && (
                <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={clearFilters}>清除</Button>
              )}
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="grid gap-3 p-4 md:grid-cols-2 lg:grid-cols-3">
              {activeTab === 'local' && filteredLocal.map((plugin) => (
                <LocalPluginCard
                  key={plugin.id}
                  plugin={plugin}
                  inWorkflow={enabledPluginIds.has(plugin.id)}
                  disabled={!workflow}
                  onToggleAction={() => togglePlugin(plugin)}
                  onConfigAction={() => setConfigPlugin(plugin)}
                  onUninstallAction={() => uninstallPlugin(plugin)}
                />
              ))}

              {activeTab === 'store' && filteredStore.map((plugin) => (
                <StorePluginCard
                  key={plugin.id}
                  plugin={plugin}
                  installed={installedPluginIds.has(plugin.id)}
                  installing={installingId === plugin.id}
                  onInstallAction={() => installPlugin(plugin)}
                />
              ))}

              {!currentLoading && filtered.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <p className="text-sm">{activeTab === 'store' ? '插件商店暂无匹配插件' : '没有匹配的插件'}</p>
                  <p className="mt-1 text-xs">{activeTab === 'store' ? '请检查商店配置或调整过滤条件' : '插件目录为空或当前过滤条件没有结果'}</p>
                </div>
              )}
              {currentLoading && (
                <div className="col-span-full flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <RefreshCw className="mb-2 h-6 w-6 animate-spin" />
                  <p className="text-sm">{activeTab === 'store' ? '加载插件商店...' : '加载插件...'}</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <WorkflowPluginConfigDialog
        open={Boolean(configPlugin)}
        onOpenChange={(nextOpen) => { if (!nextOpen) setConfigPlugin(null); }}
        pluginId={configPlugin?.id || null}
        pluginName={configPlugin?.name || ''}
        config={configPlugin?.config || []}
      />
    </>
  );
}
