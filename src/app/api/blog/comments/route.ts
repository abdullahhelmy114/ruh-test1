export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';

// GET: جلب تعليقات بوست معين
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const postId = searchParams.get('postId');
  if (!postId) return NextResponse.json({ error: 'Missing postId' }, { status: 400 });

  try {
    const comments = await sql`
      SELECT c.*, p.full_name AS user_name, p.avatar_url
      FROM blog_comments c
      JOIN profiles p ON c.user_uid = p.firebase_uid
      WHERE c.post_id = ${postId}
      ORDER BY c.created_at ASC
    `;
    return NextResponse.json({ comments });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: إضافة تعليق جديد
export async function POST(request: Request) {
  try {
    const { postId, userUid, comment } = await request.json();
    if (!postId || !userUid || !comment) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    await sql`
      INSERT INTO blog_comments (post_id, user_uid, comment)
      VALUES (${postId}, ${userUid}, ${comment})
    `;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: حذف تعليق (للأدمن أو صاحب التعليق)
export async function DELETE(request: Request) {
  try {
    const { commentId, userUid, isAdmin } = await request.json();
    if (!commentId || !userUid) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    if (isAdmin) {
      await sql`DELETE FROM blog_comments WHERE id = ${commentId}`;
    } else {
      await sql`DELETE FROM blog_comments WHERE id = ${commentId} AND user_uid = ${userUid}`;
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}