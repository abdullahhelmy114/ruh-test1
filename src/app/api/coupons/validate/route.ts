export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';

export async function POST(request: Request) {
  try {
    const { code, userId } = await request.json();
    if (!code || !userId) return NextResponse.json({ valid: false, error: 'Missing fields' }, { status: 400 });

    const [coupon] = await sql`
      SELECT * FROM coupons
      WHERE code = ${code.toUpperCase()}
        AND is_active = true
        AND (valid_until IS NULL OR valid_until > NOW())
        AND (max_uses IS NULL OR current_uses < max_uses)
    `;

    if (!coupon) return NextResponse.json({ valid: false, error: 'Invalid or expired coupon' });

    return NextResponse.json({
      valid: true,
      discount_percent: coupon.discount_percent,
      coupon_id: coupon.id,
    });
  } catch (e: any) {
    return NextResponse.json({ valid: false, error: e.message }, { status: 500 });
  }
}