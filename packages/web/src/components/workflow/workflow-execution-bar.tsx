'use client';

import { useCallback } from 'react';
import type { ExecutionLog } from '@agent-spaces/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Play, Square, Pause, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';

interface ExecutionBarProps {
  status: string;
  log: ExecutionLog | null;
  isExpanded: boolean;
  onToggle: () => void;
  onExecute: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onExitPreview: () => void;
}

const STATUS_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  idle: { label: '就绪', variant: 'secondary' },
  running: { label: '运行中', variant: 'default' },
  paused: { label: '已暂停', variant: 'outline' },
  completed: { label: '已完成', variant: 'default' },
  error: { label: '错误', variant: 'destructive' },
  stopped: { label: '已停止', variant: 'secondary' },
};

export function WorkflowExecutionBar({
  status, log, isExpanded, onToggle,
  onExecute, onPause, onResume, onStop, onExitPreview,
}: ExecutionBarProps) {
  const badge = STATUS_BADGE[status] || STATUS_BADGE.idle;
  const isRunning = status === 'running';
  const isPaused = status === 'paused';

  const steps = log?.steps || [];
  const completedSteps = steps.filter(s => s.status === 'completed').length;
  const errorSteps = steps.filter(s => s.status === 'error').length;

  return (
    <div className="border-t bg-background">
      {/* Compact bar */}
      <div className="flex items-center gap-2 px-3 py-1.5">
        <Badge variant={badge.variant} className="text-[10px]">{badge.label}</Badge>

        {isRunning && steps.length > 0 && (
          <span className="text-[10px] text-muted-foreground">
            {completedSteps}/{steps.length} 完成
            {errorSteps > 0 && <span className="text-destructive ml-1">{errorSteps} 错误</span>}
          </span>
        )}

        {log && (status === 'completed' || status === 'error' || status === 'stopped') && (
          <span className="text-[10px] text-muted-foreground">
            {steps.length} 步 · {completedSteps} 完成
            {errorSteps > 0 && <span className="text-destructive ml-1">{errorSteps} 错误</span>}
          </span>
        )}

        <div className="flex-1" />

        {isRunning && !isPaused && (
          <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={onPause}>
            <Pause className="h-3 w-3" /> 暂停
          </Button>
        )}
        {isPaused && (
          <>
            <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={onResume}>
              <Play className="h-3 w-3" /> 继续
            </Button>
            <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 text-destructive" onClick={onStop}>
              <Square className="h-3 w-3" /> 停止
            </Button>
          </>
        )}
        {!isRunning && !isPaused && (
          <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={onExecute}>
            <Play className="h-3 w-3" /> 执行
          </Button>
        )}

        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onToggle}>
          {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
        </Button>
      </div>

      {/* Expanded: step list */}
      {isExpanded && (
        <div className="border-t px-3 py-2 max-h-[200px] overflow-y-auto">
          {steps.length > 0 ? (
            <div className="space-y-1">
              {steps.map((step, i) => (
                <div key={step.nodeId || i} className="flex items-center gap-2 text-xs">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${
                    step.status === 'completed' ? 'bg-green-500' :
                    step.status === 'error' ? 'bg-red-500' :
                    step.status === 'running' ? 'bg-blue-500 animate-pulse' :
                    'bg-muted-foreground/30'
                  }`} />
                  <span className="truncate">{step.nodeId}</span>
                  <span className="text-[10px] text-muted-foreground ml-auto">{step.status}</span>
                  {step.error && (
                    <span className="text-[10px] text-destructive truncate max-w-[200px]">{step.error}</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground text-center py-2">
              暂无执行记录
            </div>
          )}
        </div>
      )}
    </div>
  );
}
