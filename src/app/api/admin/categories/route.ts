import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { getServerSession } from '@/lib/auth';

export async function POST(req: Request) {
  const session = await getServerSession(req);
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

  const { name } = await req.json();
  const slug = name.trim().toLowerCase().replace(/\s+/g, '-');
  await sql`INSERT INTO categories (name, slug) VALUES (${name.trim()}, ${slug})`;
  return NextResponse.json({ success: true }, { status: 201 });
}