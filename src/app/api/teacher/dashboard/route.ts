export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const uid = searchParams.get('uid');
  if (!uid) return NextResponse.json({ error: 'Missing uid' }, { status: 400 });

  try {
    // بيانات المعلم الأساسية
    const [teacher] = await sql`
      SELECT full_name FROM profiles WHERE firebase_uid = ${uid} AND role = 'teacher'
    `;
    if (!teacher) return NextResponse.json({ error: 'Teacher not found' }, { status: 404 });

    const fullName = teacher.full_name;
    const initial = fullName?.charAt(0) || 'T';

    // عدد الطلاب (مثال: عدّ الطلاب المسجلين في دورات هذا المعلم)
    const [{ count: students }] = await sql`
      SELECT COUNT(DISTINCT e.user_uid)::int AS count
      FROM enrollments e
      JOIN courses c ON e.course_id = c.id
      WHERE c.teacher_uid = ${uid}
    `;

    // عدد الدورات النشطة
    const [{ count: activeCourses }] = await sql`
      SELECT COUNT(*)::int AS count FROM courses WHERE teacher_uid = ${uid} AND status = 'published'
    `;

    // الإيرادات (مجموع أسعار الكورسات التي اشتراها طلاب، بفرض جدول معاملات)
    const [{ revenue }] = await sql`
      SELECT COALESCE(SUM(c.price), 0) AS revenue
      FROM enrollments e
      JOIN courses c ON e.course_id = c.id
      WHERE c.teacher_uid = ${uid}
    `;

    // الدورات الخاصة بالمعلم
    const courses = await sql`
      SELECT id, title, level, price, status, recording_url
      FROM courses
      WHERE teacher_uid = ${uid}
      ORDER BY created_at DESC
    `;

    // الجلسات المباشرة القادمة
    const sessions = await sql`
      SELECT l.id, l.title, l.scheduled_at, l.meeting_url, l.course_id, c.title AS course_title
      FROM lessons l
      JOIN courses c ON l.course_id = c.id
      WHERE l.teacher_uid = ${uid} AND l.type = 'zoom' AND l.status = 'approved' AND l.scheduled_at IS NOT NULL
      ORDER BY l.scheduled_at ASC
    `;

    return NextResponse.json({
      fullName,
      initial,
      students,
      activeCourses,
      revenue,
      courses,
      sessions,
      certificationProgress: 0, // يمكن تطويره لاحقاً
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}