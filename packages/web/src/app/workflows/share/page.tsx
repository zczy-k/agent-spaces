'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { ExecutionLog, OutputField, Workflow, WorkflowNode } from '@agent-spaces/shared';
import { workflowApi } from '@/lib/workflow-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FilledCheck, EmptyCircle } from '@/components/ui/checklist-cell';
import { ExecutionInputForm } from '@/components/workflow/workflow-execution-input-dialog';
import { getWS } from '@/lib/ws';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, Loader2, Play, Square, XCircle } from 'lucide-react';

/** 递归提取 step output 中的 .mp4/.mp3 URL（去重） */
function extractMediaUrls(data: unknown): { type: 'video' | 'audio'; url: string }[] {
  const results: { type: 'video' | 'audio'; url: string }[] = [];
  const seen = new Set<string>();
  function walk(obj: unknown) {
    if (typeof obj === 'string') {
      if (/\.mp4(\?|$)/i.test(obj) && !seen.has(obj)) {
        seen.add(obj);
        results.push({ type: 'video', url: obj });
      } else if (/\.mp3(\?|$)/i.test(obj) && !seen.has(obj)) {
        seen.add(obj);
        results.push({ type: 'audio', url: obj });
      }
    } else if (Array.isArray(obj)) {
      obj.forEach(walk);
    } else if (obj && typeof obj === 'object') {
      Object.values(obj as Record<string, unknown>).forEach(walk);
    }
  }
  walk(data);
  return results;
}

/** 只从 end 节点 output 提取媒体 URL */
function extractEndMediaUrls(log: ExecutionLog): { type: 'video' | 'audio'; url: string }[] {
  const endIds = new Set(
    (log.snapshot?.nodes || []).filter(n => n.type === 'end').map(n => n.id),
  );
  const results: { type: 'video' | 'audio'; url: string }[] = [];
  const seen = new Set<string>();
  for (const step of log.steps) {
    if (!endIds.has(step.nodeId)) continue;
    for (const m of extractMediaUrls(step.output)) {
      if (!seen.has(m.url)) { seen.add(m.url); results.push(m); }
    }
  }
  return results;
}

/** 懒加载视频：点击后才加载 src */
function LazyVideo({ src }: { src: string }) {
  const [active, setActive] = useState(false);
  if (active) {
    return <video controls autoPlay className="w-full rounded-lg max-h-64" src={src} />;
  }
  return (
    <div
      role="button"
      tabIndex={0}
      className="w-full rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center cursor-pointer h-40 select-none"
      onClick={() => setActive(true)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setActive(true); }}
    >
      <div className="flex flex-col items-center gap-2 text-zinc-400">
        <Play className="h-8 w-8" />
        <span className="text-xs">点击播放</span>
      </div>
    </div>
  );
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

  useEffect(() => {
    if (!workflowId) { setLoading(false); return; }
    workflowApi.get(workflowId)
      .then(setWorkflow)
      .catch(() => setWorkflow(null))
      .finally(() => setLoading(false));
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

  const completedCount = useMemo(
    () => executionLog?.steps.filter(s => s.status === 'completed').length ?? 0,
    [executionLog],
  );
  const totalCount = executionLog?.steps.length ?? 0;
  const pct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

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
        setMediaUrls(extractEndMediaUrls(event.log));
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

  const hasSteps = totalCount > 0;

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

        {/* Right: step list + media */}
        <div className="flex-1 min-w-0 flex flex-col">
          <Card className="rounded-lg flex-1 min-h-0 flex flex-col">
            <CardHeader className="p-3 pb-2 shrink-0">
              <CardTitle className="text-xs">执行结果</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 flex-1 min-h-0 overflow-auto">
              {hasSteps ? (
                <div className="space-y-4">
                  {/* Progress bar — same animation as ChecklistCell */}
                  <div className="flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                      <motion.div
                        className="h-full rounded-full bg-zinc-900 dark:bg-zinc-100"
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
                      />
                    </div>
                    <div className="flex items-center whitespace-nowrap text-[11px] text-zinc-400 overflow-hidden">
                      <div className="relative h-4 overflow-hidden" style={{ minWidth: '7px' }}>
                        <AnimatePresence mode="popLayout" initial={false}>
                          <motion.span
                            key={completedCount}
                            initial={{ y: '100%', opacity: 0 }}
                            animate={{ y: '0%', opacity: 1 }}
                            exit={{ y: '-100%', opacity: 0 }}
                            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                            className="absolute inset-0 flex items-center justify-end"
                          >
                            {completedCount}
                          </motion.span>
                        </AnimatePresence>
                      </div>
                      <span className="mx-0.5">/</span>
                      <span>{totalCount} Completed</span>
                    </div>
                  </div>

                  {/* Step list — same slide + spring animations as ChecklistCell */}
                  <div className="relative overflow-hidden">
                    <AnimatePresence initial={false}>
                      {executionLog!.steps.map((step) => (
                        <motion.div
                          key={step.nodeId}
                          initial={{ y: 44, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          exit={{ y: -44, opacity: 0 }}
                          transition={{ duration: 0.48, ease: [0.4, 0, 0.2, 1] }}
                          className="flex items-center gap-2.5 px-0.5 py-2.5"
                        >
                          <AnimatePresence mode="wait">
                            {step.status === 'completed' ? (
                              <motion.div
                                key="check"
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                exit={{ scale: 0 }}
                                transition={{ type: 'spring', stiffness: 320, damping: 18, mass: 0.8 }}
                              >
                                <FilledCheck />
                              </motion.div>
                            ) : step.status === 'running' ? (
                              <motion.div key="running" initial={{ scale: 1 }} animate={{ scale: 1 }}>
                                <Loader2 className="h-[18px] w-[18px] text-blue-500 animate-spin shrink-0" />
                              </motion.div>
                            ) : step.status === 'error' ? (
                              <motion.div key="error" initial={{ scale: 1 }} animate={{ scale: 1 }}>
                                <XCircle className="h-[18px] w-[18px] text-red-500 shrink-0" />
                              </motion.div>
                            ) : (
                              <motion.div key="circle" initial={{ scale: 1 }} animate={{ scale: 1 }}>
                                <EmptyCircle />
                              </motion.div>
                            )}
                          </AnimatePresence>
                          <span className="text-sm text-zinc-800 dark:text-zinc-200">
                            {step.nodeLabel || step.nodeId}
                          </span>
                          {step.error && (
                            <span className="text-[10px] text-red-500 ml-auto truncate max-w-48">{step.error}</span>
                          )}
                          <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 text-zinc-200 dark:text-zinc-700" />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>

                  {/* Media players */}
                  {mediaUrls.length > 0 && (
                    <div className="space-y-3 pt-2">
                      {mediaUrls.map((media, i) => (
                        media.type === 'video' ? (
                          <LazyVideo key={i} src={media.url} />
                        ) : (
                          <audio key={i} controlsList="nodownload" className="w-full" src={media.url} />
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
