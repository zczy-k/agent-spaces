"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { useLLMStore } from "@/stores/llm";
import {
  BUILT_IN_AGENT_TOOLS,
  type AgentConfig,
  type LLMProvider,
} from "@agent-spaces/shared";
import { AgentIcon } from "@/components/common/agent-icon";
import { AvatarPicker } from "@/components/sidebar/settings/avatar-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SearchSelect } from "@/components/ui/search-select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  X,
  Cpu,
  PlugZap,
  FolderOpen,
  Wrench,
  Settings2,
  Sparkles,
  MessageSquare,
  Sliders,
  WandSparkles,
  Check,
  X as XIcon,
} from "lucide-react";
import EmojiPicker from "emoji-picker-react";
import { DiffViewer } from "@/components/git/diff-viewer";
import { ToolsDialog } from "@/components/sidebar/tools-dialog";
import { McpsDialog } from "@/components/sidebar/mcps-dialog";
import { SkillsDialog } from "@/components/sidebar/skills-dialog";
import {
  type AgentPreset,
  type AgentRole,
  type McpDraft,
  type ConnectionTestResult,
  PROVIDER_OPTIONS,
  RUNTIME_OPTIONS,
  Section,
  FieldGroup,
  SectionHeader,
} from "./agent-shared";

export function AgentDetail({
  agent,
  roleOptions,
  testing,
  testResult,
  onChange,
  onMcpChange,
  onTestConnection,
}: {
  agent: AgentPreset;
  roleOptions: AgentRole[];
  testing: boolean;
  testResult: ConnectionTestResult | null;
  onChange: <K extends keyof AgentPreset>(key: K, value: AgentPreset[K]) => void;
  onMcpChange: (value: McpDraft) => void;
  onTestConnection: () => void;
}) {
  const t = useTranslations("agent");
  const [dynamicModelOptions, setDynamicModelOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [optimizeOpen, setOptimizeOpen] = useState(false);
  const [optimizePrompt, setOptimizePrompt] = useState("");
  const [optimizing, setOptimizing] = useState(false);
  const [optimizedPrompt, setOptimizedPrompt] = useState("");
  const [optimizationError, setOptimizationError] = useState<string | null>(null);
  const [applyPreviewOpen, setApplyPreviewOpen] = useState(false);
  const [toolsDialogOpen, setToolsDialogOpen] = useState(false);
  const [mcpsDialogOpen, setMcpsDialogOpen] = useState(false);
  const [skillsDialogOpen, setSkillsDialogOpen] = useState(false);
  const [previewPrompt, setPreviewPrompt] = useState("");
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [avatarSrc, setAvatarSrc] = useState("");
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const emojiRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!emojiPickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setEmojiPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [emojiPickerOpen]);

  const { models: allLlmModels, providers: llmProviders, ensure: ensureLLM } = useLLMStore();
  const llmModels = allLlmModels.filter((m) => !m.embedding);
  const uniqueRoleOptions = Array.from(new Set(roleOptions));

  useEffect(() => {
    ensureLLM();
  }, [ensureLLM]);

  const handleSelectProvider = useCallback(
    (provider: LLMProvider) => {
      onChange("apiBase", provider.apiBase);
      onChange("apiKey", provider.apiKey);
      const providerModels = llmModels.filter((m) => m.provider === provider.name);
      const options = providerModels.map((m) => ({ value: m.modelId, label: m.name }));
      setDynamicModelOptions(options);
      if (options.length > 0) {
        onChange("modelId", options[0].value);
      }
    },
    [llmModels, onChange],
  );

  const handleOptimizePrompt = async () => {
    const prompt = optimizePrompt.trim();
    if (!prompt) return;

    setOptimizing(true);
    setOptimizationError(null);
    try {
      const res = await fetch("/api/agents/presets/optimize-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, currentPrompt: agent.systemPrompt }),
      });
      const data = (await res.json()) as { systemPrompt?: string; error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to optimize prompt");
      setOptimizedPrompt(data.systemPrompt?.trim() || "");
      setPreviewPrompt(agent.systemPrompt);
      setOptimizeOpen(false);
      setApplyPreviewOpen(true);
    } catch (err) {
      setOptimizationError(err instanceof Error ? err.message : "优化提示词失败");
    } finally {
      setOptimizing(false);
    }
  };

  const handleApplyOptimizedPrompt = () => {
    if (!optimizedPrompt.trim()) return;
    onChange("systemPrompt", optimizedPrompt);
    setApplyPreviewOpen(false);
    setOptimizedPrompt("");
    setPreviewPrompt("");
    setOptimizePrompt("");
  };

  const closeOptimizeDialog = (open: boolean) => {
    setOptimizeOpen(open);
    if (!open && !optimizing) {
      setOptimizePrompt("");
      setOptimizationError(null);
    }
  };

  return (
    <div className="flex flex-col gap-5 p-5">
      <Section icon={<MessageSquare className="size-3.5" />} title={t("detail.basic")}>
        <div className="flex items-start gap-4">
          <div className="relative flex flex-col items-center gap-1.5">
            {agent.avatarUrl ? (
              <div className="relative">
                <AgentIcon
                  name={agent.name}
                  avatarUrl={agent.avatarUrl}
                  icon={agent.icon}
                  apiBase={agent.apiBase}
                  className="size-16 rounded-xl border border-input"
                />
                <button
                  type="button"
                  className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 cursor-pointer"
                  onClick={() => onChange("avatarUrl", "")}
                >
                  <X className="size-3" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="relative size-16 rounded-xl border border-input bg-muted flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => setEmojiPickerOpen((v) => !v)}
              >
                {agent.icon ? (
                  <span className="text-2xl">{agent.icon}</span>
                ) : (
                  <span className="text-lg text-muted-foreground">{agent.name?.charAt(0).toUpperCase() || "?"}</span>
                )}
                {emojiPickerOpen && (
                  <div ref={emojiRef} className="absolute top-full left-0 z-50 mt-1" onClick={(e) => e.stopPropagation()}>
                    <EmojiPicker
                      open={emojiPickerOpen}
                      onEmojiClick={(emoji) => {
                        onChange("icon", emoji.emoji);
                        setEmojiPickerOpen(false);
                      }}
                      width={280}
                      height={350}
                      previewConfig={{ showPreview: false }}
                      skinTonesDisabled
                    />
                  </div>
                )}
              </button>
            )}
            <label className="text-[10px] text-primary cursor-pointer hover:underline">
              {t("detail.uploadAvatar")}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    setAvatarSrc(reader.result as string);
                    setAvatarPickerOpen(true);
                  };
                  reader.readAsDataURL(file);
                  e.target.value = "";
                }}
              />
            </label>
            <AvatarPicker
              src={avatarSrc}
              open={avatarPickerOpen}
              onOpenChange={setAvatarPickerOpen}
              onUploaded={(url) => onChange("avatarUrl", url)}
              skipUserSettings
            />
          </div>
          <div className="flex flex-1 flex-col gap-2.5">
            <FieldGroup label={t("detail.name")}>
              <Input value={agent.name} onChange={(e) => onChange("name", e.target.value)} />
            </FieldGroup>
            <FieldGroup label={t("detail.role")}>
              <select
                value={agent.role}
                onChange={(e) => onChange("role", e.target.value as AgentConfig["role"])}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring dark:bg-input/30"
              >
                {uniqueRoleOptions.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </FieldGroup>
          </div>
        </div>
        <FieldGroup label={t("detail.description")}>
          <Input value={agent.description} onChange={(e) => onChange("description", e.target.value)} />
        </FieldGroup>
        <FieldGroup label={t("detail.agentRuntime")}>
          <SearchSelect
            value={agent.runtimeKind ?? ""}
            onChange={(v) => onChange("runtimeKind", v as NonNullable<AgentConfig["runtimeKind"]>)}
            options={RUNTIME_OPTIONS.map((option) => ({ value: option.value, label: t(`runtime.${option.labelKey}`) }))}
            placeholder={t("detail.runtimePlaceholder")}
            searchPlaceholder={t("detail.runtimeSearchPlaceholder")}
            allowCustom={false}
          />
        </FieldGroup>
      </Section>

      <Section icon={<FolderOpen className="size-3.5" />} title={t("detail.workingDirectory")}>
        <Input value={agent.workingDir} onChange={(e) => onChange("workingDir", e.target.value)} placeholder={t("detail.workingDirPlaceholder")} />
      </Section>

      <div className="flex flex-col gap-2.5">
        <SectionHeader
          icon={<Sparkles className="size-3.5" />}
          title={t("detail.systemPrompt")}
          action={
            <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setOptimizeOpen(true)}>
              <WandSparkles className="size-3.5" />
              {t("detail.optimizePrompt")}
            </Button>
          }
        />
        <Textarea
          value={agent.systemPrompt}
          onChange={(e) => onChange("systemPrompt", e.target.value)}
          placeholder={t("detail.systemPromptPlaceholder")}
          className="min-h-24 text-xs"
        />
      </div>

      <Section icon={<Sparkles className="size-3.5" />} title={t("detail.outputStyle")}>
        <Textarea
          value={agent.outputStyle}
          onChange={(e) => onChange("outputStyle", e.target.value)}
          placeholder={t("detail.outputStylePlaceholder")}
          className="min-h-24 text-xs"
        />
      </Section>

      <div className="flex flex-col gap-2.5">
        <SectionHeader
          icon={<Wrench className="size-3.5" />}
          title={t("detail.mcpServers")}
          action={
            <Button variant="ghost" size="icon" className="size-5" onClick={() => setMcpsDialogOpen(true)}>
              <Settings2 className="size-3.5" />
            </Button>
          }
        />
        <div className="flex flex-wrap gap-1.5">
          {(() => {
            const mcpNames = Object.keys((agent.mcps as Record<string, Record<string, unknown>>)?.mcpServers ?? {});
            return mcpNames.length > 0 ? (
              mcpNames.map((name) => (
                <span key={name} className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium text-foreground">
                  {name}
                  <button
                    type="button"
                    onClick={() => {
                      const servers = { ...((agent.mcps as Record<string, Record<string, unknown>>)?.mcpServers ?? {}) };
                      delete servers[name];
                      onMcpChange({ ...(agent.mcps as Record<string, unknown>), mcpServers: servers });
                    }}
                    className="hover:text-destructive cursor-pointer"
                  >
                    <X className="size-2.5" />
                  </button>
                </span>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">{t("detail.noMcps")}</span>
            );
          })()}
        </div>
        <McpsDialog
          open={mcpsDialogOpen}
          onOpenChange={setMcpsDialogOpen}
          selectable
          selectedMcps={Object.keys((agent.mcps as Record<string, Record<string, unknown>>)?.mcpServers ?? {})}
          onSelectedMcpsChange={(names, configs) => {
            const oldServers = (agent.mcps as Record<string, Record<string, unknown>>)?.mcpServers ?? {};
            const newServers: Record<string, unknown> = {};
            for (const name of names) {
              const oldConfig = (oldServers as Record<string, unknown>)[name];
              newServers[name] = isRunnableMcpConfig(oldConfig) ? oldConfig : configs[name] ?? oldConfig ?? {};
            }
            onMcpChange({ ...(agent.mcps as Record<string, unknown>), mcpServers: newServers });
          }}
        />
      </div>

      <div className="flex flex-col gap-2.5">
        <SectionHeader
          icon={<Wrench className="size-3.5" />}
          title={t("detail.tools")}
          action={
            <Button variant="ghost" size="icon" className="size-5" onClick={() => setToolsDialogOpen(true)}>
              <Settings2 className="size-3.5" />
            </Button>
          }
        />
        <div className="flex flex-wrap gap-1.5">
          {agent.tools.length > 0 ? (
            agent.tools.map((tool) => {
              const builtIn = BUILT_IN_AGENT_TOOLS.find((t) => t.name === tool);
              return (
                <span key={tool} className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium text-foreground">
                  {builtIn?.label ?? tool}
                  <button type="button" onClick={() => onChange("tools", agent.tools.filter((t) => t !== tool))} className="hover:text-destructive cursor-pointer">
                    <X className="size-2.5" />
                  </button>
                </span>
              );
            })
          ) : (
            <span className="text-xs text-muted-foreground">{t("detail.noTools")}</span>
          )}
        </div>
        <ToolsDialog
          open={toolsDialogOpen}
          onOpenChange={setToolsDialogOpen}
          selectable
          selectedTools={agent.tools}
          onSelectedToolsChange={(tools) => onChange("tools", tools)}
        />
      </div>

      <div className="flex flex-col gap-2.5">
        <SectionHeader
          icon={<Cpu className="size-3.5" />}
          title={t("detail.skills")}
          action={
            <Button variant="ghost" size="icon" className="size-5" onClick={() => setSkillsDialogOpen(true)}>
              <Settings2 className="size-3.5" />
            </Button>
          }
        />
        <div className="flex flex-wrap gap-1.5">
          {agent.skills.length > 0 ? (
            agent.skills.map((skill) => (
              <span key={skill.name} className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium text-foreground">
                {skill.name}
                <button type="button" onClick={() => onChange("skills", agent.skills.filter((s) => s.name !== skill.name))} className="hover:text-destructive cursor-pointer">
                  <X className="size-2.5" />
                </button>
              </span>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">{t("detail.noSkills")}</span>
          )}
        </div>
        <SkillsDialog
          open={skillsDialogOpen}
          onOpenChange={setSkillsDialogOpen}
          selectable
          selectedSkills={agent.skills.map((s) => s.name)}
          onSelectedSkillsChange={(names) => onChange("skills", names.map((name) => ({ name })))}
        />
      </div>

      <Section icon={<Sliders className="size-3.5" />} title={t("detail.model")}>
        <div className="space-y-2.5">
          <FieldGroup label={t("detail.provider")}>
            <SearchSelect
              value={llmProviders.find((p) => p.apiBase === agent.apiBase && p.apiKey === agent.apiKey)?.name || ""}
              onChange={(v) => {
                const provider = llmProviders.find((p) => p.name === v);
                if (provider) handleSelectProvider(provider);
              }}
              options={llmProviders.map((p) => ({ value: p.name, label: p.name }))}
              placeholder={t("detail.providerPlaceholder")}
              searchPlaceholder={t("detail.providerSearchPlaceholder")}
              allowCustom={false}
            />
          </FieldGroup>
          <FieldGroup label={t("detail.modelField")}>
            <SearchSelect
              value={agent.modelId}
              onChange={(v) => onChange("modelId", v)}
              options={dynamicModelOptions.length > 0 ? dynamicModelOptions : [{ value: agent.modelId || "", label: agent.modelId || t("detail.selectProviderFirst") }]}
              placeholder={t("detail.modelPlaceholder")}
              searchPlaceholder={t("detail.modelSearchPlaceholder")}
            />
          </FieldGroup>
          <FieldGroup label={t("detail.apiMessageType")}>
            <SearchSelect
              value={agent.modelProvider || ""}
              onChange={(v) => onChange("modelProvider", v as AgentPreset["modelProvider"])}
              options={PROVIDER_OPTIONS.map((option) => ({ value: option.value, label: t(`provider.${option.labelKey}`) }))}
              placeholder={t("detail.apiMessageTypePlaceholder")}
              searchPlaceholder={t("detail.apiMessageTypeSearchPlaceholder")}
              allowCustom={false}
            />
          </FieldGroup>
          <FieldGroup label={t("detail.apiBase")}>
            <Input value={agent.apiBase} onChange={(e) => onChange("apiBase", e.target.value)} placeholder={t("detail.apiBasePlaceholder")} className="h-7 text-xs" />
          </FieldGroup>
          <FieldGroup label={t("detail.apiKey")}>
            <Input type="password" value={agent.apiKey} onChange={(e) => onChange("apiKey", e.target.value)} placeholder={t("detail.apiKeyPlaceholder")} className="h-7 text-xs" />
          </FieldGroup>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">{t("detail.validateHelper")}</div>
          <Button type="button" variant="outline" size="sm" onClick={onTestConnection} disabled={testing || !agent.apiBase || !agent.apiKey || !agent.modelId}>
            <PlugZap className="size-3.5" />
            {testing ? t("detail.testing") : t("detail.test")}
          </Button>
        </div>
        {testResult && (
          <div
            className={cn(
              "rounded-md border px-3 py-2 text-xs",
              testResult.success ? "border-green-500/30 bg-green-500/10 text-green-700" : "border-destructive/30 bg-destructive/10 text-destructive",
            )}
          >
            {testResult.message}
            {testResult.debug && (
              <div className="mt-2 space-y-1 font-mono text-[10px] opacity-80">
                {testResult.debug.status && <div>{t("debug.status")} {testResult.debug.status}</div>}
                {testResult.debug.provider && <div>{t("debug.provider")} {testResult.debug.provider}</div>}
                {testResult.debug.requestUrl && <div>{t("debug.url")} {testResult.debug.requestUrl}</div>}
                {testResult.debug.model && <div>{t("debug.model")} {testResult.debug.model}</div>}
                {testResult.debug.responseBody && <div className="max-h-20 overflow-auto whitespace-pre-wrap">{t("debug.body")} {testResult.debug.responseBody}</div>}
              </div>
            )}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label={t("detail.temperature")}>
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
              <span className="w-8 text-right font-mono text-xs">{agent.temperature}</span>
            </div>
          </FieldGroup>
          <FieldGroup label={t("detail.maxTokens")}>
            <Input type="number" value={agent.maxTokens} onChange={(e) => onChange("maxTokens", parseInt(e.target.value) || 0)} className="h-7 text-xs" />
          </FieldGroup>
        </div>
      </Section>

      <Dialog open={optimizeOpen} onOpenChange={closeOptimizeDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("detail.optimizePrompt")}</DialogTitle>
            <DialogDescription>{t("detail.optimizePromptDescription")}</DialogDescription>
          </DialogHeader>
          <Textarea
            value={optimizePrompt}
            onChange={(e) => setOptimizePrompt(e.target.value)}
            placeholder={t("detail.optimizePromptPlaceholder")}
            className="min-h-32 text-sm"
          />
          {optimizationError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {optimizationError}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => closeOptimizeDialog(false)} disabled={optimizing}>
              {t("detail.cancel")}
            </Button>
            <Button onClick={handleOptimizePrompt} disabled={optimizing || !optimizePrompt.trim()}>
              {optimizing ? t("detail.optimizing") : t("detail.optimizeConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={applyPreviewOpen} onOpenChange={setApplyPreviewOpen}>
        <DialogContent className="!w-[min(92vw,1200px)] !max-w-[min(92vw,1200px)] !h-[85vh] flex flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b px-4 py-3">
            <DialogTitle>{t("detail.optimizePreviewTitle")}</DialogTitle>
            <DialogDescription>{t("detail.optimizePreviewDescription")}</DialogDescription>
          </DialogHeader>
          <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
            <div className="min-h-0 border-b lg:border-b-0 lg:border-r">
              <DiffViewer oldContent={previewPrompt} newContent={optimizedPrompt} path="system-prompt.md" />
            </div>
            <div className="flex min-h-0 flex-col border-t lg:border-t-0">
              <div className="border-b px-4 py-3">
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("detail.optimizeRequest")}</div>
                <div className="mt-2 whitespace-pre-wrap text-sm text-foreground">{optimizePrompt}</div>
              </div>
              <div className="flex-1 min-h-0 overflow-auto px-4 py-3">
                <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("detail.optimizedPrompt")}</div>
                <pre className="whitespace-pre-wrap text-sm leading-6 text-foreground">{optimizedPrompt}</pre>
              </div>
            </div>
          </div>
          <DialogFooter className="border-t m-1">
            <Button variant="outline" onClick={() => setApplyPreviewOpen(false)}>
              <XIcon className="size-3.5" />
              {t("detail.cancel")}
            </Button>
            <Button onClick={handleApplyOptimizedPrompt}>
              <Check className="size-3.5" />
              {t("detail.applyOptimizedPrompt")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function isRunnableMcpConfig(config: unknown): config is Record<string, unknown> {
  if (!config || typeof config !== "object" || Array.isArray(config)) return false;
  const record = config as Record<string, unknown>;
  return typeof record.command === "string" && record.command.trim().length > 0
    || typeof record.url === "string" && record.url.trim().length > 0;
}
