export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const uid = searchParams.get('uid');
    if (!uid) return NextResponse.json({ error: 'Missing uid' }, { status: 400 });

    const rows = await sql`SELECT * FROM profiles WHERE firebase_uid = ${uid}`;
    
    if (rows.length === 0) {
      return NextResponse.json({ profile: null, message: 'Profile not found' });
    }

    return NextResponse.json({ profile: rows[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}