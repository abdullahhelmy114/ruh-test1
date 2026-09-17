import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { HttpError, requireAuth } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { REFERRAL_CODE_PATTERN, referralPath } from "@/lib/referral";
import { newReferralCode } from "@/lib/referral-db";

const PRIVATE = { "Cache-Control": "private, no-store" } as const;

/**
 * The signed-in account's own invitation: its code, link path, and how many
 * accounts were created with it. Keyed only by the session's Firebase uid; no
 * code, uid or count of anyone else is ever returned. No rewards are offered
 * (see lib/referral.ts), so there are no credits or earnings to report.
 */
async function ownReferral(uid: string) {
  const [row] = await sql`
    SELECT p.referral_code,
      (SELECT count(*) FROM profiles r WHERE r.referred_by::text = p.id::text AND r.firebase_uid <> p.firebase_uid)::int AS joined
    FROM profiles p
    WHERE p.firebase_uid = ${uid}
  `;
  if (!row) throw new HttpError(404, "Profile not found.");
  const code = typeof row.referral_code === "string" && REFERRAL_CODE_PATTERN.test(row.referral_code) ? row.referral_code : null;
  return { code, path: code ? referralPath(code) : null, joined: Number(row.joined) || 0, rewardsOffered: false };
}

export const GET = withApi(async (req) => {
  const user = await requireAuth(req);
  return NextResponse.json({ data: await ownReferral(user.uid) }, { headers: PRIVATE });
});

// Creates the caller's code if the account has none yet (accounts created
// before codes were issued). Idempotent: an existing code is never replaced.
export const POST = withApi(async (req) => {
  const user = await requireAuth(req);
  const code = await newReferralCode();
  await sql`UPDATE profiles SET referral_code = ${code} WHERE firebase_uid = ${user.uid} AND referral_code IS NULL`;
  return NextResponse.json({ data: await ownReferral(user.uid) }, { headers: PRIVATE });
});
