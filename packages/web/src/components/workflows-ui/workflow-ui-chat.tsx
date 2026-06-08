"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { MessageSquare, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChatPanel } from '@/components/chat/chat-panel';
import { useAgentStore } from '@/stores/agent';
import { useChannelStore } from '@/stores/channel';
import { useWorkspaceStore } from '@/stores/workspace';
import { workspaceIdFromLocation } from '@/lib/routes';
import { sdk } from '@/lib/sdk';
import { cn } from '@/lib/utils';
import type { Channel } from '@agent-spaces/shared';
import type { MentionedAgent } from '@/components/chat/chat-input-utils';
import type { WorkflowUiProject } from '@agent-spaces/sdk';

interface WorkflowUiChatProps {
  project: WorkflowUiProject;
  workspaceId?: string;
  activeFilePath: string;
  fileContent: string;
  onUpdateProject: (updates: Partial<Pick<WorkflowUiProject, 'agentConfigId'>>) => void;
}

export function WorkflowUiChat({
  project,
  workspaceId,
  activeFilePath,
  fileContent,
  onUpdateProject,
}: WorkflowUiChatProps) {
  const t = useTranslations('workflows-ui');
  const [open, setOpen] = useState(false);
  const [channelId, setChannelId] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState(project.agentConfigId ?? '');

  const agents = useAgentStore((s) => s.agents);
  const ensureAgents = useAgentStore((s) => s.ensure);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const { loadChannels, upsertChannel, sendMessage } = useChannelStore();

  const resolvedWorkspaceId = useMemo(() => {
    if (workspaceId) return workspaceId;
    if (typeof window !== 'undefined') {
      const fromLocation = workspaceIdFromLocation(window.location.pathname, window.location.search);
      if (fromLocation) return fromLocation;
    }
    return workspaces[0]?.id ?? null;
  }, [workspaceId, workspaces]);

  useEffect(() => {
    ensureAgents();
  }, [ensureAgents]);

  useEffect(() => {
    setSelectedAgentId(project.agentConfigId ?? '');
  }, [project.agentConfigId]);

  useEffect(() => {
    if (!resolvedWorkspaceId) return;
    loadChannels(resolvedWorkspaceId);
  }, [resolvedWorkspaceId, loadChannels]);

  const buildStorageKey = useCallback((agentId: string) => {
    return `agent-spaces:workflow-ui-chat:${project.id}:${agentId}`;
  }, [project.id]);

  const buildInitialMessage = useCallback(() => {
    const clippedContent = fileContent.slice(0, 6000);
    return [
      t('chat.assistantPrompt', { name: project.name }),
      t('chat.projectId', { id: project.id }),
      t('chat.currentFile', { path: activeFilePath || t('chat.noFile') }),
      '',
      t('chat.fileContentHint'),
      '```',
      clippedContent,
      '```',
    ].join('\n');
  }, [activeFilePath, fileContent, project.id, project.name, t]);

  const findStoredChannel = useCallback((agentId: string): Channel | null => {
    if (typeof window === 'undefined') return null;
    const storedId = window.localStorage.getItem(buildStorageKey(agentId));
    if (!storedId) return null;
    return useChannelStore.getState().channels.find((channel) => channel.id === storedId) ?? null;
  }, [buildStorageKey]);

  const ensureWorkflowChannel = useCallback(async (agentId: string) => {
    if (!resolvedWorkspaceId) return null;

    await loadChannels(resolvedWorkspaceId);
    const stored = findStoredChannel(agentId);
    if (stored) {
      setChannelId(stored.id);
      return stored.id;
    }

    const agent = agents.find((item) => item.id === agentId);
    const channel = await sdk.channel.create(resolvedWorkspaceId, {
      name: t('chat.channelName', { name: project.name }),
      type: 'agent',
      members: [agentId],
      titlePrompt: t('chat.channelTitlePrompt', { name: project.name, path: activeFilePath }),
    });
    upsertChannel(channel);
    setChannelId(channel.id);

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(buildStorageKey(agentId), channel.id);
    }

    const mentionHtml = `<span data-type="mention" data-id="${agentId}" data-label="${agent?.name || agentId}"></span>`;
    sendMessage(
      resolvedWorkspaceId,
      channel.id,
      `${mentionHtml} ${buildInitialMessage()}`,
      [agentId],
      [],
      undefined,
      undefined,
      {
        projectId: project.id,
        activeFilePath,
        projectType: project.type,
        fileContent,
      },
    );

    return channel.id;
  }, [
    activeFilePath,
    agents,
    buildInitialMessage,
    buildStorageKey,
    findStoredChannel,
    loadChannels,
    fileContent,
    project.id,
    project.name,
    project.type,
    resolvedWorkspaceId,
    sendMessage,
    t,
    upsertChannel,
  ]);

  useEffect(() => {
    if (!open || !selectedAgentId) return;
    ensureWorkflowChannel(selectedAgentId);
  }, [ensureWorkflowChannel, open, selectedAgentId]);

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4">
        {open && (
          <div className="flex h-[min(820px,calc(100vh-7rem))] w-[min(520px,calc(100vw-3rem))] flex-col overflow-hidden rounded-lg border bg-background shadow-2xl">
            <div className="flex items-center justify-end border-b px-2 py-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                onClick={() => setOpen(false)}
                title={t('chat.close')}
              >
                <X className="size-4" />
              </Button>
            </div>

            {!resolvedWorkspaceId ? (
              <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
                {t('chat.noWorkspace')}
              </div>
            ) : !selectedAgentId ? (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                {t('chat.selectAgent')}
              </div>
            ) : !channelId ? (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                {t('chat.preparing')}
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-hidden">
                <ChatPanel
                  workspaceId={resolvedWorkspaceId}
                  channelId={channelId}
                  workflowUiContext={{
                    projectId: project.id,
                    activeFilePath,
                    projectType: project.type,
                    fileContent,
                  }}
                  onAgentActivated={(agent: MentionedAgent) => {
                    setSelectedAgentId(agent.id);
                    onUpdateProject({ agentConfigId: agent.id });
                  }}
                />
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className={cn(
            'flex size-14 cursor-pointer items-center justify-center rounded-full shadow-2xl transition-colors',
            open
              ? 'bg-destructive text-destructive-foreground'
              : 'bg-primary text-primary-foreground hover:bg-primary/90',
          )}
          title={open ? t('chat.closeChat') : t('chat.openChat')}
        >
          {open ? <X className="size-6" /> : <MessageSquare className="size-6" />}
        </button>
      </div>
    </>
  );
}
