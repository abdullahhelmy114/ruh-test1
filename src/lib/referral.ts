import { randomBytes } from "crypto";

/**
 * Referrals: invitation links, without rewards.
 *
 * - Every account owns at most one referral code (profiles.referral_code),
 *   found by its Firebase uid; the code is shown only to its owner.
 * - A new STUDENT account may be attributed to the owner of a code it arrived
 *   with (/r/CODE → student signup). Attribution happens once, at account
 *   creation, on the server; nobody can set or change it later, so there is no
 *   self-referral and no second attribution. Teacher signup takes no code.
 * - profiles.referred_by keeps the referrer's profiles.id, the representation
 *   existing rows use (its column type is not defined in the repository and is
 *   left unchanged); ownership and counting always start from the Firebase uid.
 * - No financial reward, credit, discount, coupon or payout is granted or
 *   displayed: none has been approved. The legacy referral_count,
 *   referral_credits and referral_discount_used columns were never written
 *   and are not read.
 */

/** 8 upper-case hexadecimal characters, e.g. A1B2C3D4. */
export const REFERRAL_CODE_PATTERN = /^[A-F0-9]{8}$/;

export function generateReferralCode(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}

/** A referral code as a visitor may type or paste it, normalised; null if it cannot be one. */
export function parseReferralCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  return REFERRAL_CODE_PATTERN.test(code) ? code : null;
}

/** The site path of a referral link. */
export function referralPath(code: string): string {
  return `/r/${code}`;
}

/**
 * A code no account holds yet. The check runs against the database; a
 * collision in 32 random bits is rare, so a few attempts suffice, and failing
 * loudly beats silently sharing a code between two accounts.
 */
export async function pickUnusedReferralCode(isTaken: (code: string) => Promise<boolean>, generate: () => string = generateReferralCode, attempts = 5): Promise<string> {
  for (let i = 0; i < attempts; i++) {
    const code = generate();
    if (!(await isTaken(code))) return code;
  }
  throw new Error("Could not allocate a unique referral code.");
}
