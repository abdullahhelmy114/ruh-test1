import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { requireAuth } from '@/lib/auth';
import { withApi } from '@/lib/api/handler';

// Phase 2.2: requires an authenticated caller. The former `userId` input was
// never used by the query and is no longer accepted. Rate limiting against
// code enumeration is deferred to Phase 3. Edge runtime removed for
// firebase-admin compatibility.
export const POST = withApi(async (req) => {
  await requireAuth(req);

  const { code } = await req.json();
  if (typeof code !== 'string' || !code) {
    return NextResponse.json({ valid: false, error: 'Missing fields' }, { status: 400 });
  }

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
});
