import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { requireAuth } from '@/lib/auth';
import { withApi } from '@/lib/api/handler';

// Phase 2.2: updates the verified caller's own profile; the client no longer
// supplies uid. Edge runtime removed for firebase-admin compatibility.
export const POST = withApi(async (req) => {
  const user = await requireAuth(req);

  const { bio, country, interests } = await req.json();

  await sql`
    UPDATE profiles
    SET bio = ${bio || ''}, country = ${country || ''}, interests = ${interests || ''}, profile_completed = true
    WHERE firebase_uid = ${user.uid}
  `;
  return NextResponse.json({ success: true });
});
