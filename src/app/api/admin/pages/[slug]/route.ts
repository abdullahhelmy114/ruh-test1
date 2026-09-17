import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { requireAdmin } from '@/lib/auth';
import { withApi } from '@/lib/api/handler';

// Launch reinforcement: this read had no authentication, ran on the Edge
// runtime and returned database error text to anyone. It is an administrator
// read like /api/admin/pages (which the dashboard uses); errors are generic.
export const GET = withApi<{ slug: string }>(async (req, ctx) => {
  await requireAdmin(req);
  const { slug } = await ctx.params;

  const [page] = await sql`SELECT * FROM static_pages WHERE slug = ${slug}`;
  if (!page) return NextResponse.json({ error: 'Page not found' }, { status: 404 });
  return NextResponse.json({ page });
});
