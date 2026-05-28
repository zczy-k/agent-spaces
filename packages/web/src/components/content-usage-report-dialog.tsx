'use client';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ContentUsageSnapshot, formatContentUsageSnapshot } from '@/stores/content-usage-report';
import { RefreshCw, Trash2 } from 'lucide-react';

interface ContentUsageReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reports: ContentUsageSnapshot[];
  onCaptureNow: () => void;
  onClear: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[index]}`;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-xs">{value}</span>
    </div>
  );
}

export function ContentUsageReportDialog({
  open,
  onOpenChange,
  reports,
  onCaptureNow,
  onClear,
}: ContentUsageReportDialogProps) {
  const latest = reports[reports.length - 1] ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Content Usage Report</DialogTitle>
          <DialogDescription>
            Periodic snapshots of app content, cache, and browser heap usage.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onCaptureNow}>
            <RefreshCw className="size-4" />
            Capture now
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onClear} disabled={reports.length === 0}>
            <Trash2 className="size-4" />
            Clear
          </Button>
          <Badge variant="secondary" className="ml-auto">
            {reports.length} snapshots
          </Badge>
        </div>

        {latest ? (
          <div className="grid gap-3 md:grid-cols-2">
            <Metric label="Captured" value={latest.capturedAt} />
            <Metric label="Route" value={latest.route} />
            <Metric label="JS heap" value={latest.jsHeap ? `${formatBytes(latest.jsHeap.used)} / ${formatBytes(latest.jsHeap.total)}` : 'unavailable'} />
            <Metric label="Open files" value={`${latest.counts.openFiles} (${formatBytes(latest.counts.openFileBytes)})`} />
            <Metric label="Modified bytes" value={formatBytes(latest.counts.modifiedBytes)} />
            <Metric label="Terminal sessions" value={`${latest.counts.terminalSessions} / ${latest.counts.terminalRegistrySessions}`} />
            <Metric label="Channel messages" value={`${latest.counts.channelMessages} (${formatBytes(latest.counts.channelMessageBytes)})`} />
            <Metric label="Activity log entries" value={String(latest.counts.activityLogEntries)} />
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            No snapshots yet.
          </div>
        )}

        <ScrollArea className="h-[52vh] rounded-md border border-border">
          <div className="space-y-3 p-3">
            {reports.slice().reverse().map((report) => (
              <details key={report.id} className="rounded-md border border-border bg-background p-3">
                <summary className="cursor-pointer text-sm font-medium">
                  {report.capturedAt} · {report.route}
                </summary>
                <pre className="mt-3 whitespace-pre-wrap break-words text-xs leading-5 text-muted-foreground">
                  {formatContentUsageSnapshot(report).join('\n')}
                </pre>
              </details>
            ))}
            {reports.length === 0 && (
              <div className="text-sm text-muted-foreground">Snapshots will appear here after the timer runs.</div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
