import { NextResponse } from 'next/server';
import { withApi } from '@/lib/api/handler';
import { requireCommunityMember } from '@/lib/community-auth';
import { sql } from '@/lib/db/client';
import { z } from 'zod';


const joinSchema = z.object({
  challengeId: z.string().uuid(),
});

export const POST = withApi(async (req) => {
  const user = await requireCommunityMember(req);

  const body = await req.json().catch(() => null);
  const validation = joinSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error.flatten() }, { status: 400 });
  }

  const { challengeId } = validation.data;

  try {
    // جلب التحدي والتحقق من الجنس والحالة
    const challenge = await sql`
      SELECT id, gender, end_date
      FROM challenges
      WHERE id = ${challengeId}
    `;

    if (challenge.length === 0) {
      return NextResponse.json({ error: 'التحدي غير موجود' }, { status: 404 });
    }

    if (challenge[0].gender !== user.gender) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    if (challenge[0].end_date < new Date().toISOString().split('T')[0]) {
      return NextResponse.json({ error: 'التحدي منتهي' }, { status: 400 });
    }

    // التحقق من عدم الاشتراك مسبقًا
    const existing = await sql`
      SELECT id FROM challenge_participants
      WHERE challenge_id = ${challengeId} AND user_uid = ${user.uid}
    `;

    if (existing.length > 0) {
      return NextResponse.json({ error: 'أنت مشترك مسبقاً' }, { status: 409 });
    }

    // إدراج الاشتراك
    await sql`
      INSERT INTO challenge_participants (challenge_id, user_uid)
      VALUES (${challengeId}, ${user.uid})
    `;

    return NextResponse.json({ joined: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
});