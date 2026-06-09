'use client';

import { useState } from 'react';
import { Code2 } from 'lucide-react';
import { WorkflowUiRenderer, type WorkflowUiRenderType } from '@/components/workflows-ui/workflow-ui-renderer';
import { type DisplayNodeViewProps, EmptyDisplay, readString } from './utils';

export function CodeRenderView({ data }: DisplayNodeViewProps) {
  const [error, setError] = useState<string | null>(null);
  const renderType: WorkflowUiRenderType = readString(data.renderType) === 'html' ? 'html' : 'react';
  const code = readString(data.code);

  if (!code.trim()) {
    return <EmptyDisplay icon={<Code2 className="h-5 w-5" />} text="No code" />;
  }

  return (
    <div className="nodrag nopan relative h-full w-full overflow-hidden rounded-lg bg-background">
      {error ? (
        <div className="absolute inset-x-1 top-1 z-10 max-h-16 overflow-auto rounded border border-destructive/30 bg-background/95 px-2 py-1 text-[10px] font-mono text-destructive shadow-sm">
          {error}
        </div>
      ) : null}
      <WorkflowUiRenderer
        type={renderType}
        sourceCode={code}
        onError={setError}
        componentProps={{ data }}
        className={error ? 'pt-12' : undefined}
      />
    </div>
  );
}
