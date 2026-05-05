import * as Lark from '@larksuiteoapi/node-sdk';
import crypto from 'node:crypto';
import type { AgentConfig, TaskResult, Workspace, WorkspaceNotificationSettings } from '@agent-spaces/shared';
import * as workspaceService from './workspace.js';
import * as issueService from './issue.js';
import * as taskService from './task.js';
import * as agentService from './agent.js';
import { createAgentRuntime } from '../adapters/agent-runtime.js';
import { getThinkingRuntimeConfig } from './llm-model-config.js';

export type NotificationBroadcastEvent =
  | 'issuse_status_change'
  | 'issue_status_change'
  | 'issue_task_start'
  | 'issue_task_done';

interface BroadcastEnvelope {
  event: NotificationBroadcastEvent;
  workspaceId: string;
  timestamp: string;
  data: Record<string, unknown>;
}

interface BotAdapter {
  start(): Promise<void>;
  stop(): Promise<void>;
  send(envelope: BroadcastEnvelope): Promise<void>;
  hasRecipients(): boolean;
}

const adapters = new Map<string, BotAdapter>();
const larkChatIdsByWorkspace = new Map<string, Set<string>>();
const recentLarkMessageIdsByWorkspace = new Map<string, Map<string, number>>();
const LARK_MESSAGE_DEDUPE_TTL_MS = 5 * 60 * 1000;
const WECHAT_BASE_URL = 'https://ilinkai.weixin.qq.com';
const WECHAT_BOT_TYPE = '3';
const WECHAT_API_TIMEOUT_MS = 15_000;
const WECHAT_QR_STATUS_TIMEOUT_MS = 8_000;
const WECHAT_LONG_POLL_TIMEOUT_MS = 35_000;
const WECHAT_RETRY_DELAY_MS = 2_000;
const WECHAT_BACKOFF_DELAY_MS = 30_000;
const WECHAT_MAX_CONSECUTIVE_FAILURES = 5;
const recentWechatMessageIdsByWorkspace = new Map<string, Map<string, number>>();
const wechatUserIdsByWorkspace = new Map<string, Set<string>>();
const wechatContextTokensByWorkspace = new Map<string, Map<string, string>>();
const wechatLoginSessions = new Map<string, WeChatQRCodeSession>();
const WECHAT_MESSAGE_DEDUPE_TTL_MS = 5 * 60 * 1000;

export async function startWorkspaceNotificationService(workspaceId: string): Promise<{ started: boolean; provider?: string }> {
  const workspace = workspaceService.getById(workspaceId);
  const settings = workspace?.notificationSettings;
  if (!workspace || !settings?.enabled) return { started: false };

  await stopWorkspaceNotificationService(workspaceId);

  if (settings.provider === 'lark') {
    const adapter = new LarkNotificationAdapter(workspace, settings);
    await adapter.start();
    adapters.set(workspaceId, adapter);
    persistServiceRunning(workspaceId, true);
    return { started: true, provider: 'lark' };
  }

  if (settings.provider === 'wechat') {
    const adapter = new WeChatNotificationAdapter(workspace, settings);
    await adapter.start();
    adapters.set(workspaceId, adapter);
    persistServiceRunning(workspaceId, true);
    return { started: true, provider: 'wechat' };
  }

  return { started: false, provider: settings.provider };
}

export async function stopWorkspaceNotificationService(workspaceId: string): Promise<void> {
  const adapter = adapters.get(workspaceId);
  if (adapter) {
    adapters.delete(workspaceId);
    await adapter.stop();
  }
  persistServiceRunning(workspaceId, false);
}

export async function startPersistedNotificationServices(): Promise<void> {
  for (const workspace of workspaceService.getAll()) {
    const settings = workspace.notificationSettings;
    if (!settings?.enabled || !settings.serviceRunning) continue;
    try {
      await startWorkspaceNotificationService(workspace.id);
      console.log(`[notification] restored ${settings.provider} service workspaceId=${workspace.id}`);
    } catch (err) {
      console.error(`[notification] failed to restore service workspaceId=${workspace.id}:`, err);
    }
  }
}

export async function sendTestNotification(workspaceId: string): Promise<{ sent: boolean; reason?: string }> {
  const workspace = workspaceService.getById(workspaceId);
  if (!workspace?.notificationSettings?.enabled) {
    return { sent: false, reason: 'Notification service is not enabled' };
  }

  let adapter = adapters.get(workspaceId);
  if (!adapter) {
    const started = await startWorkspaceNotificationService(workspaceId);
    if (!started.started) return { sent: false, reason: 'Notification service is not running' };
    adapter = adapters.get(workspaceId);
  }
  if (!adapter) return { sent: false, reason: 'Notification adapter is unavailable' };
  if (!adapter.hasRecipients()) {
    const provider = workspace.notificationSettings.provider === 'wechat' ? 'WeChat user' : 'Feishu chat';
    return { sent: false, reason: `No ${provider} is registered yet. Send any message to the bot first.` };
  }

  await adapter.send({
    event: 'issue_status_change',
    workspaceId,
    timestamp: new Date().toISOString(),
    data: {
      title: 'Notification test',
      status: 'test',
      message: 'Agent Spaces notification service is connected.',
    },
  });
  return { sent: true };
}

export async function getWeChatLoginQRCode(workspaceId: string, forceRefresh = false): Promise<WeChatLoginQRCodeResult> {
  const workspace = workspaceService.getById(workspaceId);
  if (!workspace) throw new Error('Workspace not found');
  const settings = workspace.notificationSettings;
  if (!forceRefresh && settings?.wechat?.token && settings.wechat.accountId) {
    return {
      status: 'confirmed',
      accountId: settings.wechat.accountId,
      userId: settings.wechat.userId,
      baseUrl: settings.wechat.baseUrl,
      workspace,
    };
  }

  if (forceRefresh) wechatLoginSessions.delete(workspaceId);
  const existing = wechatLoginSessions.get(workspaceId);
  if (existing && Date.now() - existing.createdAt < 2 * 60_000) {
    return {
      status: 'wait',
      qrcode: existing.qrcode,
      qrcodeImgContent: existing.qrcodeImgContent,
    };
  }

  const qr = await fetchWeChatQRCode();
  wechatLoginSessions.set(workspaceId, {
    qrcode: qr.qrcode,
    qrcodeImgContent: qr.qrcode_img_content,
    createdAt: Date.now(),
  });
  return {
    status: 'wait',
    qrcode: qr.qrcode,
    qrcodeImgContent: qr.qrcode_img_content,
  };
}

export async function pollWeChatLoginStatus(workspaceId: string): Promise<WeChatLoginQRCodeResult> {
  const session = wechatLoginSessions.get(workspaceId);
  if (!session) return getWeChatLoginQRCode(workspaceId);

  const status = await fetchWeChatQRCodeStatus(session.qrcode);
  if (status.status === 'confirmed') {
    if (!status.bot_token || !status.ilink_bot_id) {
      throw new Error('WeChat login confirmed but token or bot id is missing');
    }
    const workspace = workspaceService.getById(workspaceId);
    const settings = workspace?.notificationSettings ?? {
      enabled: true,
      provider: 'wechat' as const,
      events: ['issue_started', 'issue_completed', 'issue_task_completed'] as const,
    };
    const baseUrl = status.baseurl || WECHAT_BASE_URL;
    const updated = workspaceService.update(workspaceId, {
      notificationSettings: {
        ...settings,
        provider: 'wechat',
        wechat: {
          ...settings.wechat,
          token: status.bot_token,
          baseUrl,
          accountId: status.ilink_bot_id,
          userId: status.ilink_user_id,
        },
      },
    });
    wechatLoginSessions.delete(workspaceId);
    return {
      status: 'confirmed',
      accountId: updated?.notificationSettings?.wechat?.accountId,
      userId: updated?.notificationSettings?.wechat?.userId,
      baseUrl: updated?.notificationSettings?.wechat?.baseUrl,
      workspace: updated ?? undefined,
    };
  }

  if (status.status === 'expired') {
    wechatLoginSessions.delete(workspaceId);
  }

  return {
    status: status.status,
    qrcode: session.qrcode,
    qrcodeImgContent: session.qrcodeImgContent,
  };
}

export function publishWorkspaceEvent(workspaceId: string, wsEvent: string, data: unknown): void {
  const envelope = buildNotificationEnvelope(workspaceId, wsEvent, data);
  if (!envelope) return;

  const adapter = adapters.get(workspaceId);
  if (!adapter) return;
  adapter.send(envelope).catch((err) => {
    console.error(`[notification] failed to send ${envelope.event} workspaceId=${workspaceId}:`, err);
  });
}

function buildNotificationEnvelope(workspaceId: string, wsEvent: string, data: unknown): BroadcastEnvelope | null {
  if (wsEvent === 'issue.status_changed') {
    const payload = data as { issueId?: string; from?: string; to?: string };
    if (!payload.issueId) return null;
    const issue = issueService.getById(workspaceId, payload.issueId);
    if (!issue || !shouldNotify(workspaceId, payload.to === 'completed' ? 'issue_completed' : 'issue_started')) {
      return null;
    }
    if (!isIssueStartStatus(payload.to) && payload.to !== 'completed') return null;
    return {
      event: 'issuse_status_change',
      workspaceId,
      timestamp: new Date().toISOString(),
      data: {
        issueId: issue.id,
        channelId: issue.channelId,
        title: issue.title,
        description: issue.description,
        from: payload.from,
        to: payload.to,
        status: issue.status,
        tasks: taskService.list(workspaceId, issue.id),
        issue,
      },
    };
  }

  if (wsEvent === 'task.status_changed') {
    const payload = data as { taskId?: string; from?: string; to?: string };
    if (!payload.taskId) return null;
    const task = taskService.getById(workspaceId, payload.taskId);
    if (!task) return null;
    const issue = issueService.getById(workspaceId, task.issueId);
    if (!issue) return null;
    if (payload.to === 'running' && shouldNotify(workspaceId, 'issue_started')) {
      return {
        event: 'issue_task_start',
        workspaceId,
        timestamp: new Date().toISOString(),
        data: {
          issueId: issue.id,
          channelId: issue.channelId,
          taskId: task.id,
          title: task.title,
          description: task.description,
          assignedAgentId: task.assignedAgentId,
          from: payload.from,
          to: payload.to,
          task,
          issue,
        },
      };
    }
    if (isTaskDoneStatus(payload.to) && shouldNotify(workspaceId, 'issue_task_completed')) {
      return {
        event: 'issue_task_done',
        workspaceId,
        timestamp: new Date().toISOString(),
        data: {
          issueId: issue.id,
          channelId: issue.channelId,
          taskId: task.id,
          title: task.title,
          description: task.description,
          assignedAgentId: task.assignedAgentId,
          from: payload.from,
          to: payload.to,
          result: task.result,
          task,
          issue,
        },
      };
    }
  }

  return null;
}

function persistServiceRunning(workspaceId: string, serviceRunning: boolean): void {
  const workspace = workspaceService.getById(workspaceId);
  const settings = workspace?.notificationSettings;
  if (!workspace || !settings || settings.serviceRunning === serviceRunning) return;
  workspaceService.update(workspaceId, {
    notificationSettings: {
      ...settings,
      serviceRunning,
    },
  });
}

function shouldNotify(workspaceId: string, event: NonNullable<WorkspaceNotificationSettings['events']>[number]): boolean {
  const settings = workspaceService.getById(workspaceId)?.notificationSettings;
  return Boolean(settings?.enabled && settings.events?.includes(event));
}

function isIssueStartStatus(status?: string): boolean {
  return status === 'planned' || status === 'in_progress';
}

function isTaskDoneStatus(status?: string): boolean {
  return status === 'done' || status === 'failed' || status === 'cancelled';
}

class WeChatNotificationAdapter implements BotAdapter {
  private running = false;
  private credentials: WeChatCredentials;
  private getUpdatesBuf = '';

  constructor(
    private workspace: Workspace,
    settings: WorkspaceNotificationSettings,
  ) {
    const token = settings.wechat?.token?.trim();
    const baseUrl = settings.wechat?.baseUrl?.trim() || WECHAT_BASE_URL;
    const accountId = settings.wechat?.accountId?.trim();
    if (!token || !accountId) {
      throw new Error('WeChat login is required. Scan the QR code first.');
    }
    this.credentials = {
      token,
      baseUrl,
      accountId,
      userId: settings.wechat?.userId,
    };
    this.getUpdatesBuf = settings.wechat?.getUpdatesBuf ?? '';
    if (settings.wechat?.userIds?.length) {
      wechatUserIdsByWorkspace.set(workspace.id, new Set(settings.wechat.userIds));
    }
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    void this.pollLoop();
  }

  async stop(): Promise<void> {
    this.running = false;
  }

  async send(envelope: BroadcastEnvelope): Promise<void> {
    const userIds = wechatUserIdsByWorkspace.get(this.workspace.id);
    if (!userIds?.size) return;

    const text = [
      formatLarkTitle(envelope),
      '',
      formatLarkContent(envelope),
    ].filter(Boolean).join('\n');

    for (const userId of userIds) {
      await sendWeChatTextMessage(
        this.credentials.baseUrl,
        this.credentials.token,
        userId,
        text,
        getWeChatContextToken(this.workspace.id, userId),
      );
    }
  }

  hasRecipients(): boolean {
    return Boolean(wechatUserIdsByWorkspace.get(this.workspace.id)?.size);
  }

  private async pollLoop(): Promise<void> {
    let failures = 0;
    while (this.running) {
      try {
        const resp = await getWeChatUpdates(
          this.credentials.baseUrl,
          this.credentials.token,
          this.getUpdatesBuf,
        );

        if (resp.ret !== undefined && resp.ret !== 0) {
          failures++;
          console.error(`[notification] WeChat getupdates failed workspaceId=${this.workspace.id} ret=${resp.ret} errcode=${resp.errcode} errmsg=${resp.errmsg}`);
          await sleep(failures >= WECHAT_MAX_CONSECUTIVE_FAILURES ? WECHAT_BACKOFF_DELAY_MS : WECHAT_RETRY_DELAY_MS);
          if (failures >= WECHAT_MAX_CONSECUTIVE_FAILURES) failures = 0;
          continue;
        }

        failures = 0;
        if (resp.get_updates_buf && resp.get_updates_buf !== this.getUpdatesBuf) {
          this.getUpdatesBuf = resp.get_updates_buf;
          persistWeChatGetUpdatesBuf(this.workspace.id, this.getUpdatesBuf);
        }

        for (const msg of resp.msgs ?? []) {
          await this.handleMessage(msg);
        }
      } catch (err) {
        failures++;
        console.error(`[notification] WeChat polling error workspaceId=${this.workspace.id}:`, err);
        await sleep(failures >= WECHAT_MAX_CONSECUTIVE_FAILURES ? WECHAT_BACKOFF_DELAY_MS : WECHAT_RETRY_DELAY_MS);
        if (failures >= WECHAT_MAX_CONSECUTIVE_FAILURES) failures = 0;
      }
    }
  }

  private async handleMessage(msg: WeChatMessage): Promise<void> {
    if (msg.message_type !== WeChatMessageType.USER) return;
    if (isDuplicateWeChatMessage(this.workspace.id, msg)) return;

    const fromUser = msg.from_user_id;
    if (!fromUser) return;

    const userIds = wechatUserIdsByWorkspace.get(this.workspace.id) ?? new Set<string>();
    userIds.add(fromUser);
    wechatUserIdsByWorkspace.set(this.workspace.id, userIds);
    persistWeChatUserIds(this.workspace.id, Array.from(userIds));

    if (msg.context_token) {
      setWeChatContextToken(this.workspace.id, fromUser, msg.context_token);
    }

    const text = extractWeChatTextFromMessage(msg).trim();
    if (!text) return;
    if (isBuiltInCommand(text)) {
      await this.reply(fromUser, buildCommandResponse(this.workspace.id, text));
      return;
    }

    const botAgent = getConfiguredBotAgent(this.workspace.id);
    if (!botAgent) {
      await this.reply(fromUser, '请先设置agent');
      return;
    }

    await this.reply(fromUser, `${botAgent.name} working...`);
    const reply = await runBotAgent(this.workspace.id, botAgent, text);
    await this.reply(fromUser, reply);
  }

  private async reply(to: string, text: string): Promise<void> {
    await sendWeChatTextMessage(
      this.credentials.baseUrl,
      this.credentials.token,
      to,
      text,
      getWeChatContextToken(this.workspace.id, to),
    );
  }
}

class LarkNotificationAdapter implements BotAdapter {
  private client: Lark.Client;
  private wsClient: Lark.WSClient;
  private started = false;

  constructor(
    private workspace: Workspace,
    settings: WorkspaceNotificationSettings,
  ) {
    const appId = settings.lark?.appId?.trim();
    const appSecret = settings.lark?.appSecret?.trim();
    if (!appId || !appSecret) {
      throw new Error('Lark app_id and app_secret are required');
    }
    const baseConfig = { appId, appSecret };
    this.client = new Lark.Client(baseConfig);
    this.wsClient = new Lark.WSClient({ ...baseConfig, loggerLevel: Lark.LoggerLevel.info });
    if (settings.lark?.chatIds?.length) {
      larkChatIdsByWorkspace.set(workspace.id, new Set(settings.lark.chatIds));
    }
  }

  async start(): Promise<void> {
    this.wsClient.start({
      eventDispatcher: new Lark.EventDispatcher({}).register({
        'im.message.receive_v1': async (data) => this.handleMessage(data),
      }),
    });
    this.started = true;
  }

  async stop(): Promise<void> {
    if (!this.started) return;
    this.started = false;
    this.wsClient.close({ force: true });
  }

  async send(envelope: BroadcastEnvelope): Promise<void> {
    const chatIds = larkChatIdsByWorkspace.get(this.workspace.id);
    if (!chatIds?.size) return;

    for (const chatId of chatIds) {
      await this.client.im.v1.message.create({
        params: { receive_id_type: 'chat_id' },
        data: {
          receive_id: chatId,
          content: Lark.messageCard.defaultCard({
            title: formatLarkTitle(envelope),
            content: formatLarkContent(envelope),
          }),
          msg_type: 'interactive',
        },
      });
    }
  }

  hasRecipients(): boolean {
    return Boolean(larkChatIdsByWorkspace.get(this.workspace.id)?.size);
  }

  private async handleMessage(data: LarkMessageReceiveEvent): Promise<void> {
    const chatId = data.message?.chat_id;
    if (!chatId) return;
    if (isDuplicateLarkMessage(this.workspace.id, data)) return;
    if (data.sender?.sender_type && data.sender.sender_type !== 'user') return;
    if (data.message?.message_type && data.message.message_type !== 'text') return;

    const chatIds = larkChatIdsByWorkspace.get(this.workspace.id) ?? new Set<string>();
    chatIds.add(chatId);
    larkChatIdsByWorkspace.set(this.workspace.id, chatIds);
    persistLarkChatIds(this.workspace.id, Array.from(chatIds));

    const text = parseLarkText(data.message?.content);
    if (!text) return;
    if (isBuiltInCommand(text)) {
      await this.sendCard(chatId, 'Agent Spaces', buildCommandResponse(this.workspace.id, text));
      return;
    }

    const botAgent = getConfiguredBotAgent(this.workspace.id);
    if (!botAgent) {
      await this.sendCard(chatId, 'Agent Spaces', '请先设置agent');
      return;
    }

    await this.sendCard(chatId, 'Agent Spaces', `${botAgent.name} working...`);
    const reply = await runBotAgent(this.workspace.id, botAgent, text);
    await this.sendCard(chatId, botAgent.name, reply);
  }

  private async sendCard(chatId: string, title: string, content: string): Promise<void> {
    await this.client.im.v1.message.create({
      params: { receive_id_type: 'chat_id' },
      data: {
        receive_id: chatId,
        content: Lark.messageCard.defaultCard({
          title,
          content,
        }),
        msg_type: 'interactive',
      },
    });
  }
}

interface LarkMessageReceiveEvent {
  event_id?: string;
  header?: { event_id?: string };
  sender?: { sender_type?: string };
  message?: {
    chat_id?: string;
    content?: string;
    message_id?: string;
    message_type?: string;
    create_time?: string;
  };
}

interface WeChatQRCodeSession {
  qrcode: string;
  qrcodeImgContent: string;
  createdAt: number;
}

export interface WeChatLoginQRCodeResult {
  status: 'wait' | 'scaned' | 'confirmed' | 'expired';
  qrcode?: string;
  qrcodeImgContent?: string;
  accountId?: string;
  userId?: string;
  baseUrl?: string;
  workspace?: Workspace;
}

interface WeChatQRCodeResponse {
  qrcode: string;
  qrcode_img_content: string;
}

interface WeChatQRCodeStatusResponse {
  status: 'wait' | 'scaned' | 'confirmed' | 'expired';
  bot_token?: string;
  ilink_bot_id?: string;
  baseurl?: string;
  ilink_user_id?: string;
}

interface WeChatCredentials {
  token: string;
  baseUrl: string;
  accountId: string;
  userId?: string;
}

const WeChatMessageType = {
  USER: 1,
  BOT: 2,
} as const;

const WeChatMessageItemType = {
  TEXT: 1,
} as const;

const WeChatMessageState = {
  FINISH: 2,
} as const;

interface WeChatMessageItem {
  type?: number;
  text_item?: { text?: string };
  ref_msg?: { title?: string; message_item?: WeChatMessageItem };
}

interface WeChatMessage {
  seq?: number;
  message_id?: number;
  from_user_id?: string;
  to_user_id?: string;
  client_id?: string;
  create_time_ms?: number;
  session_id?: string;
  message_type?: number;
  message_state?: number;
  item_list?: WeChatMessageItem[];
  context_token?: string;
}

interface WeChatGetUpdatesResponse {
  ret?: number;
  errcode?: number;
  errmsg?: string;
  msgs?: WeChatMessage[];
  get_updates_buf?: string;
  longpolling_timeout_ms?: number;
}

function isDuplicateLarkMessage(workspaceId: string, data: LarkMessageReceiveEvent): boolean {
  const id = data.message?.message_id
    ?? buildFallbackLarkMessageId(data)
    ?? data.header?.event_id
    ?? data.event_id;
  if (!id) return false;

  const now = Date.now();
  const seen = recentLarkMessageIdsByWorkspace.get(workspaceId) ?? new Map<string, number>();
  for (const [key, timestamp] of seen) {
    if (now - timestamp > LARK_MESSAGE_DEDUPE_TTL_MS) seen.delete(key);
  }
  recentLarkMessageIdsByWorkspace.set(workspaceId, seen);

  if (seen.has(id)) return true;
  seen.set(id, now);
  return false;
}

function buildFallbackLarkMessageId(data: LarkMessageReceiveEvent): string | undefined {
  const chatId = data.message?.chat_id;
  const content = data.message?.content;
  const createTime = data.message?.create_time;
  if (!chatId || !content) return undefined;
  return `${chatId}:${createTime ?? ''}:${content}`;
}

function parseLarkText(content?: string): string {
  if (!content) return '';
  try {
    const parsed = JSON.parse(content) as { text?: string };
    return parsed.text?.trim() ?? '';
  } catch {
    return content.trim();
  }
}

async function fetchWeChatQRCode(): Promise<WeChatQRCodeResponse> {
  const res = await fetch(`${WECHAT_BASE_URL}/ilink/bot/get_bot_qrcode?bot_type=${WECHAT_BOT_TYPE}`);
  if (!res.ok) throw new Error(`Failed to get WeChat QR code: ${res.status}`);
  return await res.json() as WeChatQRCodeResponse;
}

async function fetchWeChatQRCodeStatus(qrcode: string): Promise<WeChatQRCodeStatusResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WECHAT_QR_STATUS_TIMEOUT_MS);
  try {
    const res = await fetch(`${WECHAT_BASE_URL}/ilink/bot/get_qrcode_status?qrcode=${encodeURIComponent(qrcode)}`, {
      headers: { 'iLink-App-ClientVersion': '1' },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`Failed to poll WeChat QR code status: ${res.status}`);
    return await res.json() as WeChatQRCodeStatusResponse;
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === 'AbortError') return { status: 'wait' };
    throw err;
  }
}

function randomWechatUin(): string {
  const uint32 = crypto.randomBytes(4).readUInt32BE(0);
  return Buffer.from(String(uint32), 'utf-8').toString('base64');
}

function buildWeChatHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    AuthorizationType: 'ilink_bot_token',
    'X-WECHAT-UIN': randomWechatUin(),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function postWeChatApi<T>(
  baseUrl: string,
  endpoint: string,
  body: Record<string, unknown>,
  token?: string,
  timeoutMs = WECHAT_API_TIMEOUT_MS,
): Promise<T> {
  const url = new URL(endpoint, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
  const bodyStr = JSON.stringify(body);
  const headers = buildWeChatHeaders(token);
  headers['Content-Length'] = String(Buffer.byteLength(bodyStr, 'utf-8'));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url.toString(), {
      method: 'POST',
      headers,
      body: bodyStr,
      signal: controller.signal,
    });
    clearTimeout(timer);
    const text = await res.text();
    if (!res.ok) throw new Error(`WeChat API ${endpoint} responded ${res.status}: ${text}`);
    return JSON.parse(text) as T;
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === 'AbortError' && endpoint === 'ilink/bot/getupdates') {
      return { ret: 0, msgs: [], get_updates_buf: (body.get_updates_buf as string | undefined) ?? '' } as T;
    }
    throw err;
  }
}

async function getWeChatUpdates(baseUrl: string, token: string, buf: string): Promise<WeChatGetUpdatesResponse> {
  return postWeChatApi<WeChatGetUpdatesResponse>(
    baseUrl,
    'ilink/bot/getupdates',
    { get_updates_buf: buf },
    token,
    WECHAT_LONG_POLL_TIMEOUT_MS,
  );
}

async function sendWeChatTextMessage(
  baseUrl: string,
  token: string,
  to: string,
  text: string,
  contextToken?: string,
): Promise<void> {
  const clientId = `bot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await postWeChatApi(
    baseUrl,
    'ilink/bot/sendmessage',
    {
      msg: {
        from_user_id: '',
        to_user_id: to,
        client_id: clientId,
        message_type: WeChatMessageType.BOT,
        message_state: WeChatMessageState.FINISH,
        item_list: text
          ? [{ type: WeChatMessageItemType.TEXT, text_item: { text } }]
          : undefined,
        context_token: contextToken,
      } satisfies WeChatMessage,
    },
    token,
  );
}

function extractWeChatTextFromMessage(msg: WeChatMessage): string {
  for (const item of msg.item_list ?? []) {
    if (item.type !== WeChatMessageItemType.TEXT || !item.text_item?.text) continue;
    const refTitle = item.ref_msg?.title;
    return refTitle ? `[引用: ${refTitle}]\n${item.text_item.text}` : item.text_item.text;
  }
  return '';
}

function isDuplicateWeChatMessage(workspaceId: string, msg: WeChatMessage): boolean {
  const id = msg.message_id
    ? String(msg.message_id)
    : `${msg.from_user_id ?? ''}:${msg.create_time_ms ?? ''}:${extractWeChatTextFromMessage(msg)}`;
  if (!id.replace(/:/g, '')) return false;

  const now = Date.now();
  const seen = recentWechatMessageIdsByWorkspace.get(workspaceId) ?? new Map<string, number>();
  for (const [key, timestamp] of seen) {
    if (now - timestamp > WECHAT_MESSAGE_DEDUPE_TTL_MS) seen.delete(key);
  }
  recentWechatMessageIdsByWorkspace.set(workspaceId, seen);

  if (seen.has(id)) return true;
  seen.set(id, now);
  return false;
}

function getWeChatContextToken(workspaceId: string, userId: string): string | undefined {
  return wechatContextTokensByWorkspace.get(workspaceId)?.get(userId);
}

function setWeChatContextToken(workspaceId: string, userId: string, contextToken: string): void {
  const tokens = wechatContextTokensByWorkspace.get(workspaceId) ?? new Map<string, string>();
  tokens.set(userId, contextToken);
  wechatContextTokensByWorkspace.set(workspaceId, tokens);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildCommandResponse(workspaceId: string, text: string): string {
  if (text.startsWith('/issue_list')) {
    const issues = issueService.list(workspaceId);
    return issues.length
      ? issues.map((issue) => `- ${issue.title} [${issue.status}] ${issue.id}`).join('\n')
      : 'No issues.';
  }
  if (text.startsWith('/new_issue')) {
    return 'Create a new issue from Agent Spaces UI for now. Command payload is reserved for bot-platform adapters.';
  }
  if (text.startsWith('/issue_detail')) {
    const issueId = text.match(/issue=([^\s]+)/)?.[1];
    const issue = issueId ? issueService.getById(workspaceId, issueId) : null;
    if (!issue) return 'Issue not found. Usage: /issue_detail issue=<issueId>';
    const tasks = taskService.list(workspaceId, issue.id);
    return [
      `${issue.title} [${issue.status}]`,
      issue.description,
      '',
      ...tasks.map((task) => `- ${task.title} [${task.status}]`),
    ].filter(Boolean).join('\n');
  }
  return [
    'Supported commands:',
    `/new_issue workspace=${workspaceId}`,
    `/issue_list workspace=${workspaceId}`,
    `/issue_detail workspace=${workspaceId} issue=<issueId>`,
  ].join('\n');
}

function isBuiltInCommand(text: string): boolean {
  const command = text.trim().split(/\s+/, 1)[0];
  return command === '/new_issue'
    || command === '/issue_list'
    || command === '/issue_detail'
    || command === '/help'
    || command.startsWith('/');
}

function getConfiguredBotAgent(workspaceId: string): AgentConfig | null {
  const workspace = workspaceService.getById(workspaceId);
  const botAgentId = workspace?.notificationSettings?.botAgentId;
  if (!botAgentId) return null;
  return (agentService.listPresets(workspaceId) ?? [])
    .find((agent) => agent.id === botAgentId && agent.role === 'bot' && agent.enabled !== false) ?? null;
}

async function runBotAgent(workspaceId: string, preset: AgentConfig, message: string): Promise<string> {
  const session = agentService.getOrCreateSessionForConfig(workspaceId, preset);
  agentService.updateStatus(workspaceId, session.id, 'active');
  const startedAt = Date.now();
  const runtime = createAgentRuntime({
    kind: preset.runtimeKind,
    provider: preset.modelProvider,
    model: preset.modelId,
    apiKey: preset.apiKey,
    baseURL: preset.apiBase,
    ...getThinkingRuntimeConfig(preset),
  });
  const workingDir = agentService.resolveWorkingDir(workspaceId, preset);

  try {
    const result = await runtime.execute(
      buildBotPrompt(message),
      workingDir,
      {
        maxTurns: 20,
        mcpServers: agentService.getMcpServers(preset.mcps),
        skills: agentService.getAvailableSkillNames(agentService.getAgentConfigDir(workspaceId, preset), preset.skills),
        configDir: agentService.getAgentConfigDir(workspaceId, preset),
        sandboxDirs: preset.sandboxDirs,
        systemPrompt: preset.systemPrompt,
      },
    );
    agentService.complete(workspaceId, session.id, result.success ? undefined : result.error || result.summary, {
      runtime: preset.runtimeKind,
      model: preset.modelId,
      summary: result.summary,
      output: result.output,
      durationMs: Date.now() - startedAt,
      usage: result.usage,
      costUsd: result.costUsd,
    });
    return formatBotFinalMessage(result);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    agentService.updateStatus(workspaceId, session.id, 'crashed', { error });
    return `处理失败：${error}`;
  }
}

function buildBotPrompt(message: string): string {
  return [
    'User message from external chat platform:',
    message,
    '',
    'Reply to the user directly. Output only the final reply.',
  ].join('\n');
}

function formatBotFinalMessage(result: { success: boolean; summary: string; output: string[]; error?: string }): string {
  if (!result.success) return result.error || result.summary || '处理失败';
  const finalOutput = result.output
    .map((line) => line.trim())
    .filter((line) => line && !isUsageLine(line))
    .at(-1);
  return finalOutput || result.summary || '处理完成';
}

function isUsageLine(line: string): boolean {
  return /^\[usage\]\s+tokens=/i.test(line);
}

function formatLarkTitle(envelope: BroadcastEnvelope): string {
  const title = typeof envelope.data.title === 'string' ? envelope.data.title : 'Issue update';
  if (envelope.event === 'issue_task_start') return `Task started: ${title}`;
  if (envelope.event === 'issue_task_done') return `Task done: ${title}`;
  return `Issue status: ${title}`;
}

function persistLarkChatIds(workspaceId: string, chatIds: string[]): void {
  const workspace = workspaceService.getById(workspaceId);
  const settings = workspace?.notificationSettings;
  if (!workspace || !settings) return;
  workspaceService.update(workspaceId, {
    notificationSettings: {
      ...settings,
      lark: {
        ...settings.lark,
        chatIds: [...new Set(chatIds)],
      },
    },
  });
}

function persistWeChatUserIds(workspaceId: string, userIds: string[]): void {
  const workspace = workspaceService.getById(workspaceId);
  const settings = workspace?.notificationSettings;
  if (!workspace || !settings) return;
  workspaceService.update(workspaceId, {
    notificationSettings: {
      ...settings,
      wechat: {
        ...settings.wechat,
        userIds: [...new Set(userIds)],
      },
    },
  });
}

function persistWeChatGetUpdatesBuf(workspaceId: string, getUpdatesBuf: string): void {
  const workspace = workspaceService.getById(workspaceId);
  const settings = workspace?.notificationSettings;
  if (!workspace || !settings) return;
  workspaceService.update(workspaceId, {
    notificationSettings: {
      ...settings,
      wechat: {
        ...settings.wechat,
        getUpdatesBuf,
      },
    },
  });
}

function formatLarkContent(envelope: BroadcastEnvelope): string {
  const lines = [
    `Event: ${envelope.event}`,
    `Workspace: ${envelope.workspaceId}`,
    envelope.data.issueId ? `Issue: ${envelope.data.issueId}` : '',
    envelope.data.taskId ? `Task: ${envelope.data.taskId}` : '',
    envelope.data.to ? `Status: ${String(envelope.data.from ?? '')} -> ${String(envelope.data.to)}` : '',
    envelope.data.message ? String(envelope.data.message) : '',
    formatResult(envelope.data.result as TaskResult | undefined),
  ];
  return lines.filter(Boolean).join('\n');
}

function formatResult(result?: TaskResult): string {
  if (!result) return '';
  return [
    `Success: ${result.success}`,
    result.summary ? `Summary: ${result.summary}` : '',
    result.error ? `Error: ${result.error}` : '',
  ].filter(Boolean).join('\n');
}
