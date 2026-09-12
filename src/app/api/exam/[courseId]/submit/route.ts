import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { requireStudent, requireEnrolled } from '@/lib/auth';
import { withApi } from '@/lib/api/handler';

// Phase 2.2: the enrollment check and grading run for the verified caller;
// the client no longer supplies the caller identity. courseId (path) is the
// target. Edge runtime removed for firebase-admin compatibility.
//
// Phase 2.4a (secondary check): the denominator used to be the length of the
// client-submitted array, so one correct answer submitted alone scored 100%.
// The denominator is now what the questions route serves for this course
// (min(25, course question count)); duplicate ids count once and ids from
// other courses are ignored. Pass threshold (60%) unchanged. Enrollment now
// goes through the central requireEnrolled helper (admin bypass).
// REVIEW (Phase 4): the served question ids are not persisted per attempt.
const EXAM_SERVED_LIMIT = 25; // must match exam/[courseId]/questions LIMIT

export const POST = withApi<{ courseId: string }>(async (req, ctx) => {
  const user = await requireStudent(req);
  const { courseId } = await ctx.params;

  const { answers } = await req.json();
  if (!Array.isArray(answers)) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  // التحقق من التسجيل في الكورس
  await requireEnrolled(user, courseId);

  // مفتاح الإجابات لأسئلة هذا الكورس فقط
  const rows = await sql`SELECT id, correct FROM exam_questions WHERE course_id = ${courseId}`;
  const answerKey = new Map<string, number>();
  for (const q of rows) answerKey.set(String(q.id), Number(q.correct));

  const total = Math.min(EXAM_SERVED_LIMIT, answerKey.size);
  const seen = new Set<string>();
  let score = 0;
  for (const ans of answers) {
    const id = String(ans?.questionId ?? '');
    if (!id || seen.has(id) || !answerKey.has(id)) continue;
    seen.add(id);
    if (Number.isInteger(ans?.selected) && ans.selected === answerKey.get(id)) score++;
  }
  if (score > total) score = total;

  const passed = score >= total * 0.6;
  return NextResponse.json({ score, total, passed });
});
