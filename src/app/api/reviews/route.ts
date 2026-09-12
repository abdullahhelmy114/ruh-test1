import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { requireAuth } from '@/lib/auth';
import { withApi } from '@/lib/api/handler';

// GET: جلب تقييمات كورس مع المتوسط وعدد التقييمات
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get('courseId');
  if (!courseId) return NextResponse.json({ reviews: [], average: 0, count: 0 });

  try {
    // Phase 3 batch 1: public projection — reviewer Firebase uids are not
    // returned; the display name is enough for the public course page.
    const reviews = await sql`
      SELECT r.id, r.rating, r.comment, r.created_at, p.full_name AS user_name
      FROM reviews r
      JOIN profiles p ON r.user_uid = p.firebase_uid
      WHERE r.course_id = ${courseId}
      ORDER BY r.created_at DESC
    `;

    const [stats] = await sql`
      SELECT COALESCE(ROUND(AVG(rating), 1), 0) AS average, COUNT(*)::int AS count
      FROM reviews WHERE course_id = ${courseId}
    `;

    return NextResponse.json({
      reviews,
      average: stats?.average || 0,
      count: stats?.count || 0,
    });
  } catch (error) {
    console.error('Reviews fetch error:', error);
    return NextResponse.json({ reviews: [], average: 0, count: 0, error: 'Failed to load reviews' });
  }
}

// POST: إضافة تقييم جديد (أو تحديثه)
// Phase 2.2: the review author is the verified caller (user.uid); the client
// no longer supplies userUid. courseId remains the target. Edge runtime
// removed from this file for firebase-admin compatibility.
export const POST = withApi(async (req) => {
  const user = await requireAuth(req);

  const { courseId, rating, comment } = await req.json();
  if (!courseId || !rating) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  await sql`
    INSERT INTO reviews (user_uid, course_id, rating, comment)
    VALUES (${user.uid}, ${courseId}, ${rating}, ${comment || null})
    ON CONFLICT (user_uid, course_id) DO UPDATE SET rating = ${rating}, comment = ${comment || null}
  `;
  return NextResponse.json({ success: true });
});