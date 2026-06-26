export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const uid = searchParams.get('uid');
  if (!uid) return NextResponse.json({ error: 'Missing uid' }, { status: 400 });

  try {
    // بيانات المستخدم الأساسية
    const [user] = await sql`
      SELECT full_name, email FROM profiles WHERE firebase_uid = ${uid} AND role = 'student'
    `;
    if (!user) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

    const firstName = user.full_name || user.email.split('@')[0];

    // دوال مساعدة لجلب البيانات بأمان (في حال عدم وجود الجداول)
    const safeQuery = async (queryFn: () => Promise<any>, fallback: any = []) => {
      try {
        return await queryFn();
      } catch {
        return fallback;
      }
    };

    const inProgress = await safeQuery(() =>
      sql`
        SELECT c.id AS course_id, c.title,
               COALESCE(e.completed_lessons, 0) AS completed_lessons,
               COALESCE(e.total_lessons, 0) AS total_lessons,
               CASE WHEN e.total_lessons > 0 THEN ROUND((e.completed_lessons::numeric / e.total_lessons) * 100) ELSE 0 END AS progress_percent
        FROM enrollments e
        JOIN courses c ON e.course_id = c.id
        WHERE e.user_uid = ${uid} AND e.completed = false
        ORDER BY e.enrolled_at DESC
        LIMIT 10
      `
    );

    const completed = await safeQuery(() =>
      sql`
        SELECT c.title, e.completed_at
        FROM enrollments e
        JOIN courses c ON e.course_id = c.id
        WHERE e.user_uid = ${uid} AND e.completed = true
        ORDER BY e.completed_at DESC
        LIMIT 10
      `
    );

    const sessions = await safeQuery(() =>
      sql`
        SELECT l.id, l.title, l.scheduled_at, l.meeting_url, l.course_id,
               c.title AS course_title,
               u.full_name AS teacher_name
        FROM lessons l
        JOIN courses c ON l.course_id = c.id
JOIN profiles t ON l.teacher_uid = t.firebase_uid        WHERE l.type = 'zoom' AND l.status = 'approved' AND l.scheduled_at IS NOT NULL
          AND c.id IN (SELECT course_id FROM enrollments WHERE user_uid = ${uid})
        ORDER BY l.scheduled_at ASC
        LIMIT 10
      `
    );

    return NextResponse.json({
      firstName,
      streak: 0,
      inProgress: inProgress.map((c: any) => ({
        title: c.title,
        next: 'Start lesson',
        progress: c.progress_percent || 0,
        courseId: c.course_id,
      })),
      completed: completed.map((c: any) => ({
        title: c.title,
        date: new Date(c.completed_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      })),
      referral: {
        code: `ruhulqudus.net/r/${uid.slice(0, 6)}`,
        count: 0,
        credits: 0,
      },
      sessions,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}