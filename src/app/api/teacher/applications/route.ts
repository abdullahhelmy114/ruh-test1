import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { requireTeacher } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";

// The signed-in teacher's pending applications to teach model courses.
// Teacher lifecycle: the route verified the token through the legacy shim and
// compared the role itself; it now uses the central guard, which admits only
// active teacher accounts. Errors are handled by withApi (no details leak).
export const GET = withApi(async (req) => {
  const user = await requireTeacher(req);

  const applications = await sql.query(
    `SELECT ta.*, mc.title AS course_title, mc.category, mc.level
    FROM teaching_applications ta
    JOIN model_course mc ON mc.id = ta.model_course_id
    WHERE ta.teacher_uid = $1 AND ta.status = 'pending'
    ORDER BY ta.applied_at DESC`,
    [user.uid]
  );

  return NextResponse.json(applications);
});
