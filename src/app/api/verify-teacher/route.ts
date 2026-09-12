export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { getAdminAuth } from "@/lib/firebase/admin";
import { HttpError } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { checkRateLimit, clientKey, normalizeEmail, retryAfterSeconds } from "@/lib/security/rate-limit";
import { isOtpShape, verifyOtpHash } from "@/lib/security/otp";

// Phase 3 batch 4 — real OTP verifier for the teacher signup flow
// (/verify-teacher). Same email-ownership model and controls as
// /api/verify-email-code; the limiter keys are shared with it so the two
// routes cannot be alternated to double the guess budget. Previously this
// route distinguished an unknown teacher (404) from "no valid code" and a
// wrong code (teacher e-mail enumeration) and compared a plaintext code with
// unlimited attempts. Now a single generic failure covers unknown teacher /
// no live code / wrong / expired.
// Success side effects are unchanged: Firebase emailVerified = true and
// profiles.email_verified = TRUE. Teacher status is NOT changed here;
// administrative approval remains a separate step. As in verify-email-code
// the idempotent side effects run before the code row is deleted, so a
// transient failure leaves the code retryable.

const CLIENT_LIMIT = { limit: 10, windowMs: 15 * 60 * 1000 }; // 10 attempts / 15 min per client
const EMAIL_LIMIT = { limit: 5, windowMs: 15 * 60 * 1000 };   // 5 attempts / 15 min per address
const UID_LIMIT = { limit: 5, windowMs: 15 * 60 * 1000 };     // 5 attempts / 15 min per account
const GENERIC_FAILURE = "Invalid or expired verification code";

function tooMany(retryAfterMs: number) {
  return NextResponse.json(
    { message: "Too many attempts" },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds({ allowed: false, limit: 0, remaining: 0, retryAfterMs })) } }
  );
}

function failed() {
  return NextResponse.json({ message: GENERIC_FAILURE }, { status: 400 });
}

export const POST = withApi(async (req) => {
  const ipCheck = checkRateLimit(`verify-code:${clientKey(req)}`, CLIENT_LIMIT);
  if (!ipCheck.allowed) return tooMany(ipCheck.retryAfterMs);

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") throw new HttpError(400, "Invalid request body");
  const { email: rawEmail, emailCode: rawCode } = body as Record<string, unknown>;

  const email = normalizeEmail(rawEmail);
  const code = typeof rawCode === "string" ? rawCode.trim() : "";
  if (!email || !isOtpShape(code)) return failed();

  const emailCheck = checkRateLimit(`verify-code:email:${email}`, EMAIL_LIMIT);
  if (!emailCheck.allowed) return tooMany(emailCheck.retryAfterMs);

  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) throw new HttpError(503, "Verification service unavailable");

  const records = await sql`
    SELECT vc.email_code, p.firebase_uid
    FROM verification_codes vc
    JOIN profiles p ON vc.user_uid = p.firebase_uid
    WHERE LOWER(p.email) = ${email}
      AND p.role = 'teacher'
      AND vc.expires_at > NOW()
    ORDER BY vc.created_at DESC
    LIMIT 1
  `;
  const record = records[0];
  if (!record) return failed();

  const { email_code: storedDigest, firebase_uid: userUid } = record;

  const uidCheck = checkRateLimit(`verify-code:uid:${userUid}`, UID_LIMIT);
  if (!uidCheck.allowed) return tooMany(uidCheck.retryAfterMs);

  if (!verifyOtpHash(userUid, code, secret, storedDigest)) return failed();

  // 🛑 الأهم: تفعيل الإيميل في Firebase! (idempotent)
  await getAdminAuth().updateUser(userUid, { emailVerified: true });

  // تفعيل البريد فقط — اعتماد المعلم خطوة إدارية منفصلة (idempotent)
  await sql`UPDATE profiles SET email_verified = TRUE WHERE firebase_uid = ${userUid}`;

  // حذف الكود بعد اكتمال التفعيل — يبقى قابلاً لإعادة المحاولة إذا فشلت خطوة أعلاه
  await sql`DELETE FROM verification_codes WHERE user_uid = ${userUid}`;

  return NextResponse.json({ success: true });
});
