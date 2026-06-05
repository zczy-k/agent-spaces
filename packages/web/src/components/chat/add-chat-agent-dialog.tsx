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
    modelProvider: (agent.modelProvider || agent.provider || "") as AgentPreset["modelProvider"],
    modelId: agent.modelId || agent.model,
    apiKey: agent.apiKey,
    apiBase: agent.apiBase ?? agent.baseURL ?? "",
    avatarUrl: agent.avatarUrl ?? agent.avatar ?? "",
    icon: agent.icon ?? "",
    runtimeKind: "langchain",
    workingDir: agent.workingDir ?? "",
    mcps: agent.mcps ?? {},
    skills: (agent.skills ?? []).map((skill) => (
      typeof skill === "string" ? { name: skill } : { name: skill.name, content: skill.content }
    )),
    tools: agent.tools ?? newEmptyAgent().tools,
    outputStyle: agent.outputStyle ?? "",
    temperature: agent.temperature ?? 0.3,
    maxTokens: agent.maxTokens ?? 4096,
    enabled: agent.enabled ?? true,
  };
}

function presetToChatAgentData(preset: AgentPreset): Omit<ChatAgent, "id" | "createdAt" | "updatedAt"> {
  return {
    name: preset.name,
    role: "agent",
    runtimeKind: "langchain",
    description: preset.description || undefined,
    systemPrompt: preset.systemPrompt || undefined,
    modelProvider: preset.modelProvider || "openai-chat-completions",
    modelId: preset.modelId,
    provider: preset.modelProvider || "openai-chat-completions",
    model: preset.modelId,
    apiKey: preset.apiKey,
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
      <DialogContent className="flex max-h-[85vh] min-w-[60vw] flex-col">
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
            lockedFields={{ runtimeKind: true, workingDir: true }}
            fixedValues={{ runtimeKind: "langchain" }}
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
