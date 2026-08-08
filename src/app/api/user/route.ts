export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';

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

// POST: إنشاء/تحديث ملف شخصي
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const uid = body.uid || "";             // firebase_uid
    const email = body.email || "";

    if (!uid || !email) {
      return NextResponse.json({ skipped: true });
    }

    const emailVerified = body.email_verified === true;
    const referredBy = body.referred_by || null;
    const fullName = body.fullName || '';

    await sql`
      INSERT INTO profiles (firebase_uid, email, full_name, role, email_verified, referred_by)
      VALUES (${uid}, ${email}, ${fullName}, ${body.role || 'student'}, ${emailVerified}, ${referredBy})
      ON CONFLICT (firebase_uid) DO UPDATE SET
        email = ${email},
        full_name = ${fullName},
        role = ${body.role || 'student'},
        email_verified = ${emailVerified},
        referred_by = ${referredBy}
    `;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}