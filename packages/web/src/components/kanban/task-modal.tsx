"use client";

import React, { useState, useEffect } from 'react';
import { X, Calendar, AlertCircle, FileText, LayoutGrid, Trash2, Clock } from 'lucide-react';
import type { KanbanTask, KanbanPriority, KanbanColumn } from '@agent-spaces/shared';

interface TaskModalProps {
  task: KanbanTask | null;
  columns: KanbanColumn[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: KanbanTask) => void;
  onDelete: (taskId: string) => void;
}

const PRIORITY_COLORS: Record<KanbanPriority, { bg: string; activeBg: string; dot: string }> = {
  low: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100', activeBg: 'bg-emerald-600 text-white border-emerald-600', dot: 'bg-emerald-500' },
  medium: { bg: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100', activeBg: 'bg-amber-500 text-white border-amber-500', dot: 'bg-amber-500' },
  high: { bg: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100', activeBg: 'bg-rose-600 text-white border-rose-600', dot: 'bg-rose-500' },
};

export default function TaskModal({ task, columns, isOpen, onClose, onSave, onDelete }: TaskModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<KanbanPriority>('medium');
  const [columnId, setColumnId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description);
      setPriority(task.priority);
      setColumnId(task.columnId);
      setDueDate(task.dueDate || '');
      setIsConfirmingDelete(false);
    }
  }, [task, isOpen]);

  if (!isOpen || !task) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({ ...task, title: title.trim(), description: description.trim(), priority, columnId, dueDate: dueDate || undefined });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white dark:bg-neutral-800 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden z-10 max-h-[92vh] sm:max-h-[85vh] flex flex-col">
        <div className="px-6 py-4 border-b border-stone-100 dark:border-neutral-700 flex items-center justify-between bg-stone-50/50 dark:bg-neutral-800">
          <span className="text-xs font-semibold text-stone-500 dark:text-neutral-400 uppercase tracking-wider">Task Details</span>
          <button onClick={onClose} className="p-1.5 rounded-full text-stone-400 hover:bg-stone-100 dark:hover:bg-neutral-700 transition cursor-pointer"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-stone-500 dark:text-neutral-400 uppercase tracking-wider flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" />Title</label>
            <input type="text" required placeholder="Task title" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3.5 py-2.5 rounded-lg border border-stone-200 dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-stone-500/10 focus:border-stone-400 text-sm font-medium text-stone-900 placeholder:text-stone-400 transition" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-stone-500 dark:text-neutral-400 uppercase tracking-wider flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5" />Description</label>
            <textarea rows={4} placeholder="Task description..." value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-3.5 py-2.5 rounded-lg border border-stone-200 dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-stone-500/10 focus:border-stone-400 text-sm text-stone-700 dark:text-neutral-200 placeholder:text-stone-400 leading-relaxed transition" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-500 dark:text-neutral-400 uppercase tracking-wider flex items-center gap-1.5"><LayoutGrid className="h-3.5 w-3.5" />Section</label>
              <select value={columnId} onChange={(e) => setColumnId(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-stone-200 dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-stone-500/10 text-sm bg-white transition cursor-pointer">
                {columns.map((col) => <option key={col.id} value={col.id}>{col.title}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-500 dark:text-neutral-400 uppercase tracking-wider flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />Due Date</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-stone-500/10 text-sm bg-white transition cursor-pointer" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-stone-500 dark:text-neutral-400 uppercase tracking-wider flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />Priority</label>
            <div className="grid grid-cols-3 gap-2">
              {(['low', 'medium', 'high'] as KanbanPriority[]).map((p) => {
                const colors = PRIORITY_COLORS[p];
                return (
                  <button key={p} type="button" onClick={() => setPriority(p)} className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg border text-xs font-semibold capitalize transition cursor-pointer select-none ${priority === p ? colors.activeBg : colors.bg}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${priority === p ? 'bg-white' : colors.dot}`} />{p}
                  </button>
                );
              })}
            </div>
          </div>
        </form>
        <div className="px-6 py-4 border-t border-stone-100 dark:border-neutral-700 bg-stone-50/50 dark:bg-neutral-800 flex items-center justify-between gap-3">
          {isConfirmingDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-rose-600 animate-pulse">Delete?</span>
              <button onClick={() => { onDelete(task.id); onClose(); }} className="py-1.5 px-3.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition cursor-pointer">Yes</button>
              <button onClick={() => setIsConfirmingDelete(false)} className="py-1.5 px-3 rounded-lg border border-stone-200 dark:border-neutral-600 text-stone-600 dark:text-neutral-300 text-xs font-semibold transition cursor-pointer">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setIsConfirmingDelete(true)} className="flex items-center gap-2 py-2 px-3.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 font-medium text-sm transition cursor-pointer"><Trash2 className="h-4 w-4" />Delete</button>
          )}
          <div className="flex items-center gap-2.5">
            <button onClick={onClose} className="py-2.5 px-4.5 rounded-lg border border-stone-200 dark:border-neutral-600 text-stone-700 dark:text-neutral-300 hover:bg-stone-100 dark:hover:bg-neutral-700 font-medium text-sm transition cursor-pointer">Cancel</button>
            <button onClick={handleSubmit} disabled={!title.trim()} className="py-2.5 px-5.5 rounded-lg bg-stone-800 dark:bg-neutral-100 dark:text-neutral-900 text-white hover:bg-stone-700 dark:hover:bg-neutral-200 disabled:opacity-50 font-semibold text-sm shadow-xs transition cursor-pointer">Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}
