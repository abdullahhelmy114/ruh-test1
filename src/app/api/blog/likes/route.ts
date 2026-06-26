export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';

// POST: تبديل الإعجاب (إضافة/حذف)
export async function POST(request: Request) {
  try {
    const { postId, userUid } = await request.json();
    if (!postId || !userUid) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    // هل يوجد إعجاب سابق؟
    const [existing] = await sql`SELECT 1 FROM blog_likes WHERE post_id = ${postId} AND user_uid = ${userUid}`;

    if (existing) {
      await sql`DELETE FROM blog_likes WHERE post_id = ${postId} AND user_uid = ${userUid}`;
    } else {
      await sql`INSERT INTO blog_likes (post_id, user_uid) VALUES (${postId}, ${userUid}) ON CONFLICT DO NOTHING`;
    }

    // إرجاع العدد الجديد
    const [count] = await sql`SELECT COUNT(*)::int AS count FROM blog_likes WHERE post_id = ${postId}`;
    return NextResponse.json({ liked: !existing, count: count?.count || 0 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}