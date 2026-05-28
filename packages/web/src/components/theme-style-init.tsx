"use client";

import { useEffect } from "react";
import { applySavedThemeStyle } from "@/lib/theme-style";

export function ThemeStyleInit() {
  useEffect(() => {
    applySavedThemeStyle();
  }, []);
  return null;
}
