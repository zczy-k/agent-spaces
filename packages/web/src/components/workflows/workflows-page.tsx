'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { WorkflowTemplate, WorkflowNode } from '@agent-spaces/shared';
import { useWorkflowStore } from '@/stores/workflow';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Plus, Pencil, Copy, Trash2, Upload, FileText } from 'lucide-react';
import { WorkflowTemplatesDialog } from '@/components/workflows/workflow-templates-dialog';
import { WorkflowListDialog } from '@/components/workflow/workflow-list-dialog';
import type { WorkflowTemplatePreset } from '@/components/workflows/workflow-templates';
import { sdk } from '@/lib/sdk';
import { workflowApi } from '@/lib/workflow-api';
import { nativeNavigate } from '@/lib/navigate';
import type { AgentConfig } from '@agent-spaces/shared';

export function WorkflowsPage() {
  const router = useRouter();
  const { workflows, loadWorkflows, deleteWorkflow, duplicateWorkflow, upsertWorkflow } = useWorkflowStore();
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [listDialogOpen, setListDialogOpen] = useState(false);

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
            try {
              const created = await sdk.agent.createPreset(createBody);
              idMap[oldId] = created.id;
            } catch { /* ignore */ }
          }
        }

        const remappedNodes = nodes.map((n) => ({
          ...n,
          data: {
            ...n.data,
            agentConfigId: idMap[n.data.agentConfigId] ?? n.data.agentConfigId,
          },
        }));

        await sdk.workflow.create({ name: name ?? 'Imported Workflow', description, nodes: remappedNodes, edges } as any);
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

      // 获取已有 agent，按 templateId 去重
      const existingAgents = await sdk.agent.listPresets();
      const byTemplateId = new Map<string, string>();
      for (const agent of existingAgents) {
        if (agent.templateId) {
          byTemplateId.set(agent.templateId, agent.id);
        }
      }

      if (agents) {
        for (const [oldId, agentConfig] of Object.entries(agents)) {
          // 已有同 templateId 的 agent 则复用，不重复创建
          if (agentConfig.templateId && byTemplateId.has(agentConfig.templateId)) {
            idMap[oldId] = byTemplateId.get(agentConfig.templateId)!;
            continue;
          }
          const { id: _oldId, enabled: _en, ...createBody } = agentConfig;
          try {
            const created = await sdk.agent.createPreset(createBody);
            idMap[oldId] = created.id;
          } catch { /* ignore */ }
        }
      }

      const remappedNodes = nodes.map((n) => ({
        ...n,
        data: {
          ...n.data,
          agentConfigId: idMap[n.data.agentConfigId as string] ?? n.data.agentConfigId,
        },
      }));

      await sdk.workflow.create({ name, description, nodes: remappedNodes as unknown as WorkflowNode[], edges });
      loadWorkflows();
    },
    [loadWorkflows],
  );

  const handleListOpen = useCallback((wf: WorkflowTemplate) => {
    nativeNavigate(router, `/workflows/${wf.id}`);
    setListDialogOpen(false);
  }, [router]);

  const handleListCreate = useCallback(async () => {
    const created = await workflowApi.create({
      name: '新工作流',
      nodes: [
        { id: `node_${Date.now()}_start`, type: 'start', label: '开始', position: { x: 250, y: 50 }, data: {} },
        { id: `node_${Date.now()}_end`, type: 'end', label: '结束', position: { x: 250, y: 400 }, data: {} },
      ],
      edges: [],
    });
    upsertWorkflow(created);
    nativeNavigate(router, `/workflows/${created.id}`);
    setListDialogOpen(false);
  }, [upsertWorkflow, router]);

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="hidden md:flex items-center justify-between mb-6">
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
          <Button onClick={() => setListDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> 新建工作流
          </Button>
        </div>
      </div>

      {workflows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <p className="text-sm mb-2">暂无工作流模板</p>
          <Button variant="outline" onClick={handleListCreate}>
            <Plus className="h-4 w-4 mr-1" /> 创建第一个工作流
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workflows.map((workflow) => (
            <Card key={workflow.id} className="overflow-hidden hover:shadow-md transition-shadow">
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
                      onClick={() => nativeNavigate(router, `/workflows/${workflow.id}`)}
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

      <WorkflowListDialog
        open={listDialogOpen}
        workflows={workflows}
        onSelect={handleListOpen}
        onCreate={handleListCreate}
        onClose={() => setListDialogOpen(false)}
      />
    </div>
  );
}
