"use client";

import { useState, useCallback, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useKeyboardShortcuts, SHORTCUT_DEFS } from "@/stores/keyboard-shortcuts";
import { Keyboard, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

function formatKeys(keys: string) {
  const map: Record<string, string> = { ctrl: 'Ctrl', shift: 'Shift', alt: 'Alt', meta: 'Meta', cmd: 'Cmd' };
  return keys.split('+').map(p => map[p] ?? p.toUpperCase());
}

export function ShortcutsTab() {
  const t = useTranslations("settings");
  const { getShortcut, setShortcut, resetShortcut } = useKeyboardShortcuts();
  const [recordingId, setRecordingId] = useState<string | null>(null);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!recordingId) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.key === 'Escape') {
      setRecordingId(null);
      return;
    }
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

    const parts: string[] = [];
    if (e.ctrlKey) parts.push('ctrl');
    if (e.shiftKey) parts.push('shift');
    if (e.altKey) parts.push('alt');
    if (e.metaKey) parts.push('meta');
    parts.push(e.key.toLowerCase());

    setShortcut(recordingId, parts.join('+'));
    setRecordingId(null);
  }, [recordingId, setShortcut]);

  useEffect(() => {
    if (!recordingId) return;
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [recordingId, handleKeyDown]);

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2.5 block">
          {t("shortcuts")}
        </label>
        <div className="space-y-2">
          {SHORTCUT_DEFS.map(def => {
            const keys = getShortcut(def.id);
            const isRecording = recordingId === def.id;
            return (
              <div key={def.id} className="flex items-center justify-between py-2 px-3 rounded-lg border">
                <span className="text-sm">{t(def.labelKey)}</span>
                <div className="flex items-center gap-2">
                  {isRecording ? (
                    <span className="text-xs text-primary animate-pulse">
                      {t("recordingShortcut")}
                    </span>
                  ) : (
                    <div className="flex items-center gap-0.5">
                      {formatKeys(keys).map((part, i) => (
                        <kbd key={i} className="inline-flex items-center rounded border bg-muted px-1.5 py-0.5 text-[11px] font-mono">
                          {part}
                        </kbd>
                      ))}
                    </div>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="size-7 p-0"
                    onClick={() => setRecordingId(isRecording ? null : def.id)}
                    title={t("recordShortcut")}
                  >
                    <Keyboard className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="size-7 p-0"
                    onClick={() => resetShortcut(def.id)}
                    title={t("resetShortcut")}
                  >
                    <RotateCcw className="size-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
