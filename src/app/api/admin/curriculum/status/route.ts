// src/app/api/admin/curriculum/status/route.ts
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

export async function GET(request: Request) {
  if (!(await verifyAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get("taskId");

  if (!taskId) {
    return NextResponse.json({ error: "taskId is required" }, { status: 400 });
  }

  const sql = neon(process.env.DATABASE_URL!);

  try {
    const result = await sql`
      SELECT id, status, total_lessons, completed_lessons, error_message, updated_at
      FROM curriculum_tasks
      WHERE id = ${taskId}
      LIMIT 1
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const task = result[0];
    const progress =
      task.total_lessons > 0
        ? Math.round((task.completed_lessons / task.total_lessons) * 100)
        : 0;

    return NextResponse.json({
      id: task.id,
      status: task.status,
      total_lessons: task.total_lessons,
      completed_lessons: task.completed_lessons,
      progress,
      error_message: task.error_message,
      updated_at: task.updated_at,
    });
  } catch (error: any) {
    console.error("Error fetching curriculum task status:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch status" },
      { status: 500 }
    );
  }
}