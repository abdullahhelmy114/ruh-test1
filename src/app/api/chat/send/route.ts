export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import Pusher from 'pusher';
import { sql } from '@/lib/db/client';
import { requireAuth } from '@/lib/auth';
import { withApi } from '@/lib/api/handler';
import { checkRateLimit, retryAfterSeconds } from '@/lib/security/rate-limit';
import { boundedString, isPusherChannelShape } from '@/lib/security/input-policy';

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
//
// Phase 3 batch 5 — mechanical abuse controls only:
//   - 60 messages / 10 min per verified sender uid
//   - message 1..1,000 chars
//   - room must be a Pusher-shaped channel name (<= 164 chars, letters,
//     digits and _ - = @ , . ;)
// OPEN (PRODUCT-POLICY DEPENDENCY, not solved by rate limiting): WHO MAY
// PUBLISH TO WHICH PUSHER CHANNEL. Rate limiting bounds volume, it does not
// authorise the target.
const SENDER_LIMIT = { limit: 60, windowMs: 10 * 60 * 1000 };
const MESSAGE_MAX = 1000;

export const POST = withApi(async (req) => {
  const user = await requireAuth(req);

  const check = checkRateLimit(`chat-send:${user.uid}`, SENDER_LIMIT);
  if (!check.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSeconds(check)) } }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }
  const { room, message: rawMessage } = body as Record<string, unknown>;
  const message = boundedString(rawMessage, { max: MESSAGE_MAX });
  if (!isPusherChannelShape(room) || !message) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const [profile] = await sql`SELECT full_name FROM profiles WHERE firebase_uid = ${user.uid}`;
  const displayName = profile?.full_name || user.email?.split('@')[0] || 'User';

  await pusher.trigger(room, 'message', { user: displayName, message, time: new Date().toISOString() });
  return NextResponse.json({ success: true });
});
