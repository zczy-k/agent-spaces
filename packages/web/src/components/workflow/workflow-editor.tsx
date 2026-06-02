'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  ReactFlowProvider,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type EdgeChange,
} from '@xyflow/react';
import type { WorkflowTemplate, WorkflowNode, WorkflowEdge, AgentConfig } from '@agent-spaces/shared';

import { useWorkflowStore } from '@/stores/workflow';
import { WorkflowCanvas, getAutoLayoutedNodes } from './workflow-canvas';
import { WorkflowAgentPalette } from './workflow-agent-palette';
import { WorkflowToolbar } from './workflow-toolbar';
import { WorkflowCommandEditDialog } from './workflow-command-edit-dialog';
import { Input } from '@/components/ui/input';
import { ArrowLeft } from 'lucide-react';
import { authHeaders } from '@/lib/auth';

// XYFlow node data shapes for legacy agent/command nodes
type AgentNodeData = { label: string; agentConfigId: string; role: string; avatarUrl?: string; modelId?: string };
type CommandNodeData = { label: string; script: string };
type AgentNode = Node<AgentNodeData, 'agent'>;
type CommandNode = Node<CommandNodeData, 'command'>;
type WorkflowNodeRF = AgentNode | CommandNode;

function WorkflowEditorInner({
  template,
  onBack,
}: {
  template: WorkflowTemplate | null;
  onBack: () => void;
}) {
  const { updateWorkflow, createWorkflow } = useWorkflowStore();

  const [allAgents, setAllAgents] = useState<AgentConfig[]>([]);

  useEffect(() => {
    fetch('/api/agents/presets', { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then((agents: AgentConfig[]) => setAllAgents(agents))
      .catch(() => {});
  }, []);

  const [name, setName] = useState(template?.name ?? 'New Workflow');
  const [description, _setDescription] = useState(template?.description ?? '');
  const [nodes, setNodes] = useState<WorkflowNodeRF[]>(
    () =>
      template?.nodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: n.data,
      } as WorkflowNodeRF)) ?? []
  );
  const [edges, setEdges] = useState<Edge[]>(
    () =>
      template?.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: 'smoothstep' as const,
      })) ?? []
  );
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editCommandNode, setEditCommandNode] = useState<CommandNode | null>(null);
  const [commandDialogOpen, setCommandDialogOpen] = useState(false);
  const templateId = template?.id;

  const markDirty = useCallback(() => setIsDirty(true), []);

  const handleNodeDoubleClick = useCallback((_: React.MouseEvent, node: Record<string, unknown>) => {
    if (node.type === 'command') {
      setEditCommandNode(node as unknown as CommandNode);
      setCommandDialogOpen(true);
    }
  }, []);

  const handleCommandSave = useCallback((data: { label: string; script: string }) => {
    if (!editCommandNode) return;
    setNodes((nds) =>
      nds.map((n) => n.id === editCommandNode.id ? ({ ...n, data } as CommandNode) : n)
    );
    markDirty();
  }, [editCommandNode, markDirty]);

  const onNodesChange = useCallback(
    (changes: NodeChange<WorkflowNodeRF>[]) => {
      setNodes((nds) => applyNodeChanges(changes, nds));
      markDirty();
    },
    [markDirty]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((eds) => applyEdgeChanges(changes, eds));
      markDirty();
    },
    [markDirty]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge({ ...connection, id: `e-${connection.source}-${connection.target}`, type: 'smoothstep', sourceHandle: connection.sourceHandle ?? undefined, targetHandle: connection.targetHandle ?? undefined }, eds));
      markDirty();
    },
    [markDirty]
  );

  const onNodeAdd = useCallback(
    (node: WorkflowNodeRF) => {
      setNodes((nds) => [...nds, node]);
      markDirty();
    },
    [markDirty]
  );

  const handleAutoLayout = useCallback(() => {
    setNodes((nds) => getAutoLayoutedNodes(nds, edges));
    markDirty();
  }, [edges, markDirty]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const workflowNodes: WorkflowNode[] = nodes.map((n) => ({
        id: n.id,
        type: n.type as string,
        label: (n.data as Record<string, unknown>).label as string || n.id,
        position: n.position,
        data: n.data as Record<string, unknown>,
      } as WorkflowNode));
      const workflowEdges: WorkflowEdge[] = edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
      }));

      if (templateId) {
        await updateWorkflow(templateId, {
          name,
          description: description || undefined,
          nodes: workflowNodes,
          edges: workflowEdges,
        });
      } else {
        await createWorkflow({
          name,
          description: description || undefined,
          nodes: workflowNodes,
          edges: workflowEdges,
        });
      }
      setIsDirty(false);
    } finally {
      setIsSaving(false);
    }
  }, [templateId, name, description, nodes, edges, updateWorkflow, createWorkflow]);

  const handleExport = useCallback(() => {
    const agentMap: Record<string, Omit<AgentConfig, 'apiKey'>> = {};
    for (const node of nodes) {
      if (node.type !== 'agent') continue;
      const agentId = (node.data as Record<string, unknown>).agentConfigId as string;
      if (agentId && !agentMap[agentId]) {
        const agent = allAgents.find((a) => a.id === agentId);
        if (agent) {
          const { apiKey: _apiKey, ...rest } = agent;
          agentMap[agentId] = rest;
        }
      }
    }
    const data = {
      name,
      description,
      nodes: nodes.map((n) => ({ id: n.id, type: n.type, position: n.position, data: n.data })),
      edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
      agents: agentMap,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.replace(/\s+/g, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [name, description, nodes, edges, allAgents]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 border-b px-4 py-2">
        <button
          onClick={onBack}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer"
        >
          <ArrowLeft className="size-4" />
        </button>
        <Input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            markDirty();
          }}
          className="h-8 text-sm font-medium border-0 shadow-none focus-visible:ring-0 px-1"
          placeholder="Workflow name"
        />
      </div>
      <div className="flex flex-col md:flex-row flex-1 min-h-0">
        <WorkflowAgentPalette agents={allAgents} onNodeAdd={onNodeAdd} />
        <WorkflowCanvas
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeAdd={onNodeAdd}
          onNodeDoubleClick={handleNodeDoubleClick}
        />
      </div>
      <WorkflowToolbar
        onSave={handleSave}
        onAutoLayout={handleAutoLayout}
        onExport={handleExport}
        isDirty={isDirty}
        isSaving={isSaving}
      />
      <WorkflowCommandEditDialog
        open={commandDialogOpen}
        onOpenChange={setCommandDialogOpen}
        data={editCommandNode?.data ?? { label: '', script: '' }}
        onSave={handleCommandSave}
      />
    </div>
  );
}

export function WorkflowEditor({
  template,
  onBack,
}: {
  template: WorkflowTemplate | null;
  onBack: () => void;
}) {
  return (
    <ReactFlowProvider>
      <WorkflowEditorInner template={template} onBack={onBack} />
    </ReactFlowProvider>
  );
}
