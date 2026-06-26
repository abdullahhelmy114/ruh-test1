import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db/client";
import { verifyIdToken } from "@/lib/firebase/server";

const createLessonSchema = z.object({
  live_course_id: z.string().uuid(),
  type: z.enum(["zoom", "recorded"]),
  scheduled_at: z.string().datetime(),
  scenario: z.string().optional(),
  teacher_notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await verifyIdToken(req);
    if (!user || user.role !== "teacher") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const data = createLessonSchema.parse(body);
    const { live_course_id, type, scheduled_at, scenario, teacher_notes } = data;

    // التحقق من ملكية الكورس الحي
    const courseRows = await sql.query(
      `SELECT created_at, scenario FROM live_courses WHERE id = $1 AND teacher_id = $2`,
      [live_course_id, user.uid]
    );
    if (courseRows.length === 0) {
      return NextResponse.json({ error: "Live course not found or not yours" }, { status: 404 });
    }

    const liveCreatedAt = new Date(courseRows[0].created_at);
    const scheduled = new Date(scheduled_at);

    // جلب الدروس الموجودة
    const existingLessons = await sql.query(
      `SELECT id, type, scheduled_at FROM lessons WHERE live_course_id = $1 ORDER BY scheduled_at ASC`,
      [live_course_id]
    );

    const isFirstLesson = existingLessons.length === 0;
    const lastLesson = existingLessons.length > 0
      ? existingLessons[existingLessons.length - 1]
      : null;

    // القواعد
    if (isFirstLesson) {
      if (type !== "zoom") {
        return NextResponse.json(
          { error: "First lesson must be a Zoom session" },
          { status: 400 }
        );
      }
      const minDate = new Date(liveCreatedAt.getTime() + 7 * 24 * 60 * 60 * 1000);
      if (scheduled < minDate) {
        return NextResponse.json(
          {
            error: `First lesson must be scheduled at least 7 days after course creation (after ${minDate.toISOString().slice(0, 16)})`,
          },
          { status: 400 }
        );
      }
    } else {
      let previousDate: Date;
      if (existingLessons.length === 1) {
        previousDate = liveCreatedAt;
      } else {
        previousDate = new Date(lastLesson!.scheduled_at);
      }

      const minGap = 2 * 24 * 60 * 60 * 1000;
      if (scheduled.getTime() - previousDate.getTime() < minGap) {
        const allowed = new Date(previousDate.getTime() + minGap);
        return NextResponse.json(
          {
            error: `There must be at least 2 days gap from the previous lesson or course creation. Next allowed date: ${allowed.toISOString().slice(0, 16)}`,
          },
          { status: 400 }
        );
      }
    }

    const finalScenario = scenario || courseRows[0].scenario || "";

    const inserted = await sql.query(
      `INSERT INTO lessons (live_course_id, type, scheduled_at, scenario, teacher_notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [live_course_id, type, scheduled_at, finalScenario, teacher_notes || ""]
    );

    return NextResponse.json({ id: inserted[0].id }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 422 });
    }
    console.error(error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}