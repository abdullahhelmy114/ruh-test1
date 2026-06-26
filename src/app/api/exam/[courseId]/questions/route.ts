export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';

export async function GET(request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  try {
    const questions = await sql`
      SELECT * FROM exam_questions
      WHERE course_id = ${courseId}
      ORDER BY RANDOM()
      LIMIT 25
    `;
    return NextResponse.json({ questions });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}