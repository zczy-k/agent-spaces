"use client";

import React, { useState, useEffect } from 'react';
import { Layout, Sparkles } from 'lucide-react';
import type { KanbanColumn as KanbanColumnType } from '@agent-spaces/shared';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

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
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {editingColumn ? 'Edit Section' : 'New Section'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <Layout className="h-3.5 w-3.5" />Section Name
            </Label>
            <Input
              type="text"
              required
              autoFocus
              placeholder="e.g. Backlog, Review"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={25}
              className="h-9 text-sm font-medium"
            />
          </div>
          <div className="space-y-2.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <Sparkles className="h-3.5 w-3.5" />Theme
            </Label>
            <div className="flex items-center gap-3 py-1">
              {['sky', 'amber', 'emerald', 'rose', 'purple', 'slate'].map((opt) => (
                <button key={opt} type="button" onClick={() => setColor(opt)} className={`h-7 w-7 rounded-full ${BG_COLORS[opt]} hover:scale-115 active:scale-95 transition-all duration-150 cursor-pointer ${color === opt ? 'ring-2 ring-stone-800 dark:ring-neutral-100 ring-offset-2' : 'opacity-85 hover:opacity-100'}`} />
              ))}
            </div>
          </div>
        </form>
        <DialogFooter className="!-mx-0 !-mb-0 px-6 py-4 border-t flex-row justify-end sm:justify-end">
          <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleSubmit} disabled={!title.trim()}>{editingColumn ? 'Save' : 'Create'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
