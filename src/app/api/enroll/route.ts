export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { sendEmail, courseEnrolledEmail } from '@/lib/email';

export async function POST(request: Request) {
  try {
    const { userId, courseId } = await request.json(); // userId هنا قادم كـ firebase_uid
    if (!userId || !courseId) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const [course] = await sql`SELECT price, title FROM courses WHERE id = ${courseId}`;
    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }
    if (course.price > 0) {
      return NextResponse.json({ error: 'Paid enrollment is not available yet' }, { status: 402 });
    }

    // 🔥 جلب الـ UUID الخاص بقاعدة البيانات (id)
    const [user] = await sql`SELECT id, full_name, email FROM profiles WHERE firebase_uid = ${userId}`;
    
    if (!user) {
      return NextResponse.json({ error: 'User not found in profiles' }, { status: 404 });
    }

    // 🔥 استخدام user.id و user_id وليس user_uid
    await sql`
      INSERT INTO enrollments (user_id, course_id) VALUES (${user.id}, ${courseId})
      ON CONFLICT (user_id, course_id) DO NOTHING
    `;

    if (user.email) {
      await sendEmail(user.email, 'Enrolled!', courseEnrolledEmail(user.full_name, course.title));
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}