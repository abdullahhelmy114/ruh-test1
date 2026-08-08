export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';

export async function POST(request: Request) {
  try {
    const { uid, token } = await request.json();
    if (!uid || !token) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    await sql`UPDATE profiles SET fcm_token = ${token} WHERE firebase_uid = ${uid}`;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}