// app/api/student/start-exam/route.ts
// بدء امتحان كامل: اختيار أسئلة عشوائية من المخزون وتخزين محاولة

import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { firebaseAdmin } from "@/lib/firebase-admin";

async function getUserIdFromRequest(request: Request): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.split("Bearer ")[1];

  try {
    const decoded = await firebaseAdmin.auth().verifyIdToken(token);
    const sql = neon(process.env.DATABASE_URL!);
    const result = await sql`SELECT id FROM profiles WHERE firebase_uid = ${decoded.uid} LIMIT 1`;
    return result.length > 0 ? result[0].id : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { courseId } = body;

    if (!courseId) {
      return NextResponse.json({ error: "courseId is required" }, { status: 400 });
    }

    const sql = neon(process.env.DATABASE_URL!);

    const courseRes = await sql`SELECT id FROM course WHERE id = ${courseId} LIMIT 1`;
    if (courseRes.length === 0) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const questionsRes = await sql`
      SELECT id, question_type, question_text, options, audio_url, audio_text, difficulty
      FROM generated_questions
      WHERE course_id = ${courseId}
      ORDER BY random()
      LIMIT 50
    `;

    if (questionsRes.length === 0) {
      return NextResponse.json(
        { error: "No exam questions available for this course" },
        { status: 404 }
      );
    }

    const attemptRes = await sql`
      INSERT INTO exam_attempts (user_id, course_id, score, total_questions, passed, points_awarded)
      VALUES (${userId}, ${courseId}, 0, ${questionsRes.length}, false, 0)
      RETURNING id
    `;
    const attemptId = attemptRes[0].id;

    const questions = questionsRes.map((q: any) => ({
      id: q.id,
      question_type: q.question_type,
      question_text: q.question_text,
      options: q.options ? JSON.parse(q.options) : null,
      audio_url: q.audio_url,
      audio_text: q.audio_text,
      difficulty: q.difficulty,
    }));

    return NextResponse.json({
      success: true,
      exam: {
        examId: attemptId,
        questions,
        timeLimitSeconds: null,
      },
    });
  } catch (error: any) {
    console.error("Error starting exam:", error);
    return NextResponse.json(
      { error: error.message || "Failed to start exam" },
      { status: 500 }
    );
  }
}