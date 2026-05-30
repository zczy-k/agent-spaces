"use client";

import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { MemberInfoCard } from "./member-info-card";
import type { ReactNode } from "react";

interface MemberHoverCardProps {
  agentId: string;
  displayName?: string;
  channels?: string[];
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  onConfigure?: () => void;
  children: ReactNode;
}

export function MemberHoverCard({
  agentId,
  displayName,
  channels,
  side = "top",
  align = "start",
  onConfigure,
  children,
}: MemberHoverCardProps) {
  return (
    <HoverCard>
      <HoverCardTrigger render={<div className="inline-flex items-center" />}>{children}</HoverCardTrigger>
      <HoverCardContent side={side} align={align} className="w-72">
        <MemberInfoCard
          agentId={agentId}
          displayName={displayName}
          channels={channels}
          compact
          onConfigure={onConfigure}
        />
      </HoverCardContent>
    </HoverCard>
  );
}
