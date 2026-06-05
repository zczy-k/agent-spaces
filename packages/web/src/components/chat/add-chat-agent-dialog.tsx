"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useState } from "react";

const PROVIDERS = [
  { value: "openai-chat-completions", label: "OpenAI" },
  { value: "anthropic-messages", label: "Anthropic" },
  { value: "gemini-generate-content", label: "Gemini" },
];

interface ChatAgent {
  id: string;
  name: string;
  avatar?: string;
  description?: string;
  systemPrompt?: string;
  provider: string;
  model: string;
  apiKey: string;
  baseURL?: string;
  createdAt: string;
  updatedAt: string;
}

interface AddChatAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Omit<ChatAgent, "id" | "createdAt" | "updatedAt">) => void;
  initialData?: ChatAgent;
}

export function AddChatAgentDialog({ open, onOpenChange, onSubmit, initialData }: AddChatAgentDialogProps) {
  const isEdit = !!initialData;
  const [name, setName] = useState(initialData?.name ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [systemPrompt, setSystemPrompt] = useState(initialData?.systemPrompt ?? "");
  const [provider, setProvider] = useState(initialData?.provider ?? "openai-chat-completions");
  const [model, setModel] = useState(initialData?.model ?? "gpt-4o-mini");
  const [apiKey, setApiKey] = useState(initialData?.apiKey ?? "");
  const [baseURL, setBaseURL] = useState(initialData?.baseURL ?? "");

  const handleSubmit = () => {
    if (!name.trim() || !apiKey.trim()) return;
    onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      systemPrompt: systemPrompt.trim() || undefined,
      provider,
      model: model.trim(),
      apiKey: apiKey.trim(),
      baseURL: baseURL.trim() || undefined,
    });
    onOpenChange(false);
    if (!isEdit) {
      setName(""); setDescription(""); setSystemPrompt("");
      setModel("gpt-4o-mini"); setApiKey(""); setBaseURL("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Agent" : "Add Chat Agent"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-2">
          <Input placeholder="Name *" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <textarea
            className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            placeholder="System Prompt"
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
          />
          <div className="flex gap-2">
            <select
              className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            >
              {PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            <Input className="flex-1" placeholder="Model" value={model} onChange={(e) => setModel(e.target.value)} />
          </div>
          <Input type="password" placeholder="API Key *" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
          <Input placeholder="Base URL (optional)" value={baseURL} onChange={(e) => setBaseURL(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || !apiKey.trim()}>
            {isEdit ? "Save" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
