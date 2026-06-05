"use client";

import { useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ChatAgent } from "@agent-spaces/sdk";
import { AgentEditor, type AgentEditorHandle } from "@/components/sidebar/agent-editor";
import { type AgentPreset, newEmptyAgent } from "@/components/sidebar/agent-shared";

function chatAgentToPreset(agent: ChatAgent): AgentPreset {
  return {
    ...newEmptyAgent(),
    id: agent.id ?? `draft-chat-${Date.now()}`,
    name: agent.name,
    description: agent.description ?? "",
    systemPrompt: agent.systemPrompt ?? "",
    modelProvider: (agent.provider || "") as AgentPreset["modelProvider"],
    modelId: agent.model,
    apiKey: agent.apiKey,
    apiBase: agent.baseURL ?? "",
    avatarUrl: agent.avatar ?? "",
    enabled: true,
  };
}

function presetToChatAgentData(preset: AgentPreset): Omit<ChatAgent, "id" | "createdAt" | "updatedAt"> {
  return {
    name: preset.name,
    description: preset.description || undefined,
    systemPrompt: preset.systemPrompt || undefined,
    provider: preset.modelProvider || "openai-chat-completions",
    model: preset.modelId,
    apiKey: preset.apiKey,
    baseURL: preset.apiBase || undefined,
    avatar: preset.avatarUrl || undefined,
  };
}

interface AddChatAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Omit<ChatAgent, "id" | "createdAt" | "updatedAt">) => void;
  initialData?: ChatAgent;
}

export function AddChatAgentDialog({ open, onOpenChange, onSubmit, initialData }: AddChatAgentDialogProps) {
  const editorRef = useRef<AgentEditorHandle>(null);
  const isEdit = !!initialData;
  const preset = initialData ? chatAgentToPreset(initialData) : newEmptyAgent();

  const handleSubmit = useCallback(() => {
    const draft = editorRef.current?.getDraft();
    if (!draft || !draft.name.trim() || !draft.apiKey.trim()) return;
    onSubmit(presetToChatAgentData(draft));
    onOpenChange(false);
  }, [onSubmit, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Agent" : "Add Chat Agent"}</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <AgentEditor
            ref={editorRef}
            agent={preset}
            onSaved={() => {}}
            onBack={() => onOpenChange(false)}
            showFooter={false}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
