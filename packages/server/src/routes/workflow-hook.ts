// Workflow webhook hook handler — SSE streaming of execution results

import { Router } from 'express';
import type { ExecutionManager } from '../services/execution-manager.js';
import type { WorkflowTriggerService } from '../services/workflow-trigger-service.js';

const SSE_TIMEOUT_MS = 5 * 60_000;

export function createWorkflowHookRouter(
  triggerService: WorkflowTriggerService,
  executionManager: ExecutionManager,
): Router {
  const router = Router();

  router.post('/hook/:hookName', (req, res) => {
    const hookName = req.params.hookName as string;

    const bindings = triggerService.getHookBindings(hookName);
    if (bindings.length === 0) {
      res.status(404).json({ error: `No workflows bound to hook "${hookName}"` });
      return;
    }

    const body: { workflowId?: string; input?: Record<string, unknown> } = req.body || {};
    let targets = bindings;
    if (body.workflowId) {
      targets = bindings.filter(b => b.workflowId === body.workflowId);
      if (targets.length === 0) {
        res.status(404).json({ error: `Workflow ${body.workflowId} not bound to hook "${hookName}"` });
        return;
      }
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    let completed = 0;
    let closed = false;

    const sse = (event: string, payload: unknown) => {
      if (closed) return;
      res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
    };

    const timeoutId = setTimeout(() => {
      if (!closed) {
        sse('timeout', { message: 'SSE timeout, closing' });
        res.write('event: done\ndata: {}\n\n');
        closed = true;
        res.end();
      }
    }, SSE_TIMEOUT_MS);

    res.on('close', () => {
      closed = true;
      clearTimeout(timeoutId);
    });

    const total = targets.length;
    for (const binding of targets) {
      executionManager.execute(
        { workflowId: binding.workflowId, input: body.input || {} },
        '__hook__',
        (channel, payload) => sse(channel, payload),
      ).then(() => {
        completed++;
        if (completed === total && !closed) {
          clearTimeout(timeoutId);
          res.write('event: done\ndata: {}\n\n');
          closed = true;
          res.end();
        }
      }).catch((err: any) => {
        sse('workflow:error', { workflowId: binding.workflowId, error: err.message });
        completed++;
        if (completed === total && !closed) {
          clearTimeout(timeoutId);
          res.write('event: done\ndata: {}\n\n');
          closed = true;
          res.end();
        }
      });
    }
  });

  return router;
}
