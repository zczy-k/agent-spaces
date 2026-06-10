'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { WorkflowTemplate, WorkflowNode } from '@agent-spaces/shared';
import { useWorkflowStore } from '@/stores/workflow';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Plus, Upload, FileText, Search, Filter, ArrowUpDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { WorkflowTemplatesDialog } from '@/components/workflows/workflow-templates-dialog';
import { WorkflowListDialog } from '@/components/workflow/workflow-list-dialog';
import { WorkflowInfoDialog } from '@/components/workflow/workflow-info-dialog';
import { WorkflowCard } from '@/components/workflows/workflow-card';
import type { WorkflowTemplatePreset } from '@/components/workflows/workflow-templates';
import { sdk } from '@/lib/sdk';
import { workflowApi } from '@/lib/workflow-api';
import { nativeNavigate } from '@/lib/navigate';
import type { AgentConfig } from '@agent-spaces/shared';

export function WorkflowsPage() {
  const t = useTranslations('workflows');
  const router = useRouter();
  const { workflows, loadWorkflows, deleteWorkflow, duplicateWorkflow, upsertWorkflow } = useWorkflowStore();
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [listDialogOpen, setListDialogOpen] = useState(false);
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortField, setSortField] = useState<'createdAt' | 'updatedAt'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    workflows.forEach(wf => wf.tags?.forEach(t => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [workflows]);

  const filteredWorkflows = useMemo(() => {
    return workflows.filter(wf => {
      const matchesSearch = !search || wf.name.toLowerCase().includes(search.toLowerCase()) || wf.description?.toLowerCase().includes(search.toLowerCase());
      const matchesTags = selectedTags.length === 0 || selectedTags.some(tag => wf.tags?.includes(tag));
      return matchesSearch && matchesTags;
    }).sort((a, b) => {
      const diff = a[sortField] - b[sortField];
      return sortOrder === 'asc' ? diff : -diff;
    });
  }, [workflows, search, selectedTags, sortField, sortOrder]);

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
      name: t('defaultWorkflow.name'),
      nodes: [
        { id: `node_${Date.now()}_start`, type: 'start', label: t('defaultWorkflow.startLabel'), position: { x: 250, y: 50 }, data: {} },
        { id: `node_${Date.now()}_end`, type: 'end', label: t('defaultWorkflow.endLabel'), position: { x: 250, y: 400 }, data: {} },
      ],
      edges: [],
    });
    upsertWorkflow(created);
    nativeNavigate(router, `/workflows/${created.id}`);
    setListDialogOpen(false);
  }, [upsertWorkflow, router, t]);

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="hidden md:flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">{t('page.title')}</h2>
          <p className="text-sm text-muted-foreground">
            {t('page.subtitle')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setTemplatesOpen(true)}>
            <FileText className="h-4 w-4 mr-1" /> {t('page.templates')}
          </Button>
          <Button variant="outline" onClick={handleImport}>
            <Upload className="h-4 w-4 mr-1" /> {t('page.import')}
          </Button>
          <Button onClick={() => setInfoDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> {t('page.create')}
          </Button>
        </div>
      </div>

      <div className="hidden md:flex items-center gap-2 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder={t('page.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <Popover>
          <PopoverTrigger className="inline-flex items-center justify-center gap-1.5 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 rounded-md px-3 text-sm font-medium cursor-pointer">
            <ArrowUpDown className="h-3.5 w-3.5" />
            {t(`page.${sortField}`)}
            <span className="text-muted-foreground text-xs">{sortOrder === 'asc' ? '↑' : '↓'}</span>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-48 p-2">
            <div className="flex flex-col gap-1">
              <button
                className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-muted text-left cursor-pointer ${sortField === 'createdAt' ? 'font-medium' : ''}`}
                onClick={() => setSortField('createdAt')}
              >
                {sortField === 'createdAt' && <span className="text-primary">✓</span>}
                {t('page.createdAt')}
              </button>
              <button
                className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-muted text-left cursor-pointer ${sortField === 'updatedAt' ? 'font-medium' : ''}`}
                onClick={() => setSortField('updatedAt')}
              >
                {sortField === 'updatedAt' && <span className="text-primary">✓</span>}
                {t('page.updatedAt')}
              </button>
              <div className="border-t my-1" />
              <button
                className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-muted text-left cursor-pointer ${sortOrder === 'asc' ? 'font-medium' : ''}`}
                onClick={() => setSortOrder('asc')}
              >
                {sortOrder === 'asc' && <span className="text-primary">✓</span>}
                {t('page.asc')}
              </button>
              <button
                className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-muted text-left cursor-pointer ${sortOrder === 'desc' ? 'font-medium' : ''}`}
                onClick={() => setSortOrder('desc')}
              >
                {sortOrder === 'desc' && <span className="text-primary">✓</span>}
                {t('page.desc')}
              </button>
            </div>
          </PopoverContent>
        </Popover>
        {allTags.length > 0 && (
          <Popover>
            <PopoverTrigger className="inline-flex items-center justify-center gap-1.5 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 rounded-md px-3 text-sm font-medium cursor-pointer">
              <Filter className="h-3.5 w-3.5" />
              {t('page.tags')}
              {selectedTags.length > 0 && (
                <Badge variant="secondary" className="h-4 px-1 text-[10px]">{selectedTags.length}</Badge>
              )}
            </PopoverTrigger>
            <PopoverContent align="start" className="w-48 p-2">
              <div className="flex flex-col gap-1">
                {allTags.map(tag => {
                  const selected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      className="flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-muted text-left cursor-pointer"
                      onClick={() => setSelectedTags(prev => selected ? prev.filter(x => x !== tag) : [...prev, tag])}
                    >
                      <span className={`h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0 ${selected ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/30'}`}>
                        {selected && <span className="text-[10px]">✓</span>}
                      </span>
                      {tag}
                    </button>
                  );
                })}
              </div>
              {selectedTags.length > 0 && (
                <button
                  className="text-xs text-muted-foreground hover:text-foreground mt-1 pt-1 border-t cursor-pointer w-full text-left px-2 py-1"
                  onClick={() => setSelectedTags([])}
                >
                  {t('page.clearFilter')}
                </button>
              )}
            </PopoverContent>
          </Popover>
        )}
        {selectedTags.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {selectedTags.map(tag => (
              <Badge key={tag} variant="secondary" className="gap-1 text-xs cursor-pointer" onClick={() => setSelectedTags(prev => prev.filter(x => x !== tag))}>
                {tag}
                <span className="text-[10px]">✕</span>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {workflows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <p className="text-sm mb-2">{t('page.empty')}</p>
          <Button variant="outline" onClick={handleListCreate}>
            <Plus className="h-4 w-4 mr-1" /> {t('page.createFirst')}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredWorkflows.map((workflow) => (
            <WorkflowCard
              key={workflow.id}
              workflow={workflow}
              onDuplicate={handleDuplicate}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <WorkflowTemplatesDialog
        open={templatesOpen}
        onOpenChange={setTemplatesOpen}
        onImport={handleImportTemplate}
      />

      <WorkflowInfoDialog
        open={infoDialogOpen}
        onOpenChange={setInfoDialogOpen}
        workflow={null}
        onSave={async (updates) => {
          const created = await workflowApi.create({
            name: updates.name || t('defaultWorkflow.name'),
            description: updates.description,
            icon: updates.icon,
            tags: updates.tags,
            nodes: [
              { id: `node_${Date.now()}_start`, type: 'start', label: t('defaultWorkflow.startLabel'), position: { x: 250, y: 50 }, data: {} },
              { id: `node_${Date.now()}_end`, type: 'end', label: t('defaultWorkflow.endLabel'), position: { x: 250, y: 400 }, data: {} },
            ],
            edges: [],
          });
          upsertWorkflow(created);
          nativeNavigate(router, `/workflows/${created.id}`);
        }}
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
