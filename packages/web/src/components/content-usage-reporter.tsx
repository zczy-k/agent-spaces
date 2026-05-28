'use client';

import { useEffect, useState } from 'react';
import { BarChart3, Eraser } from 'lucide-react';
import { useCommandPalette } from '@/stores/command-palette';
import {
  captureContentUsageSnapshot,
  useContentUsageReportStore,
} from '@/stores/content-usage-report';
import { ContentUsageReportDialog } from '@/components/content-usage-report-dialog';

const CONTENT_USAGE_REPORT_INTERVAL_MS = 5 * 60 * 1000;

type WindowWithGc = Window & {
  gc?: () => void;
};

export function ContentUsageReporter() {
  const reports = useContentUsageReportStore((state) => state.reports);
  const append = useContentUsageReportStore((state) => state.append);
  const clear = useContentUsageReportStore((state) => state.clear);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const capture = () => {
      const report = captureContentUsageSnapshot();
      append(report);
      console.info('[content-usage-report]', ...reportToConsoleLines(report));
    };

    capture();
    const timer = window.setInterval(capture, CONTENT_USAGE_REPORT_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [append]);

  useEffect(() => {
    const unregister = useCommandPalette.getState().registerMany([
      {
        id: 'content-usage-report:open',
        label: 'Open content usage report',
        group: 'Diagnostics',
        icon: BarChart3,
        action: () => setOpen(true),
      },
      {
        id: 'content-usage-report:capture',
        label: 'Capture content usage snapshot',
        group: 'Diagnostics',
        icon: BarChart3,
        action: () => {
          const report = captureContentUsageSnapshot();
          append(report);
          console.info('[content-usage-report]', ...reportToConsoleLines(report));
          setOpen(true);
        },
      },
      {
        id: 'content-usage-report:attempt-gc',
        label: 'Attempt browser GC',
        group: 'Diagnostics',
        icon: Eraser,
        action: () => {
          attemptBrowserGc();
          window.setTimeout(() => {
            const report = captureContentUsageSnapshot();
            append(report);
            console.info('[content-usage-report]', ...reportToConsoleLines(report));
          }, 250);
        },
      },
    ]);

    return unregister;
  }, [append]);

  return (
    <ContentUsageReportDialog
      open={open}
      onOpenChange={setOpen}
      reports={reports}
      onCaptureNow={() => {
        const report = captureContentUsageSnapshot();
        append(report);
        console.info('[content-usage-report]', ...reportToConsoleLines(report));
      }}
      onClear={clear}
      onAttemptGc={() => {
        attemptBrowserGc();
        window.setTimeout(() => {
          const report = captureContentUsageSnapshot();
          append(report);
          console.info('[content-usage-report]', ...reportToConsoleLines(report));
        }, 250);
      }}
    />
  );
}

function attemptBrowserGc(): boolean {
  const gc = (window as WindowWithGc).gc;
  if (typeof gc !== 'function') {
    console.info('[content-usage-report] browser GC is unavailable; start Chrome with --js-flags=--expose-gc for diagnostics');
    return false;
  }

  gc();
  console.info('[content-usage-report] browser GC requested');
  return true;
}

function reportToConsoleLines(report: ReturnType<typeof captureContentUsageSnapshot>): string[] {
  const lines = [
    `${report.capturedAt} ${report.route}`,
    `heap=${report.jsHeap ? `${report.jsHeap.used}/${report.jsHeap.total}/${report.jsHeap.limit}` : 'n/a'}`,
    `editor=${report.counts.openFiles} files ${report.counts.openFileBytes} bytes`,
    `terminal=${report.counts.terminalSessions}/${report.counts.terminalRegistrySessions} output=${report.counts.terminalOutputBytes} bytes details=${report.terminalDetails.map((session) => `${session.sessionId.slice(0, 8)}:${session.outputBytes}/${session.bufferLines}`).join(',') || 'none'}`,
    `messages=${report.counts.channelMessages} (${report.counts.channelMessageBytes} bytes) logs=${report.counts.activityLogEntries} (${report.counts.activityLogBytes} bytes)`,
  ];
  return lines;
}
