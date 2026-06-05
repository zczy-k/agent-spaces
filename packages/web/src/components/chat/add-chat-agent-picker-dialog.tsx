"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import { type AgentConfig } from "@agent-spaces/shared";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { AgentIcon } from "@/components/common/agent-icon";
import { StoreTabPanel } from "@/components/common/store-tab-panel";
import { Bot, FileText, Store, Plus, Check } from "lucide-react";
import { sdk } from "@/lib/sdk";
import { fetchStoreIndex } from "@/lib/agent-store";
import { normalizeAgent, ROLE_COLORS, type AgentPreset } from "@/components/sidebar/agent-shared";
import type { ChatAgent } from "@agent-spaces/sdk";

const BUILT_IN_IDS = new Set(["agent-generator", "commit-agent", "title-generator"]);
type TabType = "local" | "store";

interface StoreChatAgentItem {
  id: string;
  name: string;
  group: string;
  path: string;
  description: string;
  emoji: string;
}

interface AddChatAgentPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatAgents: ChatAgent[];
  onAdd: (preset: AgentPreset) => void;
}

export function AddChatAgentPickerDialog({
  open,
  onOpenChange,
  chatAgents,
  onAdd,
}: AddChatAgentPickerDialogProps) {
  const t = useTranslations("agent");
  const tc = useTranslations("common");

  // ── Local tab ──
  const [agents, setAgents] = useState<AgentPreset[]>([]);
  const [loading, setLoading] = useState(false);
  const [localSearch, setLocalSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  // ── Store tab ──
  const [storeAgents, setStoreAgents] = useState<StoreChatAgentItem[]>([]);
  const [storeLoading, setStoreLoading] = useState(false);
  const [importingIds, setImportingIds] = useState<Set<string>>(new Set());

  // ── Tab ──
  const [activeTab, setActiveTab] = useState<TabType>("local");

  // Fetch local presets on open
  useEffect(() => {
    if (!open) return;
    setLocalSearch("");
    setRoleFilter("");
    setActiveTab("local");
    setLoading(true);
    sdk.agent
      .listPresets()
      .then((data: AgentConfig[]) => {
        const presets = data.map(normalizeAgent);
        setAgents(presets);
        const chatNames = new Set(chatAgents.map((a) => a.name));
        setAddedIds(new Set(presets.filter((a) => chatNames.has(a.name)).map((a) => a.id)));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, chatAgents]);

  // Fetch store agents on open
  useEffect(() => {
    if (!open) return;
    setStoreLoading(true);
    fetchStoreIndex<StoreChatAgentItem>("chat/index.json")
      .then(setStoreAgents)
      .catch(() => setStoreAgents([]))
      .finally(() => setStoreLoading(false));
  }, [open]);

  // ── Local filtering ──
  const visibleAgents = agents.filter((a) => !BUILT_IN_IDS.has(a.id) && a.enabled);
  const uniqueRoles = Array.from(new Set(visibleAgents.map((a) => a.role)));

  const filteredAgents = useMemo(() => {
    return visibleAgents.filter((agent) => {
      if (roleFilter && agent.role !== roleFilter) return false;
      if (localSearch) {
        const q = localSearch.toLowerCase();
        if (!agent.name.toLowerCase().includes(q) && !agent.description.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [visibleAgents, roleFilter, localSearch]);

  // ── Handlers ──
  const handleAdd = useCallback(
    (preset: AgentPreset) => {
      onAdd(preset);
      setAddedIds((prev) => new Set(prev).add(preset.id));
    },
    [onAdd],
  );

  const handleImportFromStore = useCallback(
    async (storeAgent: StoreChatAgentItem) => {
      if (importingIds.has(storeAgent.id)) return;
      setImportingIds((prev) => new Set(prev).add(storeAgent.id));
      try {
        const base = (() => {
          const stored = localStorage.getItem("agent-spaces:store-api-base");
          return stored ? stored.replace(/\/+$/, "") : "/agents-store";
        })();
        const res = await fetch(`${base}/chat/${storeAgent.path}.md`);
        if (!res.ok) throw new Error("fetch failed");
        const content = await res.text();
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
        handleAdd({
          id: `store-${storeAgent.id}`,
          name,
          role: "agent",
          description: description || "",
          avatarUrl: "",
          icon: storeAgent.emoji || "",
          runtimeKind: "langchain",
          modelProvider: "",
          modelId: "",
          apiBase: "",
          apiKey: "",
          workingDir: "",
          mcps: {},
          skills: [],
          tools: [],
          systemPrompt: body,
          outputStyle: "",
          temperature: 0.3,
          maxTokens: 4096,
          enabled: true,
        });
      } catch { /* ignore */ }
      setImportingIds((prev) => {
        const next = new Set(prev);
        next.delete(storeAgent.id);
        return next;
      });
    },
    [importingIds, handleAdd],
  );

  // ── Sidebar ──
  const roleSidebar = (
    <ScrollArea className="hidden md:block w-44 shrink-0">
      <div className="flex flex-col gap-1 pr-2">
        <Button
          variant={!roleFilter ? "secondary" : "ghost"}
          size="sm"
          className="w-full justify-start"
          onClick={() => setRoleFilter("")}
        >
          <FileText className="size-3.5 mr-1.5" />
          {t("dialog.filterAll")}
        </Button>
        {uniqueRoles.map((role) => (
          <Button
            key={role}
            variant={roleFilter === role ? "secondary" : "ghost"}
            size="sm"
            className="w-full justify-start"
            onClick={() => setRoleFilter(roleFilter === role ? "" : role)}
          >
            <span className={`size-2 rounded-full mr-1.5 ${ROLE_COLORS[role]?.split(" ")[0]}`} />
            <span className="truncate capitalize">{t(`role.${role}.name`)}</span>
          </Button>
        ))}
      </div>
    </ScrollArea>
  );

  // ── Tabs ──
  const tabs = (
    <div className="flex items-center gap-1 border-b border-border px-1">
      {(
        [
          ["local", FileText, t("dialog.tabLocal")],
          ["store", Store, t("dialog.tabStore")],
        ] as [TabType, typeof FileText, string][]
      ).map(([key, Icon, label]) => (
        <button
          key={key}
          onClick={() => setActiveTab(key)}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === key
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Icon className="size-3.5" />
          {label}
        </button>
      ))}
    </div>
  );

  // ── Local list ──
  const localView = (
    <div className="flex flex-1 min-h-0 gap-4 pt-2">
      {uniqueRoles.length > 1 && roleSidebar}
      <div className="flex-1 min-w-0 flex flex-col min-h-0">
        <div className="relative mb-3">
          <Bot className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder={t("dialog.searchLocal")}
            className="pl-8"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
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
                </div>
              ))}
            </div>
          ) : filteredAgents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Bot className="size-10 mb-2 opacity-30" />
              <p className="text-sm">No agents available</p>
            </div>
          ) : (
            <div className="flex flex-col p-2">
              {filteredAgents.map((preset) => {
                const added = addedIds.has(preset.id);
                return (
                  <div
                    key={preset.id}
                    className="group flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <AgentIcon
                      agentId={preset.id}
                      name={preset.name}
                      avatarUrl={preset.avatarUrl}
                      icon={preset.icon}
                      apiBase={preset.apiBase}
                      className="size-8"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{preset.name}</span>
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                          {preset.role}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {preset.modelId.split("-").slice(0, 2).join("-")}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {preset.description || "No description"}
                      </p>
                    </div>
                    {added ? (
                      <div className="flex items-center gap-1 text-green-500 text-xs">
                        <Check className="size-4" />
                        <span>Added</span>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleAdd(preset)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Plus className="size-4 mr-1" />
                        Add
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // ── Store list ──
  const localAgentNames = new Set(agents.map((a) => a.name));
  const storeView = (
    <StoreTabPanel<StoreChatAgentItem>
      items={storeAgents}
      loading={storeLoading}
      getGroup={(a) => a.group}
      getId={(a) => a.id}
      allFilterText={t("dialog.filterAll")}
      searchPlaceholder={t("dialog.searchStore")}
      emptyText={t("dialog.storeEmpty")}
      loadingText={tc("loading")}
      renderItem={(agent) => {
        const isAdded = localAgentNames.has(agent.name) || importingIds.has(agent.id);
        const isImporting = importingIds.has(agent.id);
        return (
          <div className="rounded-xl border border-border bg-background p-4 hover:bg-accent/30 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-base">{agent.emoji || "🤖"}</span>
                  <span className="font-medium text-sm">{agent.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                    {agent.group}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{agent.description}</p>
              </div>
              {isAdded && !isImporting ? (
                <div className="flex items-center gap-1 text-green-500 text-xs shrink-0">
                  <Check className="size-4" />
                  <span>Added</span>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  disabled={isImporting}
                  onClick={() => handleImportFromStore(agent)}
                >
                  {isImporting ? t("dialog.importing") : (
                    <>
                      <Plus className="size-3.5 mr-1" />
                      {t("dialog.importTo")}
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        );
      }}
    />
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[80vw] max-h-[85vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <div className="flex items-center gap-3 border-b px-5 pr-12 py-4">
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10">
            <Bot className="size-4 text-primary" />
          </div>
          <DialogHeader className="flex-1 space-y-0">
            <DialogTitle className="text-base">Add Agent to Chat</DialogTitle>
            <DialogDescription className="text-xs">
              Select an agent to add to your chat
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
          {tabs}
          {activeTab === "local" ? localView : storeView}
        </div>
      </DialogContent>
    </Dialog>
  );
}
