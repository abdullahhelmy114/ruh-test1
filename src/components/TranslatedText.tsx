"use client";

import React, { useEffect, useState, useCallback } from "react";

// استيراد جميع ملفات الترجمة
import enMessages from "@/messages/en.json";
import arMessages from "@/messages/ar.json";
import trMessages from "@/messages/tr.json";

// The message files mix flat sentence keys with nested namespaces, so a key
// only translates when it maps to a string; anything else falls back to the key.
type Messages = Readonly<Record<string, unknown>>;
const dictionaries: Record<string, Messages> = {
  en: enMessages,
  ar: arMessages,
  tr: trMessages,
};

function translate(locale: string, key: string): string {
  const value = (dictionaries[locale] || dictionaries.en)[key];
  return typeof value === "string" && value ? value : key;
}

function usePreferredLocale(): string {
  const [locale, setLocale] = useState("en");

  const handleLocaleChange = useCallback((e: Event) => {
    const customEvent = e as CustomEvent<string>;
    setLocale(customEvent.detail);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("preferred-locale") || "en";
    setLocale(stored);
    window.addEventListener("locale-change", handleLocaleChange);
    return () => window.removeEventListener("locale-change", handleLocaleChange);
  }, [handleLocaleChange]);

  return locale;
}

interface TProps {
  children: string;
}

export function T({ children }: TProps) {
  const locale = usePreferredLocale();
  return React.createElement(React.Fragment, null, translate(locale, children));
}

/** String form of <T>, for props that must be plain text (placeholder, aria-label, title). */
export function useT(): (key: string) => string {
  const locale = usePreferredLocale();
  return useCallback((key: string) => translate(locale, key), [locale]);
}

export default T;
