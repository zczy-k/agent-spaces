import type { Message } from '@agent-spaces/shared';
import type { Channel } from '@agent-spaces/shared';
import { readWorkspacePrompt } from '../services/workspace-prompt.js';
import { stripHtml } from './html-utils.js';
import * as issueService from '../services/issue.js';
import { getChannel } from '../services/channel.js';
import { createIssueFunctionTools } from '../services/builtin-tools.js';

export interface BuiltInToolContext {
  name: string;
  description: string;
  channelId?: string;
  issueId?: string;
  issueTitle?: string;
}

export function buildAgentPrompt(
  workspaceId: string,
  systemPrompt: string | undefined,
  userPrompt: string,
  history: Message[] = [],
  runtimeConfig?: {
    mcpServers: string[];
    skills: string[];
    boundDirs?: string[];
    builtInTools?: BuiltInToolContext[];
  },
): string {
  const parts: string[] = [];
  const trimmedSystemPrompt = systemPrompt?.trim();
  if (trimmedSystemPrompt) parts.push(trimmedSystemPrompt);

  if (runtimeConfig) {
    const configLines = [
      'Agent runtime configuration:',
      `- MCP servers configured for this agent: ${runtimeConfig.mcpServers.length ? runtimeConfig.mcpServers.join(', ') : 'none'}`,
      `- Skills configured for this agent: ${runtimeConfig.skills.length ? runtimeConfig.skills.join(', ') : 'none'}`,
      '- Runtime tools available through Claude Code: Read, Write, Edit, MultiEdit, Bash, Grep, Glob, Task, TodoWrite, WebFetch, WebSearch',
      `- Agent Spaces channel tools configured for this channel: ${runtimeConfig.builtInTools?.length ? runtimeConfig.builtInTools.map((tool) => tool.name).join(', ') : 'none'}`,
    ];
    if (runtimeConfig.boundDirs?.length) {
      configLines.push(`- Code directories (boundDirs): ${runtimeConfig.boundDirs.join(', ')}`);
    }
    configLines.push('- For Bash commands that create or modify files under the current working directory, use relative paths such as `mkdir -p css js` instead of absolute paths.');
    if (runtimeConfig.builtInTools?.length) {
      configLines.push(...formatBuiltInToolContext(runtimeConfig.builtInTools));
    }
    if (isIssueContextLookup(userPrompt)) {
      configLines.push(
        'Current issue lookup rule:',
        '- The user is asking for the current channel issue.',
        '- If Agent Spaces channel tools include ViewCurrentChannelIssue, call that function tool first and answer from the tool result.',
        '- Do not use Bash, Glob, Grep, or project files to infer the current channel issue.',
        '- If ViewCurrentChannelIssue is not configured but CreateCurrentChannelIssue is configured, say this channel is not bound to an issue yet.',
        '- If no Agent Spaces channel issue tool is configured, say the issue tool is unavailable.',
      );
    }
    configLines.push(
      'When asked what MCP servers, skills, runtime tools, or Agent Spaces channel tools you have, answer from this configuration only.',
      'Important distinction: MCP servers configured for this agent are only the names in "MCP servers configured for this agent". Agent Spaces channel tools are built-in runtime tools and must not be listed as agent-configured MCP servers.',
      'Do not infer availability from provider-side function names, hidden runtime internals, previous sessions, or filesystem settings.',
    );
    parts.push(configLines.join('\n'));
  }

  if (history.length > 0) {
    const historyLines = formatConversationHistory(history);
    if (historyLines.length > 0) parts.push(['Conversation history:', ...historyLines].join('\n'));
  }

  parts.push(`User message:\n${userPrompt}`);
  return prependWorkspacePrompt(workspaceId, parts.join('\n\n'));
}

function formatConversationHistory(history: Message[]): string[] {
  const lines: string[] = [];
  for (const msg of history) {
    const role = msg.senderId === 'user' ? 'User' : (msg.senderRole || 'Agent');
    const text = msg.senderId === 'user' ? stripHtml(msg.content) : getAgentFinalMessage(msg);
    if (!text.trim()) continue;
    lines.push(`[${role}]: ${text}`);
    for (const reply of msg.replies ?? []) {
      const replyRole = reply.senderId === 'user' ? 'User' : (reply.senderRole || 'Agent');
      const replyText = reply.senderId === 'user' ? stripHtml(reply.content) : getReplyFinalMessage(reply);
      if (replyText.trim()) lines.push(`[${replyRole} reply]: ${replyText}`);
    }
  }
  return lines;
}

function getAgentFinalMessage(message: Message): string {
  const finalTextParts = message.parts
    ?.filter((part) => part.type === 'text')
    .map((part) => part.text.trim())
    .filter(Boolean);

  if (finalTextParts?.length) return finalTextParts.join('\n\n');

  if (message.parts?.length) return '';
  if (message.status && message.status !== 'completed') return '';

  return stripToolLikeHistoryLines(stripHtml(message.content));
}

function getReplyFinalMessage(reply: NonNullable<Message['replies']>[number]): string {
  const finalTextParts = reply.parts
    ?.filter((part) => part.type === 'text')
    .map((part) => part.text.trim())
    .filter(Boolean);

  if (finalTextParts?.length) return finalTextParts.join('\n\n');
  if (reply.parts?.length) return '';
  if (reply.status && reply.status !== 'completed') return '';
  return stripToolLikeHistoryLines(stripHtml(reply.content));
}

function stripToolLikeHistoryLines(content: string): string {
  const kept = content.split(/\r?\n/).filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return true;
    return !/^Tool:\s*\w+/i.test(trimmed)
      && !/^(Read|Write|Edit|MultiEdit|Bash|Grep|Glob|TodoWrite|Task)\b/i.test(trimmed)
      && !/^Claude Code initialized\b/i.test(trimmed)
      && !/^(Input|Output|Result|Error):\s*\{/i.test(trimmed);
  });

  return kept.join('\n').trim();
}

export function buildBuiltInTools(
  functionTools: ReturnType<typeof createIssueFunctionTools>,
  channel: ReturnType<typeof getChannel>,
  issue: ReturnType<typeof issueService.getById>,
): BuiltInToolContext[] {
  if (!functionTools.length || !channel) return [];

  const issueTitle = issue?.title ?? channel.name;
  return functionTools.map((functionTool) => ({
    name: functionTool.name,
    description: functionTool.description,
    channelId: channel.id,
    issueId: channel.issueId,
    issueTitle,
  }));
}

function prependWorkspacePrompt(workspaceId: string, prompt: string): string {
  const workspacePrompt = readWorkspacePrompt(workspaceId).trim();
  if (!workspacePrompt) return prompt;
  return `${workspacePrompt}\n\n${prompt}`;
}

function isIssueContextLookup(userPrompt: string): boolean {
  const text = stripHtml(userPrompt).toLowerCase();
  return /当前频道.*议题|议题内容|current channel.*issue|issue.*current channel/.test(text);
}

function formatBuiltInToolContext(tools: BuiltInToolContext[]): string[] {
  const firstTool = tools[0];
  const firstIssueTool = tools.find((tool) => tool.issueId);
  const lines = [
    'Built-in issue tool rules:',
    '- These are real function-call tools exposed by the Agent Spaces runtime.',
    '- They are not agent-configured MCP servers and must be reported only as Agent Spaces channel tools.',
    '- Tool calls must use the current channel id.',
  ];
  if (firstTool?.channelId) lines.push(`- Current channel id: ${firstTool.channelId}`);
  if (firstIssueTool?.issueId) {
    lines.push(`- Current channel issue id: ${firstIssueTool.issueId}`);
    lines.push(`- Current channel issue title: ${firstIssueTool.issueTitle || 'Untitled issue'}`);
  } else {
    lines.push('- Current channel is not bound to an issue yet. Use CreateCurrentChannelIssue before viewing or commenting.');
  }
  for (const tool of tools) {
    lines.push(`- ${tool.name}: ${tool.description}`);
  }
  return lines;
}
