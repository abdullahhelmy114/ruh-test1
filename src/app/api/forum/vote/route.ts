import { NextResponse } from 'next/server';
import { withApi } from '@/lib/api/handler';
import { requireCommunityMember } from '@/lib/community-auth';
import { sql } from '@/lib/db/client';
import { z } from 'zod';


const voteSchema = z.object({
  targetId: z.string().uuid(),
  targetType: z.enum(['question', 'answer']),
  voteType: z.enum(['upvote', 'downvote']),
});

export const POST = withApi(async (req) => {
  const user = await requireCommunityMember(req);

  const body = await req.json().catch(() => null);
  const validation = voteSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error.flatten() }, { status: 400 });
  }

  const { targetId, targetType, voteType } = validation.data;

  try {
    // التحقق من الجنس (السؤال أو الإجابة)
    let targetGender = '';

    if (targetType === 'question') {
      const rows = await sql`
        SELECT gender FROM forum_questions WHERE id = ${targetId}
      `;
      if (rows.length === 0) {
        return NextResponse.json({ error: 'العنصر غير موجود' }, { status: 404 });
      }
      targetGender = rows[0].gender;
    } else {
      const rows = await sql`
        SELECT fq.gender 
        FROM forum_answers fa 
        JOIN forum_questions fq ON fa.question_id = fq.id 
        WHERE fa.id = ${targetId}
      `;
      if (rows.length === 0) {
        return NextResponse.json({ error: 'العنصر غير موجود' }, { status: 404 });
      }
      targetGender = rows[0].gender;
    }

    if (targetGender !== user.gender) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    // البحث عن تصويت سابق
    const existingVote = await sql`
      SELECT id, vote_type 
      FROM forum_votes 
      WHERE user_uid = ${user.uid}
        AND (
          ${targetType === 'question' ? sql`question_id = ${targetId}` : sql`answer_id = ${targetId}`}
        )
    `;

    if (existingVote.length > 0) {
      const prev = existingVote[0];

      if (prev.vote_type === voteType) {
        // إلغاء نفس التصويت
        await sql`DELETE FROM forum_votes WHERE id = ${prev.id}`;

        // إنقاص العداد الصحيح
        if (targetType === 'question') {
          if (voteType === 'upvote') {
            await sql`UPDATE forum_questions SET upvotes = GREATEST(0, upvotes - 1) WHERE id = ${targetId}`;
          } else {
            await sql`UPDATE forum_questions SET downvotes = GREATEST(0, downvotes - 1) WHERE id = ${targetId}`;
          }
        } else {
          if (voteType === 'upvote') {
            await sql`UPDATE forum_answers SET upvotes = GREATEST(0, upvotes - 1) WHERE id = ${targetId}`;
          } else {
            await sql`UPDATE forum_answers SET downvotes = GREATEST(0, downvotes - 1) WHERE id = ${targetId}`;
          }
        }
        return NextResponse.json({ status: 'cancelled' });
      } else {
        // تغيير التصويت
        await sql`UPDATE forum_votes SET vote_type = ${voteType} WHERE id = ${prev.id}`;

        // تعديل العدادات
        if (targetType === 'question') {
          if (voteType === 'upvote') {
            await sql`UPDATE forum_questions SET upvotes = upvotes + 1, downvotes = GREATEST(0, downvotes - 1) WHERE id = ${targetId}`;
          } else {
            await sql`UPDATE forum_questions SET downvotes = downvotes + 1, upvotes = GREATEST(0, upvotes - 1) WHERE id = ${targetId}`;
          }
        } else {
          if (voteType === 'upvote') {
            await sql`UPDATE forum_answers SET upvotes = upvotes + 1, downvotes = GREATEST(0, downvotes - 1) WHERE id = ${targetId}`;
          } else {
            await sql`UPDATE forum_answers SET downvotes = downvotes + 1, upvotes = GREATEST(0, upvotes - 1) WHERE id = ${targetId}`;
          }
        }
        return NextResponse.json({ status: 'changed' });
      }
    } else {
      // تصويت جديد
      if (targetType === 'question') {
        await sql`
          INSERT INTO forum_votes (user_uid, question_id, vote_type)
          VALUES (${user.uid}, ${targetId}, ${voteType})
        `;
        if (voteType === 'upvote') {
          await sql`UPDATE forum_questions SET upvotes = upvotes + 1 WHERE id = ${targetId}`;
        } else {
          await sql`UPDATE forum_questions SET downvotes = downvotes + 1 WHERE id = ${targetId}`;
        }
      } else {
        await sql`
          INSERT INTO forum_votes (user_uid, answer_id, vote_type)
          VALUES (${user.uid}, ${targetId}, ${voteType})
        `;
        if (voteType === 'upvote') {
          await sql`UPDATE forum_answers SET upvotes = upvotes + 1 WHERE id = ${targetId}`;
        } else {
          await sql`UPDATE forum_answers SET downvotes = downvotes + 1 WHERE id = ${targetId}`;
        }
      }
      return NextResponse.json({ status: 'voted' });
    }
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
});