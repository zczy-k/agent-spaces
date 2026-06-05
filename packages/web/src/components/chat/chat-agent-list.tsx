"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Plus, X } from "lucide-react";
import { useState } from "react";
import type { ChatAgent } from "@agent-spaces/sdk";
import { AgentIcon } from "@/components/common/agent-icon";

interface ChatAgentListProps {
  agents: ChatAgent[];
  activeId: string | null;
  sending: Record<string, boolean>;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
  className?: string;
}

export function ChatAgentList({ agents, activeId, sending, onSelect, onRemove, onAdd, className }: ChatAgentListProps) {
  const [search, setSearch] = useState("");

  const filtered = agents.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <aside
      aria-label="Chat Agent List"
      className={cn(
        "flex h-full max-w-sm w-full flex-col gap-4 overflow-hidden rounded-xl border bg-background",
        className
      )}
      role="complementary"
    >
      <header className="flex items-center justify-between border-b px-4 py-2">
        <h2 className="select-none font-semibold text-lg">Agents</h2>
        <nav aria-label="Agent Actions">
          <Button
            aria-label="Add agent"
            size="icon"
            type="button"
            variant="ghost"
            onClick={onAdd}
          >
            <Plus aria-hidden="true" className="size-5" focusable="false" />
          </Button>
        </nav>
      </header>

      <div className="flex flex-col gap-3 px-4">
        <Input
          aria-label="Search agents"
          autoComplete="off"
          className="h-10 w-full text-sm"
          inputMode="search"
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search agents…"
          spellCheck={false}
          type="search"
          value={search}
        />
      </div>

      <div className="flex flex-1 flex-col gap-1 overflow-y-auto">
        <section aria-labelledby="agent-list-label">
          <h3
            className="flex items-center px-4 font-semibold text-muted-foreground text-xs"
            id="agent-list-label"
          >
            Chat Agents
          </h3>
          <ul className="flex flex-col gap-0.5">
            {filtered.length === 0 ? (
              <li className="px-4 py-2 text-muted-foreground text-sm">
                {agents.length === 0 ? "No agents yet. Click + to add one." : "No matches found."}
              </li>
            ) : (
              filtered.map((agent) => (
                <li className="px-0" key={agent.id}>
                  <button
                    aria-label={`Chat with ${agent.name}`}
                    className={cn(
                      "group flex w-full items-center gap-4 px-4 py-2 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                      activeId === agent.id && "bg-accent"
                    )}
                    onClick={() => onSelect(agent.id)}
                    type="button"
                  >
                    <div className="relative flex flex-shrink-0 items-end">
                      <AgentIcon agentId={agent.id} name={agent.name} avatarUrl={agent.avatar} className="size-8" />
                      <span className="-bottom-0 absolute right-0 flex items-center">
                        <span
                          aria-label={sending[agent.id] ? "running" : "idle"}
                          className={cn(
                            "inline-block size-2.5 rounded-full border-2 border-background",
                            sending[agent.id] ? "bg-blue-500 animate-pulse" : "bg-green-500"
                          )}
                        />
                      </span>
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate font-medium">{agent.name}</span>
                      {agent.description ? (
                        <span className="truncate text-muted-foreground text-xs">
                          {agent.description}
                        </span>
                      ) : null}
                    </div>
                    <Button
                      aria-label={`Remove ${agent.name} from chat`}
                      className="ml-auto size-7 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => { e.stopPropagation(); onRemove(agent.id); }}
                      size="icon"
                      variant="ghost"
                      type="button"
                    >
                      <X aria-hidden="true" className="size-4 text-muted-foreground" focusable="false" />
                    </Button>
                  </button>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </aside>
  );
}
