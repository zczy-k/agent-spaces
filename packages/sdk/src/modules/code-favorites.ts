import type { HttpClient } from '../client';
import type { CodeFavorite } from '@agent-spaces/shared';

export function createCodeFavoritesApi(http: HttpClient) {
  return {
    list: (workspaceId: string): Promise<CodeFavorite[]> =>
      http.get(`/api/workspaces/${workspaceId}/code-favorites`),

    create: (workspaceId: string, data: Omit<CodeFavorite, 'id' | 'createdAt' | 'workspaceId'>): Promise<CodeFavorite> =>
      http.post(`/api/workspaces/${workspaceId}/code-favorites`, data),

    delete_: (workspaceId: string, id: string): Promise<void> =>
      http.delete(`/api/workspaces/${workspaceId}/code-favorites/${id}`),
  };
}
