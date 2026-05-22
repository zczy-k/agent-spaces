"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, FileCode } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DiffViewer } from "./diff-viewer";
import { useGitStore } from "@/stores/git";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTranslations } from "next-intl";
import type { GitLogEntry, GitDiffResult } from "@agent-spaces/shared";

interface Props {
  workspaceId: string;
  entry: GitLogEntry | null;
  onClose: () => void;
}

export function GitCommitDetailDialog({ workspaceId, entry, onClose }: Props) {
  const t = useTranslations('git.commits');
  const isMobile = useIsMobile();
  const getCommitDiff = useGitStore((s) => s.getCommitDiff);
  const [diffs, setDiffs] = useState<GitDiffResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const open = !!entry;

  useEffect(() => {
    if (!entry) { setDiffs([]); setSelectedFile(null); return; }
    setLoading(true);
    setSelectedFile(null);
    getCommitDiff(workspaceId, entry.hash)
      .then((d) => { setDiffs(d); if (d.length > 0) setSelectedFile(d[0].path); })
      .catch(() => setDiffs([]))
      .finally(() => setLoading(false));
  }, [entry, workspaceId, getCommitDiff]);

  const selectedDiff = diffs.find((d) => d.path === selectedFile);

  const handleClose = useCallback(() => {
    onClose();
    setDiffs([]);
    setSelectedFile(null);
  }, [onClose]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className={`${isMobile ? 'w-[95vw] max-w-[95vw] h-[90vh]' : '!max-w-none w-[80vw] h-[80vh]'} flex flex-col p-0 gap-0`}>
        <DialogHeader className="px-4 py-3 border-b shrink-0">
          <DialogTitle className="text-sm font-medium flex items-center gap-2 flex-wrap">
            <code className="font-mono text-blue-600">{entry?.hash.slice(0, 7)}</code>
            <span className="truncate">{entry?.message.split("\n")[0]}</span>
          </DialogTitle>
          {entry && (
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              <span>{entry.author}</span>
              <span>{new Date(entry.date).toLocaleString()}</span>
              {diffs.length > 0 && <span>{t('detailFileCount', { count: diffs.length })}</span>}
            </div>
          )}
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-col">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : isMobile ? (
            <MobileLayout diffs={diffs} selectedFile={selectedFile} onSelect={setSelectedFile} selectedDiff={selectedDiff} />
          ) : (
            <DesktopLayout diffs={diffs} selectedFile={selectedFile} onSelect={setSelectedFile} selectedDiff={selectedDiff} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DesktopLayout({ diffs, selectedFile, onSelect, selectedDiff }: {
  diffs: GitDiffResult[];
  selectedFile: string | null;
  onSelect: (path: string) => void;
  selectedDiff?: GitDiffResult;
}) {
  return (
    <div className="flex-1 min-h-0 flex">
      <div className="w-48 border-r overflow-auto shrink-0">
        {diffs.map((d) => (
          <button key={d.path} onClick={() => onSelect(d.path)}
            className={`w-full text-left px-2 py-1.5 text-xs font-mono flex items-center gap-1.5 border-b hover:bg-accent cursor-pointer ${selectedFile === d.path ? 'bg-accent' : ''}`}>
            <FileCode size={13} className="shrink-0 text-muted-foreground" />
            <span className="truncate">{d.path}</span>
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0">
        {selectedDiff ? (
          <DiffViewer oldContent={selectedDiff.oldContent} newContent={selectedDiff.newContent} path={selectedDiff.path} isBinary={selectedDiff.isBinary} />
        ) : (
          <div className="flex items-center justify-center h-full text-xs text-muted-foreground">Select a file</div>
        )}
      </div>
    </div>
  );
}

function MobileLayout({ diffs, selectedFile, onSelect, selectedDiff }: {
  diffs: GitDiffResult[];
  selectedFile: string | null;
  onSelect: (path: string) => void;
  selectedDiff?: GitDiffResult;
}) {
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex overflow-x-auto border-b shrink-0 gap-0.5 px-1 py-1">
        {diffs.map((d) => (
          <button key={d.path} onClick={() => onSelect(d.path)}
            className={`shrink-0 text-xs font-mono px-2 py-1 rounded border ${selectedFile === d.path ? 'bg-accent border-accent' : 'border-transparent hover:bg-accent/50'} truncate max-w-[140px]`}>
            {d.path}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0">
        {selectedDiff ? (
          <DiffViewer oldContent={selectedDiff.oldContent} newContent={selectedDiff.newContent} path={selectedDiff.path} isBinary={selectedDiff.isBinary} />
        ) : (
          <div className="flex items-center justify-center h-full text-xs text-muted-foreground">Select a file</div>
        )}
      </div>
    </div>
  );
}
