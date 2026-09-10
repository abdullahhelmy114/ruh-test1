import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { requireAuth } from '@/lib/auth';
import { withApi } from '@/lib/api/handler';

// Phase 2.2: returns the verified caller's own notifications. Edge runtime
// removed for firebase-admin compatibility.
export const GET = withApi(async (req) => {
  const user = await requireAuth(req);

  const notifications = await sql`
    SELECT * FROM notifications
    WHERE user_uid = ${user.uid}
    ORDER BY created_at DESC LIMIT 10
  `;
  return NextResponse.json({ notifications });
});
