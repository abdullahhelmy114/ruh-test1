import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { getServerSession } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(req);
    if (!session) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
    }

    const { course_id } = await req.json();
    if (!course_id) {
      return NextResponse.json({ error: 'معرف الكورس مطلوب' }, { status: 400 });
    }

    // 1. جلب الاشتراك النشط للمستخدم من جدول subscriptions
    const [subscription] = await sql`
      SELECT id, max_courses, courses_used, expires_at
      FROM subscriptions
      WHERE user_id = (SELECT id FROM profiles WHERE firebase_uid = ${session.uid})
        AND expires_at > NOW()
      LIMIT 1
    `;
    if (!subscription) {
      return NextResponse.json({ error: 'لا يوجد اشتراك نشط' }, { status: 403 });
    }

    // 2. التأكد من عدم تجاوز الحد الأقصى للكورسات
    if (subscription.courses_used >= subscription.max_courses) {
      return NextResponse.json({ error: 'لقد وصلت للحد الأقصى من الكورسات' }, { status: 400 });
    }

    // 3. التحقق من أن الكورس الحي موجود وليس ضمن كورسات الاشتراك سابقاً
    const [liveCourse] = await sql`
      SELECT id FROM live_courses WHERE id = ${course_id} AND status = 'active'
    `;
    if (!liveCourse) {
      return NextResponse.json({ error: 'الكورس غير متاح' }, { status: 404 });
    }

    const alreadyChosen = await sql`
      SELECT id FROM subscription_courses
      WHERE subscription_id = ${subscription.id} AND course_id = ${course_id}
    `;
    if (alreadyChosen.length > 0) {
      return NextResponse.json({ error: 'الكورس تم اختياره بالفعل' }, { status: 409 });
    }

    // 4. إضافة الكورس إلى subscription_courses
    await sql`
      INSERT INTO subscription_courses (subscription_id, course_id)
      VALUES (${subscription.id}, ${course_id})
    `;

    // 5. زيادة عداد الكورسات المستخدمة في الاشتراك
    await sql`
      UPDATE subscriptions
      SET courses_used = courses_used + 1
      WHERE id = ${subscription.id}
    `;

    // 6. تسجيل الطالب تلقائياً في الكورس ( enrollments )
    await sql`
      INSERT INTO enrollments (user_uid, course_id)
      VALUES (${session.uid}, ${course_id})
      ON CONFLICT (user_uid, course_id) DO NOTHING
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Choose course error:', error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}