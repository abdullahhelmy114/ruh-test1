export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';

// GET: جلب محتويات السلة
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const uid = searchParams.get('uid');
  if (!uid) return NextResponse.json({ items: [] });

  try {
    const items = await sql`
      SELECT ci.id, ci.course_id, c.title, c.level, c.price, c.image_url, p.full_name AS teacher_name
      FROM cart_items ci
      JOIN courses c ON ci.course_id = c.id
      JOIN profiles p ON c.teacher_uid = p.firebase_uid
      WHERE ci.user_uid = ${uid}
      ORDER BY ci.created_at DESC
    `;
    return NextResponse.json({ items });
  } catch (error: any) {
    return NextResponse.json({ items: [], error: error.message });
  }
}

// POST: إضافة كورس إلى السلة
export async function POST(request: Request) {
  try {
    const { uid, courseId } = await request.json();
    if (!uid || !courseId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    await sql`
      INSERT INTO cart_items (user_uid, course_id) VALUES (${uid}, ${courseId})
      ON CONFLICT (user_uid, course_id) DO NOTHING
    `;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: حذف كورس من السلة
export async function DELETE(request: Request) {
  try {
    const { uid, courseId } = await request.json();
    if (!uid || !courseId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    await sql`DELETE FROM cart_items WHERE user_uid = ${uid} AND course_id = ${courseId}`;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}