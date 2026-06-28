export const runtime = 'nodejs'; // أفضل من edge لتوافق sql

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';

export async function GET() {
  try {
    const users = await sql`
      SELECT firebase_uid, email, full_name, role, status, created_at
      FROM profiles
      ORDER BY created_at DESC
    `;
    return NextResponse.json({ users });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}