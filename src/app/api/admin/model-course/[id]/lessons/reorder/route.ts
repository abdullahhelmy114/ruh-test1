import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { verifyIdToken } from '@/lib/firebase/server';

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = await verifyIdToken(req);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }

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
}