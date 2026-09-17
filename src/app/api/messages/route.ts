export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { getAdminMessaging } from '@/lib/firebase/admin';
import { requireAuth } from '@/lib/auth';
import { withApi } from '@/lib/api/handler';
import { checkRateLimit, retryAfterSeconds } from '@/lib/security/rate-limit';
import { boundedString, isFirebaseUidShape } from '@/lib/security/input-policy';
import { mayDirectMessage, type LegacyMessagingFacts } from '@/lib/security/messaging-guard';
import { academyFlags, relationshipFacts } from '@/lib/academy/server';
import { AuthError, sessionRoleFor, type Role } from '@/lib/auth/core';

// Phase 2.2: the sender is always the verified caller (user.uid); the client
// no longer supplies senderUid. receiverUid remains the target.
//
// Launch closure: who may message whom is now enforced before any write
// (mayDirectMessage): administrators with anyone, a learner and a teacher only
// inside an active academic relationship, and never learner-to-learner or
// teacher-to-teacher. An unknown recipient and a forbidden one get the same
// generic 403, so no account-existence oracle is added.
//
// Phase 3 batch 5 — mechanical spam/amplification controls only (each send
// writes two rows and can trigger one push):
//   - 30 messages / 10 min per verified sender uid
//   - message 1..2,000 chars; receiverUid must be a bounded uid-shaped string
//   - malformed input gets one generic 400; no existence oracle is added
//     (the insert does not require the receiver to exist, so none is needed)
// Messaging relationships / conversation membership remain undefined.
const SENDER_LIMIT = { limit: 30, windowMs: 10 * 60 * 1000 };
const MESSAGE_MAX = 2000;

const ROLES: readonly Role[] = ['admin', 'teacher', 'student'];

const legacyMessagingFacts: LegacyMessagingFacts = {
  async roleOf(uid) {
    const [profile] = await sql`SELECT role, status FROM profiles WHERE firebase_uid = ${uid}`;
    const role = profile?.role;
    if (typeof role !== 'string' || !(ROLES as readonly string[]).includes(role)) return null;
    // The role the account acts as now: a teacher account that is not active cannot be messaged.
    return sessionRoleFor(role as Role, typeof profile.status === 'string' ? profile.status : null);
  },
  async hasTeachingRelationship(teacherUid, learnerUid) {
    // Legacy relationship: an enrollment that is still in progress in a course the teacher teaches.
    const [legacy] = await sql`
      SELECT 1 FROM enrollments e
      JOIN course c ON c.id = e.course_id
      WHERE e.user_uid = ${learnerUid} AND c.teacher_uid = ${teacherUid} AND COALESCE(e.completed, false) = false
      LIMIT 1
    `;
    if (legacy) return true;
    // Academy relationship, once the academy schema is live.
    return academyFlags.coreSchemaReady ? relationshipFacts.hasActiveTeachingRelationship(teacherUid, learnerUid) : false;
  },
};

// POST: إرسال رسالة جديدة
export const POST = withApi(async (req) => {
  const user = await requireAuth(req);

  const check = checkRateLimit(`messages:${user.uid}`, SENDER_LIMIT);
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
  const { receiverUid, message: rawMessage } = body as Record<string, unknown>;
  const message = boundedString(rawMessage, { max: MESSAGE_MAX });
  if (!isFirebaseUidShape(receiverUid) || !message) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  if (!(await mayDirectMessage({ uid: user.uid, role: user.role }, receiverUid, legacyMessagingFacts))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
      console.error('Push notification failed:', e instanceof Error ? e.name : 'unknown');
    }
  }

  return NextResponse.json({ success: true });
});

// GET: جلب رسائل المستخدم الحالي (المستقبل)
// A teacher account that is not active takes part in no conversation, reading included.
export const GET = withApi(async (req) => {
  const user = await requireAuth(req);
  if (user.role === 'applicant') throw new AuthError('FORBIDDEN');

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
