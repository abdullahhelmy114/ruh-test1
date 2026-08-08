import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { getServerSession } from '@/lib/auth';

export async function GET(req: Request) {
  const session = await getServerSession(req);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }

  try {
    const courses = await sql`
      SELECT c.id, c.title, c.price, c.is_published, c.launch_date, c.created_at,
             cat.name AS category_name
      FROM courses c
      LEFT JOIN categories cat ON c.category_id = cat.id
      ORDER BY c.created_at DESC
    `;
    return NextResponse.json({ courses });
  } catch (error) {
    console.error('Admin courses GET error:', error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}

// يمكن أن يحتوي نفس الملف على POST، PUT، DELETE حسب الحاجة