/**
 * Email-ownership OTP helper (Phase 3 batch 4). Dependency-free (node:crypto
 * only) so it is unit-testable and shared by every route in the real flow:
 * student/teacher signup, resend, verify-email-code and verify-teacher.
 *
 *   - codes come from crypto.randomInt (never Math.random)
 *   - exactly six ASCII decimal digits, 15-minute lifetime
 *   - storage is an HMAC-SHA-256 hex digest bound to the account and to
 *     this purpose (`ruh-otp-v1:${uid}:${code}`), never the plaintext code
 *   - comparison is constant-time and never throws on malformed input
 *
 * Secret: the server-only INTERNAL_API_SECRET (already required by the
 * Zoom -> YouTube boundary). It is never logged or returned. Rotating it only
 * invalidates codes issued in the last OTP_TTL_MS; users simply resend.
 * When the secret is missing the routes fail closed (503) — a code must
 * never be issued or accepted without it.
 */
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 15 * 60 * 1000;
/** Hex length of an HMAC-SHA-256 digest. */
export const OTP_DIGEST_HEX_LENGTH = 64;
/**
 * Domain-separation tag. INTERNAL_API_SECRET is also presented as a bearer
 * value on the internal boundary; prefixing the HMAC message keeps OTP
 * digests distinct from any other use of the same secret and versions the
 * scheme for future changes.
 */
export const OTP_HMAC_DOMAIN = "ruh-otp-v1";

const OTP_SHAPE = /^[0-9]{6}$/;
const DIGEST_SHAPE = /^[0-9a-f]{64}$/;

/** Six decimal digits from a CSPRNG (full 000000–999999 space, zero-padded). */
export function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(OTP_LENGTH, "0");
}

/** Exactly six ASCII digits; no whitespace, signs, or non-ASCII numerals. */
export function isOtpShape(value: unknown): value is string {
  return typeof value === "string" && OTP_SHAPE.test(value);
}

/** Expiry timestamp for a code issued at `now`. */
export function otpExpiry(now: number = Date.now()): Date {
  return new Date(now + OTP_TTL_MS);
}

/**
 * Returns the configured secret or throws. Routes call this before any
 * side effect so a misconfigured deployment fails closed instead of issuing
 * codes that can never be verified.
 */
export function requireOtpSecret(secret: string | undefined): string {
  if (typeof secret !== "string" || secret.length === 0) {
    throw new Error("OTP secret is not configured");
  }
  return secret;
}

/** HMAC-SHA-256 hex of `${OTP_HMAC_DOMAIN}:${uid}:${code}` under the server secret. */
export function hashOtp(uid: string, code: string, secret: string): string {
  if (typeof uid !== "string" || uid.length === 0) throw new Error("uid required");
  if (!isOtpShape(code)) throw new Error("code must be six digits");
  requireOtpSecret(secret);
  return createHmac("sha256", secret).update(`${OTP_HMAC_DOMAIN}:${uid}:${code}`).digest("hex");
}

/**
 * Constant-time check of a submitted code against a stored digest.
 * Any malformed input (bad code shape, non-hex or wrong-length digest)
 * returns false rather than throwing.
 */
export function verifyOtpHash(uid: string, code: unknown, secret: string, stored: unknown): boolean {
  if (typeof uid !== "string" || uid.length === 0) return false;
  if (!isOtpShape(code)) return false;
  if (typeof stored !== "string" || !DIGEST_SHAPE.test(stored)) return false;
  requireOtpSecret(secret);
  const expected = Buffer.from(hashOtp(uid, code, secret), "hex");
  const actual = Buffer.from(stored, "hex");
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}
