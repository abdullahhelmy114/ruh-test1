import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { requireAuth, requireEnrolled, HttpError } from '@/lib/auth';
import { withApi } from '@/lib/api/handler';

// Phase 2.4a: the Zoom meeting URL is paid course content and was returned to
// anyone. Now requires an authenticated caller who is an admin, the lesson's
// own teacher, or a student enrolled in the lesson's course. Response shape
// unchanged. Edge runtime removed for firebase-admin compatibility.
export const GET = withApi<{ id: string }>(async (req, ctx) => {
  const user = await requireAuth(req);
  const { id: lessonId } = await ctx.params;

  const result = await sql`
    SELECT id, title, status, meeting_url, meeting_id, teacher_uid, course_id
    FROM lessons
    WHERE id = ${lessonId}
  `;

  if (result.length === 0) throw new HttpError(404, 'Lesson not found');
  const lesson = result[0];

  const isOwnerTeacher = lesson.teacher_uid === user.uid;
  if (user.role !== 'admin' && !isOwnerTeacher) {
    if (!lesson.course_id) throw new HttpError(403, 'Lesson is not part of an enrollable course');
    await requireEnrolled(user, lesson.course_id as string);
  }

  if (lesson.status !== 'approved') {
    return NextResponse.json({ error: 'Lesson not yet approved' }, { status: 403 });
  }

  if (!lesson.meeting_url) {
    return NextResponse.json({ error: 'No meeting URL available' }, { status: 404 });
  }

  return NextResponse.json({
    id: lesson.id,
    title: lesson.title,
    meetingUrl: lesson.meeting_url,
    meetingId: lesson.meeting_id,
    teacherUid: lesson.teacher_uid,
    courseId: lesson.course_id,
  });
});
