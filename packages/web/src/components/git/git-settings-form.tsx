"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { sdk } from '@/lib/sdk';

interface GitSettingsFormProps {
  scope: "global" | "local";
  workspaceId?: string;
}

export function GitSettingsForm({ scope, workspaceId }: GitSettingsFormProps) {
  const t = useTranslations("git.settings");
  const tc = useTranslations("common");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [proxy, setProxy] = useState("");
  const [remoteUrl, setRemoteUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const data = scope === "global"
        ? await sdk.http.get<{ name?: string; email?: string; proxy?: string }>("/api/git-config")
        : workspaceId
          ? await sdk.git.config(workspaceId)
          : { name: "", email: "", proxy: "" };
      setName(data.name ?? "");
      setEmail(data.email ?? "");
      setProxy(data.proxy ?? "");
      if (scope === "local" && workspaceId) {
        const url = await sdk.git.remoteUrl(workspaceId);
        setRemoteUrl(url ?? "");
      }
    } catch {}
    setLoading(false);
  }, [scope, workspaceId]);

  useEffect(() => {
    loadConfig();
  }, [scope, workspaceId, loadConfig]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const configUrl =
        scope === "global"
          ? "/api/git-config"
          : `/api/workspaces/${workspaceId}/git/config`;
      try {
        if (scope === "global") {
          await sdk.http.postVoid("/api/git-config", { name, email, proxy });
        } else if (workspaceId) {
          await sdk.git.updateConfig(workspaceId, { name, email, proxy });
        }
      } catch {
        toast.error(t("saveFailed"));
        setSaving(false);
        return;
      }
      if (scope === "local" && workspaceId && remoteUrl) {
        await sdk.git.addRemote(workspaceId, "origin", remoteUrl);
      }
      toast.success(t("saved"));
    } catch {
      toast.error(t("saveFailed"));
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="text-xs text-muted-foreground">{t("loading")}</div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        {scope === "global" ? t("globalScopeDescription") : t("localScopeDescription")}
      </p>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">{t("name")}</Label>
        <Input
          className="h-7 text-xs"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("namePlaceholder")}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">{t("email")}</Label>
        <Input
          className="h-7 text-xs"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("emailPlaceholder")}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">{t("proxy")}</Label>
        <Input
          className="h-7 text-xs"
          value={proxy}
          onChange={(e) => setProxy(e.target.value)}
          placeholder={t("proxyPlaceholder")}
        />
      </div>
      {scope === "local" && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t("remoteUrl")}</Label>
          <Input
            className="h-7 text-xs"
            value={remoteUrl}
            onChange={(e) => setRemoteUrl(e.target.value)}
            placeholder={t("remoteUrlPlaceholder")}
          />
        </div>
      )}
      <Button size="sm" className="text-xs" onClick={handleSave} disabled={saving}>
        {saving ? tc("loading") : tc("save")}
      </Button>
    </div>
  );
}
