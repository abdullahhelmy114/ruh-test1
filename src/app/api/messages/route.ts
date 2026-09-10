export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { getAdminMessaging } from '@/lib/firebase/admin';
import { requireAuth } from '@/lib/auth';
import { withApi } from '@/lib/api/handler';

// Phase 2.2: the sender is always the verified caller (user.uid); the client
// no longer supplies senderUid. receiverUid remains the target.
// REVIEW_REQUIRED: who may message whom is not defined; any authenticated
// user may still message any uid. Do not treat this as a messaging policy.

// POST: إرسال رسالة جديدة
export const POST = withApi(async (req) => {
  const user = await requireAuth(req);

  const { receiverUid, message } = await req.json();
  if (typeof receiverUid !== 'string' || !receiverUid || typeof message !== 'string' || !message) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  // إدراج الرسالة
  await sql`
    INSERT INTO messages (sender_uid, receiver_uid, message)
    VALUES (${user.uid}, ${receiverUid}, ${message})
  `;

  // 1. إشعار داخلي
  const [sender] = await sql`
    SELECT full_name FROM profiles WHERE firebase_uid = ${user.uid}
  `;
  const senderName = sender?.full_name || 'Someone';
  await sql`
    INSERT INTO notifications (user_uid, message, link)
    VALUES (${receiverUid}, ${'New message from ' + senderName}, '/messages')
  `;

  // 2. إرسال Web Push (إن أمكن)
  const [receiver] = await sql`
    SELECT fcm_token FROM profiles WHERE firebase_uid = ${receiverUid}
  `;
  if (receiver?.fcm_token) {
    try {
      await getAdminMessaging().send({
        token: receiver.fcm_token,
        notification: {
          title: 'New Message',
          body: message.slice(0, 100),
        },
      });
    } catch (e) {
      console.error('Push notification failed:', e);
    }
  }

  return NextResponse.json({ success: true });
});

// GET: جلب رسائل المستخدم الحالي (المستقبل)
export const GET = withApi(async (req) => {
  const user = await requireAuth(req);

  const messages = await sql`
    SELECT m.*,
           u.full_name AS sender_name,
           NULL AS sender_avatar
    FROM messages m
    JOIN profiles u ON m.sender_uid = u.firebase_uid
    WHERE m.receiver_uid = ${user.uid}
    ORDER BY m.created_at DESC
    LIMIT 100
  `;
  return NextResponse.json({ messages });
});
