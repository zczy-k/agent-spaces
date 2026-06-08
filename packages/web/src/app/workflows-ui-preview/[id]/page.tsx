import WorkflowUiPreviewPageClient from './preview-page-client';

export function generateStaticParams() {
  return [{ id: '_' }];
}

export default function WorkflowUiPreviewPage() {
  return <WorkflowUiPreviewPageClient />;
}
