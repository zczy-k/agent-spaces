import * as Lark from '@larksuiteoapi/node-sdk';
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
    return { sent: false, reason: 'No Feishu chat is registered yet. Send any message to the bot first.' };
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

  private async handleMessage(data: {
    message?: { chat_id?: string; content?: string };
  }): Promise<void> {
    const chatId = data.message?.chat_id;
    if (!chatId) return;
    const chatIds = larkChatIdsByWorkspace.get(this.workspace.id) ?? new Set<string>();
    chatIds.add(chatId);
    larkChatIdsByWorkspace.set(this.workspace.id, chatIds);
    persistLarkChatIds(this.workspace.id, Array.from(chatIds));

    const text = parseLarkText(data.message?.content);
    if (isBuiltInCommand(text)) {
      await this.sendCard(chatId, 'Agent Spaces', buildCommandResponse(this.workspace.id, text));
      return;
    }

    const botAgent = getConfiguredBotAgent(this.workspace.id);
    if (!botAgent) {
      await this.sendCard(chatId, 'Agent Spaces', '请先设置agent');
      return;
    }

    await this.sendCard(chatId, 'Agent Spaces', `${botAgent.name} agent正在处理...`);
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

function parseLarkText(content?: string): string {
  if (!content) return '';
  try {
    const parsed = JSON.parse(content) as { text?: string };
    return parsed.text?.trim() ?? '';
  } catch {
    return content.trim();
  }
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
  const finalOutput = result.output.map((line) => line.trim()).filter(Boolean).at(-1);
  return finalOutput || result.summary || '处理完成';
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
