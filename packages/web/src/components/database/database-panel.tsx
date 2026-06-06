'use client';

import React, { useState, useEffect } from 'react';
import { useDatabaseStore } from '@/stores/database';
import { Bot } from 'lucide-react';
import { FloatingBall } from '@/components/common/floating-ball';
import { DatabaseMainPanel } from './database-main-panel';
import { DatabaseAiChat } from './database-ai-chat';

interface Props {
  workspaceId: string;
}

export default function DatabasePanel({ workspaceId }: Props) {
  const { loading, loadedWorkspaceId, load, nodes, restoreNode, deleteNode, setActiveId } = useDatabaseStore();
  const [aiChatOpen, setAiChatOpen] = useState(false);

  useEffect(() => { load(workspaceId); }, [load, workspaceId]);

  if (loading && loadedWorkspaceId !== workspaceId) {
    return <div className="flex items-center justify-center h-full text-muted-foreground text-sm">加载中...</div>;
  }

  return (
    <div className="w-full h-full bg-background font-sans text-foreground antialiased">
      <DatabaseMainPanel
        workspaceId={workspaceId}
        onSave={() => {}}
        trashCount={nodes.filter(n => n.isTrash).length}
        onSelectNode={(id) => setActiveId(id)}
        onRestoreNode={(id) => { restoreNode(workspaceId, id); }}
        onDeleteNode={(id) => { deleteNode(workspaceId, id); }}
      />

      <FloatingBall
        lsKey={`database-ai-ball:${workspaceId}`}
        onClick={() => setAiChatOpen(true)}
        visible={!aiChatOpen}
        className="bg-primary text-primary-foreground shadow-lg border border-primary/20"
      >
        <Bot className="size-5" />
      </FloatingBall>
      {aiChatOpen && (
        <DatabaseAiChat
          workspaceId={workspaceId}
          onClose={() => setAiChatOpen(false)}
          onMinimize={() => setAiChatOpen(false)}
        />
      )}
    </div>
  );
}
