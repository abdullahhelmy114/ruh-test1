import { NextResponse } from 'next/server';
import { withApi } from '@/lib/api/handler';
import { requireCommunityMember } from '@/lib/community-auth';
import { sql } from '@/lib/db/client';
import { z } from 'zod';


// مخطط التحقق من صحة البيانات
const postSchema = z.object({
  type: z.enum(['achievement', 'manual']),
  content: z.string().min(1, 'المحتوى مطلوب'),
});

// GET /api/community/posts?page=1
export const GET = withApi(async (req) => {
  const user = await requireCommunityMember(req);

  const gender = user.gender;
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Math.min(1000, parseInt(searchParams.get('page') || '1', 10) || 1));
  const limit = 20;
  const offset = (page - 1) * limit;

  try {
    const posts = await sql`
      SELECT 
        cp.id,
        cp.user_uid AS "userId",
        cp.type,
        cp.content,
        cp.created_at AS "createdAt",
        u.full_name AS "userName",
        NULL AS "userAvatar",
        (SELECT COUNT(*) FROM community_likes WHERE post_id = cp.id)::int AS "likes",
        (SELECT COUNT(*) FROM community_comments WHERE post_id = cp.id)::int AS "commentsCount",
        EXISTS (
          SELECT 1 FROM community_likes 
          WHERE post_id = cp.id AND user_uid = ${user.uid}
        ) AS "isLiked"
      FROM community_posts cp
      JOIN profiles u ON u.firebase_uid = cp.user_uid
      WHERE cp.gender = ${gender}
      ORDER BY cp.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    return NextResponse.json({ posts });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
});

// POST /api/community/posts
export const POST = withApi(async (req) => {
  const user = await requireCommunityMember(req);

  const body = await req.json().catch(() => null);
  const validation = postSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error.flatten() }, { status: 400 });
  }

  const { type, content } = validation.data;
  const gender = user.gender;

  try {
    const result = await sql`
      INSERT INTO community_posts (user_uid, gender, type, content)
      VALUES (${user.uid}, ${gender}, ${type}, ${content})
      RETURNING id
    `;
    return NextResponse.json({ id: result[0].id }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
});