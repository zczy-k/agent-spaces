'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { ExecutionLog, OutputField, Workflow } from '@agent-spaces/shared';
import { workflowApi } from '@/lib/workflow-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ExecutionChecklist, type MediaUrl } from '@/components/ui/checklist-cell';
import { ExecutionInputForm } from '@/components/workflow/workflow-execution-input-dialog';
import { getWS } from '@/lib/ws';
import { Loader2, Play, Square } from 'lucide-react';

/** 递归提取 step output 中的 .mp4/.mp3 URL（去重） */
function extractMediaUrls(data: unknown): MediaUrl[] {
  const results: MediaUrl[] = [];
  const seen = new Set<string>();
  function walk(obj: unknown) {
    if (typeof obj === 'string') {
      if (/\.mp4(\?|$)/i.test(obj) && !seen.has(obj)) { seen.add(obj); results.push({ type: 'video', url: obj }); }
      else if (/\.mp3(\?|$)/i.test(obj) && !seen.has(obj)) { seen.add(obj); results.push({ type: 'audio', url: obj }); }
    } else if (Array.isArray(obj)) { obj.forEach(walk); }
    else if (obj && typeof obj === 'object') { Object.values(obj as Record<string, unknown>).forEach(walk); }
  }
  walk(data);
  return results;
}

/** 只从 end 节点 output 提取媒体 URL */
function extractEndMediaUrls(log: ExecutionLog): MediaUrl[] {
  const endIds = new Set((log.snapshot?.nodes || []).filter(n => n.type === 'end').map(n => n.id));
  const results: MediaUrl[] = [];
  const seen = new Set<string>();
  for (const step of log.steps) {
    if (!endIds.has(step.nodeId)) continue;
    for (const m of extractMediaUrls(step.output)) {
      if (!seen.has(m.url)) { seen.add(m.url); results.push(m); }
    }
  }
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
  const [mediaUrls, setMediaUrls] = useState<MediaUrl[]>([]);
  const cleanupRef = useRef<(() => void)[]>([]);

  useEffect(() => {
    if (!workflowId) { setLoading(false); return; }
    workflowApi.get(workflowId).then(setWorkflow).catch(() => setWorkflow(null)).finally(() => setLoading(false));
  }, [workflowId]);

  useEffect(() => {
    if (!paramsStr) return;
    try {
      const parsed = JSON.parse(paramsStr);
      if (typeof parsed === 'object' && parsed !== null) {
        const map: Record<string, string> = {};
        for (const [k, v] of Object.entries(parsed)) map[k] = typeof v === 'string' ? v : JSON.stringify(v);
        setInitialValues(map);
      }
    } catch { /* ignore */ }
  }, [paramsStr]);

  useEffect(() => { return () => { for (const c of cleanupRef.current) c(); cleanupRef.current = []; }; }, []);

  const inputFields = useMemo<OutputField[]>(() => {
    const startNode = (workflow?.nodes || []).find(n => n.type === 'start');
    const fields = startNode?.data?.inputFields;
    return Array.isArray(fields) ? fields as OutputField[] : [];
  }, [workflow]);

  const handleExecute = useCallback((values: Record<string, unknown>) => {
    if (!workflowId || !workflow) return;
    for (const c of cleanupRef.current) c(); cleanupRef.current = [];

    setExecuting(true); setExecutionLog(null); setMediaUrls([]);
    const ws = getWS('workflows');
    const send = () => ws.send('workflow:execute', { workflowId, input: values, snapshot: { nodes: workflow.nodes, edges: workflow.edges, groups: workflow.groups || [] } });

    const offLog = ws.on('execution:log', (data) => {
      const e = data as { workflowId?: string; executionId?: string; log?: ExecutionLog };
      if (e.workflowId !== workflowId || !e.log) return;
      if (e.executionId || e.log.id) setCurrentExecutionId(e.executionId || e.log.id);
      setExecutionLog(e.log);
    });
    const offDone = ws.on('workflow:completed', (data) => {
      const e = data as { workflowId?: string; log?: ExecutionLog };
      if (e.workflowId !== workflowId) return;
      if (e.log) { setExecutionLog(e.log); setMediaUrls(extractEndMediaUrls(e.log)); }
      setExecuting(false); setCurrentExecutionId(null);
    });
    const offErr = ws.on('workflow:error', (data) => {
      const e = data as { workflowId?: string; log?: ExecutionLog };
      if (e.workflowId !== workflowId) return;
      if (e.log) setExecutionLog(e.log);
      setExecuting(false); setCurrentExecutionId(null);
    });
    cleanupRef.current = [offLog, offDone, offErr];

    if (ws.connected) { send(); } else {
      const offConn = ws.on('connected', () => { offConn(); cleanupRef.current = cleanupRef.current.filter(c => c !== offConn); send(); });
      cleanupRef.current.push(offConn);
    }
  }, [workflowId, workflow]);

  const handleStop = useCallback(() => {
    if (!currentExecutionId) return;
    getWS('workflows').send('workflow:stop', { executionId: currentExecutionId });
    setExecuting(false); setCurrentExecutionId(null);
  }, [currentExecutionId]);

  if (!workflowId) return <div className="flex items-center justify-center h-full text-sm text-muted-foreground">缺少 workflow_id 参数</div>;
  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!workflow) return <div className="flex items-center justify-center h-full text-sm text-muted-foreground">工作流不存在</div>;

  return (
    <div className="h-full flex flex-col p-4 gap-3">
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {workflow.icon ? <span className="text-lg leading-none">{workflow.icon}</span> : (
              <span className="w-5 h-5 rounded bg-primary/10 text-[10px] font-bold flex items-center justify-center text-primary shrink-0">{(workflow.name || 'W').charAt(0).toUpperCase()}</span>
            )}
            <h1 className="text-sm font-semibold truncate">{workflow.name}</h1>
            <span className="text-xs text-muted-foreground">{workflow.nodes.length} 节点</span>
          </div>
          {workflow.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{workflow.description}</p>}
        </div>
      </div>

      <div className="flex-1 min-h-0 flex gap-3">
        {/* Left: input form */}
        <div className="w-[360px] shrink-0 flex flex-col">
          <Card className="rounded-lg flex-1 min-h-0 flex flex-col">
            <CardHeader className="p-3 pb-2 shrink-0"><CardTitle className="text-xs">执行参数</CardTitle></CardHeader>
            <CardContent className="p-3 pt-0 flex-1 min-h-0 flex flex-col">
              {inputFields.length > 0 ? (
                <ExecutionInputForm fields={inputFields} initialValues={initialValues} onSubmit={handleExecute} disabled={executing}
                  footer={submit => (
                    <div className="pt-2 shrink-0 flex gap-2">
                      <Button size="sm" className="h-7 text-xs gap-1 flex-1" disabled={executing} onClick={submit}><Play className="h-3 w-3" /> 执行</Button>
                      {executing && <Button variant="destructive" size="sm" className="h-7 text-xs gap-1" onClick={handleStop}><Square className="h-3 w-3" /> 停止</Button>}
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
                    {executing && <Button variant="destructive" size="sm" className="h-7 text-xs gap-1" onClick={handleStop}><Square className="h-3 w-3" /> 停止</Button>}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: ExecutionChecklist */}
        <div className="flex-1 min-w-0 flex flex-col">
          <Card className="rounded-lg flex-1 min-h-0 flex flex-col">
            <CardHeader className="p-3 pb-2 shrink-0"><CardTitle className="text-xs">执行结果</CardTitle></CardHeader>
            <CardContent className="p-0 pt-0 flex-1 min-h-0 overflow-auto">
              {executionLog && executionLog.steps.length > 0 ? (
                <ExecutionChecklist steps={executionLog.steps} mediaUrls={mediaUrls} />
              ) : executing ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-xs text-muted-foreground">执行中...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-xs text-muted-foreground">填写参数并点击执行</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
