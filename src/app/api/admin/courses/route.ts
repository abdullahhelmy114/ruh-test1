import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { getServerSession } from '@/lib/auth';

export async function POST(req: Request) {
  const session = await getServerSession(req);
  if (!session || session.role !== 'admin')
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

  try {
    const { category_id, title, level, description, intro_video_url, thumbnail_url, price, old_price, launch_date, course_duration, lesson_duration, instructor_name, theme } = await req.json();

    // لا يوجد حقول إجبارية – نسمح بإنشاء كورس فارغ ويُعدل لاحقاً
    await sql`
      INSERT INTO courses (category_id, title, level, description, intro_video_url, thumbnail_url, price, old_price, launch_date, course_duration, lesson_duration, instructor_name, theme, is_published)
      VALUES (${category_id || null}, ${title || null}, ${level || 'A1'}, ${description || null}, ${intro_video_url || null}, ${thumbnail_url || null}, ${price || 0}, ${old_price || null}, ${launch_date || null}, ${course_duration || null}, ${lesson_duration || null}, ${instructor_name || 'د. جيهان علي زياد'}, ${theme || 'theme-1'}, false)
    `;
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('Create course error:', error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}