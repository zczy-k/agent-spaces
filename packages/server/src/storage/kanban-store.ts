import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { v4 as uuid } from 'uuid';
import type { KanbanBoard, KanbanColumn, KanbanTask, KanbanLayoutMode, KanbanPriority } from '@agent-spaces/shared';
import { getDataDir, ensureDir } from './json-store.js';

let db: DatabaseSync | null = null;

function openDb(): DatabaseSync {
  if (db) return db;
  const dir = join(getDataDir(), 'kanban');
  ensureDir(dir);
  db = new DatabaseSync(join(dir, 'kanban.sqlite'));
  db.exec(`
    CREATE TABLE IF NOT EXISTS kanban_boards (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT 'Kanban Board',
      layout_mode TEXT NOT NULL DEFAULT 'horizontal',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_kanban_boards_workspace ON kanban_boards(workspace_id);
    CREATE TABLE IF NOT EXISTS kanban_columns (
      id TEXT PRIMARY KEY,
      board_id TEXT NOT NULL,
      title TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT 'sky',
      sort_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (board_id) REFERENCES kanban_boards(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_kanban_columns_board ON kanban_columns(board_id);
    CREATE TABLE IF NOT EXISTS kanban_tasks (
      id TEXT PRIMARY KEY,
      board_id TEXT NOT NULL,
      column_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      priority TEXT NOT NULL DEFAULT 'medium',
      sort_order INTEGER NOT NULL DEFAULT 0,
      due_date TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (board_id) REFERENCES kanban_boards(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_kanban_tasks_board ON kanban_tasks(board_id);
    CREATE INDEX IF NOT EXISTS idx_kanban_tasks_column ON kanban_tasks(column_id);
  `);
  return db;
}

export function getBoard(workspaceId: string): KanbanBoard | null {
  const database = openDb();
  const row = database.prepare(
    'SELECT * FROM kanban_boards WHERE workspace_id = ? ORDER BY updated_at DESC'
  ).get(workspaceId) as Record<string, unknown> | undefined;
  if (!row) return null;
  return hydrateBoard(workspaceId, row);
}

export function listBoards(workspaceId: string): KanbanBoard[] {
  const database = openDb();
  const rows = database.prepare(
    'SELECT * FROM kanban_boards WHERE workspace_id = ? ORDER BY updated_at DESC'
  ).all(workspaceId) as Record<string, unknown>[];
  return rows.map((row) => hydrateBoard(workspaceId, row));
}

function hydrateBoard(workspaceId: string, row: Record<string, unknown>): KanbanBoard {
  const database = openDb();
  const boardId = row.id as string;
  const columns = (database.prepare(
    'SELECT * FROM kanban_columns WHERE board_id = ? ORDER BY sort_order ASC'
  ).all(boardId) as Record<string, unknown>[]).map(r => ({
    id: r.id as string,
    title: r.title as string,
    color: r.color as string,
    order: r.sort_order as number,
  }));
  const tasks = (database.prepare(
    'SELECT * FROM kanban_tasks WHERE board_id = ? ORDER BY sort_order ASC'
  ).all(boardId) as Record<string, unknown>[]).map(r => ({
    id: r.id as string,
    title: r.title as string,
    description: r.description as string,
    priority: r.priority as KanbanPriority,
    columnId: r.column_id as string,
    order: r.sort_order as number,
    createdAt: r.created_at as number,
    dueDate: (r.due_date as string) || undefined,
  }));
  return {
    id: boardId,
    workspaceId,
    title: row.title as string,
    layoutMode: (row.layout_mode as KanbanLayoutMode) || 'horizontal',
    columns,
    tasks,
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}

export function createBoard(workspaceId: string, title?: string): KanbanBoard {
  const database = openDb();
  const id = uuid();
  const now = Date.now();
  database.prepare(
    'INSERT INTO kanban_boards (id, workspace_id, title, layout_mode, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, workspaceId, title || 'Kanban Board', 'horizontal', now, now);
  return { id, workspaceId, title: title || 'Kanban Board', layoutMode: 'horizontal', columns: [], tasks: [], createdAt: now, updatedAt: now };
}

export function updateBoard(workspaceId: string, updates: { title?: string; layoutMode?: string }, boardId?: string): KanbanBoard | null {
  let board = boardId ? listBoards(workspaceId).find((item) => item.id === boardId) ?? null : getBoard(workspaceId);
  if (!board) return null;
  const database = openDb();
  const now = Date.now();
  if (updates.title !== undefined) {
    database.prepare('UPDATE kanban_boards SET title = ?, updated_at = ? WHERE workspace_id = ? AND id = ?').run(updates.title, now, workspaceId, board.id);
  }
  if (updates.layoutMode !== undefined) {
    database.prepare('UPDATE kanban_boards SET layout_mode = ?, updated_at = ? WHERE workspace_id = ? AND id = ?').run(updates.layoutMode, now, workspaceId, board.id);
  }
  return (boardId ? listBoards(workspaceId).find((item) => item.id === board.id) : getBoard(workspaceId)) ?? null;
}

export function deleteBoard(workspaceId: string, boardId?: string): boolean {
  const database = openDb();
  const board = boardId
    ? database.prepare('SELECT * FROM kanban_boards WHERE workspace_id = ? AND id = ?').get(workspaceId, boardId) as Record<string, unknown> | undefined
    : database.prepare('SELECT * FROM kanban_boards WHERE workspace_id = ?').get(workspaceId) as Record<string, unknown> | undefined;
  if (!board) return false;
  const id = board.id as string;
  database.prepare('DELETE FROM kanban_tasks WHERE board_id = ?').run(id);
  database.prepare('DELETE FROM kanban_columns WHERE board_id = ?').run(id);
  database.prepare('DELETE FROM kanban_boards WHERE id = ? AND workspace_id = ?').run(id, workspaceId);
  return true;
}

export function saveColumns(boardId: string, columns: KanbanColumn[]): void {
  const database = openDb();
  database.prepare('DELETE FROM kanban_columns WHERE board_id = ?').run(boardId);
  const stmt = database.prepare('INSERT INTO kanban_columns (id, board_id, title, color, sort_order) VALUES (?, ?, ?, ?, ?)');
  for (const col of columns) {
    stmt.run(col.id, boardId, col.title, col.color, col.order);
  }
  database.prepare('UPDATE kanban_boards SET updated_at = ? WHERE id = ?').run(Date.now(), boardId);
}

export function saveTasks(boardId: string, tasks: KanbanTask[]): void {
  const database = openDb();
  database.prepare('DELETE FROM kanban_tasks WHERE board_id = ?').run(boardId);
  const stmt = database.prepare('INSERT INTO kanban_tasks (id, board_id, column_id, title, description, priority, sort_order, due_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  for (const task of tasks) {
    stmt.run(task.id, boardId, task.columnId, task.title, task.description, task.priority, task.order, task.dueDate || null, task.createdAt);
  }
  database.prepare('UPDATE kanban_boards SET updated_at = ? WHERE id = ?').run(Date.now(), boardId);
}
