import type { HttpClient } from '../client';
import type { PluginMeta, NodeTypeDefinition, PluginWorkflowNodesResult, PluginConfigSaveResult } from '@agent-spaces/shared';

export function createWorkflowPluginApi(http: HttpClient) {
  return {
    listAll: (): Promise<PluginMeta[]> =>
      http.get('/api/plugins'),

    listWorkflow: (): Promise<PluginMeta[]> =>
      http.get('/api/plugins/workflow'),

    enable: (pluginId: string): Promise<PluginMeta> =>
      http.post(`/api/plugins/${encodeURIComponent(pluginId)}/enable`),

    disable: (pluginId: string): Promise<PluginMeta> =>
      http.post(`/api/plugins/${encodeURIComponent(pluginId)}/disable`),

    installFromStore: (pluginId: string): Promise<PluginMeta> =>
      http.post(`/api/plugins/store/${encodeURIComponent(pluginId)}/install`),

    getWorkflowNodes: (pluginId: string): Promise<NodeTypeDefinition[]> =>
      http.get<PluginWorkflowNodesResult>(`/api/plugins/${encodeURIComponent(pluginId)}/workflow-nodes`)
        .then(data => Array.isArray(data?.nodes) ? data.nodes : []),

    getConfig: (pluginId: string): Promise<Record<string, string>> =>
      http.get(`/api/plugins/${encodeURIComponent(pluginId)}/config`),

    saveConfig: (pluginId: string, data: Record<string, string>): Promise<PluginConfigSaveResult> =>
      http.put(`/api/plugins/${encodeURIComponent(pluginId)}/config`, data),

    // ---- Plugin Schemes ----
    listSchemes: (workflowId: string, pluginId: string): Promise<string[]> =>
      http.get(`/api/workflows/${encodeURIComponent(workflowId)}/plugin-schemes/${encodeURIComponent(pluginId)}`),

    createScheme: (workflowId: string, pluginId: string, schemeName: string): Promise<void> =>
      http.postVoid(`/api/workflows/${encodeURIComponent(workflowId)}/plugin-schemes/${encodeURIComponent(pluginId)}/${encodeURIComponent(schemeName)}`),

    readScheme: (workflowId: string, pluginId: string, schemeName: string): Promise<Record<string, string>> =>
      http.get(`/api/workflows/${encodeURIComponent(workflowId)}/plugin-schemes/${encodeURIComponent(pluginId)}/${encodeURIComponent(schemeName)}`),

    saveScheme: (workflowId: string, pluginId: string, schemeName: string, data: Record<string, string>): Promise<void> =>
      http.putVoid(`/api/workflows/${encodeURIComponent(workflowId)}/plugin-schemes/${encodeURIComponent(pluginId)}/${encodeURIComponent(schemeName)}`, data),

    deleteScheme: (workflowId: string, pluginId: string, schemeName: string): Promise<void> =>
      http.delete(`/api/workflows/${encodeURIComponent(workflowId)}/plugin-schemes/${encodeURIComponent(pluginId)}/${encodeURIComponent(schemeName)}`),
  };
}
