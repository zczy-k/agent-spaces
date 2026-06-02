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
}

interface PreviewSkill {
  name: string;
  path: string;
  description: string;
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
  const [error, setError] = useState("");
  const [selectedProviders, setSelectedProviders] = useState<Set<string>>(new Set());
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/import/cc-switch/preview");
      const data = await res.json();
      if (data.error && !data.providers?.length && !data.skills?.length) {
        setError(data.error);
        setProviders([]);
        setSkills([]);
      } else {
        setProviders(data.providers || []);
        setSkills(data.skills || []);
        setSelectedProviders(new Set((data.providers || []).map((p: PreviewProvider) => p.sourceId)));
        setSelectedSkills(new Set((data.skills || []).map((s: PreviewSkill) => s.name)));
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
      };

      const res = await fetch("/api/import/cc-switch/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const result = await res.json();

      if (result.providers?.length) {
        const provRes = await fetch("/api/providers");
        if (provRes.ok) {
          useLLMStore.setState({ providers: await provRes.json() });
        }
      }

      const total = (result.providers?.length || 0) + (result.skills?.length || 0);
      toast.success(t("dataImportSuccess", { count: total }));
      setDialogOpen(false);
    } catch {
      toast.error(t("dataImportFailed"));
    } finally {
      setImporting(false);
    }
  }, [providers, skills, selectedProviders, selectedSkills, t]);

  const toggleProvider = (id: string) => {
    setSelectedProviders(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSkill = (name: string) => {
    setSelectedSkills(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const totalSelected = selectedProviders.size + selectedSkills.size;

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
            {providers.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("dataProviders")} ({providers.length})
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => {
                      const all = new Set(providers.map(p => p.sourceId));
                      setSelectedProviders(selectedProviders.size === providers.length ? new Set() : all);
                    }}
                  >
                    {selectedProviders.size === providers.length ? t("dataDeselectAll") : t("dataSelectAll")}
                  </Button>
                </div>
                <div className="space-y-1.5">
                  {providers.map(p => (
                    <label
                      key={p.sourceId}
                      className="flex items-start gap-2.5 rounded-md border px-3 py-2 cursor-pointer hover:bg-muted/50"
                    >
                      <input
                        type="checkbox"
                        checked={selectedProviders.has(p.sourceId)}
                        onChange={() => toggleProvider(p.sourceId)}
                        className="mt-0.5 size-4 rounded border-border accent-primary"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{p.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            {p.source}
                          </span>
                        </div>
                        {p.apiBase && (
                          <p className="text-xs text-muted-foreground truncate">{p.apiBase}</p>
                        )}
                        <p className="text-xs text-muted-foreground font-mono">
                          {maskKey(p.apiKey)}
                        </p>
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
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => {
                      const all = new Set(skills.map(s => s.name));
                      setSelectedSkills(selectedSkills.size === skills.length ? new Set() : all);
                    }}
                  >
                    {selectedSkills.size === skills.length ? t("dataDeselectAll") : t("dataSelectAll")}
                  </Button>
                </div>
                <div className="space-y-1.5">
                  {skills.map(s => (
                    <label
                      key={s.name}
                      className="flex items-start gap-2.5 rounded-md border px-3 py-2 cursor-pointer hover:bg-muted/50"
                    >
                      <input
                        type="checkbox"
                        checked={selectedSkills.has(s.name)}
                        onChange={() => toggleSkill(s.name)}
                        className="mt-0.5 size-4 rounded border-border accent-primary"
                      />
                      <div className="min-w-0 flex-1">
                        <span className="text-sm font-medium">{s.name}</span>
                        {s.description && (
                          <p className="text-xs text-muted-foreground truncate">{s.description}</p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {!error && providers.length === 0 && skills.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">{t("dataNoData")}</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
              {t("dataCancel")}
            </Button>
            <Button
              size="sm"
              onClick={handleImport}
              disabled={importing || totalSelected === 0}
            >
              {importing && <Loader2 className="size-3.5 mr-1.5 animate-spin" />}
              {t("dataImport")} ({totalSelected})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
