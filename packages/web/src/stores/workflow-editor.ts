
import { create } from 'zustand';
import type {
  Workflow, WorkflowFolder, WorkflowNode, WorkflowEdge, WorkflowGroup,
  ExecutionLog, WorkflowVersion, OperationEntry, StagedNode, EngineStatus,
  InteractionRequest,
} from '@agent-spaces/shared';
import {
  workflowApi, workflowFolderApi, workflowVersionApi,
  executionLogApi, operationHistoryApi, stagingApi,
} from '@/lib/workflow-api';
import { getNodeDefinition } from '@/lib/workflow-nodes';
import type { WorkspaceWS } from '@/lib/ws';
import { getWS } from '@/lib/ws';

// ---- Types ----

export interface WorkflowChanges {
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
  groups?: WorkflowGroup[];
}

type PendingInteraction = InteractionRequest;

interface EmbeddedSelection {
  hostNodeId: string;
  nodeId: string;
  node: WorkflowNode;
}

interface WorkflowEditorState {
  // Identity
  workspaceId: string;

  // Workflow list
  workflows: Workflow[];
  workflowFolders: WorkflowFolder[];
  currentWorkflow: Workflow | null;
  loadState: 'idle' | 'loading' | 'loaded' | 'error';
  loadError: string | null;

  // Selection
  selectedNodeIds: string[];
  selectedEmbeddedNode: EmbeddedSelection | null;
  rightPanelTab: string;

  // Execution
  executionStatus: EngineStatus;
  executionLog: ExecutionLog | null;
  executionContext: Record<string, unknown>;
  pendingInteraction: PendingInteraction | null;

  // Execution logs
  executionLogs: ExecutionLog[];
  selectedExecutionLogId: string | null;

  // Versions
  versions: WorkflowVersion[];

  // Staging
  stagedNodes: StagedNode[];

  // Undo/Redo
  undoStack: string[];
  redoStack: string[];
  operationLog: OperationEntry[];

  // Dirty state
  isDirty: boolean;

  // Debug
  debugNodeStatus: Record<string, 'running' | 'completed' | 'error'>;
  debugNodeResult: Record<string, unknown>;
  debugNodeId: string | null;

  // Preview
  isPreview: boolean;
}

interface WorkflowEditorActions {
  // CRUD
  loadData: () => Promise<void>;
  saveWorkflow: (workflow?: Workflow) => Promise<void>;
  deleteWorkflow: (id: string) => Promise<void>;
  createFolder: (name: string, parentId?: string | null) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  renameFolder: (id: string, name: string) => Promise<void>;
  setCurrentWorkflow: (workflow: Workflow | null) => void;

  // Edit
  addNode: (type: string, position: { x: number; y: number }) => WorkflowNode | null;
  removeNode: (id: string) => void;
  updateNodeData: (id: string, data: Partial<WorkflowNode>) => void;
  updateNodePosition: (id: string, position: { x: number; y: number }) => void;
  addEdge: (edge: WorkflowEdge) => void;
  removeEdge: (id: string) => void;
  selectNodes: (ids: string[]) => void;
  clearSelection: () => void;
  selectEmbeddedNode: (selection: EmbeddedSelection | null) => void;
  setRightPanelTab: (tab: string) => void;

  // Execution
  execute: (input?: Record<string, unknown>, startNodeId?: string) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
  debugSingleNode: (nodeId: string, context?: Record<string, unknown>) => Promise<void>;
  cancelDebug: () => void;
  debugNodeStatus: Record<string, 'running' | 'completed' | 'error'>;
  debugNodeResult: Record<string, unknown>;
  debugNodeId: string | null;

  // Execution Logs
  loadExecutionLogs: () => Promise<void>;
  deleteExecutionLog: (id: string) => Promise<void>;
  clearExecutionLogs: () => Promise<void>;
  setSelectedExecutionLogId: (id: string | null) => void;
  enterPreview: (log: ExecutionLog) => void;
  exitPreview: () => void;

  // Versions
  loadVersions: () => Promise<void>;
  saveVersion: (name: string) => Promise<void>;
  deleteVersion: (id: string) => Promise<void>;
  restoreVersion: (id: string) => Promise<void>;

  // Staging
  loadStagedNodes: () => Promise<void>;
  copyNodeToStaging: (nodeId: string) => Promise<void>;
  moveNodeToStaging: (nodeId: string) => Promise<void>;
  removeStagedNode: (id: string) => Promise<void>;
  clearStagedNodes: () => Promise<void>;
  pasteStagedNode: (stagedNode: StagedNode) => void;

  // Operation history
  loadOperationHistory: () => Promise<void>;

  // Undo/Redo
  pushUndo: (description: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  restoreToStep: (index: number) => void;
  clearOperationHistory: () => Promise<void>;

  // Dirty
  markDirty: () => void;
  markClean: () => void;

  // Groups
  createGroup: (name: string, childNodeIds: string[]) => void;
  removeGroup: (id: string) => void;
  toggleGroupLock: (id: string) => void;
  toggleGroupDisabled: (id: string) => void;

  // WS interaction
  listenForUIInteractions: () => () => void;
  resolveInteraction: (data: unknown) => void;
}

type WorkflowEditorStore = WorkflowEditorState & WorkflowEditorActions;

// ---- Validation ----

function validateWorkflowExecution(wf: Workflow): string | null {
  const startNodes = wf.nodes.filter(n => n.type === 'start');
  const endNodes = wf.nodes.filter(n => n.type === 'end');
  if (startNodes.length === 0) return '缺少开始节点';
  if (endNodes.length === 0) return '缺少结束节点';

  // Check all non-start nodes are reachable
  const nodeIds = new Set(wf.nodes.map(n => n.id));
  for (const edge of wf.edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
  }
  return null;
}

// ---- Store Factory ----

export function createWorkflowEditorStore(workspaceId: string) {
  let _prePreviewWorkflow: Workflow | null = null;
  let _wsUnsubscribe: (() => void) | null = null;

  const store = create<WorkflowEditorStore>((set, get) => ({
    // ---- Initial State ----
    workspaceId,
    workflows: [],
    workflowFolders: [],
    currentWorkflow: null,
    loadState: 'idle',
    loadError: null,
    selectedNodeIds: [],
    selectedEmbeddedNode: null,
    rightPanelTab: 'properties',
    executionStatus: 'idle',
    executionLog: null,
    executionContext: {},
    pendingInteraction: null,
    executionLogs: [],
    selectedExecutionLogId: null,
    versions: [],
    stagedNodes: [],
    undoStack: [],
    redoStack: [],
    operationLog: [],
    isDirty: false,
    isPreview: false,
    debugNodeStatus: {},
    debugNodeResult: {},
    debugNodeId: null,

    // ---- CRUD ----

    loadData: async () => {
      set({ loadState: 'loading' });
      try {
        const [workflows, folders] = await Promise.all([
          workflowApi.list(),
          workflowFolderApi.list(),
        ]);
        set({ workflows, workflowFolders: folders, loadState: 'loaded', loadError: null });
      } catch (err: any) {
        set({ loadState: 'error', loadError: err.message });
      }
    },

    saveWorkflow: async (workflow?: Workflow) => {
      const wf = workflow || get().currentWorkflow;
      if (!wf) return;
      const plain = JSON.parse(JSON.stringify(wf)) as Workflow;
      const now = Date.now();
      const existing = get().workflows.find(w => w.id === plain.id);
      if (existing) {
        await workflowApi.update(plain.id, { ...plain, updatedAt: now });
        set(s => ({
          workflows: s.workflows.map(w => w.id === plain.id ? { ...plain, updatedAt: now } : w),
          currentWorkflow: s.currentWorkflow?.id === plain.id ? { ...plain, updatedAt: now } : s.currentWorkflow,
          isDirty: false,
        }));
      } else {
        const created = await workflowApi.create({ ...plain, createdAt: now, updatedAt: now });
        set(s => ({
          workflows: [...s.workflows, created],
          currentWorkflow: created,
          isDirty: false,
        }));
      }
    },

    deleteWorkflow: async (id: string) => {
      await workflowApi.delete(id);
      set(s => ({
        workflows: s.workflows.filter(w => w.id !== id),
        currentWorkflow: s.currentWorkflow?.id === id ? null : s.currentWorkflow,
        isDirty: s.currentWorkflow?.id === id ? false : s.isDirty,
      }));
    },

    createFolder: async (name: string, parentId: string | null = null) => {
      const folder = await workflowFolderApi.create({ name, parentId, order: 0, createdAt: Date.now() });
      set(s => ({ workflowFolders: [...s.workflowFolders, folder] }));
    },

    deleteFolder: async (id: string) => {
      await workflowFolderApi.delete(id);
      set(s => ({ workflowFolders: s.workflowFolders.filter(f => f.id !== id) }));
    },

    renameFolder: async (id: string, name: string) => {
      await workflowFolderApi.update(id, { name });
      set(s => ({
        workflowFolders: s.workflowFolders.map(f => f.id === id ? { ...f, name } : f),
      }));
    },

    setCurrentWorkflow: (workflow: Workflow | null) => {
      set({
        currentWorkflow: workflow,
        selectedNodeIds: [],
        selectedEmbeddedNode: null,
        executionStatus: 'idle',
        executionLog: null,
        executionContext: {},
        undoStack: [],
        redoStack: [],
        isDirty: false,
        isPreview: false,
        debugNodeStatus: {},
        debugNodeResult: {},
        debugNodeId: null,
      });
      if (workflow) {
        get().loadExecutionLogs();
        get().loadVersions();
        get().loadOperationHistory();
        get().loadStagedNodes();
      }
    },

    // ---- Edit ----

    addNode: (type: string, position: { x: number; y: number }) => {
      const wf = get().currentWorkflow;
      if (!wf) return null;
      const def = getNodeDefinition(type);
      const id = `node_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const node: WorkflowNode = {
        id,
        type,
        label: def?.label || type,
        position,
        data: {},
        ...(def?.singleton ? {} : {}),
      };
      // Initialize defaults from property definitions
      if (def?.properties) {
        for (const prop of def.properties) {
          if (prop.default !== undefined) {
            node.data[prop.key] = prop.default;
          }
        }
      }
      get().pushUndo('添加节点');
      set(s => ({
        currentWorkflow: s.currentWorkflow ? {
          ...s.currentWorkflow,
          nodes: [...s.currentWorkflow.nodes, node],
        } : null,
        isDirty: true,
      }));
      return node;
    },

    removeNode: (id: string) => {
      const wf = get().currentWorkflow;
      if (!wf) return;
      get().pushUndo('删除节点');
      set(s => ({
        currentWorkflow: s.currentWorkflow ? {
          ...s.currentWorkflow,
          nodes: s.currentWorkflow.nodes.filter(n => n.id !== id),
          edges: s.currentWorkflow.edges.filter(e => e.source !== id && e.target !== id),
        } : null,
        selectedNodeIds: s.selectedNodeIds.filter(nid => nid !== id),
        isDirty: true,
      }));
    },

    updateNodeData: (id: string, data: Partial<WorkflowNode>) => {
      set(s => ({
        currentWorkflow: s.currentWorkflow ? {
          ...s.currentWorkflow,
          nodes: s.currentWorkflow.nodes.map(n => n.id === id ? { ...n, ...data } : n),
        } : null,
        isDirty: true,
      }));
    },

    updateNodePosition: (id: string, position: { x: number; y: number }) => {
      set(s => ({
        currentWorkflow: s.currentWorkflow ? {
          ...s.currentWorkflow,
          nodes: s.currentWorkflow.nodes.map(n => n.id === id ? { ...n, position } : n),
        } : null,
        isDirty: true,
      }));
    },

    addEdge: (edge: WorkflowEdge) => {
      set(s => ({
        currentWorkflow: s.currentWorkflow ? {
          ...s.currentWorkflow,
          edges: [...s.currentWorkflow.edges, edge],
        } : null,
        isDirty: true,
      }));
    },

    removeEdge: (id: string) => {
      set(s => ({
        currentWorkflow: s.currentWorkflow ? {
          ...s.currentWorkflow,
          edges: s.currentWorkflow.edges.filter(e => e.id !== id),
        } : null,
        isDirty: true,
      }));
    },

    selectNodes: (ids: string[]) => set({ selectedNodeIds: ids }),
    clearSelection: () => set({ selectedNodeIds: [], selectedEmbeddedNode: null }),
    selectEmbeddedNode: (selection) => set({ selectedEmbeddedNode: selection }),
    setRightPanelTab: (tab) => set({ rightPanelTab: tab }),

    // ---- Execution ----

    execute: async (input?: Record<string, unknown>, startNodeId?: string) => {
      const wf = get().currentWorkflow;
      if (!wf) return;
      const error = validateWorkflowExecution(wf);
      if (error) return;

      set({ executionStatus: 'running', executionContext: {} });
      try {
        const ws = getWS(get().workspaceId);
        ws.send('workflow:execute', { workflowId: wf.id, input, startNodeId });
      } catch (err: any) {
        set({ executionStatus: 'error' });
      }
    },

    pause: async () => {
      const log = get().executionLog;
      if (!log) return;
      const ws = getWS(get().workspaceId);
      ws.send('workflow:pause', { executionId: log.id });
    },

    resume: async () => {
      const log = get().executionLog;
      if (!log) return;
      const ws = getWS(get().workspaceId);
      ws.send('workflow:resume', { executionId: log.id });
    },

    stop: async () => {
      const log = get().executionLog;
      if (!log) return;
      const ws = getWS(get().workspaceId);
      ws.send('workflow:stop', { executionId: log.id });
    },

    debugSingleNode: async (nodeId: string, context?: Record<string, unknown>) => {
      const wf = get().currentWorkflow;
      if (!wf) return;
      set(s => ({
        debugNodeId: nodeId,
        debugNodeStatus: { ...s.debugNodeStatus, [nodeId]: 'running' },
        debugNodeResult: { ...s.debugNodeResult, [nodeId]: undefined },
      }));
      const ws = getWS(get().workspaceId);
      ws.send('workflow:debug-node', { workflowId: wf.id, nodeId, context });
    },

    cancelDebug: () => set({ debugNodeId: null }),

    // ---- Execution Logs ----

    loadExecutionLogs: async () => {
      const wf = get().currentWorkflow;
      if (!wf) return;
      try {
        const logs = await executionLogApi.list(wf.id);
        set({ executionLogs: logs });
      } catch {}
    },

    deleteExecutionLog: async (id: string) => {
      const wf = get().currentWorkflow;
      if (!wf) return;
      await executionLogApi.delete(wf.id, id);
      set(s => ({
        executionLogs: s.executionLogs.filter(l => l.id !== id),
        selectedExecutionLogId: s.selectedExecutionLogId === id ? null : s.selectedExecutionLogId,
      }));
    },

    clearExecutionLogs: async () => {
      const wf = get().currentWorkflow;
      if (!wf) return;
      await executionLogApi.clear(wf.id);
      set({ executionLogs: [], selectedExecutionLogId: null });
    },

    setSelectedExecutionLogId: (id) => set({ selectedExecutionLogId: id }),

    enterPreview: (log: ExecutionLog) => {
      const wf = get().currentWorkflow;
      if (get().isPreview || !log.snapshot || !wf) return;
      _prePreviewWorkflow = JSON.parse(JSON.stringify(wf));
      set(s => ({
        currentWorkflow: s.currentWorkflow ? {
          ...s.currentWorkflow,
          nodes: JSON.parse(JSON.stringify(log.snapshot!.nodes)),
          edges: JSON.parse(JSON.stringify(log.snapshot!.edges)),
          groups: log.snapshot!.groups ? JSON.parse(JSON.stringify(log.snapshot!.groups)) : [],
        } : null,
        isPreview: true,
      }));
    },

    exitPreview: () => {
      if (!get().isPreview) return;
      if (_prePreviewWorkflow) {
        set({
          currentWorkflow: _prePreviewWorkflow,
          isPreview: false,
          selectedExecutionLogId: null,
        });
        _prePreviewWorkflow = null;
      } else {
        set({ isPreview: false, selectedExecutionLogId: null });
      }
    },

    // ---- Versions ----

    loadVersions: async () => {
      const wf = get().currentWorkflow;
      if (!wf) return;
      try {
        const versions = await workflowVersionApi.list(wf.id);
        set({ versions });
      } catch {}
    },

    saveVersion: async (name: string) => {
      const wf = get().currentWorkflow;
      if (!wf) return;
      const version = await workflowVersionApi.add(wf.id, name, wf.nodes, wf.edges);
      set(s => ({ versions: [...s.versions, version] }));
    },

    deleteVersion: async (id: string) => {
      const wf = get().currentWorkflow;
      if (!wf) return;
      await workflowVersionApi.delete(wf.id, id);
      set(s => ({ versions: s.versions.filter(v => v.id !== id) }));
    },

    restoreVersion: async (id: string) => {
      const wf = get().currentWorkflow;
      if (!wf) return;
      get().pushUndo('恢复版本');
      const version = await workflowVersionApi.get(wf.id, id);
      set(s => ({
        currentWorkflow: s.currentWorkflow ? {
          ...s.currentWorkflow,
          nodes: JSON.parse(JSON.stringify(version.snapshot.nodes)),
          edges: JSON.parse(JSON.stringify(version.snapshot.edges)),
        } : null,
        isDirty: true,
      }));
    },

    // ---- Staging ----

    loadStagedNodes: async () => {
      const wf = get().currentWorkflow;
      if (!wf) return;
      try {
        const nodes = await stagingApi.load(wf.id);
        set({ stagedNodes: nodes });
      } catch {}
    },

    copyNodeToStaging: async (nodeId: string) => {
      const wf = get().currentWorkflow;
      if (!wf) return;
      const node = wf.nodes.find(n => n.id === nodeId);
      if (!node) return;
      const staged: StagedNode = {
        id: `staged_${Date.now()}`,
        sourceNodeId: node.id,
        type: node.type,
        label: node.label,
        data: JSON.parse(JSON.stringify(node.data)),
        composite: node.composite ? JSON.parse(JSON.stringify(node.composite)) : undefined,
        stagedAt: Date.now(),
      };
      const newNodes = [...get().stagedNodes, staged];
      await stagingApi.save(wf.id, newNodes);
      set({ stagedNodes: newNodes });
    },

    moveNodeToStaging: async (nodeId: string) => {
      await get().copyNodeToStaging(nodeId);
      get().removeNode(nodeId);
    },

    removeStagedNode: async (id: string) => {
      const wf = get().currentWorkflow;
      if (!wf) return;
      const newNodes = get().stagedNodes.filter(n => n.id !== id);
      await stagingApi.save(wf.id, newNodes);
      set({ stagedNodes: newNodes });
    },

    clearStagedNodes: async () => {
      const wf = get().currentWorkflow;
      if (!wf) return;
      await stagingApi.clear(wf.id);
      set({ stagedNodes: [] });
    },

    pasteStagedNode: (stagedNode: StagedNode) => {
      const wf = get().currentWorkflow;
      if (!wf) return;
      const nodes = wf.nodes;
      let position = { x: 200, y: 200 };
      if (nodes.length > 0) {
        const avgX = nodes.reduce((s, n) => s + n.position.x, 0) / nodes.length;
        const avgY = nodes.reduce((s, n) => s + n.position.y, 0) / nodes.length;
        position = { x: Math.round(avgX) + 30, y: Math.round(avgY) + 30 };
      }
      const newNode = get().addNode(stagedNode.type, position);
      if (newNode) {
        newNode.data = JSON.parse(JSON.stringify(stagedNode.data));
        newNode.label = stagedNode.label;
      }
    },

    // ---- Undo/Redo ----

    pushUndo: (description: string) => {
      const wf = get().currentWorkflow;
      if (!wf) return;
      const snapshot = JSON.stringify({ nodes: wf.nodes, edges: wf.edges, groups: wf.groups });
      const entry: OperationEntry = { description, timestamp: Date.now(), snapshot };
      set(s => ({
        undoStack: [...s.undoStack, snapshot],
        redoStack: [],
        operationLog: [...s.operationLog, entry],
      }));
    },

    undo: () => {
      const { undoStack, redoStack, currentWorkflow } = get();
      if (undoStack.length === 0 || !currentWorkflow) return;
      const currentSnapshot = JSON.stringify({ nodes: currentWorkflow.nodes, edges: currentWorkflow.edges, groups: currentWorkflow.groups });
      const prevSnapshot = undoStack[undoStack.length - 1];
      const prev = JSON.parse(prevSnapshot);
      set({
        undoStack: undoStack.slice(0, -1),
        redoStack: [...redoStack, currentSnapshot],
        currentWorkflow: { ...currentWorkflow, nodes: prev.nodes, edges: prev.edges, groups: prev.groups },
        isDirty: true,
      });
    },

    redo: () => {
      const { undoStack, redoStack, currentWorkflow } = get();
      if (redoStack.length === 0 || !currentWorkflow) return;
      const currentSnapshot = JSON.stringify({ nodes: currentWorkflow.nodes, edges: currentWorkflow.edges, groups: currentWorkflow.groups });
      const nextSnapshot = redoStack[redoStack.length - 1];
      const next = JSON.parse(nextSnapshot);
      set({
        undoStack: [...undoStack, currentSnapshot],
        redoStack: redoStack.slice(0, -1),
        currentWorkflow: { ...currentWorkflow, nodes: next.nodes, edges: next.edges, groups: next.groups },
        isDirty: true,
      });
    },

    canUndo: () => get().undoStack.length > 0,
    canRedo: () => get().redoStack.length > 0,

    restoreToStep: (index: number) => {
      const { operationLog, currentWorkflow } = get();
      if (!currentWorkflow || index >= operationLog.length) return;
      const entry = operationLog[index];
      if (!entry.snapshot) return;
      const restored = JSON.parse(entry.snapshot);
      set(s => ({
        currentWorkflow: s.currentWorkflow ? {
          ...s.currentWorkflow,
          nodes: restored.nodes,
          edges: restored.edges,
          groups: restored.groups,
        } : null,
        isDirty: true,
      }));
    },

    clearOperationHistory: async () => {
      const wf = get().currentWorkflow;
      if (!wf) return;
      await operationHistoryApi.clear(wf.id);
      set({ undoStack: [], redoStack: [], operationLog: [] });
    },

    loadOperationHistory: async () => {
      const wf = get().currentWorkflow;
      if (!wf) return;
      try {
        const entries = await operationHistoryApi.load(wf.id);
        set({ operationLog: entries });
      } catch {}
    },

    // ---- Dirty ----

    markDirty: () => set({ isDirty: true }),
    markClean: () => set({ isDirty: false }),

    // ---- Groups ----

    createGroup: (name: string, childNodeIds: string[]) => {
      const wf = get().currentWorkflow;
      if (!wf) return;
      get().pushUndo('创建分组');
      const group: WorkflowGroup = {
        id: `group_${Date.now()}`,
        name,
        childNodeIds,
        childGroupIds: [],
        locked: false,
        disabled: false,
        savedNodeStates: {},
      };
      set(s => ({
        currentWorkflow: s.currentWorkflow ? {
          ...s.currentWorkflow,
          groups: [...(s.currentWorkflow.groups || []), group],
        } : null,
        isDirty: true,
      }));
    },

    removeGroup: (id: string) => {
      get().pushUndo('删除分组');
      set(s => ({
        currentWorkflow: s.currentWorkflow ? {
          ...s.currentWorkflow,
          groups: (s.currentWorkflow.groups || []).filter(g => g.id !== id),
        } : null,
        isDirty: true,
      }));
    },

    toggleGroupLock: (id: string) => {
      set(s => ({
        currentWorkflow: s.currentWorkflow ? {
          ...s.currentWorkflow,
          groups: (s.currentWorkflow.groups || []).map(g =>
            g.id === id ? { ...g, locked: !g.locked } : g
          ),
        } : null,
        isDirty: true,
      }));
    },

    toggleGroupDisabled: (id: string) => {
      const wf = get().currentWorkflow;
      if (!wf) return;
      const groups = wf.groups || [];
      const group = groups.find(g => g.id === id);
      if (!group) return;
      get().pushUndo('切换分组禁用');
      const newDisabled = !group.disabled;
      const savedNodeStates = { ...group.savedNodeStates };
      const nodes = [...wf.nodes];

      if (newDisabled) {
        for (const nid of group.childNodeIds) {
          const node = nodes.find(n => n.id === nid);
          if (node) savedNodeStates[nid] = node.nodeState || 'normal';
        }
      }

      set(s => ({
        currentWorkflow: s.currentWorkflow ? {
          ...s.currentWorkflow,
          groups: groups.map(g => g.id === id ? { ...g, disabled: newDisabled, savedNodeStates } : g),
          nodes: newDisabled
            ? s.currentWorkflow.nodes.map(n =>
                group.childNodeIds.includes(n.id) ? { ...n, nodeState: 'disabled' as const } : n
              )
            : s.currentWorkflow.nodes.map(n =>
                group.childNodeIds.includes(n.id)
                  ? { ...n, nodeState: savedNodeStates[n.id] || 'normal' as const }
                  : n
              ),
        } : null,
        isDirty: true,
      }));
    },

    // ---- WS interaction ----

    listenForUIInteractions: () => {
      const ws = getWS(get().workspaceId);
      const handler = (data: unknown) => {
        set({ pendingInteraction: data as PendingInteraction });
      };
      ws.on('workflow:interaction', handler);
      return () => ws.off('workflow:interaction', handler);
    },

    resolveInteraction: (data: unknown) => {
      const pending = get().pendingInteraction;
      if (pending) {
        const ws = getWS(get().workspaceId);
        ws.send('workflow:interaction', {
          id: pending.id,
          channel: 'workflow:interaction',
          type: 'interaction_response',
          executionId: pending.executionId,
          workflowId: pending.workflowId,
          nodeId: pending.nodeId,
          data,
        });
      }
      set({ pendingInteraction: null });
    },
  }));

  // ---- Setup WS event listeners ----
  const ws = getWS(workspaceId);

  // Workflow execution events
  const executionEvents = [
    'workflow:execute:result',
    'workflow:execute:error',
    'workflow:pause:result',
    'workflow:pause:error',
    'workflow:resume:result',
    'workflow:resume:error',
    'workflow:stop:result',
    'workflow:stop:error',
    'workflow:debug-node:result',
    'workflow:debug-node:error',
  ];

  for (const evt of executionEvents) {
    ws.on(evt, (data: unknown) => {
      const d = data as Record<string, unknown>;
      const st = store.getState();
      if (evt === 'workflow:execute:result') {
        st.loadExecutionLogs();
        if (d?.status) {
          store.setState({ executionStatus: d.status as EngineStatus });
        }
      }
      if (evt === 'workflow:execute:error') {
        store.setState({ executionStatus: 'error' });
      }
      if (evt.startsWith('workflow:debug-node:')) {
        const nodeId = st.debugNodeId;
        if (nodeId) {
          if (evt === 'workflow:debug-node:result') {
            store.setState(s => ({
              debugNodeStatus: { ...s.debugNodeStatus, [nodeId]: 'completed' },
              debugNodeResult: { ...s.debugNodeResult, [nodeId]: d },
              debugNodeId: null,
            }));
          } else {
            store.setState(s => ({
              debugNodeStatus: { ...s.debugNodeStatus, [nodeId]: 'error' },
              debugNodeId: null,
            }));
          }
        }
      }
    });
  }

  return store;
}

// ---- Store registry (per workspace) ----

const storeRegistry = new Map<string, ReturnType<typeof createWorkflowEditorStore>>();

export function getWorkflowEditorStore(workspaceId: string) {
  let store = storeRegistry.get(workspaceId);
  if (!store) {
    store = createWorkflowEditorStore(workspaceId);
    storeRegistry.set(workspaceId, store);
  }
  return store;
}

export function disposeWorkflowEditorStore(workspaceId: string) {
  storeRegistry.delete(workspaceId);
}
