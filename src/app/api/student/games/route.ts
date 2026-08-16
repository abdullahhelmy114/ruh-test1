// app/api/student/games/route.ts
// جلب الألعاب المولّدة المتاحة لمقرر معين للطالب

import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { firebaseAdmin } from "@/lib/firebase-admin";

async function getFirebaseUid(request: Request): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.split("Bearer ")[1];
  try {
    const decoded = await firebaseAdmin.auth().verifyIdToken(token);
    return decoded.uid;
  } catch {
    return null;
  }
}

/**
 * تحويل قيمة من قاعدة البيانات إلى JSON بأمان
 */
function safeJsonParse(value: any): any {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") return value; // Postgres JSONB قد يعيد كائنًا
  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export async function GET(request: Request) {
  const uid = await getFirebaseUid(request);
  if (!uid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get("courseId");
  const difficulty = searchParams.get("difficulty");

  if (!courseId) {
    return NextResponse.json({ error: "courseId is required" }, { status: 400 });
  }

  const sql = neon(process.env.DATABASE_URL!);

  try {
    // (اختياري) التحقق من الالتحاق بالكورس
    const enrollment = await sql`
      SELECT 1 FROM enrollments
      WHERE user_uid = ${uid} AND course_id = ${courseId}
      LIMIT 1
    `;
    // نسمح بالوصول مؤقتًا حتى لو لم يكن مسجلاً (للتجربة)
    // إذا أردت التقييد، أزل التعليق عن السطر التالي
    // if (enrollment.length === 0) {
    //   return NextResponse.json({ error: "Not enrolled" }, { status: 403 });
    // }

    let query;
    if (difficulty) {
      query = sql`
        SELECT id, game_type, game_data, difficulty, created_at
        FROM generated_games
        WHERE course_id = ${courseId} AND difficulty = ${difficulty}
      `;
    } else {
      query = sql`
        SELECT id, game_type, game_data, difficulty, created_at
        FROM generated_games
        WHERE course_id = ${courseId}
      `;
    }

    const games = await query;

    return NextResponse.json({
      games: games.map((g: any) => ({
        id: g.id,
        game_type: g.game_type,
        game_data: safeJsonParse(g.game_data),
        difficulty: g.difficulty,
        created_at: g.created_at,
      })),
    });
  } catch (error: any) {
    console.error("Error fetching games:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch games" },
      { status: 500 }
    );
  }
}