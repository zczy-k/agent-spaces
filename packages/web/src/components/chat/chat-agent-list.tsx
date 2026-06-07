"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle,
} from "@/components/ui/empty";
import {
  Workspaces, WorkspaceTrigger, WorkspaceContent,
} from "@/components/ui/workspaces";
import { cn } from "@/lib/utils";
import { AgentIcon } from "@/components/common/agent-icon";
import {
  MessageSquarePlus, Settings2, Search, Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useMemo } from "react";
import type { ChatAgent, ChatWorkspace, ChatSession } from "@agent-spaces/sdk";
import { formatDistanceToNow } from "date-fns";

interface ChatSessionListProps {
  workspaces: ChatWorkspace[];
  activeWorkspaceId: string | null;
  agents: ChatAgent[];
  sessions: ChatSession[];
  activeSessionId: string | null;
  sending: Record<string, boolean>;
  onWorkspaceChange: (workspaceId: string) => void;
  onCreateWorkspace: () => void;
  onManageAgents: () => void;
  onNewSession: () => void;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  className?: string;
}

export function ChatAgentList({
  workspaces,
  activeWorkspaceId,
  agents,
  sessions,
  activeSessionId,
  sending,
  onWorkspaceChange,
  onCreateWorkspace,
  onManageAgents,
  onNewSession,
  onSelectSession,
  onDeleteSession,
  className,
}: ChatSessionListProps) {
  const [search, setSearch] = useState("");
  const t = useTranslations("chat.agentList");

  // Enrich sessions with agent info for display
  const enrichedSessions = useMemo(() => {
    return sessions.map((session) => {
      const agent = agents.find((a) => a.id === session.agentId);
      return { ...session, agent };
    });
  }, [sessions, agents]);

  const filtered = enrichedSessions.filter((s) => {
    if (!search) return true;
    const title = s.title || "New Chat";
    return (
      title.toLowerCase().includes(search.toLowerCase()) ||
      (s.agent?.name ?? "").toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <aside
      aria-label="Chat Session List"
      className={cn(
        "flex h-full max-w-sm w-full flex-col gap-2 overflow-hidden rounded-xl border bg-background",
        className
      )}
      role="complementary"
    >
      {/* Workspace Switcher Header */}
      <div className="border-b px-3 py-2">
        <Workspaces
          workspaces={workspaces}
          selectedWorkspaceId={activeWorkspaceId ?? undefined}
          onWorkspaceChange={(ws) => onWorkspaceChange(ws.id)}
          getWorkspaceId={(ws) => ws.id}
          getWorkspaceName={(ws) => ws.name}
        >
          <WorkspaceTrigger className="h-9 w-full text-sm" />
          <WorkspaceContent title={t("workspaces")} searchable>
            <button
              className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm hover:bg-accent"
              onClick={onCreateWorkspace}
            >
              <MessageSquarePlus className="size-4" />
              {t("newWorkspace")}
            </button>
          </WorkspaceContent>
        </Workspaces>
      </div>

      {/* New Session + Search */}
      <div className="flex flex-col gap-2 px-3">
        <Button
          size="sm"
          className="w-full justify-start gap-2"
          onClick={onNewSession}
        >
          <MessageSquarePlus className="size-4" />
          {t("newChat")}
        </Button>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
          <Input
            aria-label="Search sessions"
            autoComplete="off"
            className="h-8 w-full pl-8 text-xs"
            inputMode="search"
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            spellCheck={false}
            type="search"
            value={search}
          />
        </div>
      </div>

      {/* Session List */}
      <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-1">
        {filtered.length === 0 ? (
          <div className="px-3 py-6">
            <Empty className="border-0 p-0">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <MessageSquarePlus />
                </EmptyMedia>
                <EmptyTitle>
                  {sessions.length === 0 ? t("noSessions") : t("noMatches")}
                </EmptyTitle>
                <EmptyDescription>
                  {sessions.length === 0 ? t("noSessionsDesc") : t("noMatchesDesc")}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        ) : (
          filtered.map((session) => (
            <div
              key={session.id}
              role="button"
              tabIndex={0}
              aria-label={`Chat: ${session.title || "New Chat"}`}
              className={cn(
                "group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                activeSessionId === session.id && "bg-accent"
              )}
              onClick={() => onSelectSession(session.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectSession(session.id);
                }
              }}
            >
              <div className="relative flex-shrink-0">
                {session.agent && (
                  <AgentIcon
                    agentId={session.agent.id}
                    name={session.agent.name}
                    avatarUrl={session.agent.avatar}
                    icon={session.agent.icon}
                    className="size-8"
                  />
                )}
                {sending[session.id] && (
                  <span className="-bottom-0 absolute right-0 flex items-center">
                    <span
                      aria-label="running"
                      className="inline-block size-2.5 rounded-full border-2 border-background bg-blue-500 animate-pulse"
                    />
                  </span>
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-sm font-medium">
                  {session.title || "New Chat"}
                </span>
                <span className="truncate text-muted-foreground text-xs">
                  {session.agent?.name ?? "Unknown"}
                  {" · "}
                  {formatDistanceToNow(new Date(session.updatedAt), { addSuffix: true })}
                </span>
              </div>
              <Button
                aria-label="Delete session"
                className="ml-auto size-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteSession(session.id);
                }}
                size="icon"
                variant="ghost"
                type="button"
              >
                <Trash2 aria-hidden="true" className="size-3.5 text-muted-foreground" focusable="false" />
              </Button>
            </div>
          ))
        )}
      </div>

      {/* Bottom: Manage Agents */}
      <div className="border-t px-3 py-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground"
          onClick={onManageAgents}
        >
          <Settings2 className="size-4" />
          {t("manageAgents")}
        </Button>
      </div>
    </aside>
  );
}
