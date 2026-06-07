import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import * as store from '../storage/chat-store.js';
import type { ChatAgent, ChatMessage, ChatWorkspace, ChatSession } from '../storage/chat-store.js';

// --- Agent CRUD ---

export function listAgents(): ChatAgent[] {
  return store.listAgents();
}

export function createAgent(data: Omit<ChatAgent, 'id' | 'createdAt' | 'updatedAt'>): ChatAgent {
  const id = randomUUID();
  const now = new Date().toISOString();
  const agent: ChatAgent = {
    ...normalizeAgentData(data),
    id,
    workingDir: store.chatWorkspaceDir(id),
    createdAt: now,
    updatedAt: now,
  };
  store.saveAgent(agent, data.skills as Array<string | { name: string; content?: string }> | undefined);
  return agent;
}

export function updateAgent(id: string, data: Partial<Omit<ChatAgent, 'id' | 'createdAt'>>): ChatAgent | null {
  const existing = store.findAgent(id);
  if (!existing) return null;
  const updated: ChatAgent = {
    ...existing,
    ...normalizeAgentData({ ...existing, ...data }),
    id,
    createdAt: existing.createdAt,
    workingDir: store.chatWorkspaceDir(id),
    updatedAt: new Date().toISOString(),
  };
  store.saveAgent(updated, data.skills as Array<string | { name: string; content?: string }> | undefined);
  return updated;
}

export function deleteAgent(id: string): boolean {
  if (!store.findAgent(id)) return false;
  store.deleteAgent(id);
  return true;
}

export function findAgent(id: string): ChatAgent | undefined {
  return store.findAgent(id);
}

// --- Message CRUD ---

export function listMessages(agentId: string, limit?: number, before?: string): ChatMessage[] {
  return store.listMessages(agentId, limit, before);
}

export function saveMessage(msg: Omit<ChatMessage, 'id' | 'timestamp'>): ChatMessage {
  const message: ChatMessage = {
    ...msg,
    id: randomUUID(),
    timestamp: new Date().toISOString(),
  };
  store.saveMessage(message);
  return message;
}

export function clearMessages(agentId: string): void {
  store.deleteMessagesByAgent(agentId);
}

export function getRecentMessages(agentId: string, limit?: number): ChatMessage[] {
  return store.getRecentMessages(agentId, limit);
}

export function getAgentWorkingDir(agentId: string): string | null {
  const agent = store.findAgent(agentId);
  if (!agent) return null;
  return agent.workingDir || store.chatWorkspaceDir(agentId);
}

export function getAgentConfigDir(agentId: string): string | null {
  return store.findAgent(agentId) ? store.agentDir(agentId) : null;
}

export function getAgentWorkspace(agentId: string) {
  const workingDir = getAgentWorkingDir(agentId);
  if (!workingDir) return null;
  if (!existsSync(workingDir)) {
    const defaultWorkingDir = store.chatWorkspaceDir(agentId);
    if (workingDir !== defaultWorkingDir) return null;
    mkdirSync(workingDir, { recursive: true });
  }
  const now = new Date().toISOString();
  return {
    id: `chat:${agentId}`,
    name: 'Chat Agent',
    boundDirs: [workingDir],
    agentspaceDir: workingDir,
    createdAt: now,
    updatedAt: now,
    activeChannels: [],
    activeIssues: [],
  };
}

// --- Workspace CRUD ---

export function listWorkspaces(): ChatWorkspace[] {
  return store.listWorkspaces();
}

export function createWorkspace(data: { name: string; agentIds?: string[] }): ChatWorkspace {
  return store.createWorkspace(data);
}

export function updateWorkspace(id: string, data: { name?: string; agentIds?: string[] }): ChatWorkspace | null {
  return store.updateWorkspace(id, data);
}

export function deleteWorkspace(id: string): boolean {
  return store.deleteWorkspace(id);
}

// --- Session CRUD ---

export function listSessions(workspaceId: string): ChatSession[] {
  return store.listSessions(workspaceId);
}

export function createSession(workspaceId: string, agentId: string): ChatSession | null {
  return store.createSession(workspaceId, agentId);
}

export function updateSession(workspaceId: string, sessionId: string, data: { title?: string; archived?: boolean }): ChatSession | null {
  return store.updateSession(workspaceId, sessionId, data);
}

export function deleteSession(workspaceId: string, sessionId: string): boolean {
  return store.deleteSession(workspaceId, sessionId);
}

export function findSession(workspaceId: string, sessionId: string): ChatSession | undefined {
  return store.findSession(workspaceId, sessionId);
}

// --- Session Messages ---

export function listSessionMessages(workspaceId: string, sessionId: string): ChatMessage[] {
  return store.listSessionMessages(workspaceId, sessionId);
}

export function saveSessionMessage(workspaceId: string, sessionId: string, msg: Omit<ChatMessage, 'id' | 'timestamp'>): ChatMessage {
  const message: ChatMessage = {
    ...msg,
    id: randomUUID(),
    timestamp: new Date().toISOString(),
  };
  store.saveSessionMessage(workspaceId, sessionId, message);
  return message;
}

export function clearSessionMessages(workspaceId: string, sessionId: string): void {
  store.clearSessionMessages(workspaceId, sessionId);
}

export function getRecentSessionMessages(workspaceId: string, sessionId: string, limit?: number): ChatMessage[] {
  return store.getRecentSessionMessages(workspaceId, sessionId, limit);
}

// --- Migration ---

export { migrateToWorkspaces } from '../storage/chat-store.js';

function normalizeAgentData(data: Partial<ChatAgent> & Record<string, unknown>): Omit<ChatAgent, 'id' | 'createdAt' | 'updatedAt'> {
  const provider = stringValue(data.provider) || stringValue(data.modelProvider) || 'openai-chat-completions';
  const model = stringValue(data.model) || stringValue(data.modelId) || '';
  const baseURL = stringValue(data.baseURL) || stringValue(data.apiBase) || undefined;
  const avatar = stringValue(data.avatar) || stringValue(data.avatarUrl) || undefined;
  const skills = normalizeSkillNames(data.skills);

  return {
    name: stringValue(data.name) || 'New Chat Agent',
    role: 'agent',
    runtimeKind: 'langchain',
    avatar,
    avatarUrl: avatar,
    icon: stringValue(data.icon) || undefined,
    description: stringValue(data.description) || undefined,
    systemPrompt: stringValue(data.systemPrompt) || undefined,
    provider,
    modelProvider: provider,
    model,
    modelId: model,
    apiKey: stringValue(data.apiKey),
    baseURL,
    apiBase: baseURL,
    workingDir: stringValue(data.workingDir),
    mcps: isRecord(data.mcps) ? data.mcps : {},
    skills,
    tools: Array.isArray(data.tools) ? data.tools as ChatAgent['tools'] : [],
    outputStyle: stringValue(data.outputStyle) || undefined,
    temperature: typeof data.temperature === 'number' ? data.temperature : 0.3,
    maxTokens: typeof data.maxTokens === 'number' ? data.maxTokens : 4096,
    enabled: data.enabled !== false,
  };
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeSkillNames(skills: unknown): string[] {
  if (!Array.isArray(skills)) return [];
  return skills
    .map(skill => typeof skill === 'string' ? skill : isRecord(skill) ? stringValue(skill.name) : '')
    .filter(Boolean);
}
