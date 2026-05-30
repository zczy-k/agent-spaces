"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Download,
  FileText,
  Plus,
  RefreshCw,
  RotateCcw,
  Store,
  WandSparkles,
} from "lucide-react";
import { fetchStoreIndex } from "@/lib/agent-store";
import { StoreTabPanel } from "@/components/common/store-tab-panel";
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
const AGENT_TITLE_GENERATOR_PRESET_ID = "title-generator";
const FIXED_AGENT_IDS = new Set([AGENT_GENERATOR_PRESET_ID, AGENT_COMMIT_PRESET_ID, AGENT_TITLE_GENERATOR_PRESET_ID]);

type TabType = "local" | "store";

interface StoreAgentItem {
  id: string;
  name: string;
  group: string;
  path: string;
  description: string;
  emoji: string;
}

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

  // Tab & filter
  const [activeTab, setActiveTab] = useState<TabType>("local");
  const [roleFilterLocal, setRoleFilterLocal] = useState<string>("");
  const [localSearch, setLocalSearch] = useState("");

  // Store state
  const [storeAgents, setStoreAgents] = useState<StoreAgentItem[]>([]);
  const [storeLoading, setStoreLoading] = useState(false);
  const [importingIds, setImportingIds] = useState<Set<string>>(new Set());

  const roleFilterSet = roleFilter
    ? new Set(Array.isArray(roleFilter) ? roleFilter : [roleFilter])
    : null;
  const visibleAgents = (roleFilterSet
    ? agents.filter((agent) => FIXED_AGENT_IDS.has(agent.id) || roleFilterSet.has(agent.role))
    : agents).filter((agent, index, list) => list.findIndex((item) => item.id === agent.id) === index);
  const addRoleOptions = Array.from(
    new Set(roleFilterSet ? ROLE_OPTIONS.filter((role) => roleFilterSet.has(role)) : ROLE_OPTIONS),
  );

  // Filtered by role + search
  const filteredAgents = visibleAgents.filter((agent) => {
    if (roleFilterLocal && agent.role !== roleFilterLocal) {
      if (!(roleFilterLocal === "system" && FIXED_AGENT_IDS.has(agent.id))) return false;
    }
    if (localSearch) {
      const q = localSearch.toLowerCase();
      if (!agent.name.toLowerCase().includes(q) && !(agent.description || "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const fetchStoreAgents = useCallback(async () => {
    setStoreLoading(true);
    try {
      const data = await fetchStoreIndex<StoreAgentItem>("agents/index.json");
      setStoreAgents(data);
    } catch { /* ignore */ }
    setStoreLoading(false);
  }, []);

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

    fetchStoreAgents();

    return () => controller.abort();
  }, [open, initialAgentId, presetBasePath, singleAgent, t, fetchStoreAgents]);

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

  // Store import
  const localAgentNames = new Set(agents.map((a) => a.name));
  const importFromStore = async (storeAgent: StoreAgentItem) => {
    if (importingIds.has(storeAgent.id)) return;
    setImportingIds((prev) => new Set(prev).add(storeAgent.id));
    try {
      const base = (() => {
        const stored = localStorage.getItem('agent-spaces:store-api-base');
        return stored ? stored.replace(/\/+$/, '') : '/agents-store';
      })();
      const res = await fetch(`${base}/agents/${storeAgent.path}.md`);
      if (!res.ok) throw new Error("fetch failed");
      const content = await res.text();
      // Parse frontmatter
      const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      const body = content.slice(fm ? fm[0].length : 0).trim();
      let name = storeAgent.name;
      let description = storeAgent.description;
      if (fm) {
        for (const line of fm[1].split(/\r?\n/)) {
          const m = line.match(/^\s*(\w+)\s*:\s*(.+)/);
          if (!m) continue;
          if (m[1] === "name") name = m[2].trim();
          else if (m[1] === "description") description = m[2].trim();
        }
      }
      const payload = {
        name,
        role: "agent",
        description,
        runtimeKind: "claude-code",
        modelProvider: "anthropic-messages",
        modelId: "claude-sonnet-4-6",
        systemPrompt: body,
        enabled: true,
      };
      const createRes = await fetch(presetBasePath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!createRes.ok) throw new Error(await createRes.text());
      // Refresh list
      const listRes = await fetch(presetBasePath);
      if (listRes.ok) setAgents((await listRes.json()).map(normalizeAgent));
    } catch { /* ignore */ }
    setImportingIds((prev) => {
      const next = new Set(prev);
      next.delete(storeAgent.id);
      return next;
    });
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
          {Array.from(new Set(ROLE_OPTIONS)).map((role) => (
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

  // Role filter sidebar
  const uniqueRoles = Array.from(new Set(visibleAgents.map((a) => a.role)));
  const hasSystemAgents = visibleAgents.some((a) => FIXED_AGENT_IDS.has(a.id));

  const roleSidebar = (
    <ScrollArea className="hidden md:block w-44 shrink-0">
      <div className="flex flex-col gap-1 pr-2">
        <Button
          variant={!roleFilterLocal ? "secondary" : "ghost"}
          size="sm"
          className="w-full justify-start"
          onClick={() => setRoleFilterLocal("")}
        >
          <FileText className="size-3.5 mr-1.5" />
          {t('dialog.filterAll')}
        </Button>
        {uniqueRoles.map((role) => (
          <Button
            key={role}
            variant={roleFilterLocal === role ? "secondary" : "ghost"}
            size="sm"
            className="w-full justify-start"
            onClick={() => setRoleFilterLocal(roleFilterLocal === role ? "" : role)}
          >
            <span className={cn("size-2 rounded-full mr-1.5", ROLE_COLORS[role]?.split(" ")[0])} />
            <span className="truncate capitalize">{t(`role.${role}.name`)}</span>
          </Button>
        ))}
        {hasSystemAgents && (
          <Button
            variant={roleFilterLocal === "system" ? "secondary" : "ghost"}
            size="sm"
            className="w-full justify-start"
            onClick={() => setRoleFilterLocal(roleFilterLocal === "system" ? "" : "system")}
          >
            <Bot className="size-3.5 mr-1.5" />
            <span className="truncate">System</span>
          </Button>
        )}
      </div>
    </ScrollArea>
  );

  const tabs = (
    <div className="flex items-center gap-1 border-b border-border px-1">
      {([['local', FileText, t('dialog.tabLocal')], ['store', Store, t('dialog.tabStore')]] as const).map(([key, Icon, label]) => (
        <button
          key={key}
          onClick={() => setActiveTab(key)}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === key
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Icon className="size-3.5" />
          {label}
        </button>
      ))}
    </div>
  );

  const storeView = (
    <StoreTabPanel<StoreAgentItem>
      items={storeAgents}
      loading={storeLoading}
      getGroup={(a) => a.group}
      getId={(a) => a.id}
      allFilterText={t('dialog.filterAll')}
      searchPlaceholder={t('dialog.searchStore')}
      emptyText={t('dialog.storeEmpty')}
      loadingText={tc('loading')}
      renderItem={(agent) => {
        const isImported = localAgentNames.has(agent.name);
        const isImporting = importingIds.has(agent.id);
        return (
          <div className="rounded-xl border border-border bg-background p-4 hover:bg-accent/30 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-base">{agent.emoji || '🤖'}</span>
                  <span className="font-medium text-sm">{agent.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                    {agent.group}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{agent.description}</p>
              </div>
              <Button
                variant={isImported ? "ghost" : "outline"}
                size="sm"
                className="shrink-0"
                disabled={isImported || isImporting}
                onClick={() => importFromStore(agent)}
              >
                {isImported ? (
                  t('dialog.imported')
                ) : isImporting ? (
                  t('dialog.importing')
                ) : (
                  <>
                    <Download className="size-3.5 mr-1" />
                    {t('dialog.importTo')}
                  </>
                )}
              </Button>
            </div>
          </div>
        );
      }}
    />
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
        <div className="flex flex-1 min-h-0 flex-col">
          {tabs}
          {activeTab === "local" ? (
            <div className="flex flex-1 min-h-0 gap-4 pt-2">
              {(uniqueRoles.length > 1 || hasSystemAgents) && roleSidebar}
              <div className="flex-1 min-w-0 flex flex-col min-h-0">
                <div className="relative mb-3">
                  <Bot className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={localSearch}
                    onChange={(e) => setLocalSearch(e.target.value)}
                    placeholder={t('dialog.searchLocal')}
                    className="pl-8"
                  />
                </div>
                <div className="flex-1 overflow-y-auto">
                  <AgentList
                    agents={filteredAgents}
                    onSelect={handleSelectAgent}
                    onDelete={handleDeleteAgent}
                    onToggleEnabled={handleToggleEnabled}
                  />
                </div>
              </div>
            </div>
          ) : (
            storeView
          )}
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
