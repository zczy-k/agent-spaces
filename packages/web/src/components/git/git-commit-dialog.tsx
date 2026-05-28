"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useRef, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTranslations } from "next-intl";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commitMsg: string;
  onCommitMsgChange: (msg: string) => void;
  committing: boolean;
  generating: boolean;
  onCommit: () => Promise<void>;
  onGenerate: () => void;
}

export function GitCommitDialog({
  open, onOpenChange, commitMsg, onCommitMsgChange,
  committing, generating, onCommit, onGenerate,
}: Props) {
  const tc = useTranslations('common');
  const tChanges = useTranslations('git.changes');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, []);

  useEffect(() => { autoResize(); }, [commitMsg, autoResize]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{tChanges('commit')}</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <textarea ref={textareaRef} value={commitMsg}
            onChange={(e) => onCommitMsgChange(e.target.value)}
            placeholder={tChanges('commitMessagePlaceholder')}
            rows={10} autoFocus
            className="w-full resize-none text-xs px-2 pt-1 pr-8 pb-1 border rounded bg-background min-h-[32px] max-h-[200px] overflow-y-auto" />
          <button type="button" onClick={onGenerate} disabled={generating || committing}
            className="absolute bottom-1.5 right-1.5 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent active:scale-90 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-100"
            title="AI generate commit message">
            {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          </button>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={() => onOpenChange(false)} disabled={committing}
            className="text-xs px-3 py-1.5 rounded border hover:bg-accent active:scale-[0.98] transition-all duration-100 cursor-pointer disabled:opacity-50">
            {tc('cancel')}
          </button>
          <button onClick={async () => { await onCommit(); onOpenChange(false); }} disabled={!commitMsg.trim() || committing}
            className="text-xs px-3 py-1.5 rounded bg-primary text-primary-foreground active:scale-[0.98] transition-all duration-100 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
            {committing ? tChanges('committing') : tChanges('commit')}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
