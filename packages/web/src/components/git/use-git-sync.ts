import { useState, useCallback } from "react";
import { useGitStore } from "@/stores/git";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { errMsg } from "./git-commit-utils";

export function useGitSync(workspaceId: string, refresh: () => void) {
  const t = useTranslations('git.commits');
  const tChanges = useTranslations('git.changes');
  const { push, pull, getRemotes, addRemote } = useGitStore();

  const [syncing, setSyncing] = useState<"push" | "pull" | null>(null);
  const [remoteDialogOpen, setRemoteDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<"push" | "pull" | null>(null);

  const doSync = async (action: "push" | "pull") => {
    if (action === "push") { await push(workspaceId); toast.success(t('pushedSuccessfully')); }
    else { await pull(workspaceId); toast.success(t('pulledSuccessfully')); }
    refresh();
  };

  const handleSync = async (action: "push" | "pull") => {
    setSyncing(action);
    try {
      const remotes = await getRemotes(workspaceId);
      if (!remotes.length) { setPendingAction(action); setRemoteDialogOpen(true); return; }
      await doSync(action);
    } catch (err: unknown) {
      if (errMsg(err)?.includes("No remote")) { setPendingAction(action); setRemoteDialogOpen(true); }
      else toast.error(action === "push" ? t('pushFailed') : t('pullFailed'), { description: errMsg(err) });
    } finally { setSyncing(null); }
  };

  const handleRemoteSubmit = async (name: string, url: string) => {
    await addRemote(workspaceId, name, url);
    toast.success(t('remoteAdded'));
    if (pendingAction) { await doSync(pendingAction); setPendingAction(null); }
  };

  const handleSyncChanges = useCallback(async () => {
    setSyncing("push");
    try {
      const remotes = await getRemotes(workspaceId);
      if (!remotes.length) { setRemoteDialogOpen(true); return; }
      await push(workspaceId); await pull(workspaceId);
      toast.success(tChanges('syncedSuccessfully'));
      refresh();
    } catch (err: unknown) {
      if (errMsg(err)?.includes("No remote")) setRemoteDialogOpen(true);
      else toast.error(tChanges('syncFailed'), { description: errMsg(err) });
    } finally { setSyncing(null); }
  }, [workspaceId, push, pull, getRemotes, refresh, tChanges]);

  return { syncing, remoteDialogOpen, setRemoteDialogOpen, handleSync, handleRemoteSubmit, handleSyncChanges };
}
