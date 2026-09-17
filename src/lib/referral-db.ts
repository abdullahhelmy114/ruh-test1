import { sql } from "@/lib/db/client";
import { pickUnusedReferralCode } from "@/lib/referral";

/** A referral code no profile holds yet (see lib/referral.ts). */
export function newReferralCode(): Promise<string> {
  return pickUnusedReferralCode(async (code) => (await sql`SELECT 1 FROM profiles WHERE referral_code = ${code} LIMIT 1`).length > 0);
}
