import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { requireStudent } from '@/lib/auth';
import { withApi } from '@/lib/api/handler';

// Phase 2.4a: previously listed every approved Zoom session platform-wide
// (with meeting URLs) to anyone. Now requires a student and returns only
// sessions of courses the caller is enrolled in; admins see all. Edge
// runtime removed for firebase-admin compatibility. No frontend caller today.
export const GET = withApi(async (req) => {
  const user = await requireStudent(req);

  const sessions = user.role === 'admin'
    ? await sql`
        SELECT l.id, l.title, l.scheduled_at, l.meeting_url, l.course_id,
               c.title as course_title, t.full_name as teacher_name
        FROM lessons l
        JOIN course c ON l.course_id = c.id
        LEFT JOIN profiles t ON l.teacher_uid = t.firebase_uid
        WHERE l.type = 'zoom'
          AND l.status = 'approved'
          AND l.scheduled_at IS NOT NULL
        ORDER BY l.scheduled_at ASC
      `
    : await sql`
        SELECT l.id, l.title, l.scheduled_at, l.meeting_url, l.course_id,
               c.title as course_title, t.full_name as teacher_name
        FROM lessons l
        JOIN course c ON l.course_id = c.id
        JOIN enrollments e ON e.course_id = c.id AND e.user_uid = ${user.uid}
        LEFT JOIN profiles t ON l.teacher_uid = t.firebase_uid
        WHERE l.type = 'zoom'
          AND l.status = 'approved'
          AND l.scheduled_at IS NOT NULL
        ORDER BY l.scheduled_at ASC
      `;

  return NextResponse.json({ sessions });
});
