"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Import, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useLLMStore } from "@/stores/llm";

interface PreviewProvider {
  sourceId: string;
  name: string;
  apiBase: string;
  apiKey: string;
  source: string;
  websiteUrl?: string;
  category?: string;
  models: string[];
}

interface PreviewSkill {
  name: string;
  path: string;
  description: string;
}

interface PreviewMcp {
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
}

function maskKey(key: string): string {
  if (!key || key.length < 12) return key ? "***" : "";
  return key.slice(0, 6) + "..." + key.slice(-4);
}

export function DataTab() {
  const t = useTranslations("settings");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [providers, setProviders] = useState<PreviewProvider[]>([]);
  const [skills, setSkills] = useState<PreviewSkill[]>([]);
  const [mcps, setMcps] = useState<PreviewMcp[]>([]);
  const [error, setError] = useState("");
  const [selectedProviders, setSelectedProviders] = useState<Set<string>>(new Set());
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());
  const [selectedMcps, setSelectedMcps] = useState<Set<string>>(new Set());

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/import/cc-switch/preview");
      const data = await res.json();
      if (data.error && !data.providers?.length && !data.skills?.length && !data.mcps?.length) {
        setError(data.error);
        setProviders([]);
        setSkills([]);
        setMcps([]);
      } else {
        const pv = data.providers || [];
        const sk = data.skills || [];
        const mc = data.mcps || [];
        setProviders(pv);
        setSkills(sk);
        setMcps(mc);
        setSelectedProviders(new Set(pv.map((p: PreviewProvider) => p.sourceId)));
        setSelectedSkills(new Set(sk.map((s: PreviewSkill) => s.name)));
        setSelectedMcps(new Set(mc.map((m: PreviewMcp) => m.name)));
      }
      setDialogOpen(true);
    } catch {
      setError("Failed to load cc-switch data");
      setDialogOpen(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleImport = useCallback(async () => {
    setImporting(true);
    try {
      const body = {
        providers: providers.filter(p => selectedProviders.has(p.sourceId)),
        skills: skills.filter(s => selectedSkills.has(s.name)),
        mcps: mcps.filter(m => selectedMcps.has(m.name)),
      };

      const res = await fetch("/api/import/cc-switch/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const result = await res.json();

      // refresh LLM store if providers/models were imported
      if (result.providers?.length || result.models?.length) {
        const [provRes, modelRes] = await Promise.all([
          fetch("/api/providers"),
          fetch("/api/models"),
        ]);
        const updates: Record<string, unknown> = {};
        if (provRes.ok) updates.providers = await provRes.json();
        if (modelRes.ok) updates.models = await modelRes.json();
        if (Object.keys(updates).length) useLLMStore.setState(updates);
      }

      const total = (result.providers?.filter((s: string) => !s.includes("skipped")).length || 0)
        + (result.models?.length || 0)
        + (result.skills?.length || 0)
        + (result.mcps?.length || 0);
      toast.success(t("dataImportSuccess", { count: total }));
      setDialogOpen(false);
    } catch {
      toast.error(t("dataImportFailed"));
    } finally {
      setImporting(false);
    }
  }, [providers, skills, mcps, selectedProviders, selectedSkills, selectedMcps, t]);

  const toggleSet = (set: Set<string>, id: string) => {
    const next = new Set(set);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  };

  const toggleAll = (items: Array<{ sourceId?: string; name: string }>, getter: () => Set<string>, setter: (s: Set<string>) => void) => {
    const key = (item: { sourceId?: string; name: string }) => item.sourceId || item.name;
    const all = new Set(items.map(key));
    setter(getter().size === items.length ? new Set() : all);
  };

  const totalSelected = selectedProviders.size + selectedSkills.size + selectedMcps.size;

  return (
    <div className="space-y-5">
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2.5 block">
          {t("dataTitle")}
        </label>
        <p className="text-sm text-muted-foreground mb-4">{t("dataDescription")}</p>
        <Button variant="outline" size="sm" onClick={loadPreview} disabled={loading}>
          {loading ? (
            <Loader2 className="size-3.5 mr-1.5 animate-spin" />
          ) : (
            <Import className="size-3.5 mr-1.5" />
          )}
          {loading ? t("dataLoading") : t("dataImportFromCcSwitch")}
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[75vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base">{t("dataImportTitle")}</DialogTitle>
            <DialogDescription className="text-xs">{t("dataImportDesc")}</DialogDescription>
          </DialogHeader>

          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-y-auto space-y-4 py-2">
            {/* Providers */}
            {providers.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("dataProviders")} ({providers.length})
                  </h4>
                  <Button
                    variant="ghost" size="sm" className="h-6 text-xs"
                    onClick={() => toggleAll(providers, () => selectedProviders, setSelectedProviders)}
                  >
                    {selectedProviders.size === providers.length ? t("dataDeselectAll") : t("dataSelectAll")}
                  </Button>
                </div>
                <div className="space-y-1.5">
                  {providers.map(p => (
                    <label key={p.sourceId} className="flex items-start gap-2.5 rounded-md border px-3 py-2 cursor-pointer hover:bg-muted/50">
                      <input
                        type="checkbox" id={`prov-${p.sourceId}`}
                        checked={selectedProviders.has(p.sourceId)}
                        onChange={() => setSelectedProviders(s => toggleSet(s, p.sourceId))}
                        className="mt-0.5 size-4 rounded border-border accent-primary"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{p.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{p.source}</span>
                        </div>
                        {p.apiBase && <p className="text-xs text-muted-foreground truncate">{p.apiBase}</p>}
                        <p className="text-xs text-muted-foreground font-mono">{maskKey(p.apiKey)}</p>
                        {p.models.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {p.models.map(m => (
                              <span key={m} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">{m}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* MCP Servers */}
            {mcps.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("dataMcps")} ({mcps.length})
                  </h4>
                  <Button
                    variant="ghost" size="sm" className="h-6 text-xs"
                    onClick={() => toggleAll(mcps, () => selectedMcps, setSelectedMcps)}
                  >
                    {selectedMcps.size === mcps.length ? t("dataDeselectAll") : t("dataSelectAll")}
                  </Button>
                </div>
                <div className="space-y-1.5">
                  {mcps.map(m => (
                    <label key={m.name} className="flex items-start gap-2.5 rounded-md border px-3 py-2 cursor-pointer hover:bg-muted/50">
                      <input
                        type="checkbox" id={`mcp-${m.name}`}
                        checked={selectedMcps.has(m.name)}
                        onChange={() => setSelectedMcps(s => toggleSet(s, m.name))}
                        className="mt-0.5 size-4 rounded border-border accent-primary"
                      />
                      <div className="min-w-0 flex-1">
                        <span className="text-sm font-medium">{m.name}</span>
                        <p className="text-xs text-muted-foreground font-mono truncate">{m.command} {m.args.join(" ")}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Skills */}
            {skills.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("dataSkills")} ({skills.length})
                  </h4>
                  <Button
                    variant="ghost" size="sm" className="h-6 text-xs"
                    onClick={() => toggleAll(skills, () => selectedSkills, setSelectedSkills)}
                  >
                    {selectedSkills.size === skills.length ? t("dataDeselectAll") : t("dataSelectAll")}
                  </Button>
                </div>
                <div className="space-y-1.5">
                  {skills.map(s => (
                    <label key={s.name} className="flex items-start gap-2.5 rounded-md border px-3 py-2 cursor-pointer hover:bg-muted/50">
                      <input
                        type="checkbox" id={`skill-${s.name}`}
                        checked={selectedSkills.has(s.name)}
                        onChange={() => setSelectedSkills(sk => toggleSet(sk, s.name))}
                        className="mt-0.5 size-4 rounded border-border accent-primary"
                      />
                      <div className="min-w-0 flex-1">
                        <span className="text-sm font-medium">{s.name}</span>
                        {s.description && <p className="text-xs text-muted-foreground truncate">{s.description}</p>}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {!error && providers.length === 0 && skills.length === 0 && mcps.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">{t("dataNoData")}</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
              {t("dataCancel")}
            </Button>
            <Button size="sm" onClick={handleImport} disabled={importing || totalSelected === 0}>
              {importing && <Loader2 className="size-3.5 mr-1.5 animate-spin" />}
              {t("dataImport")} ({totalSelected})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
