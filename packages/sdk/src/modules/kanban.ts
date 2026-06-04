import type { HttpClient } from '../client';
import type { KanbanBoard } from '@agent-spaces/shared';

export function createKanbanApi(http: HttpClient) {
  return {
    get: (workspaceId: string): Promise<KanbanBoard> =>
      http.get(`/api/workspaces/${workspaceId}/kanban`),

    save: (workspaceId: string, data: Pick<KanbanBoard, 'columns' | 'tasks' | 'layoutMode' | 'title'>): Promise<void> =>
      http.putVoid(`/api/workspaces/${workspaceId}/kanban`, data),
  };
}
