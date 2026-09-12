import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { requireAuth } from '@/lib/auth';
import { withApi } from '@/lib/api/handler';

// Phase 2.4a: caller identity from the central auth layer; the subscription
// returned is always the caller's own. Query unchanged (subscriptions.user_uid
// is profiles.id, joined via profiles.firebase_uid — Phase 4 key decision).
export const GET = withApi(async (req) => {
  const user = await requireAuth(req);

  try {
    // جلب الاشتراك النشط
    const [subscription] = await sql`
      SELECT s.id, s.max_course, s.course_used, s.expires_at
      FROM subscriptions s
      JOIN profiles p ON s.user_uid = p.id
      WHERE p.firebase_uid = ${user.uid}
        AND s.expires_at > NOW()
      LIMIT 1
    `;

    if (!subscription) {
      return NextResponse.json({ subscription: null });
    }

    // جلب الكورسات المختارة في هذا الاشتراك
    const chosencourse = await sql`
      SELECT sc.course_id
      FROM subscription_course sc
      WHERE sc.subscription_id = ${subscription.id}
    `;

    const courseIds = chosencourse.map((row: any) => row.course_id);

    return NextResponse.json({
      subscription: {
        id: subscription.id,
        max_course: subscription.max_course,
        course_used: subscription.course_used,
        expires_at: subscription.expires_at,
        course_ids: courseIds,
      },
    });
  } catch (error) {
    console.error('Get subscription error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
});
