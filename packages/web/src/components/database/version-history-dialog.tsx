'use client';

import React from 'react';
import { FileText, RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { DatabaseNodeVersion } from '@agent-spaces/shared';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Markdown } from '@/components/ui/markdown';

interface VersionHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versions: DatabaseNodeVersion[];
  selectedVersionId: string | null;
  onSelectVersion: (id: string) => void;
  loading: boolean;
  error: string | null;
  workspaceId: string;
  activeNodeTitle?: string;
}

export function VersionHistoryDialog({
  open,
  onOpenChange,
  versions,
  selectedVersionId,
  onSelectVersion,
  loading,
  error,
  workspaceId,
  activeNodeTitle,
}: VersionHistoryDialogProps) {
  const t = useTranslations('database');
  const tc = useTranslations('common');

  const selectedVersion = versions.find(v => v.id === selectedVersionId) ?? null;

  const formatTimeAgo = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return t('justNow');
    if (minutes < 60) return `${minutes} ${t('minutesAgo')}`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} ${t('hoursAgo')}`;
    const days = Math.floor(hours / 24);
    return `${days} ${t('daysAgo')}`;
  };

  const formatSize = (text: string) => {
    const bytes = new TextEncoder().encode(text).length;
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!flex !w-[min(680px,calc(100vw-2rem))] !max-w-[min(680px,calc(100vw-2rem))] max-h-[min(760px,calc(100vh-4rem))] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-muted-foreground" />
              <DialogTitle className="text-sm font-medium">{t('historyVersions')}</DialogTitle>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{versions.length} {t('versions')}</span>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="py-4 text-xs text-muted-foreground">{tc('loading')}</div>
          ) : error ? (
            <div className="py-4 text-xs text-destructive">{error}</div>
          ) : versions.length === 0 ? (
            <div className="py-4 text-xs text-muted-foreground">{t('noHistory')}</div>
          ) : (
            <div className="relative">
              {versions.map((version, index) => {
                const isSelected = selectedVersion?.id === version.id;
                const isLatest = index === 0;
                const insertLen = version.patch.insertText.length;
                const deleteLen = version.patch.deleteText.length;
                const diffSize = insertLen - deleteLen;

                return (
                  <div key={version.id} className="relative">
                    {/* Timeline item */}
                    <div className="relative flex gap-3 pb-4 last:pb-0">
                      {/* Timeline line */}
                      {index < versions.length - 1 && (
                        <div className="absolute top-6 bottom-0 left-[9px] w-px bg-border" />
                      )}
                      {/* Version badge */}
                      <div className="relative z-10 flex shrink-0 pt-1">
                        <div
                          className={cn(
                            "flex size-[19px] items-center justify-center rounded-full ring-2 ring-card",
                            isLatest
                              ? "bg-foreground"
                              : "border border-border bg-card",
                          )}
                        >
                          <span
                            className={cn(
                              "font-mono text-[8px] font-bold leading-none",
                              isLatest ? "text-background" : "text-muted-foreground",
                            )}
                          >
                            {versions.length - index}
                          </span>
                        </div>
                      </div>
                      {/* Version content */}
                      <div
                        className="min-w-0 flex-1 cursor-pointer"
                        onClick={() => onSelectVersion(version.id)}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{version.title || activeNodeTitle || t('untitled')}</span>
                          {isLatest && (
                            <span className="inline-flex items-center rounded-full border border-transparent bg-secondary text-secondary-foreground px-2 py-0.5 text-[10px] font-normal">
                              Current
                            </span>
                          )}
                          <span className="ml-auto shrink-0 text-xs text-muted-foreground">{formatTimeAgo(version.createdAt)}</span>
                        </div>
                        <div className="mt-1.5 flex items-center gap-3">
                          <span className="font-mono text-xs text-muted-foreground">v{versions.length - index}</span>
                          <span className="text-xs text-muted-foreground/40">·</span>
                          <span className="font-mono text-xs tabular-nums text-muted-foreground">
                            {formatSize(version.newContent)}
                          </span>
                          {diffSize !== 0 && (
                            <>
                              <span className="text-xs text-muted-foreground/40">·</span>
                              <span
                                className={cn(
                                  "font-mono text-xs tabular-nums",
                                  diffSize > 0
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-red-600 dark:text-red-400",
                                )}
                              >
                                {diffSize > 0 ? '+' : ''}{diffSize > 0 ? `+${diffSize}` : diffSize} chars
                              </span>
                            </>
                          )}
                          {!isLatest && (
                            <button
                              onClick={(e) => { e.stopPropagation(); }}
                              className="ml-auto inline-flex items-center gap-1 rounded-md px-2 h-6 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                            >
                              <RotateCcw className="size-3" />
                              {t('restore')}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expanded diff view */}
                    {isSelected && (
                      <div className="ml-8 mb-4 overflow-hidden rounded-lg border border-border bg-card">
                        <div className="grid min-h-0 grid-rows-2">
                          <MarkdownVersionPane
                            title="Before"
                            content={version.oldContent}
                            workspaceId={workspaceId}
                            tone="old"
                          />
                          <MarkdownVersionPane
                            title="After"
                            content={version.newContent}
                            workspaceId={workspaceId}
                            tone="new"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MarkdownVersionPane({
  title,
  content,
  workspaceId,
  tone,
}: {
  title: string;
  content: string;
  workspaceId: string;
  tone: 'old' | 'new';
}) {
  return (
    <section className="min-h-0 border-b border-border last:border-b-0">
      <div
        className={cn(
          "sticky top-0 z-10 flex items-center justify-between border-b border-border px-4 py-2 text-xs font-semibold",
          tone === 'old'
            ? "bg-red-500/10 text-red-700 dark:text-red-300"
            : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        )}
      >
        <span>{title}</span>
        <span className="font-mono text-[10px] opacity-70">{content.length} chars</span>
      </div>
      <div className="prose prose-sm dark:prose-invert max-w-none px-5 py-4 text-sm">
        <Markdown content={content || '_Empty content_'} workspaceId={workspaceId} />
      </div>
    </section>
  );
}
