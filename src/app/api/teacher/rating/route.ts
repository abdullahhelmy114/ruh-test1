export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';

export async function GET(request: Request) {
  const uid = new URL(request.url).searchParams.get('uid');
  if (!uid) return NextResponse.json({ error: 'Missing uid' }, { status: 400 });

  try {
    // متوسط التقييم من تقييمات الطلاب على دروس المعلم
    const [ratingResult] = await sql`
      SELECT AVG(lr.rating) AS average_rating
      FROM lesson_reviews lr
      JOIN lessons l ON lr.lesson_id = l.id
      WHERE l.teacher_uid = ${uid}
    `;

    // عدد الدروس المكتملة بواسطة الطلاب
    const [countResult] = await sql`
      SELECT COUNT(*) AS completed_lessons
      FROM lesson_completions lc
      JOIN lessons l ON lc.lesson_id = l.id
      WHERE l.teacher_uid = ${uid}
    `;

    const averageRating = ratingResult?.average_rating ? parseFloat(ratingResult.average_rating) : 0;
    const completedLessons = parseInt(countResult?.completed_lessons || '0', 10);

    return NextResponse.json({
      averageRating,
      completedLessons,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}