import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { requireAdmin } from '@/lib/auth';
import { withApi } from '@/lib/api/handler';

// Phase 1 reference migration: identity and role come only from the verified
// session via requireAdmin(); errors are mapped centrally by withApi().

export const GET = withApi(async (req) => {
  await requireAdmin(req);

  const course = await sql`
    SELECT id, title, description, level, price, category, scenario, created_at
    FROM model_course
    ORDER BY created_at DESC
  `;
  return NextResponse.json({ course });
});

export const POST = withApi(async (req) => {
  await requireAdmin(req);

  const { title, description, level, price, category, scenario } = await req.json();

  if (!title || !level || price === undefined) {
    return NextResponse.json(
      { error: 'البيانات ناقصة (العنوان، المستوى، السعر مطلوبة)' },
      { status: 400 }
    );
  }

  await sql`
    INSERT INTO model_course (title, description, level, price, category, scenario)
    VALUES (${title}, ${description || null}, ${level}, ${price}, ${category || null}, ${scenario || null})
  `;

  return NextResponse.json({ success: true }, { status: 201 });
});
