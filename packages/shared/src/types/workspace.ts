export interface Workspace {
  id: string;
  name: string;
  boundDirs: string[];
  agentspaceDir: string;
  createdAt: string;
  updatedAt: string;
  activeChannels: string[];
  activeIssues: string[];
  agents: AgentConfig[];
}

export interface AgentConfig {
  id: string;
  name: string;
  role: 'scheduler' | 'planner' | 'executor' | 'reviewer';
  description?: string;
  modelProvider?: string;
  modelId?: string;
  workingDir?: string;
  mcps?: string[];
  skills?: string[];
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  sandboxDirs?: string[];
  maxRetries?: number;
  enabled: boolean;
}

export interface CreateWorkspaceInput {
  name: string;
  boundDirs: string[];
}
