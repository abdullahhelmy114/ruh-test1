import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { requireAdmin } from '@/lib/auth';
import { withApi } from '@/lib/api/handler';

export const PUT = withApi<{ id: string }>(async (req, ctx) => {
  await requireAdmin(req);
  const params = await ctx.params;

  try {
    const { orderedIds } = await req.json();

    if (!Array.isArray(orderedIds)) {
      return NextResponse.json(
        { error: 'يجب إرسال مصفوفة من المعرفات' },
        { status: 400 }
      );
    }

    for (let i = 0; i < orderedIds.length; i++) {
      await sql`
        UPDATE model_lessons
        SET order_index = ${i + 1}
        WHERE id = ${orderedIds[i]} AND model_course_id = ${params.id}
      `;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Reorder lessons error:', error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
});