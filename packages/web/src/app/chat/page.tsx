"use client";

import { useEffect, useState, useCallback } from "react";
import { useChatStore } from "@/stores/chat";
import { ChatAgentList } from "@/components/chat/chat-agent-list";
import { InlineChatPanel } from "@/components/chat/inline-chat-panel";
import { ChatRightPanel } from "@/components/chat/chat-right-panel";
import { AddChatAgentDialog } from "@/components/chat/add-chat-agent-dialog";
import { AddChatAgentPickerDialog } from "@/components/chat/add-chat-agent-picker-dialog";
import { MessageSquare } from "lucide-react";
import type { ChatAgent } from "@agent-spaces/sdk";
import type { AgentPreset } from "@/components/sidebar/agent-shared";


export default function ChatPage() {
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
    selectAgent,
    sendMessage,
    stopAgent,
    deleteAgent,
    clearMessages,
    updateAgent,
  } = useChatStore();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [editAgent, setEditAgent] = useState<ChatAgent | undefined>(undefined);

  const activeAgent = agents.find((a) => a.id === activeAgentId);
  const activeMessages = activeAgentId ? (messages[activeAgentId] ?? []) : [];
  const isSending = activeAgentId ? (sending[activeAgentId] ?? false) : false;
  const activeError = activeAgentId ? (errors[activeAgentId] ?? "") : "";
  const activeStreamingContent = activeAgentId ? (streamingContent[activeAgentId] ?? "") : "";
  const activeStreamingThinking = activeAgentId ? (streamingThinking[activeAgentId] ?? "") : "";

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  const handleSend = useCallback((content: string) => {
    if (!activeAgentId || isSending) return;
    sendMessage(activeAgentId, content.trim());
  }, [activeAgentId, isSending, sendMessage]);

  const handleAddAgent = useCallback(async (preset: AgentPreset) => {
    await createAgent({
      name: preset.name,
      description: preset.description || undefined,
      systemPrompt: preset.systemPrompt || undefined,
      provider: preset.modelProvider || "openai-chat-completions",
      model: preset.modelId,
      apiKey: preset.apiKey,
      baseURL: preset.apiBase || undefined,
      avatar: preset.avatarUrl || undefined,
    });
  }, [createAgent]);

  return (
    <div className="flex h-full gap-4 bg-muted/30 p-2">
      <ChatAgentList
        agents={agents}
        activeId={activeAgentId}
        sending={sending}
        onSelect={selectAgent}
        onDelete={deleteAgent}
        onAdd={() => setDialogOpen(true)}
        className="w-[280px] shrink-0 rounded-xl border border-border/40 bg-background shadow-sm"
      />

      <div className="flex-1 rounded-xl border border-border/40 bg-background shadow-sm">
        {activeAgent ? (
          <InlineChatPanel
            agentId={activeAgent.id}
            agentName={activeAgent.name}
            agentAvatar={activeAgent.avatar}
            messages={activeMessages}
            sending={isSending}
            error={activeError}
            streamingContent={activeStreamingContent}
            streamingThinking={activeStreamingThinking}
            onSend={handleSend}
            onStop={() => activeAgentId && stopAgent(activeAgentId)}
            onClearMessages={clearMessages}
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

      <AddChatAgentPickerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        chatAgents={agents}
        onAdd={handleAddAgent}
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
    </div>
  );
}
