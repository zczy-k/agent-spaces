import { create } from 'zustand';
import { fetchWithAuth } from '@/lib/auth';
import type { DatabaseMeta, DocNode } from '@agent-spaces/shared';

interface DatabaseState {
  databases: DatabaseMeta[];
  activeDatabaseId: string | null;
  nodes: DocNode[];
  activeId: string | null;
  openTabs: string[];
  recentIds: string[];
  editorMode: 'notion' | 'markdown';
  theme: 'sans' | 'serif' | 'mono';
  isFullWidth: boolean;
  openFolders: Record<string, boolean>;
  sidebarSearch: string;
  loading: boolean;
  loaded: boolean;
}

interface DatabaseActions {
  load: (workspaceId: string) => Promise<void>;
  loadNodes: (workspaceId: string, databaseId: string) => Promise<void>;
  setActiveDatabaseId: (workspaceId: string, databaseId: string) => Promise<void>;
  createDatabase: (workspaceId: string, input: { name: string; description?: string }) => Promise<DatabaseMeta>;
  updateDatabase: (workspaceId: string, databaseId: string, input: { name: string; description?: string }) => Promise<DatabaseMeta>;
  deleteDatabase: (workspaceId: string, databaseId: string) => Promise<void>;
  setActiveId: (id: string | null) => void;
  createNode: (workspaceId: string, parentId: string | null, type?: 'folder' | 'document') => Promise<DocNode>;
  updateContent: (workspaceId: string, nodeId: string, content: string) => Promise<void>;
  renameNode: (workspaceId: string, nodeId: string, title: string) => Promise<void>;
  updateIcon: (workspaceId: string, nodeId: string, icon: string) => Promise<void>;
  updateCover: (workspaceId: string, nodeId: string, cover: string) => Promise<void>;
  trashNode: (workspaceId: string, nodeId: string) => Promise<void>;
  restoreNode: (workspaceId: string, nodeId: string) => Promise<void>;
  deleteNode: (workspaceId: string, nodeId: string) => Promise<void>;
  moveNode: (workspaceId: string, nodeId: string, parentId: string | null) => Promise<void>;
  setEditorMode: (mode: 'notion' | 'markdown') => void;
  setTheme: (theme: 'sans' | 'serif' | 'mono') => void;
  setIsFullWidth: (v: boolean) => void;
  toggleFolder: (nodeId: string) => void;
  setSidebarSearch: (q: string) => void;
  addTab: (id: string) => void;
  closeTab: (id: string) => void;
}

const PRESET_COVERS = [
  'linear-gradient(to right, #10b981, #06b6d4)',
  'linear-gradient(to right, #ec4899, #8b5cf6)',
  'linear-gradient(to right, #f43f5e, #f97316)',
  'linear-gradient(to right, #1e293b, #0f172a)',
  'linear-gradient(to right, #3b82f6, #06b6d4)',
  'linear-gradient(to right, #f59e0b, #e11d48)',
  'linear-gradient(to right, #475569, #1e293b)',
];

async function api<T = unknown>(workspaceId: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetchWithAuth(`/api/workspaces/${workspaceId}/database${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) throw new Error(`Database API error: ${res.status}`);
  return res.json();
}

function withDatabase(path: string, databaseId: string | null): string {
  if (!databaseId) return path;
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}databaseId=${encodeURIComponent(databaseId)}`;
}

export const useDatabaseStore = create<DatabaseState & DatabaseActions>((set, get) => ({
  databases: [],
  activeDatabaseId: null,
  nodes: [],
  activeId: null,
  openTabs: [],
  recentIds: [],
  editorMode: 'notion',
  theme: 'sans',
  isFullWidth: false,
  openFolders: {},
  sidebarSearch: '',
  loading: false,
  loaded: false,

  load: async (workspaceId) => {
    set({ loading: true });
    try {
      const databases = await api<DatabaseMeta[]>(workspaceId, '/databases');
      const activeDatabaseId = get().activeDatabaseId && databases.some((item) => item.id === get().activeDatabaseId)
        ? get().activeDatabaseId
        : databases[0]?.id ?? null;
      const nodes = activeDatabaseId ? await api<DocNode[]>(workspaceId, withDatabase('', activeDatabaseId)) : [];
      const activeDocs = nodes.filter(n => !n.isTrash);
      set({
        databases,
        activeDatabaseId,
        nodes,
        loading: false,
        loaded: true,
        activeId: activeDocs.length > 0 ? activeDocs[0].id : null,
        openTabs: [],
        recentIds: [],
      });
    } catch {
      set({ loading: false });
    }
  },

  loadNodes: async (workspaceId, databaseId) => {
    set({ loading: true });
    try {
      const nodes = await api<DocNode[]>(workspaceId, withDatabase('', databaseId));
      const activeDocs = nodes.filter(n => !n.isTrash);
      set({
        nodes,
        loading: false,
        activeId: activeDocs.length > 0 ? activeDocs[0].id : null,
        openTabs: [],
        recentIds: [],
        openFolders: {},
        sidebarSearch: '',
      });
    } catch {
      set({ loading: false });
    }
  },

  setActiveDatabaseId: async (workspaceId, databaseId) => {
    set({ activeDatabaseId: databaseId });
    await get().loadNodes(workspaceId, databaseId);
  },

  createDatabase: async (workspaceId, input) => {
    const database = await api<DatabaseMeta>(workspaceId, '/databases', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    set((s) => ({ databases: [...s.databases, database], activeDatabaseId: database.id }));
    await get().loadNodes(workspaceId, database.id);
    return database;
  },

  updateDatabase: async (workspaceId, databaseId, input) => {
    const database = await api<DatabaseMeta>(workspaceId, `/databases/${databaseId}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
    set((s) => ({ databases: s.databases.map((item) => item.id === database.id ? database : item) }));
    return database;
  },

  deleteDatabase: async (workspaceId, databaseId) => {
    await api(workspaceId, `/databases/${databaseId}`, { method: 'DELETE' });
    const databases = await api<DatabaseMeta[]>(workspaceId, '/databases');
    const activeDatabaseId = databases[0]?.id ?? null;
    set({ databases, activeDatabaseId });
    if (activeDatabaseId) await get().loadNodes(workspaceId, activeDatabaseId);
  },

  setActiveId: (id) => {
    set((s) => {
      const tabs = id && !s.openTabs.includes(id) ? [...s.openTabs, id] : s.openTabs;
      const recent = id ? [id, ...s.recentIds.filter(r => r !== id)].slice(0, 4) : s.recentIds;
      return { activeId: id, openTabs: tabs, recentIds: recent };
    });
  },

  createNode: async (workspaceId, parentId, type) => {
    const databaseId = get().activeDatabaseId;
    const isFolder = type ? type === 'folder' : !parentId;
    const cover = PRESET_COVERS[Math.floor(Math.random() * PRESET_COVERS.length)];
    const node = await api<DocNode>(workspaceId, withDatabase('', databaseId), {
      method: 'POST',
      body: JSON.stringify({
        title: isFolder ? '未命名文件夹' : '未命名页面',
        icon: isFolder ? '📂' : '📝',
        cover,
        content: isFolder
          ? '<h1>📂 未命名文件夹</h1><p>这是一个新建的目录夹。</p>'
          : '<h1>新创建的文档</h1><p>点击在此处开始编写...</p>',
        parentId,
      }),
    });
    set((s) => {
      const tabs = [...s.openTabs, node.id];
      if (parentId) {
        return { nodes: [...s.nodes, node], activeId: node.id, openTabs: tabs, openFolders: { ...s.openFolders, [parentId]: true } };
      }
      return { nodes: [...s.nodes, node], activeId: node.id, openTabs: tabs };
    });
    return node;
  },

  updateContent: async (workspaceId, nodeId, content) => {
    const databaseId = get().activeDatabaseId;
    set((s) => ({ nodes: s.nodes.map(n => n.id === nodeId ? { ...n, content, updatedAt: Date.now() } : n) }));
    await api(workspaceId, withDatabase(`/${nodeId}`, databaseId), { method: 'PUT', body: JSON.stringify({ content }) });
  },

  renameNode: async (workspaceId, nodeId, title) => {
    const databaseId = get().activeDatabaseId;
    set((s) => ({ nodes: s.nodes.map(n => n.id === nodeId ? { ...n, title, updatedAt: Date.now() } : n) }));
    await api(workspaceId, withDatabase(`/${nodeId}`, databaseId), { method: 'PUT', body: JSON.stringify({ title }) });
  },

  updateIcon: async (workspaceId, nodeId, icon) => {
    const databaseId = get().activeDatabaseId;
    set((s) => ({ nodes: s.nodes.map(n => n.id === nodeId ? { ...n, icon, updatedAt: Date.now() } : n) }));
    await api(workspaceId, withDatabase(`/${nodeId}`, databaseId), { method: 'PUT', body: JSON.stringify({ icon }) });
  },

  updateCover: async (workspaceId, nodeId, cover) => {
    const databaseId = get().activeDatabaseId;
    set((s) => ({ nodes: s.nodes.map(n => n.id === nodeId ? { ...n, cover, updatedAt: Date.now() } : n) }));
    await api(workspaceId, withDatabase(`/${nodeId}`, databaseId), { method: 'PUT', body: JSON.stringify({ cover }) });
  },

  trashNode: async (workspaceId, nodeId) => {
    const databaseId = get().activeDatabaseId;
    const { nodes, activeId } = get();
    const idsToTrash = new Set<string>([nodeId]);
    const collect = (id: string) => {
      nodes.filter(n => n.parentId === id).forEach(c => { idsToTrash.add(c.id); collect(c.id); });
    };
    collect(nodeId);
    set((s) => ({ nodes: s.nodes.map(n => idsToTrash.has(n.id) ? { ...n, isTrash: true } : n) }));
    await api(workspaceId, withDatabase(`/${nodeId}/trash`, databaseId), { method: 'PUT' });
    if (idsToTrash.has(activeId || '')) {
      const remaining = get().nodes.filter(n => !n.isTrash);
      set({ activeId: remaining.length > 0 ? remaining[0].id : null });
    }
  },

  restoreNode: async (workspaceId, nodeId) => {
    const databaseId = get().activeDatabaseId;
    await api(workspaceId, withDatabase(`/${nodeId}/restore`, databaseId), { method: 'PUT' });
    const { nodes } = get();
    const item = nodes.find(n => n.id === nodeId);
    let newParentId = item?.parentId ?? null;
    if (newParentId) {
      const parent = nodes.find(n => n.id === newParentId);
      if (!parent || parent.isTrash) newParentId = null;
    }
    set((s) => ({
      nodes: s.nodes.map(n => n.id === nodeId ? { ...n, isTrash: false, parentId: newParentId } : n),
      activeId: nodeId,
    }));
  },

  deleteNode: async (workspaceId, nodeId) => {
    const databaseId = get().activeDatabaseId;
    const { nodes, activeId } = get();
    const idsToPurge = new Set<string>([nodeId]);
    const collect = (id: string) => {
      nodes.filter(n => n.parentId === id).forEach(c => { idsToPurge.add(c.id); collect(c.id); });
    };
    collect(nodeId);
    set((s) => ({ nodes: s.nodes.filter(n => !idsToPurge.has(n.id)) }));
    await api(workspaceId, withDatabase(`/${nodeId}`, databaseId), { method: 'DELETE' });
    if (idsToPurge.has(activeId || '')) {
      const remaining = get().nodes.filter(n => !n.isTrash);
      set({ activeId: remaining.length > 0 ? remaining[0].id : null });
    }
  },

  moveNode: async (workspaceId, nodeId, parentId) => {
    const databaseId = get().activeDatabaseId;
    set((s) => ({ nodes: s.nodes.map(n => n.id === nodeId ? { ...n, parentId, updatedAt: Date.now() } : n) }));
    await api(workspaceId, withDatabase(`/${nodeId}/move`, databaseId), { method: 'PUT', body: JSON.stringify({ parentId }) });
    if (parentId) set((s) => ({ openFolders: { ...s.openFolders, [parentId]: true } }));
  },

  setEditorMode: (mode) => set({ editorMode: mode }),
  setTheme: (theme) => set({ theme }),
  setIsFullWidth: (v) => set({ isFullWidth: v }),
  toggleFolder: (nodeId) => set((s) => ({ openFolders: { ...s.openFolders, [nodeId]: !s.openFolders[nodeId] } })),
  setSidebarSearch: (q) => set({ sidebarSearch: q }),

  addTab: (id) => set((s) => s.openTabs.includes(id) ? s : { openTabs: [...s.openTabs, id] }),
  closeTab: (id) => set((s) => {
    const tabs = s.openTabs.filter(t => t !== id);
    const active = s.activeId === id ? (tabs.length > 0 ? tabs[tabs.length - 1] : null) : s.activeId;
    return { openTabs: tabs, activeId: active };
  }),
}));
