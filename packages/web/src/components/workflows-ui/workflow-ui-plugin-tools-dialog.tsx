"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, PackagePlus, Play, Wrench } from 'lucide-react';
import { fetchWithAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { sdk } from '@/lib/sdk';
import { resolveServerAssetUrl } from '@/lib/server';
import { pluginApi, type WorkflowPlugin } from '@/lib/workflow-plugin-api';
import { WorkflowPluginsDialog } from '@/components/workflow/workflow-plugins-dialog';
import { WorkflowUiToolExecuteDialog } from './workflow-ui-tool-execute-dialog';
import { PluginIcon } from '@/components/workflow/workflow-plugin-icon';
import type { Workflow } from '@agent-spaces/shared';

interface PluginTool {
  name: string;
  description: string;
  input_schema?: Record<string, unknown>;
}

interface WorkflowUiPluginToolsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  enabledPlugins: string[];
  onEnabledPluginsChange: (plugins: string[]) => void;
}

export function WorkflowUiPluginToolsDialog({
  open,
  onOpenChange,
  projectId,
  enabledPlugins,
  onEnabledPluginsChange,
}: WorkflowUiPluginToolsDialogProps) {
  const t = useTranslations('workflows-ui');
  const [plugins, setPlugins] = useState<WorkflowPlugin[]>([]);
  const [toolsByPlugin, setToolsByPlugin] = useState<Record<string, PluginTool[]>>({});
  const [loading, setLoading] = useState(false);
  const [pluginsDialogOpen, setPluginsDialogOpen] = useState(false);
  const [executeDialog, setExecuteDialog] = useState<{
    pluginId: string;
    pluginName: string;
    pluginIconPath?: string;
    tool: PluginTool;
  } | null>(null);

  // Adapt project enabledPlugins to Workflow shape for WorkflowPluginsDialog
  const adapterWorkflow: Workflow = useMemo(() => ({
    id: projectId,
    name: '',
    folderId: null,
    nodes: [],
    edges: [],
    createdAt: 0,
    updatedAt: 0,
    enabledPlugins,
  }), [projectId, enabledPlugins]);

  const enabledSet = useMemo(() => new Set(enabledPlugins), [enabledPlugins]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const allPlugins = await pluginApi.list();
        if (cancelled) return;
        setPlugins(allPlugins);

        // load tools for each plugin
        const map: Record<string, PluginTool[]> = {};
        await Promise.all(
          allPlugins.map(async (p) => {
            try {
              const resp = await fetchWithAuth(`/api/plugins/${p.id}/tools`);
              if (resp.ok) {
                const tools = await resp.json();
                if (tools.length > 0) map[p.id] = tools;
              }
            } catch { /* ignore */ }
          }),
        );
        if (!cancelled) setToolsByPlugin(map);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [open]);

  const handleTogglePlugin = useCallback(async (pluginId: string) => {
    const next = new Set(enabledPlugins);
    const enabling = !next.has(pluginId);
    if (enabling) {
      next.add(pluginId);
      // enable the plugin globally if not already
      const plugin = plugins.find(p => p.id === pluginId);
      if (plugin && !plugin.enabled) {
        await pluginApi.enable(pluginId);
        setPlugins(items => items.map(item => item.id === pluginId ? { ...item, enabled: true } : item));
      }
    } else {
      next.delete(pluginId);
    }
    onEnabledPluginsChange(Array.from(next));
    await sdk.workflowUi.update(projectId, { enabledPlugins: Array.from(next) });
  }, [enabledPlugins, plugins, projectId, onEnabledPluginsChange]);

  const handleOpenToolDialog = useCallback((pluginId: string, pluginName: string, pluginIconPath: string | undefined, tool: PluginTool) => {
    setExecuteDialog({ pluginId, pluginName, pluginIconPath, tool });
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!w-[80vw] !h-[80vh] !max-w-none sm:!max-w-none !flex !flex-col !overflow-hidden"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-4 w-4" /> {t('pluginTools.title')}
            <div className="flex-1" />
            <Button variant="ghost" size="sm" className="h-6 gap-1 text-xs me-8" onClick={() => setPluginsDialogOpen(true)}>
              <PackagePlus className="h-3 w-3" /> {t('pluginTools.store')}
            </Button>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : plugins.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {t('pluginTools.noPlugins')}
          </div>
        ) : (
          <ScrollArea className="flex-1 min-h-0">
            <div className="space-y-4">
              {plugins.map((plugin) => {
                const isEnabled = enabledSet.has(plugin.id);
                const tools = toolsByPlugin[plugin.id] || [];
                return (
                  <div key={plugin.id} className="rounded-md border">
                    {/* Group header */}
                    <div className="flex items-center gap-2 px-3 py-2 bg-muted/40">
                      <PluginIcon
                        source={plugin.iconPath ? { type: 'url', url: resolveServerAssetUrl(`/api/plugins/${plugin.id}/icon`) } : { type: 'builtin', variant: 'local' }}
                      />
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-medium">{plugin.name}</span>
                        <span className="ml-1.5 text-[10px] text-muted-foreground">{plugin.version}</span>
                        {tools.length > 0 && (
                          <Badge variant="secondary" className="ml-2 text-[10px]">{t('pluginTools.tools', { count: tools.length })}</Badge>
                        )}
                      </div>
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={() => handleTogglePlugin(plugin.id)}
                        className="scale-75"
                      />
                    </div>
                    {/* Plugin description */}
                    <div className="px-3 py-1 text-[11px] text-muted-foreground">{plugin.description}</div>
                    {/* Tools cards grid */}
                    {tools.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 p-3">
                        {tools.map((tool) => (
                          <div
                            key={tool.name}
                            className="group flex flex-col gap-1 rounded-md border p-2 hover:bg-muted cursor-pointer transition-colors"
                            onClick={() => handleOpenToolDialog(plugin.id, plugin.name, plugin.iconPath, tool)}
                          >
                            <div className="flex items-center gap-1.5">
                              <Wrench className="h-3 w-3 shrink-0 text-muted-foreground" />
                              <span className="font-mono text-xs font-medium truncate">{tool.name}</span>
                            </div>
                            {tool.description && (
                              <span className="text-[11px] text-muted-foreground line-clamp-2">{tool.description}</span>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="mt-auto h-5 self-end opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => { e.stopPropagation(); handleOpenToolDialog(plugin.id, plugin.name, plugin.iconPath, tool); }}
                            >
                              <Play className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}

      </DialogContent>

      <WorkflowUiToolExecuteDialog
        open={!!executeDialog}
        onOpenChange={(nextOpen) => { if (!nextOpen) setExecuteDialog(null); }}
        pluginId={executeDialog?.pluginId ?? ''}
        pluginName={executeDialog?.pluginName ?? ''}
        pluginIconPath={executeDialog?.pluginIconPath}
        tool={executeDialog?.tool ?? null}
      />

      <WorkflowPluginsDialog
        open={pluginsDialogOpen}
        onOpenChange={(nextOpen) => {
          setPluginsDialogOpen(nextOpen);
          if (!nextOpen) {
            // Reload plugins after closing the store dialog
            pluginApi.list().then(setPlugins).catch(() => {});
          }
        }}
        workflow={adapterWorkflow}
        onWorkflowChange={(wf) => {
          const next = wf.enabledPlugins || [];
          onEnabledPluginsChange(next);
          sdk.workflowUi.update(projectId, { enabledPlugins: next });
        }}
      />
    </Dialog>
  );
}
