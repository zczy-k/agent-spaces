"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { getStoreApiBase, setStoreApiBase } from "@/lib/agent-store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";

const PRESETS = [
  { label: "GitHub (Proxy)", url: "https://gh-proxy.org/https://github.com/hunmer/agent-spaces/raw/refs/heads/main/packages/templates/" },
  { label: "GitHub (Direct)", url: "https://github.com/hunmer/agent-spaces/raw/refs/heads/main/packages/templates/" },
  { label: "Local (8080)", url: "http://localhost:3101/" },
];

export function AgentStoreTab() {
  const [url, setUrl] = useState(() => getStoreApiBase());
  const [saved, setSaved] = useState(false);
  const t = useTranslations("settings");

  const handleSave = (value?: string) => {
    const finalUrl = value ?? url;
    setUrl(finalUrl);
    setStoreApiBase(finalUrl);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2.5 block">
          {t("storeApiBase")}
        </label>
        <div className="flex gap-2">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={PRESETS[0].url}
            className="text-sm"
          />
          <Button size="sm" onClick={() => handleSave()}>
            {saved ? "✓" : t("save")}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">
          {t("storeApiBaseDesc")}
        </p>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
          {t("storeApiPresets")}
        </label>
        <div className="space-y-1.5">
          {PRESETS.map((preset) => (
            <button
              key={preset.url}
              onClick={() => handleSave(preset.url)}
              className={`w-full flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-left transition-colors ${
                url === preset.url
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "hover:bg-muted text-foreground"
              }`}
            >
              <Globe className="h-3.5 w-3.5 shrink-0 opacity-60" />
              <span className="font-medium">{preset.label}</span>
              <span className="text-xs text-muted-foreground truncate ml-auto max-w-[200px]">
                {preset.url}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
