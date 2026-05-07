'use client';

import { useEffect, useState, useCallback } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import type { WorkflowTemplate } from '@agent-spaces/shared';
import { useWorkflowStore } from '@/stores/workflow';
import { WorkflowMiniPreview } from '@/components/workflow/workflow-mini-preview';
import { WorkflowEditor } from '@/components/workflow/workflow-editor';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Plus, Pencil, Copy, Trash2, Upload, FileText } from 'lucide-react';
import { WorkflowTemplatesDialog } from '@/components/workflows/workflow-templates-dialog';
import type { WorkflowTemplatePreset } from '@/components/workflows/workflow-templates';
import { authHeaders } from '@/lib/auth';
import type { AgentConfig } from '@agent-spaces/shared';

export function WorkflowsPage() {
  const { workflows, loadWorkflows, deleteWorkflow, duplicateWorkflow } = useWorkflowStore();
  const [editingWorkflow, setEditingWorkflow] = useState<WorkflowTemplate | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  useEffect(() => {
    loadWorkflows();
  }, [loadWorkflows]);

  const handleDelete = useCallback(async (wf: WorkflowTemplate) => {
    await deleteWorkflow(wf.id);
  }, [deleteWorkflow]);

  const handleDuplicate = useCallback(async (wf: WorkflowTemplate) => {
    await duplicateWorkflow(wf.id);
  }, [duplicateWorkflow]);

  const handleImport = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const { name, description, nodes, edges, agents } = data as {
          name?: string;
          description?: string;
          nodes?: { id: string; type: string; position: { x: number; y: number }; data: { agentConfigId: string; [k: string]: unknown } }[];
          edges?: { id: string; source: string; target: string }[];
          agents?: Record<string, Omit<AgentConfig, 'apiKey'>>;
        };
        if (!nodes || !edges) return;

        const idMap: Record<string, string> = {};

        if (agents) {
          for (const [oldId, agentConfig] of Object.entries(agents)) {
            const { id: _oldId, enabled: _en, ...createBody } = agentConfig;
            const res = await fetch('/api/agents/presets', {
              method: 'POST',
              headers: { ...authHeaders(), 'Content-Type': 'application/json' },
              body: JSON.stringify(createBody),
            });
            if (res.ok) {
              const created: AgentConfig = await res.json();
              idMap[oldId] = created.id;
            }
          }
        }

        const remappedNodes = nodes.map((n) => ({
          ...n,
          data: {
            ...n.data,
            agentConfigId: idMap[n.data.agentConfigId] ?? n.data.agentConfigId,
          },
        }));

        await fetch('/api/workflows', {
          method: 'POST',
          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name ?? 'Imported Workflow', description, nodes: remappedNodes, edges }),
        });
        loadWorkflows();
      } catch {
        // invalid JSON or structure
      }
    };
    input.click();
  }, [loadWorkflows]);

  const handleImportTemplate = useCallback(
    async (templateData: WorkflowTemplatePreset['data']) => {
      const { name, description, nodes, edges, agents } = templateData;
      const idMap: Record<string, string> = {};

      if (agents) {
        for (const [oldId, agentConfig] of Object.entries(agents)) {
          const { id: _oldId, enabled: _en, ...createBody } = agentConfig;
          const res = await fetch('/api/agents/presets', {
            method: 'POST',
            headers: { ...authHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify(createBody),
          });
          if (res.ok) {
            const created: AgentConfig = await res.json();
            idMap[oldId] = created.id;
          }
        }
      }

      const remappedNodes = nodes.map((n) => ({
        ...n,
        data: {
          ...n.data,
          agentConfigId: idMap[n.data.agentConfigId as string] ?? n.data.agentConfigId,
        },
      }));

      await fetch('/api/workflows', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, nodes: remappedNodes, edges }),
      });
      loadWorkflows();
    },
    [loadWorkflows],
  );

  if (editingWorkflow || creatingNew) {
    return (
      <WorkflowEditor
        template={editingWorkflow}
        onBack={() => {
          setEditingWorkflow(null);
          setCreatingNew(false);
          loadWorkflows();
        }}
      />
    );
  }

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">工作流</h2>
          <p className="text-sm text-muted-foreground">
            管理 Workflow 模板
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setTemplatesOpen(true)}>
            <FileText className="h-4 w-4 mr-1" /> 模版
          </Button>
          <Button variant="outline" onClick={handleImport}>
            <Upload className="h-4 w-4 mr-1" /> 导入
          </Button>
          <Button onClick={() => setCreatingNew(true)}>
            <Plus className="h-4 w-4 mr-1" /> 新建工作流
          </Button>
        </div>
      </div>

      {workflows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <p className="text-sm mb-2">暂无工作流模板</p>
          <Button variant="outline" onClick={() => setCreatingNew(true)}>
            <Plus className="h-4 w-4 mr-1" /> 创建第一个工作流
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
                    {workflow.nodes.length} 个节点
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
                      onClick={() => handleDuplicate(workflow)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(workflow)}
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

      <WorkflowTemplatesDialog
        open={templatesOpen}
        onOpenChange={setTemplatesOpen}
        onImport={handleImportTemplate}
      />
    </div>
  );
}
