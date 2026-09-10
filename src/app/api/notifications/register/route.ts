import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { requireAuth } from '@/lib/auth';
import { withApi } from '@/lib/api/handler';

// Phase 2.2: the FCM token is stored on the verified caller's own profile;
// the client no longer supplies uid. Edge runtime removed for firebase-admin
// compatibility.
export const POST = withApi(async (req) => {
  const user = await requireAuth(req);

  const { token } = await req.json();
  if (typeof token !== 'string' || !token) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  await sql`UPDATE profiles SET fcm_token = ${token} WHERE firebase_uid = ${user.uid}`;
  return NextResponse.json({ success: true });
});
