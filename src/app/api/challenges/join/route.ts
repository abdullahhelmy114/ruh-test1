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

const joinSchema = z.object({
  challengeId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'student') {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }

  const body = await req.json();
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
      WHERE challenge_id = ${challengeId} AND user_id = ${user.uid}
    `;

    if (existing.length > 0) {
      return NextResponse.json({ error: 'أنت مشترك مسبقاً' }, { status: 409 });
    }

    // إدراج الاشتراك
    await sql`
      INSERT INTO challenge_participants (challenge_id, user_id)
      VALUES (${challengeId}, ${user.uid})
    `;

    return NextResponse.json({ joined: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}