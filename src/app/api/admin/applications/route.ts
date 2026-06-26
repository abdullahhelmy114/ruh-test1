import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { getServerSession } from '@/lib/auth';

export async function GET(req: Request) {
  const session = await getServerSession(req);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }

  try {
    const applications = await sql`
      SELECT
        ta.id,
        mc.title AS course_title,
        mc.level,
        mc.category,
        p.full_name AS teacher_name,
        p.email AS teacher_email,
        ta.applied_at,
        ta.status
      FROM teaching_applications ta
      JOIN model_courses mc ON ta.model_course_id = mc.id
      JOIN profiles p ON ta.teacher_uid = p.firebase_uid
      WHERE ta.status = 'pending'
      ORDER BY ta.applied_at ASC
    `;

    return NextResponse.json(applications);
  } catch (error) {
    console.error('Fetch applications error:', error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}