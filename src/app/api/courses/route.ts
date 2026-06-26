export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';

export async function POST(request: Request) {
  try {
    const { title, description, level, price, image_url, trailer_url, teacherUid } = await request.json();
    if (!title || !description || !teacherUid) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const [course] = await sql`
      INSERT INTO courses (title, description, level, price, image_url, trailer_url, teacher_uid, status)
      VALUES (${title}, ${description}, ${level}, ${price}, ${image_url || null}, ${trailer_url || null}, ${teacherUid}, 'pending')
      RETURNING id, title, status
    `;
    return NextResponse.json({ course });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}