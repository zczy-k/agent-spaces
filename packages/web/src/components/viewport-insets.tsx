"use client";

import { useEffect } from "react";
import { isTauriEnvironment } from "@/lib/native-notification";

declare global {
  interface Window {
    __agentSpacesNativeInsets?: {
      top?: number;
      keyboard?: number;
    };
  }
}

function getAndroidTauriTopInset() {
  if (!isTauriEnvironment()) return 0;
  if (!/Android/i.test(navigator.userAgent)) return 0;

  return window.__agentSpacesNativeInsets?.top ?? window.AgentSpacesStatusBar?.getTopInset?.() ?? 0;
}

function getAndroidTauriKeyboardInset() {
  if (!isTauriEnvironment()) return 0;
  if (!/Android/i.test(navigator.userAgent)) return 0;

  return window.__agentSpacesNativeInsets?.keyboard ?? 0;
}

function updateViewportInsets() {
  const root = document.documentElement;
  const viewport = window.visualViewport;
  const topInset = getAndroidTauriTopInset();
  const visualViewportHeight = viewport?.height ?? window.innerHeight;
  const visualKeyboardHeight = viewport
    ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
    : 0;
  const keyboardHeight = Math.max(visualKeyboardHeight, getAndroidTauriKeyboardInset());
  const viewportHeight = visualKeyboardHeight > 0
    ? visualViewportHeight
    : Math.max(0, window.innerHeight - keyboardHeight);
  const contentHeight = Math.max(0, viewportHeight - topInset);

  root.style.setProperty("--app-viewport-height", `${viewportHeight}px`);
  root.style.setProperty("--app-content-height", `${contentHeight}px`);
  root.style.setProperty("--keyboard-inset-height", `${keyboardHeight}px`);
  root.style.setProperty("--app-top-inset", `${topInset}px`);
}

export function ViewportInsets() {
  useEffect(() => {
    updateViewportInsets();

    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", updateViewportInsets);
    viewport?.addEventListener("scroll", updateViewportInsets);
    window.addEventListener("resize", updateViewportInsets);
    window.addEventListener("orientationchange", updateViewportInsets);
    window.addEventListener("agent-spaces-native-insets", updateViewportInsets);

    return () => {
      viewport?.removeEventListener("resize", updateViewportInsets);
      viewport?.removeEventListener("scroll", updateViewportInsets);
      window.removeEventListener("resize", updateViewportInsets);
      window.removeEventListener("orientationchange", updateViewportInsets);
      window.removeEventListener("agent-spaces-native-insets", updateViewportInsets);
    };
  }, []);

  return null;
}
