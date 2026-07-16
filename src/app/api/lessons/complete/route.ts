export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';

export async function POST(request: Request) {
  try {
    const { lessonId, uid } = await request.json();
    if (!lessonId || !uid) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    await sql`
      INSERT INTO lesson_completions (lesson_id, user_uid) VALUES (${lessonId}, ${uid})
      ON CONFLICT DO NOTHING
    `;
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}