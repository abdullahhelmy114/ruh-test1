// app/api/student/games/route.ts
// جلب الألعاب المولّدة المتاحة لمقرر معين للطالب

import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { requireStudent, requireEnrolled } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { safeJsonParse } from "@/lib/exam/grading";

// Phase 2.4a: the enrollment check that was executed and then ignored is now
// enforced through the central requireEnrolled helper (admin bypass).
// Query and response shape unchanged.
export const GET = withApi(async (request) => {
  const user = await requireStudent(request);

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get("courseId");
  const difficulty = searchParams.get("difficulty");

  if (!courseId) {
    return NextResponse.json({ error: "courseId is required" }, { status: 400 });
  }

  await requireEnrolled(user, courseId);

  const sql = neon(process.env.DATABASE_URL!);

  try {
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
  } catch (error) {
    console.error("Error fetching games:", error);
    return NextResponse.json({ error: "Failed to fetch games" }, { status: 500 });
  }
});
