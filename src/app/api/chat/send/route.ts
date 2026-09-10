export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import Pusher from 'pusher';
import { sql } from '@/lib/db/client';
import { requireAuth } from '@/lib/auth';
import { withApi } from '@/lib/api/handler';

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true,
});

// Phase 2.2: the display identity of the sender comes from the verified
// caller's profile, never from body.user. `room` remains the target channel.
// REVIEW_REQUIRED: room membership rules are not defined; any authenticated
// user may still publish to any room. Do not treat this as a messaging policy.
export const POST = withApi(async (req) => {
  const user = await requireAuth(req);

  const { room, message } = await req.json();
  if (typeof room !== 'string' || !room || typeof message !== 'string' || !message.trim()) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const [profile] = await sql`SELECT full_name FROM profiles WHERE firebase_uid = ${user.uid}`;
  const displayName = profile?.full_name || user.email?.split('@')[0] || 'User';

  await pusher.trigger(room, 'message', { user: displayName, message, time: new Date().toISOString() });
  return NextResponse.json({ success: true });
});
