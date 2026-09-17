// src/app/api/admin/course/[courseId]/lessons/[lessonId]/route.ts
import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";


export const PUT = withApi<{ courseId: string; lessonId: string }>(async (request, context) => {
  await requireAdmin(request);

  const { courseId, lessonId } = await context.params;

  try {
    const body = await request.json();
    const { title, content } = body;

    const sql = neon(process.env.DATABASE_URL!);
    await sql`
      UPDATE lessons
      SET title = ${title}, content = ${content || null}
      WHERE id = ${lessonId} AND course_id = ${courseId}
    `;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error updating lesson:", error);
    return NextResponse.json(
      { error: "Failed to update lesson" },
      { status: 500 }
    );
  }
});

export const DELETE = withApi<{ courseId: string; lessonId: string }>(async (request, context) => {
  await requireAdmin(request);

  const { courseId, lessonId } = await context.params;

  try {
    const sql = neon(process.env.DATABASE_URL!);
    await sql`
      DELETE FROM lessons
      WHERE id = ${lessonId} AND course_id = ${courseId}
    `;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting lesson:", error);
    return NextResponse.json(
      { error: "Failed to delete lesson" },
      { status: 500 }
    );
  }
});