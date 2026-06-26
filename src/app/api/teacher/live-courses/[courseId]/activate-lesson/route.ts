import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { getServerSession } from '@/lib/auth';

export async function POST(req: Request, { params }: { params: { courseId: string } }) {
  const session = await getServerSession(req);
  if (!session || session.role !== 'teacher') {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }

  const { model_lesson_id } = await req.json();

  // التحقق من ملكية الكورس الحي
  const [liveCourse] = await sql`
    SELECT model_course_id FROM live_courses
    WHERE id = ${params.courseId}
    AND teacher_id = (SELECT id FROM profiles WHERE firebase_uid = ${session.uid})
  `;
  if (!liveCourse) {
    return NextResponse.json({ error: 'الكورس غير موجود' }, { status: 404 });
  }

  // التحقق من أن الدرس النموذجي ينتمي لنفس النموذج
  const [modelLesson] = await sql`
    SELECT id, title, order_index, type, script_pdf_url, duration_minutes
    FROM model_lessons
    WHERE id = ${model_lesson_id} AND model_course_id = ${liveCourse.model_course_id}
  `;
  if (!modelLesson) {
    return NextResponse.json({ error: 'الدرس النموذجي غير موجود' }, { status: 404 });
  }

  // إنشاء live_lesson
  const [newLesson] = await sql`
    INSERT INTO live_lessons (live_course_id, model_lesson_id, title, type, order_index)
    VALUES (${params.courseId}, ${model_lesson_id}, ${modelLesson.title}, ${modelLesson.type}, ${modelLesson.order_index})
    RETURNING id
  `;

  return NextResponse.json({ liveLessonId: newLesson.id });
}