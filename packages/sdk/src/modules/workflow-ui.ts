import type { HttpClient } from '../client';

export interface WorkflowUiProject {
  id: string;
  name: string;
  description?: string;
  version: string;
  type: 'react' | 'html';
  tags?: string[];
  enabledPlugins?: string[];
  agentConfigId?: string;
  mainFile: string;
  createdAt: string;
  updatedAt: string;
  storeUrl?: string;
  storeChecksum?: string;
}

export function createWorkflowUiApi(http: HttpClient) {
  return {
    list: (): Promise<WorkflowUiProject[]> =>
      http.get('/api/workflows-ui'),

    get: (id: string): Promise<WorkflowUiProject> =>
      http.get(`/api/workflows-ui/${id}`),

    create: (data: { name: string; type: 'react' | 'html'; description?: string; tags?: string[] }): Promise<WorkflowUiProject> =>
      http.post('/api/workflows-ui', data),

    update: (id: string, data: Partial<Pick<WorkflowUiProject, 'name' | 'description' | 'tags' | 'enabledPlugins' | 'agentConfigId' | 'mainFile'>>): Promise<WorkflowUiProject> =>
      http.put(`/api/workflows-ui/${id}`, data),

    delete_: (id: string): Promise<void> =>
      http.delete(`/api/workflows-ui/${id}`),

    getFileTree: (id: string): Promise<string[]> =>
      http.get(`/api/workflows-ui/${id}/files`),

    readFile: (id: string, filePath: string): Promise<{ content: string }> =>
      http.get(`/api/workflows-ui/${id}/files/content?path=${encodeURIComponent(filePath)}`),

    writeFile: (id: string, filePath: string, content: string): Promise<void> =>
      http.putVoid(`/api/workflows-ui/${id}/files/content`, { path: filePath, content }),

    importZip: (data: { zip: string; name?: string; type?: 'react' | 'html'; description?: string }): Promise<WorkflowUiProject> =>
      http.post('/api/workflows-ui/import', data),
  };
}
