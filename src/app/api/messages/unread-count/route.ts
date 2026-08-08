export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const uid = searchParams.get('uid');
  if (!uid) return NextResponse.json({ count: 0 });

  try {
    const [result] = await sql`
      SELECT COUNT(*)::int AS count FROM messages WHERE receiver_uid = ${uid} AND read = false
    `;
    return NextResponse.json({ count: result?.count || 0 });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}