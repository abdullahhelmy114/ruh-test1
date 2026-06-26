export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ uid: string }> }
) {
  const { uid: studentUid } = await params;
  const { searchParams } = new URL(request.url);
  const teacherUid = searchParams.get('teacherUid');

  if (!studentUid || !teacherUid) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  try {
    // التحقق من أن هذا الطالب مسجل في كورس واحد على الأقل مع هذا المعلم
    const [relation] = await sql`
      SELECT 1 FROM enrollments e
      JOIN courses c ON e.course_id = c.id
      WHERE e.user_uid = ${studentUid} AND c.teacher_uid = ${teacherUid}
      LIMIT 1
    `;
    if (!relation) {
      return NextResponse.json({ error: 'Not authorized to view this student' }, { status: 403 });
    }

    // جلب بيانات الطالب المحدودة
    const [student] = await sql`
      SELECT full_name, email, nationality, residence, native_language,
             other_languages, age, gender, created_at
      FROM profiles
      WHERE firebase_uid = ${studentUid} AND role = 'student'
    `;

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    return NextResponse.json({ student });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}