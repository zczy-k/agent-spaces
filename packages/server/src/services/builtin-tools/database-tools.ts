import { BUILT_IN_AGENT_TOOLS, type BuiltInAgentToolName, type DocNode } from '@agent-spaces/shared';
import type { AgentFunctionTool } from '../../adapters/agent-runtime-types.js';
import * as databaseStore from '../../storage/database-store.js';
import { assertRecord, readRequiredString, readString, readOptionalString, readStringOrDefault, normalizeSearchText } from './input-helpers.js';

const databasePathFilterInputSchema = {
  type: 'object',
  properties: {
    path: {
      type: 'string',
      description: 'Optional knowledge base path using titles, for example "/" or "/Projects/Spec". Defaults to root.',
    },
    filter: {
      type: 'string',
      description: 'Optional case-insensitive text filter.',
    },
    includeTrash: {
      type: 'boolean',
      description: 'Include trashed nodes. Defaults to false.',
    },
  },
  additionalProperties: false,
};

const readDatabaseNodeInputSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description: 'Knowledge base node ID.',
    },
  },
  required: ['id'],
  additionalProperties: false,
};

const createDatabaseNodeInputSchema = {
  type: 'object',
  properties: {
    title: {
      type: 'string',
      description: 'Knowledge base node title.',
    },
    content: {
      type: 'string',
      description: 'Initial content. Defaults to empty.',
    },
    parentId: {
      type: 'string',
      description: 'Optional parent node ID. Omit for root.',
    },
    path: {
      type: 'string',
      description: 'Optional parent path using titles. Ignored when parentId is provided.',
    },
    icon: {
      type: 'string',
      description: 'Optional icon. Defaults to the document emoji 📝.',
    },
    cover: {
      type: 'string',
      description: 'Optional cover value.',
    },
  },
  required: ['title'],
  additionalProperties: false,
};

const writeDatabaseNodeInputSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description: 'Knowledge base node ID.',
    },
    mode: {
      type: 'string',
      enum: ['insert', 'replace', 'overwrite'],
      description: 'insert appends content, replace replaces matched text, overwrite replaces all content. Defaults to insert.',
    },
    replace: {
      type: 'string',
      description: 'Text to replace when mode is replace.',
    },
    content: {
      type: 'string',
      description: 'Content to write.',
    },
  },
  required: ['id', 'content'],
  additionalProperties: false,
};

const deleteDatabaseNodeInputSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description: 'Knowledge base node or directory ID.',
    },
    permanent: {
      type: 'boolean',
      description: 'Permanently delete the node and descendants. Defaults to false, which moves them to trash.',
    },
  },
  required: ['id'],
  additionalProperties: false,
};

const moveDatabaseNodeInputSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description: 'Knowledge base node or directory ID to move.',
    },
    parentId: {
      type: 'string',
      description: 'Target parent node ID. Use null or omit for root.',
    },
    path: {
      type: 'string',
      description: 'Alternative target parent path. Ignored when parentId is provided.',
    },
  },
  required: ['id'],
  additionalProperties: false,
};

const updateDatabaseNodeMetaInputSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'Knowledge base node ID.' },
    title: { type: 'string', description: 'New node title.' },
    icon: { type: 'string', description: 'New node icon.' },
    cover: { type: 'string', description: 'New node cover value.' },
    parentId: { type: 'string', description: 'New parent node ID. Use null or omit to leave unchanged.' },
    isTrash: { type: 'boolean', description: 'Trash state.' },
  },
  required: ['id'],
  additionalProperties: false,
};

export function createDatabaseFunctionTools(workspaceId: string, allowedTools?: BuiltInAgentToolName[]): AgentFunctionTool[] {
  const allowedToolNames = getAllowedDatabaseToolNames(allowedTools);
  const tools: AgentFunctionTool[] = [
    {
      name: 'ListDatabaseNodes',
      description: 'List knowledge base files and directories under a title path. Input: path, filter, includeTrash.',
      inputSchema: databasePathFilterInputSchema,
      annotations: { readOnly: true, openWorld: false },
      execute: async (input) => listDatabaseNodes(workspaceId, input),
    },
    {
      name: 'SearchDatabaseNodes',
      description: 'Search knowledge base files by title or content under a title path. Input: path, filter, includeTrash.',
      inputSchema: databasePathFilterInputSchema,
      annotations: { readOnly: true, openWorld: false },
      execute: async (input) => searchDatabaseNodes(workspaceId, input),
    },
    {
      name: 'ReadDatabaseNode',
      description: 'Read knowledge base file or directory information by id, including metadata, path, children, and content.',
      inputSchema: readDatabaseNodeInputSchema,
      annotations: { readOnly: true, openWorld: false },
      execute: async (input) => readDatabaseNode(workspaceId, input),
    },
    {
      name: 'CreateDatabaseNode',
      description: 'Create a knowledge base file or directory. Use this when the database is empty or the target document does not exist.',
      inputSchema: createDatabaseNodeInputSchema,
      annotations: { destructive: false, openWorld: false },
      execute: async (input) => createDatabaseNode(workspaceId, input),
    },
    {
      name: 'WriteDatabaseNode',
      description: 'Write knowledge base file content by id. mode=insert appends, mode=replace replaces the replace text, mode=overwrite replaces all content.',
      inputSchema: writeDatabaseNodeInputSchema,
      annotations: { destructive: false, openWorld: false },
      execute: async (input) => writeDatabaseNode(workspaceId, input),
    },
    {
      name: 'DeleteDatabaseNode',
      description: 'Delete a knowledge base file or directory by id. Defaults to moving the node and descendants to trash; permanent=true deletes them.',
      inputSchema: deleteDatabaseNodeInputSchema,
      annotations: { destructive: true, openWorld: false },
      execute: async (input) => deleteDatabaseNode(workspaceId, input),
    },
    {
      name: 'MoveDatabaseNode',
      description: 'Move a knowledge base file or directory by id to a target parentId or path. Omit both to move to root.',
      inputSchema: moveDatabaseNodeInputSchema,
      annotations: { destructive: false, openWorld: false },
      execute: async (input) => moveDatabaseNode(workspaceId, input),
    },
    {
      name: 'UpdateDatabaseNodeMeta',
      description: 'Update knowledge base file metadata by id: title, icon, cover, parentId, isTrash.',
      inputSchema: updateDatabaseNodeMetaInputSchema,
      annotations: { destructive: false, openWorld: false },
      execute: async (input) => updateDatabaseNodeMeta(workspaceId, input),
    },
  ];

  return tools.filter((tool) => allowedToolNames.has(tool.name as BuiltInAgentToolName));
}

function getAllowedDatabaseToolNames(allowedTools?: BuiltInAgentToolName[]): Set<BuiltInAgentToolName> {
  const names = new Set(allowedTools ?? BUILT_IN_AGENT_TOOLS.map((tool) => tool.name));
  const hasDatabaseTools = Array.from(names).some((name) => isDatabaseToolName(name));
  if (hasDatabaseTools) names.add('CreateDatabaseNode');
  return names;
}

interface DatabaseNodeSummary {
  id: string;
  title: string;
  icon: string;
  path: string;
  parentId: string | null;
  isTrash: boolean;
  createdAt: number;
  updatedAt: number;
  childCount: number;
  contentLength: number;
}

function listDatabaseNodes(workspaceId: string, input: unknown): DatabaseNodeSummary[] {
  const data = assertRecord(input);
  const nodes = databaseStore.listNodes(workspaceId);
  const root = resolveDatabasePath(nodes, readOptionalString(data.path) ?? '/');
  const parentId = root?.id ?? null;
  const filter = normalizeSearchText(readOptionalString(data.filter));
  const includeTrash = data.includeTrash === true;
  return nodes
    .filter((node) => node.parentId === parentId)
    .filter((node) => includeTrash || !node.isTrash)
    .filter((node) => !filter || normalizeSearchText(node.title).includes(filter))
    .map((node) => summarizeDatabaseNode(node, nodes));
}

function searchDatabaseNodes(workspaceId: string, input: unknown): DatabaseNodeSummary[] {
  const data = assertRecord(input);
  const nodes = databaseStore.listNodes(workspaceId);
  const root = resolveDatabasePath(nodes, readOptionalString(data.path) ?? '/');
  const filter = normalizeSearchText(readOptionalString(data.filter));
  const includeTrash = data.includeTrash === true;
  const scopedIds = new Set(root ? collectDatabaseDescendantIds(nodes, root.id, true) : nodes.map((node) => node.id));

  return nodes
    .filter((node) => scopedIds.has(node.id))
    .filter((node) => includeTrash || !node.isTrash)
    .filter((node) => !filter || normalizeSearchText(`${node.title}\n${node.content}`).includes(filter))
    .map((node) => summarizeDatabaseNode(node, nodes));
}

function readDatabaseNode(workspaceId: string, input: unknown): DocNode & { path: string; children: DatabaseNodeSummary[] } {
  const data = assertRecord(input);
  const id = readRequiredString(data.id, 'id');
  const node = requireDatabaseNode(workspaceId, id);
  const nodes = databaseStore.listNodes(workspaceId);
  return {
    ...node,
    path: buildDatabaseNodePath(node, nodes),
    children: nodes
      .filter((child) => child.parentId === node.id)
      .map((child) => summarizeDatabaseNode(child, nodes)),
  };
}

function createDatabaseNode(workspaceId: string, input: unknown): DocNode & { path: string } {
  const data = assertRecord(input);
  const title = readRequiredString(data.title, 'title');
  const nodes = databaseStore.listNodes(workspaceId);
  const parentId = resolveMoveParentId(nodes, data);
  if (parentId) {
    const parent = nodes.find((node) => node.id === parentId);
    if (!parent) throw new Error(`Target parent not found: ${parentId}`);
  }

  const node = databaseStore.createNode(workspaceId, {
    title,
    content: readStringOrDefault(data.content, ''),
    parentId,
    icon: readOptionalString(data.icon) ?? '\u{1F4DD}',
    cover: readStringOrDefault(data.cover, ''),
  });
  const nextNodes = [...nodes, node];
  return {
    ...node,
    path: buildDatabaseNodePath(node, nextNodes),
  };
}

function writeDatabaseNode(workspaceId: string, input: unknown): DocNode {
  const data = assertRecord(input);
  const id = readRequiredString(data.id, 'id');
  const content = readString(data.content, 'content');
  const mode = readOptionalString(data.mode) ?? 'insert';
  const existing = requireDatabaseNode(workspaceId, id);
  let nextContent: string;

  if (mode === 'insert') {
    nextContent = existing.content ? `${existing.content}${content}` : content;
  } else if (mode === 'overwrite') {
    nextContent = content;
  } else if (mode === 'replace') {
    const replace = readRequiredString(data.replace, 'replace');
    if (!existing.content.includes(replace)) throw new Error('replace text was not found in the existing content.');
    nextContent = existing.content.replace(replace, content);
  } else {
    throw new Error('mode must be one of: insert, replace, overwrite.');
  }

  const updated = databaseStore.updateNode(workspaceId, id, { content: nextContent });
  if (!updated) throw new Error(`Database node not found: ${id}`);
  return updated;
}

function deleteDatabaseNode(workspaceId: string, input: unknown): { ok: true; deletedIds: string[]; permanent: boolean } {
  const data = assertRecord(input);
  const id = readRequiredString(data.id, 'id');
  requireDatabaseNode(workspaceId, id);
  const nodes = databaseStore.listNodes(workspaceId);
  const ids = collectDatabaseDescendantIds(nodes, id, true).reverse();
  const permanent = data.permanent === true;

  for (const nodeId of ids) {
    const ok = permanent
      ? databaseStore.deleteNode(workspaceId, nodeId)
      : Boolean(databaseStore.trashNode(workspaceId, nodeId));
    if (!ok) throw new Error(`Failed to delete database node: ${nodeId}`);
  }

  return { ok: true, deletedIds: ids.reverse(), permanent };
}

function moveDatabaseNode(workspaceId: string, input: unknown): DocNode {
  const data = assertRecord(input);
  const id = readRequiredString(data.id, 'id');
  requireDatabaseNode(workspaceId, id);
  const nodes = databaseStore.listNodes(workspaceId);
  const parentId = resolveMoveParentId(nodes, data);
  assertValidDatabaseParent(nodes, id, parentId);

  const updated = databaseStore.moveNode(workspaceId, id, parentId);
  if (!updated) throw new Error(`Database node not found: ${id}`);
  return updated;
}

function updateDatabaseNodeMeta(workspaceId: string, input: unknown): DocNode {
  const data = assertRecord(input);
  const id = readRequiredString(data.id, 'id');
  requireDatabaseNode(workspaceId, id);
  const updates: Partial<DocNode> = {};

  if (typeof data.title === 'string') updates.title = data.title;
  if (typeof data.icon === 'string') updates.icon = data.icon;
  if (typeof data.cover === 'string') updates.cover = data.cover;
  if (typeof data.isTrash === 'boolean') updates.isTrash = data.isTrash;
  if (Object.hasOwn(data, 'parentId')) {
    const parentId = data.parentId === null ? null : readRequiredString(data.parentId, 'parentId');
    const nodes = databaseStore.listNodes(workspaceId);
    assertValidDatabaseParent(nodes, id, parentId);
    updates.parentId = parentId;
  }

  if (Object.keys(updates).length === 0) throw new Error('At least one metadata field is required.');
  const updated = databaseStore.updateNode(workspaceId, id, updates);
  if (!updated) throw new Error(`Database node not found: ${id}`);
  return updated;
}

function summarizeDatabaseNode(node: DocNode, nodes: DocNode[]): DatabaseNodeSummary {
  return {
    id: node.id,
    title: node.title,
    icon: node.icon,
    path: buildDatabaseNodePath(node, nodes),
    parentId: node.parentId,
    isTrash: node.isTrash,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    childCount: nodes.filter((child) => child.parentId === node.id).length,
    contentLength: node.content.length,
  };
}

function resolveDatabasePath(nodes: DocNode[], path: string): DocNode | null {
  const parts = path.split('/').map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return null;

  let parentId: string | null = null;
  let current: DocNode | undefined;
  for (const part of parts) {
    current = nodes.find((node) => node.parentId === parentId && node.title === part && !node.isTrash);
    if (!current) throw new Error(`Database path not found: ${path}`);
    parentId = current.id;
  }
  return current ?? null;
}

function buildDatabaseNodePath(node: DocNode, nodes: DocNode[]): string {
  const byId = new Map(nodes.map((item) => [item.id, item]));
  const parts = [node.title || node.id];
  let parentId = node.parentId;
  let guard = 0;
  while (parentId && guard < 100) {
    const parent = byId.get(parentId);
    if (!parent) break;
    parts.unshift(parent.title || parent.id);
    parentId = parent.parentId;
    guard++;
  }
  return `/${parts.join('/')}`;
}

function collectDatabaseDescendantIds(nodes: DocNode[], id: string, includeSelf: boolean): string[] {
  const ids = includeSelf ? [id] : [];
  for (const child of nodes.filter((node) => node.parentId === id)) {
    ids.push(...collectDatabaseDescendantIds(nodes, child.id, true));
  }
  return ids;
}

function resolveMoveParentId(nodes: DocNode[], data: Record<string, unknown>): string | null {
  if (Object.hasOwn(data, 'parentId')) {
    if (data.parentId === null || data.parentId === undefined) return null;
    return readRequiredString(data.parentId, 'parentId');
  }

  const path = readOptionalString(data.path);
  if (!path) return null;
  return resolveDatabasePath(nodes, path)?.id ?? null;
}

function assertValidDatabaseParent(nodes: DocNode[], nodeId: string, parentId: string | null): void {
  if (!parentId) return;
  const parent = nodes.find((node) => node.id === parentId);
  if (!parent) throw new Error(`Target parent not found: ${parentId}`);
  if (parentId === nodeId) throw new Error('A node cannot be moved under itself.');
  const descendantIds = new Set(collectDatabaseDescendantIds(nodes, nodeId, false));
  if (descendantIds.has(parentId)) throw new Error('A node cannot be moved under its own descendant.');
}

function requireDatabaseNode(workspaceId: string, id: string): DocNode {
  const node = databaseStore.getNode(workspaceId, id);
  if (!node) throw new Error(`Database node not found: ${id}`);
  return node;
}

function isDatabaseToolName(name: string): boolean {
  return name === 'ListDatabaseNodes'
    || name === 'SearchDatabaseNodes'
    || name === 'ReadDatabaseNode'
    || name === 'CreateDatabaseNode'
    || name === 'WriteDatabaseNode'
    || name === 'DeleteDatabaseNode'
    || name === 'MoveDatabaseNode'
    || name === 'UpdateDatabaseNodeMeta';
}
