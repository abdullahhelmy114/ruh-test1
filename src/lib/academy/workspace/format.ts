/**
 * Formatting helpers for the academy workspace screens.
 *
 * Pure and framework-free so they run under node --test. Dates are shown in
 * the viewer's own time zone with the zone named, because a learner and the
 * academy may be in different places; nothing here decides availability.
 */
import type { ProductLocale } from "../domain/vocabulary.ts";

const INTL_LOCALE: Readonly<Record<ProductLocale, string>> = { en: "en-GB", ar: "ar", tr: "tr-TR" };

/** Replaces {name} placeholders. Unknown placeholders are left visible rather than silently dropped. */
export function fmt(template: string, values: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in values ? String(values[key]) : whole));
}

function parse(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateTime(iso: string | null | undefined, locale: ProductLocale, timeZone?: string): string {
  const date = parse(iso);
  if (!date) return "";
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
    timeZoneName: undefined,
  }).format(date);
}

/** Date and time with the time zone named, for session times. */
export function formatSessionTime(iso: string | null | undefined, locale: ProductLocale, timeZone?: string): string {
  const date = parse(iso);
  if (!date) return "";
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone,
  }).format(date);
}

export function formatDate(value: string | null | undefined, locale: ProductLocale): string {
  if (!value) return "";
  // Plain calendar dates (YYYY-MM-DD) are shown as that calendar date, never shifted by a time zone.
  const plain = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = plain ? new Date(Date.UTC(Number(plain[1]), Number(plain[2]) - 1, Number(plain[3]))) : parse(value);
  if (!date) return "";
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { dateStyle: "medium", timeZone: plain ? "UTC" : undefined }).format(date);
}

export function formatPercent(ratio: number | null | undefined, locale: ProductLocale): string {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return "";
  return new Intl.NumberFormat(INTL_LOCALE[locale], { style: "percent", maximumFractionDigits: 0 }).format(ratio);
}

export function formatNumber(value: number | null | undefined, locale: ProductLocale): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "";
  return new Intl.NumberFormat(INTL_LOCALE[locale]).format(value);
}

/** A display name, falling back to a neutral label (never an email or uid). */
export function displayName(name: string | null | undefined, fallback: string): string {
  const trimmed = typeof name === "string" ? name.trim() : "";
  return trimmed === "" ? fallback : trimmed;
}
