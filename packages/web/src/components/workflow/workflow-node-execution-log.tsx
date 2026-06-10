'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import {
  AlertCircle,
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Info,
  X,
} from 'lucide-react';
import type { ExecutionStep, OutputField } from '@agent-spaces/shared';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NodeMediaPreview, type MediaItem } from '@/components/ui/media-gallery';
import { JsonViewer } from '@/components/viewers/json-viewer';
import { cn } from '@/lib/utils';
import { formatDuration, type WorkflowLogPanelLayout } from './workflow-node-types';

const LOG_SECTION_SCROLL_CLASS = 'nodrag nopan nowheel max-h-[calc(260px/3)] overscroll-contain overflow-auto';
const LOG_TAB_SECTION_SCROLL_CLASS = 'nodrag nopan nowheel max-h-[110px] overscroll-contain overflow-auto';
const LOG_TAB_PANEL_SCROLL_CLASS = 'nodrag nopan nowheel max-h-[220px] overscroll-contain overflow-auto';

interface WorkflowNodeExecutionLogProps {
  nodeId: string;
  executionStep: ExecutionStep;
  outputs: OutputField[];
  nodeWidth: number;
  layout: WorkflowLogPanelLayout;
  isLogExpanded: boolean;
  onToggleLog: () => void;
}

export function WorkflowNodeExecutionLog({
  nodeId,
  executionStep,
  outputs,
  nodeWidth,
  layout,
  isLogExpanded,
  onToggleLog,
}: WorkflowNodeExecutionLogProps) {
  const t = useTranslations('workflows');
  const handleClick = React.useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    window.dispatchEvent(new CustomEvent('workflow:select-node', { detail: { nodeId } }));
  }, [nodeId]);
  const stopWheel = React.useCallback((event: React.WheelEvent) => {
    event.stopPropagation();
  }, []);

  const mediaItems = React.useMemo(() => {
    if (executionStep.status !== 'completed' || !executionStep.output) return []
    const output = executionStep.output as Record<string, unknown>
    if (!output || typeof output !== 'object') return []
    const items: MediaItem[] = []
    const extractMedia = (fields: OutputField[], parent: Record<string, unknown>) => {
      for (const field of fields) {
        const val = parent[field.key]
        if (val == null) continue
        if (field.type === 'image') {
          const src = typeof val === 'string' ? val : ''
          if (src) items.push({ src, type: 'image', alt: field.key })
        } else if (field.type === 'image[]') {
          const urls = Array.isArray(val) ? val : []
          for (const u of urls) {
            if (typeof u === 'string' && u) items.push({ src: u, type: 'image', alt: field.key })
          }
        } else if (field.type === 'audio') {
          const src = typeof val === 'string' ? val : ''
          if (src) items.push({ src, type: 'video', alt: field.key })
        } else if (field.type === 'video') {
          const src = typeof val === 'string' ? val : ''
          if (src) items.push({ src, type: 'video', alt: field.key })
        } else if (field.type === 'object' && field.children && val && typeof val === 'object') {
          extractMedia(field.children, val as Record<string, unknown>)
        }
      }
    }
    extractMedia(outputs, output)
    return items
  }, [executionStep, outputs])

  const renderOutputSection = (className: string, extraClassName?: string) => (
    <div
      className={cn(className, extraClassName)}
      onWheelCapture={stopWheel}
    >
      <div className="px-2 py-0.5 text-[9px] font-medium text-muted-foreground/70 uppercase tracking-wider">{t('execution.output')}</div>
      {executionStep.output != null ? (
        <JsonViewer
          data={executionStep.output as Parameters<typeof JsonViewer>[0]['data']}
          className="border-0 shadow-none rounded-none text-[10px]"
          defaultExpanded={2}
          mini
        />
      ) : (
        <div className="px-2 pb-1 text-[10px] text-muted-foreground">{t('execution.noOutput')}</div>
      )}
    </div>
  );

  const renderInputSection = (className: string, extraClassName?: string) => (
    <div
      className={cn(className, extraClassName)}
      onWheelCapture={stopWheel}
    >
      <div className="px-2 py-0.5 text-[9px] font-medium text-muted-foreground/70 uppercase tracking-wider">{t('execution.input')}</div>
      {executionStep.input != null ? (
        <JsonViewer
          data={executionStep.input as Parameters<typeof JsonViewer>[0]['data']}
          className="border-0 shadow-none rounded-none text-[10px]"
          defaultExpanded={2}
          mini
        />
      ) : (
        <div className="px-2 pb-1 text-[10px] text-muted-foreground">{t('execution.noInput')}</div>
      )}
    </div>
  );

  const renderLogsSection = (className: string, extraClassName?: string) => (
    <div
      className={cn(className, extraClassName)}
      onWheelCapture={stopWheel}
    >
      <div className="px-2 py-0.5 text-[9px] font-medium text-muted-foreground/70 uppercase tracking-wider">{t('execution.logs')}</div>
      {executionStep.logs?.length ? (
        <div className="px-1.5 pb-1 space-y-px">
          {executionStep.logs.map((entry, logIndex) => (
            <div
              key={`${entry.timestamp}-${logIndex}`}
              className={cn(
                'flex items-start gap-1 text-[10px] px-1.5 py-0.5 rounded',
                entry.level === 'info' && 'text-blue-600 dark:text-blue-400 bg-blue-500/10',
                entry.level === 'warning' && 'text-yellow-600 dark:text-yellow-400 bg-yellow-500/10',
                entry.level === 'error' && 'text-red-600 dark:text-red-400 bg-red-500/10',
              )}
            >
              {entry.level === 'info' ? <Info className="h-2.5 w-2.5 shrink-0 mt-0.5" /> :
                entry.level === 'warning' ? <AlertTriangle className="h-2.5 w-2.5 shrink-0 mt-0.5" /> :
                <AlertCircle className="h-2.5 w-2.5 shrink-0 mt-0.5" />}
              <span className="break-all">{entry.message}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-2 pb-1 text-[10px] text-muted-foreground">{t('execution.noLogsContent')}</div>
      )}
    </div>
  );

  return (
    <div
      className="nodrag nopan nowheel relative z-10 mt-1"
      style={{ width: nodeWidth }}
      onClick={handleClick}
    >
      <button
        type="button"
        className={cn(
          'flex items-center gap-1 rounded-t-md border border-border px-2 py-1 text-[10px] w-full text-left transition-colors',
          isLogExpanded ? 'bg-muted' : 'bg-background hover:bg-muted rounded-b-md',
        )}
        onClick={onToggleLog}
      >
        {executionStep.status === 'error'
          ? <X className="h-3 w-3 text-red-500" />
          : <Check className="h-3 w-3 text-green-500" />}
        <span className="flex-1 truncate text-muted-foreground">
          {executionStep.status === 'error' ? executionStep.error?.slice(0, 60) || t('nodeUi.executionResult') : t('nodeUi.executionResult')}
        </span>
        <span className="text-muted-foreground/70">
          {executionStep.finishedAt ? formatDuration(executionStep.startedAt, executionStep.finishedAt) : '...'}
        </span>
        {isLogExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {isLogExpanded && (
        <div className="nodrag nopan nowheel rounded-b-md border border-t-0 border-border bg-background">
          {/* Error */}
          {executionStep.error && (
            <div className="px-2 py-1.5 text-[10px] text-red-500 bg-red-500/10 border-b border-border flex items-start gap-1">
              <AlertCircle className="h-2.5 w-2.5 shrink-0 mt-0.5" />
              <span className="break-all">{executionStep.error}</span>
            </div>
          )}

          {layout === 'tabs' ? (
            <Tabs defaultValue="io" className="flex-col gap-0">
              <TabsList variant="line" className="mx-2 h-7 w-[calc(100%-1rem)] justify-start p-0">
                <TabsTrigger value="io" className="h-7 px-2 text-[10px]">
                  {t('execution.input')} / {t('execution.output')}
                </TabsTrigger>
                <TabsTrigger value="logs" className="h-7 px-2 text-[10px]">
                  {t('execution.logs')}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="io" className="m-0">
                {renderInputSection(LOG_TAB_SECTION_SCROLL_CLASS, 'border-b border-border')}
                {renderOutputSection(LOG_TAB_SECTION_SCROLL_CLASS)}
              </TabsContent>
              <TabsContent value="logs" className="m-0">
                {renderLogsSection(LOG_TAB_PANEL_SCROLL_CLASS)}
              </TabsContent>
            </Tabs>
          ) : (
            <>
              {renderOutputSection(LOG_SECTION_SCROLL_CLASS, 'border-b border-border')}
              {renderInputSection(LOG_SECTION_SCROLL_CLASS, 'border-b border-border')}
              {renderLogsSection(LOG_SECTION_SCROLL_CLASS)}
            </>
          )}
        </div>
      )}

      {/* Resource output preview */}
      {mediaItems.length > 0 && (
        <div className="border-t border-border/50">
          <NodeMediaPreview items={mediaItems} />
        </div>
      )}
    </div>
  );
}
