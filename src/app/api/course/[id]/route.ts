import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'معرف الكورس مطلوب' }, { status: 400 });

  try {
    const [course] = await sql`
      SELECT c.*, cat.name AS category_name, cat.slug AS category_slug
      FROM course c
      LEFT JOIN categories cat ON c.category_id = cat.id
      WHERE c.id = ${id} AND c.is_published = true
    `;
    if (!course) return NextResponse.json({ error: 'الكورس غير موجود' }, { status: 404 });
    return NextResponse.json({ course });
  } catch (error) {
    console.error('Course detail error:', error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}