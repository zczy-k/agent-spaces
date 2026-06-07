"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useChatStore } from "@/stores/chat";
import { ChatAgentList } from "@/components/chat/chat-agent-list";
import { InlineChatPanel } from "@/components/chat/inline-chat-panel";
import { ChatRightPanel } from "@/components/chat/chat-right-panel";
import { AddChatAgentDialog } from "@/components/chat/add-chat-agent-dialog";
import { ChatAgentPickerDialog } from "@/components/chat/chat-agent-picker-dialog";
import { MessageSquare } from "lucide-react";
import { MessageDock, type Character } from "@/components/ui/message-dock";
import type { ChatAgent } from "@agent-spaces/sdk";
import type { AgentPreset } from "@/components/sidebar/agent-shared";


export default function ChatPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const {
    agents,
    activeAgentId,
    messages,
    sending,
    errors,
    streamingContent,
    streamingThinking,
    loadAgents,
    createAgent,
    deleteAgent,
    selectAgent,
    sendMessage,
    regenerateMessage,
    stopAgent,
    clearMessages,
    updateAgent,
  } = useChatStore();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [editAgent, setEditAgent] = useState<ChatAgent | undefined>(undefined);
  const [createOpen, setCreateOpen] = useState(false);
  const [chatListIds, setChatListIds] = useState<Set<string>>(new Set());
  const chatListInitializedRef = useRef(false);
  const previousAgentIdsRef = useRef<Set<string>>(new Set());
  const [favoriteAgentIds, setFavoriteAgentIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('agent-spaces:chat-favorite-agents');
      if (stored) return new Set(JSON.parse(stored));
    } catch { /* ignore */ }
    return new Set();
  });

  const chatListAgents = agents.filter((a) => chatListIds.has(a.id));
  const activeAgent = agents.find((a) => a.id === activeAgentId);
  const activeMessages = activeAgentId ? (messages[activeAgentId] ?? []) : [];
  const isSending = activeAgentId ? (sending[activeAgentId] ?? false) : false;
  const activeError = activeAgentId ? (errors[activeAgentId] ?? "") : "";
  const activeStreamingContent = activeAgentId ? (streamingContent[activeAgentId] ?? "") : "";
  const activeStreamingThinking = activeAgentId ? (streamingThinking[activeAgentId] ?? "") : "";

  const favoriteCharacters: Character[] = agents
    .filter((a) => favoriteAgentIds.has(a.id))
    .map((agent) => ({
      id: agent.id,
      emoji: agent.icon || "🤖",
      name: agent.name,
      online: true,
      avatar: agent.avatar || agent.avatarUrl || undefined,
      gradientColors: "#86efac, #dcfce7",
    }));

  // URL -> store: on mount and when agents load, restore selection from URL
  useEffect(() => {
    const id = searchParams.get("agent");
    if (id && id !== activeAgentId && agents.some((a) => a.id === id)) {
      selectAgent(id);
    }
  }, [searchParams, agents]); // eslint-disable-line react-hooks/exhaustive-deps

  // Store -> URL: push active agent to URL bar
  useEffect(() => {
    if (activeAgentId && searchParams.get("agent") !== activeAgentId) {
      router.replace(`${pathname}?agent=${activeAgentId}`);
    }
  }, [activeAgentId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  // Sync chatListIds from store agents on first load
  useEffect(() => {
    if (!chatListInitializedRef.current && agents.length > 0) {
      setChatListIds(new Set(agents.map((a) => a.id)));
      previousAgentIdsRef.current = new Set(agents.map((a) => a.id));
      chatListInitializedRef.current = true;
    }
  }, [agents]);

  // Persist favorites
  useEffect(() => {
    localStorage.setItem('agent-spaces:chat-favorite-agents', JSON.stringify([...favoriteAgentIds]));
  }, [favoriteAgentIds]);

  // When a new agent is added to the store, auto-add to chat list
  useEffect(() => {
    if (!chatListInitializedRef.current) return;

    const previousIds = previousAgentIdsRef.current;
    const addedAgents = agents.filter((a) => !previousIds.has(a.id));
    previousAgentIdsRef.current = new Set(agents.map((a) => a.id));

    if (addedAgents.length > 0) {
      setChatListIds((prev) => {
        const next = new Set(prev);
        addedAgents.forEach((a) => next.add(a.id));
        return next;
      });
    }
  }, [agents]);

  const handleSend = useCallback((content: string, _mentions: string[], _attachments: unknown[], _contextLength: number) => {
    if (!activeAgentId || isSending) return;
    sendMessage(activeAgentId, content.trim());
  }, [activeAgentId, isSending, sendMessage]);

  const handleRegenerate = useCallback((messageId: string) => {
    if (!activeAgentId || isSending) return;
    regenerateMessage(activeAgentId, messageId);
  }, [activeAgentId, isSending, regenerateMessage]);

  const handleRemoveFromChat = useCallback((id: string) => {
    setChatListIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    if (activeAgentId === id) {
      const remaining = chatListAgents.filter((a) => a.id !== id);
      if (remaining[0]) selectAgent(remaining[0].id);
    }
  }, [activeAgentId, selectAgent, chatListAgents]);

  const handleAddAgent = useCallback(async (preset: AgentPreset) => {
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
    // New agent auto-added to chatListIds via the useEffect above
  }, [createAgent]);

  const handleToggleFavorite = useCallback((id: string) => {
    setFavoriteAgentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleDockMessageSend = useCallback((message: string, character: Character) => {
    const agentId = character.id as string;
    if (!agentId) return;
    setChatListIds((prev) => { const n = new Set(prev); n.add(agentId); return n; });
    selectAgent(agentId);
    sendMessage(agentId, message.trim());
  }, [selectAgent, sendMessage]);

  return (
    <div className="flex h-full gap-4 bg-muted/30 p-2">
      <ChatAgentList
        agents={chatListAgents}
        activeId={activeAgentId}
        sending={sending}
        onSelect={selectAgent}
        onRemove={handleRemoveFromChat}
        onEdit={(id) => {
          const agent = agents.find((a) => a.id === id);
          if (agent) setEditAgent(agent);
        }}
        onAdd={() => setDialogOpen(true)}
        className="w-[280px] shrink-0 rounded-xl border border-border/40 bg-background shadow-sm"
      />

      <div className="flex-1 rounded-xl border border-border/40 bg-background shadow-sm">
        {activeAgent ? (
          <InlineChatPanel
            agentId={activeAgent.id}
            agentName={activeAgent.name}
            agentAvatar={activeAgent.avatar}
            agentDescription={activeAgent.description}
            messages={activeMessages}
            sending={isSending}
            error={activeError}
            streamingContent={activeStreamingContent}
            streamingThinking={activeStreamingThinking}
            onSend={handleSend}
            onStop={() => activeAgentId && stopAgent(activeAgentId)}
            onClearMessages={clearMessages}
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
            <p className="text-sm">Select an agent or add a new one to start chatting</p>
          </div>
        )}
      </div>

      {rightPanelOpen && <ChatRightPanel agentId={activeAgentId ?? undefined} />}

      <ChatAgentPickerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        chatAgents={agents}
        selectedAgentIds={chatListIds}
        onAdd={handleAddAgent}
        onAddToChat={(id) => {
          setChatListIds((prev) => { const n = new Set(prev); n.add(id); return n; });
        }}
        onRemoveAgent={async (id) => {
          setChatListIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
          if (activeAgentId === id) {
            const next = agents.find((a) => a.id !== id);
            if (next) selectAgent(next.id);
          }
          await deleteAgent(id);
        }}
        onRemoveFromChat={(id) => {
          setChatListIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
          if (activeAgentId === id) {
            const next = agents.find((a) => a.id !== id);
            if (next) selectAgent(next.id);
          }
        }}
        onEditAgent={(agent) => { setDialogOpen(false); setEditAgent(agent); }}
        onCreate={() => { setDialogOpen(false); setCreateOpen(true); }}
        favoriteIds={favoriteAgentIds}
        onToggleFavorite={handleToggleFavorite}
      />

      <AddChatAgentDialog
        open={!!editAgent}
        onOpenChange={(open) => { if (!open) setEditAgent(undefined); }}
        onSubmit={async (data) => {
          if (editAgent) await updateAgent(editAgent.id, data);
          setEditAgent(undefined);
        }}
        initialData={editAgent}
      />

      <AddChatAgentDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={async (data) => {
          await createAgent(data);
          setCreateOpen(false);
        }}
      />

      {favoriteCharacters.length > 0 && (
        <MessageDock
          characters={favoriteCharacters}
          onMessageSend={handleDockMessageSend}
          showSparkleButton={false}
          showMenuButton={false}
          position="bottom"
          placeholder={(name) => `Message ${name}...`}
          closeOnSend={true}
        />
      )}
    </div>
  );
}
