'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sidebar, Search, Plus, Trash, X, ChevronRight,
  Layers, BookOpen, Minimize2, Maximize2, Check,
  CheckCircle, FileCheck, Clock, Sparkles, SlidersHorizontal, MoreHorizontal,
  ChevronDown, Edit2, Move, Trash2, Database,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { htmlToMarkdown, markdownToHtml } from '@/lib/converter';
import { useDatabaseStore } from '@/stores/database';
import { PRESET_COVERS } from '@agent-spaces/shared';
import type { DatabaseMeta, DocNode } from '@agent-spaces/shared';
import { NestedTree } from '@/components/editor/file-tree';
import type { NestedTreeRenderState, NestedTreeRowProps } from '@/components/editor/file-tree';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import type { PanelImperativeHandle, Layout } from 'react-resizable-panels'

import NotionEditor from './notion-editor';
import MarkdownEditor from './markdown-editor';
import QuickSearchModal from './quick-search-modal';
import TrashBinModal from './trash-bin-modal';

interface Props {
  workspaceId: string;
}

interface DatabaseDialogProps {
  open: boolean;
  database: DatabaseMeta | null;
  onOpenChange: (open: boolean) => void;
  onSave: (input: { name: string; description: string }) => Promise<void>;
}

const PANEL_LAYOUT_KEY = 'database-panel-layout';
const SIDEBAR_MIN_SIZE = 12;
const SIDEBAR_MAX_SIZE = 70;
const MAIN_MIN_SIZE = 30;
const DEFAULT_PANEL_LAYOUT: Layout = { sidebar: 25, main: 75 };
const formatPanelSize = (size: number) => `${size}%`;

function loadPanelLayout(): Layout | undefined {
  try {
    const raw = localStorage.getItem(PANEL_LAYOUT_KEY);
    if (!raw) return undefined;

    const layout = JSON.parse(raw) as Partial<Layout>;
    return typeof layout.sidebar === 'number'
      && typeof layout.main === 'number'
      && layout.sidebar >= SIDEBAR_MIN_SIZE
      && layout.sidebar <= SIDEBAR_MAX_SIZE
      && layout.main >= MAIN_MIN_SIZE
      ? { sidebar: layout.sidebar, main: layout.main }
      : undefined;
  } catch {
    return undefined;
  }
}

const EMOJIS = ['📁', '📄', '📎', '🚀', '💡', '⭐', '🎯', '🎨', '📇', '📈', '☑️', '🔥', '🔍', '📮', '🧪', '✍️', '✅', '📸', '🔀', '🧭'];

function DatabaseDialog({ open, database, onOpenChange, onSave }: DatabaseDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(database?.name ?? '');
    setDescription(database?.description ?? '');
  }, [database, open]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName || saving) return;
    setSaving(true);
    try {
      await onSave({ name: cleanName, description: description.trim() });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="px-5 py-4 border-b border-border">
            <DialogTitle className="text-sm">{database ? 'Edit database' : 'Create database'}</DialogTitle>
          </DialogHeader>
          <div className="p-5 space-y-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
                autoFocus
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Description</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="min-h-20 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
              />
            </label>
          </div>
          <DialogFooter className="px-5 py-4">
            <button type="button" onClick={() => onOpenChange(false)} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent">
              Cancel
            </button>
            <button type="submit" disabled={!name.trim() || saving} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground disabled:opacity-50">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface DatabaseTreeNodeProps {
  node: DocNode;
  state: NestedTreeRenderState;
  rowProps: NestedTreeRowProps;
  onSelect: (nodeId: string) => void;
  onAddChild: (parentId: string) => void;
  onDelete: (nodeId: string) => void;
  onRename: (nodeId: string, title: string) => void;
  onUpdateIcon: (nodeId: string, icon: string) => void;
  onToggleExpand: (nodeId: string) => void;
  children: React.ReactNode;
}

function DatabaseTreeNode({
  node,
  state,
  rowProps,
  onSelect,
  onAddChild,
  onDelete,
  onRename,
  onUpdateIcon,
  onToggleExpand,
  children,
}: DatabaseTreeNodeProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editingTitle, setEditingTitle] = useState(node.title);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const emojiRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setEditingTitle(node.title); }, [node.title]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(event.target as Node)) setEmojiOpen(false);
    };
    if (emojiOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [emojiOpen]);

  const submitRename = () => {
    onRename(node.id, editingTitle.trim() || '未命名文档');
    setIsEditing(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') submitRename();
    if (event.key === 'Escape') {
      setEditingTitle(node.title);
      setIsEditing(false);
    }
  };

  return (
    <div className="flex flex-col select-none">
      <div
        {...rowProps}
        className={cn(
          "group flex items-center h-9 justify-between pr-2 rounded-lg cursor-pointer transition-all gap-1.5 border border-transparent my-0.5",
          state.isActive ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-accent hover:text-foreground",
          state.isDraggedOver && "border-2 border-dashed border-primary/40 bg-primary/5 scale-95",
          rowProps.className,
        )}
      >
        <div className="flex items-center min-w-0 flex-1 h-full py-1">
          <button
            onClick={(event) => { event.stopPropagation(); onToggleExpand(node.id); }}
            className={cn("p-1 rounded-sm text-muted-foreground hover:text-foreground transition-colors shrink-0", !state.hasChildren && "opacity-0 cursor-default")}
          >
            {state.isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
          <div className="relative shrink-0" ref={emojiRef}>
            <button
              onClick={(event) => { event.stopPropagation(); setEmojiOpen(!emojiOpen); }}
              className="text-base p-1.5 rounded-md hover:bg-accent shrink-0 transition-all select-none"
            >
              {node.icon || (state.hasChildren ? '📁' : '📄')}
            </button>
            {emojiOpen && (
              <div className="absolute left-1 top-7 bg-popover shadow-2xl rounded-xl border border-border p-2 grid grid-cols-5 gap-1 w-44 z-50">
                {EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={(event) => { event.stopPropagation(); onUpdateIcon(node.id, emoji); setEmojiOpen(false); }}
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-accent text-base cursor-pointer text-foreground"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div onClick={() => onSelect(node.id)} className="flex-1 min-w-0 pr-1.5 h-full flex items-center">
            {isEditing ? (
              <input
                type="text"
                value={editingTitle}
                onChange={(event) => setEditingTitle(event.target.value)}
                onBlur={submitRename}
                onKeyDown={handleKeyDown}
                onClick={(event) => event.stopPropagation()}
                className="w-full text-xs font-semibold bg-background border border-border rounded-md px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-ring text-foreground"
                autoFocus
              />
            ) : (
              <span className={cn("text-xs truncate font-medium select-none", state.isActive ? "text-primary" : "text-foreground/80")}>
                {node.title || '未命名文档'}
              </span>
            )}
          </div>
        </div>
        {!isEditing && (
          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 shrink-0 transition-opacity">
            <button onClick={(event) => { event.stopPropagation(); setIsEditing(true); }} className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer" title="重命名">
              <Edit2 className="w-3 h-3" />
            </button>
            <button onClick={(event) => { event.stopPropagation(); onAddChild(node.id); }} className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer" title="新建子页面">
              <Plus className="w-3 h-3" />
            </button>
            <button
              onClick={(event) => {
                event.stopPropagation();
                if (confirm(`要将 "${node.title || '未命名文档'}" 移动到回收站吗？`)) onDelete(node.id);
              }}
              className="p-1 rounded hover:bg-rose-950/60 text-muted-foreground hover:text-rose-400 cursor-pointer"
              title="删除"
            >
              <Trash2 className="w-3 h-3" />
            </button>
            <div className="p-1 cursor-grab text-muted-foreground/40 pointer-events-none">
              <Move className="w-3 h-3" />
            </div>
          </div>
        )}
      </div>
      {children && <div className="flex flex-col">{children}</div>}
    </div>
  );
}

export default function DatabasePanel({ workspaceId }: Props) {
  const {
    databases, activeDatabaseId,
    nodes, activeId, openTabs, recentIds, editorMode, theme, isFullWidth,
    openFolders, sidebarSearch, loading, loaded,
    load, setActiveDatabaseId, createDatabase, updateDatabase, deleteDatabase,
    setActiveId, createNode, updateContent, renameNode, updateIcon,
    updateCover, trashNode, restoreNode, deleteNode, moveNode,
    setEditorMode, setTheme, setIsFullWidth, toggleFolder, setSidebarSearch,
    closeTab,
  } = useDatabaseStore();

  const sidebarPanelRef = useRef<PanelImperativeHandle>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [draggedOverNodeId, setDraggedOverNodeId] = useState<string | null>(null);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [newDropdownOpen, setNewDropdownOpen] = useState(false);
  const [settingsDropdownOpen, setSettingsDropdownOpen] = useState(false);
  const [databaseDialogOpen, setDatabaseDialogOpen] = useState(false);
  const [editingDatabase, setEditingDatabase] = useState<DatabaseMeta | null>(null);
  const newDropdownRef = useRef<HTMLDivElement>(null);
  const settingsDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (!loaded) load(workspaceId); }, [loaded, load, workspaceId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setIsSearchOpen(true); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (newDropdownRef.current && !newDropdownRef.current.contains(e.target as Node)) setNewDropdownOpen(false);
    };
    if (newDropdownOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [newDropdownOpen]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (settingsDropdownRef.current && !settingsDropdownRef.current.contains(e.target as Node)) setSettingsDropdownOpen(false);
    };
    if (settingsDropdownOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [settingsDropdownOpen]);

  const triggerSave = () => { setShowSaveSuccess(true); setTimeout(() => setShowSaveSuccess(false), 1200); };

  const activeNode = nodes.find(n => n.id === activeId);
  const activeDatabase = databases.find((database) => database.id === activeDatabaseId) ?? databases[0] ?? null;
  const activeNodes = nodes.filter(n => !n.isTrash);
  const filteredNodes = activeNodes.filter(n => sidebarSearch ? (n.title || '').toLowerCase().includes(sidebarSearch.toLowerCase()) : true);
  const rootNodes = filteredNodes.filter(n => n.parentId === null);

  const handleAddChild = useCallback(async (parentId: string | null, type?: 'folder' | 'document') => {
    await createNode(workspaceId, parentId, type);
    triggerSave();
  }, [workspaceId, createNode]);

  const handleRename = useCallback((nodeId: string, title: string) => {
    let clean = title;
    const node = nodes.find(n => n.id === nodeId);
    if (node?.icon && clean.trim().startsWith(node.icon)) clean = clean.trim().substring(node.icon.length).trim();
    renameNode(workspaceId, nodeId, clean);
    triggerSave();
  }, [workspaceId, nodes, renameNode]);

  const handleModeToggle = useCallback((mode: 'notion' | 'markdown') => {
    if (!activeNode) return;
    if (mode === 'markdown' && editorMode === 'notion') {
      updateContent(workspaceId, activeNode.id, htmlToMarkdown(activeNode.content));
    } else if (mode === 'notion' && editorMode === 'markdown') {
      updateContent(workspaceId, activeNode.id, markdownToHtml(activeNode.content));
    }
    setEditorMode(mode);
  }, [activeNode, editorMode, workspaceId, updateContent, setEditorMode]);

  const isRecursiveChild = useCallback((parentId: string, targetId: string): boolean => {
    let cur = nodes.find(n => n.id === targetId);
    let limit = 0;
    while (cur?.parentId && limit < 20) {
      if (cur.parentId === parentId) return true;
      cur = nodes.find(n => n.id === cur!.parentId);
      limit++;
    }
    return false;
  }, [nodes]);

  const handleDragStart = useCallback((e: React.DragEvent, nodeId: string) => {
    setDraggedNodeId(nodeId);
    e.dataTransfer.setData('text/plain', nodeId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, nodeId: string) => {
    e.preventDefault();
    if (!draggedNodeId || draggedNodeId === nodeId) return;
    if (isRecursiveChild(draggedNodeId, nodeId)) { e.dataTransfer.dropEffect = 'none'; return; }
    setDraggedOverNodeId(nodeId);
    e.dataTransfer.dropEffect = 'move';
  }, [draggedNodeId, isRecursiveChild]);

  const handleDragLeave = useCallback(() => setDraggedOverNodeId(null), []);

  const handleDrop = useCallback((e: React.DragEvent, targetNodeId: string) => {
    e.preventDefault();
    setDraggedOverNodeId(null);
    if (!draggedNodeId || draggedNodeId === targetNodeId) return;
    if (isRecursiveChild(draggedNodeId, targetNodeId)) return;
    moveNode(workspaceId, draggedNodeId, targetNodeId);
    setDraggedNodeId(null);
    triggerSave();
  }, [draggedNodeId, workspaceId, moveNode, isRecursiveChild]);

  const handleDropOnRoot = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedNodeId) return;
    moveNode(workspaceId, draggedNodeId, null);
    setDraggedNodeId(null);
    triggerSave();
  }, [draggedNodeId, workspaceId, moveNode]);

  const handleCloseTab = useCallback((e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    closeTab(tabId);
  }, [closeTab]);

  const openCreateDatabaseDialog = useCallback(() => {
    setEditingDatabase(null);
    setDatabaseDialogOpen(true);
  }, []);

  const openEditDatabaseDialog = useCallback(() => {
    setEditingDatabase(activeDatabase);
    setDatabaseDialogOpen(true);
  }, [activeDatabase]);

  const handleSaveDatabase = useCallback(async (input: { name: string; description: string }) => {
    if (editingDatabase) {
      await updateDatabase(workspaceId, editingDatabase.id, input);
      return;
    }
    await createDatabase(workspaceId, input);
  }, [createDatabase, editingDatabase, updateDatabase, workspaceId]);

  const handleDeleteDatabase = useCallback(async () => {
    if (!activeDatabase || databases.length <= 1) return;
    if (!confirm(`Delete database "${activeDatabase.name}" and all nodes inside it?`)) return;
    await deleteDatabase(workspaceId, activeDatabase.id);
  }, [activeDatabase, databases.length, deleteDatabase, workspaceId]);

  const wordCount = activeNode ? (activeNode.content.replace(/<[^>]*>/g, '').trim().length || 0) : 0;

  if (loading && !loaded) {
    return <div className="flex items-center justify-center h-full text-muted-foreground text-sm">加载中...</div>;
  }

  return (
    <div className="w-full h-full bg-background font-sans text-foreground antialiased">
      <ResizablePanelGroup
        orientation="horizontal"
        id="database-panel-group"
        defaultLayout={loadPanelLayout() ?? DEFAULT_PANEL_LAYOUT}
        onLayoutChanged={(layout: Layout) => localStorage.setItem(PANEL_LAYOUT_KEY, JSON.stringify(layout))}
        resizeTargetMinimumSize={{ coarse: 28, fine: 14 }}
        className="h-full overflow-hidden"
      >

      {/* Sidebar */}
      <ResizablePanel
        id="sidebar"
        panelRef={sidebarPanelRef}
        defaultSize={formatPanelSize(DEFAULT_PANEL_LAYOUT.sidebar)}
        minSize={formatPanelSize(SIDEBAR_MIN_SIZE)}
        maxSize={formatPanelSize(SIDEBAR_MAX_SIZE)}
        collapsible
        collapsedSize="0%"
        className="h-full min-w-0 bg-sidebar border-r border-border flex flex-col"
      >
        {/* Sidebar header */}
        <div className="px-4 py-3 border-b border-border bg-sidebar/80 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-muted to-muted-foreground/20 flex items-center justify-center font-bold text-base text-foreground border border-muted-foreground/20">📁</div>
            <div className="hidden">
              <span className="text-xs font-bold text-foreground tracking-tight">知识库</span>
              <span className="text-[10px] text-muted-foreground font-medium font-mono leading-none mt-0.5">Database</span>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger className="min-w-0 flex-1 flex items-center justify-between gap-2 rounded-lg px-1.5 py-1 text-left hover:bg-accent outline-none" title={activeDatabase?.name ?? 'Database'}>
                <div className="min-w-0 flex flex-col">
                  <span className="text-xs font-bold text-foreground tracking-tight truncate">{activeDatabase?.name ?? 'Database'}</span>
                  <span className="text-[10px] text-muted-foreground font-medium font-mono leading-none mt-0.5">Database</span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                {databases.map((database) => (
                  <DropdownMenuItem key={database.id} onClick={() => { if (database.id !== activeDatabaseId) void setActiveDatabaseId(workspaceId, database.id); }} className="cursor-pointer">
                    <Database className="w-4 h-4" />
                    <span className="truncate flex-1">{database.name}</span>
                    {database.id === activeDatabaseId && <Check className="w-4 h-4" />}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={openCreateDatabaseDialog} className="cursor-pointer">
                  <Plus className="w-4 h-4" />
                  <span>Create database</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={openEditDatabaseDialog} disabled={!activeDatabase} className="cursor-pointer">
                  <Edit2 className="w-4 h-4" />
                  <span>Edit database</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDeleteDatabase} disabled={!activeDatabase || databases.length <= 1} variant="destructive" className="cursor-pointer">
                  <Trash2 className="w-4 h-4" />
                  <span>Delete database</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Tree content */}
        <div className="flex-1 overflow-y-auto px-3.5 py-4" onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }} onDrop={handleDropOnRoot}>
          <div className="mb-6">
            <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground px-1 mb-2.5 uppercase tracking-wider">
              <span>知识目录树</span>
              <span>({activeNodes.length})</span>
            </div>

            <div className="px-1 mb-4 flex items-center gap-2 relative" ref={newDropdownRef}>
              <div className="relative flex-1">
                <input type="text" placeholder="过滤文档标题..." value={sidebarSearch}
                  onChange={(e) => setSidebarSearch(e.target.value)}
                  className="w-full text-xs bg-background border border-border rounded-lg px-2.5 py-1.5 pr-7 text-foreground focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/60" />
                {sidebarSearch ? (
                  <button onClick={() => setSidebarSearch('')} className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
                ) : (
                  <SlidersHorizontal className="absolute right-2 top-2.5 w-3 h-3 text-muted-foreground/60 pointer-events-none" />
                )}
              </div>
              <button onClick={() => setNewDropdownOpen(!newDropdownOpen)}
                className="h-8 w-8 rounded-lg bg-muted hover:bg-muted/80 border border-border hover:border-muted-foreground/40 text-foreground transition-all cursor-pointer flex items-center justify-center shrink-0" title="新建">
                <Plus className="w-4 h-4" />
              </button>
              {newDropdownOpen && (
                <div className="absolute right-1 top-[calc(100%+4px)] w-36 bg-popover border border-border rounded-lg shadow-2xl py-1 z-50">
                  <button onClick={() => { handleAddChild(null, 'folder'); setNewDropdownOpen(false); }}
                    className="w-full text-left px-3 py-1.5 flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer">
                    <span className="text-sm">📂</span><span className="font-medium">新建文件夹</span>
                  </button>
                  <button onClick={() => { handleAddChild(null, 'document'); setNewDropdownOpen(false); }}
                    className="w-full text-left px-3 py-1.5 flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer">
                    <span className="text-sm">📝</span><span className="font-medium">新建文档</span>
                  </button>
                </div>
              )}
            </div>

            {rootNodes.length === 0 ? (
              <div className="px-2 py-6 text-center text-xs text-muted-foreground italic">{sidebarSearch ? '未匹配到任何项' : '没有任何页面，点击上方新建'}</div>
            ) : (
              <div className="space-y-0.5">
                <NestedTree
                  nodes={rootNodes}
                  getNodeId={(node) => node.id}
                  getChildren={(node) => activeNodes.filter((item) => item.parentId === node.id)}
                  activeId={activeId}
                  expandedIds={openFolders}
                  draggedOverId={draggedOverNodeId}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  shouldRenderChildren={(_, state) => state.isExpanded}
                  renderNode={({ node, state, rowProps, children }) => (
                    <DatabaseTreeNode
                      node={node}
                      state={state}
                      rowProps={rowProps}
                      onSelect={setActiveId}
                      onAddChild={handleAddChild}
                      onDelete={(id) => { trashNode(workspaceId, id); triggerSave(); }}
                      onRename={handleRename}
                      onUpdateIcon={(id, icon) => { updateIcon(workspaceId, id, icon); triggerSave(); }}
                      onToggleExpand={toggleFolder}
                    >
                      {children}
                    </DatabaseTreeNode>
                  )}
                />
              </div>
            )}
          </div>

          {recentIds.length > 0 && (
            <div className="mb-6 pt-4 border-t border-border">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground px-1 mb-2 uppercase tracking-wider">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" /><span>最近编辑</span>
              </div>
              <div className="space-y-1">
                {recentIds.map(id => nodes.find(n => n.id === id && !n.isTrash)).filter((n): n is DocNode => !!n).map(node => (
                  <button key={node.id} onClick={() => setActiveId(node.id)}
                    className={cn("w-full text-left p-1.5 rounded-lg flex items-center gap-2 text-xs transition-colors",
                      activeId === node.id ? "bg-accent text-foreground font-semibold" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground")}>
                    <span className="text-sm shrink-0 select-none">{node.icon || '📝'}</span>
                    <span className="truncate flex-1">{node.title || '未命名文档'}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar bottom */}
        <div className="p-3.5 border-t border-border bg-sidebar flex items-center gap-3 shrink-0">
          <button onClick={() => setIsSearchOpen(true)}
            className="flex-1 flex items-center justify-between bg-background hover:bg-muted border border-border text-muted-foreground hover:text-foreground transition-all h-11 px-4 rounded-full text-xs cursor-pointer shadow-sm">
            <div className="flex items-center gap-2"><Search className="w-4 h-4 text-muted-foreground" /><span className="font-semibold text-muted-foreground">全局搜索</span></div>
            <span className="bg-sidebar text-muted-foreground text-[10px] font-mono font-medium px-2 py-0.5 rounded-full border border-border scale-90">⌘K</span>
          </button>
          <button onClick={() => setIsTrashOpen(true)}
            className="relative w-11 h-11 shrink-0 flex items-center justify-center rounded-full bg-background hover:bg-muted text-muted-foreground hover:text-rose-400 border border-border transition-all cursor-pointer shadow-sm group" title="回收站">
            <Trash className="w-4 h-4 text-rose-500 transition-transform group-hover:scale-110" />
            {nodes.filter(n => n.isTrash).length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-rose-600 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-semibold border border-sidebar shadow-sm">
                {nodes.filter(n => n.isTrash).length}
              </span>
            )}
          </button>
        </div>
      </ResizablePanel>
      <ResizableHandle withHandle className="z-20 w-1 hover:bg-ring/60 after:w-4" />

      {/* Main editor area */}
      <ResizablePanel
        id="main"
        defaultSize={formatPanelSize(DEFAULT_PANEL_LAYOUT.main)}
        minSize={formatPanelSize(MAIN_MIN_SIZE)}
        className="flex flex-col h-full min-w-0 overflow-hidden bg-background relative"
      >
        {showSaveSuccess && (
          <div className="absolute top-4 right-1/2 translate-x-1/2 bg-card border border-border text-foreground text-xs font-semibold px-4 py-2 rounded-full flex items-center gap-2 shadow-2xl z-50">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /><span>内容已自动保存</span>
          </div>
        )}

        {/* Tabs bar */}
        <div className="flex items-center justify-between bg-muted/50 border-b border-border px-4 min-h-[44px] select-none z-10 shrink-0">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-1 flex-1 pr-4">
            {openTabs.map((tabId) => {
              const tabNode = nodes.find(n => n.id === tabId);
              if (!tabNode) return null;
              return (
                <div key={tabId} onClick={() => setActiveId(tabId)}
                  className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-all shrink-0 group border",
                    activeId === tabId ? "bg-card text-foreground border-border font-semibold" : "text-muted-foreground hover:text-foreground hover:bg-muted border-transparent")}>
                  <span className="text-sm select-none shrink-0">{tabNode.icon || '📝'}</span>
                  <span className="truncate max-w-[120px]">{tabNode.title || '未命名文档'}</span>
                  <button onClick={(e) => handleCloseTab(e, tabId)}
                    className="p-0.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors ml-1 opacity-60 group-hover:opacity-100">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
            <button onClick={() => handleAddChild(null)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors ml-1 cursor-pointer shrink-0">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Top nav bar */}
        <div className="h-14 px-6 border-b border-border flex items-center justify-between bg-background/80 backdrop-blur-md sticky top-0 z-10 select-none shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => sidebarPanelRef.current?.isCollapsed() ? sidebarPanelRef.current?.expand() : sidebarPanelRef.current?.collapse()}
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors mr-1 cursor-pointer">
              <Sidebar className="w-4 h-4" />
            </button>
            {activeNode ? (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                <span>知识库</span>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
                {activeNode.parentId && (
                  <>
                    <span onClick={() => activeNode.parentId && setActiveId(activeNode.parentId)}
                      className="hover:text-foreground hover:underline cursor-pointer">
                      {nodes.find(n => n.id === activeNode.parentId)?.title || '母目录'}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
                  </>
                )}
                <span className="text-foreground font-semibold truncate max-w-[180px]">{activeNode.title || '当前文档'}</span>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground font-medium">多层级知识树</div>
            )}
          </div>

          {activeNode && (
            <div className="flex items-center gap-4">
              <div className="flex bg-card border border-border p-1 rounded-xl shrink-0">
                <button onClick={() => handleModeToggle('notion')}
                  className={cn("flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer",
                    editorMode === 'notion' ? "bg-muted text-foreground font-bold" : "text-muted-foreground hover:text-foreground")}>
                  <Layers className="w-3.5 h-3.5" /><span>Notion 编辑器</span>
                </button>
                <button onClick={() => handleModeToggle('markdown')}
                  className={cn("flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer",
                    editorMode === 'markdown' ? "bg-muted text-foreground font-bold" : "text-muted-foreground hover:text-foreground")}>
                  <BookOpen className="w-3.5 h-3.5" /><span>Markdown 编辑器</span>
                </button>
              </div>
              <div className="w-[1px] h-5 bg-border" />
              <div className="relative" ref={settingsDropdownRef}>
                <button onClick={() => setSettingsDropdownOpen(!settingsDropdownOpen)}
                  className="w-9 h-9 rounded-xl border border-border hover:border-muted-foreground/40 bg-card text-muted-foreground hover:text-foreground transition-all cursor-pointer flex items-center justify-center shrink-0">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
                {settingsDropdownOpen && (
                  <div className="absolute right-0 top-[calc(100%+6px)] w-56 bg-popover border border-border rounded-xl shadow-2xl py-2 z-50 text-left">
                    <div className="px-3.5 py-1.5 border-b border-border bg-muted/50 text-muted-foreground text-[10px] font-bold uppercase tracking-wider select-none mb-1">排版风格与字体</div>
                    {([
                      ['sans', '无衬线现代 (Sans)', 'font-sans'],
                      ['serif', '衬线优雅风格 (Serif)', 'font-serif'],
                      ['mono', '程序员等宽 (Mono)', 'font-mono'],
                    ] as const).map(([t, label, fontClass]) => (
                      <button key={t} onClick={() => { setTheme(t as 'sans' | 'serif' | 'mono'); setSettingsDropdownOpen(false); }}
                        className={cn("w-full text-left px-3.5 py-2 flex items-center justify-between text-xs transition-colors cursor-pointer",
                          theme === t ? "text-foreground font-semibold bg-accent" : "text-muted-foreground hover:text-foreground hover:bg-accent/50")}>
                        <div className="flex items-center gap-2">
                          <span className={cn("text-xs bg-muted text-foreground px-1.5 py-0.5 rounded border border-border font-medium", fontClass)}>Ag</span>
                          <span className={fontClass}>{label}</span>
                        </div>
                        {theme === t && <Check className="w-3.5 h-3.5 text-foreground" />}
                      </button>
                    ))}
                    <div className="h-[1px] bg-border my-1.5" />
                    <div className="px-3.5 py-1 bg-muted/30 text-muted-foreground text-[10px] font-bold uppercase tracking-wider select-none mb-1">页面宽度</div>
                    <button onClick={() => { setIsFullWidth(!isFullWidth); setSettingsDropdownOpen(false); }}
                      className={cn("w-full text-left px-3.5 py-2 flex items-center justify-between text-xs transition-colors cursor-pointer",
                        isFullWidth ? "text-foreground font-semibold bg-accent" : "text-muted-foreground hover:text-foreground hover:bg-accent/50")}>
                      <div className="flex items-center gap-2">
                        {isFullWidth ? <Minimize2 className="w-3.5 h-3.5 text-muted-foreground" /> : <Maximize2 className="w-3.5 h-3.5 text-muted-foreground" />}
                        <span>{isFullWidth ? "还原常规宽度" : "宽尺寸自适应"}</span>
                      </div>
                      {isFullWidth && <Check className="w-3.5 h-3.5 text-foreground" />}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        {activeNode ? (
          <div className="flex-1 overflow-y-auto w-full flex flex-col">
            <div className="w-full h-44 shrink-0 relative group border-b border-border"
              style={{ background: activeNode.cover || 'linear-gradient(to right, #0284c7, #06b6d4)' }}>
              <div className="absolute bottom-3 right-4 opacity-0 group-hover:opacity-100 transition-opacity bg-card/90 backdrop-blur-md rounded-xl p-1.5 border border-border flex items-center gap-1 shadow-xl">
                <span className="text-[10px] text-muted-foreground font-bold px-2">封面：</span>
                {PRESET_COVERS.map((preset, idx) => (
                  <button key={idx} onClick={() => { updateCover(workspaceId, activeNode.id, preset); triggerSave(); }}
                    style={{ background: preset }}
                    className={cn("w-4 h-4 rounded-full border hover:scale-125 transition-transform cursor-pointer",
                      activeNode.cover === preset ? "border-white scale-110" : "border-transparent")} />
                ))}
              </div>
            </div>

            <div className={cn("flex-1 mx-auto px-6 md:px-12 py-8 flex flex-col w-full", isFullWidth ? "max-w-none" : "max-w-4xl")}>
              <div className="mb-6 relative group select-text">
                <span className="text-4xl absolute -top-16 left-0 select-none bg-card p-2.5 rounded-2xl shadow-xl border border-border">
                  {activeNode.icon || '📝'}
                </span>
                <div className="text-[11px] text-muted-foreground font-semibold mb-2 flex items-center gap-1 mt-4">
                  <Sparkles className="w-3.5 h-3.5 text-muted-foreground/60" /><span>自动保存已开启</span>
                </div>
                <input type="text" value={activeNode.title}
                  onChange={(e) => { renameNode(workspaceId, activeNode.id, e.target.value); triggerSave(); }}
                  placeholder="未命名文档"
                  className={cn("w-full text-3xl md:text-4xl font-extrabold text-foreground border-none outline-none focus:ring-0 p-0 tracking-tight bg-transparent placeholder:text-muted-foreground/40 select-text",
                    theme === 'serif' && 'font-serif', theme === 'mono' && 'font-mono')} />
              </div>

              <div className="flex-1 min-h-0 select-text">
                {editorMode === 'notion' ? (
                  <NotionEditor content={activeNode.content} onChange={(html) => { updateContent(workspaceId, activeNode.id, html); triggerSave(); }} theme={theme} />
                ) : (
                  <MarkdownEditor contentMarkdown={activeNode.content} onChange={(md) => { updateContent(workspaceId, activeNode.id, md); triggerSave(); }} theme={theme} />
                )}
              </div>

              <div className="sticky bottom-0 bg-background border-t border-border py-3 px-6 md:px-12 flex flex-col sm:flex-row items-center justify-between text-[11px] text-muted-foreground font-medium gap-2">
                <div className="flex items-center gap-5">
                  <span>字数：<strong className="text-foreground">{wordCount}</strong></span>
                  <span className="hidden sm:inline">创建：{new Date(activeNode.createdAt).toLocaleDateString()}</span>
                  <span>修改：{new Date(activeNode.updatedAt).toLocaleTimeString()}</span>
                </div>
                <div className="flex items-center gap-1.5 text-foreground bg-card border border-border px-3 py-1 rounded-full font-semibold shrink-0">
                  <FileCheck className="w-3 h-3 text-emerald-500 animate-pulse" /><span>SAVED</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-background select-none text-center">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-muted to-muted/80 border border-border flex items-center justify-center text-4xl mb-6 shadow-md shadow-black/10 text-muted-foreground animate-bounce">📁</div>
            <h2 className="text-xl font-bold text-foreground tracking-tight">知识编辑器</h2>
            <p className="text-xs text-muted-foreground mt-1.5 max-w-[340px] leading-relaxed">
              点击左侧目录树中的页面开始编辑，或点击上方按钮创建新文档。
            </p>
            <div className="mt-8 bg-card border border-border rounded-2xl p-4 shadow-xl max-w-sm w-full">
              <div className="text-[10px] font-bold text-muted-foreground mb-2.5 uppercase tracking-wider text-left">快捷键</div>
              <div className="space-y-1.5 font-medium text-xs text-muted-foreground">
                <div className="flex items-center justify-between text-[11px]">
                  <span>全局搜索</span>
                  <div className="flex items-center gap-0.5">
                    <kbd className="bg-background border border-border rounded px-1.5 py-0.2 text-[9px] font-mono text-muted-foreground">Ctrl</kbd>+<kbd className="bg-background border border-border rounded px-1.5 py-0.2 text-[9px] font-mono text-muted-foreground">K</kbd>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span>编辑器模式切换</span>
                  <span className="text-muted-foreground/60">右上角标签</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span>嵌套归档</span>
                  <span className="text-muted-foreground/60">侧边栏拖拽</span>
                </div>
              </div>
            </div>
            <button onClick={() => handleAddChild(null)}
              className="mt-6 px-5 h-10 rounded-xl bg-muted hover:bg-muted/80 border border-border text-foreground font-semibold text-xs cursor-pointer flex items-center gap-2">
              <Plus className="w-4 h-4" /><span>快速创建首篇文档</span>
            </button>
          </div>
        )}
      </ResizablePanel>
      </ResizablePanelGroup>

      <QuickSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} nodes={nodes}
        onSelectNode={(id) => { setActiveId(id); setIsSearchOpen(false); }} />
      <TrashBinModal isOpen={isTrashOpen} onClose={() => setIsTrashOpen(false)} nodes={nodes}
        onRestore={(id) => { restoreNode(workspaceId, id); triggerSave(); }}
        onDeletePermanent={(id) => { deleteNode(workspaceId, id); triggerSave(); }} />
      <DatabaseDialog
        open={databaseDialogOpen}
        database={editingDatabase}
        onOpenChange={setDatabaseDialogOpen}
        onSave={handleSaveDatabase}
      />
    </div>
  );
}
