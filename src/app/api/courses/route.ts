import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');

  try {
    let query = sql`
      SELECT c.id, c.title, c.description, c.level, c.price, c.old_price,
             c.course_duration, c.lesson_duration, c.instructor_name,
             c.intro_video_url, c.thumbnail_url, c.launch_date, c.theme,
             cat.name AS category_name, cat.slug AS category_slug
      FROM courses c
      JOIN categories cat ON c.category_id = cat.id
      WHERE c.is_published = true
    `;

    if (category) {
      query = sql`${query} AND cat.slug = ${category}`;
    }

    query = sql`${query} ORDER BY c.created_at DESC`;

    const courses = await query;
    return NextResponse.json({ courses });
  } catch (error) {
    console.error('Courses GET error:', error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}