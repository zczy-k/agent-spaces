"use client";

import React, { useState, useEffect } from 'react';
import { X, Layout, Sparkles } from 'lucide-react';
import type { KanbanColumn as KanbanColumnType } from '@agent-spaces/shared';

interface ColumnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (title: string, color: string) => void;
  onEdit?: (columnId: string, title: string, color: string) => void;
  editingColumn?: KanbanColumnType | null;
}

const BG_COLORS: Record<string, string> = {
  sky: 'bg-sky-400', amber: 'bg-amber-400', emerald: 'bg-emerald-400', rose: 'bg-rose-400', purple: 'bg-purple-400', slate: 'bg-stone-400',
};

export default function ColumnModal({ isOpen, onClose, onCreate, onEdit, editingColumn }: ColumnModalProps) {
  const [title, setTitle] = useState('');
  const [color, setColor] = useState('sky');

  useEffect(() => {
    if (isOpen) {
      if (editingColumn) { setTitle(editingColumn.title); setColor(editingColumn.color); }
      else { setTitle(''); setColor('sky'); }
    }
  }, [isOpen, editingColumn]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (editingColumn && onEdit) onEdit(editingColumn.id, title.trim(), color);
    else onCreate(title.trim(), color);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white dark:bg-neutral-800 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden z-10">
        <div className="px-6 py-4 border-b border-stone-100 dark:border-neutral-700 flex items-center justify-between bg-stone-50/50 dark:bg-neutral-800">
          <span className="text-xs font-semibold text-stone-500 dark:text-neutral-400 uppercase tracking-wider">{editingColumn ? 'Edit Section' : 'New Section'}</span>
          <button onClick={onClose} className="p-1.5 rounded-full text-stone-400 hover:bg-stone-100 dark:hover:bg-neutral-700 transition cursor-pointer"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-stone-500 dark:text-neutral-400 uppercase tracking-wider flex items-center gap-1.5"><Layout className="h-3.5 w-3.5" />Section Name</label>
            <input type="text" required autoFocus placeholder="e.g. Backlog, Review" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={25} className="w-full px-3.5 py-2.5 rounded-lg border border-stone-200 dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-stone-500/10 focus:border-stone-400 text-sm font-medium text-stone-900 placeholder:text-stone-400 transition" />
          </div>
          <div className="space-y-2.5">
            <label className="text-xs font-semibold text-stone-500 dark:text-neutral-400 uppercase tracking-wider flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" />Theme</label>
            <div className="flex items-center gap-3 py-1">
              {['sky', 'amber', 'emerald', 'rose', 'purple', 'slate'].map((opt) => (
                <button key={opt} type="button" onClick={() => setColor(opt)} className={`h-7 w-7 rounded-full ${BG_COLORS[opt]} hover:scale-115 active:scale-95 transition-all duration-150 cursor-pointer ${color === opt ? 'ring-2 ring-stone-800 dark:ring-neutral-100 ring-offset-2' : 'opacity-85 hover:opacity-100'}`} />
              ))}
            </div>
          </div>
        </form>
        <div className="px-6 py-4 border-t border-stone-100 dark:border-neutral-700 bg-stone-50/50 dark:bg-neutral-800 flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} className="py-2.5 px-4.5 rounded-lg border border-stone-200 dark:border-neutral-600 text-stone-700 dark:text-neutral-300 hover:bg-stone-100 dark:hover:bg-neutral-700 font-medium text-sm transition cursor-pointer">Cancel</button>
          <button onClick={handleSubmit} disabled={!title.trim()} className="py-2.5 px-5.5 rounded-lg bg-stone-800 dark:bg-neutral-100 dark:text-neutral-900 text-white hover:bg-stone-700 dark:hover:bg-neutral-200 disabled:opacity-50 font-semibold text-sm shadow-xs transition cursor-pointer">{editingColumn ? 'Save' : 'Create'}</button>
        </div>
      </div>
    </div>
  );
}
