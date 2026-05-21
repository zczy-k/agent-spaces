"use client";

import { useState, useCallback, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import { Sun, Moon, Monitor, RotateCcw } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { isNativeEnvironment } from "@/lib/native-notification";

export function AppearanceTab() {
  const { theme, setTheme } = useTheme();
  const t = useTranslations("settings");

  const [zoom, setZoom] = useState(() => {
    if (typeof window === "undefined") return 100;
    const saved = localStorage.getItem("pageZoom");
    const value = saved ? Number(saved) : 100;
    return value >= 50 && value <= 200 ? value : 100;
  });
  const [showZoomSetting, setShowZoomSetting] = useState(false);
  const [showTabs, setShowTabs] = useState(() => {
    if (typeof window === "undefined") return true;
    const saved = localStorage.getItem("showWorkspaceTabs");
    return saved === null ? true : saved !== "false";
  });
  const [autoActivate, setAutoActivate] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("autoActivateWorkspace") === "true";
  });

  const applyZoom = useCallback((value: number) => {
    localStorage.setItem("pageZoom", String(value));
    setZoom(value);
    window.dispatchEvent(new CustomEvent("zoom-change", { detail: value }));
  }, []);

  const themeOptions = [
    { value: "light" as const, label: t("themeLight"), icon: Sun },
    { value: "dark" as const, label: t("themeDark"), icon: Moon },
    { value: "system" as const, label: t("themeSystem"), icon: Monitor },
  ];

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setShowZoomSetting(isNativeEnvironment());
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2.5 block">
          {t("theme")}
        </label>
        <div className="grid grid-cols-3 gap-2">
          {themeOptions.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setTheme(value)}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-lg border p-3 text-sm transition-colors hover:bg-muted/50",
                theme === value && "border-primary bg-primary/5 text-primary",
              )}
            >
              <Icon className="size-5" />
              <span className="text-xs font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {t("showWorkspaceTabs")}
        </label>
        <Switch
          size="sm"
          checked={showTabs}
          onCheckedChange={(checked) => {
            setShowTabs(checked);
            localStorage.setItem("showWorkspaceTabs", String(checked));
            window.dispatchEvent(new CustomEvent("workspace-tabs-visibility", { detail: checked }));
          }}
        />
      </div>

      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {t("autoActivateWorkspace")}
        </label>
        <Switch
          size="sm"
          checked={autoActivate}
          onCheckedChange={(checked) => {
            setAutoActivate(checked);
            localStorage.setItem("autoActivateWorkspace", String(checked));
          }}
        />
      </div>

      {showZoomSetting && (
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2.5 block">
            {t("zoom")}
          </label>
          <div className="flex items-center gap-3">
            <Slider
              min={50}
              max={200}
              step={10}
              value={zoom}
              onValueChange={(v) => applyZoom(Array.isArray(v) ? v[0] : v)}
              className="flex-1"
            />
            <span className="text-xs font-mono tabular-nums w-10 text-right">{zoom}%</span>
            <button
              type="button"
              onClick={() => applyZoom(100)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title={t("zoomReset")}
            >
              <RotateCcw className="size-3.5" />
            </button>
          </div>
        </div>
      )}

      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2.5 block">
          {t("layout")}
        </label>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => window.dispatchEvent(new CustomEvent("reset-layout"))}
        >
          <RotateCcw className="size-3.5" />
          {t("resetLayout")}
        </Button>
      </div>
    </div>
  );
}
