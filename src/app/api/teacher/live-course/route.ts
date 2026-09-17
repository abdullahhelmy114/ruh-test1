import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { requireTeacher } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";

// The signed-in teacher's active live courses with their lesson counts.
// Teacher lifecycle: central guard (active teacher accounts only) instead of
// the legacy verifyIdToken shim and a local role check.
export const GET = withApi(async (req) => {
  const user = await requireTeacher(req);

  const course = await sql.query(
    `SELECT lc.*, mc.title, mc.category, mc.level, mc.base_price,
      (SELECT COUNT(*) FROM lessons WHERE live_course_id = lc.id) AS lessons_count
    FROM live_course lc
    JOIN model_course mc ON mc.id = lc.model_course_id
    WHERE lc.teacher_uid = $1 AND lc.status = 'active'
    ORDER BY lc.created_at DESC`,
    [user.uid]
  );

  return NextResponse.json(course);
});
