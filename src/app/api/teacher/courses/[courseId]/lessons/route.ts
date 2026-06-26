// app/api/teacher/courses/[courseId]/lessons/route.ts
import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { getServerSession } from "@/lib/auth";

export async function POST(
  req: Request,
  { params }: { params: { courseId: string } }
) {
  const session = await getServerSession(req);
  if (!session || session.role !== "teacher") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const courseId = params.courseId;
  const { type, scheduled_at, scenario } = await req.json();

  // التحقق من أن الكورس الحي يخص هذا المعلم
  const [course] = await sql`
    SELECT * FROM live_courses
    WHERE id = ${courseId} AND teacher_id = ${session.uid}
  `;
  if (!course) {
    return NextResponse.json(
      { error: "Course not found or not yours" },
      { status: 404 }
    );
  }

  // التحقق من القواعد الزمنية
  const now = new Date();
  const scheduledDate = new Date(scheduled_at);

  const lessons = await sql`
    SELECT scheduled_at FROM lessons
    WHERE live_course_id = ${courseId}
    ORDER BY scheduled_at ASC
  `;

  if (lessons.length === 0) {
    // أول درس
    if (type !== "zoom") {
      return NextResponse.json(
        { error: "أول درس يجب أن يكون من نوع Zoom" },
        { status: 400 }
      );
    }
    const minDate = new Date(course.created_at);
    minDate.setDate(minDate.getDate() + 7);
    if (scheduledDate < minDate) {
      return NextResponse.json(
        {
          error:
            "يجب أن يكون موعد أول درس بعد 7 أيام من إنشاء الكورس",
        },
        { status: 400 }
      );
    }
  } else {
    const lastLessonDate = new Date(
      lessons[lessons.length - 1].scheduled_at
    );
    const minNextDate = new Date(lastLessonDate);
    minNextDate.setDate(minNextDate.getDate() + 2);
    if (scheduledDate < minNextDate) {
      return NextResponse.json(
        { error: "يجب أن يفصل بين الدروس يومين على الأقل" },
        { status: 400 }
      );
    }
  }

  try {
    await sql`
      INSERT INTO lessons (course_id, live_course_id, type, scheduled_at, scenario)
      VALUES (
        ${courseId},
        ${courseId},
        ${type},
        ${scheduled_at}::timestamptz,
        ${JSON.stringify(scenario || [])}::jsonb
      )
    `;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Database error" },
      { status: 500 }
    );
  }
}