'use client';

interface LoopBodyViewProps {
  nodeId: string;
  data: Record<string, unknown>;
}

export function LoopBodyView({ data }: LoopBodyViewProps) {
  const outputLabel = typeof data.outputLabel === 'string' ? data.outputLabel : '';

  return (
    <div
      className="flex h-full min-h-[220px] w-full flex-col rounded-lg"
    >
      <div className="flex items-center justify-between gap-3 rounded-t-md border-b border-cyan-700/15 bg-white/65 px-3 py-2 backdrop-blur-sm dark:bg-slate-950/35">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[13px] font-semibold text-cyan-900 dark:text-cyan-100">循环体</span>
        </div>
        {outputLabel ? (
          <span className="shrink-0 text-[11px] text-cyan-900/85 dark:text-cyan-100/80">
            输出: {outputLabel}
          </span>
        ) : null}
      </div>
    </div>
  );
}
