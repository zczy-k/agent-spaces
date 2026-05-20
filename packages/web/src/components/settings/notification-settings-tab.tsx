'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Bell, Bot, CheckCircle2, CircleHelp, Loader2, Monitor, QrCode, RefreshCw, Send } from 'lucide-react';
import { toast } from 'sonner';
import type { AgentConfig, NotificationEventKey, NotificationProvider, Workspace, WorkspaceNotificationSettings } from '@agent-spaces/shared';
import {
  getNotificationPermission,
  isNativeAndroidEnvironment,
  requestNotificationPermission,
  sendNativeNotification,
  type NotificationPermissionStatus,
} from '@/lib/native-notification';
import { useWorkspaceStore } from '@/stores/workspace';

interface WeChatQRCodeState {
  status: 'idle' | 'wait' | 'scaned' | 'confirmed' | 'expired';
  qrcodeImgContent?: string;
  accountId?: string;
  baseUrl?: string;
}

interface NotificationSettingsTabProps {
  workspaceId: string;
  workspace: Workspace;
  notificationDraft: WorkspaceNotificationSettings;
  setNotificationDraft: (draft: WorkspaceNotificationSettings) => void;
  setWorkspace: (ws: Workspace) => void;
  botAgents: AgentConfig[];
  agentDialogOpen: boolean;
  setAgentDialogOpen: (open: boolean) => void;
}

const NOTIFICATION_EVENTS: Array<{ value: NotificationEventKey; labelKey: string }> = [
  { value: 'issue_started', labelKey: 'events.issueStarted' },
  { value: 'issue_completed', labelKey: 'events.issueCompleted' },
  { value: 'issue_task_completed', labelKey: 'events.taskCompleted' },
  { value: 'channel_agent_completed', labelKey: 'events.channelAgentCompleted' },
];

function defaultNotificationSettings(): WorkspaceNotificationSettings {
  return {
    enabled: false,
    provider: 'lark',
    events: ['issue_started', 'issue_completed', 'issue_task_completed'],
    lark: {},
    wechat: {},
  };
}

function buildQRCodeImageUrl(content: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=${encodeURIComponent(content)}`;
}

export { defaultNotificationSettings };

const LARK_PERMISSION_JSON = `{
  "scopes": {
    "tenant": [
      "contact:contact.base:readonly",
      "im:chat:readonly",
      "im:chat.members:read",
      "im:message",
      "im:message.group_at_msg:readonly",
      "im:message.group_msg",
      "im:message.p2p_msg:readonly",
      "im:message:send_as_bot",
      "im:resource"
    ],
    "user": []
  }
}`;

function CopyPermissionJson() {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(LARK_PERMISSION_JSON).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className="space-y-2">
      <Button type="button" size="sm" variant="outline" onClick={handleCopy}>
        {copied ? <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-emerald-600" /> : null}
        {copied ? '已复制' : '复制批量权限配置'}
      </Button>
      <details className="group">
        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">展开查看权限详情</summary>
        <pre className="mt-1.5 overflow-x-auto rounded-md bg-muted p-2 text-xs">{LARK_PERMISSION_JSON}</pre>
      </details>
    </div>
  );
}

export function NotificationSettingsTab({
  workspaceId,
  workspace,
  notificationDraft,
  setNotificationDraft,
  setWorkspace,
  botAgents,
  agentDialogOpen: _agentDialogOpen,
  setAgentDialogOpen,
}: NotificationSettingsTabProps) {
  const t = useTranslations('projectSettings');
  const tc = useTranslations('common');
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [startingNotifications, setStartingNotifications] = useState(false);
  const [testingNotifications, setTestingNotifications] = useState(false);
  const [loadingWeChatQR, setLoadingWeChatQR] = useState(false);
  const [wechatQR, setWeChatQR] = useState<WeChatQRCodeState>({ status: 'idle' });
  const pollingWeChatQR = useRef(false);
  const [nativePermission, setNativePermission] = useState<NotificationPermissionStatus>('default');
  const [isAndroidNative, setIsAndroidNative] = useState(false);
  const [larkGuideOpen, setLarkGuideOpen] = useState(false);

  const notificationSettings = notificationDraft;
  const wechatLoggedIn = Boolean(notificationSettings.wechat?.token && notificationSettings.wechat?.accountId);
  const upsertWorkspace = useWorkspaceStore((s) => s.upsertWorkspace);

  // Poll WeChat QR status
  useEffect(() => {
    if (
      !notificationSettings.enabled
      || notificationSettings.provider !== 'wechat'
      || !['wait', 'scaned'].includes(wechatQR.status)
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      if (pollingWeChatQR.current) return;
      pollingWeChatQR.current = true;
      fetch(`/api/workspaces/${workspaceId}/notifications/wechat/qr?poll=1`, { method: 'POST' })
        .then(async (res) => {
          const data = await res.json().catch(() => null);
          if (!res.ok) throw new Error(data?.error || 'Failed to poll WeChat QR status');
          setWeChatQR({
            status: data.status ?? 'wait',
            qrcodeImgContent: data.qrcodeImgContent ?? wechatQR.qrcodeImgContent,
            accountId: data.accountId,
            baseUrl: data.baseUrl,
          });
          if (data.workspace) {
            setWorkspace(data.workspace);
            setNotificationDraft(data.workspace.notificationSettings ?? defaultNotificationSettings());
            toast.success(t('wechat.connectedToast'));
          }
        })
        .catch((err) => {
          toast.error(t('wechat.pollFailed'), {
            description: err instanceof Error ? err.message : undefined,
          });
        })
        .finally(() => {
          pollingWeChatQR.current = false;
        });
    }, 2000);

    return () => window.clearInterval(timer);
  }, [notificationSettings.enabled, notificationSettings.provider, setNotificationDraft, setWorkspace, t, wechatQR.qrcodeImgContent, wechatQR.status, workspaceId]);

  useEffect(() => {
    setIsAndroidNative(isNativeAndroidEnvironment());
    getNotificationPermission().then(setNativePermission);
  }, []);

  const updateNotifications = async (next: WorkspaceNotificationSettings): Promise<Workspace | null> => {
    if (!workspace || savingNotifications) return null;
    setSavingNotifications(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationSettings: next }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => null);
        throw new Error(error?.error || 'Failed to save notification settings');
      }
      const updated: Workspace = await res.json();
      setWorkspace(updated);
      upsertWorkspace(updated);
      setNotificationDraft(updated.notificationSettings ?? defaultNotificationSettings());
      return updated;
    } catch (err) {
      toast.error(t('notifications.saveFailed'), {
        description: err instanceof Error ? err.message : undefined,
      });
      return null;
    } finally {
      setSavingNotifications(false);
    }
  };

  const patchNotifications = (patch: Partial<WorkspaceNotificationSettings>) => {
    const next = {
      ...notificationSettings,
      ...patch,
      lark: {
        ...notificationSettings.lark,
        ...patch.lark,
      },
      wechat: {
        ...notificationSettings.wechat,
        ...patch.wechat,
      },
      native: {
        ...notificationSettings.native,
        ...patch.native,
      },
    };
    setNotificationDraft(next);
    updateNotifications(next);
  };

  const toggleNotificationEvent = (event: NotificationEventKey, checked: boolean) => {
    const events = new Set(notificationSettings.events);
    if (checked) events.add(event);
    else events.delete(event);
    patchNotifications({ events: Array.from(events) });
  };

  const handleBotAgentChange = (agentId: string) => {
    patchNotifications({ botAgentId: agentId || undefined });
  };

  const handleStartNotifications = async () => {
    if (startingNotifications) return;
    setStartingNotifications(true);
    try {
      const saved = await updateNotifications(notificationSettings);
      if (!saved) throw new Error('Failed to save notification settings');
      const res = await fetch(`/api/workspaces/${workspaceId}/notifications/start`, {
        method: 'POST',
      });
      if (!res.ok) {
        const error = await res.json().catch(() => null);
        throw new Error(error?.error || 'Failed to start notification service');
      }
      const result: { workspace?: Workspace } = await res.json();
      if (result.workspace) {
        setWorkspace(result.workspace);
        setNotificationDraft(result.workspace.notificationSettings ?? defaultNotificationSettings());
      } else {
        setNotificationDraft({ ...notificationSettings, serviceRunning: true });
      }
      toast.success(t('notifications.startSuccess'));
    } catch (err) {
      toast.error(t('notifications.startFailed'), {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setStartingNotifications(false);
    }
  };

  const handleStopNotifications = async () => {
    if (startingNotifications) return;
    setStartingNotifications(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/notifications/stop`, {
        method: 'POST',
      });
      if (!res.ok) {
        const error = await res.json().catch(() => null);
        throw new Error(error?.error || 'Failed to stop notification service');
      }
      const result: { workspace?: Workspace } = await res.json();
      if (result.workspace) {
        setWorkspace(result.workspace);
        setNotificationDraft(result.workspace.notificationSettings ?? defaultNotificationSettings());
      } else {
        setNotificationDraft({ ...notificationSettings, serviceRunning: false });
      }
      toast.success(t('notifications.stopSuccess'));
    } catch (err) {
      toast.error(t('notifications.stopFailed'), {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setStartingNotifications(false);
    }
  };

  const handleTestNotifications = async () => {
    if (testingNotifications) return;
    setTestingNotifications(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/notifications/test`, {
        method: 'POST',
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.reason || data?.error || 'Failed to send test notification');
      }
      toast.success(t('notifications.testSuccess'));
    } catch (err) {
      toast.error(t('notifications.testFailed'), {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setTestingNotifications(false);
    }
  };

  const handleLoadWeChatQR = async () => {
    if (loadingWeChatQR) return;
    setLoadingWeChatQR(true);
    try {
      const saved = await updateNotifications({ ...notificationSettings, provider: 'wechat' });
      if (!saved) throw new Error('Failed to save notification settings');
      const res = await fetch(`/api/workspaces/${workspaceId}/notifications/wechat/qr${wechatLoggedIn ? '?refresh=1' : ''}`, {
        method: 'POST',
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Failed to get WeChat QR code');
      setWeChatQR({
        status: data.status ?? 'wait',
        qrcodeImgContent: data.qrcodeImgContent,
        accountId: data.accountId,
        baseUrl: data.baseUrl,
      });
      if (data.workspace) {
        setWorkspace(data.workspace);
        setNotificationDraft(data.workspace.notificationSettings ?? defaultNotificationSettings());
      }
    } catch (err) {
      toast.error(t('wechat.getQrFailed'), {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setLoadingWeChatQR(false);
    }
  };

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('notifications.title')}</h4>

      <div className="space-y-4 rounded-md border px-3 py-3">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5 pr-4">
            <Label htmlFor="message-notifications" className="text-sm font-medium">
              {t('notifications.messageNotifications')}
            </Label>
            <p className="text-xs text-muted-foreground">
              {t('notifications.messageNotificationsDescription')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {savingNotifications && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            <Switch
              id="message-notifications"
              checked={notificationSettings.enabled}
              onCheckedChange={(enabled) => patchNotifications({ enabled })}
              disabled={savingNotifications}
            />
          </div>
        </div>

        {notificationSettings.enabled && (
          <div className="space-y-4">
            <Tabs
              value={notificationSettings.provider}
              onValueChange={(provider) => patchNotifications({ provider: provider as NotificationProvider })}
              className="flex flex-col">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="lark">{t('notifications.lark')}</TabsTrigger>
                <TabsTrigger value="wechat">{t('notifications.wechat')}</TabsTrigger>
                <TabsTrigger value="native">{t('notifications.native')}</TabsTrigger>
              </TabsList>

              <TabsContent value="lark" className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">飞书 Bot 配置</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setLarkGuideOpen(true)}
                  >
                    <CircleHelp className="h-3.5 w-3.5" />
                    部署教程
                  </Button>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="lark-app-id" className="text-xs text-muted-foreground">{t('notifications.appId')}</Label>
                  <Input
                    id="lark-app-id"
                    value={notificationSettings.lark?.appId ?? ''}
                    onChange={(event) => setNotificationDraft({
                      ...notificationSettings,
                      lark: { ...notificationSettings.lark, appId: event.target.value },
                    })}
                    placeholder="cli_xxx"
                    disabled={startingNotifications}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="lark-app-secret" className="text-xs text-muted-foreground">{t('notifications.appSecret')}</Label>
                  <Input
                    id="lark-app-secret"
                    type="password"
                    value={notificationSettings.lark?.appSecret ?? ''}
                    onChange={(event) => setNotificationDraft({
                      ...notificationSettings,
                      lark: { ...notificationSettings.lark, appSecret: event.target.value },
                    })}
                    placeholder="app secret"
                    disabled={startingNotifications}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={notificationSettings.serviceRunning ? 'outline' : 'default'}
                    onClick={notificationSettings.serviceRunning ? handleStopNotifications : handleStartNotifications}
                    disabled={startingNotifications || savingNotifications || !notificationSettings.lark?.appId || !notificationSettings.lark?.appSecret}
                  >
                    {startingNotifications ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-2 h-3.5 w-3.5" />}
                    {notificationSettings.serviceRunning ? t('notifications.stopService') : t('notifications.startService')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleTestNotifications}
                    disabled={testingNotifications || savingNotifications || !notificationSettings.serviceRunning}
                  >
                    {testingNotifications && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                    {t('notifications.testSend')}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="wechat" className="space-y-3 pt-2">
                <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {wechatLoggedIn ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <QrCode className="h-4 w-4" />}
                      {t('wechat.robot')}
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {wechatLoggedIn
                        ? t('wechat.connected', { accountId: notificationSettings.wechat?.accountId ?? '' })
                        : wechatQR.status === 'scaned'
                          ? t('wechat.scanned')
                          : wechatQR.status === 'expired'
                            ? t('wechat.expired')
                            : t('wechat.scanQr')}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleLoadWeChatQR}
                    disabled={loadingWeChatQR || savingNotifications || startingNotifications}
                  >
                    {loadingWeChatQR ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-2 h-3.5 w-3.5" />}
                    {wechatLoggedIn ? t('wechat.refreshLogin') : t('wechat.getQr')}
                  </Button>
                </div>

                {wechatQR.qrcodeImgContent && !wechatLoggedIn && (
                  <div className="flex items-center gap-3 rounded-md border border-dashed px-3 py-3">
                    <img
                      src={buildQRCodeImageUrl(wechatQR.qrcodeImgContent)}
                      alt="WeChat robot login QR code"
                      className="h-36 w-36 shrink-0 rounded border bg-white p-2"
                    />
                    <div className="min-w-0 space-y-1 text-xs text-muted-foreground">
                      <p>{t('wechat.status', { status: wechatQR.status === 'scaned' ? 'scanned' : wechatQR.status })}</p>
                      <p className="break-all">{t('wechat.loginUrl', { url: wechatQR.qrcodeImgContent })}</p>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={notificationSettings.serviceRunning ? 'outline' : 'default'}
                    onClick={notificationSettings.serviceRunning ? handleStopNotifications : handleStartNotifications}
                    disabled={startingNotifications || savingNotifications || !wechatLoggedIn}
                  >
                    {startingNotifications ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-2 h-3.5 w-3.5" />}
                    {notificationSettings.serviceRunning ? t('notifications.stopService') : t('notifications.startService')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleTestNotifications}
                    disabled={testingNotifications || savingNotifications || !notificationSettings.serviceRunning}
                  >
                    {testingNotifications && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                    {t('notifications.testSend')}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="native" className="space-y-3 pt-2">
                <p className="text-xs text-muted-foreground">{t('notifications.nativeDescription')}</p>

                <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5">
                  <div className="flex items-center gap-2 text-sm">
                    <Monitor className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {nativePermission === 'granted' && (
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          {t('notifications.nativePermissionGranted')}
                        </span>
                      )}
                      {nativePermission === 'denied' && t('notifications.nativePermissionDenied')}
                      {nativePermission === 'default' && t('notifications.nativePermissionDefault')}
                      {nativePermission === 'unsupported' && t('notifications.nativePermissionUnsupported')}
                    </span>
                  </div>

                  {nativePermission !== 'unsupported' && nativePermission !== 'granted' && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        const status = await requestNotificationPermission();
                        setNativePermission(status);
                        if (status === 'granted') {
                          patchNotifications({ native: { permissionGranted: true } });
                          toast.success(t('notifications.nativePermissionGrantedToast'));
                        } else if (status === 'denied') {
                          toast.error(t('notifications.nativePermissionDeniedToast'));
                        }
                      }}
                      disabled={nativePermission === 'denied'}
                    >
                      {t('notifications.nativeRequestPermission')}
                    </Button>
                  )}
                </div>

                {isAndroidNative && (
                  <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5">
                    <div className="space-y-0.5 pr-4">
                      <Label htmlFor="android-ongoing-task-notification" className="text-sm font-medium">
                        {t('notifications.androidOngoingTaskNotification')}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {t('notifications.androidOngoingTaskNotificationDescription')}
                      </p>
                    </div>
                    <Switch
                      id="android-ongoing-task-notification"
                      checked={notificationSettings.native?.androidOngoingTaskNotification ?? false}
                      onCheckedChange={(androidOngoingTaskNotification) => patchNotifications({
                        native: {
                          permissionGranted: notificationSettings.native?.permissionGranted,
                          androidOngoingTaskNotification,
                        },
                      })}
                      disabled={savingNotifications || nativePermission !== 'granted'}
                    />
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        await sendNativeNotification(
                          'Agent Spaces',
                          t('notifications.nativeTestSuccess'),
                        );
                        toast.success(t('notifications.nativeTestSent'), { duration: 5000 });
                      } catch (err) {
                        toast.error(`${t('notifications.nativeTestFailed')}: ${err instanceof Error ? err.message : err}`, { duration: 5000 });
                      }
                    }}
                    disabled={nativePermission !== 'granted'}
                  >
                    {t('notifications.testSend')}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Bot className="h-3.5 w-3.5" />
                {t('botAgent.title')}
              </div>
              <div className="flex gap-2">
                <select
                  value={notificationSettings.botAgentId ?? ''}
                  onChange={(event) => handleBotAgentChange(event.target.value)}
                  disabled={savingNotifications}
                  className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring dark:bg-input/30"
                >
                  <option value="">{t('botAgent.selectAgent')}</option>
                  {botAgents.map((agent: AgentConfig) => (
                    <option key={agent.id} value={agent.id}>{agent.name}</option>
                  ))}
                </select>
                <Button type="button" size="sm" variant="outline" onClick={() => setAgentDialogOpen(true)}>
                  {tc('manage')}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Bell className="h-3.5 w-3.5" />
                {t('events.title')}
              </div>
              <div className="grid gap-2">
                {NOTIFICATION_EVENTS.map((item) => (
                  <label key={item.value} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      checked={notificationSettings.events.includes(item.value)}
                      onChange={(event) => toggleNotificationEvent(item.value, event.target.checked)}
                      disabled={savingNotifications}
                    />
                    <span>{t(item.labelKey)}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <Dialog open={larkGuideOpen} onOpenChange={setLarkGuideOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>创建飞书 Bot</DialogTitle>
            <DialogDescription>
              首次使用？按以下步骤在飞书开放平台创建机器人应用
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="space-y-1.5">
              <p className="font-medium">1. 创建自建应用</p>
              <p className="text-muted-foreground">
                前往{' '}
                <a href="https://open.feishu.cn/app" target="_blank" rel="noreferrer" className="underline underline-offset-3 hover:text-foreground">飞书开放平台</a>
                {' '}(海外版：{' '}
                <a href="https://open.larksuite.com/app" target="_blank" rel="noreferrer" className="underline underline-offset-3 hover:text-foreground">Lark 开放平台</a>
                )，点击「创建自建应用」并填写名称描述。
              </p>
            </div>
            <div className="space-y-1.5">
              <p className="font-medium">2. 获取凭证</p>
              <p className="text-muted-foreground">
                进入详情页，在「凭证与基础信息」中找到 App ID 和 App Secret，复制到上方的配置表单。
              </p>
            </div>
            <div className="space-y-1.5">
              <p className="font-medium">3. 启用机器人能力</p>
              <p className="text-muted-foreground">
                进入「添加应用能力」页面，启用「机器人」能力。这样应用才能接收和发送飞书消息。
              </p>
            </div>
            <div className="space-y-1.5">
              <p className="font-medium">4. 配置权限</p>
              <p className="text-muted-foreground">
                进入「权限管理」页面，点击下方按钮复制权限配置 JSON，然后在飞书开放平台通过「批量开通」粘贴即可一键添加所有权限：
              </p>
              <CopyPermissionJson />
            </div>
            <div className="space-y-1.5">
              <p className="font-medium">5. 配置事件订阅（关键步骤）</p>
              <p className="text-muted-foreground">
                进入「事件与回调」页面：
              </p>
              <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
                <li>事件订阅方式选择「使用长连接接收事件」（而非 Webhook，无需公网 IP）</li>
                <li>添加事件 <code className="rounded bg-muted px-1 py-0.5 text-xs">im.message.receive_v1</code>（接收消息）</li>
              </ul>
            </div>
            <div className="space-y-1.5">
              <p className="font-medium">6. 发布应用</p>
              <p className="text-muted-foreground">
                进入「版本管理与发布」→ 创建版本 → 提交审核。需要企业管理员在管理后台审核通过后，机器人才能正常使用。
              </p>
              <p className="text-muted-foreground">
                版本审核通过并发布后，在飞书中搜索机器人名称添加到聊天，即可通过飞书向 Proma Agent 发送指令。
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
