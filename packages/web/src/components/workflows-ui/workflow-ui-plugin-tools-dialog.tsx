"use client";

import { useCallback, useEffect, useState } from 'react';
import { Play, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { fetchWithAuth } from '@/lib/auth';

interface PluginTool {
  name: string;
  description: string;
  input_schema?: Record<string, unknown>;
}

interface WorkflowUiPluginToolsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enabledPlugins: string[];
}

export function WorkflowUiPluginToolsDialog({
  open,
  onOpenChange,
  enabledPlugins,
}: WorkflowUiPluginToolsDialogProps) {
  const [toolsByPlugin, setToolsByPlugin] = useState<Record<string, PluginTool[]>>({});
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !enabledPlugins.length) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      const map: Record<string, PluginTool[]> = {};
      for (const pluginId of enabledPlugins) {
        try {
          const resp = await fetchWithAuth(`/api/plugins/${pluginId}/tools`);
          if (resp.ok) {
            map[pluginId] = await resp.json();
          }
        } catch { /* ignore */ }
      }
      if (!cancelled) {
        setToolsByPlugin(map);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [open, enabledPlugins]);

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
            <Wrench className="h-4 w-4" /> 插件 Tools
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">加载中...</div>
        ) : Object.keys(toolsByPlugin).length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            未启用任何插件，或插件没有注册 tools
          </div>
        ) : (
          <ScrollArea className="max-h-96">
            <div className="space-y-4">
              {Object.entries(toolsByPlugin).map(([pluginId, tools]) => (
                <div key={pluginId}>
                  <div className="text-xs font-medium text-muted-foreground mb-1.5">
                    {pluginId}
                    <Badge variant="secondary" className="ml-2 text-[10px]">{tools.length} tools</Badge>
                  </div>
                  <div className="space-y-1">
                    {tools.map((tool) => (
                      <div key={tool.name} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted text-xs">
                        <div className="min-w-0 flex-1">
                          <div className="font-mono font-medium truncate">{tool.name}</div>
                          {tool.description && <div className="text-muted-foreground truncate">{tool.description}</div>}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 shrink-0"
                          disabled={executing === `${pluginId}/${tool.name}`}
                          onClick={() => handleExecute(pluginId, tool.name)}
                        >
                          <Play className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {result && (
          <div className="mt-2 rounded border bg-muted/50 p-3 max-h-32 overflow-auto">
            <pre className="text-xs font-mono whitespace-pre-wrap">{result}</pre>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
