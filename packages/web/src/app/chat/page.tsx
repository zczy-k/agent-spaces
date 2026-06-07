"use client";

import { useEffect, useState, useCallback } from "react";
import { useChatStore } from "@/stores/chat";
import { ChatAgentList } from "@/components/chat/chat-agent-list";
import { InlineChatPanel } from "@/components/chat/inline-chat-panel";
import { ChatRightPanel } from "@/components/chat/chat-right-panel";
import { AddChatAgentDialog } from "@/components/chat/add-chat-agent-dialog";
import { AddMemberDialog } from "@/components/chat/add-member-dialog";
import { ChatAgentPickerDialog } from "@/components/chat/chat-agent-picker-dialog";
import { MessageSquare } from "lucide-react";
import type { ChatAgent } from "@agent-spaces/sdk";
import type { AgentPreset } from "@/components/sidebar/agent-shared";

export default function ChatPage() {
  const {
    agents,
    workspaces,
    activeWorkspaceId,
    sessions,
    activeSessionId,
    messages,
    sending,
    errors,
    streamingContent,
    streamingThinking,
    loadAgents,
    loadWorkspaces,
    createAgent,
    deleteAgent,
    updateAgent,
    createWorkspace,
    updateWorkspace,
    selectWorkspace,
    createSession,
    deleteSession,
    archiveSession,
    unarchiveSession,
    selectSession,
    sendSessionMessage,
    regenerateSessionMessage,
    stopSession,
    clearSessionMessages,
  } = useChatStore();

  const [agentPickerOpen, setAgentPickerOpen] = useState(false);
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [editAgent, setEditAgent] = useState<ChatAgent | undefined>(undefined);
  const [createAgentOpen, setCreateAgentOpen] = useState(false);
  const [newWorkspaceOpen, setNewWorkspaceOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");

  const activeWorkspace = workspaces.find((ws) => ws.id === activeWorkspaceId);
  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const activeAgent = activeSession
    ? agents.find((a) => a.id === activeSession.agentId)
    : undefined;
  const activeMessages = activeSessionId ? (messages[activeSessionId] ?? []) : [];
  const isSending = activeSessionId ? (sending[activeSessionId] ?? false) : false;
  const activeError = activeSessionId ? (errors[activeSessionId] ?? "") : "";
  const activeStreamingContent = activeSessionId ? (streamingContent[activeSessionId] ?? "") : "";
  const activeStreamingThinking = activeSessionId ? (streamingThinking[activeSessionId] ?? "") : "";

  useEffect(() => {
    loadAgents();
    loadWorkspaces();
  }, [loadAgents, loadWorkspaces]);

  const handleSend = useCallback(
    (content: string) => {
      if (!activeSessionId || isSending) return;
      sendSessionMessage(content.trim());
    },
    [activeSessionId, isSending, sendSessionMessage]
  );

  const handleRegenerate = useCallback(
    (messageId: string) => {
      if (!activeSessionId || isSending) return;
      regenerateSessionMessage(messageId);
    },
    [activeSessionId, isSending, regenerateSessionMessage]
  );

  const handleManageAgents = useCallback(() => {
    setMemberDialogOpen(true);
  }, []);

  const handlePickAgentForSession = useCallback(
    async (agentIds: string[]) => {
      if (!activeWorkspaceId || agentIds.length === 0) return;
      await createSession(agentIds[0]);
      setAgentPickerOpen(false);
    },
    [activeWorkspaceId, createSession]
  );

  const handleCreateWorkspace = useCallback(async () => {
    if (!newWorkspaceName.trim()) return;
    await createWorkspace(newWorkspaceName.trim());
    setNewWorkspaceOpen(false);
    setNewWorkspaceName("");
  }, [newWorkspaceName, createWorkspace]);

  const handleAddAgent = useCallback(
    async (preset: AgentPreset) => {
      await createAgent({
        name: preset.name,
        role: "agent",
        runtimeKind: "langchain",
        description: preset.description || undefined,
        systemPrompt: preset.systemPrompt || undefined,
        modelProvider: preset.modelProvider || "openai-chat-completions",
        modelId: preset.modelId || "gpt-4o-mini",
        provider: preset.modelProvider || "openai-chat-completions",
        model: preset.modelId || "gpt-4o-mini",
        apiKey: preset.apiKey || "",
        apiBase: preset.apiBase || undefined,
        baseURL: preset.apiBase || undefined,
        avatarUrl: preset.avatarUrl || undefined,
        avatar: preset.avatarUrl || undefined,
        icon: preset.icon || undefined,
        workingDir: preset.workingDir,
        mcps: preset.mcps,
        skills: preset.skills,
        tools: preset.tools,
        outputStyle: preset.outputStyle || undefined,
        temperature: preset.temperature,
        maxTokens: preset.maxTokens,
        enabled: preset.enabled,
      });
    },
    [createAgent]
  );

  const workspaceAgentIds = new Set(activeWorkspace?.agentIds ?? []);
  const workspaceAgents = agents.filter((a) => workspaceAgentIds.has(a.id));
  const agentCandidates = workspaceAgents.map((a) => ({
    id: a.id,
    label: a.name,
    description: a.description,
  }));
  return (
    <div className="flex h-full gap-4 bg-muted/30 p-2">
      <ChatAgentList
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        agents={agents}
        sessions={sessions}
        activeSessionId={activeSessionId}
        sending={sending}
        onWorkspaceChange={selectWorkspace}
        onCreateWorkspace={() => setNewWorkspaceOpen(true)}
        onManageAgents={handleManageAgents}
        onNewSession={() => setAgentPickerOpen(true)}
        onSelectSession={selectSession}
        onDeleteSession={deleteSession}
        onArchiveSession={archiveSession}
        onUnarchiveSession={unarchiveSession}
        className="w-[280px] shrink-0 rounded-xl border border-border/40 bg-background shadow-sm"
      />

      <div className="flex-1 rounded-xl border border-border/40 bg-background shadow-sm">
        {activeAgent && activeSession ? (
          <InlineChatPanel
            agentId={activeAgent.id}
            agentName={activeAgent.name}
            agentAvatar={activeAgent.avatar}
            agentIcon={activeAgent.icon}
            agentDescription={activeAgent.description}
            messages={activeMessages}
            sending={isSending}
            error={activeError}
            streamingContent={activeStreamingContent}
            streamingThinking={activeStreamingThinking}
            onSend={handleSend}
            onStop={stopSession}
            onClearMessages={clearSessionMessages}
            onRegenerate={handleRegenerate}
            onEditAgent={(id) => {
              const agent = agents.find((a) => a.id === id);
              if (agent) setEditAgent(agent);
            }}
            onToggleRightPanel={() => setRightPanelOpen((v) => !v)}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
            <MessageSquare className="size-12" />
            <p className="text-sm">Select a session or start a new chat</p>
          </div>
        )}
      </div>

      {rightPanelOpen && activeAgent && (
        <ChatRightPanel agentId={activeAgent.id} />
      )}

      {/* Agent picker for new session */}
      <AddMemberDialog
        open={agentPickerOpen}
        onOpenChange={setAgentPickerOpen}
        candidates={agentCandidates}
        onAdd={handlePickAgentForSession}
      />

      {/* Manage workspace agents */}
      <ChatAgentPickerDialog
        open={memberDialogOpen}
        onOpenChange={setMemberDialogOpen}
        chatAgents={agents}
        selectedAgentIds={new Set(activeWorkspace?.agentIds ?? [])}
        onAdd={handleAddAgent}
        onAddToChat={(id) => {
          if (!activeWorkspaceId) return;
          updateWorkspace(activeWorkspaceId, {
            agentIds: [...(activeWorkspace?.agentIds ?? []), id],
          });
        }}
        onRemoveFromChat={(id) => {
          if (!activeWorkspaceId) return;
          updateWorkspace(activeWorkspaceId, {
            agentIds: (activeWorkspace?.agentIds ?? []).filter((aid) => aid !== id),
          });
        }}
        onRemoveAgent={deleteAgent}
        onEditAgent={(agent) => setEditAgent(agent)}
        onCreate={() => setCreateAgentOpen(true)}
      />

      {/* Edit Agent Dialog */}
      <AddChatAgentDialog
        open={!!editAgent}
        onOpenChange={(open) => {
          if (!open) setEditAgent(undefined);
        }}
        onSubmit={async (data) => {
          if (editAgent) await updateAgent(editAgent.id, data);
          setEditAgent(undefined);
        }}
        initialData={editAgent}
      />

      {/* Create Agent Dialog */}
      <AddChatAgentDialog
        open={createAgentOpen}
        onOpenChange={setCreateAgentOpen}
        onSubmit={async (data) => {
          await createAgent(data);
          setCreateAgentOpen(false);
        }}
      />

      {/* Create Workspace Dialog */}
      {newWorkspaceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-80 rounded-lg border bg-background p-4 shadow-lg">
            <h3 className="mb-3 font-semibold text-lg">New Workspace</h3>
            <input
              className="mb-3 w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Workspace name"
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateWorkspace();
              }}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                className="rounded-md px-3 py-1.5 text-sm hover:bg-accent"
                onClick={() => setNewWorkspaceOpen(false)}
              >
                Cancel
              </button>
              <button
                className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
                onClick={handleCreateWorkspace}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
