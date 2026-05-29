"use client";

import { forwardRef, useState, useImperativeHandle } from "react";
import { useTranslations } from "next-intl";
import { type AgentConfig } from "@agent-spaces/shared";
import { useAgentStore } from "@/stores/agent";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  type AgentPreset,
  type AgentRole,
  type BuiltInRole,
  type ConnectionTestResult,
  type McpDraft,
  ROLE_OPTIONS,
  normalizeAgent,
  serializeAgent,
  isDraftAgent,
  isAnthropicBridgeProvider,
  newAgentDraft,
} from "./agent-shared";
import { AgentDetail } from "./agent-detail";

export interface AgentEditorHandle {
  reset: () => void;
  openGenerate: () => void;
}

export interface AgentEditorProps {
  agent: AgentPreset;
  roleOptions?: AgentRole[];
  onSaved: (saved: AgentPreset) => void;
  onBack: () => void;
  /** Show footer save/cancel buttons. Default true */
  showFooter?: boolean;
  /** Auto-open the generate dialog on mount */
  autoOpenGenerate?: boolean;
  presetBasePath?: string;
}

export const AgentEditor = forwardRef<AgentEditorHandle, AgentEditorProps>(
  function AgentEditor(
    {
      agent: initialAgent,
      roleOptions = ROLE_OPTIONS,
      onSaved,
      onBack,
      showFooter = true,
      autoOpenGenerate = false,
      presetBasePath = "/api/agents/presets",
    },
    ref,
  ) {
    const t = useTranslations("agent");
    const tc = useTranslations("common");

    const [editDraft, setEditDraft] = useState<AgentPreset>({ ...initialAgent });
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [resetKey, setResetKey] = useState(0);

    const [generateOpen, setGenerateOpen] = useState(autoOpenGenerate);
    const [generatePrompt, setGeneratePrompt] = useState("");
    const [generating, setGenerating] = useState(false);

    useImperativeHandle(ref, () => ({
      reset() {
        setEditDraft((draft) => {
          if (!draft) return { ...initialAgent };
          const { modelProvider, modelId, apiBase, apiKey, runtimeKind } = draft;
          return { ...initialAgent, modelProvider, modelId, apiBase, apiKey, runtimeKind };
        });
        setTestResult(null);
        setResetKey((k) => k + 1);
      },
      openGenerate() {
        setGenerateOpen(true);
      },
    }));

    const handleSave = async () => {
      if (!editDraft) return;
      setSaving(true);
      setError(null);
      try {
        const isDraft = isDraftAgent(editDraft);
        const createBody = serializeAgent(editDraft);
        const res = await fetch(
          isDraft ? presetBasePath : `${presetBasePath}/${editDraft.id}`,
          {
            method: isDraft ? "POST" : "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(isDraft ? createBody : editDraft),
          },
        );
        if (!res.ok) throw new Error(await res.text());
        const raw = (await res.json()) as AgentConfig;
        const saved = normalizeAgent(raw);
        if (presetBasePath === "/api/agents/presets") {
          useAgentStore.setState((state) => ({
            agents: isDraft
              ? [...state.agents, raw]
              : state.agents.map((a) => (a.id === raw.id ? raw : a)),
          }));
        }
        onSaved(saved);
      } catch {
        setError(t("error.saveFailed"));
      } finally {
        setSaving(false);
      }
    };

    const handleTestConnection = async () => {
      if (!editDraft) return;
      setTesting(true);
      setTestResult(null);
      setError(null);
      try {
        const res = await fetch(`${presetBasePath}/test-connection`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editDraft),
        });
        const data = (await res.json()) as ConnectionTestResult & { error?: string };
        setTestResult({
          success: Boolean(data.success),
          message: data.message || data.error || t("error.connectionTestFailed"),
          debug: data.debug ? { ...data.debug, status: res.status } : { status: res.status },
        });
      } catch (err) {
        setTestResult({
          success: false,
          message: err instanceof Error ? err.message : t("error.connectionTestFailed"),
        });
      } finally {
        setTesting(false);
      }
    };

    const handleGenerateAgent = async () => {
      const prompt = generatePrompt.trim();
      if (!prompt) return;
      setGenerating(true);
      setError(null);
      try {
        const res = await fetch(`${presetBasePath}/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt }),
        });
        const data = (await res.json()) as Partial<Pick<AgentPreset, "name" | "description" | "systemPrompt">> & { error?: string };
        if (!res.ok) throw new Error(data.error || "Failed to generate agent");
        const base = editDraft ?? newAgentDraft(roleOptions[0] as BuiltInRole ?? "agent");
        const draft: AgentPreset = {
          ...base,
          name: data.name?.trim() || base.name,
          description: data.description?.trim() || base.description,
          systemPrompt: data.systemPrompt?.trim() || base.systemPrompt,
        };
        setEditDraft(draft);
        setGenerateOpen(false);
        setGeneratePrompt("");
        setTestResult(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "智能创建 Agent 失败");
      } finally {
        setGenerating(false);
      }
    };

    const updateAgentDraft = <K extends keyof AgentPreset>(key: K, value: AgentPreset[K]) => {
      setEditDraft((prev) => {
        if (!prev) return prev;
        if (key === "modelProvider") {
          const provider = value as AgentPreset["modelProvider"];
          return {
            ...prev,
            modelProvider: provider,
            runtimeKind: isAnthropicBridgeProvider(provider) ? "claude-code" : prev.runtimeKind,
          };
        }
        if (key === "runtimeKind") {
          return { ...prev, runtimeKind: value as AgentPreset["runtimeKind"] };
        }
        return { ...prev, [key]: value };
      });
    };

    const updateMcpConfig = (value: McpDraft) => {
      setEditDraft((prev) => (prev ? { ...prev, mcps: value } : prev));
    };

    return (
      <>
        {error && (
          <div className="mx-5 mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}
        <div className="flex-1 overflow-y-auto">
          <AgentDetail
            key={`${editDraft.id}-${resetKey}`}
            agent={editDraft}
            roleOptions={roleOptions}
            testing={testing}
            testResult={testResult}
            onChange={updateAgentDraft}
            onMcpChange={updateMcpConfig}
            onTestConnection={handleTestConnection}
          />
        </div>

        {showFooter && (
          <div className="flex justify-end gap-2 border-t px-5 py-3">
            <Button variant="outline" size="sm" onClick={onBack} disabled={saving}>
              {tc("cancel")}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? tc("saving") : tc("save")}
            </Button>
          </div>
        )}

        <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>智能创建 Agent</DialogTitle>
              <DialogDescription>
                输入 Agent 的职责、使用场景和约束，系统会生成名称、描述和 Markdown 系统提示。
              </DialogDescription>
            </DialogHeader>
            <Textarea
              value={generatePrompt}
              onChange={(e) => setGeneratePrompt(e.target.value)}
              placeholder="例如：创建一个代码评审 Agent，专注发现 TypeScript/React 项目中的缺陷、回归风险和缺失测试。"
              className="min-h-32 text-sm"
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setGenerateOpen(false)} disabled={generating}>
                {tc("cancel")}
              </Button>
              <Button onClick={handleGenerateAgent} disabled={generating || !generatePrompt.trim()}>
                {generating ? "生成中..." : "生成"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  },
);
