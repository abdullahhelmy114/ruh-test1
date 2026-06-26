export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';

export async function GET(
  request: Request,
  context: { params: Promise<{ courseId: string }> }
) {
  const uid = new URL(request.url).searchParams.get('uid');
  if (!uid) return NextResponse.json({ error: 'Missing uid' }, { status: 400 });

  const { courseId } = await context.params;

  try {
    const enrollment = await sql`SELECT 1 FROM enrollments WHERE user_uid = ${uid} AND course_id = ${courseId}`;
    if (enrollment.length === 0) return NextResponse.json({ error: 'Not enrolled' }, { status: 403 });

    const [course] = await sql`SELECT id, title, level FROM courses WHERE id = ${courseId}`;
    const lessons = await sql`
      SELECT l.id, l.title, l.type, l.scheduled_at, l.meeting_url, l.recording_url, l.status,
             EXISTS(SELECT 1 FROM lesson_completions lc WHERE lc.lesson_id = l.id AND lc.user_uid = ${uid}) as completed,
             COALESCE(json_agg(json_build_object('file_name', lf.file_name, 'file_url', lf.file_url, 'file_type', lf.file_type)) FILTER (WHERE lf.id IS NOT NULL), '[]') as files
      FROM lessons l
      LEFT JOIN lesson_files lf ON lf.lesson_id = l.id
      WHERE l.course_id = ${courseId} AND l.status = 'approved'
      GROUP BY l.id
      ORDER BY l.created_at ASC
    `;
    return NextResponse.json({ course, lessons });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}