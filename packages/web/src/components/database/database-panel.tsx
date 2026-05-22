'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import type { PanelImperativeHandle, Layout } from 'react-resizable-panels';
import { useDatabaseStore } from '@/stores/database';
import { useLLMStore } from '@/stores/llm';
import type { DatabaseMeta } from '@agent-spaces/shared';
import { DatabaseDialog } from './database-dialog';
import { DatabaseVectorDialog } from './database-vector-dialog';
import { DatabaseSidebar } from './database-sidebar';
import { DatabaseMainPanel } from './database-main-panel';
import QuickSearchModal from './quick-search-modal';
import TrashBinModal from './trash-bin-modal';
import {
  DEFAULT_PANEL_LAYOUT,
  SIDEBAR_MIN_SIZE,
  SIDEBAR_MAX_SIZE,
  MAIN_MIN_SIZE,
  formatPanelSize,
  loadPanelLayout,
} from './database-constants';

interface Props {
  workspaceId: string;
}

export default function DatabasePanel({ workspaceId }: Props) {
  const {
    databases, activeDatabaseId,
    nodes,
    vectorStats, vectorLoading, vectorIndexing, loading, loaded,
    load, loadVectorStats, bindEmbeddingModel, indexVectors,
    restoreNode, deleteNode,
    setActiveId, createDatabase, updateDatabase,
  } = useDatabaseStore();

  const { models, providers, ensure: ensureLLM } = useLLMStore();

  const sidebarPanelRef = useRef<PanelImperativeHandle>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [databaseDialogOpen, setDatabaseDialogOpen] = useState(false);
  const [vectorDialogOpen, setVectorDialogOpen] = useState(false);
  const [editingDatabase, setEditingDatabase] = useState<DatabaseMeta | null>(null);

  useEffect(() => { if (!loaded) load(workspaceId); }, [loaded, load, workspaceId]);

  useEffect(() => {
    if (!vectorDialogOpen) return;
    void ensureLLM();
    if (activeDatabaseId) void loadVectorStats(workspaceId, activeDatabaseId);
  }, [activeDatabaseId, ensureLLM, loadVectorStats, vectorDialogOpen, workspaceId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setIsSearchOpen(true); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const triggerSave = useCallback(() => {
    setShowSaveSuccess(true);
    setTimeout(() => setShowSaveSuccess(false), 1200);
  }, []);

  const activeDatabase = databases.find((d) => d.id === activeDatabaseId) ?? databases[0] ?? null;

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

  const handleBindEmbeddingModel = useCallback(async (modelId: string | null) => {
    if (!activeDatabase) return;
    await bindEmbeddingModel(workspaceId, activeDatabase.id, modelId);
  }, [activeDatabase, bindEmbeddingModel, workspaceId]);

  const handleIndexVectors = useCallback(async () => {
    if (!activeDatabase) return;
    await indexVectors(workspaceId, activeDatabase.id);
  }, [activeDatabase, indexVectors, workspaceId]);

  if (loading && !loaded) {
    return <div className="flex items-center justify-center h-full text-muted-foreground text-sm">加载中...</div>;
  }

  return (
    <div className="w-full h-full bg-background font-sans text-foreground antialiased">
      <ResizablePanelGroup
        orientation="horizontal"
        id="database-panel-group"
        defaultLayout={loadPanelLayout() ?? DEFAULT_PANEL_LAYOUT}
        onLayoutChanged={(layout: Layout) => localStorage.setItem('database-panel-layout', JSON.stringify(layout))}
        resizeTargetMinimumSize={{ coarse: 28, fine: 14 }}
        className="h-full overflow-hidden"
      >
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
          <DatabaseSidebar
            workspaceId={workspaceId}
            onOpenSearch={() => setIsSearchOpen(true)}
            onOpenTrash={() => setIsTrashOpen(true)}
            onOpenCreateDatabase={openCreateDatabaseDialog}
            onOpenEditDatabase={openEditDatabaseDialog}
            onOpenVectorDialog={() => setVectorDialogOpen(true)}
            onSave={triggerSave}
          />
        </ResizablePanel>
        <ResizableHandle withHandle className="z-20 w-1 hover:bg-ring/60 after:w-4" />
        <ResizablePanel
          id="main"
          defaultSize={formatPanelSize(DEFAULT_PANEL_LAYOUT.main)}
          minSize={formatPanelSize(MAIN_MIN_SIZE)}
          className="flex flex-col h-full min-w-0 overflow-hidden bg-background relative"
        >
          <DatabaseMainPanel
            workspaceId={workspaceId}
            sidebarPanelRef={sidebarPanelRef}
            showSaveSuccess={showSaveSuccess}
            onSave={triggerSave}
          />
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
      <DatabaseVectorDialog
        open={vectorDialogOpen}
        database={activeDatabase}
        models={models}
        providers={providers}
        stats={vectorStats}
        loading={vectorLoading}
        indexing={vectorIndexing}
        onOpenChange={setVectorDialogOpen}
        onBind={handleBindEmbeddingModel}
        onIndex={handleIndexVectors}
      />
    </div>
  );
}
