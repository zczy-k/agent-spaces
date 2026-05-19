export interface BoundAgent {
  id: string;
  name: string;
  avatarUrl?: string;
}

export interface SkillInfo {
  name: string;
  description: string;
  filename: string;
  content: string;
  favorited: boolean;
  boundAgents: BoundAgent[];
}

export interface AgentCandidate {
  id: string;
  name: string;
  avatarUrl?: string;
  description?: string;
}

export interface SkillsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  standalone?: boolean;
}

export type FilterMode = 'all' | 'favorites' | 'agent';

export interface SkillSyncItem {
  agentId: string;
  agentName: string;
  skillName: string;
  globalMtime: string;
  agentMtime: string;
}
