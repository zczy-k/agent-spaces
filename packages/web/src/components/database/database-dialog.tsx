'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { DatabaseMeta } from '@agent-spaces/shared';

interface DatabaseDialogProps {
  open: boolean;
  database: DatabaseMeta | null;
  onOpenChange: (open: boolean) => void;
  onSave: (input: { name: string; description: string }) => Promise<void>;
}

export function DatabaseDialog({ open, database, onOpenChange, onSave }: DatabaseDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(database?.name ?? '');
    setDescription(database?.description ?? '');
  }, [database, open]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName || saving) return;
    setSaving(true);
    try {
      await onSave({ name: cleanName, description: description.trim() });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="px-5 py-4 border-b border-border">
            <DialogTitle className="text-sm">{database ? 'Edit database' : 'Create database'}</DialogTitle>
          </DialogHeader>
          <div className="p-5 space-y-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
                autoFocus
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Description</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="min-h-20 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
              />
            </label>
          </div>
          <DialogFooter className="px-5 py-4">
            <button type="button" onClick={() => onOpenChange(false)} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent">
              Cancel
            </button>
            <button type="submit" disabled={!name.trim() || saving} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground disabled:opacity-50">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
