import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { getServerSession } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // جلب الاشتراك النشط
    const [subscription] = await sql`
      SELECT s.id, s.max_courses, s.courses_used, s.expires_at
      FROM subscriptions s
      JOIN profiles p ON s.user_id = p.id
      WHERE p.firebase_uid = ${session.uid}
        AND s.expires_at > NOW()
      LIMIT 1
    `;

    if (!subscription) {
      return NextResponse.json({ subscription: null });
    }

    // جلب الكورسات المختارة في هذا الاشتراك
    const chosenCourses = await sql`
      SELECT sc.course_id
      FROM subscription_courses sc
      WHERE sc.subscription_id = ${subscription.id}
    `;

    const courseIds = chosenCourses.map((row: any) => row.course_id);

    return NextResponse.json({
      subscription: {
        id: subscription.id,
        max_courses: subscription.max_courses,
        courses_used: subscription.courses_used,
        expires_at: subscription.expires_at,
        course_ids: courseIds,
      },
    });
  } catch (error) {
    console.error('Get subscription error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}