"use client";

import { useState, useCallback, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import { Sun, Moon, Monitor, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SearchSelect } from "@/components/ui/search-select";
import { fetchWithAuth } from "@/lib/auth";
import {
  THEME_STYLE_STORAGE_KEY as STYLE_STORAGE_KEY,
  THEME_STYLE_CUSTOM_CSS_KEY as STYLE_CUSTOM_CSS_KEY,
  THEME_STYLES,
  applyThemeStyle,
  removeThemeStyle,
} from "@/lib/theme-style";
import { CustomFontDialog } from "./custom-font-dialog";

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

  const themeOptions = [
    { value: "light" as const, label: t("themeLight"), icon: Sun },
    { value: "dark" as const, label: t("themeDark"), icon: Moon },
    { value: "system" as const, label: t("themeSystem"), icon: Monitor },
  ];

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
            { value: "luma", label: "Luma" },
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

      <CustomFontDialog
        open={fontDialogOpen}
        onOpenChange={setFontDialogOpen}
        onFontAdded={handleFontAdded}
      />
    </div>
  );
}
