"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Languages } from "lucide-react";
import { useLocale, type Locale } from "@/components/locale-provider";

export function LanguageTab() {
  const t = useTranslations("settings");
  const { locale, setLocale } = useLocale();

  const options = [
    { value: "zh" as Locale, label: t("languageZh") },
    { value: "en" as Locale, label: t("languageEn") },
  ];

  return (
    <div className="space-y-5">
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2.5 block">
          {t("language")}
        </label>
        <div className="grid grid-cols-2 gap-2">
          {options.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setLocale(value)}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-lg border p-3 text-sm transition-colors hover:bg-muted/50",
                locale === value && "border-primary bg-primary/5 text-primary",
              )}
            >
              <Languages className="size-4" />
              <span className="text-xs font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
