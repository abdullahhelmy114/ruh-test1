// src/app/api/admin/course/[courseId]/lessons/[lessonId]/route.ts
import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { firebaseAdmin } from "@/lib/firebase-admin";

async function verifyAdmin(request: Request): Promise<boolean> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.split("Bearer ")[1];
  try {
    const decoded = await firebaseAdmin.auth().verifyIdToken(token);
    const sql = neon(process.env.DATABASE_URL!);
    const result = await sql`SELECT role FROM profiles WHERE firebase_uid = ${decoded.uid} LIMIT 1`;
    return result.length > 0 && result[0].role === "admin";
  } catch {
    return false;
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ courseId: string; lessonId: string }> }
) {
  if (!(await verifyAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
      { error: error.message || "Failed to update lesson" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ courseId: string; lessonId: string }> }
) {
  if (!(await verifyAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
      { error: error.message || "Failed to delete lesson" },
      { status: 500 }
    );
  }
}