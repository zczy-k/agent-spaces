import { randomUUID } from 'node:crypto';
import * as store from '../storage/chat-store.js';
import type { ChatAgent, ChatMessage } from '../storage/chat-store.js';

// --- Agent CRUD ---

export function listAgents(): ChatAgent[] {
  return store.listAgents();
}

export function createAgent(data: Omit<ChatAgent, 'id' | 'createdAt' | 'updatedAt'>): ChatAgent {
  const agent: ChatAgent = {
    ...data,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const agents = store.listAgents();
  agents.push(agent);
  store.saveAgents(agents);
  return agent;
}

export function updateAgent(id: string, data: Partial<Omit<ChatAgent, 'id' | 'createdAt'>>): ChatAgent | null {
  const agents = store.listAgents();
  const idx = agents.findIndex(a => a.id === id);
  if (idx === -1) return null;
  agents[idx] = { ...agents[idx], ...data, updatedAt: new Date().toISOString() };
  store.saveAgents(agents);
  return agents[idx];
}

export function deleteAgent(id: string): boolean {
  const agents = store.listAgents();
  const idx = agents.findIndex(a => a.id === id);
  if (idx === -1) return false;
  agents.splice(idx, 1);
  store.saveAgents(agents);
  store.deleteMessagesByAgent(id);
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
