"use client";

import { useEffect, useCallback, useState } from "react";
import {
  Upload, Loader2, GitCommitHorizontal, RefreshCw, ArrowUp, ArrowDown,
  FileCode, RotateCcw, Trash2, ChevronDown, GitBranch,
  Sparkles, Settings2, FileDiff, Plus, Minus, AlertTriangle,
} from "lucide-react";
import type { GitLogEntry } from "@agent-spaces/shared";
import { useGitStore } from "@/stores/git";
import { useEditorStore } from "@/stores/editor";
import { GitNotInitialized } from "./git-not-initialized";
import { GitRemoteDialog } from "./git-remote-dialog";
import { DiffViewer } from "./diff-viewer";
import { GitSettingsForm } from "@/components/git/git-settings-form";
import { useIsMobile } from "@/hooks/use-mobile";
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";
import {
  ContextMenu,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { statusColors, statusLabels, errMsg } from "./git-commit-utils";
import { useGitSync } from "./use-git-sync";
import { GitPromptDialog } from "./git-prompt-dialog";
import { GitDiscardDialog, type DiscardConfirm } from "./git-discard-dialog";
import { GitGitignoreDialog } from "./git-gitignore-dialog";
import { GitFileContextMenu } from "./git-file-context-menu";
import { GitCommitContextMenu } from "./git-commit-context-menu";
import { GitCommitDetailDialog } from "./git-commit-detail-dialog";

interface Props {
  workspaceId: string;
}

export function GitCommitsPanel({ workspaceId }: Props) {
  const tc = useTranslations('common');
  const t = useTranslations('git.commits');
  const tChanges = useTranslations('git.changes');
  const isMobile = useIsMobile();

  const {
    log, loading, notGitRepo, status, branches, diffs, selectedFile,
    loadStatus, loadDiffs, loadLog, loadBranches,
    commit, discard, discardAll, stage, unstage, resolveFile, checkout, selectFile,
    commitMsg, setCommitMsg, fetchRemote,
  } = useGitStore();
  const openFile = useEditorStore((s) => s.openFile);
  const openCommitDiff = useEditorStore((s) => s.openCommitDiff);

  const [branchOpen, setBranchOpen] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [promptDialog, setPromptDialog] = useState<{
    open: boolean; title: string; label: string; placeholder: string;
    onSubmit: (value: string) => void;
  }>({ open: false, title: '', label: '', placeholder: '', onSubmit: () => {} });
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; path: string } | null>(null);
  const [gitignoreOpen, setGitignoreOpen] = useState(false);
  const [gitignoreContent, setGitignoreContent] = useState("");
  const [gitSettingsOpen, setGitSettingsOpen] = useState(false);
  const [gitignoreSaving, setGitignoreSaving] = useState(false);
  const [discardConfirm, setDiscardConfirm] = useState<DiscardConfirm>(null);
  const [detailEntry, setDetailEntry] = useState<GitLogEntry | null>(null);

  const ahead = status?.ahead ?? 0;
  const behind = status?.behind ?? 0;
  const hasFiles = (status?.files.length ?? 0) > 0;
  const selectedDiff = diffs.find((d) => d.path === selectedFile);

  const refresh = useCallback(async () => {
    await fetchRemote(workspaceId).catch(() => {});
    await Promise.all([
      loadStatus(workspaceId),
      loadDiffs(workspaceId),
      loadLog(workspaceId),
    ]);
  }, [workspaceId, fetchRemote, loadStatus, loadDiffs, loadLog]);

  const refreshAll = useCallback(() => { refresh(); loadBranches(workspaceId); }, [workspaceId, refresh, loadBranches]);

  const { syncing, remoteDialogOpen, setRemoteDialogOpen, handleSync, handleRemoteSubmit, handleSyncChanges } = useGitSync(workspaceId, refresh);

  useEffect(() => { refresh(); loadBranches(workspaceId); }, [workspaceId, refresh, loadBranches]);

  useEffect(() => {
    const id = setInterval(() => { loadStatus(workspaceId); loadDiffs(workspaceId); }, 5000);
    return () => clearInterval(id);
  }, [workspaceId, loadStatus, loadDiffs]);

  // ---- branch ----
  const handleBranchCheckout = useCallback(async (branch: string) => {
    setBranchOpen(false);
    await checkout(workspaceId, branch);
    refresh();
    loadBranches(workspaceId);
  }, [workspaceId, checkout, refresh, loadBranches]);

  // ---- commit ----
  const handleCommit = useCallback(async () => {
    if (!commitMsg.trim()) return;
    setCommitting(true);
    selectFile(null);
    await commit(workspaceId, commitMsg.trim());
    setCommitMsg("");
    setCommitting(false);
    refresh();
  }, [workspaceId, commitMsg, commit, refresh, selectFile, setCommitMsg]);

  const handleGenerateCommit = useCallback(async () => {
    if (generating || committing) return;
    setGenerating(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/git/generate-commit-message`, { method: 'POST' });
      if (!res.ok) { const e = await res.json().catch(() => ({ error: 'Failed' })); throw new Error(e.error); }
      const data = await res.json();
      if (data.message) setCommitMsg(data.message);
    } catch (err: unknown) { toast.error(errMsg(err) || tChanges('failedCommitMessage')); }
    finally { setGenerating(false); }
  }, [workspaceId, generating, committing, setCommitMsg, tChanges]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleCommit();
  }, [handleCommit]);

  // ---- changes file actions ----
  const handleFileClick = useCallback((path: string) => {
    selectFile(path === selectedFile ? null : path);
  }, [selectedFile, selectFile]);

  const handleOpenFile = useCallback((e: React.MouseEvent, path: string) => {
    e.stopPropagation(); openFile(workspaceId, path);
  }, [workspaceId, openFile]);

  const handleDiscard = useCallback((e: React.MouseEvent, path: string) => {
    e.stopPropagation(); setDiscardConfirm({ type: 'single', path });
  }, []);

  const handleStageToggle = useCallback(async (e: React.MouseEvent, path: string, staged?: boolean) => {
    e.stopPropagation();
    if (staged) {
      await unstage(workspaceId, path);
    } else {
      await stage(workspaceId, path);
    }
    refresh();
  }, [workspaceId, refresh, stage, unstage]);

  const handleResolveConflict = useCallback(async (path: string, content: string) => {
    await resolveFile(workspaceId, path, content, true);
    selectFile(null);
    refresh();
    toast.success("冲突已解决并暂存");
  }, [workspaceId, refresh, resolveFile, selectFile]);

  const handleDiscardAll = useCallback(() => {
    setDiscardConfirm({ type: 'all' });
  }, []);

  const confirmDiscard = useCallback(async () => {
    if (!discardConfirm) return;
    if (discardConfirm.type === 'single') {
      await discard(workspaceId, discardConfirm.path);
    } else {
      await discardAll(workspaceId);
    }
    setDiscardConfirm(null);
    refresh();
  }, [workspaceId, discardConfirm, discard, discardAll, refresh]);

  // ---- gitignore ----
  const _openGitignore = useCallback(async () => {
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/files/content?path=.gitignore`);
      const data = await res.json(); setGitignoreContent(data.content ?? "");
    } catch { setGitignoreContent(""); }
    setGitignoreOpen(true);
  }, [workspaceId]);

  const saveGitignore = useCallback(async () => {
    setGitignoreSaving(true);
    try {
      await fetch(`/api/workspaces/${workspaceId}/files/content`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: ".gitignore", content: gitignoreContent }),
      });
      setGitignoreOpen(false); refresh();
    } finally { setGitignoreSaving(false); }
  }, [workspaceId, gitignoreContent, refresh]);

  const addToGitignore = useCallback(async (pattern: string) => {
    setCtxMenu(null);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/files/content?path=.gitignore`);
      const data = await res.json();
      const existing: string = data.content ?? "";
      const lines = existing.split("\n").filter(Boolean);
      if (lines.includes(pattern)) return;
      const next = existing && !existing.endsWith("\n") ? existing + "\n" + pattern + "\n" : existing + pattern + "\n";
      await fetch(`/api/workspaces/${workspaceId}/files/content`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: ".gitignore", content: next }),
      });
      refresh();
    } catch { /* ignore */ }
  }, [workspaceId, refresh]);

  // ---- prompt dialog ----
  const openPromptDialog = (title: string, label: string, placeholder: string, onSubmit: (v: string) => void) => {
    setPromptDialog({ open: true, title, label, placeholder, onSubmit });
  };

  // ---- render ----
  if (notGitRepo) {
    return (
      <div className="flex flex-col h-full overflow-hidden rounded-t-xl bg-background">
        <div className="flex items-center px-2 py-1.5 border-b">
          <span className="text-xs font-medium text-muted-foreground">{t('title')}</span>
        </div>
        <GitNotInitialized workspaceId={workspaceId} onInitialized={refresh} />
      </div>
    );
  }

  return (
    <div className={`flex h-full overflow-hidden rounded-t-xl bg-background ${isMobile ? 'flex-col' : ''}`}>
      {/* Left: Changes panel */}
      <div className={`flex flex-col bg-muted/20 ${isMobile ? 'w-full border-b max-h-[40%]' : 'w-64 border-r'}`}>
        {/* Header with branch selector */}
        <div className="flex items-center gap-1 px-2 py-1.5 border-b">
          <div className="relative flex-1 min-w-0">
            <button onClick={() => setBranchOpen(!branchOpen)} className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground active:opacity-70 transition-all duration-100 cursor-pointer w-full">
              <GitBranch size={13} className="shrink-0" />
              <span className="truncate">{status?.branch ?? "..."}</span>
              {status && hasFiles && <span className="text-muted-foreground">({status.files.length})</span>}
              <ChevronDown size={12} className="shrink-0" />
            </button>
            {branchOpen && (
              <>
                <div className="absolute left-0 top-full z-50 mt-1 w-48 bg-popover border rounded shadow-md py-0.5 max-h-60 overflow-auto">
                  {branches.map((b) => (
                    <button key={b.name} onClick={() => handleBranchCheckout(b.name)}
                      className={`w-full text-left px-2 py-1 text-xs hover:bg-accent active:scale-[0.98] active:bg-accent transition-all duration-100 cursor-pointer truncate ${b.current ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                      {b.name}
                    </button>
                  ))}
                  {branches.length === 0 && <div className="px-2 py-1 text-xs text-muted-foreground">{tChanges('noBranches')}</div>}
                </div>
                <div className="fixed inset-0 z-40" onClick={() => setBranchOpen(false)} />
              </>
            )}
          </div>
          {hasFiles && (
            <button onClick={handleDiscardAll} className="p-1 text-muted-foreground hover:text-destructive active:scale-90 transition-all duration-100 cursor-pointer" title={tChanges('discardAll')}>
              <Trash2 size={13} />
            </button>
          )}
          <button onClick={() => {
            if (diffs.length > 0) openCommitDiff(workspaceId, 'unstaged', tChanges('unstagedChanges'), diffs);
          }} disabled={!hasFiles} className="p-1 text-muted-foreground hover:text-foreground active:scale-90 transition-all duration-100 cursor-pointer disabled:opacity-30" title={tChanges('viewDiff')}>
            <FileDiff size={13} />
          </button>
          <button onClick={refresh} className="p-1 text-muted-foreground hover:text-foreground active:scale-90 transition-all duration-100 cursor-pointer" title={tc('refresh')}>
            <RefreshCw size={13} />
          </button>
        </div>

        {/* File list */}
        <div className="flex-1 overflow-auto">
          {status?.files.map((f) => (
            <div key={f.path} onClick={() => handleFileClick(f.path)} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setCtxMenu({ x: e.clientX, y: e.clientY, path: f.path }); }}
              className={`group w-full text-left px-2 py-1 text-xs font-mono flex items-center gap-1.5 hover:bg-accent cursor-pointer ${selectedFile === f.path ? "bg-accent" : ""}`}>
              <span className={`w-4 text-center font-bold shrink-0 ${statusColors[f.status]}`}>{statusLabels[f.status]}</span>
              {f.conflicted && <AlertTriangle size={12} className="shrink-0 text-red-500" />}
              <span className="truncate flex-1">{f.path}</span>
              <span className="hidden group-hover:flex md:flex items-center gap-0.5 shrink-0">
                <button
                  onClick={(e) => handleStageToggle(e, f.path, f.staged)}
                  disabled={f.conflicted}
                  className="p-0.5 rounded hover:bg-accent/80 active:scale-90 transition-all duration-100 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  title={f.staged ? "Unstage" : "Stage"}
                >
                  {f.staged ? <Minus size={13} /> : <Plus size={13} />}
                </button>
                <button onClick={(e) => handleOpenFile(e, f.path)} className="p-0.5 rounded hover:bg-accent/80 active:scale-90 transition-all duration-100 cursor-pointer" title={tc('open')}><FileCode size={13} /></button>
                <button onClick={(e) => handleDiscard(e, f.path)} className="p-0.5 rounded hover:bg-accent/80 active:scale-90 transition-all duration-100 cursor-pointer" title={tChanges('discardAll')}><RotateCcw size={13} /></button>
              </span>
            </div>
          ))}
          {status?.clean && <div className="p-2 text-xs text-muted-foreground">{tChanges('noChanges')}</div>}
        </div>

        {/* Commit input */}
        {hasFiles ? (
          <div className="border-t p-2 space-y-1.5">
            <div className="relative">
              <textarea value={commitMsg} onChange={(e) => setCommitMsg(e.target.value)} onKeyDown={handleKeyDown}
                placeholder={tChanges('commitMessagePlaceholder')} rows={3}
                className="w-full resize-none text-xs px-2 pt-1 pr-8 pb-7 border rounded bg-background disabled:opacity-50"
                disabled={committing || generating} />
              <button type="button" onClick={handleGenerateCommit} disabled={generating || committing || !hasFiles}
                className="absolute bottom-1.5 right-1.5 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent active:scale-90 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-100"
                title="AI generate commit message">
                {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              </button>
            </div>
            <button onClick={handleCommit} disabled={!commitMsg.trim() || committing}
              className="w-full text-xs px-2 py-1 rounded bg-primary text-primary-foreground active:scale-[0.98] transition-all duration-100 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
              {committing ? tChanges('committing') : tChanges('commit')}
            </button>
          </div>
        ) : ahead > 0 ? (
          <div className="border-t p-2">
            <button onClick={handleSyncChanges} disabled={syncing !== null}
              className="w-full text-xs px-2 py-1 rounded bg-primary text-primary-foreground active:scale-[0.98] transition-all duration-100 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5">
              {syncing ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
              {syncing ? tChanges('syncing') : tChanges('syncChanges')}
            </button>
          </div>
        ) : null}
      </div>

      {/* Right: Commits + Diff */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Commits header */}
        <div className="flex items-center justify-between px-2 py-1.5 border-b shrink-0">
          <span className="text-xs font-medium text-muted-foreground">
            {log.length > 0 ? t('titleWithCount', { count: log.length }) : t('title')}
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => handleSync("push")} disabled={syncing !== null}
              className="relative p-1 text-muted-foreground hover:text-foreground active:scale-90 transition-all duration-100 cursor-pointer disabled:opacity-50"
              title={ahead > 0 ? t('pushNCommits', { count: ahead }) : "Push"}>
              {syncing === "push" ? <Loader2 size={13} className="animate-spin" /> : <ArrowUp size={13} />}
              {ahead > 0 && (
                <span className="absolute -top-1 -right-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-foreground px-1 text-[9px] font-medium leading-none text-background">{ahead}</span>
              )}
            </button>
            <button onClick={() => handleSync("pull")} disabled={syncing !== null}
              className="relative p-1 text-muted-foreground hover:text-foreground active:scale-90 transition-all duration-100 cursor-pointer disabled:opacity-50"
              title={behind > 0 ? t('pullNCommits', { count: behind }) : "Pull"}>
              {syncing === "pull" ? <Loader2 size={13} className="animate-spin" /> : <ArrowDown size={13} />}
              {behind > 0 && (
                <span className="absolute -top-1 -right-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-foreground px-1 text-[9px] font-medium leading-none text-background">{behind}</span>
              )}
            </button>
            <button onClick={refresh} className="p-1 text-muted-foreground hover:text-foreground active:scale-90 transition-all duration-100 cursor-pointer"><RefreshCw size={13} /></button>
            <button onClick={() => setGitSettingsOpen(true)} className="p-1 text-muted-foreground hover:text-foreground active:scale-90 transition-all duration-100 cursor-pointer" title={t('settingsTitle')}><Settings2 size={13} /></button>
          </div>
        </div>

        {/* Commit list or Diff */}
        {selectedDiff ? (
          <div className="flex-1 min-h-0">
            <DiffViewer
              oldContent={selectedDiff.oldContent}
              newContent={selectedDiff.newContent}
              path={selectedDiff.path}
              isBinary={selectedDiff.isBinary}
              mergeMode={!!selectedDiff.isConflict}
              onResolve={selectedDiff.isConflict ? (content) => handleResolveConflict(selectedDiff.path, content) : undefined}
            />
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading && !log.length && (
              <div className="p-2 space-y-1">
                <SkeletonGroup count={6}>
                  {(i) => (
                    <div key={i} className="px-2 py-1.5 border-b space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-3 w-10 rounded" />
                        <Skeleton className="h-3 flex-1" />
                      </div>
                      <div className="flex items-center gap-2 pl-7">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </div>
                  )}
                </SkeletonGroup>
              </div>
            )}
            {log.map((entry) => {
              const isRemoteHead = !!status?.remoteHeadHash && entry.hash.startsWith(status.remoteHeadHash.substring(0, 7));
              const isHead = !!status?.headHash && entry.hash.startsWith(status.headHash.substring(0, 7));
              return (
                <ContextMenu key={entry.hash}>
                  <ContextMenuTrigger>
                    <div
                      onClick={() => setDetailEntry(entry)}
                      className={`px-2 py-1.5 border-b border-l-2 hover:bg-accent cursor-pointer ${isHead ? 'border-l-foreground' : isRemoteHead ? 'border-l-blue-500' : 'border-l-transparent'}`}
                    >
                      <div className="flex items-center gap-2">
                        {isRemoteHead && <span title={t('remoteTrackingBranch')}><GitCommitHorizontal size={13} className="shrink-0 text-blue-500" /></span>}
                        <code className="text-xs font-mono text-blue-600 shrink-0">{entry.hash.slice(0, 7)}</code>
                        <span className="text-xs truncate">{entry.message.split("\n")[0]}</span>
                        {isHead && <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1 rounded">HEAD</span>}
                      </div>
                      <div className={`flex items-center gap-2 mt-0.5 ${isRemoteHead ? 'pl-[21px]' : ''}`}>
                        <span className="text-xs text-muted-foreground">{entry.author}</span>
                        <span className="text-xs text-muted-foreground">{new Date(entry.date).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </ContextMenuTrigger>
                  <GitCommitContextMenu workspaceId={workspaceId} entry={entry} onRefreshAll={refreshAll} onOpenPrompt={openPromptDialog} />
                </ContextMenu>
              );
            })}
            {!loading && !log.length && <div className="p-2 text-xs text-muted-foreground">{t('noCommits')}</div>}
          </div>
        )}
      </div>

      {/* File context menu */}
      {ctxMenu && (
        <GitFileContextMenu x={ctxMenu.x} y={ctxMenu.y} path={ctxMenu.path} onAddToGitignore={addToGitignore} onOpenFile={(p) => openFile(workspaceId, p)} onDiscard={(p) => setDiscardConfirm({ type: 'single', path: p })} onClose={() => setCtxMenu(null)} />
      )}

      {/* Dialogs */}
      <GitRemoteDialog open={remoteDialogOpen} onOpenChange={setRemoteDialogOpen} onSubmit={handleRemoteSubmit} />

      <GitPromptDialog
        open={promptDialog.open}
        onOpenChange={(open) => setPromptDialog((p) => ({ ...p, open }))}
        title={promptDialog.title}
        label={promptDialog.label}
        placeholder={promptDialog.placeholder}
        onSubmit={(v) => { promptDialog.onSubmit(v); setPromptDialog((p) => ({ ...p, open: false })); }}
      />

      <GitGitignoreDialog
        open={gitignoreOpen}
        onOpenChange={setGitignoreOpen}
        content={gitignoreContent}
        onContentChange={setGitignoreContent}
        saving={gitignoreSaving}
        onSave={saveGitignore}
      />

      <Dialog open={gitSettingsOpen} onOpenChange={setGitSettingsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('settingsTitle')}</DialogTitle>
          </DialogHeader>
          <GitSettingsForm scope="local" workspaceId={workspaceId} />
        </DialogContent>
      </Dialog>

      <GitDiscardDialog
        confirm={discardConfirm}
        open={!!discardConfirm}
        onOpenChange={(open) => !open && setDiscardConfirm(null)}
        onConfirm={confirmDiscard}
      />

      <GitCommitDetailDialog
        workspaceId={workspaceId}
        entry={detailEntry}
        onClose={() => setDetailEntry(null)}
      />
    </div>
  );
}
