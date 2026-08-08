export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { sendEmail, courseEnrolledEmail } from '@/lib/email';

export async function POST(request: Request) {
  try {
    const { userId, courseId } = await request.json();
    if (!userId || !courseId) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    // جلب بيانات الكورس والمستخدم معاً
    const [course] = await sql`SELECT price, title FROM courses WHERE id = ${courseId}`;
    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }
    if (course.price > 0) {
      return NextResponse.json({ error: 'Paid enrollment is not available yet' }, { status: 402 });
    }

    const [user] = await sql`SELECT full_name, email FROM profiles WHERE firebase_uid = ${userId}`;

    // إدراج التسجيل
    await sql`
      INSERT INTO enrollments (user_uid, course_id) VALUES (${userId}, ${courseId})
      ON CONFLICT (user_uid, course_id) DO NOTHING
    `;

    // إرسال إيميل التأكيد
    if (user) {
      await sendEmail(user.email, 'Enrolled!', courseEnrolledEmail(user.full_name, course.title));
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}