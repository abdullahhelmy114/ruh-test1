import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';

export async function POST(req: Request) {
  try {
    const { title, description, price, model_course_ids } = await req.json();

    if (!Array.isArray(model_course_ids) || model_course_ids.length !== 3) {
      return NextResponse.json({ error: 'يجب اختيار 3 كورسات نموذجية' }, { status: 400 });
    }

    // التحقق من صحة المعرفات في جدول model_courses
    const validCourses = await sql`
      SELECT id FROM model_courses WHERE id = ANY(${model_course_ids})
    `;
    if (validCourses.length !== 3) {
      return NextResponse.json({ error: 'بعض الكورسات غير موجودة' }, { status: 400 });
    }

    // إنشاء الحزمة
    await sql`
      INSERT INTO bundles (title, description, price, model_course_ids)
      VALUES (${title}, ${description}, ${price}, ${JSON.stringify(model_course_ids)})
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}