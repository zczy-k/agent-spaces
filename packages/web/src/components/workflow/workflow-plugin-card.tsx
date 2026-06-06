'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { StoreWorkflowPlugin, WorkflowPlugin } from '@/lib/workflow-plugin-api';
import { Download, RefreshCw, Settings, Trash2 } from 'lucide-react';
import { PluginIcon } from './workflow-plugin-icon';
import { resolveStoreUrl } from '@/lib/agent-store';
import { resolveServerAssetUrl } from '@/lib/server';

export function LocalPluginCard({
  plugin,
  inWorkflow,
  disabled,
  onToggleAction,
  onConfigAction,
  onUninstallAction,
}: {
  plugin: WorkflowPlugin;
  inWorkflow: boolean;
  disabled: boolean;
  onToggleAction: () => void;
  onConfigAction?: () => void;
  onUninstallAction?: () => void;
}) {
  const iconSrc = plugin.iconPath
    ? { type: 'url' as const, url: resolveServerAssetUrl(`/api/plugins/${encodeURIComponent(plugin.id)}/icon`) }
    : { type: 'builtin' as const, variant: 'local' as const };

  return (
    <PluginCardShell
      iconSrc={iconSrc}
      name={plugin.name}
      version={plugin.version}
      description={plugin.description}
      tags={plugin.tags}
      badge={inWorkflow ? '已添加' : '未添加'}
      badgeVariant={inWorkflow ? 'default' : 'secondary'}
      headerExtra={onUninstallAction ? (
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive" onClick={onUninstallAction}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      ) : undefined}
    >
      {plugin.config?.length ? (
        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={onConfigAction}>
          <Settings className="h-3.5 w-3.5" />
        </Button>
      ) : null}
      <Button size="sm" variant={inWorkflow ? 'outline' : 'default'} className="ml-auto h-7 text-xs" disabled={disabled} onClick={onToggleAction}>
        {inWorkflow ? '移除' : '添加到 Workflow'}
      </Button>
    </PluginCardShell>
  );
}

export function StorePluginCard({
  plugin,
  installed,
  installing,
  onInstallAction,
}: {
  plugin: StoreWorkflowPlugin;
  installed: boolean;
  installing: boolean;
  onInstallAction: () => void;
}) {
  const iconSrc = plugin.iconUrl
    ? { type: 'url' as const, url: resolveStoreUrl(plugin.iconUrl) }
    : { type: 'builtin' as const, variant: 'store' as const };

  return (
    <PluginCardShell
      iconSrc={iconSrc}
      name={plugin.name}
      version={plugin.version}
      description={plugin.description}
      tags={plugin.tags}
      badge={installed ? '已安装' : '未安装'}
      badgeVariant={installed ? 'default' : 'outline'}
    >
      {plugin.type ? <Badge variant="secondary" className="text-[10px]">{plugin.type}</Badge> : null}
      <Button
        size="sm"
        variant={installed ? 'outline' : 'default'}
        className="ml-auto h-7 text-xs"
        disabled={installing}
        onClick={onInstallAction}
      >
        {installed ? (
          <>
            <Download className="h-3.5 w-3.5" />
            重新安装
          </>
        ) : installing ? (
          <>
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            安装中
          </>
        ) : (
          <>
            <Download className="h-3.5 w-3.5" />
            安装并添加
          </>
        )}
      </Button>
    </PluginCardShell>
  );
}

function PluginCardShell({
  iconSrc,
  name,
  version,
  description,
  tags,
  badge,
  badgeVariant,
  headerExtra,
  children,
}: {
  iconSrc: Parameters<typeof PluginIcon>[0]['source'];
  name: string;
  version: string;
  description?: string;
  tags?: string[];
  badge: string;
  badgeVariant: 'default' | 'secondary' | 'outline';
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="group flex min-h-[156px] flex-col rounded-md border bg-background p-3">
      <div className="flex items-start gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-muted">
          <PluginIcon source={iconSrc} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{name}</div>
          <div className="text-[11px] text-muted-foreground">v{version}</div>
        </div>
        {headerExtra ? (
          <div className="flex shrink-0 items-center gap-1">
            <Badge variant={badgeVariant} className="group-hover:hidden">{badge}</Badge>
            <div className="hidden group-hover:block">
              {headerExtra}
            </div>
          </div>
        ) : (
          <Badge variant={badgeVariant}>{badge}</Badge>
        )}
      </div>
      <p className="mt-2 line-clamp-3 min-h-[48px] text-xs text-muted-foreground">{description || '无描述'}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {(tags || []).slice(0, 4).map(item => <Badge key={item} variant="outline" className="text-[10px]">{item}</Badge>)}
      </div>
      <div className="mt-auto flex items-center gap-2 pt-3">
        {children}
      </div>
    </div>
  );
}
