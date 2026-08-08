export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const uid = searchParams.get('uid');
  if (!uid) return NextResponse.json({ notifications: [] });

  try {
    const notifications = await sql`
      SELECT * FROM notifications
      WHERE user_uid = ${uid}
      ORDER BY created_at DESC LIMIT 10
    `;
    return NextResponse.json({ notifications });
  } catch (error: any) {
    return NextResponse.json({ notifications: [], error: error.message });
  }
}