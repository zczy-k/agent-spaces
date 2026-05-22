'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, Trash, X, Search, ChevronDown, Edit2, Trash2,
  Database, Brain, Check, SlidersHorizontal, Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDatabaseStore } from '@/stores/database';
import { NestedTree } from '@/components/editor/file-tree';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DatabaseTreeNode } from './database-tree-node';
import { ImportFileDialog } from '@/components/editor/import-file-dialog';
import { fetchWithAuth } from '@/lib/auth';
import type { DocNode, DatabaseMeta } from '@agent-spaces/shared';

interface DatabaseSidebarProps {
  workspaceId: string;
  onOpenSearch: () => void;
  onOpenTrash: () => void;
  onOpenCreateDatabase: () => void;
  onOpenEditDatabase: () => void;
  onOpenVectorDialog: () => void;
  onSave: () => void;
}

export function DatabaseSidebar({
  workspaceId,
  onOpenSearch,
  onOpenTrash,
  onOpenCreateDatabase,
  onOpenEditDatabase,
  onOpenVectorDialog,
  onSave,
}: DatabaseSidebarProps) {
  const {
    databases, activeDatabaseId,
    nodes, activeId, openFolders, sidebarSearch, recentIds,
    setActiveDatabaseId, deleteDatabase,
    setActiveId, createNode, renameNode, updateIcon, trashNode, toggleFolder, setSidebarSearch,
  } = useDatabaseStore();

  const [newDropdownOpen, setNewDropdownOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [draggedOverNodeId, setDraggedOverNodeId] = useState<string | null>(null);
  const newDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (newDropdownRef.current && !newDropdownRef.current.contains(e.target as Node)) setNewDropdownOpen(false);
    };
    if (newDropdownOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [newDropdownOpen]);

  const activeDatabase = databases.find((d) => d.id === activeDatabaseId) ?? databases[0] ?? null;
  const activeNodes = nodes.filter(n => !n.isTrash);
  const filteredNodes = activeNodes.filter(n => sidebarSearch ? (n.title || '').toLowerCase().includes(sidebarSearch.toLowerCase()) : true);
  const rootNodes = filteredNodes.filter(n => n.parentId === null);

  const handleAddChild = useCallback(async (parentId: string | null, type?: 'folder' | 'document') => {
    await createNode(workspaceId, parentId, type);
    onSave();
  }, [workspaceId, createNode, onSave]);

  const handleRename = useCallback((nodeId: string, title: string) => {
    let clean = title;
    const node = nodes.find(n => n.id === nodeId);
    if (node?.icon && clean.trim().startsWith(node.icon)) clean = clean.trim().substring(node.icon.length).trim();
    renameNode(workspaceId, nodeId, clean);
    onSave();
  }, [workspaceId, nodes, renameNode, onSave]);

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
    useDatabaseStore.getState().moveNode(workspaceId, draggedNodeId, targetNodeId);
    setDraggedNodeId(null);
    onSave();
  }, [draggedNodeId, workspaceId, isRecursiveChild, onSave]);

  const handleDropOnRoot = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedNodeId) return;
    useDatabaseStore.getState().moveNode(workspaceId, draggedNodeId, null);
    setDraggedNodeId(null);
    onSave();
  }, [draggedNodeId, workspaceId, onSave]);

  const handleDeleteDatabase = useCallback(async () => {
    if (!activeDatabase || databases.length <= 1) return;
    if (!confirm(`Delete database "${activeDatabase.name}" and all nodes inside it?`)) return;
    await deleteDatabase(workspaceId, activeDatabase.id);
  }, [activeDatabase, databases.length, deleteDatabase, workspaceId]);

  const handleImportMdFiles = useCallback(async (files: File[]) => {
    const { activeDatabaseId } = useDatabaseStore.getState();
    if (!activeDatabaseId) return;
    for (const file of files) {
      const content = await file.text();
      const title = file.name.replace(/\.md$/i, '');
      const res = await fetchWithAuth(
        `/api/workspaces/${workspaceId}/database?databaseId=${encodeURIComponent(activeDatabaseId)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, icon: '📝', content, parentId: null }),
        },
      );
      if (!res.ok) throw new Error('Failed to create node');
      const node = await res.json() as DocNode;
      useDatabaseStore.setState(s => ({ nodes: [...s.nodes, node] }));
    }
    onSave();
  }, [workspaceId, onSave]);

  return (
    <>
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
              <DropdownMenuItem onClick={onOpenCreateDatabase} className="cursor-pointer">
                <Plus className="w-4 h-4" />
                <span>Create database</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onOpenEditDatabase} disabled={!activeDatabase} className="cursor-pointer">
                <Edit2 className="w-4 h-4" />
                <span>Edit database</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onOpenVectorDialog} disabled={!activeDatabase} className="cursor-pointer">
                <Brain className="w-4 h-4" />
                <span>Vector settings</span>
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
                <button onClick={() => { setImportOpen(true); setNewDropdownOpen(false); }}
                  className="w-full text-left px-3 py-1.5 flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer">
                  <span className="text-sm">📥</span><span className="font-medium">导入 Markdown</span>
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
                    onDelete={(id) => { trashNode(workspaceId, id); onSave(); }}
                    onRename={handleRename}
                    onUpdateIcon={(id, icon) => { updateIcon(workspaceId, id, icon); onSave(); }}
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
        <button onClick={onOpenSearch}
          className="flex-1 flex items-center justify-between bg-background hover:bg-muted border border-border text-muted-foreground hover:text-foreground transition-all h-11 px-4 rounded-full text-xs cursor-pointer shadow-sm">
          <div className="flex items-center gap-2"><Search className="w-4 h-4 text-muted-foreground" /><span className="font-semibold text-muted-foreground">全局搜索</span></div>
          <span className="bg-sidebar text-muted-foreground text-[10px] font-mono font-medium px-2 py-0.5 rounded-full border border-border scale-90">⌘K</span>
        </button>
        <button onClick={onOpenTrash}
          className="relative w-11 h-11 shrink-0 flex items-center justify-center rounded-full bg-background hover:bg-muted text-muted-foreground hover:text-rose-400 border border-border transition-all cursor-pointer shadow-sm group" title="回收站">
          <Trash className="w-4 h-4 text-rose-500 transition-transform group-hover:scale-110" />
          {nodes.filter(n => n.isTrash).length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-rose-600 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-semibold border border-sidebar shadow-sm">
              {nodes.filter(n => n.isTrash).length}
            </span>
          )}
        </button>
      </div>

      <ImportFileDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        workspaceId={workspaceId}
        targetPath=""
        onImported={onSave}
        accept={{ 'text/markdown': ['.md'], 'text/x-markdown': ['.md'] }}
        onUploadFiles={handleImportMdFiles}
      />
    </>
  );
}
