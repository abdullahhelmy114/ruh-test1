import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { verifyIdToken } from "@/lib/firebase/server";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await verifyIdToken(req);
    if (!user || user.role !== "teacher") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const courseId = params.id;

    const courseRows = await sql.query(
      `SELECT lc.*, mc.title, mc.category, mc.level, mc.base_price, mc.scenario AS model_scenario
      FROM live_courses lc
      JOIN model_courses mc ON mc.id = lc.model_course_id
      WHERE lc.id = $1 AND lc.teacher_id = $2`,
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
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}