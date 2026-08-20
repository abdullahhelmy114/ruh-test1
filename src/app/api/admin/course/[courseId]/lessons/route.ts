// src/app/api/admin/course/[courseId]/lessons/route.ts
import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { firebaseAdmin } from "@/lib/firebase-admin";

async function verifyAdmin(request: Request): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.split("Bearer ")[1];
  try {
    const decoded = await firebaseAdmin.auth().verifyIdToken(token);
    const sql = neon(process.env.DATABASE_URL!);
    const result = await sql`SELECT firebase_uid, role FROM profiles WHERE firebase_uid = ${decoded.uid} LIMIT 1`;
    if (result.length > 0 && result[0].role === "admin") {
      return result[0].firebase_uid;
    }
    return null;
  } catch {
    return null;
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ courseId: string }> }
) {
  const adminUid = await verifyAdmin(request);
  if (!adminUid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
      { error: error.message || "Failed to fetch lessons" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ courseId: string }> }
) {
  const adminUid = await verifyAdmin(request);
  if (!adminUid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
      { error: error.message || "Failed to create lesson" },
      { status: 500 }
    );
  }
}