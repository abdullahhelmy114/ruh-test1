import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { requireAuth } from '@/lib/auth';
import { withApi } from '@/lib/api/handler';

// Phase 2.2: the cart owner is always the verified caller (user.uid). The
// client no longer supplies uid; courseId remains the target resource.
// Edge runtime removed for firebase-admin compatibility.

// GET: جلب محتويات السلة
export const GET = withApi(async (req) => {
  const user = await requireAuth(req);

  const items = await sql`
    SELECT ci.id, ci.course_id, c.title, c.level, c.price, c.image_url, p.full_name AS teacher_name
    FROM cart_items ci
    JOIN course c ON ci.course_id = c.id
    JOIN profiles p ON c.teacher_uid = p.firebase_uid
    WHERE ci.user_uid = ${user.uid}
    ORDER BY ci.created_at DESC
  `;
  return NextResponse.json({ items });
});

// POST: إضافة كورس إلى السلة
export const POST = withApi(async (req) => {
  const user = await requireAuth(req);

  const { courseId } = await req.json();
  if (!courseId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  await sql`
    INSERT INTO cart_items (user_uid, course_id) VALUES (${user.uid}, ${courseId})
    ON CONFLICT (user_uid, course_id) DO NOTHING
  `;
  return NextResponse.json({ success: true });
});

// DELETE: حذف كورس من السلة
export const DELETE = withApi(async (req) => {
  const user = await requireAuth(req);

  const { courseId } = await req.json();
  if (!courseId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  await sql`DELETE FROM cart_items WHERE user_uid = ${user.uid} AND course_id = ${courseId}`;
  return NextResponse.json({ success: true });
});
