"use client";

import { useState, useCallback } from "react";
import type { WorktreeInfo, GitDiffResult } from "@agent-spaces/shared";
import { useWorktreeStore } from "@/stores/worktree";
import { useWorkspaceStore } from "@/stores/workspace";
import { useEditorStore } from "@/stores/editor";
import { useRouter, usePathname } from "next/navigation";
import { tauriNavigate } from "@/lib/navigate";
import {
  GitBranch, ExternalLink, Trash2, GitPullRequest, ArrowRightLeft, FileDiff, Sparkles, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
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
  const [prDialogOpen, setPrDialogOpen] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const [prTitle, setPrTitle] = useState(`[${wt.name}] ${wt.branch}`);
  const [prBody, setPrBody] = useState("");
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
      const diffs: GitDiffResult[] = await res.json();
      if (diffs.length === 0) {
        toast.info("No changes");
        return;
      }
      useEditorStore.getState().openCommitDiff(
        workspaceId,
        `worktree-${wt.id}`,
        `${wt.name} → ${wt.branch}`,
        diffs,
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }, [workspaceId, wt.id, wt.name, wt.branch]);

  const handleCreatePR = useCallback(async () => {
    setPrTitle(`[${wt.name}] ${wt.branch}`);
    setPrBody("");
    setPrDialogOpen(true);
  }, [wt.name, wt.branch]);

  const handleGenerateDraft = useCallback(async () => {
    if (draftLoading || prLoading) return;
    setDraftLoading(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/worktrees/${wt.id}/pr/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: prTitle }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate PR draft");
      if (data.title) setPrTitle(data.title);
      if (data.body) setPrBody(data.body);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setDraftLoading(false);
    }
  }, [workspaceId, wt.id, prTitle, draftLoading, prLoading]);

  const handleSubmitPR = useCallback(async () => {
    setPrLoading(true);
    try {
      await createPR(workspaceId, wt.id, { title: prTitle, body: prBody });
      setPrDialogOpen(false);
      toast.success("PR created");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setPrLoading(false);
    }
  }, [workspaceId, wt.id, createPR, prTitle, prBody]);

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
      if (isCurrent) tauriNavigate(router, `/workspace/${workspaceId}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }, [workspaceId, wt.id, remove, removeWorkspace, t, isCurrent, router]);

  return (
    <div className="group border rounded-lg p-3 hover:bg-accent/50 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <GitBranch size={14} className="shrink-0 text-muted-foreground" />
          <span className="text-sm font-medium truncate">{wt.name}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-auto">
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
              wt.status === "active"
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {t(`card.${wt.status}`)}
          </span>
          {isCurrent && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              {t("card.current")}
            </span>
          )}
        </div>
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
            >
              <GitPullRequest size={12} className="mr-1" />
              {t("card.createPR")}
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
      <Dialog open={prDialogOpen} onOpenChange={setPrDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("prDialog.title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("prDialog.prTitle")}</label>
              <input
                value={prTitle}
                onChange={(e) => setPrTitle(e.target.value)}
                className="w-full h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
            <div className="relative">
              <label className="text-sm font-medium">{t("prDialog.body")}</label>
              <Textarea
                value={prBody}
                onChange={(e) => setPrBody(e.target.value)}
                rows={10}
                className="mt-1 resize-none pr-10 text-sm"
                placeholder={t("prDialog.bodyPlaceholder")}
              />
              <button
                type="button"
                onClick={handleGenerateDraft}
                disabled={draftLoading || prLoading}
                className="absolute right-2 bottom-2 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent active:scale-90 transition-all duration-100 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                title={t("prDialog.generate")}
              >
                {draftLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              </button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPrDialogOpen(false)}>
              {t("prDialog.cancel")}
            </Button>
            <Button onClick={handleSubmitPR} disabled={prLoading || !prTitle.trim()}>
              {prLoading ? "..." : t("prDialog.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
