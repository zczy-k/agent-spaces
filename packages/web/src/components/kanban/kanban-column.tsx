"use client";

import React, { useState } from 'react';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, Trash2, Edit2, ChevronDown, ChevronUp } from 'lucide-react';
import type { KanbanColumn as KanbanColumnType, KanbanTask, KanbanLayoutMode } from '@agent-spaces/shared';
import KanbanCard from './kanban-card';

interface KanbanColumnProps {
  column: KanbanColumnType;
  tasks: KanbanTask[];
  layoutMode: KanbanLayoutMode;
  onCardClick: (task: KanbanTask) => void;
  onAddTask: (columnId: string) => void;
  onEditColumn: (column: KanbanColumnType) => void;
  onDeleteColumn: (columnId: string) => void;
}

const COLOR_OPTIONS = [
  { name: 'slate', headerBg: 'border-t-stone-500 bg-stone-50 dark:bg-neutral-800 text-stone-700 dark:text-neutral-200' },
  { name: 'sky', headerBg: 'border-t-sky-500 bg-sky-50/40 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300' },
  { name: 'emerald', headerBg: 'border-t-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300' },
  { name: 'amber', headerBg: 'border-t-amber-500 bg-amber-50/40 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300' },
  { name: 'rose', headerBg: 'border-t-rose-500 bg-rose-50/40 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300' },
  { name: 'purple', headerBg: 'border-t-purple-500 bg-purple-50/40 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300' },
];

const DOT_COLORS: Record<string, string> = {
  slate: 'bg-stone-400', sky: 'bg-sky-400', emerald: 'bg-emerald-400', amber: 'bg-amber-400', rose: 'bg-rose-400', purple: 'bg-purple-400',
};

export default function KanbanColumn({ column, tasks, layoutMode, onCardClick, onAddTask, onEditColumn, onDeleteColumn }: KanbanColumnProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({ id: column.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const activeColor = COLOR_OPTIONS.find((c) => c.name === column.color) || COLOR_OPTIONS[0];
  const taskIds = tasks.map((t) => t.id);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex flex-col rounded-2xl border transition-all duration-200 dark:border-neutral-700 ${isDragging ? 'opacity-30 border-dashed' : ''} ${isOver && !isDragging ? 'bg-stone-100/60 dark:bg-neutral-700/40 scale-[1.01] shadow-xs' : 'bg-stone-50/25 dark:bg-neutral-800/50 border-stone-200 dark:border-neutral-700'} ${layoutMode === 'horizontal' ? 'w-full md:w-[310px] lg:w-[330px] shrink-0 h-full max-h-[75vh] md:max-h-[80vh]' : 'w-full'}`}
    >
      <div {...attributes} {...listeners} className={`px-4 py-3.5 border-t-2 rounded-t-2xl border-b border-stone-200/80 dark:border-neutral-700 flex flex-col gap-2.5 relative cursor-grab active:cursor-grabbing select-none ${activeColor.headerBg}`}>
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <span className={`block h-3 w-3 rounded-full ${DOT_COLORS[column.color] || 'bg-stone-400'}`} />
            <div className="flex items-center gap-2 truncate flex-1 cursor-pointer" onClick={() => onEditColumn(column)}>
              <h3 className="text-sm font-bold truncate">{column.title}</h3>
              <span className="bg-stone-200/70 dark:bg-neutral-600 text-stone-700 dark:text-neutral-300 text-[10px] font-bold px-2 py-0.5 rounded-full min-w-[18px] text-center">{tasks.length}</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => onEditColumn(column)} className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-neutral-200 hover:bg-stone-100 dark:hover:bg-neutral-700 rounded-md transition cursor-pointer"><Edit2 className="h-3.5 w-3.5" /></button>
            {layoutMode === 'vertical' && (
              <button onClick={() => setIsCollapsed(!isCollapsed)} className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-neutral-200 hover:bg-stone-100 dark:hover:bg-neutral-700 rounded-md transition cursor-pointer">
                {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </button>
            )}
            {isConfirmingDelete ? (
              <div className="flex items-center gap-1 bg-stone-100 dark:bg-neutral-700 p-0.5 border border-stone-200 dark:border-neutral-600 rounded-md">
                <button onClick={() => { onDeleteColumn(column.id); setIsConfirmingDelete(false); }} className="px-1.5 py-0.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[9px] rounded transition cursor-pointer">Confirm</button>
                <button onClick={() => setIsConfirmingDelete(false)} className="px-1 py-0.5 bg-white dark:bg-neutral-600 border border-stone-200 dark:border-neutral-500 text-stone-600 dark:text-neutral-300 text-[9px] rounded transition cursor-pointer">No</button>
              </div>
            ) : (
              <button onClick={() => setIsConfirmingDelete(true)} className="p-1 text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-md transition cursor-pointer"><Trash2 className="h-3.5 w-3.5" /></button>
            )}
          </div>
        </div>
      </div>

      {(!isCollapsed || layoutMode === 'horizontal') && (
        <div className={`p-3.5 flex-1 flex flex-col gap-3 min-h-[140px] select-none ${layoutMode === 'horizontal' ? 'overflow-y-auto' : ''}`}>
          <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
            {tasks.length > 0 ? (
              <div className={`grid gap-3 ${layoutMode === 'vertical' ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4' : 'grid-cols-1'}`}>
                {tasks.map((task) => <KanbanCard key={task.id} task={task} onClick={() => onCardClick(task)} />)}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center py-6 px-4 border border-dashed border-stone-200 dark:border-neutral-600 rounded-xl text-stone-400">
                <p className="text-xs font-medium">Empty Section</p>
                <p className="text-[10px] mt-1">Cards can be dropped here</p>
              </div>
            )}
          </SortableContext>
          <button onClick={() => onAddTask(column.id)} className="w-full flex items-center justify-center gap-1.5 py-2 px-3 mt-1 text-xs font-semibold text-stone-500 dark:text-neutral-400 hover:text-stone-900 dark:hover:text-neutral-100 bg-white dark:bg-neutral-800 border border-stone-200 dark:border-neutral-600 hover:border-stone-400 dark:hover:border-neutral-500 rounded-xl transition cursor-pointer">
            <Plus className="h-4 w-4" />Add Task
          </button>
        </div>
      )}
    </div>
  );
}
