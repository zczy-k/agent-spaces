"use client";

import { useEffect, useState } from "react";
import type { AgentConfig } from "@agent-spaces/shared";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Bot,
  Plus,
  Trash2,
  X,
  Cpu,
  FolderOpen,
  Wrench,
  Sparkles,
  MessageSquare,
  Sliders,
} from "lucide-react";

type AgentPreset = AgentConfig & {
  name: string;
  description: string;
  modelId: string;
  workingDir: string;
  mcps: string[];
  skills: string[];
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
};

const ROLE_COLORS: Record<string, string> = {
  scheduler: "bg-blue-500/10 text-blue-600 border-blue-200",
  planner: "bg-purple-500/10 text-purple-600 border-purple-200",
  executor: "bg-green-500/10 text-green-600 border-green-200",
  reviewer: "bg-orange-500/10 text-orange-600 border-orange-200",
};

const MODEL_OPTIONS = [
  "claude-opus-4-7",
  "claude-sonnet-4-6",
  "claude-haiku-4-5-20251001",
];
const ROLE_OPTIONS: AgentConfig["role"][] = ["scheduler", "planner", "executor", "reviewer"];

function normalizeAgent(agent: AgentConfig): AgentPreset {
  return {
    ...agent,
    name: agent.name || "New Agent",
    description: agent.description || "",
    modelId: agent.modelId || "claude-sonnet-4-6",
    workingDir: agent.workingDir || "/workspace",
    mcps: agent.mcps || [],
    skills: agent.skills || [],
    systemPrompt: agent.systemPrompt || "",
    temperature: agent.temperature ?? 0.3,
    maxTokens: agent.maxTokens ?? 4096,
    enabled: agent.enabled ?? true,
  };
}

function newAgentDraft(): Omit<AgentPreset, "id"> {
  return {
    name: "New Agent",
    role: "executor",
    description: "",
    modelId: "claude-sonnet-4-6",
    workingDir: "/workspace",
    mcps: [],
    skills: [],
    systemPrompt: "",
    temperature: 0.3,
    maxTokens: 4096,
    enabled: true,
  };
}

export function AgentDialog({
  open,
  onOpenChange,
  workspaceId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId?: string;
}) {
  const [agents, setAgents] = useState<AgentPreset[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<AgentPreset | null>(null);
  const [editDraft, setEditDraft] = useState<AgentPreset | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !workspaceId) return;

    const controller = new AbortController();
    queueMicrotask(() => {
      setLoading(true);
      setError(null);
    });
    fetch(`/api/workspaces/${workspaceId}/agents/presets`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        return res.json() as Promise<AgentConfig[]>;
      })
      .then((data) => setAgents(data.map(normalizeAgent)))
      .catch((err) => {
        if (err.name !== "AbortError") setError("Failed to load agent presets");
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [open, workspaceId]);

  const handleSelectAgent = (agent: AgentPreset) => {
    setSelectedAgent(agent);
    setEditDraft({ ...agent });
  };

  const handleBack = () => {
    setSelectedAgent(null);
    setEditDraft(null);
  };

  const handleSave = async () => {
    if (!workspaceId || !editDraft) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/agents/presets/${editDraft.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editDraft),
      });
      if (!res.ok) throw new Error(await res.text());
      const saved = normalizeAgent(await res.json());
      setAgents((prev) => prev.map((agent) => (agent.id === saved.id ? saved : agent)));
      setSelectedAgent(null);
      setEditDraft(null);
    } catch {
      setError("Failed to save agent preset");
    } finally {
      setSaving(false);
    }
  };

  const handleAddAgent = async () => {
    if (!workspaceId) {
      setError("Open a workspace before adding agent presets");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/agents/presets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAgentDraft()),
      });
      if (!res.ok) throw new Error(await res.text());
      const created = normalizeAgent(await res.json());
      setAgents((prev) => [...prev, created]);
      handleSelectAgent(created);
    } catch {
      setError("Failed to add agent preset");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAgent = async (id: string) => {
    if (!workspaceId) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/agents/presets/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await res.text());
      setAgents((prev) => prev.filter((a) => a.id !== id));
      if (selectedAgent?.id === id) {
        setSelectedAgent(null);
        setEditDraft(null);
      }
    } catch {
      setError("Failed to delete agent preset");
    } finally {
      setSaving(false);
    }
  };

  const updateDraft = <K extends keyof AgentPreset>(key: K, value: AgentPreset[K]) => {
    if (!editDraft) return;
    setEditDraft({ ...editDraft, [key]: value });
  };

  const addToArray = (key: "mcps" | "skills", value: string) => {
    if (!editDraft || !value.trim()) return;
    updateDraft(key, [...editDraft[key], value.trim()]);
  };

  const removeFromArray = (key: "mcps" | "skills", index: number) => {
    if (!editDraft) return;
    updateDraft(key, editDraft[key].filter((_, i) => i !== index));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleBack(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <div className="flex items-center gap-3 border-b px-5 py-4">
          {selectedAgent ? (
            <Button variant="ghost" size="icon-sm" onClick={handleBack}>
              <ArrowLeft className="size-4" />
            </Button>
          ) : (
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10">
              <Bot className="size-4 text-primary" />
            </div>
          )}
          <DialogHeader className="flex-1 space-y-0">
            <DialogTitle className="text-base">
              {selectedAgent ? editDraft?.name ?? "" : "Agent Presets"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {selectedAgent
                ? "Configure agent behavior, tools, and model settings"
                : "Manage agent presets for workspace automation"}
            </DialogDescription>
          </DialogHeader>
          {!selectedAgent && (
            <Button variant="outline" size="sm" onClick={handleAddAgent} disabled={saving || !workspaceId}>
              <Plus className="size-3.5" />
              Add
            </Button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {error && (
            <div className="mx-5 mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}
          {!workspaceId ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Bot className="size-10 mb-2 opacity-30" />
              <p className="text-sm">No workspace selected</p>
            </div>
          ) : loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Loading agent presets...</div>
          ) : !selectedAgent ? (
            <AgentList
              agents={agents}
              onSelect={handleSelectAgent}
              onDelete={handleDeleteAgent}
            />
          ) : editDraft ? (
            <AgentDetail
              agent={editDraft}
              onChange={updateDraft}
              onAddToArray={addToArray}
              onRemoveFromArray={removeFromArray}
            />
          ) : null}
        </div>

        {/* Footer */}
        {selectedAgent && (
          <div className="flex justify-end gap-2 border-t px-5 py-3">
            <Button variant="outline" size="sm" onClick={handleBack} disabled={saving}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AgentList({
  agents,
  onSelect,
  onDelete,
}: {
  agents: AgentPreset[];
  onSelect: (agent: AgentPreset) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex flex-col p-2">
      {agents.map((agent) => (
        <div
          key={agent.id}
          className="group flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/50 cursor-pointer transition-colors"
          onClick={() => onSelect(agent)}
        >
          <div className={cn("flex size-8 items-center justify-center rounded-lg", ROLE_COLORS[agent.role] ?? "bg-muted")}>
            <Bot className="size-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{agent.name}</span>
              <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                {agent.role}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground truncate">{agent.description || "No description"}</p>
          </div>
          <span className="text-[10px] text-muted-foreground font-mono">{agent.modelId.split("-").slice(0, 2).join("-")}</span>
          <Button
            variant="ghost"
            size="icon-xs"
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => { e.stopPropagation(); onDelete(agent.id); }}
          >
            <Trash2 className="size-3 text-destructive" />
          </Button>
        </div>
      ))}
      {agents.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Bot className="size-10 mb-2 opacity-30" />
          <p className="text-sm">No agent presets yet</p>
        </div>
      )}
    </div>
  );
}

function AgentDetail({
  agent,
  onChange,
  onAddToArray,
  onRemoveFromArray,
}: {
  agent: AgentPreset;
  onChange: <K extends keyof AgentPreset>(key: K, value: AgentPreset[K]) => void;
  onAddToArray: (key: "mcps" | "skills", value: string) => void;
  onRemoveFromArray: (key: "mcps" | "skills", index: number) => void;
}) {
  const [newMcp, setNewMcp] = useState("");
  const [newSkill, setNewSkill] = useState("");

  return (
    <div className="flex flex-col gap-5 p-5">
      {/* Basic Info */}
      <Section icon={<MessageSquare className="size-3.5" />} title="Basic">
        <FieldGroup label="Name">
          <Input value={agent.name} onChange={(e) => onChange("name", e.target.value)} />
        </FieldGroup>
        <FieldGroup label="Role">
          <select
            value={agent.role}
            onChange={(e) => onChange("role", e.target.value as AgentConfig["role"])}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring dark:bg-input/30"
          >
            {ROLE_OPTIONS.map((role) => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
        </FieldGroup>
        <FieldGroup label="Description">
          <Input value={agent.description} onChange={(e) => onChange("description", e.target.value)} />
        </FieldGroup>
      </Section>

      {/* Working Directory */}
      <Section icon={<FolderOpen className="size-3.5" />} title="Working Directory">
        <Input value={agent.workingDir} onChange={(e) => onChange("workingDir", e.target.value)} placeholder="/workspace" />
      </Section>

      {/* System Prompt */}
      <Section icon={<Sparkles className="size-3.5" />} title="System Prompt">
        <Textarea
          value={agent.systemPrompt}
          onChange={(e) => onChange("systemPrompt", e.target.value)}
          placeholder="Enter system prompt..."
          className="min-h-24 text-xs"
        />
      </Section>

      {/* MCP Servers */}
      <Section icon={<Wrench className="size-3.5" />} title="MCP Servers">
        <div className="flex flex-wrap gap-1.5 mb-2">
          {agent.mcps.map((mcp, i) => (
            <Badge key={i} variant="secondary" className="gap-1 pr-1">
              {mcp}
              <button type="button" onClick={() => onRemoveFromArray("mcps", i)} className="hover:text-destructive">
                <X className="size-2.5" />
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input value={newMcp} onChange={(e) => setNewMcp(e.target.value)} placeholder="Add MCP server..." className="flex-1 h-7 text-xs" onKeyDown={(e) => { if (e.key === "Enter") { onAddToArray("mcps", newMcp); setNewMcp(""); } }} />
          <Button variant="outline" size="xs" onClick={() => { onAddToArray("mcps", newMcp); setNewMcp(""); }}>
            <Plus className="size-3" />
          </Button>
        </div>
      </Section>

      {/* Skills */}
      <Section icon={<Cpu className="size-3.5" />} title="Skills">
        <div className="flex flex-wrap gap-1.5 mb-2">
          {agent.skills.map((skill, i) => (
            <Badge key={i} variant="outline" className="gap-1 pr-1">
              {skill}
              <button type="button" onClick={() => onRemoveFromArray("skills", i)} className="hover:text-destructive">
                <X className="size-2.5" />
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input value={newSkill} onChange={(e) => setNewSkill(e.target.value)} placeholder="Add skill..." className="flex-1 h-7 text-xs" onKeyDown={(e) => { if (e.key === "Enter") { onAddToArray("skills", newSkill); setNewSkill(""); } }} />
          <Button variant="outline" size="xs" onClick={() => { onAddToArray("skills", newSkill); setNewSkill(""); }}>
            <Plus className="size-3" />
          </Button>
        </div>
      </Section>

      {/* Model Config */}
      <Section icon={<Sliders className="size-3.5" />} title="Model">
        <FieldGroup label="Model">
          <select
            value={agent.modelId}
            onChange={(e) => onChange("modelId", e.target.value)}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring dark:bg-input/30"
          >
            {MODEL_OPTIONS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </FieldGroup>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="Temperature">
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={2}
                step={0.1}
                value={agent.temperature}
                onChange={(e) => onChange("temperature", parseFloat(e.target.value))}
                className="flex-1"
              />
              <span className="text-xs font-mono w-8 text-right">{agent.temperature}</span>
            </div>
          </FieldGroup>
          <FieldGroup label="Max Tokens">
            <Input
              type="number"
              value={agent.maxTokens}
              onChange={(e) => onChange("maxTokens", parseInt(e.target.value) || 0)}
              className="h-7 text-xs"
            />
          </FieldGroup>
        </div>
      </Section>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
