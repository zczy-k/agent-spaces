'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { ExecutionLog, OutputField, Workflow } from '@agent-spaces/shared';
import { workflowApi } from '@/lib/workflow-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ExecutionChecklist } from '@/components/ui/checklist-cell';
import { ExecutionInputForm } from '@/components/workflow/workflow-execution-input-dialog';
import { JsonViewer } from '@/components/viewers/json-viewer';
import FileCard from '@/components/file-card-collections';

type FormatFileProps =
  | "doc" | "pdf" | "md" | "mdx" | "csv" | "xls" | "xlsx" | "txt"
  | "ppt" | "pptx" | "zip" | "rar" | "tar" | "gz"
  | "code" | "html" | "js" | "jsx" | "tsx" | "css" | "json"
  | "img" | "png" | "jpg" | "jpeg" | "video";
import { getWS } from '@/lib/ws';
import { Loader2, Play, Square } from 'lucide-react';

interface FileOutput {
  name: string;
  format: FormatFileProps;
  url: string;
}

/** 从扩展名推断 FormatFileProps 类型 */
function extToFormat(ext: string): FormatFileProps {
  const map: Record<string, FormatFileProps> = {
    pdf: 'pdf', doc: 'doc', docx: 'doc', md: 'md', mdx: 'mdx', txt: 'txt',
    csv: 'csv', xls: 'xls', xlsx: 'xlsx', ppt: 'ppt', pptx: 'pptx',
    zip: 'zip', rar: 'rar', tar: 'tar', gz: 'gz',
    html: 'html', htm: 'html', js: 'js', jsx: 'jsx', tsx: 'tsx', css: 'css', json: 'json',
    png: 'png', jpg: 'jpg', jpeg: 'jpeg', gif: 'img', webp: 'img', svg: 'img', bmp: 'img',
    mp4: 'video', avi: 'video', mov: 'video', mkv: 'video', webm: 'video',
    mp3: 'video', wav: 'video', flac: 'video', ogg: 'video', aac: 'video',
  };
  return map[ext.toLowerCase()] || 'code';
}

/** 提取 end 节点输出中的文件 URL */
function extractFileOutputs(log: ExecutionLog): FileOutput[] {
  const endIds = new Set((log.snapshot?.nodes || []).filter(n => n.type === 'end').map(n => n.id));
  const results: FileOutput[] = [];
  const seen = new Set<string>();

  function walk(obj: unknown) {
    if (typeof obj === 'string') {
      // 匹配包含扩展名的 URL 或路径
      const match = obj.match(/\/([^/?#]+\.(?:mp4|mp3|wav|flac|aac|ogg|pdf|doc|docx|md|mdx|txt|csv|xls|xlsx|ppt|pptx|zip|rar|tar|gz|html|htm|js|jsx|tsx|css|json|png|jpg|jpeg|gif|webp|svg|bmp|avi|mov|mkv|webm))(?:\?|#|$)/i);
      if (match && !seen.has(obj)) {
        seen.add(obj);
        const fileName = match[1];
        const ext = fileName.split('.').pop() || '';
        results.push({ name: fileName, format: extToFormat(ext), url: obj });
      }
    } else if (Array.isArray(obj)) {
      obj.forEach(walk);
    } else if (obj && typeof obj === 'object') {
      Object.values(obj as Record<string, unknown>).forEach(walk);
    }
  }

  for (const step of log.steps) {
    if (!endIds.has(step.nodeId)) continue;
    walk(step.output);
  }
  return results;
}

/** 提取 end 节点的完整输出数据 */
function extractEndOutput(log: ExecutionLog): unknown {
  const endIds = new Set((log.snapshot?.nodes || []).filter(n => n.type === 'end').map(n => n.id));
  const outputs: unknown[] = [];
  for (const step of log.steps) {
    if (!endIds.has(step.nodeId)) continue;
    if (step.output !== undefined) outputs.push(step.output);
  }
  if (outputs.length === 0) return null;
  if (outputs.length === 1) return outputs[0];
  return outputs;
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

  const endOutput = useMemo(() => executionLog ? extractEndOutput(executionLog) : null, [executionLog]);
  const fileOutputs = useMemo(() => executionLog ? extractFileOutputs(executionLog) : [], [executionLog]);

  const handleExecute = useCallback((values: Record<string, unknown>) => {
    if (!workflowId || !workflow) return;
    for (const c of cleanupRef.current) c(); cleanupRef.current = [];

    setExecuting(true); setExecutionLog(null);
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
      if (e.log) setExecutionLog(e.log);
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

  const hasResult = executionLog && executionLog.steps.length > 0;

  return (
    <div className="h-full flex flex-col p-4 gap-3">
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {workflow.icon ? <span className="text-xl leading-none">{workflow.icon}</span> : (
              <span className="w-6 h-6 rounded bg-primary/10 text-xs font-bold flex items-center justify-center text-primary shrink-0">{(workflow.name || 'W').charAt(0).toUpperCase()}</span>
            )}
            <h1 className="text-lg font-semibold truncate">{workflow.name}</h1>
            <span className="text-sm text-muted-foreground">{workflow.nodes.length} 节点</span>
          </div>
          {workflow.description && <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{workflow.description}</p>}
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

        {/* Right: 3 cards layout */}
        <div className="flex-1 min-w-0 flex flex-col gap-3 overflow-auto">
          {hasResult ? (
            <div className="flex gap-3 min-h-0 flex-1">
              {/* Left: Step */}
              <Card size="sm" className="m-px rounded-lg w-[320px] shrink-0 flex flex-col py-0">
                <CardHeader className="p-3 pb-1 shrink-0"><CardTitle className="text-xs">Step</CardTitle></CardHeader>
                <CardContent className="px-0 pb-0 flex-1 min-h-0 overflow-auto">
                  <ExecutionChecklist steps={executionLog!.steps} />
                </CardContent>
              </Card>

              {/* Right: JSON + 成品输出 */}
              <div className="flex-1 min-w-0 flex flex-col gap-3">
                {/* JSON 输出 */}
                <Card size="sm" className="m-px rounded-lg flex-1 min-h-0 flex flex-col py-0">
                  <CardHeader className="p-3 pb-1 shrink-0"><CardTitle className="text-xs">JSON 输出</CardTitle></CardHeader>
                  <CardContent className="px-2 pb-2 flex-1 min-h-0 overflow-auto">
                    {endOutput !== null ? (
                      <JsonViewer data={endOutput as import('@/components/viewers/json-viewer').JsonValue} rootName="output" defaultExpanded={2} className="border-0 shadow-none" />
                    ) : (
                      <div className="flex items-center justify-center h-full text-xs text-muted-foreground">暂无输出</div>
                    )}
                  </CardContent>
                </Card>

                {/* 成品输出 */}
                <Card size="sm" className="m-px rounded-lg shrink-0 py-0">
                  <CardHeader className="p-3 pb-1"><CardTitle className="text-xs">成品输出</CardTitle></CardHeader>
                  <CardContent className="px-3 pb-3">
                    {fileOutputs.length > 0 ? (
                      <div className="flex flex-wrap gap-3">
                        {fileOutputs.map((f, i) => (
                          <a key={i} href={f.url} target="_blank" rel="noopener noreferrer" className="group">
                            <FileCard formatFile={f.format} />
                            <div className="mt-1 text-[10px] text-muted-foreground text-center max-w-[56px] truncate group-hover:text-foreground transition-colors">
                              {f.name}
                            </div>
                          </a>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">暂无文件输出</div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : executing ? (
            <Card className="rounded-lg flex-1 min-h-0 flex flex-col">
              <CardContent className="flex-1 flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-xs text-muted-foreground">执行中...</span>
              </CardContent>
            </Card>
          ) : (
            <Card className="rounded-lg flex-1 min-h-0 flex flex-col">
              <CardContent className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
                填写参数并点击执行
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
