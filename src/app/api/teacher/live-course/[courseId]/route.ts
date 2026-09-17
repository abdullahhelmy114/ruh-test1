import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { requireTeacher } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";

// Launch closure: the handler read a synchronous `params.id`, but the segment
// is [courseId] and Next 16 params are a Promise, so it could never match a
// course. It now awaits the real segment and uses the central teacher guard.
// The ownership comparison (teacher_uid = firebase uid) is unchanged.
export const GET = withApi<{ courseId: string }>(async (req, ctx) => {
  const user = await requireTeacher(req);
  const params = await ctx.params;
  const courseId = params.courseId;

  const courseRows = await sql.query(
    `SELECT lc.*, mc.title, mc.category, mc.level, mc.base_price, mc.scenario AS model_scenario
    FROM live_course lc
    JOIN model_course mc ON mc.id = lc.model_course_id
    WHERE lc.id = $1 AND lc.teacher_uid = $2`,
    [courseId, user.uid]
  );

  if (!courseRows || courseRows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const lessons = await sql.query(
    `SELECT id, type, scheduled_at, scenario, teacher_notes, status
    FROM lessons
    WHERE live_course_id = $1
    ORDER BY scheduled_at ASC`,
    [courseId]
  );

  return NextResponse.json({
    ...courseRows[0],
    lessons: lessons || [],
  });
});
