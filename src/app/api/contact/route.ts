export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { sendEmail, contactFormEmail } from '@/lib/email';
import { HttpError } from '@/lib/auth';
import { withApi } from '@/lib/api/handler';
import { checkRateLimit, clientKey, normalizeEmail, retryAfterSeconds } from '@/lib/security/rate-limit';
import { verifyRecaptcha } from '@/lib/security/captcha';

// Phase 3 batch 3 — public abuse gate.
// This route only ever checked that `captchaToken` was non-empty, and the
// form supplied a predictable client-side puzzle token. Now:
//   - the contact form renders Google reCAPTCHA and the token is verified
//     server-side (mandatory; fails closed on missing secret/provider error)
//   - per-IP rate limit (429)
//   - strict length caps on name, email and message; email shape validated
//   - malformed bodies rejected with fixed messages; no error.message leak
// OPEN (not this batch): HTML escaping inside contactFormEmail lives in
// src/lib/email.ts, which is user-modified and excluded.

const IP_LIMIT = { limit: 5, windowMs: 15 * 60 * 1000 }; // 5 messages / 15 min per client
const NAME_MAX = 100;
const MESSAGE_MAX = 5000;

export const POST = withApi(async (request) => {
  const ipCheck = checkRateLimit(`contact:${clientKey(request)}`, IP_LIMIT);
  if (!ipCheck.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSeconds(ipCheck)) } }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') throw new HttpError(400, 'Invalid request body');
  const { name: rawName, email: rawEmail, message: rawMessage, captchaToken } = body as Record<string, unknown>;

  const name = typeof rawName === 'string' ? rawName.trim() : '';
  const email = normalizeEmail(rawEmail);
  const message = typeof rawMessage === 'string' ? rawMessage.trim() : '';

  if (!name || !email || !message || typeof captchaToken !== 'string' || !captchaToken) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }
  if (name.length > NAME_MAX || message.length > MESSAGE_MAX) {
    return NextResponse.json({ error: 'Input too long' }, { status: 400 });
  }

  // Mandatory server-side reCAPTCHA verification (fails closed).
  const captcha = await verifyRecaptcha(captchaToken, process.env.RECAPTCHA_SECRET_KEY);
  if (!captcha.ok) {
    return NextResponse.json({ error: 'Captcha verification failed' }, { status: 400 });
  }

  try {
    // إرسال الإيميل للإدارة
    await sendEmail(
      'info@ruhulqudus.com',
      'New Contact Message',
      contactFormEmail(name, email, message)
    );
  } catch (error) {
    console.error('Contact email error:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
});
