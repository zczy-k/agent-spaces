"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { sdk } from "@/lib/sdk";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function SpeechSettingsTab() {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const [configs, setConfigs] = useState<
    Array<{ id: string; provider: string; label: string; enabled: boolean; credentials: Record<string, string> }>
  >([]);
  const [loading, setLoading] = useState(true);

  const loadConfigs = async () => {
    try {
      const data = await sdk.http.get<typeof configs>("/api/speech-recognition");
      setConfigs(data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    loadConfigs();
  }, []);

  const saveCredentials = async (id: string, credentials: Record<string, string>) => {
    await sdk.http.putVoid(`/api/speech-recognition/${id}`, { credentials });
  };

  const toggleEnabled = async (id: string, enabled: boolean) => {
    await sdk.http.putVoid(`/api/speech-recognition/${id}`, { enabled });
    setConfigs((prev) => prev.map((c) => (c.id === id ? { ...c, enabled } : c)));
  };

  const createConfig = async (provider: string) => {
    const cfg = await sdk.http.post<typeof configs[number]>("/api/speech-recognition", { provider, credentials: {} });
    setConfigs((prev) => [...prev, cfg]);
  };

  if (loading) return <div className="text-xs text-muted-foreground">{tc("loading")}</div>;

  const tencent = configs.find((c) => c.provider === "tencent");

  return (
    <div className="space-y-5">
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2.5 block">
          {t("speechDescription")}
        </label>

        <div className="space-y-3 p-3 border rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{t("speechTencent")}</span>
            {tencent && (
              <Switch
                checked={tencent.enabled !== false}
                onCheckedChange={(checked) => toggleEnabled(tencent.id, checked)}
              />
            )}
          </div>
          {tencent ? (
            <TencentCredentialForm configId={tencent.id} credentials={tencent.credentials} onSave={saveCredentials} />
          ) : (
            <Button variant="outline" size="sm" className="text-xs" onClick={() => createConfig("tencent")}>
              {t("speechAddConfig")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function TencentCredentialForm({
  configId,
  credentials: initial,
  onSave,
}: {
  configId: string;
  credentials: Record<string, string>;
  onSave: (id: string, credentials: Record<string, string>) => Promise<void>;
}) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const [appId, setAppId] = useState(initial.appId ?? "");
  const [secretId, setSecretId] = useState(initial.secretId ?? "");
  const [secretKey, setSecretKey] = useState(initial.secretKey ?? "");
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    await onSave(configId, { appId, secretId, secretKey });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">{t("speechAppId")}</Label>
        <Input className="h-7 text-xs" value={appId} onChange={(e) => setAppId(e.target.value)} placeholder="125922****" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">{t("speechSecretId")}</Label>
        <Input className="h-7 text-xs" value={secretId} onChange={(e) => setSecretId(e.target.value)} placeholder="SecretId" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">{t("speechSecretKey")}</Label>
        <Input
          type="password"
          className="h-7 text-xs"
          value={secretKey}
          onChange={(e) => setSecretKey(e.target.value)}
          placeholder="SecretKey"
        />
      </div>
      <Button size="sm" className="text-xs" onClick={handleSave}>
        {saved ? tc("saved") : tc("save")}
      </Button>
    </div>
  );
}
