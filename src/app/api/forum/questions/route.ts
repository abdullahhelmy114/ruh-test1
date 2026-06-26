import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { cookies } from 'next/headers';
import { getAuth } from 'firebase-admin/auth';
import { z } from 'zod';

async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('session')?.value;
  if (!token) return null;
  try {
    const decoded = await getAuth().verifyIdToken(token);
    return decoded;
  } catch {
    return null;
  }
}

const questionSchema = z.object({
  title: z.string().min(5, 'العنوان قصير جداً').max(200),
  content: z.string().min(10, 'المحتوى قصير جداً').max(5000),
});

// GET /api/forum/questions?sort=latest|votes&page=1
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'student') {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }

  const gender = user.gender;
  const { searchParams } = new URL(req.url);
  const sort = searchParams.get('sort') || 'latest';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = 20;
  const offset = (page - 1) * limit;

  const orderBy = sort === 'votes' 
    ? sql`(fq.upvotes - fq.downvotes) DESC` 
    : sql`fq.created_at DESC`;

  try {
    const questions = await sql`
      SELECT 
        fq.id,
        fq.user_id AS "userId",
        fq.title,
        fq.content,
        fq.upvotes,
        fq.downvotes,
        fq.created_at AS "createdAt",
        u.name AS "userName",
        u.avatar_url AS "userAvatar",
        (SELECT COUNT(*) FROM forum_answers WHERE question_id = fq.id)::int AS "answersCount",
        (SELECT vote_type FROM forum_votes 
         WHERE question_id = fq.id AND user_id = ${user.uid}
         LIMIT 1) AS "userVote"
      FROM forum_questions fq
      JOIN profiles u ON fq.user_id = u.id
      WHERE fq.gender = ${gender}
      ORDER BY ${orderBy}
      LIMIT ${limit} OFFSET ${offset}
    `;
    return NextResponse.json({ questions });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}

// POST /api/forum/questions
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'student') {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }

  const body = await req.json();
  const validation = questionSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error.flatten() }, { status: 400 });
  }

  const { title, content } = validation.data;
  const gender = user.gender;

  try {
    const result = await sql`
      INSERT INTO forum_questions (user_id, gender, title, content)
      VALUES (${user.uid}, ${gender}, ${title}, ${content})
      RETURNING id
    `;
    return NextResponse.json({ id: result[0].id }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}