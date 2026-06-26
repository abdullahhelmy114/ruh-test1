import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';

export async function GET(request: Request, { params }: { params: { courseId: string } }) {
  const [course] = await sql`
    SELECT lc.*, p.full_name AS teacher_name, p.firebase_uid AS teacher_uid
    FROM live_courses lc
    JOIN profiles p ON lc.teacher_id = p.id
    WHERE lc.id = ${params.courseId}
  `;

  if (!course) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 });
  }

  // جلب الدروس المرتبطة بهذا الكورس الحي (من جدول model_lessons عبر model_course_id)
  const lessons = await sql`
    SELECT id, title, order_index, type, script_pdf_url, duration_minutes
    FROM model_lessons
    WHERE model_course_id = ${course.model_course_id}
    ORDER BY order_index ASC
  `;

  return NextResponse.json({ course: { ...course, lessons } });
}