import { NextResponse } from 'next/server';
import { withApi } from '@/lib/api/handler';
import { requireCommunityMember } from '@/lib/community-auth';
import { sql } from '@/lib/db/client';
import { z } from 'zod';


const questionSchema = z.object({
  title: z.string().min(5, 'العنوان قصير جداً').max(200),
  content: z.string().min(10, 'المحتوى قصير جداً').max(5000),
});

// GET /api/forum/questions?sort=latest|votes&page=1
export const GET = withApi(async (req) => {
  const user = await requireCommunityMember(req);

  const gender = user.gender;
  const { searchParams } = new URL(req.url);
  const sort = searchParams.get('sort') || 'latest';
  const page = Math.max(1, Math.min(1000, parseInt(searchParams.get('page') || '1', 10) || 1));
  const limit = 20;
  const offset = (page - 1) * limit;

  const orderBy = sort === 'votes' 
    ? sql`(fq.upvotes - fq.downvotes) DESC` 
    : sql`fq.created_at DESC`;

  try {
    const questions = await sql`
      SELECT 
        fq.id,
        fq.user_uid AS "userId",
        fq.title,
        fq.content,
        fq.upvotes,
        fq.downvotes,
        fq.created_at AS "createdAt",
        u.full_name AS "userName",
        NULL AS "userAvatar",
        (SELECT COUNT(*) FROM forum_answers WHERE question_id = fq.id)::int AS "answersCount",
        (SELECT vote_type FROM forum_votes 
         WHERE question_id = fq.id AND user_uid = ${user.uid}
         LIMIT 1) AS "userVote"
      FROM forum_questions fq
      JOIN profiles u ON u.firebase_uid = fq.user_uid
      WHERE fq.gender = ${gender}
      ORDER BY ${orderBy}
      LIMIT ${limit} OFFSET ${offset}
    `;
    return NextResponse.json({ questions });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
});

// POST /api/forum/questions
export const POST = withApi(async (req) => {
  const user = await requireCommunityMember(req);

  const body = await req.json().catch(() => null);
  const validation = questionSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error.flatten() }, { status: 400 });
  }

  const { title, content } = validation.data;
  const gender = user.gender;

  try {
    const result = await sql`
      INSERT INTO forum_questions (user_uid, gender, title, content)
      VALUES (${user.uid}, ${gender}, ${title}, ${content})
      RETURNING id
    `;
    return NextResponse.json({ id: result[0].id }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
});