"use client";

import React, { useState, useEffect } from 'react';
import { Calendar, AlertCircle, FileText, LayoutGrid, Trash2, Clock, CircleDot } from 'lucide-react';
import { useTranslations } from 'next-intl';
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
  onCreateIssue?: (task: KanbanTask) => void;
}

const PRIORITY_COLORS: Record<KanbanPriority, { bg: string; activeBg: string; dot: string }> = {
  low: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100', activeBg: '!bg-emerald-600 !text-white !border-emerald-600', dot: 'bg-emerald-500' },
  medium: { bg: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100', activeBg: '!bg-amber-500 !text-white !border-amber-500', dot: 'bg-amber-500' },
  high: { bg: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100', activeBg: '!bg-rose-600 !text-white !border-rose-600', dot: 'bg-rose-500' },
};

export default function TaskModal({ task, columns, isOpen, onClose, onSave, onDelete, onCreateIssue }: TaskModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<KanbanPriority>('medium');
  const [columnId, setColumnId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const t = useTranslations('kanban');
  const tc = useTranslations('common');

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

  const priorityLabel: Record<KanbanPriority, string> = {
    low: t('low'),
    medium: t('medium'),
    high: t('high'),
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" />{t('taskDetails')}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <FileText className="h-3.5 w-3.5" />{t('title')}
            </Label>
            <Input
              type="text"
              required
              placeholder={t('titlePlaceholder')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-9 text-sm font-medium"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <AlertCircle className="h-3.5 w-3.5" />{t('descriptionLabel')}
            </Label>
            <Textarea
              rows={4}
              placeholder={t('descriptionPlaceholder')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <LayoutGrid className="h-3.5 w-3.5" />{t('sectionLabel')}
              </Label>
              <SearchSelect
                value={columnId}
                onChange={setColumnId}
                options={columns.map((col) => ({ value: col.id, label: col.title }))}
                placeholder={t('selectSection')}
                allowCustom={false}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <Calendar className="h-3.5 w-3.5" />{t('dueDate')}
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
              <Clock className="h-3.5 w-3.5" />{t('priority')}
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
                    className={`flex items-center justify-center gap-1.5 text-xs font-semibold ${active ? colors.activeBg + ' !border' : colors.bg}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-white' : colors.dot}`} />
                    {priorityLabel[p]}
                  </ToggleGroupItem>
                );
              })}
            </ToggleGroup>
          </div>
        </form>
        <DialogFooter className="!-mx-0 !-mb-0 px-6 py-4 border-t flex-row justify-between sm:justify-between">
          {isConfirmingDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-rose-600 animate-pulse">{t('deleteConfirm')}</span>
              <Button size="xs" variant="destructive" onClick={() => { onDelete(task.id); onClose(); }}>{t('yes')}</Button>
              <Button size="xs" variant="outline" onClick={() => setIsConfirmingDelete(false)}>{tc('cancel')}</Button>
            </div>
          ) : (
            <Button size="sm" variant="destructive" onClick={() => setIsConfirmingDelete(true)}>
              <Trash2 className="h-4 w-4" />{tc('delete')}
            </Button>
          )}
          <div className="flex items-center gap-2.5">
            {onCreateIssue && (
              <Button size="sm" variant="outline" onClick={() => { onClose(); onCreateIssue(task); }}>
                <CircleDot className="h-4 w-4" />{t('createAsIssue')}
              </Button>
            )}
            <Button size="sm" onClick={handleSubmit} disabled={!title.trim()}>{tc('save')}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
