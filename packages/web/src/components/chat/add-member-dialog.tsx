'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { UserPlus, Check, X } from 'lucide-react';

interface AddMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidates: string[];
  onAdd: (members: string[]) => void;
}

export function AddMemberDialog({ open, onOpenChange, candidates, onAdd }: AddMemberDialogProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');

  const filtered = candidates.filter((m) => m.toLowerCase().includes(query.toLowerCase()));
  const toggle = (m: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      return next;
    });
  };

  const handleConfirm = () => {
    if (selected.size === 0) return;
    onAdd([...selected]);
    onOpenChange(false);
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setSelected(new Set());
      setQuery('');
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>添加成员</DialogTitle>
          <DialogDescription>选择要添加到频道的成员</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索成员..."
          />
          <div className="max-h-52 overflow-y-auto space-y-0.5">
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">无可用成员</p>
            )}
            {filtered.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => toggle(m)}
                className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md hover:bg-muted text-left text-sm transition-colors"
              >
                <div className={`flex items-center justify-center size-5 rounded border ${selected.has(m) ? 'bg-primary border-primary text-primary-foreground' : 'border-input'}`}>
                  {selected.has(m) && <Check className="size-3" />}
                </div>
                <span className="truncate">{m}</span>
              </button>
            ))}
          </div>
          {selected.size > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {[...selected].map((m) => (
                <span key={m} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs">
                  {m}
                  <button type="button" onClick={() => toggle(m)}>
                    <X className="size-3 hover:text-destructive" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => handleClose(false)}>取消</Button>
            <Button onClick={handleConfirm} disabled={selected.size === 0}>
              <UserPlus className="size-3.5 mr-1" />添加 ({selected.size})
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
