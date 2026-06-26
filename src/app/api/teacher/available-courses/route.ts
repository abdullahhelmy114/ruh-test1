import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { getServerSession } from '@/lib/auth';

export async function GET(req: Request) {
  const session = await getServerSession(req);
  if (!session || session.role !== 'teacher') {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }

  try {
    const teacherUid = session.uid;

    // جلب جميع الكورسات النموذجية المتاحة مع حالة المعلم
    const courses = await sql`
      SELECT
        mc.id,
        mc.title,
        mc.description,
        mc.level,
        mc.price,
        mc.category,
        mc.scenario,
        CASE
          WHEN ta.status = 'pending' THEN 'pending'
          WHEN lc.id IS NOT NULL THEN 'active'
          ELSE NULL
        END AS teacher_status
      FROM model_courses mc
      LEFT JOIN teaching_applications ta
        ON ta.model_course_id = mc.id AND ta.teacher_uid = ${teacherUid}
      LEFT JOIN live_courses lc
        ON lc.model_course_id = mc.id
        AND lc.teacher_id = (SELECT id FROM profiles WHERE firebase_uid = ${teacherUid})
      WHERE mc.status = 'approved'
      ORDER BY mc.created_at DESC
    `;

    return NextResponse.json(courses);
  } catch (error) {
    console.error('Get available courses error:', error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}