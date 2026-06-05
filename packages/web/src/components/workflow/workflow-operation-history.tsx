'use client';

import { useState, useEffect, useCallback } from 'react';
import type { OperationEntry } from '@agent-spaces/shared';
import { operationHistoryApi } from '@/lib/workflow-api';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Trash2, History, Loader2, Undo2, Redo2 } from 'lucide-react';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';

interface OperationHistoryProps {
  workflowId: string;
  currentUndoCount: number;
  currentRedoCount: number;
  onUndo: () => void;
  onRedo: () => void;
}

const OPERATION_LABELS: Record<string, string> = {
  'add node': '添加节点',
  'delete node': '删除节点',
  'delete': '删除',
  'connect': '连接',
  'delete edge': '删除连线',
  'paste': '粘贴',
  'move': '移动节点',
  'update data': '更新属性',
  'add group': '添加分组',
  'delete group': '删除分组',
  'update trigger': '更新触发器',
  'import': '导入',
};

const OPERATION_COLORS: Record<string, string> = {
  'add node': 'bg-green-500/10 text-green-600',
  'delete node': 'bg-red-500/10 text-red-600',
  'delete': 'bg-red-500/10 text-red-600',
  'connect': 'bg-blue-500/10 text-blue-600',
  'delete edge': 'bg-orange-500/10 text-orange-600',
  'paste': 'bg-violet-500/10 text-violet-600',
  'move': 'bg-slate-500/10 text-slate-600',
  'update data': 'bg-cyan-500/10 text-cyan-600',
};

export function WorkflowOperationHistory({
  workflowId, currentUndoCount, currentRedoCount, onUndo, onRedo,
}: OperationHistoryProps) {
  const [entries, setEntries] = useState<OperationEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    try {
      const list = await operationHistoryApi.load(workflowId);
      setEntries(list);
    } catch {
      // Operation history is optional
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const handleClear = useCallback(async () => {
    await operationHistoryApi.clear(workflowId);
    setEntries([]);
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
        {/* Undo/Redo controls */}
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Button
                  variant="outline" size="icon" className="h-7 w-7"
                  disabled={currentUndoCount === 0}
                  onClick={onUndo}
                >
                  <Undo2 className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>撤销 ({currentUndoCount})</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Button
                  variant="outline" size="icon" className="h-7 w-7"
                  disabled={currentRedoCount === 0}
                  onClick={onRedo}
                >
                  <Redo2 className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>重做 ({currentRedoCount})</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <span className="flex-1 text-[10px] text-muted-foreground text-right">
            {currentUndoCount} 可撤销 / {currentRedoCount} 可重做
          </span>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium">{entries.length} 条记录</span>
          {entries.length > 0 && (
            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={handleClear}>
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* History list */}
        {entries.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-6">
            <History className="h-6 w-6 mx-auto mb-2 opacity-50" />
            暂无操作记录
          </div>
        ) : (
          <div className="space-y-0.5">
            {entries.slice().reverse().map((entry, i) => {
              // Parse operation type from description (format: "type: detail" or just description)
              const desc = entry.description || '';
              const opType = desc.split(':')[0]?.trim() || '';
              const label = OPERATION_LABELS[opType] || opType || desc;
              const colorClass = OPERATION_COLORS[opType] || 'bg-slate-500/10 text-slate-600';
              return (
                <div
                  key={`${entry.timestamp}-${i}`}
                  className="flex items-center gap-2 px-2 py-1 rounded text-xs hover:bg-accent/50 transition-colors"
                >
                  <Badge variant="secondary" className={`text-[9px] px-1 py-0 h-4 font-normal ${colorClass}`}>
                    {label}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground flex-1 truncate">
                    {desc.includes(':') ? desc.split(':').slice(1).join(':').trim() : desc}
                  </span>
                  <span className="text-[9px] text-muted-foreground shrink-0">
                    {formatTime(entry.timestamp)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

function formatTime(ts: number | undefined): string {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
