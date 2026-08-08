// src/lib/theme.ts
"use client";

import { useTheme as useNextTheme } from "next-themes";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { useEffect, useState } from "react";

// إعادة تصدير ThemeProvider لاستخدامه في ProfileShell
export { NextThemesProvider as ThemeProvider };

export function useTheme() {
  const { theme, setTheme, resolvedTheme } = useNextTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggle = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return {
    theme: mounted ? (theme === "system" ? resolvedTheme : theme) : "light",
    toggle,
  };
}