import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { getServerSession } from '@/lib/auth';

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(req);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }

  try {
    // التحقق من وجود النموذج
    const [course] = await sql`SELECT id FROM model_courses WHERE id = ${params.id}`;
    if (!course) {
      return NextResponse.json({ error: 'النموذج غير موجود' }, { status: 404 });
    }

    // حذف النموذج (سيؤدي ON DELETE CASCADE إلى حذف الدروس النموذجية المرتبطة)
    await sql`DELETE FROM model_courses WHERE id = ${params.id}`;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete model course error:', error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}