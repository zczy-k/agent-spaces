"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { IconUserPlus, IconBell, IconBellOff } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { AgentIcon } from "@/components/common/agent-icon";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AgentEditor } from "@/components/sidebar/agent-editor";
import { normalizeAgent } from "@/components/sidebar/agent-shared";
import { useAgentStore } from "@/stores/agent";
import { MemberInfoCard } from "./member-info-card";
import type { Channel } from "@agent-spaces/shared";
import type { MentionedAgent } from "./chat-input-utils";

interface ChatInputAgentBarProps {
  agents: MentionedAgent[];
  activeAgent?: MentionedAgent;
  lastActiveAgentId?: string;
  channel: Channel;
  onActivateAgent: (agent: MentionedAgent) => void;
  onOpenAddMember: () => void;
  onToggleNotify: () => void;
}

export function ChatInputAgentBar({
  agents,
  activeAgent,
  lastActiveAgentId,
  channel,
  onActivateAgent,
  onOpenAddMember,
  onToggleNotify,
}: ChatInputAgentBarProps) {
  const t = useTranslations("chat");
  const [configAgentId, setConfigAgentId] = useState<string | null>(null);
  const storeAgents = useAgentStore((s) => s.agents);
  const visibleAgents = [...new Map(agents.map((agent) => [agent.id, agent])).values()];

  return (
    <>
      <div className="flex items-center gap-1 mb-1.5">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none flex-1 min-w-0">
          <button
            type="button"
            onClick={onOpenAddMember}
            className="shrink-0 inline-flex items-center justify-center size-6 rounded-full text-muted-foreground border border-dashed border-muted-foreground/40 hover:bg-accent hover:text-foreground transition-all cursor-pointer"
            title={t("input.manageMembers")}
          >
            <IconUserPlus className="size-3.5" />
          </button>
          {visibleAgents.map((agent) => {
            const isActive = agent.id === activeAgent?.id;
            const isLastActive = !isActive && agent.id === lastActiveAgentId;
            return (
              <HoverCard key={agent.id}>
                <HoverCardTrigger
                  render={<div />}
                  onClick={() => onActivateAgent(agent)}
                  className={cn(
                    "shrink-0 inline-flex items-center gap-1 h-6 pl-0.5 pr-1.5 rounded-full text-xs transition-all cursor-pointer",
                    isActive
                      ? "relative overflow-hidden bg-primary/10 text-primary border border-primary/30"
                      : isLastActive
                        ? "text-primary/70 border border-primary/20 bg-primary/5"
                        : "text-muted-foreground border border-transparent hover:bg-accent"
                  )}
                >
                  {isActive && (
                    <>
                      <div className="absolute w-[300%] h-[60%] opacity-80 bottom-[-11px] right-[-250%] rounded-full animate-star-movement-bottom z-0 pointer-events-none"
                        style={{ background: "radial-gradient(circle, var(--primary), transparent 20%)", animationDuration: "3s" }}
                      />
                      <div className="absolute w-[300%] h-[60%] opacity-80 top-[-10px] left-[-250%] rounded-full animate-star-movement-top z-0 pointer-events-none"
                        style={{ background: "radial-gradient(circle, var(--primary), transparent 10%)", animationDuration: "3s" }}
                      />
                    </>
                  )}
                  <AgentIcon
                    agentId={agent.id}
                    name={agent.name || agent.role}
                    avatarUrl={agent.avatarUrl}
                    className="relative z-10 size-5 rounded-full text-[9px]"
                  />
                  <span className="relative z-10 max-w-[80px] truncate">{agent.name || agent.role}</span>
                </HoverCardTrigger>
                <HoverCardContent side="top" align="start" className="w-72">
                  <MemberInfoCard agentId={agent.id} compact onConfigure={() => setConfigAgentId(agent.id)} />
                </HoverCardContent>
              </HoverCard>
            );
          })}
        </div>
        <button
          type="button"
          onClick={onToggleNotify}
          className={cn(
            "shrink-0 inline-flex items-center gap-1 h-6 px-1.5 rounded-full text-xs transition-all",
            channel.notifyOnComplete
              ? "bg-primary/10 text-primary border border-primary/30"
              : "text-muted-foreground border border-transparent hover:bg-accent"
          )}
          title={t("input.notifyOnComplete")}
        >
          {channel.notifyOnComplete ? <IconBell className="size-3" /> : <IconBellOff className="size-3" />}
        </button>
      </div>
      {configAgentId && (() => {
        const agent = storeAgents.find((a) => a.id === configAgentId);
        if (!agent) return null;
        return (
          <Dialog open={Boolean(configAgentId)} onOpenChange={(open) => { if (!open) setConfigAgentId(null); }}>
            <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">
              <DialogHeader className="border-b px-5 py-3">
                <DialogTitle>配置 Agent</DialogTitle>
                <DialogDescription />
              </DialogHeader>
              <AgentEditor
                agent={normalizeAgent(agent)}
                onSaved={() => setConfigAgentId(null)}
                onBack={() => setConfigAgentId(null)}
                showFooter
              />
            </DialogContent>
          </Dialog>
        );
      })()}
    </>
  );
}
