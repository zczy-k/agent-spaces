import { getDataDir, ensureDir, readJsonFile, writeJsonFile, deleteFile } from './json-store.js';
import path from 'node:path';
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
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

function chatTemplatesDir(): string {
  return path.join(getDataDir(), 'chat-templates');
}

export function agentDir(agentId: string): string {
  return path.join(chatTemplatesDir(), agentId);
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

export function chatSessionDir(chatId: string): string {
  return path.join(chatDir(), chatId);
}

export function chatWorkspaceDir(chatId: string): string {
  return path.join(chatSessionDir(chatId), 'workspaces');
}

function chatWorkspaceSkillsDir(chatId: string): string {
  return path.join(chatWorkspaceDir(chatId), 'skills');
}

export function messageHistoryDir(agentId: string): string {
  return chatSessionDir(agentId);
}

function messagesFile(chatId: string): string {
  return path.join(chatSessionDir(chatId), 'messages.json');
}

// --- Agent functions ---

export function listAgents(): ChatAgent[] {
  ensureDir(chatTemplatesDir());
  return readdirSync(chatTemplatesDir(), { withFileTypes: true })
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
  ensureDir(chatWorkspaceDir(agent.id));
  ensureDir(chatWorkspaceSkillsDir(agent.id));
  writeJsonFile(agentFile(agent.id), agent);
  writeJsonFile(mcpFile(agent.id), agent.mcps ?? {});
  writeSkills(agent.id, skillInputs, agent.skills ?? []);
}

export function findAgent(id: string): ChatAgent | undefined {
  return readJsonFile<ChatAgent>(agentFile(id)) ?? undefined;
}

export function deleteAgent(id: string): void {
  rmSync(agentDir(id), { recursive: true, force: true });
  rmSync(chatSessionDir(id), { recursive: true, force: true });
}

// --- Message functions ---

export function listMessages(agentId: string, limit?: number, before?: string): ChatMessage[] {
  ensureDir(chatSessionDir(agentId));
  let messages = readJsonFile<ChatMessage[]>(messagesFile(agentId)) ?? [];
  messages = messages.filter(msg => msg.agentId === agentId);

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
  const messages = readJsonFile<ChatMessage[]>(messagesFile(msg.agentId)) ?? [];
  messages.push(msg);
  writeJsonFile(messagesFile(msg.agentId), messages);
}

export function deleteMessagesByAgent(agentId: string): void {
  deleteFile(messagesFile(agentId));
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
      const filename = sanitizeMarkdownFilename(skill.name);
      const content = skill.content ?? readSkillContent(skill.name) ?? '';
      writeJsonSkillFile(path.join(dir, filename), content);
      writeJsonSkillFile(path.join(chatWorkspaceSkillsDir(agentId), filename), content);
    }
    return;
  }

  for (const name of skillNames.map(skill => typeof skill === 'string' ? skill : skill.name)) {
    const filename = sanitizeMarkdownFilename(name);
    const content = readSkillContent(name) ?? '';
    const filePath = path.join(dir, filename);
    if (content || !existsSync(filePath)) writeJsonSkillFile(filePath, content);
    const workspaceSkillPath = path.join(chatWorkspaceSkillsDir(agentId), filename);
    if (content || !existsSync(workspaceSkillPath)) writeJsonSkillFile(workspaceSkillPath, content);
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

function readSkillContent(name: string): string | undefined {
  const skillName = name.trim().replace(/\.md$/i, '');
  if (!skillName) return undefined;

  const candidates = [
    path.join(getDataDir(), 'skills', skillName, 'SKILL.md'),
    path.join(getDataDir(), 'skills', `${skillName}.md`),
    path.join(process.cwd(), 'skills', skillName, 'SKILL.md'),
    path.join(process.cwd(), 'skills', `${skillName}.md`),
  ];
  const source = candidates.find(file => existsSync(file));
  if (!source) return undefined;

  const content = readFileSync(source, 'utf-8');
  return content.trim() ? content : undefined;
}
