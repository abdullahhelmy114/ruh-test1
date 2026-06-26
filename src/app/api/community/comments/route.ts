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

const commentSchema = z.object({
  postId: z.string().uuid(),
  content: z.string().min(1, 'التعليق مطلوب').max(1000),
});

// POST /api/community/comments
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'student') {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }

  const body = await req.json();
  const validation = commentSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error.flatten() }, { status: 400 });
  }

  const { postId, content } = validation.data;

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

    // إدراج التعليق
    const result = await sql`
      INSERT INTO community_comments (post_id, user_id, content)
      VALUES (${postId}, ${user.uid}, ${content})
      RETURNING id
    `;
    return NextResponse.json({ id: result[0].id }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}