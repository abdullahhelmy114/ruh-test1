import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { requireTeacher } from '@/lib/auth';
import { withApi } from '@/lib/api/handler';

// Launch closure: Next 16 params are a Promise; the synchronous read made
// params.courseId undefined, so this route could never find a course.
export const GET = withApi<{ courseId: string }>(async (req, ctx) => {
  const session = await requireTeacher(req);
  const params = await ctx.params;

  // التحقق من أن المعلم يملك هذا الكورس الحي
  // live_course.teacher_uid holds the Firebase uid (profiles.firebase_uid, as the
  // approval route writes it); the former profiles.id comparison never matched.
  const [liveCourse] = await sql`
    SELECT model_course_id FROM live_course
    WHERE id = ${params.courseId}
    AND teacher_uid = ${session.uid}
  `;
  if (!liveCourse) {
    return NextResponse.json({ error: 'الكورس غير موجود' }, { status: 404 });
  }

  const modelLessons = await sql`
    SELECT id, title, order_index, type, script_pdf_url, duration_minutes
    FROM model_lessons
    WHERE model_course_id = ${liveCourse.model_course_id}
    ORDER BY order_index ASC
  `;

  const liveLessons = await sql`
    SELECT id, model_lesson_id, recording_url
    FROM live_lessons
    WHERE live_course_id = ${params.courseId}
  `;

  return NextResponse.json({ modelLessons, liveLessons });
});