import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { getServerSession } from '@/lib/auth';

export async function GET(req: Request) {
  const session = await getServerSession(req);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }

  try {
    const course = await sql`
      SELECT c.id, c.title, c.price, c.is_published, c.launch_date, c.created_at,
             c.payment_url, cat.name AS category_name
      FROM course c
      LEFT JOIN categories cat ON c.category_id = cat.id
      ORDER BY c.created_at DESC
    `;
    return NextResponse.json({ course });
  } catch (error: any) {
    console.error('GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(req);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }

  try {
    const body = await req.json();

    // تنظيف القيم الرقمية
    const rawPrice = body.price;
    const rawOldPrice = body.old_price;

    const price = typeof rawPrice === "number" && !Number.isNaN(rawPrice) ? rawPrice : 0;
    const old_price = typeof rawOldPrice === "number" && !Number.isNaN(rawOldPrice) ? rawOldPrice : null;

    const values = {
      category_id: body.category_id || null,
      title: typeof body.title === "string" ? body.title.trim() : null,
      level: body.level || 'A1',
      description: body.description || null,
      intro_video_url: body.intro_video_url || null,
      thumbnail_url: body.thumbnail_url || null,
      price,
      old_price,
      payment_url: body.payment_url || null,
      launch_date: body.launch_date || null,
      course_duration: body.course_duration || null,
      lesson_duration: body.lesson_duration || null,
      instructor_name: body.instructor_name || 'د. جيهان علي زياد',
      theme: body.theme || 'theme-1',
    };

    if (!values.title || price <= 0) {
      return NextResponse.json({ error: 'Title and valid price required' }, { status: 400 });
    }

    await sql`
      INSERT INTO course (
        category_id, title, level, description,
        intro_video_url, thumbnail_url, price, old_price,
        payment_url, launch_date, course_duration, lesson_duration,
        instructor_name, theme, is_published
      )
      VALUES (
        ${values.category_id}, ${values.title}, ${values.level}, ${values.description},
        ${values.intro_video_url}, ${values.thumbnail_url}, ${values.price}, ${values.old_price},
        ${values.payment_url}, ${values.launch_date}, ${values.course_duration}, ${values.lesson_duration},
        ${values.instructor_name}, ${values.theme}, true
      )
    `;

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error: any) {
    console.error('POST error:', error);
    return NextResponse.json(
      { error: error.message || 'خطأ في الخادم', detail: error.toString() },
      { status: 500 }
    );
  }
}