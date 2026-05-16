"use client";

import { useState } from "react";
import { X, GitCommitHorizontal } from "lucide-react";
import { useEditorStore, isCommitDiffPath, getCommitHashFromPath } from "@/stores/editor";
import { useWorkspaceStore } from "@/stores/workspace";
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from "@/components/ui/context-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { FileIconImg } from "./file-icon";

interface EditorTabsProps {
  workspaceId: string;
}

function getAbsolutePath(relPath: string, boundDirs: string[]): string {
  if (boundDirs.length === 0) return relPath;
  const base = boundDirs[0].replace(/\/+$/, '');
  return base + '/' + relPath;
}

function getRelativePath(relPath: string, boundDirs: string[]): string {
  return relPath;
}

export function EditorTabs({ workspaceId }: EditorTabsProps) {
  const { openFiles, activeFilePath, setActiveFile, closeFile, saveFile, setRevealPath, commitDiffs } = useEditorStore();
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const workspace = workspaces.find((w) => w.id === workspaceId);
  const boundDirs = workspace?.boundDirs ?? [];
  const t = useTranslations('editor');
  const [pendingClose, setPendingClose] = useState<{ path: string; name: string } | null>(null);

  if (openFiles.length === 0) return null;

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success(t('copied'));
  };

  const handleRevealInFinder = (relPath: string) => {
    fetch(`/api/workspaces/${workspaceId}/files/reveal?path=${encodeURIComponent(relPath)}`, { method: 'POST' });
  };

  const handleClose = (e: React.MouseEvent, file: { path: string; name: string; modified: boolean }) => {
    e.stopPropagation();
    if (file.modified) {
      setPendingClose(file);
    } else {
      closeFile(workspaceId, file.path);
    }
  };

  const handleSaveAndClose = async () => {
    if (!pendingClose) return;
    await saveFile(workspaceId, pendingClose.path);
    closeFile(workspaceId, pendingClose.path);
    setPendingClose(null);
  };

  const handleDiscardAndClose = () => {
    if (!pendingClose) return;
    closeFile(workspaceId, pendingClose.path);
    setPendingClose(null);
  };

  return (
    <>
      <div className="flex items-center border-b bg-muted/30 overflow-x-auto">
        {openFiles.map((file) => (
          <ContextMenu key={file.path}>
            <ContextMenuTrigger>
              <div
                className={`flex items-center gap-1 px-3 py-1.5 text-xs border-r cursor-pointer shrink-0 ${
                  file.path === activeFilePath
                    ? "bg-background text-foreground"
                    : "text-muted-foreground hover:bg-accent"
                }`}
                onClick={() => setActiveFile(workspaceId, file.path)}
              >
                {isCommitDiffPath(file.path) ? (
                  <GitCommitHorizontal size={14} className="text-blue-500 shrink-0" />
                ) : (
                  <FileIconImg name={file.name} />
                )}
                {file.modified && (
                  <span className="size-1.5 rounded-full bg-orange-400 shrink-0" />
                )}
                <span className="truncate max-w-32">
                  {isCommitDiffPath(file.path)
                    ? commitDiffs[getCommitHashFromPath(file.path)]?.message?.split("\n")[0]?.slice(0, 30) || file.name
                    : file.name}
                </span>
                <button
                  className="ml-1 hover:bg-accent rounded p-0.5"
                  onClick={(e) => handleClose(e, file)}
                >
                  <X className="size-3" />
                </button>
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onClick={() => setRevealPath(file.path)}>
                {t('revealInTree')}
              </ContextMenuItem>
              <ContextMenuItem onClick={() => handleRevealInFinder(file.path)}>
                {t('revealInFinder')}
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => handleCopy(getAbsolutePath(file.path, boundDirs))}>
                {t('copyFilePath')}
              </ContextMenuItem>
              <ContextMenuItem onClick={() => handleCopy(getRelativePath(file.path, boundDirs))}>
                {t('copyRelativePath')}
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        ))}
      </div>

      <Dialog open={!!pendingClose} onOpenChange={(open) => !open && setPendingClose(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('saveChangesTitle')}</DialogTitle>
            <DialogDescription>
              {t('saveChangesDesc', { name: pendingClose?.name ?? '' })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingClose(null)}>
              {t('cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDiscardAndClose}>
              {t('discardChanges')}
            </Button>
            <Button onClick={handleSaveAndClose}>
              {t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
