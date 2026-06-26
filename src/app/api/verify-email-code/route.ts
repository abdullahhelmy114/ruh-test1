export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';

export async function POST(request: Request) {
  try {
    const { email, code } = await request.json();
    if (!email || !code) return NextResponse.json({ error: 'Missing email or code' }, { status: 400 });

    const trimmedCode = code.trim(); // إزالة المسافات

    const records = await sql`
      SELECT vc.id, vc.email_code, vc.expires_at, u.firebase_uid, u.role
      FROM verification_codes vc
      JOIN profiles u ON vc.user_uid = u.firebase_uid
      WHERE LOWER(u.email) = LOWER(${email})
        AND vc.email_code = ${trimmedCode}
        AND vc.expires_at > NOW()
      ORDER BY vc.created_at DESC
      LIMIT 1
    `;

    if (records.length === 0) {
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 });
    }

    const { firebase_uid, role } = records[0];

    if (role === 'student') {
      await sql`UPDATE profiles SET status = 'active' WHERE firebase_uid = ${firebase_uid};`;
    } else if (role === 'teacher') {
      await sql`UPDATE profiles SET status = 'active' WHERE firebase_uid = ${firebase_uid}`;
    } else {
      await sql`UPDATE profiles SET status = 'active' WHERE firebase_uid = ${firebase_uid}`;
    }

    await sql`DELETE FROM verification_codes WHERE user_uid = ${firebase_uid}`;

    return NextResponse.json({ success: true, role });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}