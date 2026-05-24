"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2Icon, CheckCheckIcon, ArrowLeftIcon } from "lucide-react";
import { useTranslations } from 'next-intl';
import { useNotificationStore } from "@/stores/notification";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import type { AppNotification } from "@agent-spaces/shared";
import { useState } from "react";

const typeIcon: Record<string, string> = {
  issue_completed: "✓",
  issue_failed: "✕",
  task_completed: "✓",
  task_failed: "✕",
  channel_agent_completed: "✓",
};

const typeColor: Record<string, string> = {
  issue_completed: "text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400",
  issue_failed: "text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400",
  task_completed: "text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400",
  task_failed: "text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400",
  channel_agent_completed: "text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400",
};

export function NotificationCenterDialog({
  open,
  onOpenChange,
  workspaceId,
  initialNotification,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  initialNotification?: AppNotification | null;
}) {
  const t = useTranslations('sidebar.notifications');
  const notifications = useNotificationStore((s) => s.notifications);
  const markRead = useNotificationStore((s) => s.markRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const clearAll = useNotificationStore((s) => s.clearAll);
  const remove = useNotificationStore((s) => s.remove);
  const [detail, setDetail] = useState<AppNotification | null>(null);

  const show = initialNotification && !detail ? initialNotification : detail;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setDetail(null); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DialogTitle>{t('centerTitle')}</DialogTitle>
              {notifications.some((n) => !n.read) && (
                <span className="inline-flex items-center justify-center size-5 rounded-full bg-blue-500 text-[10px] font-medium text-white">
                  {notifications.filter((n) => !n.read).length}
                </span>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {show ? (
            <div className="px-6 py-4">
              <button onClick={() => setDetail(null)} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3 transition-colors">
                <ArrowLeftIcon className="size-3.5" />
                {t('backToList')}
              </button>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-lg font-semibold truncate">{show.title}</h3>
                <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", typeColor[show.type] ?? "")}>
                  {typeIcon[show.type] ?? ""} {t(`type.${show.type}`, { defaultValue: show.type })}
                </span>
              </div>
              {show.description && (
                <p className="text-sm text-muted-foreground mb-3">{show.description}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(show.createdAt), { addSuffix: true })}
              </p>
              {Object.keys(show.data).length > 0 && (
                <pre className="mt-3 text-xs bg-muted rounded p-3 overflow-auto">
                  {JSON.stringify(show.data, null, 2)}
                </pre>
              )}
            </div>
          ) : notifications.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">
              {t('empty')}
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  className={cn(
                    "flex w-full items-start gap-3 px-6 py-3.5 text-left hover:bg-accent/50 transition-colors",
                    !n.read && "bg-accent/30",
                  )}
                  onClick={() => {
                    if (!n.read) markRead(workspaceId, n.id);
                    setDetail(n);
                  }}
                >
                  <div className={cn(
                    "mt-1 size-2 rounded-full shrink-0",
                    !n.read ? "bg-blue-500" : "bg-transparent",
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{n.title}</p>
                    {n.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{n.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {!show && notifications.length > 0 && (
          <div className="px-6 py-3 border-t shrink-0 flex items-center justify-between">
            {notifications.some((n) => !n.read) && (
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => markAllRead(workspaceId)}>
                <CheckCheckIcon className="size-3.5" />
                {t('markAllRead')}
              </Button>
            )}
            <div className="flex-1" />
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-destructive" onClick={() => { clearAll(workspaceId); onOpenChange(false); }}>
              <Trash2Icon className="size-3.5" />
              {t('clearAll')}
            </Button>
          </div>
        )}
        {show && (
          <div className="px-6 py-3 border-t shrink-0 flex justify-end">
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-destructive" onClick={() => { remove(workspaceId, show.id); setDetail(null); }}>
              <Trash2Icon className="size-3.5" />
              {t('delete')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
