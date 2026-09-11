import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { requireAdmin } from '@/lib/auth';
import { withApi } from '@/lib/api/handler';

export const POST = withApi(async (req) => {
  await requireAdmin(req);

  const { name } = await req.json();
  const slug = name.trim().toLowerCase().replace(/\s+/g, '-');
  await sql`INSERT INTO categories (name, slug) VALUES (${name.trim()}, ${slug})`;
  return NextResponse.json({ success: true }, { status: 201 });
});