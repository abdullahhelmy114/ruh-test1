import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';
import { HttpError } from '@/lib/auth';
import { withApi } from '@/lib/api/handler';
import { checkRateLimit, clientKey, normalizeEmail, retryAfterSeconds } from '@/lib/security/rate-limit';
import { verifyRecaptcha } from '@/lib/security/captcha';

// Phase 3 batch 3 — public abuse gate.
// Previously the reCAPTCHA check ran only `if (captchaToken)`, so omitting
// the field turned this route into an unauthenticated sender of attacker-
// controlled HTML to any address. Now:
//   - captchaToken is mandatory and verified server-side (fail closed)
//   - per-IP and per-email limits bound the send volume
//   - `name` is HTML-escaped and length-capped before it enters the template
//   - malformed bodies and emails are rejected with fixed messages
// Response shape ({ success: true }) is unchanged. No page in the repository
// calls this route today.

const IP_LIMIT = { limit: 5, windowMs: 10 * 60 * 1000 };   // 5 welcome emails / 10 min per client
const EMAIL_LIMIT = { limit: 2, windowMs: 60 * 60 * 1000 }; // 2 per recipient address / hour
const NAME_MAX = 100;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function tooMany(retryAfterMs: number) {
  return NextResponse.json(
    { error: 'Too many requests' },
    { status: 429, headers: { 'Retry-After': String(retryAfterSeconds({ allowed: false, limit: 0, remaining: 0, retryAfterMs })) } }
  );
}

export const POST = withApi(async (request) => {
  const ip = clientKey(request);
  const ipCheck = checkRateLimit(`signup:${ip}`, IP_LIMIT);
  if (!ipCheck.allowed) return tooMany(ipCheck.retryAfterMs);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') throw new HttpError(400, 'Invalid request body');
  const { email: rawEmail, name: rawName, captchaToken } = body as Record<string, unknown>;

  const email = normalizeEmail(rawEmail);
  const name = typeof rawName === 'string' ? rawName.trim() : '';
  if (!email || !name || name.length > NAME_MAX) {
    return NextResponse.json({ error: 'Missing email or name' }, { status: 400 });
  }

  // reCAPTCHA is mandatory; the helper fails closed on missing secret,
  // malformed token, provider error or timeout.
  const captcha = await verifyRecaptcha(captchaToken, process.env.RECAPTCHA_SECRET_KEY);
  if (!captcha.ok) {
    return NextResponse.json({ error: 'Captcha verification failed' }, { status: 400 });
  }

  const emailCheck = checkRateLimit(`signup:email:${email}`, EMAIL_LIMIT);
  if (!emailCheck.allowed) return tooMany(emailCheck.retryAfterMs);

  try {
    // إرسال بريد الترحيب
    await sendEmail(
      email,
      'Welcome to Ruh-Ul-Qudus Academy!',
      `<h1>Welcome, ${escapeHtml(name)}!</h1>
       <p>Your account has been created successfully.</p>
       <p>Start your learning journey today: <a href="https://ruhulqudus.com/courses">Browse course</a></p>`
    );
  } catch (error) {
    console.error('Signup welcome email error:', error);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
});
