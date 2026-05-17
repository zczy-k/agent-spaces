'use client';

import type { ReactNode } from 'react';
import { EditorContent, type Editor } from '@tiptap/react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useInspectorHistoryStore } from '@/stores/inspector-history';
import { Code2, Send, Square, X } from 'lucide-react';

interface ComposerShellProps {
  workspaceId: string;
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
  workspaceId,
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
  const history = useInspectorHistoryStore((s) => s.histories[workspaceId] ?? []);
  const loadHistory = useInspectorHistoryStore((s) => s.loadHistory);

  const insertCodeLocation = (path: string, line: number, column: number) => {
    editor?.chain().focus().insertContent(`${path}:${line}:${column}`).run();
  };

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
          <div className="flex items-center gap-1">
            {actions}
            <Popover onOpenChange={(open) => { if (open) loadHistory(workspaceId); }}>
              <PopoverTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 rounded-full border border-border hover:bg-accent text-muted-foreground"
                    title="最近定位代码"
                  />
                }
              >
                <Code2 className="size-3" />
              </PopoverTrigger>
              <PopoverContent align="start" sideOffset={6} className="w-80 p-1.5 gap-0">
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">最近定位代码</div>
                {history.length === 0 ? (
                  <div className="px-2 py-6 text-center text-xs text-muted-foreground">暂无记录</div>
                ) : (
                  <div className="max-h-72 overflow-y-auto">
                    {history.map((item) => {
                      const label = item.name || item.path.split('/').pop() || item.path;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => insertCodeLocation(item.path, item.line, item.column)}
                          className="flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left hover:bg-accent"
                        >
                          <span className="w-full truncate text-xs font-medium">{label}</span>
                          <span className="w-full truncate font-mono text-[11px] text-muted-foreground">
                            {item.path}:{item.line}:{item.column}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>
          {isProcessing ? (
            <Button
              type="button"
              onClick={onStop}
              className="size-7 p-0 rounded-full bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              <Square className="size-3" fill="currentColor" />
            </Button>
          ) : canSubmit ? (
            <Button
              type="button"
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
