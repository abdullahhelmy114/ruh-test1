export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { describeMailFailure, sendEmail, verificationCodeEmail } from '@/lib/email';
import { HttpError } from '@/lib/auth';
import { withApi } from '@/lib/api/handler';
import { checkRateLimit, clientKey, normalizeEmail, retryAfterSeconds } from '@/lib/security/rate-limit';
import { generateOtp, hashOtp, otpExpiry } from '@/lib/security/otp';

// Phase 3 batch 4 — real resend. Batch 3 rate-limited this route, but it
// still wrote `email_verifications`, a table no verifier reads, so "Resend
// Code" on /verify-email never produced a usable code. It now issues a code
// for the account that owns the address into `verification_codes`, the
// table consumed by /api/verify-email-code and /api/verify-teacher:
//   - per-client limit, per-address limit and resend cooldown (429): kept
//   - code from the OTP helper (CSPRNG), stored as an HMAC digest
//   - previous rows for the account are replaced (one live code per account)
//   - the outward response is identical whether the address is unknown,
//     already verified, or freshly issued ({ success: true }); the address
//     itself is never confirmed to exist
// `email_verifications` is no longer written (its removal is a Phase 4
// schema decision).

const IP_LIMIT = { limit: 10, windowMs: 15 * 60 * 1000 };     // 10 sends / 15 min per client
const EMAIL_LIMIT = { limit: 3, windowMs: 15 * 60 * 1000 };   // 3 sends / 15 min per address
const RESEND_COOLDOWN = { limit: 1, windowMs: 60 * 1000 };    // 1 send / 60 s per address

function tooMany(retryAfterMs: number) {
  return NextResponse.json(
    { error: 'Too many requests' },
    { status: 429, headers: { 'Retry-After': String(retryAfterSeconds({ allowed: false, limit: 0, remaining: 0, retryAfterMs })) } }
  );
}

function ok() {
  return NextResponse.json({ success: true });
}

export const POST = withApi(async (request) => {
  const ipCheck = checkRateLimit(`verify-send:${clientKey(request)}`, IP_LIMIT);
  if (!ipCheck.allowed) return tooMany(ipCheck.retryAfterMs);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') throw new HttpError(400, 'Invalid request body');
  const email = normalizeEmail((body as Record<string, unknown>).email);
  if (!email) return NextResponse.json({ error: 'Missing email' }, { status: 400 });

  const cooldown = checkRateLimit(`verify-send:cooldown:${email}`, RESEND_COOLDOWN);
  if (!cooldown.allowed) return tooMany(cooldown.retryAfterMs);
  const emailCheck = checkRateLimit(`verify-send:email:${email}`, EMAIL_LIMIT);
  if (!emailCheck.allowed) return tooMany(emailCheck.retryAfterMs);

  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) throw new HttpError(503, 'Verification service unavailable');

  try {
    // الحساب الذي يملك هذا البريد (إن وُجد ولم يُفعَّل بعد)
    const profiles = await sql`
      SELECT firebase_uid, email_verified FROM profiles WHERE LOWER(email) = ${email} LIMIT 1
    `;
    const profile = profiles[0];
    if (!profile || profile.email_verified === true) return ok(); // uniform: never reveal account state

    const uid: string = profile.firebase_uid;
    const code = generateOtp();
    const digest = hashOtp(uid, code, secret);

    // كود واحد صالح لكل حساب: حذف السابق ثم إدراج الجديد
    await sql`DELETE FROM verification_codes WHERE user_uid = ${uid}`;
    await sql`INSERT INTO verification_codes (user_uid, email_code, expires_at) VALUES (${uid}, ${digest}, ${otpExpiry()})`;

    await sendEmail(email, 'Your Verification Code', verificationCodeEmail(code));
  } catch (error) {
    console.error('Verification code send error:', describeMailFailure(error));
    return NextResponse.json({ error: 'Failed to send verification code' }, { status: 500 });
  }

  return ok();
});
