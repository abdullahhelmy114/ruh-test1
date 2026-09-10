import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { requireTeacher } from '@/lib/auth';
import { withApi } from '@/lib/api/handler';

// Phase 2.2: sessions are listed for the verified caller (user.uid); the
// client no longer supplies teacherUid. Edge runtime removed for
// firebase-admin compatibility.
export const GET = withApi(async (req) => {
  const user = await requireTeacher(req);

  const sessions = await sql`
    SELECT l.id, l.title, l.scheduled_at, l.meeting_url, l.course_id, c.title as course_title
    FROM lessons l JOIN course c ON l.course_id = c.id
    WHERE l.teacher_uid = ${user.uid}
      AND l.type = 'zoom'
      AND l.status = 'approved'
      AND l.scheduled_at IS NOT NULL
    ORDER BY l.scheduled_at ASC
  `;

  return NextResponse.json({ sessions });
});
