"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { translations, defaultLocale } from "@/i18n/translations";

type Locale = string;

interface LanguageContextType {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  locale: defaultLocale,
  setLocale: () => {},
  t: (key: string) => key,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>(defaultLocale);

  useEffect(() => {
    const stored = localStorage.getItem("preferred-locale");
    if (stored && translations[stored]) {
      setLocale(stored);
    } else {
      const browserLang = navigator.language.split("-")[0];
      if (translations[browserLang]) {
        setLocale(browserLang);
      }
    }
  }, []);

  const changeLocale = (l: Locale) => {
    setLocale(l);
    localStorage.setItem("preferred-locale", l);
  };

  const t = (key: string): string => {
    return translations[locale]?.[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ locale, setLocale: changeLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}