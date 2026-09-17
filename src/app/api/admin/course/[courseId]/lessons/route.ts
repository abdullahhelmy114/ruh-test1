// src/app/api/admin/course/[courseId]/lessons/route.ts
import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";


export const GET = withApi<{ courseId: string }>(async (request, context) => {
  const adminUid = (await requireAdmin(request)).uid;

  const { courseId } = await context.params;
  const sql = neon(process.env.DATABASE_URL!);

  try {
    const lessons = await sql`
      SELECT id, title, type, status, created_at, content
      FROM lessons
      WHERE course_id = ${courseId}
      ORDER BY created_at ASC
    `;

    return NextResponse.json({ lessons });
  } catch (error: any) {
    console.error("Error fetching lessons:", error);
    return NextResponse.json(
      { error: "Failed to fetch lessons" },
      { status: 500 }
    );
  }
});

export const POST = withApi<{ courseId: string }>(async (request, context) => {
  const adminUid = (await requireAdmin(request)).uid;

  const { courseId } = await context.params;

  try {
    const body = await request.json();
    const { title, content } = body;

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const sql = neon(process.env.DATABASE_URL!);

    const result = await sql`
      INSERT INTO lessons (course_id, teacher_uid, title, status, content, created_at)
      VALUES (${courseId}, ${adminUid}, ${title}, 'approved', ${content || null}, now())
      RETURNING id, title, content, created_at
    `;

    return NextResponse.json({ lesson: result[0] });
  } catch (error: any) {
    console.error("Error creating lesson:", error);
    return NextResponse.json(
      { error: "Failed to create lesson" },
      { status: 500 }
    );
  }
});