export const locales = ['en', 'ar', 'tr'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

/**
 * Locale preference persistence. The language switcher stores the chosen
 * locale in localStorage and mirrors it into a cookie with the SAME key, so
 * the root layout can render the correct <html lang dir> on the server
 * (no pre-hydration bootstrap script). The cookie is untrusted input: it is
 * only ever mapped through resolveLocale().
 */
export const LOCALE_COOKIE = 'preferred-locale';
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (locales as readonly string[]).includes(value);
}

/** Any unknown, missing or tampered value falls back to the default locale. */
export function resolveLocale(value: unknown): Locale {
  return isLocale(value) ? value : defaultLocale;
}

export function localeDirection(locale: Locale): 'rtl' | 'ltr' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}
