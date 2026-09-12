/**
 * Input boundary helpers (Phase 3 batch 5). Dependency-free and pure so the
 * abuse/cost-controlled routes can reject oversized or malformed input
 * BEFORE any provider call, database write or quadratic fallback runs.
 *
 * These are deliberately narrow: each helper answers one question and never
 * truncates silently (a value is either accepted as-is or rejected).
 */

export interface BoundedStringOptions {
  /** Minimum length after trimming (default 1: empty strings are rejected). */
  min?: number;
  /** Maximum length after trimming (required). */
  max: number;
  /** Trim surrounding whitespace before measuring (default true). */
  trim?: boolean;
}

/**
 * Returns the (optionally trimmed) string when it is a string within
 * [min, max] characters, otherwise null. Non-strings are rejected.
 */
export function boundedString(value: unknown, options: BoundedStringOptions): string | null {
  if (typeof value !== "string") return null;
  const min = options.min ?? 1;
  const s = options.trim === false ? value : value.trim();
  if (s.length < min || s.length > options.max) return null;
  return s;
}

/** Optional string field: undefined/null pass through as "", otherwise boundedString rules (min 0). */
export function optionalBoundedString(value: unknown, max: number): string | null {
  if (value === undefined || value === null) return "";
  return boundedString(value, { min: 0, max });
}

/**
 * Integer within [min, max]. Only actual numbers are accepted (no numeric
 * strings, no floats, no NaN/Infinity).
 */
export function boundedPositiveInt(value: unknown, min: number, max: number): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  if (value < min || value > max) return null;
  return value;
}

/** Firebase Auth uid: URL-safe characters, bounded (real uids are 28 chars). */
const FIREBASE_UID = /^[A-Za-z0-9_-]{1,128}$/;
export function isFirebaseUidShape(value: unknown): value is string {
  return typeof value === "string" && FIREBASE_UID.test(value);
}

/**
 * Pusher channel name: at most 164 characters drawn from letters, digits and
 * `_ - = @ , . ;` (the character set Pusher accepts). This is a SHAPE check
 * only; who may publish to which channel is a product-policy question that
 * this helper does not answer.
 */
const PUSHER_CHANNEL = /^[A-Za-z0-9_\-=@,.;]{1,164}$/;
export function isPusherChannelShape(value: unknown): value is string {
  return typeof value === "string" && PUSHER_CHANNEL.test(value);
}

/** Coupon code normalisation used by both validation and admin creation: trim + upper-case. */
export function normalizeCouponCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return value.trim().toUpperCase();
}

const COUPON_CODE = /^[A-Z0-9_-]{3,32}$/;
export function isCouponCodeShape(value: unknown): value is string {
  return typeof value === "string" && COUPON_CODE.test(value);
}

/**
 * Edge TTS voice identifier as used by the lesson editor, e.g.
 * "ar-SA-HamedNeural" / "en-US-JennyNeural": language, region, name + "Neural".
 */
const TTS_VOICE = /^[a-z]{2}-[A-Z]{2}-[A-Za-z]{2,40}Neural$/;
export function isTtsVoiceShape(value: unknown): value is string {
  return typeof value === "string" && TTS_VOICE.test(value);
}

/**
 * Array of 1..max distinct strings, every one a member of `allowed`.
 * Duplicates are rejected so a caller cannot inflate work by repeating a type.
 */
export function isAllowedStringArray(
  value: unknown,
  allowed: ReadonlySet<string>,
  max: number
): value is string[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > max) return false;
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string" || !allowed.has(item) || seen.has(item)) return false;
    seen.add(item);
  }
  return true;
}
