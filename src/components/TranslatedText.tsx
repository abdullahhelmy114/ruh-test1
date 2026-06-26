"use client";

import React, { useEffect, useState, useCallback } from "react";

// استيراد جميع ملفات الترجمة
import enMessages from "@/messages/en.json";
import arMessages from "@/messages/ar.json";
import trMessages from "@/messages/tr.json";

type Messages = Record<string, string>;
const dictionaries: Record<string, Messages> = {
  en: enMessages as Messages,
  ar: arMessages as Messages,
  tr: trMessages as Messages,
};

interface TProps {
  children: string;
}

export function T({ children }: TProps) {
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

  const dict = dictionaries[locale] || dictionaries.en;
  const translated = dict[children] || children;

  return React.createElement(React.Fragment, null, translated);
}

export default T;