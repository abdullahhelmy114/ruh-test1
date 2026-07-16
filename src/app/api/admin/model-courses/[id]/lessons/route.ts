import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { getServerSession } from '@/lib/auth';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(req);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }

  try {
    const [course] = await sql`
      SELECT id, title FROM model_courses WHERE id = ${params.id}
    `;
    if (!course) {
      return NextResponse.json({ error: 'النموذج غير موجود' }, { status: 404 });
    }

    const lessons = await sql`
      SELECT id, title, order_index, type, script_pdf_url, duration_minutes
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

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(req);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }

  try {
    const { title, type, order_index, script_pdf_url, duration_minutes } = await req.json();

    if (!title || !type) {
      return NextResponse.json({ error: 'العنوان والنوع مطلوبان' }, { status: 400 });
    }

    // التحقق من وجود النموذج
    const [course] = await sql`SELECT id FROM model_courses WHERE id = ${params.id}`;
    if (!course) {
      return NextResponse.json({ error: 'النموذج غير موجود' }, { status: 404 });
    }

    await sql`
      INSERT INTO model_lessons (model_course_id, title, type, order_index, script_pdf_url, duration_minutes)
      VALUES (${params.id}, ${title}, ${type}, ${order_index || 0}, ${script_pdf_url || null}, ${duration_minutes || null})
    `;

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('Create model lesson error:', error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}