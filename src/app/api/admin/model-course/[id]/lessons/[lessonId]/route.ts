import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { requireAdmin } from '@/lib/auth';
import { withApi } from '@/lib/api/handler';

// تعديل درس (تحديث العنوان والمحتوى)
export const PUT = withApi<{ id: string; lessonId: string }>(async (req, ctx) => {
  await requireAdmin(req);
  const params = await ctx.params;

  try {
    const { title, content } = await req.json();

    if (!title) {
      return NextResponse.json({ error: 'العنوان مطلوب' }, { status: 400 });
    }

    const updatedLesson = await sql`
      UPDATE model_lessons
      SET title = ${title}, content = ${content || ''}
      WHERE id = ${params.lessonId} AND model_course_id = ${params.id}
      RETURNING *
    `;

    if (updatedLesson.length === 0) {
      return NextResponse.json({ error: 'الدرس غير موجود' }, { status: 404 });
    }

    return NextResponse.json({ success: true, lesson: updatedLesson[0] }, { status: 200 });
  } catch (error) {
    console.error('Update lesson error:', error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
});

// حذف درس
export const DELETE = withApi<{ id: string; lessonId: string }>(async (req, ctx) => {
  await requireAdmin(req);
  const params = await ctx.params;

  try {
    await sql`
      DELETE FROM model_lessons
      WHERE id = ${params.lessonId} AND model_course_id = ${params.id}
    `;
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Delete lesson error:', error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
});