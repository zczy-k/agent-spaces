import type { NodeTypeDefinition, PluginConfigField, PluginMeta } from '@agent-spaces/shared';
import { ensureDir, getDataDir, readJsonFile, writeJsonFile } from '../storage/json-store.js';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

type PluginManifest = Partial<Omit<PluginMeta, 'enabled' | 'tags' | 'hasView'>> & {
  id?: string;
  name?: string;
  version?: string;
  description?: string;
  tags?: string[];
  hasView?: boolean;
  hasWorkflow?: boolean;
  enabled?: boolean;
  config?: PluginConfigField[];
  workflowNodes?: NodeTypeDefinition[];
  entries?: { workflow?: string };
};

type PluginState = {
  enabled: Record<string, boolean>;
  config: Record<string, Record<string, string>>;
};

const STATE_FILE = () => path.join(pluginsDir(), 'state.json');

function pluginsDir(): string {
  return path.join(getDataDir(), 'plugins');
}

function pluginDir(pluginId: string): string {
  return path.join(pluginsDir(), pluginId);
}

function resolvePluginDir(pluginId: string): string | null {
  const direct = pluginDir(pluginId);
  if (existsSync(direct)) return direct;

  const root = pluginsDir();
  if (!existsSync(root)) return null;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(root, entry.name);
    const manifest = readManifestFromDir(dir);
    if ((manifest?.id || entry.name) === pluginId) return dir;
  }
  return null;
}

function readState(): PluginState {
  return readJsonFile<PluginState>(STATE_FILE()) ?? { enabled: {}, config: {} };
}

function writeState(state: PluginState): void {
  writeJsonFile(STATE_FILE(), state);
}

function readManifestFromDir(dir: string): PluginManifest | null {
  const candidates = ['plugin.json', 'manifest.json', 'package.json'];
  for (const filename of candidates) {
    const manifest = readJsonFile<PluginManifest>(path.join(dir, filename));
    if (manifest?.id || manifest?.name) return manifest;
  }
  return null;
}

function normalizePlugin(dirName: string, manifest: PluginManifest, state: PluginState): PluginMeta {
  const id = String(manifest.id || dirName);
  return {
    id,
    name: String(manifest.name || id),
    version: String(manifest.version || '0.0.0'),
    description: String(manifest.description || ''),
    author: manifest.author || { name: 'Unknown' },
    tags: Array.isArray(manifest.tags) ? manifest.tags : [],
    hasView: Boolean(manifest.hasView),
    hasWorkflow: Boolean(manifest.hasWorkflow || manifest.workflowNodes?.length || manifest.entries?.workflow),
    type: manifest.type,
    enabled: state.enabled[id] ?? Boolean(manifest.enabled),
    config: Array.isArray(manifest.config) ? manifest.config : [],
    iconPath: manifest.iconPath || '',
  };
}

function getManifest(pluginId: string): PluginManifest | null {
  const dir = resolvePluginDir(pluginId);
  return dir ? readManifestFromDir(dir) : null;
}

export function listPlugins(): PluginMeta[] {
  const root = pluginsDir();
  ensureDir(root);
  const state = readState();
  return readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map((entry) => {
      const manifest = readManifestFromDir(path.join(root, entry.name));
      return manifest ? normalizePlugin(entry.name, manifest, state) : null;
    })
    .filter((plugin): plugin is PluginMeta => Boolean(plugin));
}

export function listWorkflowPlugins(): PluginMeta[] {
  return listPlugins().filter(plugin => plugin.hasWorkflow);
}

export function setPluginEnabled(pluginId: string, enabled: boolean): PluginMeta {
  const state = readState();
  state.enabled[pluginId] = enabled;
  writeState(state);
  const plugin = listPlugins().find(item => item.id === pluginId);
  if (!plugin) throw new Error('Plugin not found');
  return plugin;
}

export function getPluginConfig(pluginId: string): Record<string, string> {
  const state = readState();
  const manifest = getManifest(pluginId);
  const defaults: Record<string, string> = {};
  for (const field of manifest?.config || []) {
    defaults[field.key] = field.value ?? '';
  }
  return { ...defaults, ...(state.config[pluginId] || {}) };
}

export function savePluginConfig(pluginId: string, data: Record<string, string>) {
  const state = readState();
  state.config[pluginId] = data;
  writeState(state);
  return { success: true };
}

export function getWorkflowNodes(pluginId: string): NodeTypeDefinition[] {
  const manifest = getManifest(pluginId);
  if (!manifest) throw new Error('Plugin not found');
  if (Array.isArray(manifest.workflowNodes)) return manifest.workflowNodes;

  const workflowEntry = manifest.entries?.workflow || 'workflow.json';
  const dir = resolvePluginDir(pluginId);
  if (!dir) throw new Error('Plugin not found');
  const workflowPath = path.join(dir, workflowEntry);
  if (!existsSync(workflowPath)) return [];
  const payload = readJsonFile<{ nodes?: NodeTypeDefinition[] } | NodeTypeDefinition[]>(workflowPath);
  if (Array.isArray(payload)) return payload;
  return Array.isArray(payload?.nodes) ? payload.nodes : [];
}
