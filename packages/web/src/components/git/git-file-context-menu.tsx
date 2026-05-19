"use client";

import { useEffect, useRef } from "react";
import { EyeOff, FileCode, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";

interface Props {
  x: number;
  y: number;
  path: string;
  onAddToGitignore: (pattern: string) => void;
  onOpenFile: (path: string) => void;
  onDiscard: (path: string) => void;
  onClose: () => void;
}

export function GitFileContextMenu({ x, y, path, onAddToGitignore, onOpenFile, onDiscard, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const tChanges = useTranslations('git.changes');
  const tc = useTranslations('common');

  useEffect(() => {
    document.addEventListener("click", onClose);
    return () => document.removeEventListener("click", onClose);
  }, [onClose]);

  const fileName = path.split("/").pop()!;
  const idx = path.lastIndexOf("/");
  const dir = idx >= 0 ? path.substring(0, idx + 1) : path;

  return (
    <div ref={ref}
      className="fixed z-[100] bg-popover border rounded-lg shadow-md py-1 text-xs min-w-40 ring-1 ring-foreground/10"
      style={{ left: x, top: y }}>
      <button className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-accent text-left"
        onClick={() => { onOpenFile(path); onClose(); }}>
        <FileCode size={13} />
        <span>{tc('open')}</span>
      </button>
      <button className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-accent text-left"
        onClick={() => { onDiscard(path); onClose(); }}>
        <RotateCcw size={13} />
        <span>{tChanges('discardAll')}</span>
      </button>
      <div className="my-1 border-t" />
      <button className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-accent text-left"
        onClick={() => onAddToGitignore(fileName)}>
        <EyeOff size={13} />
        <span>{tChanges('ignoreThisFile')}</span>
        <span className="ml-auto text-muted-foreground truncate max-w-24">{fileName}</span>
      </button>
      <button className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-accent text-left"
        onClick={() => { if (dir) onAddToGitignore(dir); }}>
        <EyeOff size={13} />
        <span>{tChanges('ignoreFilePath', { path: dir })}</span>
      </button>
    </div>
  );
}
