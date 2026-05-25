import { exec } from 'child_process';
import type { WorkflowCommandNode } from '@agent-spaces/shared';
import { getWorkspace } from '../storage/workspace-store.js';

export interface CommandResult {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
}

export async function executeCommandNode(
  workspaceId: string,
  node: WorkflowCommandNode,
): Promise<CommandResult> {
  const workspace = getWorkspace(workspaceId);
  const cwd = node.data.cwd || workspace?.boundDirs?.[0] || process.cwd();

  return new Promise<CommandResult>((resolve) => {
    exec(node.data.script, {
      cwd,
      env: { ...process.env, ...node.data.env },
      shell: node.data.shell || true,
      timeout: 300_000,
      maxBuffer: 10 * 1024 * 1024,
    }, (error, stdout, stderr) => {
      resolve({
        success: !error,
        exitCode: error ? (typeof error.code === 'number' ? error.code : 1) : 0,
        stdout: stdout?.toString() || '',
        stderr: stderr?.toString() || '',
      });
    });
  });
}
