/**
 * Column value normalisation for rows returned by the database driver.
 *
 * The driver may return timestamps as Date objects or strings and bigint
 * counts as strings. Date-only columns are always selected as text
 * (`col::text`) so a calendar date is never shifted by a time zone.
 */

export function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") {
    const ms = Date.parse(value);
    if (!Number.isNaN(ms)) return new Date(ms).toISOString();
  }
  throw new Error("Unexpected timestamp value from the database.");
}

export function isoOrNull(value: unknown): string | null {
  return value === null || value === undefined ? null : iso(value);
}

export function num(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) throw new Error("Unexpected numeric value from the database.");
  return n;
}

export function numOrNull(value: unknown): number | null {
  return value === null || value === undefined ? null : num(value);
}

export function str(value: unknown): string {
  if (typeof value !== "string") throw new Error("Unexpected text value from the database.");
  return value;
}

export function strOrNull(value: unknown): string | null {
  return value === null || value === undefined ? null : str(value);
}
