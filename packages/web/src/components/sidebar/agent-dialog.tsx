"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { type AgentConfig } from "@agent-spaces/shared";
import { useAgentStore } from "@/stores/agent";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Bot,
  ChevronDown,
  Plus,
  RefreshCw,
  RotateCcw,
  WandSparkles,
} from "lucide-react";
import {
  type AgentPreset,
  type AgentRole,
  type BuiltInRole,
  ROLE_COLORS,
  ROLE_OPTIONS,
  normalizeAgent,
  newAgentDraft,
  newEmptyAgent,
} from "./agent-shared";
import { AgentList } from "./agent-list";
import { AgentEditor, type AgentEditorHandle } from "./agent-editor";

const AGENT_GENERATOR_PRESET_ID = "agent-generator";
const AGENT_COMMIT_PRESET_ID = "commit-agent";
const FIXED_AGENT_IDS = new Set([AGENT_GENERATOR_PRESET_ID, AGENT_COMMIT_PRESET_ID]);

export function AgentDialog({
  open,
  onOpenChange,
  roleFilter,
  initialAgentId,
  standalone,
  presetBasePath = "/api/agents/presets",
  singleAgent = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roleFilter?: AgentRole | AgentRole[];
  initialAgentId?: string;
  standalone?: boolean;
  presetBasePath?: string;
  singleAgent?: boolean;
}) {
  const t = useTranslations("agent");
  const tc = useTranslations("common");
  const editorRef = useRef<AgentEditorHandle>(null);
  const [agents, setAgents] = useState<AgentPreset[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<AgentPreset | null>(null);
  const [autoGenerate, setAutoGenerate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncingTemplates, setSyncingTemplates] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const roleFilterSet = roleFilter
    ? new Set(Array.isArray(roleFilter) ? roleFilter : [roleFilter])
    : null;
  const visibleAgents = roleFilterSet
    ? agents.filter((agent) => FIXED_AGENT_IDS.has(agent.id) || roleFilterSet.has(agent.role))
    : agents;
  const addRoleOptions = roleFilterSet ? ROLE_OPTIONS.filter((role) => roleFilterSet.has(role)) : ROLE_OPTIONS;

  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();
    queueMicrotask(() => {
      setLoading(true);
      setError(null);
    });
    fetch(presetBasePath, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        return res.json() as Promise<AgentConfig[]>;
      })
      .then((data) => {
        const normalized = data.map(normalizeAgent);
        setAgents(normalized);
        if (initialAgentId) {
          const target = normalized.find((a) => a.id === initialAgentId);
          if (target) {
            setSelectedAgent(target);
          }
        } else if (singleAgent && normalized[0]) {
          setSelectedAgent(normalized[0]);
        }
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(t('error.loadFailed'));
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [open, initialAgentId, presetBasePath, singleAgent, t]);

  const handleSelectAgent = (agent: AgentPreset) => {
    setSelectedAgent(agent);
  };

  const handleBack = () => {
    setSelectedAgent(null);
    setAutoGenerate(false);
  };

  const handleAddAgent = (role: BuiltInRole | "empty") => {
    const draft = role === "empty" ? newEmptyAgent() : newAgentDraft(role);
    setError(null);
    setSelectedAgent(draft);
  };

  const handleToggleEnabled = async (id: string) => {
    if (FIXED_AGENT_IDS.has(id)) return;
    setAgents((prev) =>
      prev.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)),
    );
    await useAgentStore.getState().toggleEnabled(id);
  };

  const handleDeleteAgent = async (id: string) => {
    if (FIXED_AGENT_IDS.has(id)) return;

    if (id.startsWith("draft-")) {
      setSelectedAgent(null);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${presetBasePath}/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await res.text());
      setAgents((prev) => prev.filter((a) => a.id !== id));
      useAgentStore.setState((state) => ({
        agents: state.agents.filter((a) => a.id !== id),
      }));
      if (selectedAgent?.id === id) {
        setSelectedAgent(null);
      }
    } catch {
      setError(t('error.deleteFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleEditorSaved = (saved: AgentPreset) => {
    setAgents((prev) => {
      const exists = prev.some((a) => a.id === saved.id);
      return exists
        ? prev.map((agent) => (agent.id === saved.id ? saved : agent))
        : [...prev, saved];
    });
    if (singleAgent) {
      onOpenChange(false);
      return;
    }
    setSelectedAgent(null);
    setAutoGenerate(false);
  };

  const handleSyncTemplates = async () => {
    setSyncingTemplates(true);
    setError(null);
    try {
      const res = await fetch(`${presetBasePath}/sync-workspaces`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
    } catch {
      setError(t('error.syncFailed'));
    } finally {
      setSyncingTemplates(false);
    }
  };

  const addDropdown = (compact?: boolean) => (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" disabled={saving}>
            <Plus className="size-3.5" />
            {!compact && t('dialog.add')}
            <ChevronDown className="size-3.5" />
          </Button>
        }
      />
      <DropdownMenuContent side="bottom" align="end" className="w-44">
        <DropdownMenuGroup>
          {!roleFilterSet && (
            <DropdownMenuItem
              className="gap-2"
              onClick={() => handleAddAgent("empty")}
            >
              <span className="size-2 rounded-full bg-muted" />
              <span>{t('dialog.addEmpty')}</span>
            </DropdownMenuItem>
          )}
          {ROLE_OPTIONS.map((role) => (
            <DropdownMenuItem
              key={role}
              className="gap-2"
              onClick={() => handleAddAgent(role)}
            >
              <span className={cn("size-2 rounded-full", ROLE_COLORS[role].split(" ")[0])} />
              <span className="capitalize">{t(`role.${role}.name`)}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const content = (
    <>
      {/* Header */}
      {!standalone && (
        <div className="flex items-center gap-3 border-b px-5 pr-12 py-4">
          {selectedAgent ? (
            <Button variant="ghost" size="icon-sm" onClick={singleAgent ? () => onOpenChange(false) : handleBack}>
              <ArrowLeft className="size-4" />
            </Button>
          ) : (
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10">
              <Bot className="size-4 text-primary" />
            </div>
          )}
          <DialogHeader className="flex-1 space-y-0">
            <DialogTitle className="text-base">
              {selectedAgent ? selectedAgent.name : t('dialog.title')}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {selectedAgent
                ? t('dialog.editDescription')
                : t('dialog.listDescription')}
            </DialogDescription>
          </DialogHeader>
          {selectedAgent && FIXED_AGENT_IDS.has(selectedAgent.id) && (
            <Button variant="outline" size="sm" disabled={saving} onClick={() => editorRef.current?.reset()}>
              <RotateCcw className="size-3.5" />
              {tc('reset')}
            </Button>
          )}
          {selectedAgent && (
            <Button variant="outline" size="sm" onClick={() => editorRef.current?.openGenerate()}>
              <WandSparkles className="size-3.5" />
              智能创建
            </Button>
          )}
          {!selectedAgent && !singleAgent && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleSyncTemplates} disabled={syncingTemplates}>
                <RefreshCw className={cn("size-3.5", syncingTemplates && "animate-spin")} />
                {t('dialog.syncTemplates')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => {
                const draft = addRoleOptions[0] ? newAgentDraft(addRoleOptions[0]) : newEmptyAgent();
                setError(null);
                setSelectedAgent(draft);
                setAutoGenerate(true);
              }}>
                <WandSparkles className="size-3.5" />
                智能创建
              </Button>
              {addDropdown()}
            </div>
          )}
        </div>
      )}
      {standalone && !selectedAgent && !singleAgent && (
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-b">
          <Button variant="outline" size="sm" onClick={handleSyncTemplates} disabled={syncingTemplates}>
            <RefreshCw className={cn("size-3.5", syncingTemplates && "animate-spin")} />
            {t('dialog.syncTemplates')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => {
            const draft = addRoleOptions[0] ? newAgentDraft(addRoleOptions[0]) : newEmptyAgent();
            setError(null);
            setSelectedAgent(draft);
            setAutoGenerate(true);
          }}>
            <WandSparkles className="size-3.5" />
            智能创建
          </Button>
          {addDropdown()}
        </div>
      )}
      {standalone && selectedAgent && (
        <div className="flex items-center gap-3 px-5 py-3 border-b">
          <Button variant="ghost" size="icon-sm" onClick={singleAgent ? () => onOpenChange(false) : handleBack}>
            <ArrowLeft className="size-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-medium truncate">{selectedAgent.name}</h2>
            <p className="text-xs text-muted-foreground">{t('dialog.editDescription')}</p>
          </div>
          {FIXED_AGENT_IDS.has(selectedAgent.id) && (
            <Button variant="outline" size="sm" disabled={saving} onClick={() => editorRef.current?.reset()}>
              <RotateCcw className="size-3.5" />
              {tc('reset')}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => editorRef.current?.openGenerate()}>
            <WandSparkles className="size-3.5" />
            智能创建
          </Button>
        </div>
      )}

      {/* Body: list or editor */}
      {error && !selectedAgent && (
        <div className="mx-5 mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}
      {loading ? (
        <div className="flex-1 flex flex-col p-2 space-y-1">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2.5">
              <div className="size-8 rounded-full bg-muted animate-pulse" />
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-20 rounded bg-muted animate-pulse" />
                  <div className="h-4 w-10 rounded-full bg-muted animate-pulse" />
                </div>
                <div className="h-3 w-32 rounded bg-muted animate-pulse" />
              </div>
              <div className="h-3 w-12 rounded bg-muted animate-pulse" />
            </div>
          ))}
        </div>
      ) : !selectedAgent ? (
        <div className="flex-1 overflow-y-auto">
          <AgentList
            agents={visibleAgents}
            onSelect={handleSelectAgent}
            onDelete={handleDeleteAgent}
            onToggleEnabled={handleToggleEnabled}
          />
        </div>
      ) : (
        <AgentEditor
          ref={editorRef}
          agent={selectedAgent}
          roleOptions={addRoleOptions}
          onSaved={handleEditorSaved}
          onBack={singleAgent ? () => onOpenChange(false) : handleBack}
          showFooter={true}
          autoOpenGenerate={autoGenerate}
          presetBasePath={presetBasePath}
        />
      )}
    </>
  );

  if (standalone) {
    return (
      <div className="h-full flex flex-col">
        {content}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !singleAgent) handleBack(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0">
        {content}
      </DialogContent>
    </Dialog>
  );
}
