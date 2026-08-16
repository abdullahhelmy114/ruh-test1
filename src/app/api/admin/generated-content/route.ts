// app/api/admin/generated-content/route.ts
// جلب الأسئلة والألعاب المولّدة لمقرر محدد (للأدمين)

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

/**
 * تحويل قيمة من قاعدة البيانات إلى JSON بأمان
 * إذا كانت القيمة نصًا وليست JSON صالحًا، نعيدها كما هي
 */
function safeJsonParse(value: any): any {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") return value; // Postgres JSONB قد يعيد كائنًا
  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value);
  } catch {
    return value; // ليست JSON صالحة، نعيد النص كما هو
  }
}

export async function GET(request: Request) {
  if (!(await verifyAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get("courseId");

  if (!courseId) {
    return NextResponse.json({ error: "courseId is required" }, { status: 400 });
  }

  const sql = neon(process.env.DATABASE_URL!);
  try {
    const questions = await sql`
      SELECT id, question_type, question_text, options, correct_answer, audio_text, difficulty, created_at
      FROM generated_questions
      WHERE course_id = ${courseId}
      ORDER BY created_at DESC
    `;

    const games = await sql`
      SELECT id, game_type, game_data, difficulty, created_at
      FROM generated_games
      WHERE course_id = ${courseId}
      ORDER BY created_at DESC
    `;

    return NextResponse.json({
      questions: questions.map((q: any) => ({
        ...q,
        options: safeJsonParse(q.options),
        correct_answer: safeJsonParse(q.correct_answer),
      })),
      games: games.map((g: any) => ({
        ...g,
        game_data: safeJsonParse(g.game_data),
      })),
    });
  } catch (error: any) {
    console.error("Error fetching generated content:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch content" },
      { status: 500 }
    );
  }
}