export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { getServerSession } from '@/lib/auth';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const uid = searchParams.get('uid'); // هذا هو firebase_uid
  if (!uid) return NextResponse.json({ error: 'Missing uid' }, { status: 400 });

  try {
    const [profile] = await sql`SELECT * FROM profiles WHERE firebase_uid = ${uid}`;
    if (!profile) return NextResponse.json({ profile: null });
    return NextResponse.json({ profile });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: إنشاء/تحديث الملف الشخصي للمستخدم المسجّل دخوله فقط.
// Phase 0 containment: identity comes from the verified session, never from the
// body, and `role` can no longer be set by the client. Existing rows keep their
// role; new rows default to 'student'.
export async function POST(request: Request) {
  const session = await getServerSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email : '';

    if (!email) {
      return NextResponse.json({ skipped: true });
    }

    const emailVerified = body.email_verified === true;
    const referredBy = typeof body.referred_by === 'string' ? body.referred_by : null;
    const fullName = typeof body.fullName === 'string' ? body.fullName : '';

    await sql`
      INSERT INTO profiles (firebase_uid, email, full_name, role, email_verified, referred_by)
      VALUES (${session.uid}, ${email}, ${fullName}, 'student', ${emailVerified}, ${referredBy})
      ON CONFLICT (firebase_uid) DO UPDATE SET
        email = ${email},
        full_name = ${fullName},
        email_verified = ${emailVerified},
        referred_by = COALESCE(profiles.referred_by, ${referredBy})
    `;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Profile upsert failed:', error);
    return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 });
  }
}
