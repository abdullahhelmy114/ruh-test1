import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { cookies } from 'next/headers';
import { getAuth } from 'firebase-admin/auth';
import { z } from 'zod';

async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('session')?.value;
  if (!token) return null;
  try {
    const decoded = await getAuth().verifyIdToken(token);
    return decoded;
  } catch {
    return null;
  }
}

const answerSchema = z.object({
  questionId: z.string().uuid(),
  content: z.string().min(5, 'الإجابة قصيرة جداً').max(5000),
});

// POST /api/forum/answers
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'student') {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }

  const body = await req.json();
  const validation = answerSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error.flatten() }, { status: 400 });
  }

  const { questionId, content } = validation.data;

  try {
    // التحقق أن السؤال موجود وينتمي لنفس جنس المستخدم
    const question = await sql`
      SELECT gender FROM forum_questions WHERE id = ${questionId}
    `;
    if (question.length === 0) {
      return NextResponse.json({ error: 'السؤال غير موجود' }, { status: 404 });
    }
    if (question[0].gender !== user.gender) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    // إدراج الإجابة
    const result = await sql`
      INSERT INTO forum_answers (question_id, user_id, content)
      VALUES (${questionId}, ${user.uid}, ${content})
      RETURNING id
    `;
    return NextResponse.json({ id: result[0].id }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}