import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { requireTeacher } from '@/lib/auth';
import { withApi } from '@/lib/api/handler';

// Phase 2.2: the teacher in the relation check is the verified caller
// (user.uid); the client no longer supplies teacherUid. params.uid remains the
// target student. Edge runtime removed for firebase-admin compatibility.
export const GET = withApi<{ uid: string }>(async (req, ctx) => {
  const user = await requireTeacher(req);
  const { uid: studentUid } = await ctx.params;

  if (!studentUid) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  // التحقق من أن هذا الطالب مسجل في كورس واحد على الأقل مع هذا المعلم
  const [relation] = await sql`
    SELECT 1 FROM enrollments e
    JOIN course c ON e.course_id = c.id
    WHERE e.user_uid = ${studentUid} AND c.teacher_uid = ${user.uid}
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
});
