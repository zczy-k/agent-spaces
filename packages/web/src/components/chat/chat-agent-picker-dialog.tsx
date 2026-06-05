"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
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
import { AgentIcon } from "@/components/common/agent-icon";
import { StoreTabPanel } from "@/components/common/store-tab-panel";
import { Switch } from "@/components/ui/switch";
import { Bot, FileText, Store, Plus, Check, WandSparkles, Trash2 } from "lucide-react";
import { fetchStoreIndex } from "@/lib/agent-store";
import type { AgentPreset } from "@/components/sidebar/agent-shared";
import type { ChatAgent } from "@agent-spaces/sdk";

type TabType = "local" | "store";

interface StoreChatAgentItem {
  id: string;
  name: string;
  group: string;
  path: string;
  description: string;
  emoji: string;
}

interface ChatAgentPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatAgents: ChatAgent[];
  onAdd: (preset: AgentPreset) => void;
  onRemoveAgent?: (id: string) => void;
  onCreate?: () => void;
  onSmartCreate?: () => void;
}

export function ChatAgentPickerDialog({
  open,
  onOpenChange,
  chatAgents,
  onAdd,
  onRemoveAgent,
  onCreate,
  onSmartCreate,
}: ChatAgentPickerDialogProps) {
  const t = useTranslations("agent");
  const tc = useTranslations("common");

  // ── Local tab ──
  const [localSearch, setLocalSearch] = useState("");
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  // ── Store tab ──
  const [storeAgents, setStoreAgents] = useState<StoreChatAgentItem[]>([]);
  const [storeLoading, setStoreLoading] = useState(false);
  const [importingIds, setImportingIds] = useState<Set<string>>(new Set());

  // ── Tab ──
  const [activeTab, setActiveTab] = useState<TabType>("local");

  // Track added agents from chat store
  useEffect(() => {
    if (!open) return;
    setLocalSearch("");
    setActiveTab("local");
    setAddedIds(new Set(chatAgents.map((a) => a.id)));
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
  const filteredAgents = useMemo(() => {
    if (!localSearch) return chatAgents;
    const q = localSearch.toLowerCase();
    return chatAgents.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.description || "").toLowerCase().includes(q),
    );
  }, [chatAgents, localSearch]);

  // ── Handlers ──
  const handleAdd = useCallback(
    (agent: ChatAgent) => {
      onAdd({
        id: agent.id,
        name: agent.name,
        role: "agent",
        description: agent.description || "",
        avatarUrl: agent.avatar || "",
        icon: "",
        runtimeKind: "langchain",
        modelProvider: (agent.provider || "") as AgentPreset["modelProvider"],
        modelId: agent.model || "",
        apiBase: agent.baseURL || "",
        apiKey: agent.apiKey || "",
        workingDir: "",
        mcps: {},
        skills: [],
        tools: [],
        systemPrompt: agent.systemPrompt || "",
        outputStyle: "",
        temperature: 0.3,
        maxTokens: 4096,
        enabled: true,
      });
      setAddedIds((prev) => new Set(prev).add(agent.id));
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
        onAdd({
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
    [importingIds, onAdd],
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

  // ── Local list (data from chat store via chatAgents prop) ──
  const localView = (
    <div className="flex flex-1 min-h-0 flex-col pt-2">
      <div className="relative mb-3 px-2">
        <Bot className="size-3.5 absolute left-4.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          placeholder={t("dialog.searchLocal")}
          className="pl-8"
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        {filteredAgents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Bot className="size-10 mb-2 opacity-30" />
            <p className="text-sm">No agents available</p>
          </div>
        ) : (
          <div className="flex flex-col p-2">
            {filteredAgents.map((agent) => {
              const added = addedIds.has(agent.id);
              return (
                <div
                  key={agent.id}
                  className="group flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/50 transition-colors"
                >
                  <AgentIcon
                    agentId={agent.id}
                    name={agent.name}
                    avatarUrl={agent.avatar}
                    className="size-8"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{agent.name}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {agent.model}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {agent.description || "No description"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      size="sm"
                      checked={added}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          handleAdd(agent);
                        } else {
                          setAddedIds((prev) => {
                            const next = new Set(prev);
                            next.delete(agent.id);
                            return next;
                          });
                          onRemoveAgent?.(agent.id);
                        }
                      }}
                    />
                    {onRemoveAgent && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                        onClick={() => {
                          setAddedIds((prev) => {
                            const next = new Set(prev);
                            next.delete(agent.id);
                            return next;
                          });
                          onRemoveAgent(agent.id);
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  // ── Store list ──
  const chatAgentNames = new Set(chatAgents.map((a) => a.name));
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
        const isAdded = chatAgentNames.has(agent.name) || importingIds.has(agent.id);
        const isImporting = importingIds.has(agent.id);
        return (
          <div className="rounded-xl border border-border bg-background p-4 hover:bg-accent/30 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-base">{agent.emoji || "🤖"}</span>
                  <span className="font-medium text-sm">{agent.name}</span>
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                    {agent.group}
                  </Badge>
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
      <DialogContent className="sm:max-w-[80vw] h-[70vh] flex flex-col p-0 gap-0">
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
          <div className="flex items-center gap-2">
            {onCreate && (
              <Button variant="outline" size="sm" onClick={onCreate}>
                <Plus className="size-3.5" />
                {t("dialog.add")}
              </Button>
            )}
            {onSmartCreate && (
              <Button variant="outline" size="sm" onClick={onSmartCreate}>
                <WandSparkles className="size-3.5" />
                智能创建
              </Button>
            )}
          </div>
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
