'use client';

import { useEffect, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import type { WorkflowTemplate } from '@agent-spaces/shared';
import { useWorkflowStore } from '@/stores/workflow';
import { WorkflowMiniPreview } from './workflow-mini-preview';
import { WorkflowEditor } from './workflow-editor';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Plus, Pencil, Copy, Trash2 } from 'lucide-react';

export function WorkflowList({ workspaceId }: { workspaceId: string }) {
  const { workflows, loadWorkflows, deleteWorkflow, duplicateWorkflow } = useWorkflowStore();
  const [editingWorkflow, setEditingWorkflow] = useState<WorkflowTemplate | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);

  useEffect(() => {
    if (workspaceId) loadWorkflows(workspaceId);
  }, [workspaceId, loadWorkflows]);

  if (editingWorkflow || creatingNew) {
    return (
      <WorkflowEditor
        workspaceId={workspaceId}
        template={editingWorkflow}
        onBack={() => {
          setEditingWorkflow(null);
          setCreatingNew(false);
        }}
      />
    );
  }

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">Workflow Templates</h2>
          <p className="text-sm text-muted-foreground">
            Create reusable agent team workflows for issue automation
          </p>
        </div>
        <Button onClick={() => setCreatingNew(true)}>
          <Plus className="h-4 w-4 mr-1" /> New Workflow
        </Button>
      </div>

      {workflows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <p className="text-sm mb-2">No workflow templates yet</p>
          <Button variant="outline" onClick={() => setCreatingNew(true)}>
            <Plus className="h-4 w-4 mr-1" /> Create your first workflow
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workflows.map((workflow) => (
            <Card key={workflow.id} className="overflow-hidden hover:shadow-md transition-shadow">
              <ReactFlowProvider>
                <WorkflowMiniPreview template={workflow} />
              </ReactFlowProvider>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{workflow.name}</CardTitle>
                {workflow.description && (
                  <CardDescription className="text-xs">{workflow.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {workflow.nodes.length} agent{workflow.nodes.length !== 1 ? 's' : ''}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setEditingWorkflow(workflow)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => duplicateWorkflow(workspaceId, workflow.id)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => deleteWorkflow(workspaceId, workflow.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
