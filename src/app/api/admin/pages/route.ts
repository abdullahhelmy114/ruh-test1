export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';

// GET: جلب كل الصفحات أو صفحة واحدة
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');

  try {
    if (slug) {
      const [page] = await sql`SELECT * FROM static_pages WHERE slug = ${slug}`;
      return NextResponse.json({ page });
    }
    const pages = await sql`SELECT * FROM static_pages ORDER BY slug`;
    return NextResponse.json({ pages });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT: تحديث محتوى صفحة
export async function PUT(request: Request) {
  try {
    const { slug, title, content } = await request.json();
    if (!slug || !title || !content) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    await sql`
      UPDATE static_pages SET title = ${title}, content = ${content}, updated_at = NOW()
      WHERE slug = ${slug}
    `;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}