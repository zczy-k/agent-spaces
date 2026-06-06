'use client';

import type { NodeTypeDefinition, PluginConfigField, PluginMeta } from '@agent-spaces/shared';
import { sdk } from './sdk';

export type WorkflowPlugin = PluginMeta & {
  config?: PluginConfigField[];
};

export type StoreWorkflowPlugin = Omit<WorkflowPlugin, 'enabled'> & {
  path: string;
  iconUrl?: string;
};

export const pluginApi = {
  list(): Promise<PluginMeta[]> {
    return sdk.workflowPlugin.listAll();
  },
  listWorkflowPlugins(): Promise<PluginMeta[]> {
    return sdk.workflowPlugin.listWorkflow();
  },
  enable(pluginId: string): Promise<PluginMeta> {
    return sdk.workflowPlugin.enable(pluginId);
  },
  disable(pluginId: string): Promise<PluginMeta> {
    return sdk.workflowPlugin.disable(pluginId);
  },
  uninstall(pluginId: string): Promise<{ success: boolean }> {
    return sdk.workflowPlugin.uninstall(pluginId);
  },
  installFromStore(pluginId: string, sourceUrl?: string): Promise<PluginMeta> {
    return sdk.workflowPlugin.installFromStore(pluginId, sourceUrl);
  },
  getWorkflowNodes(pluginId: string): Promise<NodeTypeDefinition[]> {
    return sdk.workflowPlugin.getWorkflowNodes(pluginId);
  },
  getConfig(pluginId: string): Promise<Record<string, string>> {
    return sdk.workflowPlugin.getConfig(pluginId);
  },
  saveConfig(pluginId: string, data: Record<string, string>): Promise<{ success: boolean; error?: string }> {
    return sdk.workflowPlugin.saveConfig(pluginId, data);
  },
};

export const workflowPluginSchemeApi = {
  list(workflowId: string, pluginId: string): Promise<string[]> {
    return sdk.workflowPlugin.listSchemes(workflowId, pluginId);
  },
  create(workflowId: string, pluginId: string, schemeName: string): Promise<void> {
    return sdk.workflowPlugin.createScheme(workflowId, pluginId, schemeName);
  },
  read(workflowId: string, pluginId: string, schemeName: string): Promise<Record<string, string>> {
    return sdk.workflowPlugin.readScheme(workflowId, pluginId, schemeName);
  },
  save(workflowId: string, pluginId: string, schemeName: string, data: Record<string, string>): Promise<void> {
    return sdk.workflowPlugin.saveScheme(workflowId, pluginId, schemeName, data);
  },
  delete(workflowId: string, pluginId: string, schemeName: string): Promise<void> {
    return sdk.workflowPlugin.deleteScheme(workflowId, pluginId, schemeName);
  },
};
