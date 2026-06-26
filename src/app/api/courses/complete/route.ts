import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { cookies } from 'next/headers';
import { getAuth } from 'firebase-admin/auth';
import { publishAchievement } from '@/lib/community';

async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('session')?.value;
  if (!token) return null;
  try {
    return await getAuth().verifyIdToken(token);
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'student') {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }

  const { courseId } = await req.json();
  if (!courseId) {
    return NextResponse.json({ error: 'معرّف الكورس مطلوب' }, { status: 400 });
  }

  try {
    // 1. جلب عدد دروس الكورس
    const course = await sql`
      SELECT id, title, lesson_count
      FROM courses
      WHERE id = ${courseId} AND status = 'published'
    `;
    if (course.length === 0) {
      return NextResponse.json({ error: 'الكورس غير موجود أو غير منشور' }, { status: 404 });
    }

    // 2. عدد الدروس التي أكملها الطالب في هذا الكورس
    const completed = await sql`
      SELECT COUNT(*)::int AS completed_count
      FROM lesson_completions lc
      JOIN lessons l ON lc.lesson_id = l.id
      WHERE l.course_id = ${courseId} AND lc.user_uid = ${user.uid}
    `;

    const completedCount = completed[0].completed_count;

    // 3. التحقق من إكمال جميع الدروس
    if (completedCount < course[0].lesson_count) {
      return NextResponse.json({
        completed: false,
        message: `أكملت ${completedCount} من ${course[0].lesson_count} درساً`,
      });
    }

    // 4. تسجيل إكمال الكورس في جدول مخصص إن وجد (اختياري)
    await sql`
      INSERT INTO course_completions (course_id, user_uid)
      VALUES (${courseId}, ${user.uid})
      ON CONFLICT DO NOTHING
    `;

    // 5. نشر الإنجاز تلقائياً في المجتمع
    const userName = user.name || 'طالب';
    const courseName = course[0].title;
    await publishAchievement(
      user.uid,
      user.gender,
      `أكمل ${userName} دورة ${courseName}`
    );

    return NextResponse.json({
      completed: true,
      message: `مبروك! أكملت دورة ${courseName}`,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}