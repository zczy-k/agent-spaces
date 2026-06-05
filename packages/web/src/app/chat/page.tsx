"use client";

import { useEffect, useState, useCallback } from "react";
import { useChatStore } from "@/stores/chat";
import { ChatAgentList } from "@/components/chat/chat-agent-list";
import { InlineChatPanel } from "@/components/chat/inline-chat-panel";
import { AddChatAgentDialog } from "@/components/chat/add-chat-agent-dialog";
import { MessageSquare } from "lucide-react";

export default function ChatPage() {
  const {
    agents,
    activeAgentId,
    messages,
    sending,
    loadAgents,
    createAgent,
    selectAgent,
    sendMessage,
    stopAgent,
  } = useChatStore();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [input, setInput] = useState("");

  const activeAgent = agents.find((a) => a.id === activeAgentId);
  const activeMessages = activeAgentId ? (messages[activeAgentId] ?? []) : [];
  const isSending = activeAgentId ? (sending[activeAgentId] ?? false) : false;

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  const handleSend = useCallback(() => {
    if (!activeAgentId || !input.trim() || isSending) return;
    sendMessage(activeAgentId, input.trim());
    setInput("");
    // TODO: Wire up WS chat.message event for real-time execution
    // For now, the message is saved to store and sending state is set
  }, [activeAgentId, input, isSending, sendMessage]);

  const handleAddAgent = useCallback(async (data: any) => {
    await createAgent(data);
  }, [createAgent]);

  return (
    <div className="flex h-full">
      <ChatAgentList
        agents={agents}
        activeId={activeAgentId}
        onSelect={selectAgent}
        onAdd={() => setDialogOpen(true)}
      />

      <div className="flex-1">
        {activeAgent ? (
          <InlineChatPanel
            agentName={activeAgent.name}
            agentAvatar={activeAgent.avatar}
            messages={activeMessages}
            sending={isSending}
            input={input}
            onInputChange={setInput}
            onSend={handleSend}
            onStop={() => activeAgentId && stopAgent(activeAgentId)}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
            <MessageSquare className="size-12" />
            <p className="text-sm">Select an agent or add a new one to start chatting</p>
          </div>
        )}
      </div>

      <AddChatAgentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleAddAgent}
      />
    </div>
  );
}
