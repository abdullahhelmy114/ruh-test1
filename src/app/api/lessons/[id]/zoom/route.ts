export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: lessonId } = await context.params;

    const result = await sql`
      SELECT id, title, status, meeting_url, meeting_id, teacher_uid, course_id
      FROM lessons
      WHERE id = ${lessonId}
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    const lesson = result[0];

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
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}