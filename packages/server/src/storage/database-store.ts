import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { v4 as uuid } from 'uuid';
import type { DocNode } from '@agent-spaces/shared';
import { getDataDir, ensureDir } from './json-store.js';

let db: DatabaseSync | null = null;

function openDb(): DatabaseSync {
  if (db) return db;
  const dir = join(getDataDir(), 'database');
  ensureDir(dir);
  db = new DatabaseSync(join(dir, 'database.sqlite'));
  db.exec(`
    CREATE TABLE IF NOT EXISTS doc_nodes (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      icon TEXT NOT NULL DEFAULT '',
      cover TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      parent_id TEXT,
      is_trash INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_doc_nodes_workspace ON doc_nodes(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_doc_nodes_parent ON doc_nodes(workspace_id, parent_id);
  `);
  return db;
}

function rowToNode(row: Record<string, unknown>): DocNode {
  return {
    id: row.id as string,
    title: row.title as string,
    icon: row.icon as string,
    cover: row.cover as string,
    content: row.content as string,
    parentId: (row.parent_id as string) || null,
    isTrash: !!row.is_trash,
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}

export function listNodes(workspaceId: string): DocNode[] {
  const database = openDb();
  const rows = database.prepare(
    'SELECT * FROM doc_nodes WHERE workspace_id = ? ORDER BY created_at ASC'
  ).all(workspaceId);
  return (rows as Record<string, unknown>[]).map(rowToNode);
}

export function getNode(workspaceId: string, nodeId: string): DocNode | null {
  const database = openDb();
  const row = database.prepare(
    'SELECT * FROM doc_nodes WHERE workspace_id = ? AND id = ?'
  ).get(workspaceId, nodeId) as Record<string, unknown> | undefined;
  return row ? rowToNode(row) : null;
}

export function createNode(workspaceId: string, node: Partial<DocNode> & { parentId?: string | null }): DocNode {
  const database = openDb();
  const id = node.id || uuid();
  const now = Date.now();
  database.prepare(
    `INSERT INTO doc_nodes (id, workspace_id, title, icon, cover, content, parent_id, is_trash, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id, workspaceId,
    node.title || '未命名文档',
    node.icon || '📝',
    node.cover || '',
    node.content || '',
    node.parentId ?? node.parent_id ?? null,
    node.isTrash ? 1 : 0,
    node.createdAt || now,
    node.updatedAt || now
  );
  return getNode(workspaceId, id)!;
}

export function updateNode(workspaceId: string, nodeId: string, updates: Partial<DocNode>): DocNode | null {
  const existing = getNode(workspaceId, nodeId);
  if (!existing) return null;
  const database = openDb();
  const merged = { ...existing, ...updates, updatedAt: Date.now() };
  database.prepare(
    `UPDATE doc_nodes SET title=?, icon=?, cover=?, content=?, parent_id=?, is_trash=?, updated_at=?
     WHERE workspace_id=? AND id=?`
  ).run(
    merged.title, merged.icon, merged.cover, merged.content,
    merged.parentId, merged.isTrash ? 1 : 0, merged.updatedAt,
    workspaceId, nodeId
  );
  return getNode(workspaceId, nodeId);
}

export function deleteNode(workspaceId: string, nodeId: string): boolean {
  const database = openDb();
  const result = database.prepare(
    'DELETE FROM doc_nodes WHERE workspace_id=? AND id=?'
  ).run(workspaceId, nodeId);
  return result.changes > 0;
}

export function moveNode(workspaceId: string, nodeId: string, newParentId: string | null): DocNode | null {
  return updateNode(workspaceId, nodeId, { parentId: newParentId });
}

export function trashNode(workspaceId: string, nodeId: string): DocNode | null {
  return updateNode(workspaceId, nodeId, { isTrash: true });
}

export function restoreNode(workspaceId: string, nodeId: string): DocNode | null {
  const node = getNode(workspaceId, nodeId);
  if (!node) return null;
  // If parent is trashed, reparent to root
  if (node.parentId) {
    const parent = getNode(workspaceId, node.parentId);
    if (parent && parent.isTrash) {
      return updateNode(workspaceId, nodeId, { isTrash: false, parentId: null });
    }
  }
  return updateNode(workspaceId, nodeId, { isTrash: false });
}
