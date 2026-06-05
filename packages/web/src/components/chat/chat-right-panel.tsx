"use client";

interface ChatRightPanelProps {
  agentId?: string;
}

export function ChatRightPanel({ agentId }: ChatRightPanelProps) {
  return (
    <div className="flex h-full w-[320px] shrink-0 flex-col rounded-xl border border-border/40 bg-background shadow-sm">
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        {agentId ? `Panel: ${agentId}` : "No agent selected"}
      </div>
    </div>
  );
}
