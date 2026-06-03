'use client';

import { useState, useEffect, useCallback } from 'react';
import type { WorkflowVersion } from '@agent-spaces/shared';
import { workflowVersionApi } from '@/lib/workflow-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { Save, Trash2, RotateCcw, Plus, GitBranch, Loader2 } from 'lucide-react';

interface VersionPanelProps {
  workflowId: string;
  nodes: unknown[];
  edges: unknown[];
  onRestore: (version: WorkflowVersion) => void;
}

export function WorkflowVersionPanel({ workflowId, nodes, edges, onRestore }: VersionPanelProps) {
  const [versions, setVersions] = useState<WorkflowVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [versionName, setVersionName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const loadVersions = useCallback(async () => {
    try {
      const list = await workflowVersionApi.list(workflowId);
      setVersions(list);
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  useEffect(() => { loadVersions(); }, [loadVersions]);

  const handleCreate = useCallback(async () => {
    if (!versionName.trim()) return;
    setCreating(true);
    try {
      const v = await workflowVersionApi.add(workflowId, versionName.trim(), nodes as WorkflowVersion['snapshot']['nodes'], edges);
      setVersions(prev => [v, ...prev]);
      setDialogOpen(false);
      setVersionName('');
    } finally {
      setCreating(false);
    }
  }, [workflowId, versionName, nodes, edges]);

  const handleDelete = useCallback(async (id: string) => {
    await workflowVersionApi.delete(workflowId, id);
    setVersions(prev => prev.filter(v => v.id !== id));
    setConfirmDeleteId(null);
  }, [workflowId]);

  const handleRestore = useCallback((version: WorkflowVersion) => {
    onRestore(version);
  }, [onRestore]);

  const handleClear = useCallback(async () => {
    await workflowVersionApi.clear(workflowId);
    setVersions([]);
  }, [workflowId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium">{versions.length} 个版本</span>
          <div className="flex gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setDialogOpen(true)}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">保存当前版本</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {versions.length > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={handleClear}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">清空所有版本</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>

        {/* Version list */}
        {versions.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-6">
            暂无版本记录
          </div>
        ) : (
          <div className="space-y-1">
            {versions.map(v => (
              <div
                key={v.id}
                className="group flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent transition-colors"
              >
                <GitBranch className="h-3 w-3 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs truncate">{v.name}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {v.snapshot?.nodes?.length || 0} 节点 · {formatTime(v.createdAt)}
                  </div>
                </div>
                <div className="hidden group-hover:flex gap-0.5">
                  <Button
                    variant="ghost" size="icon" className="h-5 w-5"
                    onClick={() => handleRestore(v)}
                  >
                    <RotateCcw className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost" size="icon" className="h-5 w-5 text-destructive"
                    onClick={() => setConfirmDeleteId(v.id)}
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create version dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">保存版本</DialogTitle>
          </DialogHeader>
          <Input
            value={versionName}
            onChange={(e) => setVersionName(e.target.value)}
            placeholder="版本名称"
            className="h-8 text-sm"
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
            autoFocus
          />
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button size="sm" onClick={handleCreate} disabled={creating || !versionName.trim()}>
              {creating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm delete dialog */}
      <Dialog open={!!confirmDeleteId} onOpenChange={() => setConfirmDeleteId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">确认删除</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">确定要删除这个版本吗？此操作不可撤销。</p>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteId(null)}>取消</Button>
            <Button variant="destructive" size="sm" onClick={() => confirmDeleteId && handleDelete(confirmDeleteId)}>删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ScrollArea>
  );
}

function formatTime(ts: number | string | undefined): string {
  if (!ts) return '';
  const d = new Date(typeof ts === 'string' ? ts : ts);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  if (diffMs < 60000) return '刚刚';
  if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)} 分钟前`;
  if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)} 小时前`;
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
