import type { Layout } from 'react-resizable-panels';

export const WORKFLOW_LAYOUT_KEY = 'agent-spaces:workflow-editor-layout';

export function loadWorkflowLayout(): Layout | undefined {
  try {
    const raw = localStorage.getItem(WORKFLOW_LAYOUT_KEY);
    return raw ? JSON.parse(raw) : undefined;
  } catch { return undefined; }
}

export type DebugResult = {
  status?: 'completed' | 'error';
  output?: unknown;
  error?: string;
  duration?: number;
};

export type NodeSelectContext =
  | {
    mode: 'connection-drop';
    sourceNodeId: string;
    sourceHandle: string | null;
    position: { x: number; y: number } | null;
  }
  | {
    mode: 'edge-insert';
    edgeId: string | null;
    sourceNodeId: string;
    targetNodeId: string;
    sourceHandle: string | null;
  };
