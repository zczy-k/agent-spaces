'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { FolderOpen, Hash, ListChecks, Loader2 } from 'lucide-react';
import type { Workspace } from '@agent-spaces/shared';

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="truncate text-foreground ml-auto" title={value}>{value}</span>
    </div>
  );
}

interface WorkspaceInfoSectionProps {
  workspace: Workspace;
  channelCount: number;
  issueCount: number;
}

export function WorkspaceInfoSection({ workspace, channelCount, issueCount }: WorkspaceInfoSectionProps) {
  const t = useTranslations('projectSettings');
  const [autoProcess, setAutoProcess] = useState(workspace.autoProcessIssues === true);
  const [hooksEnabled, setHooksEnabled] = useState(workspace.hooksEnabled !== false);
  const [saving, setSaving] = useState(false);

  const handleToggleAutoProcess = async (checked: boolean) => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoProcessIssues: checked }),
      });
      const updated: Workspace = await res.json();
      setAutoProcess(updated.autoProcessIssues === true);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleHooks = async (checked: boolean) => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hooksEnabled: checked }),
      });
      const updated: Workspace = await res.json();
      setHooksEnabled(updated.hooksEnabled !== false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="space-y-3">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('info.title')}</h4>
        <InfoRow icon={<FolderOpen size={14} />} label={t('info.path')} value={workspace.boundDirs[0] ?? '-'} />
        <InfoRow icon={<Hash size={14} />} label={t('info.channels')} value={String(channelCount)} />
        <InfoRow icon={<ListChecks size={14} />} label={t('info.issues')} value={String(issueCount)} />
      </div>

      <div className="space-y-3">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('automation.title')}</h4>
        <div className="flex items-center justify-between rounded-md border px-3 py-2.5">
          <div className="space-y-0.5 pr-4">
            <Label htmlFor="auto-process" className="text-sm font-medium">
              {t('automation.autoProcess')}
            </Label>
            <p className="text-xs text-muted-foreground">
              {t('automation.autoProcessDescription')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {saving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            <Switch
              id="auto-process"
              checked={autoProcess}
              onCheckedChange={handleToggleAutoProcess}
              disabled={saving}
            />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('hooks.title')}</h4>
        <div className="flex items-center justify-between rounded-md border px-3 py-2.5">
          <div className="space-y-0.5 pr-4">
            <Label htmlFor="hooks-enabled" className="text-sm font-medium">
              {t('hooks.enableHooks')}
            </Label>
            <p className="text-xs text-muted-foreground">
              {t('hooks.enableHooksDescription')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {saving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            <Switch
              id="hooks-enabled"
              checked={hooksEnabled}
              onCheckedChange={handleToggleHooks}
              disabled={saving}
            />
          </div>
        </div>
      </div>
    </>
  );
}
