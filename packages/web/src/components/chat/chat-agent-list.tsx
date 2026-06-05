"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { MessageSquare, Plus } from "lucide-react";
import { useState } from "react";

interface ChatAgent {
  id: string;
  name: string;
  avatar?: string;
  description?: string;
  [key: string]: unknown;
}

interface ChatAgentListProps {
  agents: ChatAgent[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  className?: string;
}

export function ChatAgentList({ agents, activeId, onSelect, onAdd, className }: ChatAgentListProps) {
  const [search, setSearch] = useState("");

  const filtered = agents.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <aside
      className={cn(
        "flex w-[280px] flex-col border-r bg-background",
        className
      )}
    >
      <header className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="font-semibold text-sm">Chat Agents</h2>
        <Button size="icon" variant="ghost" onClick={onAdd} title="Add agent">
          <Plus className="size-4" />
        </Button>
      </header>

      <div className="px-3 py-2">
        <Input
          placeholder="Search agents..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-xs"
        />
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-0.5 p-2">
          {filtered.length === 0 ? (
            <p className="px-2 py-4 text-center text-muted-foreground text-xs">
              {agents.length === 0 ? "No agents yet. Click + to add one." : "No matches found."}
            </p>
          ) : (
            filtered.map((agent) => (
              <button
                key={agent.id}
                onClick={() => onSelect(agent.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent",
                  activeId === agent.id && "bg-accent"
                )}
              >
                <Avatar className="size-8 shrink-0">
                  {agent.avatar && <AvatarImage src={agent.avatar} alt={agent.name} />}
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {agent.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{agent.name}</p>
                  {agent.description && (
                    <p className="truncate text-muted-foreground text-xs">{agent.description}</p>
                  )}
                </div>
                <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}
