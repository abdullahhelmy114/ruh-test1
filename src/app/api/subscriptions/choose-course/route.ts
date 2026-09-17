import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { requireAuth } from '@/lib/auth';
import { withApi } from '@/lib/api/handler';

// A subscriber chooses one live course from their active subscription.
//
// Identity comes from the central auth layer (withApi + requireAuth).
// subscriptions.user_uid is profiles.id, joined through profiles.firebase_uid
// (the documented key of this table).
//
// The limit used to be checked in one statement and the counter raised in
// another, so parallel requests could choose more courses than the
// subscription allows. The counter is now raised only while it is below the
// limit (re-checked on the locked row) and the course is recorded only when
// that raise succeeded, in one statement.
export const POST = withApi(async (req) => {
  const user = await requireAuth(req);

  const body = await req.json().catch(() => null);
  const course_id = body?.course_id;
  if (typeof course_id !== 'string' || !course_id) {
    return NextResponse.json({ error: 'معرف الكورس مطلوب' }, { status: 400 });
  }

  const [subscription] = await sql`
    SELECT s.id, s.max_course, s.course_used
    FROM subscriptions s
    JOIN profiles p ON s.user_uid = p.id
    WHERE p.firebase_uid = ${user.uid} AND s.expires_at > NOW()
    LIMIT 1
  `;
  if (!subscription) {
    return NextResponse.json({ error: 'لا يوجد اشتراك نشط' }, { status: 403 });
  }

  const [liveCourse] = await sql`SELECT id FROM live_course WHERE id = ${course_id} AND status = 'active'`;
  if (!liveCourse) {
    return NextResponse.json({ error: 'الكورس غير متاح' }, { status: 404 });
  }

  const alreadyChosen = await sql`
    SELECT id FROM subscription_course WHERE subscription_id = ${subscription.id} AND course_id = ${course_id}
  `;
  if (alreadyChosen.length > 0) {
    return NextResponse.json({ error: 'الكورس تم اختياره بالفعل' }, { status: 409 });
  }

  const [outcome] = await sql`
    WITH counted AS (
      UPDATE subscriptions
      SET course_used = course_used + 1
      WHERE id = ${subscription.id} AND course_used < max_course AND expires_at > NOW()
      RETURNING id
    ), chosen AS (
      INSERT INTO subscription_course (subscription_id, course_id)
      SELECT id, ${course_id} FROM counted
      RETURNING id
    )
    SELECT (SELECT count(*) FROM chosen)::int AS chosen
  `;
  if (!outcome || outcome.chosen !== 1) {
    return NextResponse.json({ error: 'لقد وصلت للحد الأقصى من الكورسات' }, { status: 400 });
  }

  // Enroll the student in the chosen course.
  await sql`
    INSERT INTO enrollments (user_uid, course_id)
    VALUES (${user.uid}, ${course_id})
    ON CONFLICT (user_uid, course_id) DO NOTHING
  `;

  return NextResponse.json({ success: true });
});
