'use client';

import type { LLMModel } from '@agent-spaces/shared';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Brain, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMemo, useState } from 'react';

export interface ModelPickerDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  models: LLMModel[];
  selected: string[];
  onToggle: (id: string) => void;
  cancelText?: string;
  confirmText?: string;
  loading?: boolean;
}

function groupByProvider(models: LLMModel[]): Record<string, LLMModel[]> {
  const groups: Record<string, LLMModel[]> = {};
  for (const m of models) {
    const p = m.provider || 'Other';
    (groups[p] ??= []).push(m);
  }
  return groups;
}

export function ModelPickerDialog({
  open,
  onClose,
  onConfirm,
  title = 'Select Model',
  description,
  models,
  selected,
  onToggle,
  cancelText,
  confirmText,
  loading,
}: ModelPickerDialogProps) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    if (!search.trim()) return models;
    const q = search.toLowerCase();
    return models.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.modelId.toLowerCase().includes(q) ||
        m.provider.toLowerCase().includes(q),
    );
  }, [models, search]);

  const groups = useMemo(() => groupByProvider(filtered), [filtered]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-sm flex flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 px-6 py-4">
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="px-6 pb-2">
          <Input
            placeholder="Search models..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-2 space-y-3">
          <div className="space-y-3">
            {Object.entries(groups).map(([provider, items]) => (
              <div key={provider}>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                  {provider}
                </div>
                <div className="space-y-0.5">
                  {items.map((model) => (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => onToggle(model.id)}
                      className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md hover:bg-muted text-left text-sm transition-colors"
                    >
                      <Brain className="size-4 text-muted-foreground shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{model.name}</span>
                        <span className="block truncate text-xs text-muted-foreground font-mono">{model.modelId}</span>
                      </span>
                      <div
                        className={cn(
                          'flex items-center justify-center size-4 rounded border shrink-0',
                          selected.includes(model.id)
                            ? 'bg-primary border-primary text-primary-foreground'
                            : 'border-input',
                        )}
                      />
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">No models found</div>
            )}
          </div>
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selected.map((id) => {
                const model = models.find((m) => m.id === id);
                return (
                  <span key={id} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs max-w-[160px] min-w-0">
                    <Brain className="size-3 shrink-0 text-muted-foreground" />
                    <span className="truncate">{model?.name || id}</span>
                    <button type="button" onClick={() => onToggle(id)} className="hover:text-destructive shrink-0">
                      <X className="size-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>
        <div className="shrink-0 flex justify-end gap-2 border-t px-6 py-4">
          <Button variant="outline" onClick={onClose}>
            {cancelText || 'Cancel'}
          </Button>
          <Button onClick={onConfirm} disabled={loading || selected.length === 0}>
            {confirmText || 'Confirm'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
