import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { verifyIdToken } from "@/lib/firebase/server";

export async function GET(req: NextRequest) {
  try {
    const user = await verifyIdToken(req);
    if (!user || user.role !== "teacher") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const applications = await sql.query(
      `SELECT ta.*, mc.title AS course_title, mc.category, mc.level
      FROM teaching_applications ta
      JOIN model_courses mc ON mc.id = ta.model_course_id
      WHERE ta.teacher_id = $1 AND ta.status = 'pending'
      ORDER BY ta.applied_at DESC`,
      [user.uid]
    );

    return NextResponse.json(applications);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}