import WorkflowEditorPageClient from "./workflow-editor-page-client";

export function generateStaticParams() {
  return [{ id: "_" }];
}

export default function WorkflowEditorPage() {
  return <WorkflowEditorPageClient />;
}
