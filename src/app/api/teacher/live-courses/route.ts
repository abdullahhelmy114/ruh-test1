import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { verifyIdToken } from "@/lib/firebase/server";

export async function GET(req: NextRequest) {
  try {
    const user = await verifyIdToken(req);
    if (!user || user.role !== "teacher") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const courses = await sql.query(
      `SELECT lc.*, mc.title, mc.category, mc.level, mc.base_price,
        (SELECT COUNT(*) FROM lessons WHERE live_course_id = lc.id) AS lessons_count
      FROM live_courses lc
      JOIN model_courses mc ON mc.id = lc.model_course_id
      WHERE lc.teacher_id = $1 AND lc.status = 'active'
      ORDER BY lc.created_at DESC`,
      [user.uid]
    );

    return NextResponse.json(courses);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}