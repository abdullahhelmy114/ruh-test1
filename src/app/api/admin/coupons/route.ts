export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';

// GET: عرض كل الكوبونات
export async function GET() {
  try {
    const coupons = await sql`SELECT * FROM coupons ORDER BY created_at DESC`;
    return NextResponse.json({ coupons });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST: إنشاء كوبون جديد
export async function POST(request: Request) {
  try {
    const { code, discount_percent, max_uses, valid_until } = await request.json();
    if (!code || !discount_percent) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    await sql`
      INSERT INTO coupons (code, discount_percent, max_uses, valid_until)
      VALUES (${code.toUpperCase()}, ${discount_percent}, ${max_uses || null}, ${valid_until || null})
    `;
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE: حذف كوبون
export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    await sql`DELETE FROM coupons WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}