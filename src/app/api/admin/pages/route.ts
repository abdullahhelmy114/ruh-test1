import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { requireAdmin } from '@/lib/auth';
import { withApi } from '@/lib/api/handler';

// Phase 2.1: PUT allowed unauthenticated overwrite of every public static
// page (defacement / stored HTML). Both handlers now require an admin
// session; the only consumer of this route is the admin dashboard.
// Edge runtime removed for firebase-admin compatibility.

// GET: جلب كل الصفحات أو صفحة واحدة
export const GET = withApi(async (req) => {
  await requireAdmin(req);

  const { searchParams } = new URL(req.url);
  const slug = searchParams.get('slug');

  if (slug) {
    const [page] = await sql`SELECT * FROM static_pages WHERE slug = ${slug}`;
    return NextResponse.json({ page });
  }
  const pages = await sql`SELECT * FROM static_pages ORDER BY slug`;
  return NextResponse.json({ pages });
});

// PUT: تحديث محتوى صفحة
export const PUT = withApi(async (req) => {
  await requireAdmin(req);

  const { slug, title, content } = await req.json();
  if (!slug || !title || !content) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  await sql`
    UPDATE static_pages SET title = ${title}, content = ${content}, updated_at = NOW()
    WHERE slug = ${slug}
  `;
  return NextResponse.json({ success: true });
});
