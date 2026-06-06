'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { ExecutionLog, InteractionRequest, Workflow } from '@agent-spaces/shared';
import { executionLogApi } from '@/lib/workflow-api';
import { getWS } from '@/lib/ws';
import type { DebugResult } from './workflow-editor-types';

interface UseWorkflowEditorExecutionParams {
  workflow: Workflow | null;
  workflowId: string | null;
}

export function useWorkflowEditorExecution({
  workflow, workflowId,
}: UseWorkflowEditorExecutionParams) {
  // ---- Execution state ----
  const [execStatus, setExecStatus] = useState('idle');
  const [executionLog, setExecutionLog] = useState<ExecutionLog | null>(null);
  const [executionLogs, setExecutionLogs] = useState<ExecutionLog[]>([]);
  const [selectedExecutionLogId, setSelectedExecutionLogId] = useState<string | null>(null);
  const [currentExecutionId, setCurrentExecutionId] = useState<string | null>(null);
  const executionCleanupRef = useRef<(() => void)[]>([]);

  // ---- Debug state ----
  const [debugNodeId, setDebugNodeId] = useState<string | null>(null);
  const [debugStatus, setDebugStatus] = useState<'idle' | 'running' | 'completed' | 'error'>('idle');
  const [debugResult, setDebugResult] = useState<DebugResult | null>(null);
  const [pendingInteraction, setPendingInteraction] = useState<InteractionRequest | null>(null);
  const debugCleanupRef = useRef<(() => void)[]>([]);

  // ---- Cleanup refs on unmount ----
  useEffect(() => {
    return () => {
      for (const cleanup of debugCleanupRef.current) cleanup();
      debugCleanupRef.current = [];
      for (const cleanup of executionCleanupRef.current) cleanup();
      executionCleanupRef.current = [];
    };
  }, []);

  // ---- Execution logs ----
  const loadExecutionLogs = useCallback(async () => {
    if (!workflowId) return;
    try {
      const logs = await executionLogApi.list(workflowId);
      setExecutionLogs(logs);
      setExecutionLog(current => current ?? logs[0] ?? null);
      setSelectedExecutionLogId(current => current ?? logs[0]?.id ?? null);
    } catch {
      setExecutionLogs([]);
    }
  }, [workflowId]);

  useEffect(() => {
    setExecutionLog(null);
    setExecutionLogs([]);
    setSelectedExecutionLogId(null);
    setCurrentExecutionId(null);
    void loadExecutionLogs();
  }, [workflowId, loadExecutionLogs]);

  // ---- Debug ----
  const cleanupDebugListeners = useCallback(() => {
    for (const cleanup of debugCleanupRef.current) cleanup();
    debugCleanupRef.current = [];
  }, []);

  const cleanupExecutionListeners = useCallback(() => {
    for (const cleanup of executionCleanupRef.current) cleanup();
    executionCleanupRef.current = [];
  }, []);

  const sendInteractionResponse = useCallback((request: InteractionRequest, data: unknown, cancelled = false) => {
    const ws = getWS('workflows');
    ws.send('workflow:interaction', {
      id: request.id,
      channel: 'workflow:interaction',
      type: 'interaction_response',
      executionId: request.executionId,
      workflowId: request.workflowId,
      nodeId: request.nodeId,
      data,
      cancelled,
    });
    setPendingInteraction(null);
  }, []);

  const handleResolveInteraction = useCallback((request: InteractionRequest, data: unknown) => {
    sendInteractionResponse(request, data, false);
  }, [sendInteractionResponse]);

  const handleCancelInteraction = useCallback((request: InteractionRequest) => {
    sendInteractionResponse(request, null, true);
  }, [sendInteractionResponse]);

  const handleCancelDebug = useCallback(() => {
    cleanupDebugListeners();
    setPendingInteraction(null);
    setDebugStatus('idle');
    setDebugResult(null);
    setDebugNodeId(null);
  }, [cleanupDebugListeners]);

  const handleDebugNode = useCallback((nodeId: string, inputs?: Record<string, unknown>) => {
    if (!workflow) return;
    cleanupDebugListeners();
    setDebugNodeId(nodeId);
    setDebugStatus('running');
    setDebugResult(null);

    const ws = getWS('workflows');
    const sendDebugRequest = () => {
      ws.send('workflow:debug-node', {
        workflowId: workflow.id,
        nodeId,
        inputs,
        snapshot: {
          nodes: workflow.nodes,
          edges: workflow.edges,
          groups: workflow.groups || [],
        },
      });
    };

    const offResult = ws.on('workflow:debug-node:result', (data) => {
      const result = data as DebugResult;
      cleanupDebugListeners();
      setDebugNodeId(nodeId);
      setDebugResult(result);
      setDebugStatus(result.status === 'error' ? 'error' : 'completed');
    });
    const offError = ws.on('workflow:debug-node:error', (data) => {
      const payload = data as { error?: string };
      cleanupDebugListeners();
      setPendingInteraction(null);
      setDebugNodeId(nodeId);
      setDebugResult({ status: 'error', error: payload.error || '测试失败' });
      setDebugStatus('error');
    });
    const offInteraction = ws.on('workflow:interaction', (data) => {
      const request = data as InteractionRequest;
      if (request.type !== 'interaction_required' || request.nodeId !== nodeId) return;
      setPendingInteraction(request);
    });
    debugCleanupRef.current = [offResult, offError, offInteraction];

    if (ws.connected) {
      sendDebugRequest();
    } else {
      const offConnected = ws.on('connected', () => {
        offConnected();
        debugCleanupRef.current = debugCleanupRef.current.filter(cleanup => cleanup !== offConnected);
        sendDebugRequest();
      });
      debugCleanupRef.current.push(offConnected);
    }
  }, [workflow, cleanupDebugListeners]);

  // ---- Execution ----
  const handleExecute = useCallback((input?: Record<string, unknown>, startNodeId?: string) => {
    if (!workflow) return;
    cleanupExecutionListeners();
    setExecStatus('running');
    setExecutionLog(null);
    setSelectedExecutionLogId(null);
    setCurrentExecutionId(null);

    const ws = getWS('workflows');
    const sendExecuteRequest = () => {
      ws.send('workflow:execute', {
        workflowId: workflow.id,
        input,
        startNodeId,
        snapshot: {
          nodes: workflow.nodes,
          edges: workflow.edges,
          groups: workflow.groups || [],
        },
      });
    };

    const offResult = ws.on('workflow:execute:result', (data) => {
      const result = data as { executionId?: string; status?: string };
      if (result.executionId) {
        setCurrentExecutionId(result.executionId);
        setSelectedExecutionLogId(result.executionId);
      }
      if (result.status) setExecStatus(result.status);
    });
    const offError = ws.on('workflow:execute:error', () => {
      setExecStatus('error');
    });
    const offLog = ws.on('execution:log', (data) => {
      const event = data as { workflowId?: string; executionId?: string; log?: ExecutionLog };
      if (event.workflowId !== workflow.id || !event.log) return;
      setCurrentExecutionId(event.executionId || event.log.id);
      setExecutionLog(event.log);
      setSelectedExecutionLogId(event.log.id);
      setExecutionLogs(prev => [event.log!, ...prev.filter(item => item.id !== event.log!.id)]);
      setExecStatus(event.log.status);
    });
    const offCompleted = ws.on('workflow:completed', (data) => {
      const event = data as { workflowId?: string; executionId?: string; log?: ExecutionLog };
      if (event.workflowId !== workflow.id) return;
      if (event.executionId) setCurrentExecutionId(event.executionId);
      if (event.log) setExecutionLog(event.log);
      if (event.log) {
        setSelectedExecutionLogId(event.log.id);
        setExecutionLogs(prev => [event.log!, ...prev.filter(item => item.id !== event.log!.id)]);
      }
      setExecStatus('completed');
      void loadExecutionLogs();
    });
    const offFailed = ws.on('workflow:error', (data) => {
      const event = data as { workflowId?: string; executionId?: string; log?: ExecutionLog };
      if (event.workflowId !== workflow.id) return;
      if (event.executionId) setCurrentExecutionId(event.executionId);
      if (event.log) setExecutionLog(event.log);
      if (event.log) {
        setSelectedExecutionLogId(event.log.id);
        setExecutionLogs(prev => [event.log!, ...prev.filter(item => item.id !== event.log!.id)]);
      }
      setExecStatus('error');
      void loadExecutionLogs();
    });
    executionCleanupRef.current = [offResult, offError, offLog, offCompleted, offFailed];

    if (ws.connected) {
      sendExecuteRequest();
    } else {
      const offConnected = ws.on('connected', () => {
        offConnected();
        executionCleanupRef.current = executionCleanupRef.current.filter(cleanup => cleanup !== offConnected);
        sendExecuteRequest();
      });
      executionCleanupRef.current.push(offConnected);
    }
  }, [workflow, cleanupExecutionListeners, loadExecutionLogs]);

  const handlePauseExecution = useCallback(() => {
    if (!currentExecutionId) return;
    getWS('workflows').send('workflow:pause', { executionId: currentExecutionId });
    setExecStatus('paused');
  }, [currentExecutionId]);

  const handleResumeExecution = useCallback(() => {
    if (!currentExecutionId) return;
    getWS('workflows').send('workflow:resume', { executionId: currentExecutionId });
    setExecStatus('running');
  }, [currentExecutionId]);

  const handleStopExecution = useCallback(() => {
    if (!currentExecutionId) return;
    getWS('workflows').send('workflow:stop', { executionId: currentExecutionId });
    setExecStatus('stopped');
  }, [currentExecutionId]);

  const handleSelectExecutionLog = useCallback((selectedLog: ExecutionLog) => {
    setExecutionLog(selectedLog);
    setSelectedExecutionLogId(selectedLog.id);
    setExecStatus(selectedLog.status);
  }, []);

  const handleDeleteExecutionLog = useCallback(async (logId: string) => {
    if (!workflow) return;
    await executionLogApi.delete(workflow.id, logId);
    setExecutionLogs(prev => prev.filter(item => item.id !== logId));
    if (selectedExecutionLogId === logId) {
      const nextLog = executionLogs.find(item => item.id !== logId) ?? null;
      setExecutionLog(nextLog);
      setSelectedExecutionLogId(nextLog?.id ?? null);
    }
  }, [workflow, selectedExecutionLogId, executionLogs]);

  const handleClearExecutionLogs = useCallback(async () => {
    if (!workflow) return;
    await executionLogApi.clear(workflow.id);
    setExecutionLogs([]);
    setExecutionLog(null);
    setSelectedExecutionLogId(null);
  }, [workflow]);

  // ---- Computed ----
  const startNodes = useMemo(
    () => (workflow?.nodes || []).filter(node => node.type === 'start'),
    [workflow],
  );

  const executionValidationError = useMemo(() => {
    if (!workflow) return '未加载工作流';
    if (startNodes.length === 0) return '缺少开始节点';
    return null;
  }, [workflow, startNodes]);

  return {
    // Execution state
    execStatus,
    executionLog,
    executionLogs,
    selectedExecutionLogId,
    currentExecutionId,
    startNodes,
    executionValidationError,

    // Execution actions
    handleExecute,
    handlePauseExecution,
    handleResumeExecution,
    handleStopExecution,
    handleSelectExecutionLog,
    handleDeleteExecutionLog,
    handleClearExecutionLogs,

    // Debug state
    debugNodeId,
    debugStatus,
    debugResult,
    pendingInteraction,

    // Debug actions
    handleDebugNode,
    handleCancelDebug,
    handleResolveInteraction,
    handleCancelInteraction,
  };
}
