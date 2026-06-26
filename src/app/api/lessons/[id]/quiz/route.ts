export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: lessonId } = await context.params;
  try {
    const questions = await sql`
      SELECT id, question, options, correct
      FROM quizzes
      WHERE lesson_id = ${lessonId}
      ORDER BY created_at ASC
    `;
    return NextResponse.json({ questions });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}