// app/api/student/course/[courseId]/route.ts
import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { firebaseAdmin } from "@/lib/firebase-admin";

async function getFirebaseUid(request: Request): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.split("Bearer ")[1];

  try {
    const decoded = await firebaseAdmin.auth().verifyIdToken(token);
    return decoded.uid;
  } catch {
    return null;
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ courseId: string }> }
) {
  const firebaseUid = await getFirebaseUid(request);
  if (!firebaseUid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { courseId } = await context.params;

  const sql = neon(process.env.DATABASE_URL!);

  try {
    // جلب دور المستخدم للسماح للأدمن بتجاوز قيد الالتحاق
    const profileRes = await sql`
      SELECT role FROM profiles WHERE firebase_uid = ${firebaseUid} LIMIT 1
    `;
    const isAdmin = profileRes.length > 0 && profileRes[0].role === "admin";

    if (!isAdmin) {
      const enrollment = await sql`
        SELECT 1 FROM enrollments
        WHERE user_uid = ${firebaseUid} AND course_id = ${courseId}
      `;
      if (enrollment.length === 0) {
        return NextResponse.json({ error: "Not enrolled" }, { status: 403 });
      }
    }

    // جلب بيانات الكورس
    const courseRes = await sql`
      SELECT id, title, level, gamification_enabled
      FROM course
      WHERE id = ${courseId}
    `;
    if (courseRes.length === 0) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // جلب الدروس المعتمدة مع ملفاتها
    const lessonsRes = await sql`
      SELECT l.id, l.title, l.type, l.scheduled_at, l.meeting_url, l.recording_url, l.status,
             EXISTS(SELECT 1 FROM lesson_completions lc WHERE lc.lesson_id = l.id AND lc.user_uid = ${firebaseUid}) as completed,
             COALESCE(json_agg(json_build_object('file_name', lf.file_name, 'file_url', lf.file_url, 'file_type', lf.file_type)) FILTER (WHERE lf.id IS NOT NULL), '[]') as files
      FROM lessons l
      LEFT JOIN lesson_files lf ON lf.lesson_id = l.id
      WHERE l.course_id = ${courseId} AND l.status = 'approved'
      GROUP BY l.id
      ORDER BY l.created_at ASC
    `;

    return NextResponse.json({
      course: courseRes[0],
      lessons: lessonsRes,
    });
  } catch (error: any) {
    console.error("Error fetching course:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}