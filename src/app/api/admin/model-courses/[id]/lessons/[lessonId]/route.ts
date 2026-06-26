import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { getServerSession } from '@/lib/auth';

export async function DELETE(
  req: Request,
  { params }: { params: { id: string; lessonId: string } }
) {
  const session = await getServerSession(req);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }

  try {
    const [lesson] = await sql`
      SELECT id FROM model_lessons WHERE id = ${params.lessonId} AND model_course_id = ${params.id}
    `;
    if (!lesson) {
      return NextResponse.json({ error: 'الدرس غير موجود' }, { status: 404 });
    }

    await sql`DELETE FROM model_lessons WHERE id = ${params.lessonId}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete model lesson error:', error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}