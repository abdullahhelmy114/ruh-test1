import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { getServerSession } from '@/lib/auth';

export async function PUT(req: Request) {
  const session = await getServerSession(req);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { id, category_id, title, level, description, intro_video_url, thumbnail_url, price, old_price, launch_date, course_duration, lesson_duration, instructor_name, theme, is_published } = body;

    await sql`
      UPDATE course
      SET category_id = ${category_id}, title = ${title}, level = ${level}, description = ${description},
          intro_video_url = ${intro_video_url}, thumbnail_url = ${thumbnail_url},
          price = ${price}, old_price = ${old_price}, launch_date = ${launch_date},
          course_duration = ${course_duration}, lesson_duration = ${lesson_duration},
          instructor_name = ${instructor_name}, theme = ${theme}, is_published = ${is_published || false}
      WHERE id = ${id}
    `;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin course PUT error:', error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await getServerSession(req);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }

  try {
    const { id } = await req.json();
    await sql`DELETE FROM course WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin course DELETE error:', error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}