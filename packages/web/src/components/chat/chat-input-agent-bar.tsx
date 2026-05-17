"use client";

import { cn } from "@/lib/utils";
import { IconPin, IconPinFilled, IconUserPlus, IconBell, IconBellOff } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { AgentIcon } from "@/components/common/agent-icon";
import type { Channel } from "@agent-spaces/shared";
import type { MentionedAgent } from "./chat-input-utils";

interface ChatInputAgentBarProps {
  agents: MentionedAgent[];
  activeAgent?: MentionedAgent;
  pinnedMentionId?: string;
  isPinned: boolean;
  channel: Channel;
  onActivateAgent: (agent: MentionedAgent) => void;
  onTogglePin: () => void;
  onOpenAddMember: () => void;
  onToggleNotify: () => void;
}

export function ChatInputAgentBar({
  agents,
  activeAgent,
  pinnedMentionId,
  isPinned,
  channel,
  onActivateAgent,
  onTogglePin,
  onOpenAddMember,
  onToggleNotify,
}: ChatInputAgentBarProps) {
  const t = useTranslations("chat");

  return (
    <div className="flex items-center gap-1 mb-1.5">
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none flex-1 min-w-0">
        <button
          type="button"
          onClick={onOpenAddMember}
          className="shrink-0 inline-flex items-center justify-center size-6 rounded-full text-muted-foreground border border-dashed border-muted-foreground/40 hover:bg-accent hover:text-foreground transition-all"
          title={t("input.manageMembers")}
        >
          <IconUserPlus className="size-3.5" />
        </button>
        {agents.map((agent) => {
          const isActive = agent.id === activeAgent?.id;
          return (
            <button
              key={agent.id}
              type="button"
              onClick={() => onActivateAgent(agent)}
              className={cn(
                "shrink-0 inline-flex items-center gap-1 h-6 pl-0.5 pr-1 rounded-full text-xs transition-all",
                isActive
                  ? "bg-primary/10 text-primary border border-primary/30"
                  : "text-muted-foreground border border-transparent hover:bg-accent"
              )}
            >
              <AgentIcon
                agentId={agent.id}
                name={agent.name || agent.role}
                avatarUrl={agent.avatarUrl}
                className="size-5 rounded-full text-[9px]"
              />
              <span className="max-w-[80px] truncate">{agent.name || agent.role}</span>
              {isActive ? (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onTogglePin();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.stopPropagation();
                      onTogglePin();
                    }
                  }}
                  className={cn(
                    "inline-flex items-center justify-center size-4 rounded-full hover:bg-primary/20 transition-colors",
                    isPinned ? "text-primary" : "text-primary/50"
                  )}
                  title={isPinned ? t("input.unpinAgent") : t("input.pinAgent")}
                >
                  {isPinned ? <IconPinFilled className="size-2.5" /> : <IconPin className="size-2.5" />}
                </span>
              ) : pinnedMentionId === agent.id ? (
                <IconPinFilled className="size-2.5 text-muted-foreground/50" />
              ) : null}
            </button>
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
  );
}
