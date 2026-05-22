export type KanbanPriority = 'low' | 'medium' | 'high';
export type KanbanLayoutMode = 'horizontal' | 'vertical';

export interface KanbanColumn {
  id: string;
  title: string;
  color: string;
  order: number;
}

export interface KanbanTask {
  id: string;
  title: string;
  description: string;
  priority: KanbanPriority;
  columnId: string;
  order: number;
  createdAt: number;
  dueDate?: string;
}

export interface KanbanBoard {
  id: string;
  workspaceId: string;
  title: string;
  layoutMode: KanbanLayoutMode;
  columns: KanbanColumn[];
  tasks: KanbanTask[];
  createdAt: number;
  updatedAt: number;
}
