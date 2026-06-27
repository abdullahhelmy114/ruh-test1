export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { getAdminMessaging } from '@/lib/firebase/admin';

// POST: إرسال رسالة جديدة
export async function POST(request: Request) {
  try {
    const { senderUid, receiverUid, message } = await request.json();
    if (!senderUid || !receiverUid || !message) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    // إدراج الرسالة
    await sql`
      INSERT INTO messages (sender_uid, receiver_uid, message)
      VALUES (${senderUid}, ${receiverUid}, ${message})
    `;

    // 1. إشعار داخلي (نقوم بإدراجه مباشرة هنا)
    const [sender] = await sql`
      SELECT first_name, last_name FROM users WHERE uid = ${senderUid}
    `;
    const senderName = sender
      ? `${sender.first_name || ''} ${sender.last_name || ''}`.trim()
      : 'Someone';
    await sql`
      INSERT INTO notifications (user_uid, message, link)
      VALUES (${receiverUid}, ${'New message from ' + senderName}, '/messages')
    `;

    // 2. إرسال Web Push (إن أمكن)
    const [receiver] = await sql`
      SELECT fcm_token FROM users WHERE uid = ${receiverUid}
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
        // تجاهل فشل إرسال الإشعار
        console.error('Push notification failed:', e);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET: جلب رسائل المستخدم الحالي (المستقبل)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const uid = searchParams.get('uid');
  if (!uid) return NextResponse.json({ error: 'Missing uid' }, { status: 400 });

  try {
    const messages = await sql`
      SELECT m.*,
             u.first_name || ' ' || u.last_name AS sender_name,
             NULL AS sender_avatar   -- لا يوجد حقل avatar حالياً
      FROM messages m
      JOIN users u ON m.sender_uid = u.uid
      WHERE m.receiver_uid = ${uid}
      ORDER BY m.created_at DESC
      LIMIT 100
    `;
    return NextResponse.json({ messages });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}