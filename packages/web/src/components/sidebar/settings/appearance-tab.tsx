"use client";

import { useState, useCallback, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import { Sun, Moon, Monitor, RotateCcw, Plus } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { isNativeEnvironment } from "@/lib/native-notification";
import { SearchSelect } from "@/components/ui/search-select";
import { fetchWithAuth } from "@/lib/auth";
import { CustomFontDialog } from "./custom-font-dialog";

const STYLE_STORAGE_KEY = "theme-style";
const STYLE_CUSTOM_CSS_KEY = "theme-style-custom-css";
const STYLE_STYLE_ID = "theme-style-override";

const THEME_STYLES: Record<string, string> = {
  mira: `:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --chart-1: oklch(0.87 0 0);
  --chart-2: oklch(0.556 0 0);
  --chart-3: oklch(0.439 0 0);
  --chart-4: oklch(0.371 0 0);
  --chart-5: oklch(0.269 0 0);
  --radius: 0.625rem;
  --sidebar: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0.145 0 0);
  --sidebar-primary: oklch(0.205 0 0);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.97 0 0);
  --sidebar-accent-foreground: oklch(0.205 0 0);
  --sidebar-border: oklch(0.922 0 0);
  --sidebar-ring: oklch(0.708 0 0);
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.205 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.205 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.922 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.556 0 0);
  --chart-1: oklch(0.87 0 0);
  --chart-2: oklch(0.556 0 0);
  --chart-3: oklch(0.439 0 0);
  --chart-4: oklch(0.371 0 0);
  --chart-5: oklch(0.269 0 0);
  --sidebar: oklch(0.205 0 0);
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: oklch(0.488 0.243 264.376);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.269 0 0);
  --sidebar-accent-foreground: oklch(0.985 0 0);
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: oklch(0.556 0 0);
}`,
  lyra: `:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --chart-1: oklch(0.87 0 0);
  --chart-2: oklch(0.556 0 0);
  --chart-3: oklch(0.439 0 0);
  --chart-4: oklch(0.371 0 0);
  --chart-5: oklch(0.269 0 0);
  --radius: 0;
  --sidebar: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0.145 0 0);
  --sidebar-primary: oklch(0.205 0 0);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.97 0 0);
  --sidebar-accent-foreground: oklch(0.205 0 0);
  --sidebar-border: oklch(0.922 0 0);
  --sidebar-ring: oklch(0.708 0 0);
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.205 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.205 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.922 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.556 0 0);
  --chart-1: oklch(0.87 0 0);
  --chart-2: oklch(0.556 0 0);
  --chart-3: oklch(0.439 0 0);
  --chart-4: oklch(0.371 0 0);
  --chart-5: oklch(0.269 0 0);
  --sidebar: oklch(0.205 0 0);
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: oklch(0.488 0.243 264.376);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.269 0 0);
  --sidebar-accent-foreground: oklch(0.985 0 0);
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: oklch(0.556 0 0);
}`,
  rhea: `:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --chart-1: oklch(0.87 0 0);
  --chart-2: oklch(0.556 0 0);
  --chart-3: oklch(0.439 0 0);
  --chart-4: oklch(0.371 0 0);
  --chart-5: oklch(0.269 0 0);
  --radius: 0.625rem;
  --sidebar: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0.145 0 0);
  --sidebar-primary: oklch(0.205 0 0);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.97 0 0);
  --sidebar-accent-foreground: oklch(0.205 0 0);
  --sidebar-border: oklch(0.922 0 0);
  --sidebar-ring: oklch(0.708 0 0);
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.205 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.205 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.922 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.556 0 0);
  --chart-1: oklch(0.87 0 0);
  --chart-2: oklch(0.556 0 0);
  --chart-3: oklch(0.439 0 0);
  --chart-4: oklch(0.371 0 0);
  --chart-5: oklch(0.269 0 0);
  --sidebar: oklch(0.205 0 0);
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: oklch(0.488 0.243 264.376);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.269 0 0);
  --sidebar-accent-foreground: oklch(0.985 0 0);
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: oklch(0.556 0 0);
}`,
};

function applyThemeStyle(css: string) {
  let el = document.getElementById(STYLE_STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = STYLE_STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = css;
}

function removeThemeStyle() {
  document.getElementById(STYLE_STYLE_ID)?.remove();
}

const BUILTIN_FONTS = [
  { value: "", label: "Default" },
  { value: "DM Sans", label: "DM Sans" },
  { value: "Inter", label: "Inter" },
  { value: "Roboto", label: "Roboto" },
  { value: "system-ui", label: "System UI" },
  { value: "Arial", label: "Arial" },
  { value: "Helvetica", label: "Helvetica" },
  { value: "Georgia", label: "Georgia" },
  { value: "Times New Roman", label: "Times New Roman" },
  { value: "Courier New", label: "Courier New" },
  { value: "Menlo", label: "Menlo" },
  { value: "monospace", label: "Monospace" },
];

const STORAGE_KEY = "customFont";
const CUSTOM_FONTS_KEY = "customFonts";
const FONT_VARIABLES = ["--font-app", "--font-sans", "--font-heading", "--font-mid", "--font-mono"];
const DEFAULT_FONT_FAMILY = `"Helvetica Neue", Helvetica, Arial, sans-serif`;

interface CustomFont {
  name: string;
  url: string;
}

function getFontFamily(value: string, customFonts: CustomFont[]) {
  if (!value) return DEFAULT_FONT_FAMILY;
  const builtin = BUILTIN_FONTS.find(f => f.value === value);
  if (builtin) return value;
  const custom = customFonts.find(f => f.name === value);
  if (custom) return `"${getCustomFontFamilyName(value)}"`;
  return value;
}

function applyFont(value: string, customFonts: CustomFont[]) {
  const family = getFontFamily(value, customFonts);
  document.documentElement.dataset.customFont = value ? "true" : "false";
  for (const variable of FONT_VARIABLES) {
    document.documentElement.style.setProperty(variable, family);
  }
}

function getCustomFontFamilyName(name: string) {
  return name.replace(/\.\w+$/, '');
}

function loadFontFace(name: string, url: string) {
  const id = `font-${name.replace(/[^a-zA-Z0-9]/g, '-')}`;
  if (document.getElementById(id)) return;
  const fontName = getCustomFontFamilyName(name);
  const style = document.createElement("style");
  style.id = id;
  style.textContent = `@font-face { font-family: "${fontName}"; src: url("${url}"); }`;
  document.head.appendChild(style);
}

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
  const [font, setFont] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(STORAGE_KEY) || "";
  });
  const [customFonts, setCustomFonts] = useState<CustomFont[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem(CUSTOM_FONTS_KEY) || "[]");
    } catch { return []; }
  });
  const [fontDialogOpen, setFontDialogOpen] = useState(false);
  const [themeStyle, setThemeStyle] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(STYLE_STORAGE_KEY) || "";
  });
  const [customCss, setCustomCss] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(STYLE_CUSTOM_CSS_KEY) || "";
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

  // Load custom font faces on mount
  useEffect(() => {
    for (const cf of customFonts) {
      loadFontFace(cf.name, cf.url);
    }
    applyFont(font, customFonts);
  }, [customFonts, font]);

  // Apply saved theme style on mount
  useEffect(() => {
    if (!themeStyle) return;
    if (themeStyle === "custom") {
      if (customCss) applyThemeStyle(customCss);
    } else {
      const css = THEME_STYLES[themeStyle];
      if (css) applyThemeStyle(css);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleThemeStyleChange = useCallback((value: string) => {
    setThemeStyle(value);
    localStorage.setItem(STYLE_STORAGE_KEY, value);
    if (value === "custom") {
      if (customCss) applyThemeStyle(customCss);
    } else if (value === "") {
      removeThemeStyle();
    } else {
      const css = THEME_STYLES[value];
      if (css) applyThemeStyle(css);
    }
  }, [customCss]);

  const handleCustomCssChange = useCallback((value: string) => {
    setCustomCss(value);
    localStorage.setItem(STYLE_CUSTOM_CSS_KEY, value);
    applyThemeStyle(value);
  }, []);

  const handleFontChange = useCallback((value: string) => {
    setFont(value);
    localStorage.setItem(STORAGE_KEY, value);
    applyFont(value, customFonts);
  }, [customFonts]);

  const handleFontAdded = useCallback(async (url: string, name: string) => {
    const newFont = { name, url };
    const updated = [...customFonts, newFont];
    setCustomFonts(updated);
    localStorage.setItem(CUSTOM_FONTS_KEY, JSON.stringify(updated));
    loadFontFace(name, url);
    // Auto-select the newly added font
    setFont(name);
    localStorage.setItem(STORAGE_KEY, name);
    // Small delay for font to load before applying
    setTimeout(() => applyFont(name, updated), 100);
  }, [customFonts]);

  // Fetch server-side fonts and merge
  useEffect(() => {
    fetchWithAuth("/api/fonts")
      .then(res => res.ok ? res.json() : [])
      .then((serverFonts: CustomFont[]) => {
        if (serverFonts.length === 0) return;
        setCustomFonts(prev => {
          const existing = new Set(prev.map(f => f.name));
          const merged = [...prev];
          for (const sf of serverFonts) {
            if (!existing.has(sf.name)) merged.push(sf);
          }
          localStorage.setItem(CUSTOM_FONTS_KEY, JSON.stringify(merged));
          return merged;
        });
        for (const sf of serverFonts) loadFontFace(sf.name, sf.url);
      })
      .catch(() => {});
  }, []);

  const fontOptions = [
    ...BUILTIN_FONTS,
    ...customFonts.map(f => ({ value: f.name, label: f.name.replace(/\.\w+$/, '') })),
  ];

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

      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2.5 block">
          Style
        </label>
        <SearchSelect
          value={themeStyle}
          onChange={handleThemeStyleChange}
          options={[
            { value: "", label: "Default" },
            { value: "mira", label: "Mira" },
            { value: "lyra", label: "Lyra" },
            { value: "rhea", label: "Rhea" },
            { value: "custom", label: "Custom" },
          ]}
          placeholder="Select style..."
          allowCustom={false}
        />
        {themeStyle === "custom" && (
          <Textarea
            className="mt-2 font-mono text-xs min-h-40"
            placeholder="Paste CSS variables here..."
            value={customCss}
            onChange={(e) => handleCustomCssChange(e.target.value)}
          />
        )}
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2.5 block">
          {t("font")}
        </label>
        <div className="flex items-center gap-2">
          <SearchSelect
            value={font}
            onChange={handleFontChange}
            options={fontOptions}
            placeholder={t("fontPlaceholder")}
            searchPlaceholder={t("fontSearch")}
            allowCustom={false}
            className="flex-1"
          />
          <Button
            variant="outline"
            size="icon"
            className="size-8 shrink-0"
            onClick={() => setFontDialogOpen(true)}
            title={t("addCustomFont")}
          >
            <Plus className="size-4" />
          </Button>
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
              className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
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

      <CustomFontDialog
        open={fontDialogOpen}
        onOpenChange={setFontDialogOpen}
        onFontAdded={handleFontAdded}
      />
    </div>
  );
}
