export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';

export async function GET() {
  try {
    // حاليًا نجلب جميع الجلسات الحية المعتمدة
    // لاحقًا نضيف فلترة حسب الدورات المسجل بها الطالب
    const sessions = await sql`
      SELECT l.id, l.title, l.scheduled_at, l.meeting_url, l.course_id,
             c.title as course_title, t.full_name as teacher_name
      FROM lessons l
      JOIN courses c ON l.course_id = c.id
      LEFT JOIN profiles t ON l.teacher_uid = t.firebase_uid
      WHERE l.type = 'zoom'
        AND l.status = 'approved'
        AND l.scheduled_at IS NOT NULL
      ORDER BY l.scheduled_at ASC
    `;

    return NextResponse.json({ sessions });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}