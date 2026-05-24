"use client";

import { useState, useCallback } from "react";
import type { WorktreeInfo } from "@agent-spaces/shared";
import { useWorktreeStore } from "@/stores/worktree";
import { useWorkspaceStore } from "@/stores/workspace";
import { useRouter, usePathname } from "next/navigation";
import { tauriNavigate } from "@/lib/navigate";
import {
  GitBranch, ExternalLink, Trash2, GitPullRequest, ArrowRightLeft, FileDiff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

interface WorktreeCardProps {
  worktree: WorktreeInfo;
  workspaceId: string;
}

export function WorktreeCard({ worktree: wt, workspaceId }: WorktreeCardProps) {
  const { remove, createPR, merge } = useWorktreeStore();
  const [prLoading, setPrLoading] = useState(false);
  const [mergeLoading, setMergeLoading] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [diffContent, setDiffContent] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const isCurrent = pathname === `/workspace/${wt.id}`;
  const t = useTranslations("worktree");
  const removeWorkspace = useWorkspaceStore((s) => s.removeWorkspace);

  const handleSwitch = useCallback(() => {
    tauriNavigate(router, `/workspace/${wt.id}`);
  }, [wt.id, router]);

  const handleDiff = useCallback(async () => {
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/worktrees/${wt.id}/diff`);
      const text = await res.text();
      setDiffContent(text);
      setShowDiff(true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }, [workspaceId, wt.id]);

  const handleCreatePR = useCallback(async () => {
    setPrLoading(true);
    try {
      await createPR(workspaceId, wt.id);
      toast.success("PR created");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setPrLoading(false);
    }
  }, [workspaceId, wt.id, createPR]);

  const handleMerge = useCallback(async () => {
    setMergeLoading(true);
    try {
      await merge(workspaceId, wt.id);
      removeWorkspace(wt.id);
      tauriNavigate(router, `/workspace/${workspaceId}`);
      toast.success("Merged and cleaned up");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setMergeLoading(false);
    }
  }, [workspaceId, wt.id, merge, removeWorkspace, router]);

  const handleDelete = useCallback(async () => {
    if (!confirm(t("card.confirmDelete"))) return;
    try {
      await remove(workspaceId, wt.id);
      removeWorkspace(wt.id);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }, [workspaceId, wt.id, remove, removeWorkspace, t]);

  return (
    <div className="group border rounded-lg p-3 hover:bg-accent/50 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <GitBranch size={14} className="shrink-0 text-muted-foreground" />
          <span className="text-sm font-medium truncate">{wt.name}</span>
        </div>
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${
            wt.status === "active"
              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {t(`card.${wt.status}`)}
        </span>
        {isCurrent && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
            {t("card.current")}
          </span>
        )}
      </div>
      <div className="text-xs text-muted-foreground mt-1">
        <span className="inline-flex items-center gap-0.5">
          <GitBranch size={10} />
          {wt.branch}
        </span>
      </div>
      {wt.agentId && (
        <div className="text-xs text-muted-foreground mt-0.5">
          {t("card.agent")}: {wt.agentId}
        </div>
      )}
      <div className="flex items-center gap-1 mt-2 flex-wrap">
        <Button variant="outline" size="sm" className="h-6 text-xs" onClick={handleSwitch}>
          <ArrowRightLeft size={12} className="mr-1" />
          {t("card.switch")}
        </Button>
        {!wt.prUrl && (
          <>
            <Button variant="outline" size="sm" className="h-6 text-xs" onClick={handleDiff}>
              <FileDiff size={12} className="mr-1" />
              {t("card.diff")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-xs"
              onClick={handleCreatePR}
              disabled={prLoading}
            >
              <GitPullRequest size={12} className="mr-1" />
              {prLoading ? "..." : t("card.createPR")}
            </Button>
          </>
        )}
        {wt.prUrl && (
          <>
            <a
              href={wt.prUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center h-6 px-2.5 text-xs rounded-md border bg-background hover:bg-accent hover:text-accent-foreground"
            >
              <ExternalLink size={12} className="mr-1" />
              {t("card.viewPR")}
            </a>
            <Button
              variant="default"
              size="sm"
              className="h-6 text-xs"
              onClick={handleMerge}
              disabled={mergeLoading}
            >
              {mergeLoading ? "..." : t("card.merge")}
            </Button>
          </>
        )}
        {!wt.prUrl && (
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
            onClick={handleDelete}
          >
            <Trash2 size={12} />
          </Button>
        )}
      </div>
      {showDiff && diffContent !== null && (
        <pre className="text-[11px] bg-muted/50 rounded px-2 py-1 mt-2 max-h-40 overflow-auto whitespace-pre font-mono">
          {diffContent || "(No changes)"}
        </pre>
      )}
    </div>
  );
}
