import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { verifyIdToken } from '@/lib/firebase/server';

// 1. جلب الكورس ودروسه (مع حقل content الجديد)
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const user = await verifyIdToken(req);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }

  try {
    const [course] = await sql`
      SELECT id, title FROM model_courses WHERE id = ${params.id}
    `;
    if (!course) {
      return NextResponse.json({ error: 'النموذج غير موجود' }, { status: 404 });
    }

    // أضفنا حقل content هنا ليقرأه المحرر الجديد
    const lessons = await sql`
      SELECT id, title, order_index, type, script_pdf_url, duration_minutes, content
      FROM model_lessons
      WHERE model_course_id = ${params.id}
      ORDER BY order_index ASC
    `;

    return NextResponse.json({ course, lessons });
  } catch (error) {
    console.error('Get model lessons error:', error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}

// 2. إنشاء درس جديد
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await verifyIdToken(req);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }

  try {
    // أضفنا استقبال حقل content
    const { title, type, order_index, script_pdf_url, duration_minutes, content } = await req.json();

    if (!title) {
      return NextResponse.json({ error: 'العنوان مطلوب' }, { status: 400 });
    }

    const [course] = await sql`SELECT id FROM model_courses WHERE id = ${params.id}`;
    if (!course) {
      return NextResponse.json({ error: 'النموذج غير موجود' }, { status: 404 });
    }

    // جلب آخر رقم ترتيب إذا لم يتم إرساله
    let newOrderIndex = order_index;
    if (!newOrderIndex) {
      const result = await sql`SELECT MAX(order_index) as max_order FROM model_lessons WHERE model_course_id = ${params.id}`;
      newOrderIndex = (result[0]?.max_order || 0) + 1;
    }

    // إدخال الدرس الجديد مع حقل content
    const newLesson = await sql`
      INSERT INTO model_lessons (model_course_id, title, type, order_index, script_pdf_url, duration_minutes, content)
      VALUES (${params.id}, ${title}, ${type || 'video'}, ${newOrderIndex}, ${script_pdf_url || null}, ${duration_minutes || null}, ${content || ''})
      RETURNING *
    `;

    return NextResponse.json({ success: true, lesson: newLesson[0] }, { status: 201 });
  } catch (error) {
    console.error('Create model lesson error:', error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}