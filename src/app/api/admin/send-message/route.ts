export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { sendEmail } from '@/lib/email';
import { requireAdmin } from '@/lib/auth';
import { withApi } from '@/lib/api/handler';

// Phase 2.1: previously anyone could email any user from the academy's
// trusted sender with unescaped HTML. Admin session required; `userId` in the
// body is the TARGET recipient only (the caller is the verified admin), and
// the message is HTML-escaped before being placed in the template.

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const POST = withApi(async (req) => {
  await requireAdmin(req);

  const { userId, message } = await req.json();
  if (typeof userId !== 'string' || !userId || typeof message !== 'string' || !message.trim()) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  // جلب بريد المستخدم (المستلم المستهدف)
  const [user] = await sql`SELECT email, full_name FROM profiles WHERE firebase_uid = ${userId}`;
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const safeMessage = escapeHtml(message).replace(/\r?\n/g, '<br />');
  await sendEmail(user.email, 'Message from Admin', `<p>${safeMessage}</p>`);

  return NextResponse.json({ success: true });
});
