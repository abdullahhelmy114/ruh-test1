'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import en from '@/messages/en.json';
import ar from '@/messages/ar.json';
import tr from '@/messages/tr.json';

export type Language = 'en' | 'ar' | 'tr';

// استخدام أي نوع لتجنب مشاكل التداخل في ملفات JSON
const dictionaries: Record<Language, any> = {
  en,
  ar,
  tr,
};

interface TranslationContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

export function TranslationProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('en');

  const t = (key: string): string => {
    const dict = dictionaries[language];
    const keys = key.split('.');
    let value: any = dict;
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return key;
      }
    }
    return typeof value === 'string' ? value : key;
  };

  return (
    <TranslationContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </TranslationContext.Provider>
  );
}

export function useTranslation(): TranslationContextType {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error('useTranslation must be used within a TranslationProvider');
  }
  return context;
}

export function T({ children }: { children: string }) {
  const { t } = useTranslation();
  return <>{t(children)}</>;
}