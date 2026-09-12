import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { requireAuth } from '@/lib/auth';
import { withApi } from '@/lib/api/handler';
import { checkRateLimit, retryAfterSeconds } from '@/lib/security/rate-limit';
import { isCouponCodeShape, normalizeCouponCode } from '@/lib/security/input-policy';

// Phase 2.2: requires an authenticated caller. The former `userId` input was
// never used by the query and is no longer accepted.
//
// Phase 3 batch 5 — enumeration control:
//   - 10 validations / 10 min per verified uid
//   - code is trimmed and upper-cased (matching admin creation), then must
//     match ^[A-Z0-9_-]{3,32}$; anything else gets the same generic
//     "invalid" answer as a miss, so malformed input is not a separate oracle
// The successful response shape is unchanged. Redemption, current_uses and
// purchase consumption are Phase 4.
const USER_LIMIT = { limit: 10, windowMs: 10 * 60 * 1000 };
const INVALID = { valid: false, error: 'Invalid or expired coupon' };

export const POST = withApi(async (req) => {
  const user = await requireAuth(req);

  const check = checkRateLimit(`coupon-validate:${user.uid}`, USER_LIMIT);
  if (!check.allowed) {
    return NextResponse.json(
      { valid: false, error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSeconds(check)) } }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ valid: false, error: 'Missing fields' }, { status: 400 });
  }
  const code = normalizeCouponCode((body as Record<string, unknown>).code);
  if (code === null || code.length === 0) {
    return NextResponse.json({ valid: false, error: 'Missing fields' }, { status: 400 });
  }
  if (!isCouponCodeShape(code)) return NextResponse.json(INVALID);

  const [coupon] = await sql`
    SELECT * FROM coupons
    WHERE code = ${code}
      AND is_active = true
      AND (valid_until IS NULL OR valid_until > NOW())
      AND (max_uses IS NULL OR current_uses < max_uses)
  `;

  if (!coupon) return NextResponse.json(INVALID);

  return NextResponse.json({
    valid: true,
    discount_percent: coupon.discount_percent,
    coupon_id: coupon.id,
  });
});
