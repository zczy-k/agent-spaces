import { BUILT_IN_AGENT_TOOLS, type BuiltInAgentToolName, type KanbanBoard, type KanbanColumn, type KanbanLayoutMode, type KanbanPriority, type KanbanTask } from '@agent-spaces/shared';
import type { AgentFunctionTool } from '../../adapters/agent-runtime-types.js';
import * as kanbanStore from '../../storage/kanban-store.js';
import { assertRecord, readOptionalString, readRequiredString, readString } from './input-helpers.js';

const kanbanLayoutModes = ['horizontal', 'vertical'] as const satisfies readonly KanbanLayoutMode[];
const kanbanPriorities = ['low', 'medium', 'high'] as const satisfies readonly KanbanPriority[];

const listKanbanBoardsInputSchema = {
  type: 'object',
  properties: {},
  additionalProperties: false,
};

const viewKanbanBoardInputSchema = {
  type: 'object',
  properties: {
    boardId: {
      type: 'string',
      description: 'Optional Kanban board ID. Omit to view the current workspace board.',
    },
  },
  additionalProperties: false,
};

const createKanbanBoardInputSchema = {
  type: 'object',
  properties: {
    title: {
      type: 'string',
      description: 'Board title. Defaults to Kanban Board.',
    },
    layoutMode: {
      type: 'string',
      enum: kanbanLayoutModes,
      description: 'Board layout mode. Defaults to horizontal.',
    },
    columns: {
      type: 'array',
      description: 'Optional complete column list. Defaults to To Do, In Progress, Done, Archive.',
      items: { type: 'object' },
    },
    tasks: {
      type: 'array',
      description: 'Optional complete task list. Defaults to empty.',
      items: { type: 'object' },
    },
  },
  additionalProperties: false,
};

const updateKanbanBoardInputSchema = {
  type: 'object',
  properties: {
    boardId: {
      type: 'string',
      description: 'Optional Kanban board ID. Omit to update the current workspace board.',
    },
    title: {
      type: 'string',
      description: 'New board title.',
    },
    layoutMode: {
      type: 'string',
      enum: kanbanLayoutModes,
      description: 'New board layout mode.',
    },
    columns: {
      type: 'array',
      description: 'Complete replacement column list. Existing columns are replaced.',
      items: { type: 'object' },
    },
    tasks: {
      type: 'array',
      description: 'Complete replacement task list. Existing tasks are replaced.',
      items: { type: 'object' },
    },
  },
  additionalProperties: false,
};

const deleteKanbanBoardInputSchema = {
  type: 'object',
  properties: {
    boardId: {
      type: 'string',
      description: 'Optional Kanban board ID. Omit to delete the current workspace board.',
    },
  },
  additionalProperties: false,
};

export function createKanbanFunctionTools(workspaceId: string, allowedTools?: BuiltInAgentToolName[]): AgentFunctionTool[] {
  const allowedToolNames = getAllowedKanbanToolNames(allowedTools);
  const tools: AgentFunctionTool[] = [
    {
      name: 'ListKanbanBoards',
      description: 'List Kanban boards in the current workspace. Agent Spaces currently uses one board per workspace.',
      inputSchema: listKanbanBoardsInputSchema,
      annotations: { readOnly: true, openWorld: false },
      execute: async () => listKanbanBoards(workspaceId),
    },
    {
      name: 'ViewKanbanBoard',
      description: 'View the current workspace Kanban board, including board metadata, columns, and tasks.',
      inputSchema: viewKanbanBoardInputSchema,
      annotations: { readOnly: true, openWorld: false },
      execute: async (input) => viewKanbanBoard(workspaceId, input),
    },
    {
      name: 'CreateKanbanBoard',
      description: 'Create the current workspace Kanban board. Use this only when ListKanbanBoards returns no board.',
      inputSchema: createKanbanBoardInputSchema,
      annotations: { destructive: false, openWorld: false },
      execute: async (input) => createKanbanBoard(workspaceId, input),
    },
    {
      name: 'UpdateKanbanBoard',
      description: 'Update the current workspace Kanban board metadata and optionally replace its complete columns or tasks arrays.',
      inputSchema: updateKanbanBoardInputSchema,
      annotations: { destructive: false, openWorld: false },
      execute: async (input) => updateKanbanBoard(workspaceId, input),
    },
    {
      name: 'DeleteKanbanBoard',
      description: 'Delete the current workspace Kanban board, including all columns and tasks.',
      inputSchema: deleteKanbanBoardInputSchema,
      annotations: { destructive: true, openWorld: false },
      execute: async (input) => deleteKanbanBoard(workspaceId, input),
    },
  ];

  return tools.filter((tool) => allowedToolNames.has(tool.name as BuiltInAgentToolName));
}

function getAllowedKanbanToolNames(allowedTools?: BuiltInAgentToolName[]): Set<BuiltInAgentToolName> {
  const names = new Set(allowedTools ?? BUILT_IN_AGENT_TOOLS.map((tool) => tool.name));
  const hasKanbanTools = Array.from(names).some((name) => isKanbanToolName(name));
  if (hasKanbanTools) {
    names.add('ListKanbanBoards');
    names.add('ViewKanbanBoard');
    names.add('CreateKanbanBoard');
  }
  return names;
}

function listKanbanBoards(workspaceId: string): KanbanBoard[] {
  return kanbanStore.listBoards(workspaceId);
}

function viewKanbanBoard(workspaceId: string, input: unknown): KanbanBoard {
  const data = assertRecord(input);
  const board = resolveKanbanBoard(workspaceId, readOptionalString(data.boardId));
  return board;
}

function createKanbanBoard(workspaceId: string, input: unknown): KanbanBoard {
  const data = assertRecord(input);
  const existing = kanbanStore.getBoard(workspaceId);
  if (existing) throw new Error(`Kanban board already exists for this workspace: ${existing.id}. Use UpdateKanbanBoard instead.`);

  const title = readOptionalString(data.title) ?? 'Kanban Board';
  const layoutMode = parseLayoutMode(data.layoutMode);
  const board = kanbanStore.createBoard(workspaceId, title);
  if (layoutMode !== 'horizontal') kanbanStore.updateBoard(workspaceId, { layoutMode }, board.id);

  const columns = Object.hasOwn(data, 'columns') ? parseColumns(data.columns) : createDefaultColumns();
  kanbanStore.saveColumns(board.id, columns);
  if (Object.hasOwn(data, 'tasks')) kanbanStore.saveTasks(board.id, parseTasks(data.tasks, columns));

  const created = kanbanStore.getBoard(workspaceId);
  if (!created) throw new Error('Failed to create Kanban board.');
  return created;
}

function updateKanbanBoard(workspaceId: string, input: unknown): KanbanBoard {
  const data = assertRecord(input);
  const board = resolveKanbanBoard(workspaceId, readOptionalString(data.boardId));
  const updates: { title?: string; layoutMode?: KanbanLayoutMode } = {};

  if (Object.hasOwn(data, 'title')) updates.title = readRequiredString(data.title, 'title');
  if (Object.hasOwn(data, 'layoutMode')) updates.layoutMode = parseLayoutMode(data.layoutMode);
  if (!updates.title && !updates.layoutMode && !Object.hasOwn(data, 'columns') && !Object.hasOwn(data, 'tasks')) {
    throw new Error('At least one field is required: title, layoutMode, columns, or tasks.');
  }

  const nextColumns = Object.hasOwn(data, 'columns') ? parseColumns(data.columns) : board.columns;
  const nextTasks = Object.hasOwn(data, 'tasks') ? parseTasks(data.tasks, nextColumns) : parseTasks(board.tasks, nextColumns);

  if (updates.title || updates.layoutMode) {
    const updated = kanbanStore.updateBoard(workspaceId, updates, board.id);
    if (!updated) throw new Error(`Kanban board not found: ${board.id}`);
  }

  if (Object.hasOwn(data, 'columns')) kanbanStore.saveColumns(board.id, nextColumns);
  if (Object.hasOwn(data, 'tasks')) kanbanStore.saveTasks(board.id, nextTasks);

  const updated = kanbanStore.listBoards(workspaceId).find((item) => item.id === board.id);
  if (!updated) throw new Error(`Kanban board not found: ${board.id}`);
  return updated;
}

function deleteKanbanBoard(workspaceId: string, input: unknown): { ok: true; deletedBoardId: string } {
  const data = assertRecord(input);
  const board = resolveKanbanBoard(workspaceId, readOptionalString(data.boardId));
  const ok = kanbanStore.deleteBoard(workspaceId, board.id);
  if (!ok) throw new Error(`Kanban board not found: ${board.id}`);
  return { ok: true, deletedBoardId: board.id };
}

function resolveKanbanBoard(workspaceId: string, boardId?: string): KanbanBoard {
  const boards = kanbanStore.listBoards(workspaceId);
  const board = boardId ? boards.find((item) => item.id === boardId) : boards[0];
  if (!board) throw new Error('Kanban board not found. Use CreateKanbanBoard to create one.');
  return board;
}

function createDefaultColumns(): KanbanColumn[] {
  return [
    { id: 'todo', title: 'To Do', color: 'sky', order: 0 },
    { id: 'progress', title: 'In Progress', color: 'amber', order: 1 },
    { id: 'done', title: 'Done', color: 'emerald', order: 2 },
    { id: 'archive', title: 'Archive', color: 'slate', order: 3 },
  ];
}

function parseColumns(value: unknown): KanbanColumn[] {
  if (!Array.isArray(value)) throw new Error('columns must be an array.');
  return value.map((item, index) => {
    const data = assertRecord(item);
    return {
      id: readRequiredString(data.id, `columns[${index}].id`),
      title: readRequiredString(data.title, `columns[${index}].title`),
      color: readOptionalString(data.color) ?? 'sky',
      order: readInteger(data.order, `columns[${index}].order`, index),
    };
  });
}

function parseTasks(value: unknown, columns: KanbanColumn[]): KanbanTask[] {
  if (!Array.isArray(value)) throw new Error('tasks must be an array.');
  const columnIds = new Set(columns.map((column) => column.id));
  return value.map((item, index) => {
    const data = assertRecord(item);
    const columnId = readRequiredString(data.columnId, `tasks[${index}].columnId`);
    if (!columnIds.has(columnId)) throw new Error(`tasks[${index}].columnId does not match any column: ${columnId}`);
    return {
      id: readRequiredString(data.id, `tasks[${index}].id`),
      title: readRequiredString(data.title, `tasks[${index}].title`),
      description: readString(data.description ?? '', `tasks[${index}].description`),
      priority: parsePriority(data.priority, `tasks[${index}].priority`),
      columnId,
      order: readInteger(data.order, `tasks[${index}].order`, index),
      createdAt: readInteger(data.createdAt, `tasks[${index}].createdAt`, Date.now()),
      dueDate: readOptionalString(data.dueDate),
    };
  });
}

function parseLayoutMode(value: unknown): KanbanLayoutMode {
  if (value === undefined) return 'horizontal';
  if (typeof value !== 'string' || !kanbanLayoutModes.includes(value as KanbanLayoutMode)) {
    throw new Error(`layoutMode must be one of: ${kanbanLayoutModes.join(', ')}.`);
  }
  return value as KanbanLayoutMode;
}

function parsePriority(value: unknown, field: string): KanbanPriority {
  if (value === undefined) return 'medium';
  if (typeof value !== 'string' || !kanbanPriorities.includes(value as KanbanPriority)) {
    throw new Error(`${field} must be one of: ${kanbanPriorities.join(', ')}.`);
  }
  return value as KanbanPriority;
}

function readInteger(value: unknown, field: string, fallback: number): number {
  if (value === undefined) return fallback;
  if (typeof value !== 'number' || !Number.isInteger(value)) throw new Error(`${field} must be an integer.`);
  return value;
}

function isKanbanToolName(name: string): boolean {
  return name === 'ListKanbanBoards'
    || name === 'ViewKanbanBoard'
    || name === 'CreateKanbanBoard'
    || name === 'UpdateKanbanBoard'
    || name === 'DeleteKanbanBoard';
}
