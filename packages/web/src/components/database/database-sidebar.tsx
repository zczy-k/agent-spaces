'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, X, ChevronDown, Edit2, Trash2,
  Database, Brain, Check, SlidersHorizontal, Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
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
import { sdk } from '@/lib/sdk';
import type { DocNode } from '@agent-spaces/shared';

interface DatabaseSidebarProps {
  workspaceId: string;
  onOpenCreateDatabase: () => void;
  onOpenEditDatabase: () => void;
  onOpenVectorDialog: () => void;
  onSave: () => void;
}

export function DatabaseSidebar({
  workspaceId,
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

  const t = useTranslations('database');

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
    if (!confirm(t('deleteConfirm', { name: activeDatabase.name }))) return;
    await deleteDatabase(workspaceId, activeDatabase.id);
  }, [activeDatabase, databases.length, deleteDatabase, workspaceId, t]);

  const handleImportMdFiles = useCallback(async (files: File[]) => {
    const { activeDatabaseId } = useDatabaseStore.getState();
    if (!activeDatabaseId) return;
    for (const file of files) {
      const content = await file.text();
      const title = file.name.replace(/\.md$/i, '');
      const node = await sdk.database.createNode(workspaceId, activeDatabaseId, { title, icon: '📝', content, parentId: null });
      useDatabaseStore.setState(s => ({ nodes: [...s.nodes, node] }));
    }
    onSave();
  }, [workspaceId, onSave]);

  return (
    <div className="flex flex-col h-full">
      {/* Sidebar header */}
      <div className="px-4 py-3 border-b border-border bg-sidebar/80 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-muted to-muted-foreground/20 flex items-center justify-center font-bold text-base text-foreground border border-muted-foreground/20">📁</div>
          <div className="hidden">
            <span className="text-xs font-bold text-foreground tracking-tight">{t('knowledgeBase')}</span>
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
                <span>{t('createDatabase')}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onOpenEditDatabase} disabled={!activeDatabase} className="cursor-pointer">
                <Edit2 className="w-4 h-4" />
                <span>{t('editDatabase')}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onOpenVectorDialog} disabled={!activeDatabase} className="cursor-pointer">
                <Brain className="w-4 h-4" />
                <span>{t('vectorSettings')}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDeleteDatabase} disabled={!activeDatabase || databases.length <= 1} variant="destructive" className="cursor-pointer">
                <Trash2 className="w-4 h-4" />
                <span>{t('deleteDatabase')}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tree content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3.5 py-4" onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }} onDrop={handleDropOnRoot}>
        <div className="mb-6">
          <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground px-1 mb-2.5 uppercase tracking-wider">
            <span>{t('sidebarTree')}</span>
            <span>({activeNodes.length})</span>
          </div>

          <div className="px-1 mb-4 flex items-center gap-2 relative" ref={newDropdownRef}>
            <div className="relative flex-1">
              <input type="text" placeholder={t('filterPlaceholder')} value={sidebarSearch}
                onChange={(e) => setSidebarSearch(e.target.value)}
                className="w-full text-xs bg-background border border-border rounded-lg px-2.5 py-1.5 pr-7 text-foreground focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/60" />
              {sidebarSearch ? (
                <button onClick={() => setSidebarSearch('')} className="absolute right-2 top-2 text-muted-foreground hover:text-foreground cursor-pointer"><X className="w-3.5 h-3.5" /></button>
              ) : (
                <SlidersHorizontal className="absolute right-2 top-2.5 w-3 h-3 text-muted-foreground/60 pointer-events-none" />
              )}
            </div>
            <button onClick={() => setNewDropdownOpen(!newDropdownOpen)}
              className="h-8 w-8 rounded-lg bg-muted hover:bg-muted/80 border border-border hover:border-muted-foreground/40 text-foreground transition-all cursor-pointer flex items-center justify-center shrink-0" title={t('newItem')}>
              <Plus className="w-4 h-4" />
            </button>
            {newDropdownOpen && (
              <div className="absolute right-1 top-[calc(100%+4px)] w-36 bg-popover border border-border rounded-lg shadow-2xl py-1 z-50">
                <button onClick={() => { handleAddChild(null, 'folder'); setNewDropdownOpen(false); }}
                  className="w-full text-left px-3 py-1.5 flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer">
                  <span className="text-sm">📂</span><span className="font-medium">{t('newFolder')}</span>
                </button>
                <button onClick={() => { handleAddChild(null, 'document'); setNewDropdownOpen(false); }}
                  className="w-full text-left px-3 py-1.5 flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer">
                  <span className="text-sm">📝</span><span className="font-medium">{t('newDocument')}</span>
                </button>
                <button onClick={() => { setImportOpen(true); setNewDropdownOpen(false); }}
                  className="w-full text-left px-3 py-1.5 flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer">
                  <span className="text-sm">📥</span><span className="font-medium">{t('importMarkdown')}</span>
                </button>
              </div>
            )}
          </div>

          {rootNodes.length === 0 ? (
            <div className="px-2 py-6 text-center text-xs text-muted-foreground italic">{sidebarSearch ? t('noMatch') : t('emptyState')}</div>
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
              <Clock className="w-3.5 h-3.5 text-muted-foreground" /><span>{t('recentEdits')}</span>
            </div>
            <div className="space-y-1">
              {recentIds.map(id => nodes.find(n => n.id === id && !n.isTrash)).filter((n): n is DocNode => !!n).map(node => (
                <button key={node.id} onClick={() => setActiveId(node.id)}
                  className={cn("w-full text-left p-1.5 rounded-lg flex items-center gap-2 text-xs transition-colors",
                    activeId === node.id ? "bg-accent text-foreground font-semibold" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground")}>
                  <span className="text-sm shrink-0 select-none">{node.icon || '📝'}</span>
                  <span className="truncate flex-1">{node.title || t('untitled')}</span>
                </button>
              ))}
            </div>
          </div>
        )}
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
    </div>
  );
}
