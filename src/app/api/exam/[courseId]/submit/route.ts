export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';

export async function POST(request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  try {
    const { userId, answers } = await request.json();
    if (!userId || !answers) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    // التحقق من التسجيل في الكورس
    const [enrollment] = await sql`
      SELECT 1 FROM enrollments WHERE user_uid = ${userId} AND course_id = ${courseId}
    `;
    if (!enrollment) {
      return NextResponse.json({ error: 'Not enrolled' }, { status: 403 });
    }

    let score = 0;
    const total = answers.length;
    for (const ans of answers) {
      const [q] = await sql`SELECT correct FROM exam_questions WHERE id = ${ans.questionId}`;
      if (q && q.correct === ans.selected) score++;
    }

    const passed = score >= total * 0.6;
    return NextResponse.json({ score, total, passed });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}