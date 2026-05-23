'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useDatabaseStore } from '@/stores/database';
import { useLLMStore } from '@/stores/llm';
import type { DatabaseMeta } from '@agent-spaces/shared';
import { DatabaseSidebar } from './database-sidebar';
import { DatabaseDialog } from './database-dialog';
import { DatabaseVectorDialog } from './database-vector-dialog';
import QuickSearchModal from './quick-search-modal';
import TrashBinModal from './trash-bin-modal';

interface Props {
  workspaceId: string;
}

export function DatabaseSidebarPanel({ workspaceId }: Props) {
  const {
    databases, activeDatabaseId, nodes,
    vectorStats, vectorLoading, vectorIndexing, loading, loaded,
    load, loadVectorStats, bindEmbeddingModel, indexVectors,
    restoreNode, deleteNode,
    setActiveId, createDatabase, updateDatabase,
  } = useDatabaseStore();

  const { models, providers, ensure: ensureLLM } = useLLMStore();

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [databaseDialogOpen, setDatabaseDialogOpen] = useState(false);
  const [vectorDialogOpen, setVectorDialogOpen] = useState(false);
  const [editingDatabase, setEditingDatabase] = useState<DatabaseMeta | null>(null);

  useEffect(() => { if (!loaded) load(workspaceId); }, [loaded, load, workspaceId]);

  useEffect(() => {
    if (!vectorDialogOpen) return;
    void ensureLLM();
    if (activeDatabaseId) void loadVectorStats(workspaceId, activeDatabaseId);
  }, [activeDatabaseId, ensureLLM, loadVectorStats, vectorDialogOpen, workspaceId]);

  const triggerSave = useCallback(() => {}, []);

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
    <>
      <DatabaseSidebar
        workspaceId={workspaceId}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenTrash={() => setIsTrashOpen(true)}
        onOpenCreateDatabase={openCreateDatabaseDialog}
        onOpenEditDatabase={openEditDatabaseDialog}
        onOpenVectorDialog={() => setVectorDialogOpen(true)}
        onSave={triggerSave}
      />
      <QuickSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} nodes={nodes}
        onSelectNode={(id) => { setActiveId(id); setIsSearchOpen(false); }} />
      <TrashBinModal isOpen={isTrashOpen} onClose={() => setIsTrashOpen(false)} nodes={nodes}
        onRestore={(id) => { restoreNode(workspaceId, id); }}
        onDeletePermanent={(id) => { deleteNode(workspaceId, id); }} />
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
    </>
  );
}
