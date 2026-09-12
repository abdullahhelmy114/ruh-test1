import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { requireStudent, requireEnrolled } from '@/lib/auth';
import { withApi } from '@/lib/api/handler';
import { publishAchievement } from '@/lib/community';

// Phase 2.4a: the previous guard read a `session` cookie the app never sets
// and a custom claim that is never issued, so this route always returned 403.
// It now uses the central auth layer, requires enrollment in the course, and
// derives eligibility strictly from server rows (lesson_completions vs
// course.lesson_count) exactly as before. Name and gender come from the
// caller's profile; if no gender is recorded the achievement post is skipped
// (the community is gender-scoped and no default is defined).
// REVIEW (Phase 4): eligibility ignores exams/certificates by design of the
// existing model; any stronger rule needs a product decision.
export const POST = withApi(async (req) => {
  const user = await requireStudent(req);

  const { courseId } = await req.json();
  if (!courseId) {
    return NextResponse.json({ error: 'معرّف الكورس مطلوب' }, { status: 400 });
  }

  await requireEnrolled(user, courseId);

  try {
    // 1. جلب عدد دروس الكورس
    const course = await sql`
      SELECT id, title, lesson_count
      FROM course
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

    // 5. نشر الإنجاز تلقائياً في المجتمع (إن كان الجنس مسجلاً)
    const [profile] = await sql`SELECT full_name, gender FROM profiles WHERE firebase_uid = ${user.uid} LIMIT 1`;
    const userName = profile?.full_name || 'طالب';
    const courseName = course[0].title;
    if (profile?.gender === 'male' || profile?.gender === 'female') {
      await publishAchievement(
        user.uid,
        profile.gender,
        `أكمل ${userName} دورة ${courseName}`
      );
    }

    return NextResponse.json({
      completed: true,
      message: `مبروك! أكملت دورة ${courseName}`,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
});
