export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { requireStudent, requireEnrolled, HttpError } from '@/lib/auth';
import { withApi } from '@/lib/api/handler';

// Phase 2.4a: completion is recorded for the verified caller only, and only
// for a lesson that exists and belongs to a course the student is enrolled in
// (admin bypass). Lesson approval status is not enforced: the repository
// uses several lesson creation paths with different status values, so that
// rule is a product decision (REVIEW, Phase 4).
export const POST = withApi(async (req) => {
  const user = await requireStudent(req);

  const { lessonId } = await req.json();
  if (!lessonId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  const [lesson] = await sql`SELECT id, course_id FROM lessons WHERE id = ${lessonId} LIMIT 1`;
  if (!lesson) throw new HttpError(404, 'Lesson not found');
  if (!lesson.course_id) throw new HttpError(403, 'Lesson is not part of an enrollable course');
  await requireEnrolled(user, lesson.course_id as string);

  await sql`
    INSERT INTO lesson_completions (lesson_id, user_uid) VALUES (${lessonId}, ${user.uid})
    ON CONFLICT DO NOTHING
  `;
  return NextResponse.json({ success: true });
});
