export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';

export async function POST(request: Request) {
  try {
    const { uid, email, fullName, role } = await request.json();
    if (!uid || !email) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    await sql`
      INSERT INTO profiles (firebase_uid, email, full_name, role, email_verified)
      VALUES (${uid}, ${email}, ${fullName}, ${role}, false)
      ON CONFLICT (firebase_uid) DO UPDATE SET email = ${email}
    `;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}