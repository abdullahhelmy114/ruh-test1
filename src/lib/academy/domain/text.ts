/**
 * Parsers for untrusted scalar input (titles, slugs, instants, revisions).
 *
 * Every academy service parses request data through these helpers so bounds
 * and messages are consistent, and invalid input is always a safe 400.
 */
import { DomainError } from "./errors.ts";

/** Required single-line text, trimmed, 1..max characters. */
export function parseTitle(value: unknown, field: string, max = 200): string {
  if (typeof value !== "string") throw new DomainError("VALIDATION", `${field} is required.`);
  const trimmed = value.trim();
  if (trimmed.length === 0) throw new DomainError("VALIDATION", `${field} is required.`);
  if (trimmed.length > max) throw new DomainError("VALIDATION", `${field} must be at most ${max} characters.`);
  if (/[\r\n]/.test(trimmed)) throw new DomainError("VALIDATION", `${field} must be a single line.`);
  return trimmed;
}

/** Optional multi-line text; undefined/null/blank become null. */
export function parseOptionalText(value: unknown, field: string, max = 5000): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw new DomainError("VALIDATION", `${field} must be text.`);
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > max) throw new DomainError("VALIDATION", `${field} must be at most ${max} characters.`);
  return trimmed;
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** URL slug: lowercase letters, digits and single hyphens, 3..80 characters. */
export function parseSlug(value: unknown, field = "slug"): string {
  if (typeof value !== "string" || value.length < 3 || value.length > 80 || !SLUG.test(value)) {
    throw new DomainError("VALIDATION", `${field} must be 3 to 80 lowercase letters, digits or hyphens.`);
  }
  return value;
}

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * An absolute instant. The offset is mandatory so a wall-clock time can never
 * be silently interpreted in the server's time zone.
 */
export function parseInstant(value: unknown, field: string): string {
  if (typeof value !== "string" || !ISO_INSTANT.test(value)) {
    throw new DomainError("VALIDATION", `${field} must be a date and time with a time zone offset.`);
  }
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) throw new DomainError("VALIDATION", `${field} is not a valid date and time.`);
  return new Date(ms).toISOString();
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A calendar date (YYYY-MM-DD) or null. */
export function parseOptionalDate(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  const match = typeof value === "string" ? DATE_ONLY.exec(value) : null;
  if (!match) throw new DomainError("VALIDATION", `${field} must be a date (YYYY-MM-DD).`);
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new DomainError("VALIDATION", `${field} is not a real calendar date.`);
  }
  return value as string;
}

/** A whole number in [min, max], or null when absent. */
export function parseOptionalInt(value: unknown, field: string, min: number, max: number): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new DomainError("VALIDATION", `${field} must be a whole number from ${min} to ${max}.`);
  }
  return value;
}

/** The revision an editor saw. Required for every update of an existing record. */
export function parseRequiredRevision(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new DomainError("VALIDATION", "expectedRevision must be a positive whole number.");
  }
  return value;
}

/** Throws CONFLICT when the stored revision is not the one the editor saw. */
export function assertRevision(actual: number, expected: number): void {
  if (actual !== expected) {
    throw new DomainError("CONFLICT", "This item was changed by someone else. Reload and try again.");
  }
}

/** An https URL for a meeting or resource link, or null. */
export function parseOptionalHttpsUrl(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > 2000) {
    throw new DomainError("VALIDATION", `${field} must be an https link.`);
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new DomainError("VALIDATION", `${field} must be an https link.`);
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new DomainError("VALIDATION", `${field} must be an https link.`);
  }
  return url.toString();
}
