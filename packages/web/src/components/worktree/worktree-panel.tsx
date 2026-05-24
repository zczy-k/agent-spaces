"use client";

import { useEffect, useState } from "react";
import { useWorktreeStore } from "@/stores/worktree";
import { useWorkspaceStore } from "@/stores/workspace";
import { WorktreeCard } from "./worktree-card";
import { CreateWorktreeDialog } from "./create-worktree-dialog";
import { GitBranch, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranslations } from "next-intl";

interface WorktreePanelProps {
  workspaceId: string;
}

export function WorktreePanel({ workspaceId }: WorktreePanelProps) {
  const { worktrees, loading, load } = useWorktreeStore();
  const [createOpen, setCreateOpen] = useState(false);
  const t = useTranslations("worktree");

  // Resolve to parent workspace for worktree data
  const currentWs = useWorkspaceStore((s) => s.workspaces.find((w) => w.id === workspaceId));
  const ownerId = currentWs?.isWorktree && currentWs.parentWorkspaceId ? currentWs.parentWorkspaceId : workspaceId;

  useEffect(() => {
    load(ownerId);
  }, [ownerId, load]);

  if (worktrees.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm gap-2">
        <GitBranch size={32} className="opacity-30" />
        <span>{t("panel.empty")}</span>
        <span className="text-xs">{t("panel.emptyHint")}</span>
        <Button variant="outline" size="sm" className="mt-2" onClick={() => setCreateOpen(true)}>
          <Plus size={14} className="mr-1" />
          {t("panel.create")}
        </Button>
        <CreateWorktreeDialog open={createOpen} onOpenChange={setCreateOpen} workspaceId={ownerId} />
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="flex items-center justify-between p-2 pb-0">
        <span className="text-xs text-muted-foreground">
          {t("panel.title")} ({worktrees.length})
        </span>
        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setCreateOpen(true)}>
          <Plus size={12} className="mr-1" />
          {t("panel.create")}
        </Button>
      </div>
      <div className="grid gap-2 p-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
        {worktrees.map((wt) => (
          <WorktreeCard key={wt.id} worktree={wt} workspaceId={ownerId} />
        ))}
      </div>
      <CreateWorktreeDialog open={createOpen} onOpenChange={setCreateOpen} workspaceId={ownerId} />
    </ScrollArea>
  );
}
