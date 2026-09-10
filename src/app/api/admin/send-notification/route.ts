export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { requireAdmin } from '@/lib/auth';
import { withApi } from '@/lib/api/handler';

// Phase 2.1: previously anyone could broadcast an in-app notification to
// every verified user. Admin session required. Business behavior unchanged.
export const POST = withApi(async (req) => {
  await requireAdmin(req);

  const { title, body } = await req.json();
  if (typeof title !== 'string' || !title.trim() || typeof body !== 'string' || !body.trim()) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  // استعلام المستخدمين المفعلين من جدول profiles (استخدام email_verified)
  const users = await sql`SELECT firebase_uid FROM profiles WHERE email_verified = true`;
  const message = `${title}: ${body}`;

  for (const user of users) {
    await sql`
      INSERT INTO notifications (user_uid, message, link)
      VALUES (${user.firebase_uid}, ${message}, '/dashboard')
    `;
  }

  return NextResponse.json({ success: true, count: users.length });
});
