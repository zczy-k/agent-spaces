'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { WorkflowTemplate, WorkflowNode } from '@agent-spaces/shared';
import { useWorkflowStore } from '@/stores/workflow';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Plus, Pencil, Copy, Trash2, Upload, FileText, MoreVertical } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
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
            <Card key={workflow.id} className="group overflow-hidden hover:shadow-md transition-shadow cursor-pointer relative" onClick={() => nativeNavigate(router, `/workflows/${workflow.id}`)}>
              <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <MoreVertical className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => nativeNavigate(router, `/workflows/${workflow.id}`)}>
                      <Pencil className="h-3.5 w-3.5 mr-2" /> 编辑
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDuplicate(workflow)}>
                      <Copy className="h-3.5 w-3.5 mr-2" /> 复制
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDelete(workflow)}>
                      <Trash2 className="h-3.5 w-3.5 mr-2" /> 删除
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  {workflow.icon ? (
                    <span className="text-xl leading-none">{workflow.icon}</span>
                  ) : (
                    <span className="w-6 h-6 rounded bg-primary/10 text-xs font-bold flex items-center justify-center text-primary shrink-0">
                      {(workflow.name || '未').charAt(0).toUpperCase()}
                    </span>
                  )}
                  <CardTitle className="text-sm truncate">{workflow.name}</CardTitle>
                </div>
                {workflow.description && (
                  <CardDescription className="text-xs line-clamp-2">{workflow.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {workflow.nodes.length} 个节点
                  </span>
                  {workflow.tags && workflow.tags.length > 0 && (
                    <div className="flex gap-1">
                      {workflow.tags.slice(0, 2).map(tag => (
                        <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{tag}</span>
                      ))}
                      {workflow.tags.length > 2 && (
                        <span className="text-[10px] text-muted-foreground">+{workflow.tags.length - 2}</span>
                      )}
                    </div>
                  )}
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
