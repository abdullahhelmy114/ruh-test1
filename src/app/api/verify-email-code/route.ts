export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { getAdminAuth } from '@/lib/firebase/admin';
import { ACTIVE_ACCOUNT_STATUS, HttpError } from '@/lib/auth';
import { accountHome } from '@/lib/auth/home';
import { withApi } from '@/lib/api/handler';
import { checkRateLimit, clientKey, normalizeEmail, retryAfterSeconds } from '@/lib/security/rate-limit';
import { isOtpShape, verifyOtpHash } from '@/lib/security/otp';

// Phase 3 batch 4 — real OTP verifier (students, and any role that lands on
// /verify-email). This is an EMAIL-OWNERSHIP challenge: the account is
// identified by the e-mail the code was sent to, never by a caller-supplied
// uid, and no session is required because the user cannot have one yet.
// Previously: unlimited guesses against a plaintext 6-digit code stored in
// verification_codes (HIGH — fraudulent activation of an account registered
// with an address the attacker does not control). Now:
//   - per-client, per-e-mail and per-account attempt limits (429), checked
//     before any comparison or side effect
//   - code shape validated before database work
//   - stored value is an HMAC digest; comparison is constant-time in the
//     OTP helper (no plaintext match in SQL)
//   - one generic failure for unknown e-mail / no live code / wrong / expired
//   - side effects run BEFORE the code row is deleted. Every side effect is
//     idempotent (set emailVerified/email_verified/status to a fixed value),
//     so a transient Firebase or database failure leaves the code retryable
//     instead of burning the user's only code; a racing duplicate submit
//     merely repeats the same idempotent writes before the row is removed
//   - no error.message leakage
// Success side effects are unchanged: Firebase emailVerified = true,
// profiles.email_verified = TRUE, and students become status = 'active'.
// Teachers are NOT activated here (admin approval is separate).

const CLIENT_LIMIT = { limit: 10, windowMs: 15 * 60 * 1000 }; // 10 attempts / 15 min per client
const EMAIL_LIMIT = { limit: 5, windowMs: 15 * 60 * 1000 };   // 5 attempts / 15 min per address
const UID_LIMIT = { limit: 5, windowMs: 15 * 60 * 1000 };     // 5 attempts / 15 min per account
const GENERIC_FAILURE = 'Invalid or expired verification code';

function tooMany(retryAfterMs: number) {
  return NextResponse.json(
    { error: 'Too many attempts' },
    { status: 429, headers: { 'Retry-After': String(retryAfterSeconds({ allowed: false, limit: 0, remaining: 0, retryAfterMs })) } }
  );
}

function failed() {
  return NextResponse.json({ error: GENERIC_FAILURE }, { status: 400 });
}

export const POST = withApi(async (request) => {
  const ipCheck = checkRateLimit(`verify-code:${clientKey(request)}`, CLIENT_LIMIT);
  if (!ipCheck.allowed) return tooMany(ipCheck.retryAfterMs);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') throw new HttpError(400, 'Invalid request body');
  const { email: rawEmail, code: rawCode } = body as Record<string, unknown>;

  const email = normalizeEmail(rawEmail);
  const code = typeof rawCode === 'string' ? rawCode.trim() : '';
  if (!email || !isOtpShape(code)) return failed();

  const emailCheck = checkRateLimit(`verify-code:email:${email}`, EMAIL_LIMIT);
  if (!emailCheck.allowed) return tooMany(emailCheck.retryAfterMs);

  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) throw new HttpError(503, 'Verification service unavailable');

  // Newest live code for the account that owns this e-mail (digest only).
  const records = await sql`
    SELECT vc.email_code, p.firebase_uid, p.role, p.status
    FROM verification_codes vc
    JOIN profiles p ON vc.user_uid = p.firebase_uid
    WHERE LOWER(p.email) = ${email}
      AND vc.expires_at > NOW()
    ORDER BY vc.created_at DESC
    LIMIT 1
  `;
  const record = records[0];
  if (!record) return failed();

  const { email_code: storedDigest, firebase_uid, role, status } = record;

  const uidCheck = checkRateLimit(`verify-code:uid:${firebase_uid}`, UID_LIMIT);
  if (!uidCheck.allowed) return tooMany(uidCheck.retryAfterMs);

  if (!verifyOtpHash(firebase_uid, code, secret, storedDigest)) return failed();

  // 🛑 الأهم: تفعيل الإيميل في Firebase ليتمكن من تسجيل الدخول! (idempotent)
  await getAdminAuth().updateUser(firebase_uid, { emailVerified: true });

  // تحديث قاعدة البيانات (idempotent)
  if (role === 'student') {
    await sql`UPDATE profiles SET email_verified = TRUE, status = 'active' WHERE firebase_uid = ${firebase_uid}`;
  } else {
    await sql`UPDATE profiles SET email_verified = TRUE WHERE firebase_uid = ${firebase_uid}`;
  }

  // حذف الكود بعد اكتمال التفعيل — يبقى قابلاً لإعادة المحاولة إذا فشلت خطوة أعلاه
  await sql`DELETE FROM verification_codes WHERE user_uid = ${firebase_uid}`;

  // Where the page sends the account next, by the same rule as sign-in: a
  // teacher account reaches teaching only once its application is approved.
  // A student is active from this point on.
  const home = accountHome(role, role === 'student' ? ACTIVE_ACCOUNT_STATUS : status);
  return NextResponse.json({ success: true, role, home });
});
