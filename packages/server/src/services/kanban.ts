import * as store from '../storage/kanban-store.js';
import type { KanbanBoard, KanbanColumn, KanbanTask } from '@agent-spaces/shared';

export function getBoard(workspaceId: string): KanbanBoard | null {
  return store.getBoard(workspaceId);
}

export function ensureBoard(workspaceId: string): KanbanBoard {
  let board = store.getBoard(workspaceId);
  if (!board) {
    board = store.createBoard(workspaceId);
    const defaultColumns: KanbanColumn[] = [
      { id: 'todo', title: 'To Do', color: 'sky', order: 0 },
      { id: 'progress', title: 'In Progress', color: 'amber', order: 1 },
      { id: 'done', title: 'Done', color: 'emerald', order: 2 },
      { id: 'archive', title: 'Archive', color: 'slate', order: 3 },
    ];
    store.saveColumns(board.id, defaultColumns);
    board = store.getBoard(workspaceId)!;
  }
  return board;
}

export function updateBoard(workspaceId: string, updates: { title?: string; layoutMode?: string }): KanbanBoard | null {
  return store.updateBoard(workspaceId, updates);
}

export function saveColumns(workspaceId: string, columns: KanbanColumn[]): KanbanBoard | null {
  const board = store.getBoard(workspaceId);
  if (!board) return null;
  store.saveColumns(board.id, columns);
  return store.getBoard(workspaceId);
}

export function saveTasks(workspaceId: string, tasks: KanbanTask[]): KanbanBoard | null {
  const board = store.getBoard(workspaceId);
  if (!board) return null;
  store.saveTasks(board.id, tasks);
  return store.getBoard(workspaceId);
}

export function saveBoard(workspaceId: string, data: { columns?: KanbanColumn[]; tasks?: KanbanTask[]; layoutMode?: string; title?: string }): KanbanBoard | null {
  let board = store.getBoard(workspaceId);
  if (!board) board = store.createBoard(workspaceId);
  if (data.title || data.layoutMode) {
    store.updateBoard(workspaceId, { title: data.title, layoutMode: data.layoutMode });
  }
  if (data.columns) store.saveColumns(board.id, data.columns);
  if (data.tasks) store.saveTasks(board.id, data.tasks);
  return store.getBoard(workspaceId);
}
