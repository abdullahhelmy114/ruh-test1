import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { firebaseAdmin } from "@/lib/firebase-admin";

async function getTeacherFromRequest(
  request: Request
): Promise<{ id: string; firebase_uid: string } | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.split("Bearer ")[1];

  try {
    const decoded = await firebaseAdmin.auth().verifyIdToken(token);
    const sql = neon(process.env.DATABASE_URL!);
    const result = await sql`
      SELECT id, firebase_uid
      FROM profiles
      WHERE firebase_uid = ${decoded.uid}
        AND role = 'teacher'
      LIMIT 1
    `;
    return result.length > 0
      ? {
          id: result[0].id,
          firebase_uid: result[0].firebase_uid,
        }
      : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const teacher = await getTeacherFromRequest(request);

  if (!teacher) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const firebaseUid = teacher.firebase_uid;
  const sql = neon(process.env.DATABASE_URL!);

  try {
    // 1) بيانات المعلم الأساسية
    const profileRes = await sql`
      SELECT full_name
      FROM profiles
      WHERE firebase_uid = ${firebaseUid}
      LIMIT 1
    `;

    if (profileRes.length === 0) {
      return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
    }

    const fullName = profileRes[0].full_name || "";
    const initial = fullName?.charAt(0) || "T";

    // 2) عدد الطلاب
    const studentsRes = await sql`
      SELECT COUNT(DISTINCT e.user_uid)::int AS count
      FROM enrollments e
      JOIN course c ON e.course_id = c.id
      WHERE c.teacher_uid = ${firebaseUid}
    `;
    const students = studentsRes[0]?.count || 0;

    // 3) عدد الدورات النشطة
    const activecourseRes = await sql`
      SELECT COUNT(*)::int AS count
      FROM course
      WHERE teacher_uid = ${firebaseUid}
        AND status = 'published'
    `;
    const activecourse = activecourseRes[0]?.count || 0;

    // 4) الإيرادات
    const revenueRes = await sql`
      SELECT COALESCE(SUM(c.price), 0)::numeric AS revenue
      FROM enrollments e
      JOIN course c ON e.course_id = c.id
      WHERE c.teacher_uid = ${firebaseUid}
    `;
    const revenue = Number(revenueRes[0]?.revenue) || 0;

    // 5) الدورات الخاصة بالمعلم
    const courseRes = await sql`
      SELECT id, title, level, price, status
      FROM course
      WHERE teacher_uid = ${firebaseUid}
      ORDER BY created_at DESC
    `;

    // 6) الجلسات المباشرة القادمة
    const sessionsRes = await sql`
      SELECT l.id, l.title, l.scheduled_at, l.meeting_url, l.course_id, c.title AS course_title
      FROM lessons l
      JOIN course c ON l.course_id = c.id
      WHERE l.teacher_uid = ${firebaseUid}
        AND l.type = 'zoom'
        AND l.status = 'approved'
        AND l.scheduled_at IS NOT NULL
        AND l.scheduled_at > now()
      ORDER BY l.scheduled_at ASC
    `;

    return NextResponse.json({
      fullName,
      initial,
      students,
      activecourse,
      revenue,
      course: courseRes,
      sessions: sessionsRes,
      certificationProgress: 0,
    });
  } catch (error: any) {
    console.error("Error fetching teacher dashboard:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch dashboard" },
      { status: 500 }
    );
  }
}