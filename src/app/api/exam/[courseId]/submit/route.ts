import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { requireStudent } from '@/lib/auth';
import { withApi } from '@/lib/api/handler';

// Phase 2.2: the enrollment check and grading run for the verified caller
// (user.uid); the client no longer supplies userId. courseId (path) is the
// target. Grading logic unchanged. Edge runtime removed for firebase-admin
// compatibility.
export const POST = withApi<{ courseId: string }>(async (req, ctx) => {
  const user = await requireStudent(req);
  const { courseId } = await ctx.params;

  const { answers } = await req.json();
  if (!Array.isArray(answers)) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  // التحقق من التسجيل في الكورس
  const [enrollment] = await sql`
    SELECT 1 FROM enrollments WHERE user_uid = ${user.uid} AND course_id = ${courseId}
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
});
