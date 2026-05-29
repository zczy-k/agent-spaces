"use client";

import { useEffect } from "react";
import { applySavedThemeStyle, applySavedPrimaryColor } from "@/lib/theme-style";

export function ThemeStyleInit() {
  useEffect(() => {
    applySavedThemeStyle();
    applySavedPrimaryColor();
  }, []);
  return null;
}
