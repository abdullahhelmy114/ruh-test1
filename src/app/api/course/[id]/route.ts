import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';

// Phase 3 batch 1 — public course detail projection.
// Public catalog route (course page). `SELECT c.*` exposed teacher_uid,
// recording_url, the internal `content` column and workflow state. The
// explicit list below covers every field the course themes read
// (title, description, price, media, durations, launch date, instructor
// name, theme, payment_url) plus category info. payment_url is kept because
// the current purchase button links to it; it is replaced by the Whop
// checkout in the payment batch.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'معرف الكورس مطلوب' }, { status: 400 });

  try {
    const [course] = await sql`
      SELECT c.id, c.title, c.description, c.level, c.price, c.old_price,
             c.lessons_count, c.course_duration, c.lesson_duration,
             c.instructor_name, c.image_url, c.thumbnail_url, c.trailer_url,
             c.intro_video_url, c.launch_date, c.theme, c.category_id,
             c.payment_url, c.is_published,
             cat.name AS category_name, cat.slug AS category_slug
      FROM course c
      LEFT JOIN categories cat ON c.category_id = cat.id
      WHERE c.id = ${id} AND c.is_published = true
    `;
    if (!course) return NextResponse.json({ error: 'الكورس غير موجود' }, { status: 404 });
    return NextResponse.json({ course });
  } catch (error) {
    console.error('Course detail error:', error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}
