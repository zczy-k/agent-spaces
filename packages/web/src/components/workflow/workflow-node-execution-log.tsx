'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Copy,
  Info,
  Loader2,
  X,
} from 'lucide-react';
import {
  LOOP_BODY_NODE_TYPE,
  LOOP_NODE_TYPE,
  type ExecutionStep,
  type OutputField,
} from '@agent-spaces/shared';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NodeMediaPreview, type MediaItem } from '@/components/ui/media-gallery';
import { JsonViewer } from '@/components/viewers/json-viewer';
import { cn } from '@/lib/utils';
import { formatDuration, type WorkflowLogPanelLayout } from './workflow-node-types';

const LOG_SECTION_SCROLL_CLASS = 'nodrag nopan nowheel max-h-[calc(260px/3)] overscroll-contain overflow-auto';

function CopyButton({ data }: { data: unknown }) {
  const [copied, setCopied] = React.useState(false);
  const handleClick = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(JSON.stringify(data, null, 2)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [data]);
  return (
    <button
      type="button"
      className="p-0.5 rounded hover:bg-muted/50 transition-colors"
      onClick={handleClick}
    >
      {copied
        ? <CheckCheck className="h-2.5 w-2.5 text-green-500" />
        : <Copy className="h-2.5 w-2.5" />}
    </button>
  );
}
const LOG_TAB_SECTION_SCROLL_CLASS = 'nodrag nopan nowheel max-h-[110px] overscroll-contain overflow-auto';
const LOG_TAB_PANEL_SCROLL_CLASS = 'nodrag nopan nowheel max-h-[220px] overscroll-contain overflow-auto';

interface WorkflowNodeExecutionLogProps {
  nodeId: string;
  executionStep: ExecutionStep;
  executionSteps?: ExecutionStep[];
  nodeType?: string;
  outputs: OutputField[];
  nodeWidth: number;
  layout: WorkflowLogPanelLayout;
  isLogExpanded: boolean;
  onToggleLog: () => void;
}

export function WorkflowNodeExecutionLog({
  nodeId,
  executionStep,
  executionSteps,
  nodeType,
  outputs,
  nodeWidth,
  layout,
  isLogExpanded,
  onToggleLog,
}: WorkflowNodeExecutionLogProps) {
  const t = useTranslations('workflows');
  const batchSteps = React.useMemo(() => {
    if (nodeType !== LOOP_NODE_TYPE && nodeType !== LOOP_BODY_NODE_TYPE) return [executionStep];
    return Array.isArray(executionSteps) && executionSteps.length > 0
      ? executionSteps
      : [executionStep];
  }, [executionStep, executionSteps, nodeType]);
  const [selectedBatchIndex, setSelectedBatchIndex] = React.useState(() => Math.max(0, batchSteps.length - 1));
  React.useEffect(() => {
    setSelectedBatchIndex(Math.max(0, batchSteps.length - 1));
  }, [batchSteps.length]);
  const selectedExecutionStep = batchSteps[selectedBatchIndex] || executionStep;
  const shouldShowBatchTabs = batchSteps.length > 1;
  const handleClick = React.useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    window.dispatchEvent(new CustomEvent('workflow:select-node', { detail: { nodeId } }));
  }, [nodeId]);
  const stopWheel = React.useCallback((event: React.WheelEvent) => {
    event.stopPropagation();
  }, []);

  const isFileObj = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === 'object' && !Array.isArray(v) && 'httpPath' in (v as Record<string, unknown>)

  const toSrc = React.useCallback((v: unknown): string => {
    if (typeof v === 'string') return v
    if (isFileObj(v)) return v.httpPath as string
    return ''
  }, [])

  const extractMediaFromObj = React.useCallback((obj: Record<string, unknown>): MediaItem[] => {
    const items: MediaItem[] = []
    for (const [key, val] of Object.entries(obj)) {
      if (val == null) continue
      // Single file object
      if (isFileObj(val)) {
        items.push({ src: val.httpPath as string, type: 'image', alt: key })
        continue
      }
      // Array of file objects
      if (Array.isArray(val) && val.length > 0 && isFileObj(val[0])) {
        for (const item of val) {
          if (isFileObj(item)) items.push({ src: item.httpPath as string, type: 'image', alt: key })
        }
      }
    }
    return items
  }, [])

  const { inputMediaItems, outputMediaItems } = React.useMemo(() => {
    const inputMedia: MediaItem[] = []
    const outputMedia: MediaItem[] = []

    // Extract from input
    const input = selectedExecutionStep.input as Record<string, unknown> | null
    if (input && typeof input === 'object') {
      inputMedia.push(...extractMediaFromObj(input))
    }

    // Extract from output via schema
    if (selectedExecutionStep.status === 'completed' && selectedExecutionStep.output) {
      const output = selectedExecutionStep.output as Record<string, unknown>
      if (output && typeof output === 'object') {
        const extractMedia = (fields: OutputField[], parent: Record<string, unknown>) => {
          for (const field of fields) {
            const val = parent[field.key]
            if (val == null) continue
            if (field.type === 'image') {
              const src = toSrc(val) || (typeof val === 'string' ? val : '')
              if (src) outputMedia.push({ src, type: 'image', alt: field.key })
            } else if (field.type === 'image[]') {
              const urls = Array.isArray(val) ? val : []
              for (const u of urls) {
                const src = toSrc(u) || (typeof u === 'string' ? u : '')
                if (src) outputMedia.push({ src, type: 'image', alt: field.key })
              }
            } else if (field.type === 'audio') {
              const src = typeof val === 'string' ? val : ''
              if (src) outputMedia.push({ src, type: 'video', alt: field.key })
            } else if (field.type === 'video') {
              const src = typeof val === 'string' ? val : ''
              if (src) outputMedia.push({ src, type: 'video', alt: field.key })
            } else if (field.type === 'object' && field.children && val && typeof val === 'object') {
              extractMedia(field.children, val as Record<string, unknown>)
            }
          }
        }
        extractMedia(outputs, output)

        // Fallback: scan output for file arrays not covered by schema
        const schemaKeys = new Set(outputs.map(f => f.key))
        for (const [key, val] of Object.entries(output)) {
          if (schemaKeys.has(key) || !Array.isArray(val) || val.length === 0) continue
          const firstSrc = toSrc(val[0])
          if (firstSrc) {
            for (const item of val) {
              const s = toSrc(item)
              if (s) outputMedia.push({ src: s, type: 'image', alt: key })
            }
          }
        }
      }
    }

    return { inputMediaItems: inputMedia, outputMediaItems: outputMedia }
  }, [selectedExecutionStep, outputs, extractMediaFromObj, toSrc])

  const renderOutputSection = (step: ExecutionStep, className: string, extraClassName?: string) => (
    <div
      className={cn(className, extraClassName)}
      onWheelCapture={stopWheel}
    >
      <div className="flex items-center px-2 py-0.5 text-[9px] font-medium text-muted-foreground/70 uppercase tracking-wider">
        <span className="flex-1">{t('execution.output')}</span>
        {step.output != null && <CopyButton data={step.output} />}
      </div>
      {step.output != null ? (
        <JsonViewer
          data={step.output as Parameters<typeof JsonViewer>[0]['data']}
          className="border-0 shadow-none rounded-none text-[10px]"
          defaultExpanded={2}
          mini
        />
      ) : (
        <div className="px-2 pb-1 text-[10px] text-muted-foreground">{t('execution.noOutput')}</div>
      )}
    </div>
  );

  const filterInputDisplay = React.useCallback((input: unknown): unknown => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return input
    const { sourceHandle: _sourceHandle, sourceNodeId: _sourceNodeId, ...rest } = input as Record<string, unknown>
    return rest
  }, [])

  const renderInputSection = (step: ExecutionStep, className: string, extraClassName?: string) => (
    <div
      className={cn(className, extraClassName)}
      onWheelCapture={stopWheel}
    >
      <div className="flex items-center px-2 py-0.5 text-[9px] font-medium text-muted-foreground/70 uppercase tracking-wider">
        <span className="flex-1">{t('execution.input')}</span>
        {step.input != null && <CopyButton data={filterInputDisplay(step.input)} />}
      </div>
      {step.input != null ? (
        <JsonViewer
          data={filterInputDisplay(step.input) as Parameters<typeof JsonViewer>[0]['data']}
          className="border-0 shadow-none rounded-none text-[10px]"
          defaultExpanded={2}
          mini
        />
      ) : (
        <div className="px-2 pb-1 text-[10px] text-muted-foreground">{t('execution.noInput')}</div>
      )}
    </div>
  );

  const renderLogsSection = (step: ExecutionStep, className: string, extraClassName?: string) => (
    <div
      className={cn(className, extraClassName)}
      onWheelCapture={stopWheel}
    >
      <div className="px-2 py-0.5 text-[9px] font-medium text-muted-foreground/70 uppercase tracking-wider">{t('execution.logs')}</div>
      {step.logs?.length ? (
        <div className="px-1.5 pb-1 space-y-px">
          {step.logs.map((entry, logIndex) => (
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

  const renderStepContent = (step: ExecutionStep) => (
    layout === 'tabs' ? (
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
          {renderInputSection(step, LOG_TAB_SECTION_SCROLL_CLASS, 'border-b border-border')}
          {renderOutputSection(step, LOG_TAB_SECTION_SCROLL_CLASS)}
        </TabsContent>
        <TabsContent value="logs" className="m-0">
          {renderLogsSection(step, LOG_TAB_PANEL_SCROLL_CLASS)}
        </TabsContent>
      </Tabs>
    ) : (
      <>
        {renderInputSection(step, LOG_SECTION_SCROLL_CLASS, 'border-b border-border')}
        {renderOutputSection(step, LOG_SECTION_SCROLL_CLASS, 'border-b border-border')}
        {renderLogsSection(step, LOG_SECTION_SCROLL_CLASS)}
      </>
    )
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
        {selectedExecutionStep.status === 'running'
          ? <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
          : selectedExecutionStep.status === 'error'
            ? <X className="h-3 w-3 text-red-500" />
            : <Check className="h-3 w-3 text-green-500" />}
        <span className="flex-1 truncate text-muted-foreground">
          {selectedExecutionStep.status === 'error' ? selectedExecutionStep.error?.slice(0, 60) || t('nodeUi.executionResult') : t('nodeUi.executionResult')}
        </span>
        <span className="text-muted-foreground/70">
          {selectedExecutionStep.finishedAt ? formatDuration(selectedExecutionStep.startedAt, selectedExecutionStep.finishedAt) : '...'}
        </span>
        {isLogExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {isLogExpanded && (
        <div className="nodrag nopan nowheel rounded-b-md border border-t-0 border-border bg-background">
          {/* Error */}
          {selectedExecutionStep.error && (
            <div className="px-2 py-1.5 text-[10px] text-red-500 bg-red-500/10 border-b border-border flex items-start gap-1">
              <AlertCircle className="h-2.5 w-2.5 shrink-0 mt-0.5" />
              <span className="break-all">{selectedExecutionStep.error}</span>
            </div>
          )}

          {shouldShowBatchTabs ? (
            <Tabs
              value={String(selectedBatchIndex)}
              onValueChange={value => setSelectedBatchIndex(Number(value))}
              className="flex-col gap-0"
            >
              <TabsList
                variant="line"
                className="mx-2 h-7 w-[calc(100%-1rem)] justify-start gap-1 overflow-x-auto p-0"
              >
                {batchSteps.map((step, index) => (
                  <TabsTrigger
                    key={`${step.startedAt}-${index}`}
                    value={String(index)}
                    className="h-7 flex-none px-2 text-[10px]"
                  >
                    {index + 1}
                  </TabsTrigger>
                ))}
              </TabsList>
              {batchSteps.map((step, index) => (
                <TabsContent key={`${step.startedAt}-${index}`} value={String(index)} className="m-0">
                  {renderStepContent(step)}
                </TabsContent>
              ))}
            </Tabs>
          ) : (
            renderStepContent(selectedExecutionStep)
          )}
        </div>
      )}

      {/* Resource preview */}
      {inputMediaItems.length > 0 && (
        <div className="border-t border-border/50">
          <div className="px-2 py-0.5 text-[9px] font-medium text-muted-foreground/70 uppercase tracking-wider">{t('execution.input')}</div>
          <NodeMediaPreview items={inputMediaItems} />
        </div>
      )}
      {outputMediaItems.length > 0 && (
        <div className="border-t border-border/50">
          <div className="px-2 py-0.5 text-[9px] font-medium text-muted-foreground/70 uppercase tracking-wider">{t('execution.output')}</div>
          <NodeMediaPreview items={outputMediaItems} />
        </div>
      )}
    </div>
  );
}
