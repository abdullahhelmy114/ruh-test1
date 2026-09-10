import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { requireAuth } from '@/lib/auth';
import { withApi } from '@/lib/api/handler';

// Phase 2.2: counts unread messages for the verified caller only. Edge
// runtime removed for firebase-admin compatibility.
export const GET = withApi(async (req) => {
  const user = await requireAuth(req);

  const [result] = await sql`
    SELECT COUNT(*)::int AS count FROM messages WHERE receiver_uid = ${user.uid} AND read = false
  `;
  return NextResponse.json({ count: result?.count || 0 });
});
