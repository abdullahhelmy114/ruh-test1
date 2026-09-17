import { NextResponse } from 'next/server';
import { withApi } from '@/lib/api/handler';
import { requireCommunityMember } from '@/lib/community-auth';
import { sql } from '@/lib/db/client';
import { z } from 'zod';


const likeSchema = z.object({
  postId: z.string().uuid(),
});

// POST /api/community/likes
export const POST = withApi(async (req) => {
  const user = await requireCommunityMember(req);

  const body = await req.json().catch(() => null);
  const validation = likeSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error.flatten() }, { status: 400 });
  }

  const { postId } = validation.data;

  try {
    // التحقق أن المنشور موجود وينتمي لنفس جنس المستخدم
    const post = await sql`
      SELECT gender FROM community_posts WHERE id = ${postId}
    `;
    if (post.length === 0) {
      return NextResponse.json({ error: 'المنشور غير موجود' }, { status: 404 });
    }
    if (post[0].gender !== user.gender) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    // التحقق من وجود إعجاب سابق
    const existing = await sql`
      SELECT id FROM community_likes
      WHERE post_id = ${postId} AND user_uid = ${user.uid}
    `;

    if (existing.length > 0) {
      // إلغاء الإعجاب
      await sql`
        DELETE FROM community_likes WHERE id = ${existing[0].id}
      `;
      return NextResponse.json({ liked: false });
    } else {
      // إضافة إعجاب
      await sql`
        INSERT INTO community_likes (post_id, user_uid)
        VALUES (${postId}, ${user.uid})
      `;
      return NextResponse.json({ liked: true });
    }
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
});