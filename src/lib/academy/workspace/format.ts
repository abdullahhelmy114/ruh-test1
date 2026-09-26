/**
 * Formatting helpers for the academy workspace screens.
 *
 * Pure and framework-free so they run under node --test.
 *
 * Every timestamp is rendered in the academy's own time zone, which the caller
 * must pass: the academy sets it once as the `institution.timezone` policy,
 * the same source the Lesson Sheet release rule uses. The zone is a required
 * argument rather than an optional one so no call can fall back to whatever
 * zone the runtime happens to be in - that fallback made the server and the
 * browser render different text for the same session. A null zone means the
 * academy has not configured one yet: a timestamp is then left blank rather
 * than shown against some other clock. Session times name their
 * zone, so a learner elsewhere can see which clock they are reading. Nothing
 * here decides availability.
 */
import type { ProductLocale } from "../domain/vocabulary.ts";

export const INTL_LOCALE: Readonly<Record<ProductLocale, string>> = { en: "en-GB", ar: "ar", tr: "tr-TR" };

/**
 * Formatter caches. Intl.DateTimeFormat construction is expensive and every
 * table row used to build several; identical option sets now share one
 * instance per locale and zone.
 */
const dateTimeFormats = new Map<string, Intl.DateTimeFormat>();
const numberFormats = new Map<string, Intl.NumberFormat>();

function dateTimeFormat(locale: ProductLocale, timeZone: string, options: Intl.DateTimeFormatOptions, key: string): Intl.DateTimeFormat {
  const cacheKey = `${locale}|${timeZone}|${key}`;
  let format = dateTimeFormats.get(cacheKey);
  if (!format) {
    format = new Intl.DateTimeFormat(INTL_LOCALE[locale], { ...options, timeZone });
    dateTimeFormats.set(cacheKey, format);
  }
  return format;
}

function numberFormat(locale: ProductLocale, options: Intl.NumberFormatOptions, key: string): Intl.NumberFormat {
  const cacheKey = `${locale}|${key}`;
  let format = numberFormats.get(cacheKey);
  if (!format) {
    format = new Intl.NumberFormat(INTL_LOCALE[locale], options);
    numberFormats.set(cacheKey, format);
  }
  return format;
}

/** Replaces {name} placeholders. Unknown placeholders are left visible rather than silently dropped. */
export function fmt(template: string, values: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in values ? String(values[key]) : whole));
}

/**
 * Locale-aware fmt: numeric values render in the locale's own digits
 * (Arabic-Indic under ar), so every dictionary template localizes its
 * numerals in one place instead of at twenty call sites.
 */
export function localizedFmt(locale: ProductLocale, template: string, values: Readonly<Record<string, string | number>>): string {
  const localized: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(values)) {
    localized[key] = typeof value === "number" && Number.isFinite(value) ? numberFormat(locale, {}, "plain").format(value) : value;
  }
  return fmt(template, localized);
}

/**
 * A start–end range on the academy clock, via formatRange: the shared date
 * and zone appear once and the range order follows the locale (RTL included).
 */
export function formatSessionTimeRange(startIso: string | null | undefined, endIso: string | null | undefined, locale: ProductLocale, timeZone: string | null): string {
  const start = parse(startIso);
  const end = parse(endIso);
  if (!start || timeZone === null) return "";
  const format = dateTimeFormat(locale, timeZone, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }, "session");
  if (!end || end.getTime() <= start.getTime()) return format.format(start);
  return format.formatRange(start, end);
}

function parse(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateTime(iso: string | null | undefined, locale: ProductLocale, timeZone: string | null): string {
  const date = parse(iso);
  if (!date || timeZone === null) return "";
  return dateTimeFormat(locale, timeZone, { dateStyle: "medium", timeStyle: "short" }, "datetime").format(date);
}

/** Date and time with the time zone named, for session times. */
export function formatSessionTime(iso: string | null | undefined, locale: ProductLocale, timeZone: string | null): string {
  const date = parse(iso);
  if (!date || timeZone === null) return "";
  return dateTimeFormat(locale, timeZone, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }, "session").format(date);
}

export function formatDate(value: string | null | undefined, locale: ProductLocale, timeZone: string | null): string {
  if (!value) return "";
  // Plain calendar dates (YYYY-MM-DD) are shown as that calendar date, never shifted by a time zone.
  const plain = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = plain ? new Date(Date.UTC(Number(plain[1]), Number(plain[2]) - 1, Number(plain[3]))) : parse(value);
  if (!date) return "";
  if (plain) return dateTimeFormat(locale, "UTC", { dateStyle: "medium" }, "date").format(date);
  // An instant still needs the academy's clock to name a calendar day.
  if (timeZone === null) return "";
  return dateTimeFormat(locale, timeZone, { dateStyle: "medium" }, "date").format(date);
}

export function formatPercent(ratio: number | null | undefined, locale: ProductLocale): string {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return "";
  return numberFormat(locale, { style: "percent", maximumFractionDigits: 0 }, "percent").format(ratio);
}

export function formatNumber(value: number | null | undefined, locale: ProductLocale): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "";
  return numberFormat(locale, {}, "plain").format(value);
}

/** A display name, falling back to a neutral label (never an email or uid). */
export function displayName(name: string | null | undefined, fallback: string): string {
  const trimmed = typeof name === "string" ? name.trim() : "";
  return trimmed === "" ? fallback : trimmed;
}
