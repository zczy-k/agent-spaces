"use client";

import { useState } from "react";
import {
  Upload, Loader2, RefreshCw, Trash2, ChevronDown, GitBranch,
  FileDiff, FileCode, RotateCcw, Plus, Minus, AlertTriangle,
} from "lucide-react";
import { ResizablePanel } from "@/components/ui/resizable";
import { useTranslations } from "next-intl";

import { statusColors, statusLabels } from "./git-commit-utils";
import type { GitFileStatus } from "@agent-spaces/shared";

interface Props {
  workspaceId: string;
  branch: string | undefined;
  branches: { name: string; current: boolean }[];
  files: GitFileStatus[];
  hasFiles: boolean;
  ahead: number;
  selectedFile: string | null;
  syncing: string | null;
  clean: boolean;
  onFileClick: (path: string) => void;
  onOpenFile: (e: React.MouseEvent, path: string) => void;
  onDiscard: (e: React.MouseEvent, path: string) => void;
  onStageToggle: (e: React.MouseEvent, path: string, staged?: boolean) => void;
  onDiscardAll: () => void;
  onBranchCheckout: (branch: string) => void;
  onCommitDialogOpen: () => void;
  onSyncChanges: () => void;
  onViewDiff: () => void;
  onRefreshClick: () => void;
  onContextMenu: (e: React.MouseEvent, path: string) => void;
  isVertical: boolean;
}

export function GitChangesPanel({
  branch, branches, files, hasFiles, ahead, selectedFile,
  syncing, clean, onFileClick, onOpenFile, onDiscard, onStageToggle,
  onDiscardAll, onBranchCheckout, onCommitDialogOpen, onSyncChanges,
  onViewDiff, onRefreshClick, onContextMenu, isVertical,
}: Props) {
  const tc = useTranslations('common');
  const tChanges = useTranslations('git.changes');
  const [branchOpen, setBranchOpen] = useState(false);

  return (
    <ResizablePanel id="changes" defaultSize={isVertical ? "40%" : "25%"} minSize="15%" maxSize="60%" className="flex flex-col bg-muted/20 overflow-hidden">
      {/* Header with branch selector */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b">
        <div className="relative flex-1 min-w-0">
          <button onClick={() => setBranchOpen(!branchOpen)} className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground active:opacity-70 transition-all duration-100 cursor-pointer w-full">
            <GitBranch size={13} className="shrink-0" />
            <span className="truncate">{branch ?? "..."}</span>
            {hasFiles && <span className="text-muted-foreground">({files.length})</span>}
            <ChevronDown size={12} className="shrink-0" />
          </button>
          {branchOpen && (
            <>
              <div className="absolute left-0 top-full z-50 mt-1 w-48 bg-popover border rounded shadow-md py-0.5 max-h-60 overflow-auto">
                {branches.map((b) => (
                  <button key={b.name} onClick={() => { onBranchCheckout(b.name); setBranchOpen(false); }}
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
          <button onClick={onDiscardAll} className="p-1 text-muted-foreground hover:text-destructive active:scale-90 transition-all duration-100 cursor-pointer" title={tChanges('discardAll')}>
            <Trash2 size={13} />
          </button>
        )}
        <button onClick={onViewDiff} disabled={!hasFiles} className="p-1 text-muted-foreground hover:text-foreground active:scale-90 transition-all duration-100 cursor-pointer disabled:opacity-30" title={tChanges('viewDiff')}>
          <FileDiff size={13} />
        </button>
        <button onClick={onRefreshClick} className="p-1 text-muted-foreground hover:text-foreground active:scale-90 transition-all duration-100 cursor-pointer" title={tc('refresh')}>
          <RefreshCw size={13} />
        </button>
      </div>

      {/* File list */}
       <div className="flex-1 overflow-auto">
        {files.map((f) => (
          <div key={f.path} onClick={() => onFileClick(f.path)} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu(e, f.path); }}
            className={`group w-full text-left px-2 py-1 text-xs font-mono flex items-center gap-1.5 hover:bg-accent cursor-pointer ${selectedFile === f.path ? "bg-accent" : ""}`}>
            <span className={`w-4 text-center font-bold shrink-0 ${statusColors[f.status]}`}>{statusLabels[f.status]}</span>
            {f.conflicted && <AlertTriangle size={12} className="shrink-0 text-red-500" />}
            <span className="truncate flex-1">{f.path}</span>
            <span className="hidden group-hover:flex md:flex items-center gap-0.5 shrink-0">
              <button
                onClick={(e) => onStageToggle(e, f.path, f.staged)}
                disabled={f.conflicted}
                className="p-0.5 rounded hover:bg-accent/80 active:scale-90 transition-all duration-100 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                title={f.staged ? "Unstage" : "Stage"}
              >
                {f.staged ? <Minus size={13} /> : <Plus size={13} />}
              </button>
              <button onClick={(e) => onOpenFile(e, f.path)} className="p-0.5 rounded hover:bg-accent/80 active:scale-90 transition-all duration-100 cursor-pointer" title={tc('open')}><FileCode size={13} /></button>
              <button onClick={(e) => onDiscard(e, f.path)} className="p-0.5 rounded hover:bg-accent/80 active:scale-90 transition-all duration-100 cursor-pointer" title={tChanges('discardAll')}><RotateCcw size={13} /></button>
            </span>
          </div>
        ))}
        {clean && <div className="p-2 text-xs text-muted-foreground">{tChanges('noChanges')}</div>}
      </div>

      {/* Action button */}
      {hasFiles ? (
        <div className="border-t p-2">
          <button onClick={onCommitDialogOpen}
            className="w-full text-xs px-2 py-1 rounded bg-primary text-primary-foreground active:scale-[0.98] transition-all duration-100 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
            {tChanges('commit')}
          </button>
        </div>
      ) : ahead > 0 ? (
        <div className="border-t p-2">
          <button onClick={onSyncChanges} disabled={syncing !== null}
            className="w-full text-xs px-2 py-1 rounded bg-primary text-primary-foreground active:scale-[0.98] transition-all duration-100 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5">
            {syncing ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
            {syncing ? tChanges('syncing') : tChanges('syncChanges')}
          </button>
        </div>
      ) : null}
    </ResizablePanel>
  );
}
