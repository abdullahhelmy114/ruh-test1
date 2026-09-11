import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { requireAuth } from '@/lib/auth';
import { withApi } from '@/lib/api/handler';

// Phase 2.3a: previously unauthenticated — anyone could mark any message as
// read. Only the message's receiver (the verified caller) may do so; the
// UPDATE is scoped by receiver_uid so other users' rows are unaffected.
// Edge runtime removed for firebase-admin compatibility.
export const PUT = withApi<{ id: string }>(async (req, ctx) => {
  const user = await requireAuth(req);
  const { id } = await ctx.params;

  await sql`UPDATE messages SET read = true WHERE id = ${id} AND receiver_uid = ${user.uid}`;
  return NextResponse.json({ success: true });
});
