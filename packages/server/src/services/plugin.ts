import type { NodeTypeDefinition, PluginConfigField, PluginMeta } from '@agent-spaces/shared';
import { ensureDir, getDataDir, readJsonFile, writeJsonFile } from '../storage/json-store.js';
import { cpSync, existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { builtinModules } from 'node:module';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';
import { createBuiltinPluginApi } from './plugin-runtime-api.js';

const require = createRequire(import.meta.url);

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

type WorkflowNodeHandler = (ctx: any, args: Record<string, any>) => Promise<any>;

type PluginState = {
  enabled: Record<string, boolean>;
  config: Record<string, Record<string, string>>;
};

type ExecutablePlugin = {
  plugin: PluginMeta;
  handler: WorkflowNodeHandler;
  api: Record<string, any>;
};

const STATE_FILE = () => path.join(pluginsDir(), 'state.json');

function templatesPluginsDir(): string {
  const candidates = [
    path.resolve(process.cwd(), 'packages/templates/plugins'),
    path.resolve(process.cwd(), '../templates/plugins'),
    path.resolve(process.cwd(), 'templates/plugins'),
  ];
  return candidates.find(candidate => existsSync(candidate)) || candidates[0];
}

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
  const candidates = ['plugin.json', 'manifest.json', 'info.json', 'web-plugin.json', 'package.json'];
  for (const filename of candidates) {
    const manifest = readJsonFile<PluginManifest>(path.join(dir, filename));
    if (manifest?.id || manifest?.name) return manifest;
  }
  return null;
}

function hasPackageDependencies(dir: string): boolean {
  const pkg = readJsonFile<{ dependencies?: Record<string, string> }>(path.join(dir, 'package.json'));
  return Boolean(pkg?.dependencies && Object.keys(pkg.dependencies).length > 0);
}

function installPluginDependencies(dir: string): void {
  if (!hasPackageDependencies(dir)) return;
  if (existsSync(path.join(dir, 'node_modules'))) return;

  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npmCommand, ['install', '--omit=dev'], {
    cwd: dir,
    encoding: 'utf-8',
    stdio: 'pipe',
  });

  if (result.error || result.status !== 0) {
    const detail = (result.error?.message || result.stderr || result.stdout || '').trim();
    console.error('[plugin] failed to install dependencies', {
      dir,
      command: `${npmCommand} install --omit=dev`,
      status: result.status,
      signal: result.signal,
      error: result.error?.message,
      stderr: result.stderr?.trim(),
      stdout: result.stdout?.trim(),
    });
    throw new Error(`Failed to install plugin dependencies in ${dir}${detail ? `: ${detail}` : ''}`);
  }
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

function createRequireStub(): object {
  const target = () => createRequireStub();
  return new Proxy(target, {
    get: (_target, prop) => {
      if (prop === 'then') return undefined;
      if (prop === Symbol.toPrimitive) return () => '';
      return createRequireStub();
    },
    apply: () => createRequireStub(),
    construct: () => createRequireStub(),
  });
}

function loadCommonJsWorkflowNodes(workflowPath: string): NodeTypeDefinition[] {
  const source = readFileSync(workflowPath, 'utf-8');
  const module = { exports: {} as { nodes?: NodeTypeDefinition[] } | NodeTypeDefinition[] };
  const localRequire = (request: string) => {
    const normalized = request.replace(/^node:/, '');
    if (builtinModules.includes(normalized)) return require(request);
    return createRequireStub();
  };
  const script = new vm.Script(`(function(require, module, exports, __filename, __dirname) {\n${source}\n})`, { filename: workflowPath });
  const runner = script.runInNewContext({ console, Buffer, URL, URLSearchParams, fetch, setTimeout, clearTimeout });
  runner(localRequire, module, module.exports, workflowPath, path.dirname(workflowPath));
  const payload = module.exports;
  if (Array.isArray(payload)) return payload;
  return Array.isArray(payload?.nodes) ? payload.nodes : [];
}

function loadCommonJsWorkflowModule(workflowPath: string): { nodes: NodeTypeDefinition[]; handlers: Map<string, WorkflowNodeHandler> } {
  const source = readFileSync(workflowPath, 'utf-8');
  const module = { exports: {} as { nodes?: Array<NodeTypeDefinition & { handler?: WorkflowNodeHandler }> } };
  const localRequire = createRequire(workflowPath);
  const script = new vm.Script(`(function(require, module, exports, __filename, __dirname) {\n${source}\n})`, { filename: workflowPath });
  const runner = script.runInNewContext({ console, Buffer, URL, URLSearchParams, fetch, setTimeout, clearTimeout });
  runner(localRequire, module, module.exports, workflowPath, path.dirname(workflowPath));

  const payload = module.exports;
  const rawNodes = Array.isArray(payload) ? payload : Array.isArray(payload?.nodes) ? payload.nodes : [];
  const handlers = new Map<string, WorkflowNodeHandler>();
  const nodes = rawNodes.map((node) => {
    const { handler, ...serializable } = node;
    if (typeof handler === 'function' && typeof serializable.type === 'string') {
      handlers.set(serializable.type, handler);
    }
    return serializable as NodeTypeDefinition;
  });
  return { nodes, handlers };
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

export function uninstallPlugin(pluginId: string): void {
  const dir = resolvePluginDir(pluginId);
  if (!dir) throw new Error('Plugin not found');

  // remove plugin directory from disk
  rmSync(dir, { recursive: true, force: true });

  // clean state.json
  const state = readState();
  delete state.enabled[pluginId];
  delete state.config[pluginId];
  writeState(state);
}

export function setPluginEnabled(pluginId: string, enabled: boolean): PluginMeta {
  const state = readState();
  state.enabled[pluginId] = enabled;
  writeState(state);
  const plugin = listPlugins().find(item => item.id === pluginId);
  if (!plugin) throw new Error('Plugin not found');
  return plugin;
}

function findTemplatePluginDir(pluginId: string): string | null {
  const root = templatesPluginsDir();
  if (!existsSync(root)) return null;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(root, entry.name);
    const manifest = readManifestFromDir(dir);
    if ((manifest?.id || entry.name) === pluginId) return dir;
  }
  return null;
}

export function installTemplatePlugin(pluginId: string): PluginMeta {
  const sourceDir = findTemplatePluginDir(pluginId);
  if (!sourceDir) throw new Error('Template plugin not found');

  const manifest = readManifestFromDir(sourceDir);
  const id = String(manifest?.id || path.basename(sourceDir));
  const targetDir = path.join(pluginsDir(), path.basename(sourceDir));
  ensureDir(pluginsDir());
  if (!existsSync(targetDir)) {
    cpSync(sourceDir, targetDir, {
      recursive: true,
      filter: (src) => !src.split(path.sep).includes('node_modules'),
    });
  }
  installPluginDependencies(targetDir);
  return setPluginEnabled(id, true);
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

function getWorkflowEntryPath(pluginId: string): string | null {
  const manifest = getManifest(pluginId);
  if (!manifest) return null;
  const dir = resolvePluginDir(pluginId);
  if (!dir) return null;
  const workflowEntry = manifest.entries?.workflow || 'workflow.json';
  const workflowPath = path.join(dir, workflowEntry);
  return existsSync(workflowPath) ? workflowPath : null;
}

export function getWorkflowNodes(pluginId: string): NodeTypeDefinition[] {
  const manifest = getManifest(pluginId);
  if (!manifest) throw new Error('Plugin not found');
  if (Array.isArray(manifest.workflowNodes)) return manifest.workflowNodes;

  const workflowPath = getWorkflowEntryPath(pluginId);
  if (!workflowPath) return [];
  if (workflowPath.endsWith('.js') || workflowPath.endsWith('.cjs')) {
    return loadCommonJsWorkflowNodes(workflowPath);
  }
  const payload = readJsonFile<{ nodes?: NodeTypeDefinition[] } | NodeTypeDefinition[]>(workflowPath);
  if (Array.isArray(payload)) return payload;
  return Array.isArray(payload?.nodes) ? payload.nodes : [];
}

function getExecutablePluginByNodeType(nodeType: string): ExecutablePlugin | null {
  for (const plugin of listWorkflowPlugins()) {
    if (!plugin.enabled) continue;
    const workflowPath = getWorkflowEntryPath(plugin.id);
    if (!workflowPath || (!workflowPath.endsWith('.js') && !workflowPath.endsWith('.cjs'))) continue;

    try {
      const { handlers } = loadCommonJsWorkflowModule(workflowPath);
      const handler = handlers.get(nodeType);
      if (handler) return { plugin, handler, api: createBuiltinPluginApi() };
    } catch (error) {
      const nodes = loadCommonJsWorkflowNodes(workflowPath);
      if (nodes.some(node => node.type === nodeType)) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Plugin node "${nodeType}" from "${plugin.id}" failed to load: ${message}`);
      }
      continue;
    }
  }
  return null;
}

export function canExecuteWorkflowNode(nodeType: string): boolean {
  return Boolean(getExecutablePluginByNodeType(nodeType));
}

export async function executeWorkflowNode(
  nodeType: string,
  args: Record<string, any>,
  hooks: {
    logger: {
      info(message: string): void;
      warning(message: string): void;
      error(message: string): void;
    };
  },
): Promise<any> {
  const executable = getExecutablePluginByNodeType(nodeType);
  if (!executable) throw new Error(`Plugin node is not enabled or has no executable handler: ${nodeType}`);

  return executable.handler(
    {
      api: executable.api,
      nodeId: '',
      nodeLabel: nodeType,
      upstream: {},
      logger: hooks.logger,
    },
    args,
  );
}
