// app/api/admin/generate-games/route.ts
// توليد ألعاب تعليمية من النصوص وحفظها في قاعدة البيانات (اختياري)

import { NextResponse } from "next/server";
import { generateGamesFromText } from "@/lib/ai/generate-games";
import { neon } from "@neondatabase/serverless";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";

export const POST = withApi(async (request) => {
  await requireAdmin(request);

  try {
    const body = await request.json();
    const {
      sourceText,
      gameTypes,
      countPerType,
      difficulty,
      courseId,
      save = false,
    } = body;

    if (!sourceText || !gameTypes || !countPerType) {
      return NextResponse.json(
        { error: "Missing required fields: sourceText, gameTypes, countPerType" },
        { status: 400 }
      );
    }

    if (!Array.isArray(gameTypes) || gameTypes.length === 0) {
      return NextResponse.json(
        { error: "gameTypes must be a non-empty array" },
        { status: 400 }
      );
    }

    if (countPerType <= 0) {
      return NextResponse.json(
        { error: "countPerType must be positive" },
        { status: 400 }
      );
    }

    const games = await generateGamesFromText({
      sourceText,
      gameTypes,
      countPerType,
      difficulty,
    });

    let savedIds: string[] = [];

    if (save && courseId) {
      const sql = neon(process.env.DATABASE_URL!);
      for (const game of games) {
        const result = await sql`
          INSERT INTO generated_games (
            course_id,
            game_type,
            game_data,
            difficulty
          )
          VALUES (
            ${courseId},
            ${game.game_type},
            ${JSON.stringify(game.game_data)}::jsonb,
            ${game.difficulty || null}
          )
          RETURNING id
        `;
        if (result.length > 0) {
          savedIds.push(result[0].id);
        }
      }
    }

    return NextResponse.json({ success: true, games, savedIds });
  } catch (error: any) {
    console.error("Error generating games:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate games" },
      { status: 500 }
    );
  }
});