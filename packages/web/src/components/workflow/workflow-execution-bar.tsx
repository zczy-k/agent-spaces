'use client';

import { useMemo, useState } from 'react';
import type { ExecutionLog, ExecutionStep, OutputField, WorkflowNode } from '@agent-spaces/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ResizableHandle, ResizablePanel, ResizablePanelGroup,
} from '@/components/ui/resizable';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertCircle, AlertTriangle, Check, CheckCircle, ChevronDown, ChevronUp,
  Circle, Copy, Info, Loader2, MoreHorizontal, Pause, Play, Square, Trash2, XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type ExecutionStatus = 'idle' | 'running' | 'paused' | 'completed' | 'error' | 'stopped' | string;

interface ExecutionBarProps {
  status: ExecutionStatus;
  log: ExecutionLog | null;
  logs: ExecutionLog[];
  selectedLogId: string | null;
  startNodes: WorkflowNode[];
  validationError?: string | null;
  isExpanded: boolean;
  onToggle: () => void;
  onExecute: (input?: Record<string, unknown>, startNodeId?: string) => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onSelectLog: (log: ExecutionLog) => void;
  onDeleteLog: (logId: string) => void;
  onClearLogs: () => void;
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

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('zh-CN', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function formatDuration(start: number, end?: number): string {
  const ms = Math.max(0, (end || Date.now()) - start);
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function stringifyValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function parseInputValue(field: OutputField, raw: string): unknown {
  if (field.type === 'number') return raw === '' ? 0 : Number(raw);
  if (field.type === 'boolean') return raw === 'true';
  if (field.type === 'object' || field.type === 'any') {
    if (!raw.trim()) return field.type === 'object' ? {} : '';
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}

function stepIcon(status: ExecutionStep['status']) {
  if (status === 'completed') return <CheckCircle className="h-3 w-3 text-green-500 shrink-0" />;
  if (status === 'error') return <XCircle className="h-3 w-3 text-red-500 shrink-0" />;
  if (status === 'running') return <Loader2 className="h-3 w-3 text-blue-500 animate-spin shrink-0" />;
  return <Circle className="h-3 w-3 text-muted-foreground shrink-0" />;
}

function logIcon(level: string) {
  if (level === 'info') return <Info className="h-2.5 w-2.5 shrink-0 mt-0.5" />;
  if (level === 'warning') return <AlertTriangle className="h-2.5 w-2.5 shrink-0 mt-0.5" />;
  return <AlertCircle className="h-2.5 w-2.5 shrink-0 mt-0.5" />;
}

function JsonBlock({ value, empty }: { value: unknown; empty: string }) {
  if (value === undefined || value === null) {
    return <div className="p-2 text-[10px] text-muted-foreground">{empty}</div>;
  }
  return (
    <ScrollArea className="h-full">
      <pre className="p-2 text-[10px] leading-relaxed font-mono whitespace-pre-wrap break-words">
        {stringifyValue(value)}
      </pre>
    </ScrollArea>
  );
}

function ExecutionInputDialog({
  open, fields, startNodeLabel, onOpenChange, onSubmit,
}: {
  open: boolean;
  fields: OutputField[];
  startNodeLabel: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: Record<string, unknown>) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});

  const setField = (key: string, value: string) => {
    setValues(prev => ({ ...prev, [key]: value }));
  };

  const submit = () => {
    const parsed: Record<string, unknown> = {};
    for (const field of fields) {
      if (!field.key) continue;
      parsed[field.key] = parseInputValue(field, values[field.key] ?? field.value ?? '');
    }
    onSubmit(parsed);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-sm">工作流输入 · {startNodeLabel}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="min-h-0 flex-1 pr-2">
          <div className="space-y-3 py-1">
            {fields.map(field => (
              <label key={field.key} className="block space-y-1.5">
                <span className="text-xs font-medium">
                  {field.required && <span className="text-destructive mr-0.5">*</span>}
                  {field.key}
                  <span className="text-muted-foreground font-normal ml-1">({field.type})</span>
                </span>
                {field.description && (
                  <span className="block text-[10px] text-muted-foreground">{field.description}</span>
                )}
                <Input
                  className="h-8 text-xs"
                  type={field.type === 'number' ? 'number' : 'text'}
                  placeholder={field.type === 'boolean' ? 'true / false' : field.key}
                  value={values[field.key] ?? field.value ?? ''}
                  onChange={event => setField(field.key, event.target.value)}
                />
              </label>
            ))}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button size="sm" onClick={submit}>
            <Play className="h-3 w-3 mr-1" /> 开始执行
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function WorkflowExecutionBar({
  status, log, logs, selectedLogId, startNodes, validationError, isExpanded, onToggle,
  onExecute, onPause, onResume, onStop, onSelectLog, onDeleteLog, onClearLogs, onExitPreview,
}: ExecutionBarProps) {
  const [inputDialogOpen, setInputDialogOpen] = useState(false);
  const [selectedStartNodeId, setSelectedStartNodeId] = useState<string | null>(null);
  const [stepTabs, setStepTabs] = useState<Record<string, string>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const badge = STATUS_BADGE[status] || STATUS_BADGE.idle;
  const isRunning = status === 'running';
  const isPaused = status === 'paused';
  const canStart = !isRunning && !isPaused && !validationError;
  const canPause = isRunning;
  const canResume = isPaused;
  const canStop = isRunning || isPaused;

  const activeStartNode = useMemo(() => {
    if (selectedStartNodeId) {
      return startNodes.find(node => node.id === selectedStartNodeId) ?? startNodes[0] ?? null;
    }
    return startNodes[0] ?? null;
  }, [selectedStartNodeId, startNodes]);

  const inputFields = useMemo(() => {
    const fields = activeStartNode?.data?.inputFields;
    return Array.isArray(fields) ? fields as OutputField[] : [];
  }, [activeStartNode]);

  const displayLog = log;
  const steps = displayLog?.steps || [];
  const completedSteps = steps.filter(s => s.status === 'completed').length;
  const errorSteps = steps.filter(s => s.status === 'error').length;
  const progressText = displayLog ? `${completedSteps}/${steps.length}` : '';
  const elapsedText = displayLog ? formatDuration(displayLog.startedAt, displayLog.finishedAt) : '';
  const nodeTypeById = useMemo(() => {
    return new Map((displayLog?.snapshot?.nodes || []).map(node => [node.id, node.type]));
  }, [displayLog]);

  const executeFromStartNode = (node?: WorkflowNode | null) => {
    const startNode = node ?? startNodes[0] ?? null;
    setSelectedStartNodeId(startNode?.id ?? null);
    const fields = Array.isArray(startNode?.data?.inputFields) ? startNode.data.inputFields as OutputField[] : [];
    if (fields.length > 0) {
      setInputDialogOpen(true);
      return;
    }
    onExecute(undefined, startNode?.id);
  };

  const submitInput = (values: Record<string, unknown>) => {
    onExecute(values, activeStartNode?.id);
  };

  const copyText = async (key: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  return (
    <div
      className={cn(
        'border-t border-border bg-background flex flex-col shrink-0 overflow-hidden',
        isExpanded ? 'h-[min(320px,45vh)] min-h-[220px]' : 'h-auto',
      )}
    >
      <div className="flex items-center gap-2 px-3 py-1.5">
        {canResume ? (
          <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 px-2" onClick={onResume}>
            <Play className="h-3 w-3" /> 继续
          </Button>
        ) : startNodes.length > 1 ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="sm" className="h-6 text-xs gap-1 px-2" disabled={!canStart} />}
            >
              <Play className="h-3 w-3" /> 执行 <ChevronDown className="h-3 w-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {startNodes.map(node => (
                <DropdownMenuItem key={node.id} className="text-xs" onClick={() => executeFromStartNode(node)}>
                  {node.label || '开始'}
                  <span className="ml-auto text-[10px] text-muted-foreground">{node.id.slice(0, 8)}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 px-2" disabled={!canStart} onClick={() => executeFromStartNode()}>
            <Play className="h-3 w-3" /> 执行
          </Button>
        )}

        {validationError && !isRunning && !isPaused && (
          <div className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 px-2" disabled={!canPause} onClick={onPause}>
          <Pause className="h-3 w-3" /> 暂停
        </Button>
        <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 px-2" disabled={!canStop} onClick={onStop}>
          <Square className="h-3 w-3" /> 停止
        </Button>

        <div className="ml-auto flex items-center gap-3 text-[10px] text-muted-foreground min-w-0">
          {progressText && <span>进度: {progressText}</span>}
          {elapsedText && <span>耗时: {elapsedText}</span>}
          <Badge variant={badge.variant} className="text-[10px] h-5">{badge.label}</Badge>
          {errorSteps > 0 && <span className="text-destructive">{errorSteps} 错误</span>}
        </div>

        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onToggle}>
          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>
      </div>

      {isExpanded && (
        <div className="border-t border-border flex-1 min-h-0">
          <ResizablePanelGroup orientation="horizontal" className="h-full min-h-0 overflow-hidden">
            <ResizablePanel
              id="workflow-execution-history"
              defaultSize="25%"
              minSize="15%"
              maxSize="40%"
              className="min-h-0 overflow-hidden"
            >
              <div className="h-full flex flex-col">
                <div className="flex items-center justify-between px-2 py-1 border-b border-border">
                  <span className="text-[10px] text-muted-foreground font-medium">执行历史</span>
                  {logs.length > 0 && (
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onClearLogs}>
                      <Trash2 className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  )}
                </div>
                <ScrollArea className="flex-1 min-h-0">
                  <div className="space-y-px p-1">
                    {logs.map(item => (
                      <div
                        key={item.id}
                        role="button"
                        tabIndex={0}
                        className={cn(
                          'w-full flex items-center gap-1.5 px-2 py-1 rounded text-[10px] text-left hover:bg-muted/50 transition-colors cursor-pointer',
                          selectedLogId === item.id && 'bg-muted',
                        )}
                        onClick={() => onSelectLog(item)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') onSelectLog(item);
                        }}
                      >
                        {item.status === 'completed' ? <CheckCircle className="h-3 w-3 text-green-500 shrink-0" /> :
                          item.status === 'error' ? <XCircle className="h-3 w-3 text-red-500 shrink-0" /> :
                          item.status === 'running' ? <Loader2 className="h-3 w-3 text-blue-500 animate-spin shrink-0" /> :
                          <Circle className="h-3 w-3 text-muted-foreground shrink-0" />}
                        <span className="flex-1 min-w-0">
                          <span className="block truncate">{formatTime(item.startedAt)}</span>
                          <span className="block text-muted-foreground">
                            {item.steps.length} 节点 · {formatDuration(item.startedAt, item.finishedAt)}
                          </span>
                        </span>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            className="inline-flex h-5 w-5 items-center justify-center rounded hover:bg-muted"
                            onClick={event => event.stopPropagation()}
                          >
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded hover:bg-muted">
                              <MoreHorizontal className="h-3 w-3" />
                            </span>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-32">
                            <DropdownMenuItem
                              variant="destructive"
                              className="text-xs"
                              onClick={(event) => {
                                event.stopPropagation();
                                onDeleteLog(item.id);
                              }}
                            >
                              <Trash2 className="h-3 w-3" /> 删除日志
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))}
                    {logs.length === 0 && (
                      <div className="text-center text-[10px] text-muted-foreground py-4">暂无执行记录</div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            <ResizablePanel
              id="workflow-execution-details"
              defaultSize="75%"
              minSize="40%"
              className="min-h-0 overflow-hidden"
            >
              {displayLog ? (
                <ScrollArea className="h-full">
                  <div className="flex h-full gap-2 px-2 py-2 overflow-x-auto">
                    {steps.map((step, index) => {
                      const key = `${step.nodeId}-${step.startedAt}-${index}`;
                      const activeTab = stepTabs[key] || 'input';
                      const nodeInfo = [
                        `# ${step.nodeLabel || step.nodeId}`,
                        `节点类型: ${nodeTypeById.get(step.nodeId) || ''}`,
                        '',
                        '## 输入',
                        stringifyValue(step.input) || '无',
                        '',
                        '## 输出',
                        stringifyValue(step.output) || '无',
                      ].join('\n');

                      return (
                        <div key={key} className="w-[280px] h-full min-h-[260px] shrink-0 border border-border rounded-md flex flex-col overflow-hidden bg-background">
                          <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-border">
                            {stepIcon(step.status)}
                            <span className="text-xs font-medium truncate flex-1">{step.nodeLabel || step.nodeId}</span>
                            <span className="text-[10px] text-muted-foreground/70 shrink-0 font-mono">
                              {nodeTypeById.get(step.nodeId) || ''}
                            </span>
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {step.finishedAt ? formatDuration(step.startedAt, step.finishedAt) : '...'}
                            </span>
                            <button
                              type="button"
                              className="shrink-0 p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                              onClick={() => copyText(`info-${key}`, nodeInfo)}
                              title="复制节点信息"
                            >
                              {copiedKey === `info-${key}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                            </button>
                          </div>

                          {step.error && (
                            <div className="px-2.5 py-1 text-[10px] text-red-500 bg-red-500/10 border-b border-border flex items-start gap-1">
                              <span className="flex-1 break-all">{step.error}</span>
                              <button
                                type="button"
                                className="shrink-0 p-0.5 rounded hover:bg-red-500/20"
                                onClick={() => copyText(`error-${key}`, step.error || '')}
                                title="复制错误信息"
                              >
                                {copiedKey === `error-${key}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                              </button>
                            </div>
                          )}

                          <Tabs
                            value={activeTab}
                            onValueChange={value => setStepTabs(prev => ({ ...prev, [key]: value }))}
                            className="flex-1 flex flex-col min-h-0 gap-0"
                          >
                            <TabsList className="w-full h-7 rounded-none border-b border-border bg-transparent px-1">
                              <TabsTrigger value="input" className="text-[10px] h-5 px-2 flex-1">输入</TabsTrigger>
                              <TabsTrigger value="output" className="text-[10px] h-5 px-2 flex-1">输出</TabsTrigger>
                              <TabsTrigger value="logs" className="text-[10px] h-5 px-2 flex-1">日志</TabsTrigger>
                            </TabsList>
                            <TabsContent value="input" className="flex-1 min-h-0 mt-0">
                              <JsonBlock value={step.input} empty="无输入" />
                            </TabsContent>
                            <TabsContent value="output" className="flex-1 min-h-0 mt-0">
                              <JsonBlock value={step.output} empty="无输出" />
                            </TabsContent>
                            <TabsContent value="logs" className="flex-1 min-h-0 mt-0">
                              {step.logs?.length ? (
                                <ScrollArea className="h-full">
                                  <div className="px-2 py-1">
                                    {step.logs.map((entry, logIndex) => (
                                      <div
                                        key={`${entry.timestamp}-${logIndex}`}
                                        className={cn(
                                          'flex items-start gap-1 text-[10px] px-1.5 py-0.5 my-px rounded',
                                          entry.level === 'info' && 'text-blue-600 dark:text-blue-400 bg-blue-500/10',
                                          entry.level === 'warning' && 'text-yellow-600 dark:text-yellow-400 bg-yellow-500/10',
                                          entry.level === 'error' && 'text-red-600 dark:text-red-400 bg-red-500/10',
                                        )}
                                      >
                                        {logIcon(entry.level)}
                                        <span className="break-all">{entry.message}</span>
                                      </div>
                                    ))}
                                  </div>
                                </ScrollArea>
                              ) : (
                                <div className="p-2 text-[10px] text-muted-foreground">无日志</div>
                              )}
                            </TabsContent>
                          </Tabs>
                        </div>
                      );
                    })}
                    {steps.length === 0 && (
                      <div className="flex-1 flex items-center justify-center text-[10px] text-muted-foreground">
                        暂无执行步骤
                      </div>
                    )}
                  </div>
                </ScrollArea>
              ) : (
                <div className="h-full flex items-center justify-center text-[10px] text-muted-foreground">
                  选择一条执行记录查看详情
                </div>
              )}
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      )}

      <ExecutionInputDialog
        open={inputDialogOpen}
        fields={inputFields}
        startNodeLabel={activeStartNode?.label || '开始'}
        onOpenChange={setInputDialogOpen}
        onSubmit={submitInput}
      />
    </div>
  );
}
