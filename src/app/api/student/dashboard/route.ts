// src/app/api/student/dashboard/route.ts
import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { requireAuth } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";

// Phase 2.4a: caller identity from the central auth layer; every query below
// is keyed on the caller's own profileId / uid. Queries unchanged.
export const GET = withApi(async (request) => {
  const user = await requireAuth(request);

  const userId = user.profileId;
  const firebaseUid = user.uid;
  const sql = neon(process.env.DATABASE_URL!);

  try {
    // 1) الأساسيات: الاسم، الإحالات، الرصيد، السلسلة
    const profileRes = await sql`
      SELECT
        p.full_name,
        p.referral_code,
        -- Accounts created with this student's invitation (no rewards: see lib/referral.ts).
        (SELECT count(*) FROM profiles r WHERE r.referred_by::text = p.id::text AND r.firebase_uid <> p.firebase_uid)::int AS referral_joined,
        COALESCE(up.balance, 0)::int AS xp,
        COALESCE(s.current_streak, 0)::int AS streak
      FROM profiles p
      LEFT JOIN user_points up ON up.user_id = p.id
      LEFT JOIN streaks s ON s.user_id = p.id
      WHERE p.id = ${userId}
      LIMIT 1
    `;

    if (profileRes.length === 0) {
      return NextResponse.json({
        firstName: "",
        xp: 0,
        level: 1,
        streak: 0,
        inProgress: [],
        completed: [],
        sessions: [],
        referral: { code: "", link: "", count: 0 },
      });
    }

    const profile = profileRes[0];
    const xp = profile.xp;
    const level = Math.floor(xp / 1000) + 1;

    // 2) الكورسات قيد التقدم
    const enrollRes = await sql`
      SELECT
        e.course_id,
        c.title AS course_title
      FROM enrollments e
      JOIN course c ON c.id = e.course_id
      WHERE e.user_uid = ${firebaseUid}
        AND e.completed = false
    `;

    const inProgress = [];

    for (const enroll of enrollRes) {
      const courseId = enroll.course_id;

      const lessonStats = await sql`
        SELECT
          COUNT(*)::int AS total_lessons,
          COUNT(*) FILTER (WHERE lc.id IS NOT NULL)::int AS completed_lessons
        FROM lessons l
        LEFT JOIN lesson_completions lc
          ON lc.lesson_id = l.id AND lc.user_uid = ${firebaseUid}
        WHERE l.course_id = ${courseId}
      `;

      const total = lessonStats[0]?.total_lessons || 0;
      const completedCount = lessonStats[0]?.completed_lessons || 0;
      const progress = total > 0 ? Math.round((completedCount / total) * 100) : 0;

      const nextLessonRes = await sql`
        SELECT l.title
        FROM lessons l
        LEFT JOIN lesson_completions lc
          ON lc.lesson_id = l.id AND lc.user_uid = ${firebaseUid}
        WHERE l.course_id = ${courseId}
          AND lc.id IS NULL
        ORDER BY l.order_index ASC, l.created_at ASC
        LIMIT 1
      `;
      const nextTitle = nextLessonRes[0]?.title || "";

      inProgress.push({
        courseId,
        title: enroll.course_title,
        next: nextTitle,
        progress,
      });
    }

    // 3) الكورسات المكتملة
    const completedRes = await sql`
      SELECT
        c.title,
        cc.completed_at,
        c.recording_url
      FROM course_completions cc
      JOIN course c ON c.id = cc.course_id
      WHERE cc.user_uid = ${firebaseUid}
      ORDER BY cc.completed_at DESC
    `;

    const completed = completedRes.map((c: any) => ({
      title: c.title,
      date: c.completed_at ? new Date(c.completed_at).toISOString() : "",
      recording_url: c.recording_url || null,
    }));

    // 4) الجلسات القادمة
    const liveSessionsRes = await sql`
      SELECT
        ll.id,
        ll.title,
        ll.scheduled_at,
        lc.title AS course_title,
        p.full_name AS teacher_name
      FROM live_lessons ll
      JOIN live_course lc ON lc.id = ll.live_course_id
      LEFT JOIN profiles p ON p.firebase_uid = lc.teacher_uid
      WHERE lc.model_course_id IN (
        SELECT c.model_course_id
        FROM enrollments e
        JOIN course c ON c.id = e.course_id
        WHERE e.user_uid = ${firebaseUid}
          AND c.model_course_id IS NOT NULL
      )
      AND ll.scheduled_at > now()
      ORDER BY ll.scheduled_at ASC
      LIMIT 10
    `;

    const sessions = liveSessionsRes.map((s: any) => ({
      id: s.id,
      title: s.title,
      scheduled_at: s.scheduled_at ? new Date(s.scheduled_at).toISOString() : "",
      course_title: s.course_title,
      teacher_name: s.teacher_name || "",
    }));

    // 5) الإحالة
    const referralCode = profile.referral_code || "";
    const referralLink = referralCode
      ? `https://ruhulqudus.com/r/${referralCode}`
      : "";
    const referral = {
      code: referralCode,
      link: referralLink,
      count: Number(profile.referral_joined) || 0,
    };

    return NextResponse.json({
      firstName: profile.full_name || "",
      xp,
      level,
      streak: profile.streak,
      inProgress,
      completed,
      sessions,
      referral,
    });
  } catch (error) {
    console.error("Error fetching student dashboard:", error);
    return NextResponse.json({ error: "Failed to fetch dashboard" }, { status: 500 });
  }
});