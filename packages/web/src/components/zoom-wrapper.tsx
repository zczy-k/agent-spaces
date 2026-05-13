"use client";

import { useEffect } from "react";
import { isTauriEnvironment } from "@/lib/native-notification";

type TauriWebviewApi = {
  webview?: {
    getCurrentWebview?: () => {
      setZoom?: (scale: number) => Promise<void>;
    };
  };
};

async function applyNativeZoom(value: number) {
  if (!isTauriEnvironment()) return;

  const tauri = (window as Window & { __TAURI__?: TauriWebviewApi }).__TAURI__;
  const setZoom = tauri?.webview?.getCurrentWebview?.()?.setZoom;
  if (!setZoom) return;

  try {
    await setZoom(value / 100);
  } catch {
    // Ignore unsupported platforms/webviews.
  }
}

export function ZoomWrapper({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const saved = localStorage.getItem("pageZoom");
    if (saved) {
      const value = Number(saved);
      if (value >= 50 && value <= 200) {
        void applyNativeZoom(value);
      }
    }

    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (typeof detail === "number" && detail >= 50 && detail <= 200) {
        void applyNativeZoom(detail);
      }
    };

    window.addEventListener("zoom-change", handler);
    return () => window.removeEventListener("zoom-change", handler);
  }, []);

  return <>{children}</>;
}
