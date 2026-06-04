import type { HttpClient } from '../client';
import type { Task } from '@agent-spaces/shared';

export function createTaskApi(http: HttpClient) {
  return {
    list: (workspaceId: string, issueId?: string): Promise<Task[]> =>
      http.get(`/api/workspaces/${workspaceId}/tasks${issueId ? `?issueId=${issueId}` : ''}`),

    create: (workspaceId: string, data: { issueId: string; title: string; description?: string; agentConfigId?: string }): Promise<Task> =>
      http.post(`/api/workspaces/${workspaceId}/tasks`, data),

    get: (workspaceId: string, taskId: string): Promise<Task> =>
      http.get(`/api/workspaces/${workspaceId}/tasks/${taskId}`),

    update: (workspaceId: string, taskId: string, data: { title?: string; description?: string; agentConfigId?: string }): Promise<Task> =>
      http.put(`/api/workspaces/${workspaceId}/tasks/${taskId}`, data),

    delete_: (workspaceId: string, taskId: string): Promise<void> =>
      http.delete(`/api/workspaces/${workspaceId}/tasks/${taskId}`),

    retry: (workspaceId: string, taskId: string): Promise<Task> =>
      http.post(`/api/workspaces/${workspaceId}/tasks/${taskId}/retry`),

    cancel: (workspaceId: string, taskId: string): Promise<Task> =>
      http.post(`/api/workspaces/${workspaceId}/tasks/${taskId}/cancel`),

    reorder: (workspaceId: string, data: { issueId: string; taskIds: string[] }): Promise<void> =>
      http.putVoid(`/api/workspaces/${workspaceId}/tasks/reorder`, data),
  };
}
