import WorkflowUiEditorPageClient from './workflow-ui-editor-page-client';

export function generateStaticParams() {
  return [{ id: '_' }];
}

export default function WorkflowUiEditorPage() {
  return <WorkflowUiEditorPageClient />;
}
