'use client';

import React, { useState, useEffect } from 'react';
import { Server, Play } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ModelPickerDialog } from '@/components/common/model-picker-dialog';
import type { DatabaseMeta, DatabaseVectorStats, LLMModel, LLMProvider } from '@agent-spaces/shared';

interface DatabaseVectorDialogProps {
  open: boolean;
  database: DatabaseMeta | null;
  models: LLMModel[];
  providers: LLMProvider[];
  stats: DatabaseVectorStats | null;
  loading: boolean;
  indexing: boolean;
  onOpenChange: (open: boolean) => void;
  onBind: (modelId: string | null) => Promise<void>;
  onIndex: () => Promise<void>;
}

export function DatabaseVectorDialog({
  open,
  database,
  models,
  providers,
  stats,
  loading,
  indexing,
  onOpenChange,
  onBind,
  onIndex,
}: DatabaseVectorDialogProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const embeddingModelId = stats?.embeddingModelId ?? database?.embeddingModelId ?? null;
  const boundModel = models.find((model) => model.id === embeddingModelId);
  const boundProvider = boundModel ? providers.find((provider) => provider.name === boundModel.provider) : undefined;
  const embeddingModels = models.filter((model) => model.embedding);

  useEffect(() => {
    if (!open) return;
    setSelectedModelId(embeddingModelId);
    setMessage(null);
    setError(null);
  }, [embeddingModelId, open]);

  const handleBind = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await onBind(selectedModelId);
      setMessage('Embedding model saved.');
      setPickerOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save embedding model.');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await onBind(null);
      setSelectedModelId(null);
      setMessage('Embedding model cleared.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear embedding model.');
    } finally {
      setSaving(false);
    }
  };

  const handleIndex = async () => {
    setError(null);
    setMessage(null);
    try {
      await onIndex();
      setMessage('Vector index completed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to index database.');
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-5 py-4 border-b border-border">
            <DialogTitle className="text-sm">Database vectors</DialogTitle>
          </DialogHeader>
          <div className="p-5 space-y-4">
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-foreground">Embedding model</div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <Server className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">
                      {boundModel ? `${boundModel.name} (${boundProvider?.name || boundModel.provider})` : 'No model bound'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="shrink-0 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-muted"
                >
                  Select
                </button>
              </div>
              {embeddingModelId && (
                <button
                  type="button"
                  onClick={handleClear}
                  disabled={saving || indexing}
                  className="mt-3 text-xs font-semibold text-muted-foreground hover:text-destructive disabled:opacity-50"
                >
                  Clear binding
                </button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-lg border border-border p-3">
                <div className="text-muted-foreground">Documents</div>
                <div className="mt-1 text-lg font-bold text-foreground">{stats?.nodeCount ?? '-'}</div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-muted-foreground">Indexed</div>
                <div className="mt-1 text-lg font-bold text-foreground">{stats?.indexedCount ?? '-'}</div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-muted-foreground">Updated</div>
                <div className="mt-1 truncate text-xs font-semibold text-foreground">
                  {stats?.lastIndexedAt ? new Date(stats.lastIndexedAt).toLocaleString() : '-'}
                </div>
              </div>
            </div>

            {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>}
            {message && <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700">{message}</div>}
          </div>
          <DialogFooter className="px-5 py-4">
            <button type="button" onClick={() => onOpenChange(false)} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent">
              Close
            </button>
            <button
              type="button"
              onClick={handleIndex}
              disabled={loading || indexing || saving || !embeddingModelId}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5" />
              {indexing ? 'Indexing...' : 'Start indexing'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ModelPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onConfirm={handleBind}
        title="Select embedding model"
        description="Pick one embedding model. Its provider supplies API base and key."
        models={embeddingModels}
        selected={selectedModelId ? [selectedModelId] : []}
        onToggle={(id) => setSelectedModelId((current) => current === id ? null : id)}
        confirmText={saving ? 'Saving...' : 'Save'}
        loading={saving}
      />
    </>
  );
}
