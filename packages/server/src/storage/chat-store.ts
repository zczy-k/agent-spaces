import { getDataDir, ensureDir, readJsonFile, writeJsonFile, deleteFile } from './json-store.js';
import path from 'node:path';
import { readdirSync } from 'node:fs';

export interface ChatAgent {
  id: string;
  name: string;
  avatar?: string;
  description?: string;
  systemPrompt?: string;
  provider: string;
  model: string;
  apiKey: string;
  baseURL?: string;
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

function agentsFile(): string {
  return path.join(chatDir(), 'agents.json');
}

function messageHistoryDir(): string {
  return path.join(chatDir(), 'message_history');
}

function messageFile(messageId: string): string {
  return path.join(messageHistoryDir(), `${messageId}.json`);
}

// --- Agent functions ---

export function listAgents(): ChatAgent[] {
  return readJsonFile<ChatAgent[]>(agentsFile()) ?? [];
}

export function saveAgents(agents: ChatAgent[]): void {
  const file = agentsFile();
  ensureDir(path.dirname(file));
  writeJsonFile(file, agents);
}

export function findAgent(id: string): ChatAgent | undefined {
  return listAgents().find(a => a.id === id);
}

// --- Message functions ---

export function listMessages(agentId: string, limit?: number, before?: string): ChatMessage[] {
  const dir = messageHistoryDir();
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
  writeJsonFile(messageFile(msg.id), msg);
}

export function deleteMessagesByAgent(agentId: string): void {
  const dir = messageHistoryDir();
  ensureDir(dir);

  let files: string[];
  try {
    files = readdirSync(dir).filter(f => f.endsWith('.json'));
  } catch {
    return;
  }

  for (const file of files) {
    const filePath = path.join(dir, file);
    const msg = readJsonFile<ChatMessage>(filePath);
    if (msg && msg.agentId === agentId) {
      deleteFile(filePath);
    }
  }
}

export function getRecentMessages(agentId: string, limit: number = 50): ChatMessage[] {
  return listMessages(agentId, limit);
}
