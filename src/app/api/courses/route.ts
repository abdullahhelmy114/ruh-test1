import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';

export async function GET(request: Request) {
  try {
    const courses = await sql`
      SELECT id, title, description, level, price, old_price,
             course_duration, lesson_duration, instructor_name,
             intro_video_url, thumbnail_url, launch_date, theme
      FROM courses
      WHERE is_published = true
      ORDER BY created_at DESC
    `;

    const formatted = courses.map(c => ({
      ...c,
      price: Number(c.price),
      old_price: c.old_price ? Number(c.old_price) : null,
    }));

    return NextResponse.json({ courses: formatted });
  } catch (error) {
    console.error('Courses GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}