'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { sdk } from '@/lib/sdk';
import type { WorkflowUiProject } from '@agent-spaces/sdk';
import { WorkflowUiPreview } from '@/components/workflows-ui/workflow-ui-preview';
import { useWorkflowUiHostApi } from '@/components/workflows-ui/use-workflow-ui-host-api';
import { Loader2 } from 'lucide-react';

export default function WorkflowUiPreviewPageClient() {
  const params = useParams<{ id: string }>();
  const [project, setProject] = useState<WorkflowUiProject | null>(null);
  const [sourceCode, setSourceCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useWorkflowUiHostApi(params.id);

  const loadProject = useCallback(async () => {
    try {
      const p = await sdk.workflowUi.get(params.id);
      setProject(p);
      const files = await sdk.workflowUi.getFileTree(params.id);
      const mainFile = files.find(f => f === p.mainFile) ?? files[0];
      if (mainFile) {
        const { content } = await sdk.workflowUi.readFile(params.id, mainFile);
        setSourceCode(content);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load project');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => { loadProject(); }, [loadProject]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) {
    return <div className="flex items-center justify-center h-screen text-muted-foreground">Project not found</div>;
  }

  return (
    <div className="h-screen flex flex-col">
      <div className="px-4 py-2 border-b flex items-center gap-2">
        <span className="text-sm font-medium">{project.name}</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
          {project.type === 'react' ? 'React' : 'HTML'}
        </span>
      </div>
      <div className="flex-1">
        <WorkflowUiPreview type={project.type} sourceCode={sourceCode} error={error} onError={setError} />
      </div>
    </div>
  );
}
