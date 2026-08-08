import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { getServerSession } from '@/lib/auth';

export async function GET(req: Request) {
  const session = await getServerSession(req);
  if (!session || session.role !== 'admin')
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

  try {
    const courses = await sql`
      SELECT c.id, c.title, c.price, c.is_published, c.launch_date, c.created_at,
             cat.name AS category_name
      FROM courses c
      LEFT JOIN categories cat ON c.category_id = cat.id
      ORDER BY c.created_at DESC
    `;
    return NextResponse.json({ courses });
  } catch (error: any) {
    console.error('GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(req);
  if (!session || session.role !== 'admin')
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

  try {
    const body = await req.json();
    console.log('POST body:', body); // لمساعدتنا في التصحيح

    // إعداد القيم مع قيم افتراضية آمنة
    const values = {
      category_id: body.category_id || null,
      title: body.title || null,
      level: body.level || 'A1',
      description: body.description || null,
      intro_video_url: body.intro_video_url || null,
      thumbnail_url: body.thumbnail_url || null,
      price: body.price || 0,
      old_price: body.old_price || null,
      launch_date: body.launch_date || null,
      course_duration: body.course_duration || null,
      lesson_duration: body.lesson_duration || null,
      instructor_name: body.instructor_name || 'د. جيهان علي زياد',
      theme: body.theme || 'theme-1',
    };

    await sql`
      INSERT INTO courses (
        category_id, title, level, description,
        intro_video_url, thumbnail_url, price, old_price,
        launch_date, course_duration, lesson_duration,
        instructor_name, theme, is_published
      )
      VALUES (
        ${values.category_id}, ${values.title}, ${values.level}, ${values.description},
        ${values.intro_video_url}, ${values.thumbnail_url}, ${values.price}, ${values.old_price},
        ${values.launch_date}, ${values.course_duration}, ${values.lesson_duration},
        ${values.instructor_name}, ${values.theme}, false
      )
    `;

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error: any) {
    console.error('POST error:', error);
    // إرجاع رسالة الخطأ الفعلية للمساعدة في التصحيح
    return NextResponse.json(
      { error: error.message || 'خطأ في الخادم', detail: error.toString() },
      { status: 500 }
    );
  }
}