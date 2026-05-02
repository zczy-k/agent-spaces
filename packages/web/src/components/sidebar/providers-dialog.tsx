"use client";

import { useEffect, useState } from "react";
import type { LLMProvider, LLMModel } from "@agent-spaces/shared";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Server,
  Plus,
  Trash2,
  X,
} from "lucide-react";

export function ProvidersDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [providers, setProviders] = useState<LLMProvider[]>([]);
  const [allModels, setAllModels] = useState<LLMModel[]>([]);
  const [selected, setSelected] = useState<LLMProvider | null>(null);
  const [draft, setDraft] = useState<Partial<LLMProvider> | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    Promise.all([
      fetch("/api/providers").then(r => r.json()),
      fetch("/api/models").then(r => r.json()),
    ])
      .then(([prov, models]: [LLMProvider[], LLMModel[]]) => {
        setProviders(prov);
        setAllModels(models);
      })
      .catch(() => setError("Failed to load providers"))
      .finally(() => setLoading(false));
  }, [open]);

  const handleBack = () => { setSelected(null); setDraft(null); };

  const handleAdd = () => {
    setSelected(null);
    setDraft({ name: "", apiBase: "", apiKey: "", models: [] });
  };

  const handleEdit = (p: LLMProvider) => {
    setSelected(p);
    setDraft({ ...p, models: [...p.models] });
  };

  const handleSave = async () => {
    if (!draft || !draft.name) return;
    setSaving(true);
    setError(null);
    try {
      const isNew = !selected;
      const res = await fetch(isNew ? "/api/providers" : `/api/providers/${selected!.id}`, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) throw new Error();
      const saved: LLMProvider = await res.json();
      setProviders(prev => isNew ? [...prev, saved] : prev.map(p => p.id === saved.id ? saved : p));
      handleBack();
    } catch {
      setError("Failed to save provider");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this provider?")) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/providers/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setProviders(prev => prev.filter(p => p.id !== id));
      if (selected?.id === id) handleBack();
    } catch {
      setError("Failed to delete provider");
    } finally {
      setSaving(false);
    }
  };

  const updateDraft = (key: string, value: unknown) => {
    setDraft(prev => prev ? { ...prev, [key]: value } : prev);
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) handleBack(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0">
        <div className="flex items-center gap-3 border-b px-5 py-4">
          {draft && (
            <Button variant="ghost" size="icon-sm" onClick={handleBack}>
              <ArrowLeft className="size-4" />
            </Button>
          )}
          <DialogHeader className="flex-1 space-y-0">
            <DialogTitle className="text-base">
              {draft ? (selected ? "Edit Provider" : "Add Provider") : "Providers"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {draft ? "Configure provider connection settings" : "Manage LLM API providers"}
            </DialogDescription>
          </DialogHeader>
          {!draft && (
            <Button variant="outline" size="sm" onClick={handleAdd}>
              <Plus className="size-3.5" />
              Add
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {error && (
            <div className="mx-5 mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Loading providers...</div>
          ) : draft ? (
            <ProviderForm draft={draft} allModels={allModels} onChange={updateDraft} />
          ) : (
            <ProviderList providers={providers} onEdit={handleEdit} onDelete={handleDelete} />
          )}
        </div>

        {draft && (
          <div className="flex justify-end gap-2 border-t px-5 py-3">
            <Button variant="outline" size="sm" onClick={handleBack} disabled={saving}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !draft.name}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ProviderList({
  providers,
  onEdit,
  onDelete,
}: {
  providers: LLMProvider[];
  onEdit: (p: LLMProvider) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex flex-col p-2">
      {providers.map(provider => (
        <div
          key={provider.id}
          className="group flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/50 cursor-pointer transition-colors"
          onClick={() => onEdit(provider)}
        >
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
            <Server className="size-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium">{provider.name}</span>
            <p className="text-xs text-muted-foreground truncate">{provider.apiBase || "No API base configured"}</p>
          </div>
          <Badge variant="outline" className="text-[10px] h-4 px-1.5">
            {provider.models?.length || 0} models
          </Badge>
          <Button
            variant="ghost"
            size="icon-xs"
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={e => { e.stopPropagation(); onDelete(provider.id); }}
          >
            <Trash2 className="size-3 text-destructive" />
          </Button>
        </div>
      ))}
      {providers.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Server className="size-10 mb-2 opacity-30" />
          <p className="text-sm">No providers yet</p>
        </div>
      )}
    </div>
  );
}

function ProviderForm({
  draft,
  allModels,
  onChange,
}: {
  draft: Partial<LLMProvider>;
  allModels: LLMModel[];
  onChange: (key: string, value: unknown) => void;
}) {
  const [selectedModel, setSelectedModel] = useState("");
  const [customModel, setCustomModel] = useState("");
  const models = draft.models || [];

  const addModel = (modelId: string) => {
    if (!modelId.trim() || models.includes(modelId.trim())) return;
    onChange("models", [...models, modelId.trim()]);
  };

  const removeModel = (index: number) => {
    onChange("models", models.filter((_, i) => i !== index));
  };

  const availableModels = allModels.filter(m => !models.includes(m.modelId));

  return (
    <div className="flex flex-col gap-5 p-5">
      <div className="flex flex-col gap-2.5">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Connection</div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Name</label>
          <Input value={draft.name || ""} onChange={e => onChange("name", e.target.value)} placeholder="e.g. Anthropic" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">API Base</label>
          <Input value={draft.apiBase || ""} onChange={e => onChange("apiBase", e.target.value)} placeholder="https://api.anthropic.com" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">API Key</label>
          <Input type="password" value={draft.apiKey || ""} onChange={e => onChange("apiKey", e.target.value)} placeholder="sk-..." />
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Models</div>
        {models.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {models.map((modelId, i) => (
              <Badge key={i} variant="secondary" className="gap-1 pr-1">
                {modelId}
                <button type="button" onClick={() => removeModel(i)} className="hover:text-destructive">
                  <X className="size-2.5" />
                </button>
              </Badge>
            ))}
          </div>
        )}
        {availableModels.length > 0 && (
          <div className="flex gap-2">
            <select
              value={selectedModel}
              onChange={e => setSelectedModel(e.target.value)}
              className="h-7 flex-1 rounded-lg border border-input bg-transparent px-2.5 text-xs outline-none focus-visible:border-ring dark:bg-input/30"
            >
              <option value="">Select from catalog...</option>
              {availableModels.map(m => (
                <option key={m.id} value={m.modelId}>{m.name} ({m.modelId})</option>
              ))}
            </select>
            <Button
              variant="outline"
              size="xs"
              onClick={() => { addModel(selectedModel); setSelectedModel(""); }}
              disabled={!selectedModel}
            >
              <Plus className="size-3" />
            </Button>
          </div>
        )}
        <div className="flex gap-2">
          <Input
            value={customModel}
            onChange={e => setCustomModel(e.target.value)}
            placeholder="Or type custom model ID..."
            className="flex-1 h-7 text-xs"
            onKeyDown={e => { if (e.key === "Enter" && customModel.trim()) { addModel(customModel); setCustomModel(""); } }}
          />
          <Button
            variant="outline"
            size="xs"
            onClick={() => { addModel(customModel); setCustomModel(""); }}
            disabled={!customModel.trim()}
          >
            <Plus className="size-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
