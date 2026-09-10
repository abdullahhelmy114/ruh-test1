import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { requireAuth, requireSelfOrAdmin } from '@/lib/auth';
import { withApi } from '@/lib/api/handler';

// Phase 2.2: returns the verified caller's own enrollments by default. An
// explicit ?uid= is honoured only for the caller themself or an admin
// (requireSelfOrAdmin → 403 otherwise). Edge runtime removed for
// firebase-admin compatibility.
export const GET = withApi(async (req) => {
  const requested = new URL(req.url).searchParams.get('uid');
  const user = requested ? await requireSelfOrAdmin(req, requested) : await requireAuth(req);
  const uid = requested ?? user.uid;

  const course = await sql`
    SELECT c.id, c.title, c.level, c.price, c.teacher_uid,
           COUNT(l.id) as total_lessons,
           COUNT(lc.lesson_id) as completed_lessons,
           e.enrolled_at
    FROM enrollments e
    JOIN course c ON e.course_id = c.id
    LEFT JOIN lessons l ON l.course_id = c.id
    LEFT JOIN lesson_completions lc ON lc.lesson_id = l.id AND lc.user_uid = ${uid}
    WHERE e.user_uid = ${uid}
    GROUP BY c.id, e.enrolled_at
    ORDER BY e.enrolled_at DESC
  `;
  return NextResponse.json({ course });
});
