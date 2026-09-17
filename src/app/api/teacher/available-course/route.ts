import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { requireTeacher } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";

// Approved model courses with the signed-in teacher's status on each (pending
// application, or an active live course).
// Teacher lifecycle: central guard (active teacher accounts only) instead of
// getServerSession and a local role check. live_course.teacher_uid holds the
// Firebase uid (profiles.firebase_uid, as written by the approval route); the
// former comparison with profiles.id never matched, so an approved course was
// never shown as active.
export const GET = withApi(async (req) => {
  const session = await requireTeacher(req);
  const teacherUid = session.uid;

  const course = await sql`
    SELECT
      mc.id,
      mc.title,
      mc.description,
      mc.level,
      mc.price,
      mc.category,
      mc.scenario,
      CASE
        WHEN ta.status = 'pending' THEN 'pending'
        WHEN lc.id IS NOT NULL THEN 'active'
        ELSE NULL
      END AS teacher_status
    FROM model_course mc
    LEFT JOIN teaching_applications ta
      ON ta.model_course_id = mc.id AND ta.teacher_uid = ${teacherUid}
    LEFT JOIN live_course lc
      ON lc.model_course_id = mc.id
      AND lc.teacher_uid = ${teacherUid}
    WHERE mc.status = 'approved'
    ORDER BY mc.created_at DESC
  `;

  return NextResponse.json(course);
});
