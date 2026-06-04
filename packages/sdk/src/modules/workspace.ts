import type { HttpClient } from '../client';
import type { Workspace, CreateWorkspaceInput, WorkspaceNotificationSettings } from '@agent-spaces/shared';

export function createWorkspaceApi(http: HttpClient) {
  return {
    list: (): Promise<Workspace[]> =>
      http.get('/api/workspaces'),

    get: (id: string): Promise<Workspace> =>
      http.get(`/api/workspaces/${id}`),

    create: (data: CreateWorkspaceInput): Promise<Workspace> =>
      http.post('/api/workspaces', data),

    update: (id: string, data: Partial<Pick<Workspace, 'name' | 'boundDirs' | 'agentspaceDir'>>): Promise<Workspace> =>
      http.put(`/api/workspaces/${id}`, data),

    delete: (id: string): Promise<void> =>
      http.delete(`/api/workspaces/${id}`),

    /** 获取工作空间通知配置 */
    getNotificationSettings: (id: string): Promise<WorkspaceNotificationSettings> =>
      http.get(`/api/workspaces/${id}/notification-settings`),

    /** 更新工作空间通知配置 */
    updateNotificationSettings: (id: string, settings: Partial<WorkspaceNotificationSettings>): Promise<WorkspaceNotificationSettings> =>
      http.put(`/api/workspaces/${id}/notification-settings`, settings),

    /** 获取工作空间 Prompt */
    getPrompt: (id: string): Promise<{ content: string }> =>
      http.get(`/api/workspaces/${id}/prompt`),

    /** 更新工作空间 Prompt */
    updatePrompt: (id: string, content: string): Promise<void> =>
      http.postVoid(`/api/workspaces/${id}/prompt`, { content }),

    /** 文件夹浏览 */
    browseFolder: (path?: string): Promise<{ name: string; path: string; isDirectory: boolean }[]> =>
      http.get(`/api/folder/browse${path ? `?path=${encodeURIComponent(path)}` : ''}`),

    /** Git Clone (SSE) */
    cloneSse: (url: string, targetDir: string): Promise<Response> =>
      http.sse('/api/workspaces/clone', { url, targetDir }),
  };
}
