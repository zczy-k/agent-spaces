'use client';

import type { NodeTypeDefinition, PluginConfigField, PluginMeta } from '@agent-spaces/shared';
import { fetchWithAuth } from './auth';

export type WorkflowPlugin = PluginMeta & {
  config?: PluginConfigField[];
};

export type StoreWorkflowPlugin = Omit<WorkflowPlugin, 'enabled'> & {
  path: string;
  iconUrl?: string;
};

export const pluginApi = {
  list(): Promise<WorkflowPlugin[]> {
    return fetchWithAuth('/api/plugins').then(r => r.json());
  },
  listWorkflowPlugins(): Promise<WorkflowPlugin[]> {
    return fetchWithAuth('/api/plugins/workflow').then(r => r.json());
  },
  enable(pluginId: string): Promise<WorkflowPlugin> {
    return fetchWithAuth(`/api/plugins/${encodeURIComponent(pluginId)}/enable`, { method: 'POST' }).then(r => r.json());
  },
  disable(pluginId: string): Promise<WorkflowPlugin> {
    return fetchWithAuth(`/api/plugins/${encodeURIComponent(pluginId)}/disable`, { method: 'POST' }).then(r => r.json());
  },
  installFromStore(pluginId: string): Promise<WorkflowPlugin> {
    return fetchWithAuth(`/api/plugins/store/${encodeURIComponent(pluginId)}/install`, { method: 'POST' }).then(r => r.json());
  },
  getWorkflowNodes(pluginId: string): Promise<NodeTypeDefinition[]> {
    return fetchWithAuth(`/api/plugins/${encodeURIComponent(pluginId)}/workflow-nodes`)
      .then(r => r.json())
      .then(data => Array.isArray(data?.nodes) ? data.nodes : []);
  },
  getConfig(pluginId: string): Promise<Record<string, string>> {
    return fetchWithAuth(`/api/plugins/${encodeURIComponent(pluginId)}/config`).then(r => r.json());
  },
  saveConfig(pluginId: string, data: Record<string, string>): Promise<{ success: boolean; error?: string }> {
    return fetchWithAuth(`/api/plugins/${encodeURIComponent(pluginId)}/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(r => r.json());
  },
};

export const workflowPluginSchemeApi = {
  list(workflowId: string, pluginId: string): Promise<string[]> {
    return fetchWithAuth(`/api/workflows/${encodeURIComponent(workflowId)}/plugin-schemes/${encodeURIComponent(pluginId)}`).then(r => r.json());
  },
  create(workflowId: string, pluginId: string, schemeName: string): Promise<void> {
    return fetchWithAuth(`/api/workflows/${encodeURIComponent(workflowId)}/plugin-schemes/${encodeURIComponent(pluginId)}/${encodeURIComponent(schemeName)}`, {
      method: 'POST',
    }).then(() => {});
  },
  read(workflowId: string, pluginId: string, schemeName: string): Promise<Record<string, string>> {
    return fetchWithAuth(`/api/workflows/${encodeURIComponent(workflowId)}/plugin-schemes/${encodeURIComponent(pluginId)}/${encodeURIComponent(schemeName)}`).then(r => r.json());
  },
  save(workflowId: string, pluginId: string, schemeName: string, data: Record<string, string>): Promise<void> {
    return fetchWithAuth(`/api/workflows/${encodeURIComponent(workflowId)}/plugin-schemes/${encodeURIComponent(pluginId)}/${encodeURIComponent(schemeName)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(() => {});
  },
  delete(workflowId: string, pluginId: string, schemeName: string): Promise<void> {
    return fetchWithAuth(`/api/workflows/${encodeURIComponent(workflowId)}/plugin-schemes/${encodeURIComponent(pluginId)}/${encodeURIComponent(schemeName)}`, {
      method: 'DELETE',
    }).then(() => {});
  },
};
