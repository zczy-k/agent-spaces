'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
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
  voiceAction?: ReactNode;
  className?: string;
  dropzoneProps?: Record<string, unknown>;
  hiddenInput?: ReactNode;
  replyLabel?: string;
  onCancelReply?: () => void;
}

const EMPTY_HISTORY: never[] = [];

export function ComposerShell({
  workspaceId,
  editor,
  canSubmit,
  onSubmit,
  onStop,
  isProcessing = false,
  actions,
  voiceAction,
  className,
  dropzoneProps,
  hiddenInput,
  replyLabel,
  onCancelReply,
}: ComposerShellProps) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const history = useInspectorHistoryStore((s) => s.histories[workspaceId] ?? EMPTY_HISTORY);
  const loadHistory = useInspectorHistoryStore((s) => s.loadHistory);
  const clearHistory = useInspectorHistoryStore((s) => s.clearHistory);

  const insertCodeLocation = (path: string, line: number, column: number) => {
    editor?.chain().focus().insertContent(`${path}:${line}:${column}`).run();
    setHistoryOpen(false);
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
              className="inline-flex size-5 shrink-0 items-center justify-center rounded hover:bg-muted hover:text-foreground cursor-pointer"
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
            <Popover
              open={historyOpen}
              onOpenChange={(open) => {
                setHistoryOpen(open);
                if (open) loadHistory(workspaceId);
              }}
            >
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
                <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                  <span className="text-xs font-medium text-muted-foreground">最近定位代码</span>
                  <button
                    type="button"
                    onClick={() => clearHistory(workspaceId)}
                    disabled={history.length === 0}
                    className="rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                  >
                    清空
                  </button>
                </div>
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
          <div className="flex items-center gap-1">
            {isProcessing ? (
              <Button
                type="button"
                onClick={onStop}
                className="size-7 p-0 rounded-full bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              >
                <Square className="size-3" fill="currentColor" />
              </Button>
            ) : (
              <>
                {voiceAction}
                <Button
                  type="button"
                  onClick={onSubmit}
                  disabled={!canSubmit}
                  className="size-7 p-0 rounded-full bg-primary disabled:opacity-40 disabled:pointer-events-none"
                >
                  <Send className="size-3" />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
