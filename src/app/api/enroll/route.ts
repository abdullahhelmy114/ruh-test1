export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { sendEmail, courseEnrolledEmail } from '@/lib/email';
import { requireStudent } from '@/lib/auth';
import { withApi } from '@/lib/api/handler';

// Phase 2.2: the enrolled user is always the verified caller (user.uid); the
// client no longer supplies userId. courseId remains the target. The existing
// free-only rule (price > 0 → 402) is preserved unchanged.
export const POST = withApi(async (req) => {
  const user = await requireStudent(req);

  const { courseId } = await req.json();
  if (!courseId) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  // جلب بيانات الكورس والمستخدم معاً
  const [course] = await sql`SELECT price, title FROM course WHERE id = ${courseId}`;
  if (!course) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 });
  }
  if (course.price > 0) {
    return NextResponse.json({ error: 'Paid enrollment is not available yet' }, { status: 402 });
  }

  const [profile] = await sql`SELECT full_name, email FROM profiles WHERE firebase_uid = ${user.uid}`;

  // إدراج التسجيل
  await sql`
    INSERT INTO enrollments (user_uid, course_id) VALUES (${user.uid}, ${courseId})
    ON CONFLICT (user_uid, course_id) DO NOTHING
  `;

  // إرسال إيميل التأكيد
  if (profile) {
    await sendEmail(profile.email, 'Enrolled!', courseEnrolledEmail(profile.full_name, course.title));
  }

  return NextResponse.json({ success: true });
});
