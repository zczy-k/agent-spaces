'use client';

import type { ReactNode } from 'react';
import { EditorContent, type Editor } from '@tiptap/react';
import { Button } from '@/components/ui/button';
import { Send, Square, X } from 'lucide-react';

interface ComposerShellProps {
  editor: Editor | null;
  canSubmit: boolean;
  onSubmit: () => void;
  onStop?: () => void;
  isProcessing?: boolean;
  actions?: ReactNode;
  className?: string;
  dropzoneProps?: Record<string, unknown>;
  hiddenInput?: ReactNode;
  replyLabel?: string;
  onCancelReply?: () => void;
}

export function ComposerShell({
  editor,
  canSubmit,
  onSubmit,
  onStop,
  isProcessing = false,
  actions,
  className,
  dropzoneProps,
  hiddenInput,
  replyLabel,
  onCancelReply,
}: ComposerShellProps) {
  return (
    <div className={className}>
      <div
        className="bg-background border border-border rounded-2xl overflow-hidden"
        {...dropzoneProps}
      >
        {hiddenInput}
        {replyLabel ? (
          <div className="flex items-center justify-between gap-2 border-b px-3 py-1.5 text-xs text-muted-foreground">
            <span className="min-w-0 truncate">回复给 {replyLabel}</span>
            <button
              type="button"
              onClick={onCancelReply}
              className="inline-flex size-5 shrink-0 items-center justify-center rounded hover:bg-muted hover:text-foreground"
              title="取消回复"
            >
              <X className="size-3" />
            </button>
          </div>
        ) : null}
        <div className="px-3 pt-3 pb-2">
          <EditorContent editor={editor} />
        </div>
        <div className="flex items-center justify-between px-2 pb-2">
          <div className="flex items-center gap-1">{actions}</div>
          {isProcessing ? (
            <Button
              onClick={onStop}
              className="size-7 p-0 rounded-full bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              <Square className="size-3" fill="currentColor" />
            </Button>
          ) : canSubmit ? (
            <Button
              onClick={onSubmit}
              className="size-7 p-0 rounded-full bg-primary"
            >
              <Send className="size-3" />
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
