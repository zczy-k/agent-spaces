'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { MessageSquare, UserMinus, Bot, Wrench, Plug, FileText, Sparkles, ChevronDown } from 'lucide-react';
import { useChannelStore } from '@/stores/channel';
import { useAgentStore } from '@/stores/agent';
import { AgentIcon } from '@/components/common/agent-icon';
import { useUserAvatar } from '@/hooks/use-user-avatar';
import type { AgentConfig } from '@agent-spaces/shared';

interface MemberInfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberName: string;
  displayName?: string;
  channelId: string;
  workspaceId: string;
  channels?: string[];
}

const RUNTIME_LABELS: Record<string, string> = {
  'open-agent-sdk': 'OpenAgent SDK',
  'claude-code': 'Claude Code',
  'codex': 'Codex',
  'langchain': 'LangChain',
};

const PROVIDER_LABELS: Record<string, string> = {
  'anthropic-messages': 'Anthropic',
  'openai-chat-completions': 'OpenAI Chat',
  'openai-responses': 'OpenAI Responses',
  'openai-responses-to-anthropic-messages': 'OpenAI → Anthropic',
  'openai-chat-completions-to-anthropic-messages': 'OpenAI Chat → Anthropic',
  'gemini-generate-content': 'Gemini',
};

function InfoRow({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <Icon className="size-3.5 mt-0.5 shrink-0 text-muted-foreground" />
      <span className="text-muted-foreground w-14 shrink-0">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function CollapsibleTagList({ items }: { items: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);

  const checkOverflow = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    setOverflows(el.scrollHeight > el.clientHeight + 2);
  }, []);

  useEffect(() => { checkOverflow(); }, [checkOverflow, items]);

  return (
    <div>
      <div
        ref={containerRef}
        className={`flex flex-wrap gap-1 ${!expanded ? 'max-h-[3rem] overflow-hidden' : ''}`}
      >
        {items.map((item) => (
          <span key={item} className="rounded bg-muted px-1.5 py-0.5 text-[11px]">{item}</span>
        ))}
      </div>
      {overflows && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronDown className={`size-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          {expanded ? '收起' : '展开全部'}
        </button>
      )}
    </div>
  );
}

function AgentDetails({ agent }: { agent: AgentConfig }) {
  return (
    <div className="space-y-2">
      {agent.description && (
        <InfoRow icon={Bot} label="描述">
          <span className="text-foreground">{agent.description}</span>
        </InfoRow>
      )}
      {agent.systemPrompt && (
        <InfoRow icon={FileText} label="提示词">
          <p className="line-clamp-3 text-muted-foreground whitespace-pre-wrap">{agent.systemPrompt}</p>
        </InfoRow>
      )}
      {agent.skills && agent.skills.length > 0 && (
        <InfoRow icon={Sparkles} label="技能">
          <CollapsibleTagList items={agent.skills} />
        </InfoRow>
      )}
      {agent.tools && agent.tools.length > 0 && (
        <InfoRow icon={Wrench} label="工具">
          <CollapsibleTagList items={agent.tools} />
        </InfoRow>
      )}
      {agent.mcps && Object.keys(agent.mcps).length > 0 && (
        <InfoRow icon={Plug} label="MCP">
          <CollapsibleTagList items={Object.keys(agent.mcps)} />
        </InfoRow>
      )}
    </div>
  );
}

export function MemberInfoDialog({ open, onOpenChange, memberName, displayName, channelId, workspaceId, channels = [] }: MemberInfoDialogProps) {
  const [removing, setRemoving] = useState(false);
  const { channels: allChannels, updateChannel } = useChannelStore();
  const agents = useAgentStore((s) => s.agents);
  const agent = memberName !== 'user' ? agents.find((a) => a.id === memberName) : undefined;
  const resolvedName = displayName || agent?.name || memberName;
  const _userAvatar = useUserAvatar();
  const userAvatarUrl = memberName === 'user' ? _userAvatar : null;

  const channel = allChannels.find((c) => c.id === channelId);
  const isMember = channel?.members.includes(memberName);

  const handleRemove = async () => {
    if (!channel || !isMember) return;
    setRemoving(true);
    try {
      const latestChannel = useChannelStore.getState().channels.find((c) => c.id === channelId) ?? channel;
      const members = latestChannel.members.filter((m) => m !== memberName);
      useChannelStore.setState((state) => ({
        channels: state.channels.map((item) => (
          item.id === channelId ? { ...item, members } : item
        )),
      }));
      await updateChannel(workspaceId, channelId, { members });
      onOpenChange(false);
    } finally {
      setRemoving(false);
    }
  };

  const badges: { label: string; variant?: string }[] = [];
  if (agent?.runtimeKind) badges.push({ label: RUNTIME_LABELS[agent.runtimeKind] || agent.runtimeKind });
  if (agent?.modelProvider) badges.push({ label: PROVIDER_LABELS[agent.modelProvider] || agent.modelProvider });
  if (agent?.modelId) badges.push({ label: agent.modelId, variant: 'mono' });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>成员信息</DialogTitle>
          <DialogDescription />
        </DialogHeader>
        <div className="flex items-center gap-3 pt-2">
          <AgentIcon
            agentId={memberName !== 'user' ? memberName : undefined}
            name={resolvedName}
            avatarUrl={userAvatarUrl || undefined}
            className="size-12 rounded-full"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{resolvedName}</p>
            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
              <span className="text-xs text-muted-foreground">{memberName === 'user' ? '成员' : (agent?.role || memberName)}</span>
              {badges.map((b) => (
                <span
                  key={b.label}
                  className={`inline-flex items-center rounded-full bg-muted px-1.5 py-px text-[10px] leading-tight ${b.variant === 'mono' ? 'font-mono' : ''}`}
                >
                  {b.label}
                </span>
              ))}
            </div>
          </div>
        </div>
        {agent && <AgentDetails agent={agent} />}
        {channels.length > 0 && (
          <div className="space-y-2 pt-2">
            <p className="text-xs font-medium text-muted-foreground">所在频道</p>
            <div className="flex flex-wrap gap-1.5">
              {channels.map((ch) => (
                <span key={ch} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs">
                  <MessageSquare className="size-3" />{ch}
                </span>
              ))}
            </div>
          </div>
        )}
        {isMember && memberName !== 'user' && (
          <button
            onClick={handleRemove}
            disabled={removing}
            className="flex items-center justify-center gap-2 w-full mt-2 px-3 py-2 rounded-md text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50 transition-colors cursor-pointer"
          >
            <UserMinus className="size-4" />
            {removing ? '移除中...' : '从频道移除'}
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
}
