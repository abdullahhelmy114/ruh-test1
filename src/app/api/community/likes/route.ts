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

const likeSchema = z.object({
  postId: z.string().uuid(),
});

// POST /api/community/likes
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'student') {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }

  const body = await req.json();
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
      WHERE post_id = ${postId} AND user_id = ${user.uid}
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
        INSERT INTO community_likes (post_id, user_id)
        VALUES (${postId}, ${user.uid})
      `;
      return NextResponse.json({ liked: true });
    }
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}