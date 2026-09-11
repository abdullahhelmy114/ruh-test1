import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { requireAdmin, requireTeacher } from '@/lib/auth';
import { withApi } from '@/lib/api/handler';

// Phase 2.3a: previously unauthenticated (leaked meeting_url for all lessons).
// Admins may list freely and filter by ?teacherUid=; a teacher is always
// scoped to their own lessons regardless of the query parameter.
export const GET = withApi(async (req) => {
  const user = await requireTeacher(req);

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || 'pending';
  const requestedTeacher = searchParams.get('teacherUid');
  const teacherUid = user.role === 'admin' ? requestedTeacher : user.uid;

  let query = sql`SELECT l.*, c.title AS course_title FROM lessons l JOIN course c ON l.course_id = c.id`;
  const conditions = [];

  if (status) conditions.push(sql`l.status = ${status}`);
  if (teacherUid) conditions.push(sql`l.teacher_uid = ${teacherUid}`);

  if (conditions.length > 0) query = sql`${query} WHERE ${conditions[0]} ${conditions.slice(1).reduce((prev, curr) => sql`${prev} AND ${curr}`, sql``)}`;
  query = sql`${query} ORDER BY l.created_at DESC`;

  const lessons = await query;
  return NextResponse.json({ lessons });
});

// Phase 2.2: the lesson's teacher is the verified caller (user.uid); the
// ownership check no longer trusts body.teacherUid. courseId is the target.
// Known mismatch (not fixed here): LessonCreationDialog posts
// { live_course_id, type, scheduled_at, scenario, teacher_notes } and will
// still receive 400 from this handler, as it did before this change.
// Edge runtime removed from this file for firebase-admin compatibility.
export const POST = withApi(async (req) => {
  const user = await requireTeacher(req);

  const body = await req.json().catch(() => ({}));
  const { courseId, title, type, scheduledAt } = body;

  if (!courseId || !title) {
    return NextResponse.json({ error: 'Missing required fields: courseId, title' }, { status: 400 });
  }

  const [course] = await sql`SELECT id FROM course WHERE id = ${courseId} AND teacher_uid = ${user.uid}`;
  if (!course) {
    return NextResponse.json({ error: 'Course not found or you do not own this course' }, { status: 403 });
  }

  const [lesson] = await sql`
    INSERT INTO lessons (course_id, title, type, scheduled_at, teacher_uid, status)
    VALUES (${courseId}, ${title}, ${type}, ${scheduledAt || null}, ${user.uid}, 'pending')
    RETURNING id, title, status
  `;

  return NextResponse.json({ lesson, message: 'Lesson submitted for review' });
});

// Phase 2.3a: previously unauthenticated — anyone could set any lesson's
// status. Admin session required. Status values pass through unchanged.
export const PUT = withApi(async (req) => {
  await requireAdmin(req);

  const { searchParams } = new URL(req.url);
  const lessonId = searchParams.get('id');
  const { status } = await req.json();
  if (!lessonId || !status) return NextResponse.json({ error: 'Missing lessonId or status' }, { status: 400 });

  await sql`UPDATE lessons SET status = ${status} WHERE id = ${lessonId}`;
  return NextResponse.json({ success: true });
});