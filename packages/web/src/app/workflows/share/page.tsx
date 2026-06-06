'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { ExecutionLog, OutputField, Workflow, WorkflowNode } from '@agent-spaces/shared';
import { workflowApi } from '@/lib/workflow-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChecklistCell } from '@/components/ui/checklist-cell';
import { ExecutionInputForm } from '@/components/workflow/workflow-execution-input-dialog';
import { getWS } from '@/lib/ws';
import { Loader2, Play, Square } from 'lucide-react';

/** 递归提取 step output 中的 .mp4/.mp3 URL */
function extractMediaUrls(data: unknown): { type: 'video' | 'audio'; url: string }[] {
  const results: { type: 'video' | 'audio'; url: string }[] = [];
  function walk(obj: unknown) {
    if (typeof obj === 'string') {
      if (/\.mp4(\?|$)/i.test(obj)) results.push({ type: 'video', url: obj });
      else if (/\.mp3(\?|$)/i.test(obj)) results.push({ type: 'audio', url: obj });
    } else if (Array.isArray(obj)) {
      obj.forEach(walk);
    } else if (obj && typeof obj === 'object') {
      Object.values(obj as Record<string, unknown>).forEach(walk);
    }
  }
  walk(data);
  return results;
}

export default function WorkflowSharePage() {
  const searchParams = useSearchParams();
  const workflowId = searchParams.get('workflow_id') || '';
  const paramsStr = searchParams.get('params');

  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialValues, setInitialValues] = useState<Record<string, string>>({});
  const [executing, setExecuting] = useState(false);
  const [currentExecutionId, setCurrentExecutionId] = useState<string | null>(null);
  const [executionLog, setExecutionLog] = useState<ExecutionLog | null>(null);
  const [mediaUrls, setMediaUrls] = useState<{ type: 'video' | 'audio'; url: string }[]>([]);
  const cleanupRef = useRef<(() => void)[]>([]);

  // Load workflow
  useEffect(() => {
    if (!workflowId) { setLoading(false); return; }
    workflowApi.get(workflowId)
      .then(setWorkflow)
      .catch(() => setWorkflow(null))
      .finally(() => setLoading(false));
  }, [workflowId]);

  // Parse initial params
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

  // Cleanup WS on unmount
  useEffect(() => {
    return () => {
      for (const cleanup of cleanupRef.current) cleanup();
      cleanupRef.current = [];
    };
  }, []);

  const startNodes = useMemo<WorkflowNode[]>(
    () => (workflow?.nodes || []).filter(n => n.type === 'start'),
    [workflow],
  );
  const firstStartNode = startNodes[0] ?? null;
  const inputFields = useMemo<OutputField[]>(() => {
    const fields = firstStartNode?.data?.inputFields;
    return Array.isArray(fields) ? fields as OutputField[] : [];
  }, [firstStartNode]);

  // ChecklistCell dynamic data from execution log
  const checklistTasks = useMemo(
    () => executionLog?.steps.map(s => s.nodeLabel || s.nodeId) ?? [],
    [executionLog],
  );
  const completedCount = useMemo(
    () => executionLog?.steps.filter(s => s.status === 'completed').length ?? 0,
    [executionLog],
  );

  const handleExecute = useCallback((values: Record<string, unknown>) => {
    if (!workflowId || !workflow) return;

    for (const cleanup of cleanupRef.current) cleanup();
    cleanupRef.current = [];

    setExecuting(true);
    setExecutionLog(null);
    setMediaUrls([]);

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

    const offLog = ws.on('execution:log', (data) => {
      const event = data as { workflowId?: string; executionId?: string; log?: ExecutionLog };
      if (event.workflowId !== workflowId || !event.log) return;
      if (event.executionId || event.log.id) setCurrentExecutionId(event.executionId || event.log.id);
      setExecutionLog(event.log);
    });

    const offCompleted = ws.on('workflow:completed', (data) => {
      const event = data as { workflowId?: string; log?: ExecutionLog };
      if (event.workflowId !== workflowId) return;
      if (event.log) {
        setExecutionLog(event.log);
        // Extract media URLs from all step outputs
        const urls: { type: 'video' | 'audio'; url: string }[] = [];
        for (const step of event.log.steps) urls.push(...extractMediaUrls(step.output));
        setMediaUrls(urls);
      }
      setExecuting(false);
      setCurrentExecutionId(null);
    });

    const offFailed = ws.on('workflow:error', (data) => {
      const event = data as { workflowId?: string; log?: ExecutionLog };
      if (event.workflowId !== workflowId) return;
      if (event.log) setExecutionLog(event.log);
      setExecuting(false);
      setCurrentExecutionId(null);
    });

    cleanupRef.current = [offLog, offCompleted, offFailed];

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
  }, [workflowId, workflow]);

  const handleStop = useCallback(() => {
    if (!currentExecutionId) return;
    getWS('workflows').send('workflow:stop', { executionId: currentExecutionId });
    setExecuting(false);
    setCurrentExecutionId(null);
  }, [currentExecutionId]);

  if (!workflowId) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        缺少 workflow_id 参数
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        工作流不存在
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4 gap-3">
      {/* Header */}
      <div className="flex items-center gap-3 shrink-0">
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
      </div>

      {/* Main content */}
      <div className="flex-1 min-h-0 flex gap-3">
        {/* Left: input form */}
        <div className="w-[360px] shrink-0 flex flex-col">
          <Card className="rounded-lg flex-1 min-h-0 flex flex-col">
            <CardHeader className="p-3 pb-2 shrink-0">
              <CardTitle className="text-xs">执行参数</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 flex-1 min-h-0 flex flex-col">
              {inputFields.length > 0 ? (
                <ExecutionInputForm
                  fields={inputFields}
                  initialValues={initialValues}
                  onSubmit={handleExecute}
                  disabled={executing}
                  footer={submit => (
                    <div className="pt-2 shrink-0 flex gap-2">
                      <Button size="sm" className="h-7 text-xs gap-1 flex-1" disabled={executing} onClick={submit}>
                        <Play className="h-3 w-3" /> 执行
                      </Button>
                      {executing && (
                        <Button variant="destructive" size="sm" className="h-7 text-xs gap-1" onClick={handleStop}>
                          <Square className="h-3 w-3" /> 停止
                        </Button>
                      )}
                    </div>
                  )}
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

        {/* Right: ChecklistCell + media */}
        <div className="flex-1 min-w-0 flex flex-col">
          <Card className="rounded-lg flex-1 min-h-0 flex flex-col">
            <CardHeader className="p-3 pb-2 shrink-0">
              <CardTitle className="text-xs">执行结果</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 flex-1 min-h-0 overflow-auto">
              {checklistTasks.length > 0 ? (
                <div className="space-y-4">
                  <ChecklistCell
                    tasks={checklistTasks}
                    initialCompleted={0}
                    finalCompleted={completedCount}
                    stepInterval={800}
                  />
                  {mediaUrls.length > 0 && (
                    <div className="space-y-3 pt-2">
                      {mediaUrls.map((media, i) => (
                        media.type === 'video' ? (
                          <video key={i} controls className="w-full rounded-lg max-h-64" src={media.url} />
                        ) : (
                          <audio key={i} controls className="w-full" src={media.url} />
                        )
                      ))}
                    </div>
                  )}
                </div>
              ) : executing ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-xs text-muted-foreground">执行中...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                  填写参数并点击执行
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
