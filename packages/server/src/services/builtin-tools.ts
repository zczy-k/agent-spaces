import { BUILT_IN_AGENT_TOOLS, type AgentConfig, type BuiltInAgentToolName, type Channel, type DocNode, type Issue, type IssueComment, type IssueStatus, type Task } from '@agent-spaces/shared';
import type { AgentFunctionTool } from '../adapters/agent-runtime-types.js';
import * as issueService from './issue.js';
import * as issueCommentService from './issue-comment.js';
import * as channelService from './channel.js';
import * as taskService from './task.js';
import * as agentService from './agent.js';
import * as commandService from './command.js';
import * as commandProcessManager from './command-process-manager.js';
import * as databaseStore from '../storage/database-store.js';

interface IssueToolActor {
  senderId: string;
  senderRole?: string;
}

const issueStatuses = [
  'draft',
  'planned',
  'in_progress',
  'review_pending',
  'changes_requested',
  'approved',
  'completed',
  'archived',
  'error',
] as const satisfies readonly IssueStatus[];

const currentChannelInputSchema = {
  type: 'object',
  properties: {
    channelId: {
      type: 'string',
      description: 'Must match the current channel id.',
    },
  },
  required: ['channelId'],
  additionalProperties: false,
};

const createIssueInputSchema = {
  type: 'object',
  properties: {
    channelId: {
      type: 'string',
      description: 'Must match the current channel id.',
    },
    title: {
      type: 'string',
      description: 'Issue title to create for the current channel.',
    },
    description: {
      type: 'string',
      description: 'Issue description to create for the current channel.',
    },
    status: {
      type: 'string',
      enum: issueStatuses,
      description: 'Issue status to create. Use completed when creating a finished issue report. Defaults to draft.',
    },
  },
  required: ['channelId', 'title'],
  additionalProperties: false,
};

const addCommentInputSchema = {
  type: 'object',
  properties: {
    channelId: {
      type: 'string',
      description: 'Must match the current channel id.',
    },
    content: {
      type: 'string',
      description: 'Comment content to add to the issue bound to the current channel.',
    },
  },
  required: ['channelId', 'content'],
  additionalProperties: false,
};

const readTerminalOutputInputSchema = {
  type: 'object',
  properties: {
    workspaceId: {
      type: 'string',
      description: 'Optional workspace ID. If omitted, the current workspace is used.',
    },
    sessionId: {
      type: 'string',
      description: 'Terminal session ID to read.',
    },
    offset: {
      type: 'integer',
      minimum: 0,
      description: 'Number of newest lines to skip before reading. Defaults to 0.',
    },
    limit: {
      type: 'integer',
      minimum: 1,
      maximum: 1000,
      description: 'Maximum number of lines to read. Defaults to 100.',
    },
  },
  required: ['sessionId'],
  additionalProperties: false,
};

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

export function createIssueFunctionTools(
  workspaceId: string,
  channel: Channel | undefined,
  actor: IssueToolActor,
  allowedTools?: BuiltInAgentToolName[],
): AgentFunctionTool[] {
  if (!channel) return [];
  const allowedToolNames = new Set(allowedTools ?? BUILT_IN_AGENT_TOOLS.map((tool) => tool.name));

  const tools: AgentFunctionTool[] = [
    {
      name: 'CreateCurrentChannelIssue',
      description: 'Create an issue for the current channel and bind it to this channel. The channelId must be the current channel id.',
      inputSchema: createIssueInputSchema,
      annotations: { destructive: false, openWorld: false },
      execute: async (input) => createCurrentChannelIssue(workspaceId, channel, input),
    },
  ];

  tools.push(
    {
      name: 'ViewCurrentChannelIssue',
      description: 'View the issue and comments bound to the current channel. The channelId must be the current channel id.',
      inputSchema: currentChannelInputSchema,
      annotations: { readOnly: true, openWorld: false },
      execute: async (input) => viewCurrentChannelIssue(workspaceId, channel, input),
    },
    {
      name: 'AddCurrentChannelComment',
      description: 'Add a comment to the issue bound to the current channel. The channelId must be the current channel id.',
      inputSchema: addCommentInputSchema,
      annotations: { destructive: false, openWorld: false },
      execute: async (input) => addCurrentChannelComment(workspaceId, channel, actor, input),
    },
  );

  return tools.filter((tool) => allowedToolNames.has(tool.name as BuiltInAgentToolName));
}

export function isBuiltInIssueToolName(name: string): boolean {
  return name === 'CreateCurrentChannelIssue'
    || name === 'ViewCurrentChannelIssue'
    || name === 'AddCurrentChannelComment'
    || name === 'agent-spaces.CreateCurrentChannelIssue'
    || name === 'agent-spaces.ViewCurrentChannelIssue'
    || name === 'agent-spaces.AddCurrentChannelComment';
}

interface CurrentIssueContext {
  issue: Issue;
  comments: IssueComment[];
  tasks: Task[];
  channel: Pick<Channel, 'id' | 'name' | 'type' | 'issueId' | 'members' | 'pinnedMentionId' | 'todos'>;
  assignableAgents: Array<Pick<AgentConfig, 'id' | 'name' | 'role' | 'description' | 'enabled' | 'sandboxDirs'>>;
  validAgentConfigIds: string[];
}

function createCurrentChannelIssue(workspaceId: string, channel: Channel, input: unknown): Issue {
  const data = assertCurrentChannelId(channel, input);
  const currentChannel = getCurrentChannel(workspaceId, channel);
  if (currentChannel.issueId) throw new Error(`Current channel already has a bound issue: ${currentChannel.issueId}`);

  const title = typeof data.title === 'string' ? data.title.trim() : '';
  const description = typeof data.description === 'string' ? data.description.trim() : '';
  const status = parseIssueStatus(data.status);
  if (!title) throw new Error('title is required.');

  const issue = issueService.createForChannel(workspaceId, currentChannel.id, { title, description, status });
  if (!issue) throw new Error(`Current channel not found: ${currentChannel.id}`);
  channel.issueId = issue.id;
  channel.type = 'issue';
  channel.name = title;
  return issue;
}

function parseIssueStatus(status: unknown): IssueStatus | undefined {
  if (status === undefined) return undefined;
  if (typeof status !== 'string' || !issueStatuses.includes(status as IssueStatus)) {
    throw new Error(`status must be one of: ${issueStatuses.join(', ')}.`);
  }
  return status as IssueStatus;
}

function viewCurrentChannelIssue(workspaceId: string, channel: Channel, input: unknown): CurrentIssueContext {
  assertCurrentChannelId(channel, input);
  const issue = getBoundIssue(workspaceId, channel);
  const currentChannel = getCurrentChannel(workspaceId, channel);
  const assignableAgents = getAssignableAgents(workspaceId, currentChannel);
  return {
    issue,
    comments: issueCommentService.listIssueComments(workspaceId, issue.id),
    tasks: taskService.list(workspaceId, issue.id),
    channel: {
      id: currentChannel.id,
      name: currentChannel.name,
      type: currentChannel.type,
      issueId: currentChannel.issueId,
      members: currentChannel.members,
      pinnedMentionId: currentChannel.pinnedMentionId,
      todos: currentChannel.todos,
    },
    assignableAgents,
    validAgentConfigIds: assignableAgents.map((agent) => agent.id),
  };
}

function addCurrentChannelComment(
  workspaceId: string,
  channel: Channel,
  actor: IssueToolActor,
  input: unknown,
): IssueComment {
  const data = assertCurrentChannelId(channel, input);
  const issue = getBoundIssue(workspaceId, channel);
  const content = typeof data.content === 'string' ? data.content.trim() : '';
  if (!content) throw new Error('content is required.');

  const comment = issueCommentService.createIssueComment(workspaceId, issue.id, {
    senderId: actor.senderId,
    senderRole: actor.senderRole,
    content,
    source: actor.senderId === 'user' ? 'user' : 'agent_progress',
    metadata: {
      channelId: channel.id,
    },
  });
  if (!comment) throw new Error(`Bound issue not found: ${issue.id}`);
  return comment;
}

function getBoundIssue(workspaceId: string, channel: Channel): Issue {
  const currentChannel = getCurrentChannel(workspaceId, channel);
  if (!currentChannel.issueId) throw new Error('Current channel is not bound to an issue.');
  const issue = issueService.getById(workspaceId, currentChannel.issueId);
  if (!issue) throw new Error(`Bound issue not found: ${currentChannel.issueId}`);
  return issue;
}

function getCurrentChannel(workspaceId: string, channel: Channel): Channel {
  const currentChannel = channelService.getChannel(workspaceId, channel.id);
  if (!currentChannel) throw new Error(`Current channel not found: ${channel.id}`);
  return currentChannel;
}

function getAssignableAgents(
  workspaceId: string,
  channel: Channel,
): Array<Pick<AgentConfig, 'id' | 'name' | 'role' | 'description' | 'enabled' | 'sandboxDirs'>> {
  const members = new Set(channel.members);
  return (agentService.listPresets(workspaceId) ?? [])
    .filter((agent) => members.has(agent.id) && agent.enabled !== false)
    .map((agent) => ({
      id: agent.id,
      name: agent.name,
      role: agent.role,
      description: agent.description,
      enabled: agent.enabled,
      sandboxDirs: agent.sandboxDirs,
    }));
}

function assertCurrentChannelId(channel: Channel, input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Tool input must be an object.');
  }
  const data = input as Record<string, unknown>;
  if (data.channelId !== channel.id) {
    throw new Error(`channelId must match the current channel id: ${channel.id}`);
  }
  return data;
}

export function createCommandFunctionTools(workspaceId: string, allowedTools?: BuiltInAgentToolName[]): AgentFunctionTool[] {
  const allowedToolNames = new Set(allowedTools ?? BUILT_IN_AGENT_TOOLS.map((tool) => tool.name));
  const tools: AgentFunctionTool[] = [
    {
      name: 'ReadTerminalOutput',
      description: 'Read paginated terminal output by terminal session ID. Defaults to the newest 100 lines.',
      inputSchema: readTerminalOutputInputSchema,
      annotations: { readOnly: true, openWorld: false },
      execute: async (input) => {
        const data = input as { workspaceId?: string; sessionId: string; offset?: number; limit?: number };
        if (data.workspaceId && data.workspaceId !== workspaceId) throw new Error('workspaceId mismatch');
        return commandProcessManager.readTerminalOutput(workspaceId, data.sessionId, {
          offset: data.offset,
          limit: data.limit,
        });
      },
    },
    {
      name: 'ListQuickCommands',
      description: 'List all quick commands for the workspace with running status.',
      inputSchema: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string', description: 'The workspace ID' },
        },
        required: ['workspaceId'],
        additionalProperties: false,
      },
      annotations: { readOnly: true, openWorld: false },
      execute: async (input) => {
        const data = input as { workspaceId: string };
        if (data.workspaceId !== workspaceId) throw new Error('workspaceId mismatch');
        const commands = commandService.listCommands(workspaceId);
        const processes = commandProcessManager.getCommandProcesses(workspaceId);
        const processMap = new Map(processes.map(p => [p.commandId, p]));
        return commands.map(cmd => ({
          ...cmd,
          running: processMap.has(cmd.id) ? processMap.get(cmd.id)!.status : false,
        }));
      },
    },
    {
      name: 'RunQuickCommand',
      description: 'Run a quick command by ID. Returns sessionId.',
      inputSchema: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          commandId: { type: 'string' },
        },
        required: ['workspaceId', 'commandId'],
        additionalProperties: false,
      },
      annotations: { destructive: false, openWorld: false },
      execute: async (input) => {
        const data = input as { workspaceId: string; commandId: string };
        if (data.workspaceId !== workspaceId) throw new Error('workspaceId mismatch');
        return { sessionId: commandProcessManager.runCommand(workspaceId, data.commandId) };
      },
    },
    {
      name: 'StopQuickCommand',
      description: 'Stop a running quick command by ID.',
      inputSchema: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          commandId: { type: 'string' },
        },
        required: ['workspaceId', 'commandId'],
        additionalProperties: false,
      },
      annotations: { destructive: false, openWorld: false },
      execute: async (input) => {
        const data = input as { workspaceId: string; commandId: string };
        if (data.workspaceId !== workspaceId) throw new Error('workspaceId mismatch');
        commandProcessManager.stopCommand(workspaceId, data.commandId);
        return { stopped: true };
      },
    },
  ];

  return tools.filter((tool) => allowedToolNames.has(tool.name as BuiltInAgentToolName));
}

export function createDatabaseFunctionTools(workspaceId: string, allowedTools?: BuiltInAgentToolName[]): AgentFunctionTool[] {
  const allowedToolNames = new Set(allowedTools ?? BUILT_IN_AGENT_TOOLS.map((tool) => tool.name));
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

function assertRecord(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Tool input must be an object.');
  }
  return input as Record<string, unknown>;
}

function readRequiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} is required.`);
  return value.trim();
}

function readString(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string.`);
  return value;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizeSearchText(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase();
}
