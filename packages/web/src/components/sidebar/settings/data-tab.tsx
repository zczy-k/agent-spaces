"use client";

import { useState, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Import, Loader2, Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { sdk } from "@/lib/sdk";
import { useLLMStore } from "@/stores/llm";

// --- cc-switch import types ---
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

// --- backup import types ---
interface ImportCategory {
  key: string;
  label: string;
  group: string;
  size: number;
  type: "file" | "directory";
  details: string;
}

type ImportResult = "ok" | "skipped" | "error";

function maskKey(key: string): string {
  if (!key || key.length < 12) return key ? "***" : "";
  return key.slice(0, 6) + "..." + key.slice(-4);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const GROUP_ORDER = ["config", "ai", "content", "customization", "billing"] as const;

export function DataTab() {
  const t = useTranslations("settings");

  // --- cc-switch import state ---
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

  // --- backup export/import state ---
  const [exporting, setExporting] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [importing2, setImporting2] = useState(false);
  const [importSessionId, setImportSessionId] = useState("");
  const [importCategories, setImportCategories] = useState<ImportCategory[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [importError, setImportError] = useState("");
  const [importResults, setImportResults] = useState<Record<string, ImportResult> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ===================== cc-switch import =====================

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await sdk.data.ccSwitchPreview() as { error?: string; providers?: PreviewProvider[]; skills?: PreviewSkill[]; mcps?: PreviewMcp[] };
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

      const result = await sdk.data.ccSwitchExecute(body);

      if (result.providers?.length || result.models?.length) {
        const [providers, models] = await Promise.all([
          sdk.llm.listProviders(),
          sdk.llm.listModels(),
        ]);
        const updates: Record<string, unknown> = {};
        updates.providers = providers;
        updates.models = models;
        useLLMStore.setState(updates);
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

  // ===================== backup export =====================

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const res = await sdk.data.exportZip();
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `agent-spaces-backup-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t("dataExportSuccess"));
    } catch {
      toast.error(t("dataExportFailed"));
    } finally {
      setExporting(false);
    }
  }, [t]);

  // ===================== backup import =====================

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // reset input so same file can be re-selected
    e.target.value = "";

    setUploading(true);
    setImportError("");
    setImportResults(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const data = await sdk.data.importPreview(formData) as { error?: string; sessionId?: string; categories?: ImportCategory[] };
      if (data.error) {
        setImportError(data.error);
        setImportCategories([]);
        setImportSessionId("");
      } else {
        setImportSessionId(data.sessionId ?? "");
        setImportCategories(data.categories ?? []);
        setSelectedCategories(new Set((data.categories ?? []).map((c: ImportCategory) => c.key)));
      }
      setImportDialogOpen(true);
    } catch {
      setImportError("Failed to upload file");
      setImportCategories([]);
      setImportDialogOpen(true);
    } finally {
      setUploading(false);
    }
  }, []);

  const handleImportExecute = useCallback(async () => {
    setImporting2(true);
    try {
      const data = await sdk.data.importExecute(importSessionId, [...selectedCategories]) as { error?: string; results?: Record<string, ImportResult> };
      if (data.error) {
        toast.error(data.error);
      } else {
        setImportResults(data.results ?? null);
        toast.success(t("dataImportComplete"));
      }
    } catch {
      toast.error(t("dataImportFailed"));
    } finally {
      setImporting2(false);
    }
  }, [importSessionId, selectedCategories, t]);

  const toggleCategory = (key: string) => {
    setSelectedCategories(prev => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      return next;
    });
  };

  const toggleGroupAll = (group: string) => {
    const groupKeys = importCategories.filter(c => c.group === group).map(c => c.key);
    const allSelected = groupKeys.every(k => selectedCategories.has(k));
    setSelectedCategories(prev => {
      const next = new Set(prev);
      groupKeys.forEach(k => allSelected ? next.delete(k) : next.add(k));
      return next;
    });
  };

  const groupLabel = (group: string): string => {
    switch (group) {
      case "config": return t("dataCategoryConfig");
      case "ai": return t("dataCategoryAI");
      case "content": return t("dataCategoryContent");
      case "customization": return t("dataCategoryCustomization");
      case "billing": return t("dataCategoryBilling");
      default: return group;
    }
  };

  // Group categories for display
  const groupedCategories = GROUP_ORDER.map(group => ({
    group,
    label: groupLabel(group),
    items: importCategories.filter(c => c.group === group),
  })).filter(g => g.items.length > 0);

  return (
    <div className="space-y-6">
      {/* Backup export / import */}
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2.5 block">
          {t("dataExportTitle")}
        </label>
        <p className="text-sm text-muted-foreground mb-3">{t("dataExportDesc")}</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
            {exporting ? (
              <Loader2 className="size-3.5 mr-1.5 animate-spin" />
            ) : (
              <Download className="size-3.5 mr-1.5" />
            )}
            {exporting ? t("dataExporting") : t("dataExport")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? (
              <Loader2 className="size-3.5 mr-1.5 animate-spin" />
            ) : (
              <Upload className="size-3.5 mr-1.5" />
            )}
            {uploading ? t("dataUploading") : t("dataImportBackup")}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>
      </div>

      {/* cc-switch import */}
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2.5 block">
          {t("dataTitle")}
        </label>
        <p className="text-sm text-muted-foreground mb-3">{t("dataDescription")}</p>
        <Button variant="outline" size="sm" onClick={loadPreview} disabled={loading}>
          {loading ? (
            <Loader2 className="size-3.5 mr-1.5 animate-spin" />
          ) : (
            <Import className="size-3.5 mr-1.5" />
          )}
          {loading ? t("dataLoading") : t("dataImportFromCcSwitch")}
        </Button>
      </div>

      {/* Backup import dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[75vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base">{t("dataImportBackupTitle")}</DialogTitle>
            <DialogDescription className="text-xs">{t("dataImportBackupDialogDesc")}</DialogDescription>
          </DialogHeader>

          {importError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {importError}
            </div>
          )}

          {/* Results view */}
          {importResults ? (
            <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 py-2">
              {importCategories.map(cat => {
                const result = importResults[cat.key];
                if (!result) return null;
                const colors: Record<ImportResult, string> = {
                  ok: "text-green-600 bg-green-50",
                  skipped: "text-muted-foreground bg-muted",
                  error: "text-destructive bg-destructive/10",
                };
                return (
                  <div key={cat.key} className="flex items-center justify-between rounded-md border px-3 py-2">
                    <span className="text-sm">{cat.label}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${colors[result]}`}>
                      {result === "ok" ? t("dataImportResultOk") : result === "skipped" ? t("dataImportResultSkipped") : t("dataImportResultError")}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto space-y-4 py-2">
              {groupedCategories.length === 0 && !importError && (
                <p className="text-sm text-muted-foreground text-center py-8">{t("dataNoCategories")}</p>
              )}
              {groupedCategories.map(({ group, label, items }) => (
                <div key={group}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</h4>
                    <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => toggleGroupAll(group)}>
                      {items.every(c => selectedCategories.has(c.key)) ? t("dataDeselectAll") : t("dataSelectAll")}
                    </Button>
                  </div>
                  <div className="space-y-1.5">
                    {items.map(cat => (
                      <label key={cat.key} className="flex items-center gap-2.5 rounded-md border px-3 py-2 cursor-pointer hover:bg-muted/50">
                        <input
                          type="checkbox"
                          checked={selectedCategories.has(cat.key)}
                          onChange={() => toggleCategory(cat.key)}
                          className="size-4 rounded border-border accent-primary"
                        />
                        <span className="text-sm flex-1">{cat.label}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {cat.type === "directory" ? cat.details : formatBytes(cat.size)}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(false)}>
              {t("dataCancel")}
            </Button>
            {!importResults && (
              <Button size="sm" onClick={handleImportExecute} disabled={importing2 || selectedCategories.size === 0}>
                {importing2 && <Loader2 className="size-3.5 mr-1.5 animate-spin" />}
                {t("dataImport")} ({selectedCategories.size})
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* cc-switch import dialog (unchanged) */}
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
