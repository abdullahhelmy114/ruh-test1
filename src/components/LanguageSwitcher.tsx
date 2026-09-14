"use client";

import { useEffect, useState } from "react";
import { Globe, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, isLocale, localeDirection } from "@/i18n/config";

/**
 * Mirror the locale preference into a cookie (same key as localStorage) so the
 * root layout renders the right <html lang dir> on the next server render.
 * Only allowlisted locales are ever written.
 */
function writeLocaleCookie(locale: string) {
  if (!isLocale(locale)) return;
  const secure = window.location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax${secure}`;
}

const localeOptions = [
  { code: "en", label: "English", flag: "en" },
  { code: "ar", label: "Arabic", flag: "ar" },
  { code: "tr", label: "Turkish", flag: "tr" },
];

const defaultLocale = "en";

export function LanguageSwitcher() {
  const [locale, setLocale] = useState(defaultLocale);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("preferred-locale");
    if (stored) setLocale(stored);

    // One-time sync for preferences saved before the cookie existed: the server
    // rendered the cookie's (or default) locale, so mirror the stored choice into
    // the cookie for next time and apply lang/dir now.
    if (isLocale(stored)) {
      if (!document.cookie.split("; ").includes(`${LOCALE_COOKIE}=${stored}`)) {
        writeLocaleCookie(stored);
      }
      const dir = localeDirection(stored);
      if (document.documentElement.dir !== dir) document.documentElement.dir = dir;
      if (document.documentElement.lang !== stored) document.documentElement.lang = stored;
    }

    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      setLocale(customEvent.detail);
    };
    window.addEventListener("locale-change", handler);
    return () => window.removeEventListener("locale-change", handler);
  }, []);

  const changeLocale = (newLocale: string) => {
    localStorage.setItem("preferred-locale", newLocale);
    writeLocaleCookie(newLocale);
    document.documentElement.dir = newLocale === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = newLocale;
    setLocale(newLocale);
    window.dispatchEvent(new CustomEvent("locale-change", { detail: newLocale }));
    setOpen(false);
  };

  const current = localeOptions.find((l) => l.code === locale);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-label="Change language"
        className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
      >
        <span className="text-base">{current?.flag}</span>
        
        <Globe className="h-4 w-4 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-48 rounded-2xl border border-border bg-card p-1.5 shadow-elegant z-50">
          {localeOptions.map((opt) => (
            <button
              key={opt.code}
              onClick={() => changeLocale(opt.code)}
              className={cn(
                "flex items-center gap-2 w-full rounded-full px-3 py-2 text-sm font-medium transition-colors",
                locale === opt.code
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent text-muted-foreground"
              )}
            >
              <span className="text-base">{opt.flag}</span>
              <span>{opt.label}</span>
              {locale === opt.code && <Check className="ml-auto h-3.5 w-3.5" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}