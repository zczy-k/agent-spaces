"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { sdk } from "@/lib/sdk";

const NPM_REGISTRY_PRESETS = [
  { label: "淘宝源", value: "https://registry.npmmirror.com" },
  { label: "npm 官方", value: "https://registry.npmjs.org" },
  { label: "腾讯云", value: "https://mirrors.cloud.tencent.com/npm/" },
  { label: "华为云", value: "https://repo.huaweicloud.com/repository/npm/" },
];

const CUSTOM_PRESET = "__custom__";

export function NpmSettingsTab() {
  const [registry, setRegistry] = useState(NPM_REGISTRY_PRESETS[0].value);
  const [proxy, setProxy] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const presetValue = useMemo(() => {
    return NPM_REGISTRY_PRESETS.some((preset) => preset.value === registry) ? registry : CUSTOM_PRESET;
  }, [registry]);

  useEffect(() => {
    let cancelled = false;
    sdk.npmSettings.get()
      .then((settings) => {
        if (cancelled) return;
        setRegistry(settings.registry || NPM_REGISTRY_PRESETS[0].value);
        setProxy(settings.proxy || "");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const next = await sdk.npmSettings.update({ registry, proxy });
      setRegistry(next.registry);
      setProxy(next.proxy || "");
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <label className="mb-2.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
          NPM 源
        </label>
        <div className="flex gap-2">
          <Select
            value={presetValue}
            onValueChange={(value) => {
              if (value && value !== CUSTOM_PRESET) setRegistry(value);
            }}
            disabled={loading}
          >
            <SelectTrigger className="h-8 w-[140px] text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NPM_REGISTRY_PRESETS.map((preset) => (
                <SelectItem key={preset.value} value={preset.value}>{preset.label}</SelectItem>
              ))}
              <SelectItem value={CUSTOM_PRESET}>自定义</SelectItem>
            </SelectContent>
          </Select>
          <Input
            value={registry}
            onChange={(event) => {
              setRegistry(event.target.value);
              setSaved(false);
            }}
            placeholder={NPM_REGISTRY_PRESETS[0].value}
            className="h-8 flex-1 text-sm"
            disabled={loading}
          />
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          用于安装插件 package.json 里的 npm 依赖，默认使用淘宝源。
        </p>
      </div>

      <div>
        <label className="mb-2.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Proxy
        </label>
        <Input
          value={proxy}
          onChange={(event) => {
            setProxy(event.target.value);
            setSaved(false);
          }}
          placeholder="http://127.0.0.1:7890"
          className="h-8 text-sm"
          disabled={loading}
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          可选。保存后会同时写入 npm 的 proxy 和 https-proxy。
        </p>
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={handleSave} disabled={loading || saving || !registry.trim()}>
          {saved ? "已保存" : saving ? "保存中..." : "保存"}
        </Button>
      </div>
    </div>
  );
}
