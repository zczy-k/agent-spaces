import { existsSync, readdirSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { getDataDir, ensureDir } from '../storage/json-store.js';

export interface AgentCommand {
  name: string;
  content: string;
  agentId: string;
  agentName?: string;
}

function getAgentTemplatesDir(): string {
  return join(getDataDir(), 'agent-templates');
}

function getCommandsDir(agentId: string): string {
  return join(getAgentTemplatesDir(), agentId, 'commands');
}

function getAgentName(agentId: string): string | undefined {
  const agentPath = join(getAgentTemplatesDir(), agentId, 'agent.json');
  if (!existsSync(agentPath)) return undefined;
  try {
    const config = JSON.parse(readFileSync(agentPath, 'utf-8'));
    return config.name || agentId;
  } catch {
    return agentId;
  }
}

export function listAgentsWithCommands(): Array<{ agentId: string; agentName: string; commandCount: number }> {
  const templatesDir = getAgentTemplatesDir();
  if (!existsSync(templatesDir)) return [];

  return readdirSync(templatesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const commandsDir = getCommandsDir(entry.name);
      let commandCount = 0;
      if (existsSync(commandsDir)) {
        commandCount = readdirSync(commandsDir)
          .filter((f) => f.endsWith('.md'))
          .length;
      }
      return {
        agentId: entry.name,
        agentName: getAgentName(entry.name) || entry.name,
        commandCount,
      };
    });
}

export function listCommands(agentId: string): AgentCommand[] {
  const dir = getCommandsDir(agentId);
  if (!existsSync(dir)) return [];

  const agentName = getAgentName(agentId);
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => ({
      name: f.replace(/\.md$/, ''),
      content: readFileSync(join(dir, f), 'utf-8'),
      agentId,
      agentName,
    }));
}

export function getCommand(agentId: string, name: string): AgentCommand | null {
  const filePath = join(getCommandsDir(agentId), `${name}.md`);
  if (!existsSync(filePath)) return null;
  return {
    name,
    content: readFileSync(filePath, 'utf-8'),
    agentId,
    agentName: getAgentName(agentId),
  };
}

export function createCommand(agentId: string, name: string, content: string): AgentCommand {
  const dir = getCommandsDir(agentId);
  ensureDir(dir);
  const filePath = join(dir, `${name}.md`);
  writeFileSync(filePath, content, 'utf-8');
  return {
    name,
    content,
    agentId,
    agentName: getAgentName(agentId),
  };
}

export function updateCommand(agentId: string, name: string, content: string): AgentCommand | null {
  const filePath = join(getCommandsDir(agentId), `${name}.md`);
  if (!existsSync(filePath)) return null;
  writeFileSync(filePath, content, 'utf-8');
  return {
    name,
    content,
    agentId,
    agentName: getAgentName(agentId),
  };
}

export function deleteCommand(agentId: string, name: string): boolean {
  const filePath = join(getCommandsDir(agentId), `${name}.md`);
  if (!existsSync(filePath)) return false;
  unlinkSync(filePath);
  return true;
}

export function renameCommand(agentId: string, oldName: string, newName: string): boolean {
  const oldPath = join(getCommandsDir(agentId), `${oldName}.md`);
  const newPath = join(getCommandsDir(agentId), `${newName}.md`);
  if (!existsSync(oldPath) || existsSync(newPath)) return false;
  const content = readFileSync(oldPath, 'utf-8');
  writeFileSync(newPath, content, 'utf-8');
  unlinkSync(oldPath);
  return true;
}
