import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { requireAdmin } from '@/lib/auth';
import { withApi } from '@/lib/api/handler';

// Phase 2.1: previously unauthenticated (anyone could list, mint or delete
// coupons). All handlers now require an admin session. Edge runtime removed
// because the auth layer depends on firebase-admin (Node only).

// GET: عرض كل الكوبونات
export const GET = withApi(async (req) => {
  await requireAdmin(req);

  const coupons = await sql`SELECT * FROM coupons ORDER BY created_at DESC`;
  return NextResponse.json({ coupons });
});

// POST: إنشاء كوبون جديد
export const POST = withApi(async (req) => {
  await requireAdmin(req);

  const { code, discount_percent, max_uses, valid_until } = await req.json();

  if (typeof code !== 'string' || !code.trim()) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }
  const percent = Number(discount_percent);
  if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
    return NextResponse.json(
      { error: 'discount_percent must be a number between 1 and 100' },
      { status: 400 }
    );
  }

  await sql`
    INSERT INTO coupons (code, discount_percent, max_uses, valid_until)
    VALUES (${code.trim().toUpperCase()}, ${percent}, ${max_uses || null}, ${valid_until || null})
  `;
  return NextResponse.json({ success: true });
});

// DELETE: حذف كوبون
export const DELETE = withApi(async (req) => {
  await requireAdmin(req);

  const { id } = await req.json();
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  await sql`DELETE FROM coupons WHERE id = ${id}`;
  return NextResponse.json({ success: true });
});
