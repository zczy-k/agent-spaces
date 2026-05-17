'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useChannelStore } from '@/stores/channel';
import { useIssueStore } from '@/stores/issue';
import { useAgentStore } from '@/stores/agent';
import { AgentDialog } from '@/components/sidebar/agent-dialog';
import { Loader2 } from 'lucide-react';
import type { Workspace, WorkspaceNotificationSettings } from '@agent-spaces/shared';
import { getNotificationPermission, type NotificationPermissionStatus } from '@/lib/native-notification';
import { useWorkspaceStore } from '@/stores/workspace';

import { WorkspaceInfoSection } from './workspace-info-section';
import { NotificationSettingsTab, defaultNotificationSettings } from './notification-settings-tab';
import { WorkspacePromptSection } from './workspace-prompt-section';

interface ProjectSettingsPanelProps {
  workspaceId: string;
}

export function ProjectSettingsPanel({ workspaceId }: ProjectSettingsPanelProps) {
  const t = useTranslations('projectSettings');
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [savedPrompt, setSavedPrompt] = useState('');
  const [loading, setLoading] = useState(true);
  const [agentDialogOpen, setAgentDialogOpen] = useState(false);
  const [notificationDraft, setNotificationDraft] = useState<WorkspaceNotificationSettings>(defaultNotificationSettings());

  const channels = useChannelStore((s) => s.channels);
  const issues = useIssueStore((s) => s.issues);
  const loadChannels = useChannelStore((s) => s.loadChannels);
  const loadIssues = useIssueStore((s) => s.loadIssues);

  const allAgents = useAgentStore((s) => s.agents);
  const botAgents = allAgents.filter((agent) => agent.role === 'bot' && agent.enabled !== false);
  const upsertWorkspace = useWorkspaceStore((s) => s.upsertWorkspace);

  useEffect(() => {
    Promise.all([
      fetch(`/api/workspaces/${workspaceId}`).then((r) => r.json()),
      fetch(`/api/workspaces/${workspaceId}/prompt`).then((r) => r.json()),
      loadChannels(workspaceId),
      loadIssues(workspaceId),
    ])
      .then(([ws, promptData]) => {
        setWorkspace(ws);
        upsertWorkspace(ws);
        setSavedPrompt(promptData.prompt ?? '');
        const ns = ws.notificationSettings ?? defaultNotificationSettings();
        setNotificationDraft(ns);
        setLoading(false);
        // Check native notification permission status
        getNotificationPermission().then((status: NotificationPermissionStatus) => {
          if (status === 'granted' && ns.provider === 'native' && !ns.native?.permissionGranted) {
            const updated = { ...ns, native: { ...ns.native, permissionGranted: true } };
            setNotificationDraft(updated);
            // Update server-side
            fetch(`/api/workspaces/${workspaceId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ notificationSettings: updated }),
            })
              .then((r) => r.json())
              .then((w: Workspace) => {
                setWorkspace(w);
                upsertWorkspace(w);
              });
          }
        });
      })
      .catch(() => setLoading(false));
  }, [workspaceId, loadChannels, loadIssues, upsertWorkspace]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        {t('loading')}
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        {t('workspaceNotFound')}
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="flex items-center px-2 py-1.5 border-b text-xs font-medium text-muted-foreground">
        <span>{t('title')}</span>
      </div>
      <div className="p-4 space-y-6">
        <WorkspaceInfoSection
          workspace={workspace}
          channelCount={channels.length}
          issueCount={issues.length}
        />

        <NotificationSettingsTab
          workspaceId={workspaceId}
          workspace={workspace}
          notificationDraft={notificationDraft}
          setNotificationDraft={setNotificationDraft}
          setWorkspace={setWorkspace}
          botAgents={botAgents}
          agentDialogOpen={agentDialogOpen}
          setAgentDialogOpen={setAgentDialogOpen}
        />

        <WorkspacePromptSection
          workspaceId={workspaceId}
          initialPrompt={savedPrompt}
        />
      </div>
      <AgentDialog
        open={agentDialogOpen}
        onOpenChange={setAgentDialogOpen}
        roleFilter="bot"
      />
    </ScrollArea>
  );
}
