import type { Message } from '@agent-spaces/shared';
import type { Channel } from '@agent-spaces/shared';
import { stripHtml } from './html-utils.js';
import * as issueService from '../services/issue.js';
import { getChannel } from '../services/channel.js';
import { createIssueFunctionTools } from '../services/builtin-tools/index.js';
import { prependPersistentAgentContext } from '../services/persistent-agent-context.js';

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
    workingDir?: string;
    excludeNativeClaudeMd?: boolean;
    builtInTools?: BuiltInToolContext[];
  },
): string {
  const parts: string[] = [];
  const trimmedSystemPrompt = systemPrompt?.trim();
  if (trimmedSystemPrompt) parts.push(trimmedSystemPrompt);

  if (runtimeConfig) {
    const configLines = [
      'Agent runtime configuration:',
      `- Current workspace id: ${workspaceId}`,
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
      configLines.push(...formatBuiltInToolContext(workspaceId, runtimeConfig.builtInTools));
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
  return prependPersistentAgentContext(parts.join('\n\n'), {
    workspaceId,
    workingDir: runtimeConfig?.workingDir ?? runtimeConfig?.boundDirs?.[0] ?? process.cwd(),
    boundDirs: runtimeConfig?.boundDirs,
    excludeNativeClaudeMd: runtimeConfig?.excludeNativeClaudeMd,
  });
}

function formatConversationHistory(history: Message[]): string[] {
  const historyLines: string[] = [];
  let remainingBudget = 24_000;

  for (const msg of history) {
    const role = msg.senderId === 'user' ? 'User' : (msg.senderRole || 'Agent');
    const text = msg.senderId === 'user' ? stripHtml(msg.content) : getAgentFinalMessage(msg);
    appendHistoryLine(historyLines, `[${role}]`, text, remainingBudget);
    remainingBudget -= text.length;
    if (remainingBudget <= 0) break;

    for (const reply of msg.replies ?? []) {
      const replyRole = reply.senderId === 'user' ? 'User' : (reply.senderRole || 'Agent');
      const replyText = reply.senderId === 'user' ? stripHtml(reply.content) : getReplyFinalMessage(reply);
      appendHistoryLine(historyLines, `[${replyRole} reply]`, replyText, remainingBudget);
      remainingBudget -= replyText.length;
      if (remainingBudget <= 0) break;
    }
  }
  return historyLines;
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

function appendHistoryLine(lines: string[], label: string, rawText: string, remainingBudget: number): void {
  const text = compactHistoryText(rawText);
  if (!text || remainingBudget <= 0) return;
  const clipped = clipText(text, Math.min(remainingBudget, 4_000));
  if (clipped) lines.push(`${label}: ${clipped}`);
}

function compactHistoryText(text: string): string {
  return stripPromptContextLeak(stripToolLikeHistoryLines(text))
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripPromptContextLeak(text: string): string {
  return text
    .replace(/Persistent agent instructions:\n[\s\S]*?(?=\n\n(?:Agent runtime configuration:|Conversation history:|User message:)|$)/g, '')
    .replace(/Workspace prompt:\n[\s\S]*?(?=\n\n(?:Agent runtime configuration:|Conversation history:|User message:)|$)/g, '')
    .trim();
}

function clipText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 32)).trimEnd()}\n[history truncated]`;
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

function isIssueContextLookup(userPrompt: string): boolean {
  const text = stripHtml(userPrompt).toLowerCase();
  return /当前频道.*议题|议题内容|current channel.*issue|issue.*current channel/.test(text);
}

function formatBuiltInToolContext(workspaceId: string, tools: BuiltInToolContext[]): string[] {
  const firstTool = tools[0];
  const firstIssueTool = tools.find((tool) => tool.issueId);
  const lines = [
    'Built-in Agent Spaces tool rules:',
    '- These are real function-call tools exposed by the Agent Spaces runtime.',
    '- They are not agent-configured MCP servers and must be reported only as Agent Spaces channel tools.',
    '- Use the exact Agent Spaces tool names listed below when operating on Agent Spaces data.',
    '- Tool calls that require workspaceId must use the current workspace id.',
  ];
  lines.push(`- Current workspace id: ${workspaceId}`);
  if (firstTool?.channelId) lines.push(`- Current channel id: ${firstTool.channelId}`);

  if (tools.some((tool) => isIssueToolName(tool.name))) {
    lines.push('- Issue tool calls must use the current channel id.');
    if (firstIssueTool?.issueId) {
      lines.push(`- Current channel issue id: ${firstIssueTool.issueId}`);
      lines.push(`- Current channel issue title: ${firstIssueTool.issueTitle || 'Untitled issue'}`);
    } else {
      lines.push('- Current channel is not bound to an issue yet. Use CreateCurrentChannelIssue before viewing or commenting.');
    }
  }

  if (tools.some((tool) => isDatabaseToolName(tool.name))) {
    lines.push(
      'Knowledge base database tool rules:',
      '- Knowledge base/database documents are Agent Spaces database nodes, not workspace filesystem files.',
      '- In Claude Code, call Agent Spaces database tools with their MCP names, for example mcp__agent-spaces__ListDatabaseNodes.',
      '- To list database files, call mcp__agent-spaces__ListDatabaseNodes with path and optional filter.',
      '- To search database files, call mcp__agent-spaces__SearchDatabaseNodes with path and optional filter.',
      '- To read database content, call mcp__agent-spaces__ReadDatabaseNode with an existing node id.',
      '- To create a new database document, call mcp__agent-spaces__CreateDatabaseNode with title, optional content, and optional parentId or path.',
      '- To write database content, call mcp__agent-spaces__WriteDatabaseNode with an existing node id, mode, replace when needed, and content.',
      '- Do not call the Claude Code native Write tool for knowledge base/database documents; native Write requires file_path and writes workspace files.',
      '- Do not invent database node ids. If the target id is unknown, call mcp__agent-spaces__ListDatabaseNodes or mcp__agent-spaces__SearchDatabaseNodes first.',
      '- If the database is empty or no existing node matches the requested document, call mcp__agent-spaces__CreateDatabaseNode instead of WriteDatabaseNode.',
    );
  }

  for (const tool of tools) {
    lines.push(`- ${formatCallableToolName(tool.name)}: ${tool.description}`);
  }
  return lines;
}

function formatCallableToolName(name: string): string {
  return `mcp__agent-spaces__${name}`;
}

function isIssueToolName(name: string): boolean {
  return name === 'CreateCurrentChannelIssue'
    || name === 'ViewCurrentChannelIssue'
    || name === 'AddCurrentChannelComment';
}

function isDatabaseToolName(name: string): boolean {
  return name === 'ListDatabaseNodes'
    || name === 'SearchDatabaseNodes'
    || name === 'ReadDatabaseNode'
    || name === 'CreateDatabaseNode'
    || name === 'WriteDatabaseNode'
    || name === 'DeleteDatabaseNode'
    || name === 'MoveDatabaseNode'
    || name === 'UpdateDatabaseNodeMeta';
}
