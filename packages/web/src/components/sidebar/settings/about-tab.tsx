"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { RefreshCw, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

const AUTO_CHECK_KEY = "agent-spaces-auto-check-update";

interface VersionInfo {
  local: string;
  latest: string | null;
  updateAvailable?: boolean;
  dev?: boolean;
}

export function AboutTab() {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const [version, setVersion] = useState<VersionInfo | null>(null);
  const [platform, setPlatform] = useState("");
  const [checking, setChecking] = useState(false);
  const [autoCheck, setAutoCheck] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(AUTO_CHECK_KEY) !== "false";
  });
  const [confirmOpen, setConfirmOpen] = useState(false);

  const loadVersion = useCallback(async () => {
    try {
      const res = await fetch("/api/version");
      if (res.ok) {
        const data = await res.json();
        setVersion(data);
      }
    } catch {}
  }, []);

  useEffect(() => {
    // Load basic info
    fetch("/api/health")
      .then(r => r.ok ? r.json() : {})
      .then((d: { platform?: string }) => setPlatform(d.platform ?? ""))
      .catch(() => {});

    loadVersion();
  }, [loadVersion]);

  // Auto-check on mount
  useEffect(() => {
    if (!autoCheck) return;
    fetch("/api/version/check")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.updateAvailable) {
          setVersion(data);
        }
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCheck = useCallback(async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/version/check");
      if (res.ok) {
        const data = await res.json();
        setVersion(data);
        if (!data.updateAvailable) {
          toast.success(t("aboutUpToDate"));
        }
      }
    } catch {
      toast.error(t("aboutCheckFailed"));
    } finally {
      setChecking(false);
    }
  }, [t]);

  const handleUpdate = useCallback(async () => {
    setConfirmOpen(false);
    toast.info(t("aboutUpdating"));
    try {
      await fetch("/api/version/update", { method: "POST" });
    } catch {
      // Expected: server kills itself, request will fail
    }
  }, [t]);

  const localVersion = version?.local ?? "-";
  const latestVersion = version?.latest;
  const isDev = version?.dev === true;
  const updateAvailable = !isDev && (version?.updateAvailable ?? false);

  return (
    <div className="space-y-5">
      {/* Header: Logo + App Name */}
      <div className="flex items-center gap-3 pb-4 border-b">
        <img src="/favicon.ico" alt="Logo" className="size-10 shrink-0" />
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">Agent Spaces</h3>
          <p className="text-xs text-muted-foreground">v{localVersion}</p>
        </div>
      </div>

      {/* Info Section */}
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2.5 block">
          {t("aboutInfo")}
        </label>
        <div className="text-sm space-y-1.5">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("aboutVersion")}</span>
            <span className="font-mono">{localVersion}</span>
          </div>
          {latestVersion && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("aboutLatestVersion")}</span>
              <span className="font-mono">{latestVersion}</span>
            </div>
          )}
          {platform && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("aboutPlatform")}</span>
              <span>{platform}</span>
            </div>
          )}
        </div>
      </div>

      {/* Links */}
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2.5 block">
          {t("aboutLinks")}
        </label>
        <a
          href="https://github.com/hunmer/agent_spaces"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary hover:underline flex items-center gap-1.5"
        >
          <svg className="size-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>
          GitHub
          <ExternalLink className="size-3" />
        </a>
      </div>

      {/* Updates (production only) */}
      {!isDev && (
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2.5 block">
            {t("aboutUpdates")}
          </label>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">{t("aboutAutoCheck")}</span>
              <Switch
                size="sm"
                checked={autoCheck}
                onCheckedChange={(checked: boolean) => {
                  setAutoCheck(checked);
                  localStorage.setItem(AUTO_CHECK_KEY, String(checked));
                }}
              />
            </div>
            <Button variant="outline" size="sm" onClick={handleCheck} disabled={checking}>
              <RefreshCw className={cn("size-3.5 mr-1.5", checking && "animate-spin")} />
              {checking ? t("aboutChecking") : t("aboutCheckNow")}
            </Button>
            {updateAvailable && latestVersion && (
              <div className="rounded-lg border p-3 text-sm space-y-2">
                <p className="text-muted-foreground">
                  {t("aboutNewVersion", { version: latestVersion })}
                </p>
                <Button size="sm" onClick={() => setConfirmOpen(true)}>
                  {t("aboutUpdateNow")}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {isDev && (
        <p className="text-xs text-muted-foreground">{t("aboutDevMode")}</p>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("aboutUpdateConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("aboutUpdateConfirmDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleUpdate}>
              {t("aboutUpdateNow")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
