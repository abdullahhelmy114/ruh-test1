export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';

export async function GET(request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  try {
    const quizzes = await sql`SELECT * FROM course_quizzes WHERE course_id = ${courseId} ORDER BY id`;
    return NextResponse.json({ quizzes });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}