"use client";

import { useTheme as useNextTheme } from "next-themes";
import { useEffect, useState } from "react";

export function useTheme() {
  const { theme, setTheme, resolvedTheme } = useNextTheme();
  const [mounted, setMounted] = useState(false);

  // ننتظر حتى يتم تحميل المكون تماماً لتجنب أخطاء الـ Hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  const toggle = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return { 
    theme: mounted ? (theme === "system" ? resolvedTheme : theme) : "light", 
    toggle 
  };
}