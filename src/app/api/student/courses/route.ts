export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';

export async function GET(request: Request) {
  const uid = new URL(request.url).searchParams.get('uid');
  if (!uid) return NextResponse.json({ error: 'Missing uid' }, { status: 400 });

  try {
    const courses = await sql`
      SELECT c.id, c.title, c.level, c.price, c.teacher_uid,
             COUNT(l.id) as total_lessons,
             COUNT(lc.lesson_id) as completed_lessons,
             e.enrolled_at
      FROM enrollments e
      JOIN courses c ON e.course_id = c.id
      LEFT JOIN lessons l ON l.course_id = c.id
      LEFT JOIN lesson_completions lc ON lc.lesson_id = l.id AND lc.user_uid = ${uid}
      WHERE e.user_uid = ${uid}
      GROUP BY c.id, e.enrolled_at
      ORDER BY e.enrolled_at DESC
    `;
    return NextResponse.json({ courses });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}