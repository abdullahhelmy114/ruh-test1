import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { getServerSession } from '@/lib/auth';

export async function GET(req: Request, { params }: { params: { courseId: string } }) {
  const session = await getServerSession(req);
  if (!session || session.role !== 'teacher') {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }

  // التحقق من أن المعلم يملك هذا الكورس الحي
  const [liveCourse] = await sql`
    SELECT model_course_id FROM live_courses
    WHERE id = ${params.courseId}
    AND teacher_id = (SELECT id FROM profiles WHERE firebase_uid = ${session.uid})
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
}