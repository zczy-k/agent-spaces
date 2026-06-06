'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import type { ExecutionLog, JsonValue, OutputField, WorkflowNode, WorkflowTemplate } from '@agent-spaces/shared';
import { executionLogApi } from '@/lib/workflow-api';
import { useWorkflowStore } from '@/stores/workflow';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  ResizableHandle, ResizablePanel, ResizablePanelGroup,
} from '@/components/ui/resizable';
import { nativeNavigate } from '@/lib/navigate';
import { getWS } from '@/lib/ws';
import {
  ArrowLeft, CheckCircle, Circle, Loader2, Pencil, Play, Square, Trash2, XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { JsonViewer } from '@/components/viewers/json-viewer';
import {
  isArrayOutputFieldType,
  stringifyOutputFieldValue,
} from '@/components/workflow/workflow-properties-utils';

const STATUS_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  idle: { label: '就绪', variant: 'secondary' },
  running: { label: '运行中', variant: 'default' },
  completed: { label: '已完成', variant: 'default' },
  error: { label: '错误', variant: 'destructive' },
  paused: { label: '已暂停', variant: 'outline' },
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

function logIcon(status: string) {
  if (status === 'completed') return <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />;
  if (status === 'error') return <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />;
  if (status === 'running') return <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin shrink-0" />;
  return <Circle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
}

function stepIcon(status: string) {
  if (status === 'completed') return <CheckCircle className="h-3 w-3 text-green-500 shrink-0" />;
  if (status === 'error') return <XCircle className="h-3 w-3 text-red-500 shrink-0" />;
  if (status === 'running') return <Loader2 className="h-3 w-3 text-blue-500 animate-spin shrink-0" />;
  return <Circle className="h-3 w-3 text-muted-foreground shrink-0" />;
}

export default function WorkflowDetailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const workflowId = searchParams.get('workflow_id') || '';
  const paramsStr = searchParams.get('params');

  const { workflows, loadWorkflows } = useWorkflowStore();
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<ExecutionLog | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [initialValues, setInitialValues] = useState<Record<string, string>>({});
  const [executing, setExecuting] = useState(false);
  const [currentExecutionId, setCurrentExecutionId] = useState<string | null>(null);
  const cleanupRef = useRef<(() => void)[]>([]);

  useEffect(() => {
    if (workflows.length === 0) loadWorkflows();
  }, [loadWorkflows, workflows.length]);

  useEffect(() => {
    if (!workflowId) return;
    setLogsLoading(true);
    executionLogApi.list(workflowId)
      .then(setLogs)
      .finally(() => setLogsLoading(false));
  }, [workflowId]);

  useEffect(() => {
    if (!paramsStr) return;
    try {
      const parsed = JSON.parse(paramsStr);
      if (typeof parsed === 'object' && parsed !== null) {
        const map: Record<string, string> = {};
        for (const [k, v] of Object.entries(parsed)) {
          map[k] = typeof v === 'string' ? v : JSON.stringify(v);
        }
        setInitialValues(map);
      }
    } catch { /* ignore */ }
  }, [paramsStr]);

  // Cleanup WS listeners on unmount
  useEffect(() => {
    return () => {
      for (const cleanup of cleanupRef.current) cleanup();
      cleanupRef.current = [];
    };
  }, []);

  const workflow = useMemo(
    () => workflows.find(w => w.id === workflowId),
    [workflows, workflowId],
  );

  const startNodes = useMemo<WorkflowNode[]>(
    () => (workflow?.nodes || []).filter(n => n.type === 'start'),
    [workflow],
  );

  const firstStartNode = startNodes[0] ?? null;

  const inputFields = useMemo<OutputField[]>(() => {
    const fields = firstStartNode?.data?.inputFields;
    return Array.isArray(fields) ? fields as OutputField[] : [];
  }, [firstStartNode]);

  const refreshLogs = useCallback(async () => {
    if (!workflowId) return;
    try {
      const updated = await executionLogApi.list(workflowId);
      setLogs(updated);
    } catch { /* ignore */ }
  }, [workflowId]);

  const handleExecute = useCallback((values: Record<string, unknown>) => {
    if (!workflowId || !workflow) return;

    // Cleanup previous listeners
    for (const cleanup of cleanupRef.current) cleanup();
    cleanupRef.current = [];

    setExecuting(true);
    setSelectedLog(null);

    const ws = getWS('workflows');
    const sendRequest = () => {
      ws.send('workflow:execute', {
        workflowId,
        input: values,
        snapshot: {
          nodes: workflow.nodes,
          edges: workflow.edges,
          groups: workflow.groups || [],
        },
      });
    };

    const upsertLog = (log: ExecutionLog) => {
      setSelectedLog(log);
      setLogs(prev => [log, ...prev.filter(item => item.id !== log.id)]);
    };

    const offLog = ws.on('execution:log', (data) => {
      const event = data as { workflowId?: string; executionId?: string; log?: ExecutionLog };
      if (event.workflowId !== workflowId || !event.log) return;
      if (event.executionId || event.log.id) setCurrentExecutionId(event.executionId || event.log.id);
      upsertLog(event.log);
    });
    const offResult = ws.on('workflow:execute:result', (data) => {
      const result = data as { executionId?: string };
      if (result.executionId) setCurrentExecutionId(result.executionId);
    });
    const offCompleted = ws.on('workflow:completed', (data) => {
      const event = data as { workflowId?: string; log?: ExecutionLog };
      if (event.workflowId !== workflowId) return;
      if (event.log) upsertLog(event.log);
      setExecuting(false);
      setCurrentExecutionId(null);
      void refreshLogs();
    });
    const offFailed = ws.on('workflow:error', (data) => {
      const event = data as { workflowId?: string; log?: ExecutionLog };
      if (event.workflowId !== workflowId) return;
      if (event.log) upsertLog(event.log);
      setExecuting(false);
      setCurrentExecutionId(null);
      void refreshLogs();
    });

    cleanupRef.current = [offLog, offResult, offCompleted, offFailed];

    if (ws.connected) {
      sendRequest();
    } else {
      const offConnected = ws.on('connected', () => {
        offConnected();
        cleanupRef.current = cleanupRef.current.filter(c => c !== offConnected);
        sendRequest();
      });
      cleanupRef.current.push(offConnected);
    }
  }, [workflowId, workflow, refreshLogs]);

  const handleStop = useCallback(() => {
    if (!currentExecutionId) return;
    getWS('workflows').send('workflow:stop', { executionId: currentExecutionId });
    setExecuting(false);
    setCurrentExecutionId(null);
  }, [currentExecutionId]);

  const handleClearLogs = async () => {
    if (!workflowId) return;
    await executionLogApi.clear(workflowId);
    setLogs([]);
    setSelectedLog(null);
  };

  if (!workflowId) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        缺少 workflow_id 参数
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        加载中...
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4 gap-3">
      {/* Header */}
      <div className="flex items-center gap-3 shrink-0">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => nativeNavigate(router, '/workflows')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {workflow.icon ? (
              <span className="text-lg leading-none">{workflow.icon}</span>
            ) : (
              <span className="w-5 h-5 rounded bg-primary/10 text-[10px] font-bold flex items-center justify-center text-primary shrink-0">
                {(workflow.name || 'W').charAt(0).toUpperCase()}
              </span>
            )}
            <h1 className="text-sm font-semibold truncate">{workflow.name}</h1>
            <span className="text-xs text-muted-foreground">{workflow.nodes.length} 节点</span>
          </div>
          {workflow.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{workflow.description}</p>
          )}
        </div>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => nativeNavigate(router, `/workflows/${workflow.id}`)}>
          <Pencil className="h-3 w-3" /> 编辑
        </Button>
      </div>

      {/* Main content */}
      <div className="flex-1 min-h-0">
        <ResizablePanelGroup orientation="horizontal" className="h-full">
          {/* Left: workflow info card + input form card */}
          <ResizablePanel id="workflow-detail-left" defaultSize="40%" minSize="25%" maxSize="55%">
            <div className="h-full flex flex-col gap-3 pr-1">
              {/* Workflow info card */}
              <Card className="rounded-lg shrink-0">
                <CardHeader className="p-3 pb-2">
                  <CardTitle className="text-xs">工作流信息</CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <div className="space-y-1.5 text-xs">
                    <div className="flex gap-2">
                      <span className="text-muted-foreground w-14 shrink-0">ID</span>
                      <span className="font-mono text-[10px] truncate">{workflow.id}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-muted-foreground w-14 shrink-0">节点</span>
                      <span>{workflow.nodes.length} 个</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-muted-foreground w-14 shrink-0">边</span>
                      <span>{workflow.edges.length} 条</span>
                    </div>
                    {workflow.tags && workflow.tags.length > 0 && (
                      <div className="flex gap-2">
                        <span className="text-muted-foreground w-14 shrink-0">标签</span>
                        <div className="flex gap-1 flex-wrap">
                          {workflow.tags.map(tag => (
                            <Badge key={tag} variant="secondary" className="text-[10px] h-4 px-1.5">{tag}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Input form card */}
              <Card className="rounded-lg flex-1 min-h-0 flex flex-col">
                <CardHeader className="p-3 pb-2 shrink-0">
                  <CardTitle className="text-xs">执行参数</CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0 flex-1 min-h-0 flex flex-col">
                  {inputFields.length > 0 ? (
                    <InitialValuesExecutionInputForm
                      fields={inputFields}
                      initialValues={initialValues}
                      onSubmit={handleExecute}
                      onStop={handleStop}
                      executing={executing}
                    />
                  ) : (
                    <div className="flex-1 flex items-center justify-center">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-3">无输入参数，直接执行</p>
                        <Button size="sm" className="h-7 text-xs gap-1" disabled={executing} onClick={() => handleExecute({})}>
                          {executing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                          {executing ? '执行中...' : '执行'}
                        </Button>
                        {executing && (
                          <Button variant="destructive" size="sm" className="h-7 text-xs gap-1" onClick={handleStop}>
                            <Square className="h-3 w-3" /> 停止
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right: execution records */}
          <ResizablePanel id="workflow-detail-right" defaultSize="60%" minSize="40%">
            <Card className="rounded-lg h-full flex flex-col">
              <CardHeader className="p-3 pb-2 shrink-0">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs">执行记录</CardTitle>
                  {logs.length > 0 && (
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleClearLogs}>
                      <Trash2 className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0 pt-0 flex-1 min-h-0">
                <ResizablePanelGroup orientation="horizontal" className="h-full">
                  {/* Log list */}
                  <ResizablePanel id="workflow-detail-logs" defaultSize="30%" minSize="20%" maxSize="45%">
                    <ScrollArea className="h-full">
                      {logsLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      ) : logs.length === 0 ? (
                        <div className="text-center text-xs text-muted-foreground py-8">暂无执行记录</div>
                      ) : (
                        <div className="space-y-px p-1">
                          {logs.map(log => {
                            const badge = STATUS_BADGE[log.status] || STATUS_BADGE.idle;
                            return (
                              <div
                                key={log.id}
                                role="button"
                                tabIndex={0}
                                className={cn(
                                  'w-full flex items-center gap-1.5 px-2 py-1.5 rounded text-xs text-left hover:bg-muted/50 transition-colors cursor-pointer',
                                  selectedLog?.id === log.id && 'bg-muted',
                                )}
                                onClick={() => setSelectedLog(log)}
                                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setSelectedLog(log); }}
                              >
                                {logIcon(log.status)}
                                <span className="flex-1 min-w-0">
                                  <span className="block truncate">{formatTime(log.startedAt)}</span>
                                  <span className="block text-[10px] text-muted-foreground">
                                    {log.steps.length} 步骤 · {formatDuration(log.startedAt, log.finishedAt)}
                                  </span>
                                </span>
                                <Badge variant={badge.variant} className="text-[10px] h-4 px-1">{badge.label}</Badge>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </ScrollArea>
                  </ResizablePanel>

                  <ResizableHandle withHandle />

                  {/* Log detail */}
                  <ResizablePanel id="workflow-detail-log-detail" defaultSize="70%" minSize="35%">
                    {selectedLog ? (
                      <ScrollArea className="h-full">
                        <div className="p-3 space-y-2">
                          <div className="flex items-center gap-2 mb-3">
                            <Badge variant={(STATUS_BADGE[selectedLog.status] || STATUS_BADGE.idle).variant} className="text-[10px]">
                              {(STATUS_BADGE[selectedLog.status] || STATUS_BADGE.idle).label}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {formatTime(selectedLog.startedAt)} · {formatDuration(selectedLog.startedAt, selectedLog.finishedAt)}
                            </span>
                          </div>

                          {(selectedLog.steps || []).map((step, index) => {
                            const nodeType = selectedLog.snapshot?.nodes?.find(n => n.id === step.nodeId)?.type || '';
                            return (
                              <Card key={`${step.nodeId}-${index}`} className="rounded-lg overflow-hidden">
                                <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-muted/30">
                                  {stepIcon(step.status)}
                                  <span className="text-xs font-medium truncate flex-1">{step.nodeLabel || step.nodeId}</span>
                                  <span className="text-[10px] text-muted-foreground font-mono">{nodeType}</span>
                                  <span className="text-[10px] text-muted-foreground">
                                    {step.finishedAt ? formatDuration(step.startedAt, step.finishedAt) : '...'}
                                  </span>
                                </div>
                                {step.error && (
                                  <div className="px-2.5 py-1 text-[10px] text-red-500 bg-red-500/10 border-t border-border">
                                    {step.error}
                                  </div>
                                )}
                                <div className="grid grid-cols-2 divide-x divide-border">
                                  <div className="p-2">
                                    <div className="text-[10px] text-muted-foreground mb-1">输入</div>
                                    {step.input !== undefined && step.input !== null ? (
                                      <JsonViewer data={step.input as JsonValue} className="border-0 shadow-none p-0" defaultExpanded={2} />
                                    ) : (
                                      <span className="text-[10px] text-muted-foreground">无</span>
                                    )}
                                  </div>
                                  <div className="p-2">
                                    <div className="text-[10px] text-muted-foreground mb-1">输出</div>
                                    {step.output !== undefined && step.output !== null ? (
                                      <JsonViewer data={step.output as JsonValue} className="border-0 shadow-none p-0" defaultExpanded={2} />
                                    ) : (
                                      <span className="text-[10px] text-muted-foreground">无</span>
                                    )}
                                  </div>
                                </div>
                              </Card>
                            );
                          })}

                          {(!selectedLog.steps || selectedLog.steps.length === 0) && (
                            <div className="text-center text-xs text-muted-foreground py-4">暂无执行步骤</div>
                          )}
                        </div>
                      </ScrollArea>
                    ) : (
                      <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                        选择一条执行记录查看详情
                      </div>
                    )}
                  </ResizablePanel>
                </ResizablePanelGroup>
              </CardContent>
            </Card>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}

function InitialValuesExecutionInputForm({
  fields, initialValues, onSubmit, onStop, executing,
}: {
  fields: OutputField[];
  initialValues: Record<string, string>;
  onSubmit: (values: Record<string, unknown>) => void;
  onStop: () => void;
  executing: boolean;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const field of fields) {
      if (!field.key) continue;
      map[field.key] = initialValues[field.key] ?? stringifyOutputFieldValue(field.value);
    }
    return map;
  });

  const setField = (key: string, value: string) => {
    setValues(prev => ({ ...prev, [key]: value }));
  };

  const submit = () => {
    const parsed: Record<string, unknown> = {};
    for (const field of fields) {
      if (!field.key) continue;
      const raw = values[field.key] ?? stringifyOutputFieldValue(field.value);
      if (field.type === 'number') parsed[field.key] = raw === '' ? 0 : Number(raw);
      else if (field.type === 'boolean') parsed[field.key] = raw === 'true';
      else if (field.type === 'object' || field.type === 'any' || isArrayOutputFieldType(field.type)) {
        if (!raw.trim()) parsed[field.key] = field.type === 'object' ? {} : isArrayOutputFieldType(field.type) ? [] : '';
        else {
          try {
            const value = JSON.parse(raw);
            parsed[field.key] = isArrayOutputFieldType(field.type) && !Array.isArray(value) ? raw : value;
          }
          catch { parsed[field.key] = raw; }
        }
      } else parsed[field.key] = raw;
    }
    onSubmit(parsed);
  };

  return (
    <>
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-3">
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
              <input
                className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                type={field.type === 'number' ? 'number' : 'text'}
                placeholder={field.type === 'boolean' ? 'true / false' : field.key}
                value={values[field.key] ?? ''}
                onChange={e => setField(field.key, e.target.value)}
                disabled={executing}
              />
            </label>
          ))}
        </div>
      </ScrollArea>
      <div className="pt-2 shrink-0 flex gap-2">
        <Button size="sm" className="h-7 text-xs gap-1 flex-1" disabled={executing} onClick={submit}>
          <Play className="h-3 w-3" /> 执行
        </Button>
        {executing && (
          <Button variant="destructive" size="sm" className="h-7 text-xs gap-1" onClick={onStop}>
            <Square className="h-3 w-3" /> 停止
          </Button>
        )}
      </div>
    </>
  );
}
