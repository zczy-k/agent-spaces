import { getDataDir, ensureDir, readJsonFile, writeJsonFile, deleteFile } from './json-store.js';
import path from 'node:path';
import { existsSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import type { BuiltInAgentToolName } from '@agent-spaces/shared';

export interface ChatAgent {
  id: string;
  name: string;
  role?: 'agent';
  runtimeKind?: 'langchain';
  avatar?: string;
  avatarUrl?: string;
  icon?: string;
  description?: string;
  systemPrompt?: string;
  modelProvider?: string;
  modelId?: string;
  provider: string;
  model: string;
  apiKey: string;
  baseURL?: string;
  apiBase?: string;
  workingDir?: string;
  mcps?: Record<string, unknown>;
  skills?: Array<string | { name: string; content?: string }>;
  tools?: BuiltInAgentToolName[];
  outputStyle?: string;
  temperature?: number;
  maxTokens?: number;
  enabled?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  agentId: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: string;
  thinking?: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
}

function chatDir(): string {
  return path.join(getDataDir(), 'chat');
}

export function agentDir(agentId: string): string {
  return path.join(chatDir(), agentId);
}

function agentFile(agentId: string): string {
  return path.join(agentDir(agentId), 'agent.json');
}

function mcpFile(agentId: string): string {
  return path.join(agentDir(agentId), 'mcp.json');
}

function skillsDir(agentId: string): string {
  return path.join(agentDir(agentId), 'skills');
}

export function messageHistoryDir(agentId: string): string {
  return path.join(agentDir(agentId), 'message_history');
}

function messageFile(agentId: string, messageId: string): string {
  return path.join(messageHistoryDir(agentId), `${messageId}.json`);
}

// --- Agent functions ---

export function listAgents(): ChatAgent[] {
  ensureDir(chatDir());
  return readdirSync(chatDir(), { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .flatMap(entry => {
      const agent = readJsonFile<ChatAgent>(agentFile(entry.name));
      return agent ? [agent] : [];
    })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function saveAgent(agent: ChatAgent, skillInputs?: Array<string | { name: string; content?: string }>): void {
  const dir = agentDir(agent.id);
  ensureDir(dir);
  ensureDir(skillsDir(agent.id));
  writeJsonFile(agentFile(agent.id), agent);
  writeJsonFile(mcpFile(agent.id), agent.mcps ?? {});
  writeSkills(agent.id, skillInputs, agent.skills ?? []);
}

export function findAgent(id: string): ChatAgent | undefined {
  return readJsonFile<ChatAgent>(agentFile(id)) ?? undefined;
}

export function deleteAgent(id: string): void {
  rmSync(agentDir(id), { recursive: true, force: true });
}

// --- Message functions ---

export function listMessages(agentId: string, limit?: number, before?: string): ChatMessage[] {
  const dir = messageHistoryDir(agentId);
  ensureDir(dir);

  let files: string[];
  try {
    files = readdirSync(dir).filter(f => f.endsWith('.json'));
  } catch {
    return [];
  }

  let messages: ChatMessage[] = [];
  for (const file of files) {
    const msg = readJsonFile<ChatMessage>(path.join(dir, file));
    if (msg && msg.agentId === agentId) {
      messages.push(msg);
    }
  }

  // Sort descending by timestamp
  messages.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  // Cursor pagination: skip messages at or after 'before' timestamp
  if (before) {
    const idx = messages.findIndex(m => m.timestamp <= before);
    if (idx === -1) {
      messages = [];
    } else {
      messages = messages.slice(idx);
    }
  }

  // Apply limit
  if (limit && limit > 0) {
    messages = messages.slice(0, limit);
  }

  // Return ascending order
  messages.reverse();
  return messages;
}

export function saveMessage(msg: ChatMessage): void {
  writeJsonFile(messageFile(msg.agentId, msg.id), msg);
}

export function deleteMessagesByAgent(agentId: string): void {
  const dir = messageHistoryDir(agentId);
  if (!existsSync(dir)) return;
  for (const file of readdirSync(dir).filter(f => f.endsWith('.json'))) {
    deleteFile(path.join(dir, file));
  }
}

export function getRecentMessages(agentId: string, limit: number = 50): ChatMessage[] {
  return listMessages(agentId, limit);
}

function writeSkills(
  agentId: string,
  skillInputs: Array<string | { name: string; content?: string }> | undefined,
  skillNames: Array<string | { name: string; content?: string }>,
): void {
  const dir = skillsDir(agentId);
  if (skillInputs?.some(skill => typeof skill !== 'string')) {
    rmSync(dir, { recursive: true, force: true });
    ensureDir(dir);
    for (const skill of skillInputs) {
      if (typeof skill === 'string' || !skill.name.trim()) continue;
      writeJsonSkillFile(path.join(dir, sanitizeMarkdownFilename(skill.name)), skill.content ?? '');
    }
    return;
  }

  for (const name of skillNames.map(skill => typeof skill === 'string' ? skill : skill.name)) {
    const filename = sanitizeMarkdownFilename(name);
    const filePath = path.join(dir, filename);
    if (!existsSync(filePath)) writeJsonSkillFile(filePath, '');
  }
}

function writeJsonSkillFile(filePath: string, content: string): void {
  ensureDir(path.dirname(filePath));
  writeFileSync(filePath, content, 'utf-8');
}

function sanitizeMarkdownFilename(name: string): string {
  const base = name.trim().replace(/[/\\:*?"<>|]+/g, '-');
  return base.toLowerCase().endsWith('.md') ? base : `${base}.md`;
}
