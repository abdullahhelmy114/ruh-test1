export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || 'pending';
  const teacherUid = searchParams.get('teacherUid');

  try {
    let query = sql`SELECT l.*, c.title AS course_title FROM lessons l JOIN courses c ON l.course_id = c.id`;
    const conditions = [];

    if (status) conditions.push(sql`l.status = ${status}`);
    if (teacherUid) conditions.push(sql`l.teacher_uid = ${teacherUid}`);

    if (conditions.length > 0) query = sql`${query} WHERE ${conditions[0]} ${conditions.slice(1).reduce((prev, curr) => sql`${prev} AND ${curr}`, sql``)}`;
    query = sql`${query} ORDER BY l.created_at DESC`;

    const lessons = await query;
    return NextResponse.json({ lessons });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { courseId, title, type, scheduledAt, teacherUid } = body;

    if (!courseId || !title || !teacherUid) {
      return NextResponse.json({ error: 'Missing required fields: courseId, title, teacherUid' }, { status: 400 });
    }

    const [course] = await sql`SELECT id FROM courses WHERE id = ${courseId} AND teacher_uid = ${teacherUid}`;
    if (!course) {
      return NextResponse.json({ error: 'Course not found or you do not own this course' }, { status: 403 });
    }

    const [lesson] = await sql`
      INSERT INTO lessons (course_id, title, type, scheduled_at, teacher_uid, status)
      VALUES (${courseId}, ${title}, ${type}, ${scheduledAt || null}, ${teacherUid}, 'pending')
      RETURNING id, title, status
    `;

    return NextResponse.json({ lesson, message: 'Lesson submitted for review' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lessonId = searchParams.get('id');
    const { status } = await request.json();
    if (!lessonId || !status) return NextResponse.json({ error: 'Missing lessonId or status' }, { status: 400 });

    await sql`UPDATE lessons SET status = ${status} WHERE id = ${lessonId}`;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}