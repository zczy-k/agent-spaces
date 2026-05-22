"use client";

import React, { useState, useEffect } from 'react';
import { Calendar, AlertCircle, FileText, LayoutGrid, Trash2, Clock } from 'lucide-react';
import type { KanbanTask, KanbanPriority, KanbanColumn } from '@agent-spaces/shared';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { SearchSelect } from '@/components/ui/search-select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface TaskModalProps {
  task: KanbanTask | null;
  columns: KanbanColumn[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: KanbanTask) => void;
  onDelete: (taskId: string) => void;
}

const PRIORITY_COLORS: Record<KanbanPriority, { bg: string; activeBg: string; dot: string }> = {
  low: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100', activeBg: '!bg-emerald-600 !text-white !border-emerald-600', dot: 'bg-emerald-500' },
  medium: { bg: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100', activeBg: '!bg-amber-500 !text-white !border-amber-500', dot: 'bg-amber-500' },
  high: { bg: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100', activeBg: '!bg-rose-600 !text-white !border-rose-600', dot: 'bg-rose-500' },
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
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" />Task Details
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <FileText className="h-3.5 w-3.5" />Title
            </Label>
            <Input
              type="text"
              required
              placeholder="Task title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-9 text-sm font-medium"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <AlertCircle className="h-3.5 w-3.5" />Description
            </Label>
            <Textarea
              rows={4}
              placeholder="Task description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <LayoutGrid className="h-3.5 w-3.5" />Section
              </Label>
              <SearchSelect
                value={columnId}
                onChange={setColumnId}
                options={columns.map((col) => ({ value: col.id, label: col.title }))}
                placeholder="Select section..."
                allowCustom={false}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <Calendar className="h-3.5 w-3.5" />Due Date
              </Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="h-8"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <Clock className="h-3.5 w-3.5" />Priority
            </Label>
            <ToggleGroup
              variant="outline"
              value={[priority]}
              onValueChange={(v) => { if (v.length) setPriority(v[v.length - 1] as KanbanPriority); }}
              className="grid grid-cols-3 w-full"
            >
              {(['low', 'medium', 'high'] as KanbanPriority[]).map((p) => {
                const colors = PRIORITY_COLORS[p];
                const active = priority === p;
                return (
                  <ToggleGroupItem
                    key={p}
                    value={p}
                    aria-label={`Priority ${p}`}
                    className={`flex items-center justify-center gap-1.5 text-xs font-semibold capitalize ${active ? colors.activeBg + ' !border' : colors.bg}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-white' : colors.dot}`} />
                    {p}
                  </ToggleGroupItem>
                );
              })}
            </ToggleGroup>
          </div>
        </form>
        <DialogFooter className="!-mx-0 !-mb-0 px-6 py-4 border-t flex-row justify-between sm:justify-between">
          {isConfirmingDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-rose-600 animate-pulse">Delete?</span>
              <Button size="xs" variant="destructive" onClick={() => { onDelete(task.id); onClose(); }}>Yes</Button>
              <Button size="xs" variant="outline" onClick={() => setIsConfirmingDelete(false)}>Cancel</Button>
            </div>
          ) : (
            <Button size="sm" variant="destructive" onClick={() => setIsConfirmingDelete(true)}>
              <Trash2 className="h-4 w-4" />Delete
            </Button>
          )}
          <div className="flex items-center gap-2.5">
            <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleSubmit} disabled={!title.trim()}>Save</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
