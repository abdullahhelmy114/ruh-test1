export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const uid = searchParams.get('uid');
  if (!uid) return NextResponse.json({ error: 'Missing uid' }, { status: 400 });

  try {
    const [user] = await sql`SELECT * FROM users WHERE uid = ${uid}`;
    if (!user) return NextResponse.json({ profile: null });
    return NextResponse.json({ profile: user });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: يبقى كما هو بالضبط
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const uid = body.uid || "";
    const email = body.email || "";

    if (!uid || !email) {
      return NextResponse.json({ skipped: true });
    }

    const emailVerified = body.email_verified === true;
    const referredBy = body.referred_by || null;
    const fullName = body.fullName || '';
    const [firstName, ...lastNameArr] = fullName.split(' ');
    const lastName = lastNameArr.join(' ') || '';

    await sql`
      INSERT INTO users (uid, email, first_name, last_name, role, is_verified, referred_by)
      VALUES (${uid}, ${email}, ${firstName}, ${lastName}, ${body.role || 'student'}, ${emailVerified}, ${referredBy})
      ON CONFLICT (uid) DO UPDATE SET email = ${email}, is_verified = ${emailVerified}
    `;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}