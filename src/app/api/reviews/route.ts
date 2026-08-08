export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';

// GET: جلب تقييمات كورس مع المتوسط وعدد التقييمات
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get('courseId');
  if (!courseId) return NextResponse.json({ reviews: [], average: 0, count: 0 });

  try {
    const reviews = await sql`
      SELECT r.*, p.full_name AS user_name
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
  } catch (error: any) {
    return NextResponse.json({ reviews: [], average: 0, count: 0, error: error.message });
  }
}

// POST: إضافة تقييم جديد (أو تحديثه)
export async function POST(request: Request) {
  try {
    const { userUid, courseId, rating, comment } = await request.json();
    if (!userUid || !courseId || !rating) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    await sql`
      INSERT INTO reviews (user_uid, course_id, rating, comment)
      VALUES (${userUid}, ${courseId}, ${rating}, ${comment || null})
      ON CONFLICT (user_uid, course_id) DO UPDATE SET rating = ${rating}, comment = ${comment || null}
    `;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}