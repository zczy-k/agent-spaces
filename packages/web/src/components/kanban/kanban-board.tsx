"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
  DndContext, useSensor, useSensors, PointerSensor, TouchSensor, KeyboardSensor,
  DragOverlay, defaultDropAnimationSideEffects, Active,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates, arrayMove, SortableContext, horizontalListSortingStrategy, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus, LayoutGrid, Layout, Search, Layers } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useKanbanStore } from '@/stores/kanban';
import type { KanbanColumn, KanbanTask, KanbanLayoutMode, KanbanPriority } from '@agent-spaces/shared';
import KanbanColumnComponent from './kanban-column';
import KanbanCard from './kanban-card';
import TaskModal from './task-modal';
import ColumnModal from './column-modal';

interface KanbanBoardProps {
  workspaceId: string;
}

export default function KanbanBoardPanel({ workspaceId }: KanbanBoardProps) {
  const { board, load, updateLayoutMode, updateColumns, updateTasks, setBoard } = useKanbanStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'all' | KanbanPriority>('all');
  const [selectedTask, setSelectedTask] = useState<KanbanTask | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [activeDragTask, setActiveDragTask] = useState<KanbanTask | null>(null);
  const [activeDragColumn, setActiveDragColumn] = useState<KanbanColumn | null>(null);
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);
  const [editingColumn, setEditingColumn] = useState<KanbanColumn | null>(null);
  const t = useTranslations('kanban');
  const tc = useTranslations('common');

  useEffect(() => { load(workspaceId); }, [workspaceId, load]);

  const columns = board?.columns ?? [];
  const tasks = board?.tasks ?? [];
  const layoutMode = board?.layoutMode ?? 'horizontal';

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const filteredTasks = tasks.filter((t) => {
    const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) || t.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPriority = priorityFilter === 'all' || t.priority === priorityFilter;
    return matchesSearch && matchesPriority;
  });

  // --- Drag handlers ---
  const handleDragStart = useCallback(({ active }: { active: Active }) => {
    const taskObj = tasks.find((t) => t.id === active.id);
    if (taskObj) setActiveDragTask(taskObj);
    else {
      const colObj = columns.find((c) => c.id === active.id);
      if (colObj) setActiveDragColumn(colObj);
    }
  }, [tasks, columns]);

  const handleDragOver = useCallback(({ active, over }: { active: Active; over: { id: string | number } | null }) => {
    if (!over) return;
    const activeId = active.id.toString();
    const overId = over.id.toString();
    if (activeId === overId) return;

    if (columns.some((col) => col.id === activeId)) {
      const overTaskObj = tasks.find((t) => t.id === overId);
      const realOverId = overTaskObj ? overTaskObj.columnId : overId;
      const ai = columns.findIndex((c) => c.id === activeId);
      const oi = columns.findIndex((c) => c.id === realOverId);
      if (ai !== -1 && oi !== -1 && ai !== oi) updateColumns(workspaceId, arrayMove(columns, ai, oi));
      return;
    }

    const activeTaskObj = tasks.find((t) => t.id === activeId);
    if (!activeTaskObj) return;
    const isOverAColumn = columns.some((col) => col.id === overId);
    const targetColumnId = isOverAColumn ? overId : tasks.find((t) => t.id === overId)?.columnId;
    if (targetColumnId && activeTaskObj.columnId !== targetColumnId) {
      updateTasks(workspaceId, tasks.map((t) => t.id === activeId ? { ...t, columnId: targetColumnId } : t));
    }
  }, [columns, tasks, workspaceId, updateColumns, updateTasks]);

  const handleDragEnd = useCallback(({ active, over }: { active: Active; over: { id: string | number } | null }) => {
    setActiveDragTask(null);
    setActiveDragColumn(null);
    if (!over) return;
    const activeId = active.id.toString();
    const overId = over.id.toString();

    if (columns.some((col) => col.id === activeId)) {
      const overTaskObj = tasks.find((t) => t.id === overId);
      const realOverId = overTaskObj ? overTaskObj.columnId : overId;
      const ai = columns.findIndex((c) => c.id === activeId);
      const oi = columns.findIndex((c) => c.id === realOverId);
      if (ai !== -1 && oi !== -1 && ai !== oi) updateColumns(workspaceId, arrayMove(columns, ai, oi));
      return;
    }

    const activeTaskObj = tasks.find((t) => t.id === activeId);
    if (!activeTaskObj) return;
    const isOverAColumn = columns.some((col) => col.id === overId);
    let targetColumnId = isOverAColumn ? overId : tasks.find((t) => t.id === overId)?.columnId;
    if (!targetColumnId) return;

    const ai = tasks.findIndex((t) => t.id === activeId);
    let oi = tasks.findIndex((t) => t.id === overId);
    const updated = tasks.map((t) => t.id === activeId ? { ...t, columnId: targetColumnId! } : t);
    if (oi !== -1) updateTasks(workspaceId, arrayMove(updated, ai, oi));
    else updateTasks(workspaceId, updated);
  }, [columns, tasks, workspaceId, updateColumns, updateTasks]);

  // --- Actions ---
  const handleAddTask = (columnId: string) => {
    const newTask: KanbanTask = {
      id: `task-${Date.now()}`, title: t('newTask'), description: '', priority: 'medium',
      columnId, order: tasks.filter((t) => t.columnId === columnId).length,
      createdAt: Date.now(),
    };
    setSelectedTask(newTask);
    setIsTaskModalOpen(true);
  };

  const handleSaveTask = (updatedTask: KanbanTask) => {
    const exists = tasks.some((t) => t.id === updatedTask.id);
    updateTasks(workspaceId, exists ? tasks.map((t) => t.id === updatedTask.id ? updatedTask : t) : [...tasks, updatedTask]);
  };

  const handleDeleteTask = (taskId: string) => {
    updateTasks(workspaceId, tasks.filter((t) => t.id !== taskId));
  };

  const handleAddColumn = (title: string, color: string) => {
    const newCol: KanbanColumn = { id: `col-${Date.now()}`, title, color, order: columns.length };
    updateColumns(workspaceId, [...columns, newCol]);
  };

  const handleEditColumn = (colId: string, newTitle: string, color: string) => {
    updateColumns(workspaceId, columns.map((c) => c.id === colId ? { ...c, title: newTitle, color } : c));
  };

  const handleDeleteColumn = (colId: string) => {
    updateColumns(workspaceId, columns.filter((c) => c.id !== colId));
    updateTasks(workspaceId, tasks.filter((t) => t.columnId !== colId));
  };

  if (!board) return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{tc('loading')}</div>;

  const priorityLabels: Record<string, string> = {
    all: t('priorityAll'),
    high: t('priorityHigh'),
    medium: t('priorityMedium'),
    low: t('priorityLow'),
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="border-b border-stone-200 dark:border-neutral-700 px-4 py-2.5 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[150px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400" />
          <input type="text" placeholder={t('searchPlaceholder')} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-8 pr-3 py-1.5 bg-stone-50 dark:bg-neutral-800 border border-stone-200 dark:border-neutral-600 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-stone-500/10 transition" />
        </div>
        <div className="flex items-center gap-1 ml-auto">
          {(['all', 'high', 'medium', 'low'] as const).map((p) => (
            <button key={p} onClick={() => setPriorityFilter(p)} className={`px-2.5 py-1 text-[10px] rounded-full border transition font-medium cursor-pointer ${priorityFilter === p ? 'bg-stone-800 dark:bg-neutral-100 dark:text-neutral-900 border-stone-800 text-white' : 'bg-white dark:bg-neutral-800 dark:border-neutral-600 dark:text-neutral-300 hover:bg-stone-50 text-stone-600 border-stone-200'}`}>{priorityLabels[p]}</button>
          ))}
        </div>
        <button onClick={() => handleAddTask(columns[0]?.id || '')} disabled={columns.length === 0} className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-800 dark:bg-neutral-100 dark:text-neutral-900 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-50"><Plus className="h-3.5 w-3.5" />{t('newCard')}</button>
        <button onClick={() => setIsColumnModalOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-neutral-800 border border-stone-200 dark:border-neutral-600 rounded-lg text-xs font-semibold text-stone-600 dark:text-neutral-300 shadow-xs transition cursor-pointer"><Layout className="h-3.5 w-3.5" />{t('section')}</button>
        <button onClick={() => updateLayoutMode(workspaceId, layoutMode === 'horizontal' ? 'vertical' : 'horizontal')} className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-neutral-800 border border-stone-200 dark:border-neutral-600 rounded-lg text-xs font-semibold text-stone-600 dark:text-neutral-300 shadow-xs transition cursor-pointer"><LayoutGrid className="h-3.5 w-3.5" />{layoutMode === 'horizontal' ? t('vertical') : t('horizontal')}</button>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-hidden p-4">
        {columns.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-16 border border-dashed border-stone-200 dark:border-neutral-600 rounded-3xl">
            <Layers className="h-10 w-10 text-stone-300 mb-3" />
            <p className="text-sm font-bold text-stone-500 dark:text-neutral-400">{t('noSections')}</p>
            <button onClick={() => setIsColumnModalOpen(true)} className="mt-4 px-4 py-2 bg-stone-800 dark:bg-neutral-100 dark:text-neutral-900 text-white rounded-xl text-xs font-bold cursor-pointer">{t('addSection')}</button>
          </div>
        ) : (
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
            <div className={`flex-1 h-full ${layoutMode === 'horizontal' ? 'flex flex-row overflow-x-auto items-start gap-4 pb-4' : 'flex flex-col gap-4'}`}>
              <SortableContext items={columns.map((c) => c.id)} strategy={layoutMode === 'horizontal' ? horizontalListSortingStrategy : verticalListSortingStrategy}>
                {columns.map((col) => (
                  <KanbanColumnComponent
                    key={col.id} column={col} tasks={filteredTasks.filter((t) => t.columnId === col.id)}
                    layoutMode={layoutMode} onCardClick={(task) => { setSelectedTask(task); setIsTaskModalOpen(true); }}
                    onAddTask={handleAddTask} onEditColumn={(c) => { setEditingColumn(c); setIsColumnModalOpen(true); }}
                    onDeleteColumn={handleDeleteColumn}
                  />
                ))}
              </SortableContext>
              {layoutMode === 'horizontal' && (
                <button onClick={() => setIsColumnModalOpen(true)} className="w-[280px] shrink-0 h-[120px] rounded-2xl border-2 border-dashed border-stone-200 dark:border-neutral-600 hover:border-stone-400 dark:hover:border-neutral-400 text-stone-400 hover:text-stone-800 dark:hover:text-neutral-200 flex flex-col items-center justify-center gap-1.5 transition cursor-pointer">
                  <Plus className="h-5 w-5" /><span className="text-xs font-bold">{t('newSection')}</span>
                </button>
              )}
            </div>
            <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }) }}>
              {activeDragTask ? <KanbanCard task={activeDragTask} onClick={() => {}} isOverlay /> : activeDragColumn ? (
                <div className="opacity-80 scale-98 pointer-events-none">
                  <KanbanColumnComponent column={activeDragColumn} tasks={filteredTasks.filter((t) => t.columnId === activeDragColumn.id)} layoutMode={layoutMode} onCardClick={() => {}} onAddTask={() => {}} onEditColumn={() => {}} onDeleteColumn={() => {}} />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      <TaskModal task={selectedTask} columns={columns} isOpen={isTaskModalOpen} onClose={() => { setIsTaskModalOpen(false); setSelectedTask(null); }} onSave={handleSaveTask} onDelete={handleDeleteTask} />
      <ColumnModal isOpen={isColumnModalOpen} onClose={() => { setIsColumnModalOpen(false); setEditingColumn(null); }} onCreate={handleAddColumn} onEdit={handleEditColumn} editingColumn={editingColumn} />
    </div>
  );
}
