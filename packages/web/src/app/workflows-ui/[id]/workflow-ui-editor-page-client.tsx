"use client";

import { useParams } from 'next/navigation';
import { WorkflowUiEditor } from '@/components/workflows-ui/workflow-ui-editor';

export default function WorkflowUiEditorPageClient() {
  const params = useParams<{ id: string }>();
  return <WorkflowUiEditor projectId={params.id} />;
}
