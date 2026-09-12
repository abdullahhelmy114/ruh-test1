export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { randomInt } from 'crypto';
import { sql } from '@/lib/db/client';
import { sendEmail, verificationCodeEmail } from '@/lib/email';
import { HttpError } from '@/lib/auth';
import { withApi } from '@/lib/api/handler';
import { checkRateLimit, clientKey, normalizeEmail, retryAfterSeconds } from '@/lib/security/rate-limit';

// Phase 3 batch 3 — stop email bombing.
// Previously any caller could send unlimited codes to any address, and the
// code came from Math.random. Now:
//   - email is normalised and shape-checked
//   - per-IP limit, per-email limit and a per-email resend cooldown (429)
//   - the 6-digit code comes from crypto.randomInt
//   - responses are uniform ({ success: true }) and never reveal whether an
//     account exists; internal errors return a fixed message
// Storage format (email_verifications: email, 6-digit code, 15-minute expiry)
// is unchanged so current consumers keep working. Hashing and durable
// attempt counters are the OTP batch / Phase 4.

const IP_LIMIT = { limit: 10, windowMs: 15 * 60 * 1000 };     // 10 sends / 15 min per client
const EMAIL_LIMIT = { limit: 3, windowMs: 15 * 60 * 1000 };   // 3 sends / 15 min per address
const RESEND_COOLDOWN = { limit: 1, windowMs: 60 * 1000 };    // 1 send / 60 s per address
const CODE_TTL_MS = 15 * 60 * 1000;

function tooMany(retryAfterMs: number) {
  return NextResponse.json(
    { error: 'Too many requests' },
    { status: 429, headers: { 'Retry-After': String(retryAfterSeconds({ allowed: false, limit: 0, remaining: 0, retryAfterMs })) } }
  );
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

  try {
    // إنشاء كود عشوائي من 6 أرقام (CSPRNG)
    const code = String(randomInt(100000, 1000000));
    const expiresAt = new Date(Date.now() + CODE_TTL_MS); // صالح لمدة 15 دقيقة

    // حذف أي كود سابق لنفس البريد
    await sql`DELETE FROM email_verifications WHERE email = ${email}`;

    // تخزين الكود الجديد
    await sql`INSERT INTO email_verifications (email, code, expires_at) VALUES (${email}, ${code}, ${expiresAt})`;

    // إرسال الكود عبر البريد
    await sendEmail(email, 'Your Verification Code', verificationCodeEmail(code));
  } catch (error) {
    console.error('Verification code send error:', error);
    return NextResponse.json({ error: 'Failed to send verification code' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
});
