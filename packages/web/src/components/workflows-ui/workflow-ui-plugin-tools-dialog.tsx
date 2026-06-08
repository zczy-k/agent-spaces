"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { pluginApi, type WorkflowPlugin } from '@/lib/workflow-plugin-api';
import { WorkflowPluginsDialog } from '@/components/workflow/workflow-plugins-dialog';
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
  const [plugins, setPlugins] = useState<WorkflowPlugin[]>([]);
  const [toolsByPlugin, setToolsByPlugin] = useState<Record<string, PluginTool[]>>({});
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [pluginsDialogOpen, setPluginsDialogOpen] = useState(false);

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

  const handleExecute = useCallback(async (pluginId: string, toolName: string) => {
    setExecuting(`${pluginId}/${toolName}`);
    setResult(null);
    try {
      const resp = await fetchWithAuth(`/api/plugins/${pluginId}/tools/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: toolName, args: {} }),
      });
      const data = await resp.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (error: any) {
      setResult(`Error: ${error.message}`);
    } finally {
      setExecuting(null);
    }
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-4 w-4" /> 插件管理
            <div className="flex-1" />
            <Button variant="ghost" size="sm" className="h-6 gap-1 text-xs" onClick={() => setPluginsDialogOpen(true)}>
              <PackagePlus className="h-3 w-3" /> 插件商店
            </Button>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : plugins.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            未安装任何插件
          </div>
        ) : (
          <ScrollArea className="max-h-96">
            <div className="space-y-3">
              {plugins.map((plugin) => {
                const isEnabled = enabledSet.has(plugin.id);
                const tools = toolsByPlugin[plugin.id] || [];
                return (
                  <div key={plugin.id} className="rounded-md border">
                    {/* Group header */}
                    <div className="flex items-center gap-2 px-3 py-2 bg-muted/40">
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-medium">{plugin.name}</span>
                        <span className="ml-1.5 text-[10px] text-muted-foreground">{plugin.version}</span>
                        {tools.length > 0 && (
                          <Badge variant="secondary" className="ml-2 text-[10px]">{tools.length} tools</Badge>
                        )}
                      </div>
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={() => handleTogglePlugin(plugin.id)}
                        className="scale-75"
                      />
                    </div>
                    {/* Plugin description */}
                    <div className="px-3 pb-1 text-[11px] text-muted-foreground">{plugin.description}</div>
                    {/* Tools list */}
                    {tools.length > 0 && (
                      <div className="border-t">
                        {tools.map((tool) => (
                          <div key={tool.name} className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted text-xs">
                            <div className="min-w-0 flex-1">
                              <div className="font-mono font-medium truncate">{tool.name}</div>
                              {tool.description && <div className="text-muted-foreground truncate">{tool.description}</div>}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 shrink-0"
                              disabled={executing === `${plugin.id}/${tool.name}`}
                              onClick={() => handleExecute(plugin.id, tool.name)}
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

        {result && (
          <div className="mt-2 rounded border bg-muted/50 p-3 max-h-32 overflow-auto">
            <pre className="text-xs font-mono whitespace-pre-wrap">{result}</pre>
          </div>
        )}
      </DialogContent>

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
