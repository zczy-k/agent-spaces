'use client';

import type { WorkflowNode } from '@agent-spaces/shared';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bug, Loader2, Timer } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface ToolbarProps {
  node: WorkflowNode;
  data: Record<string, unknown>;
  canEditInputFields: boolean;
  canEditOutputFields: boolean;
  canEditDelay: boolean;
  canDebug: boolean;
  isDebugging: boolean;
  selectedJsonPreset: { inputs?: Record<string, unknown>; data?: Record<string, unknown> } | null;
  onDataChange: (key: string, value: unknown) => void;
  onDebug: (nodeId: string, inputs?: Record<string, unknown>, properties?: Record<string, unknown>) => void;
  onCancelDebug: () => void;
  onOpenTestDialog: () => void;
}

export function Toolbar({
  node,
  data,
  canEditInputFields,
  canEditOutputFields,
  canEditDelay,
  canDebug,
  isDebugging,
  selectedJsonPreset,
  onDataChange,
  onDebug,
  onCancelDebug,
  onOpenTestDialog,
}: ToolbarProps) {
  return (
    <div className="flex shrink-0 items-center gap-1 border-b px-3 py-1.5">
      <Badge variant="secondary" className="h-5 rounded px-2 text-[10px]">属性</Badge>
      {canEditInputFields && <Badge variant="outline" className="h-5 cursor-pointer rounded px-2 text-[10px]" onClick={() => document.getElementById('input-fields-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>输入</Badge>}
      {canEditOutputFields && <Badge variant="outline" className="h-5 cursor-pointer rounded px-2 text-[10px]" onClick={() => document.getElementById('output-fields-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>输出</Badge>}
      <div className="ml-auto flex items-center gap-1">
        {canDebug && (
          <Button
            variant="ghost"
            size="icon"
            className={`h-6 w-6 ${isDebugging ? 'text-destructive' : 'text-muted-foreground hover:text-foreground'}`}
            title={isDebugging ? '停止测试' : '测试脚本'}
            onClick={() => {
              if (isDebugging) {
                onCancelDebug();
              } else {
                if (selectedJsonPreset) {
                  onDebug(node.id, undefined, selectedJsonPreset.inputs ?? selectedJsonPreset.data);
                } else {
                  onOpenTestDialog();
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
              nativeButton={false}
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
                onChange={(e) => onDataChange('_delay', Number(e.target.value) || 0)}
                className="h-7 text-xs"
              />
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}
