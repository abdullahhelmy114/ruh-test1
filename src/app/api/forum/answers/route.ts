import { NextResponse } from 'next/server';
import { withApi } from '@/lib/api/handler';
import { requireCommunityMember } from '@/lib/community-auth';
import { sql } from '@/lib/db/client';
import { z } from 'zod';


const answerSchema = z.object({
  questionId: z.string().uuid(),
  content: z.string().min(5, 'الإجابة قصيرة جداً').max(5000),
});

// POST /api/forum/answers
export const POST = withApi(async (req) => {
  const user = await requireCommunityMember(req);

  const body = await req.json().catch(() => null);
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
      INSERT INTO forum_answers (question_id, user_uid, content)
      VALUES (${questionId}, ${user.uid}, ${content})
      RETURNING id
    `;
    return NextResponse.json({ id: result[0].id }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
});