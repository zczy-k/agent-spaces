import type { HttpClient } from '../client';
import type { DatabaseMeta, DocNode, DatabaseVectorStats, DatabaseVectorSearchResult, DatabaseNodeVersion } from '@agent-spaces/shared';

export function createDatabaseApi(http: HttpClient) {
  return {
    /** 列出工作空间的所有数据库 */
    list: (workspaceId: string): Promise<DatabaseMeta[]> =>
      http.get(`/api/workspaces/${workspaceId}/databases`),

    create: (workspaceId: string, data: { name: string; description?: string }): Promise<DatabaseMeta> =>
      http.post(`/api/workspaces/${workspaceId}/databases`, data),

    update: (workspaceId: string, databaseId: string, data: Partial<Pick<DatabaseMeta, 'name' | 'description'>>): Promise<DatabaseMeta> =>
      http.put(`/api/workspaces/${workspaceId}/databases/${databaseId}`, data),

    delete_: (workspaceId: string, databaseId: string): Promise<void> =>
      http.delete(`/api/workspaces/${workspaceId}/databases/${databaseId}`),

    // ---- DocNodes ----
    listNodes: (workspaceId: string, databaseId: string): Promise<DocNode[]> =>
      http.get(`/api/workspaces/${workspaceId}/databases/${databaseId}/nodes`),

    getNode: (workspaceId: string, databaseId: string, nodeId: string): Promise<DocNode> =>
      http.get(`/api/workspaces/${workspaceId}/databases/${databaseId}/nodes/${nodeId}`),

    createNode: (workspaceId: string, databaseId: string, data: { title: string; parentId?: string | null; icon?: string; cover?: string }): Promise<DocNode> =>
      http.post(`/api/workspaces/${workspaceId}/databases/${databaseId}/nodes`, data),

    updateNode: (workspaceId: string, databaseId: string, nodeId: string, data: Partial<Pick<DocNode, 'title' | 'content' | 'icon' | 'cover' | 'parentId'>>): Promise<DocNode> =>
      http.put(`/api/workspaces/${workspaceId}/databases/${databaseId}/nodes/${nodeId}`, data),

    moveNode: (workspaceId: string, databaseId: string, nodeId: string, parentId: string | null): Promise<void> =>
      http.putVoid(`/api/workspaces/${workspaceId}/databases/${databaseId}/nodes/${nodeId}/move`, { parentId }),

    trashNode: (workspaceId: string, databaseId: string, nodeId: string): Promise<void> =>
      http.postVoid(`/api/workspaces/${workspaceId}/databases/${databaseId}/nodes/${nodeId}/trash`),

    restoreNode: (workspaceId: string, databaseId: string, nodeId: string): Promise<void> =>
      http.postVoid(`/api/workspaces/${workspaceId}/databases/${databaseId}/nodes/${nodeId}/restore`),

    deleteNode: (workspaceId: string, databaseId: string, nodeId: string): Promise<void> =>
      http.delete(`/api/workspaces/${workspaceId}/databases/${databaseId}/nodes/${nodeId}`),

    // ---- Vector Search ----
    vectorStats: (workspaceId: string, databaseId: string): Promise<DatabaseVectorStats> =>
      http.get(`/api/workspaces/${workspaceId}/databases/${databaseId}/vector/stats`),

    vectorIndex: (workspaceId: string, databaseId: string): Promise<import('@agent-spaces/shared').DatabaseVectorIndexResult> =>
      http.post(`/api/workspaces/${workspaceId}/databases/${databaseId}/vector/index`),

    vectorSearch: (workspaceId: string, databaseId: string, query: string, limit?: number): Promise<DatabaseVectorSearchResult[]> =>
      http.post(`/api/workspaces/${workspaceId}/databases/${databaseId}/vector/search`, { query, limit }),

    // ---- Version History ----
    listNodeVersions: (workspaceId: string, databaseId: string, nodeId: string): Promise<DatabaseNodeVersion[]> =>
      http.get(`/api/workspaces/${workspaceId}/databases/${databaseId}/nodes/${nodeId}/versions`),

    // ---- AI Chat ----
    aiChat: (workspaceId: string, databaseId: string, body: { message: string; nodeId?: string }): Promise<Response> =>
      http.sse(`/api/workspaces/${workspaceId}/databases/${databaseId}/ai-chat`, body),
  };
}
