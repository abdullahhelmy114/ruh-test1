import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { cookies } from 'next/headers';
import { getAuth } from 'firebase-admin/auth';
import { z } from 'zod';

// دالة استخراج المستخدم الحالي من الكوكي
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

// مخطط التحقق من صحة البيانات
const postSchema = z.object({
  type: z.enum(['achievement', 'manual']),
  content: z.string().min(1, 'المحتوى مطلوب'),
});

// GET /api/community/posts?page=1
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'student') {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }

  const gender = user.gender;
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = 20;
  const offset = (page - 1) * limit;

  try {
    const posts = await sql`
      SELECT 
        cp.id,
        cp.user_id AS "userId",
        cp.type,
        cp.content,
        cp.created_at AS "createdAt",
        u.name AS "userName",
        u.avatar_url AS "userAvatar",
        (SELECT COUNT(*) FROM community_likes WHERE post_id = cp.id)::int AS "likes",
        (SELECT COUNT(*) FROM community_comments WHERE post_id = cp.id)::int AS "commentsCount",
        EXISTS (
          SELECT 1 FROM community_likes 
          WHERE post_id = cp.id AND user_id = ${user.uid}
        ) AS "isLiked"
      FROM community_posts cp
      JOIN users u ON cp.user_id = u.id
      WHERE cp.gender = ${gender}
      ORDER BY cp.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    return NextResponse.json({ posts });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}

// POST /api/community/posts
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'student') {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }

  const body = await req.json();
  const validation = postSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error.flatten() }, { status: 400 });
  }

  const { type, content } = validation.data;
  const gender = user.gender;

  try {
    const result = await sql`
      INSERT INTO community_posts (user_id, gender, type, content)
      VALUES (${user.uid}, ${gender}, ${type}, ${content})
      RETURNING id
    `;
    return NextResponse.json({ id: result[0].id }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}