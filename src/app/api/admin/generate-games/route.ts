// app/api/admin/generate-games/route.ts
// توليد ألعاب تعليمية من النصوص وحفظها في قاعدة البيانات (اختياري)

import { NextResponse } from "next/server";
import { generateGamesFromText, type GameType } from "@/lib/ai/generate-games";
import { neon } from "@neondatabase/serverless";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { checkRateLimit, retryAfterSeconds } from "@/lib/security/rate-limit";
import {
  boundedPositiveInt,
  boundedString,
  isAllowedStringArray,
  optionalBoundedString,
} from "@/lib/security/input-policy";

// Phase 3 batch 5 — admin cost hardening, mirroring generate-questions:
// 10 requests / 10 min per admin uid, sourceText <= 80,000 chars, gameTypes
// 1..8 distinct supported types, countPerType 1..20, all checked BEFORE the
// chunked provider fan-out; generic errors. Gameplay/prompt semantics and
// model choice are unchanged.
const ADMIN_LIMIT = { limit: 10, windowMs: 10 * 60 * 1000 };
const SOURCE_MAX = 80_000;
const TYPES_MAX = 8;
const COUNT_MAX = 20;
const GAME_TYPES: ReadonlySet<string> = new Set<GameType>([
  "word_order", "speed_choice", "matching", "letter_connect", "time_race", "coloring",
]);

export const POST = withApi(async (request) => {
  const admin = await requireAdmin(request);

  const check = checkRateLimit(`generate-games:${admin.uid}`, ADMIN_LIMIT);
  if (!check.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds(check)) } }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const {
    sourceText: rawSource,
    gameTypes,
    countPerType: rawCount,
    difficulty: rawDifficulty,
    courseId: rawCourseId,
    save = false,
  } = body as Record<string, unknown>;

  if (typeof rawSource !== "string" || !rawSource.trim() || !gameTypes || rawCount === undefined) {
    return NextResponse.json(
      { error: "Missing required fields: sourceText, gameTypes, countPerType" },
      { status: 400 }
    );
  }
  const sourceText = boundedString(rawSource, { max: SOURCE_MAX });
  if (!sourceText) return NextResponse.json({ error: "sourceText too long" }, { status: 413 });
  if (!isAllowedStringArray(gameTypes, GAME_TYPES, TYPES_MAX)) {
    return NextResponse.json(
      { error: "gameTypes must be 1-8 distinct supported types" },
      { status: 400 }
    );
  }
  const countPerType = boundedPositiveInt(rawCount, 1, COUNT_MAX);
  if (countPerType === null) {
    return NextResponse.json({ error: "countPerType must be an integer between 1 and 20" }, { status: 400 });
  }
  const difficulty = optionalBoundedString(rawDifficulty, 50);
  const courseId = optionalBoundedString(rawCourseId, 100);
  if (difficulty === null || courseId === null) {
    return NextResponse.json({ error: "Invalid difficulty or courseId" }, { status: 400 });
  }

  try {
    const games = await generateGamesFromText({
      sourceText,
      gameTypes: gameTypes as GameType[],
      countPerType,
      difficulty: difficulty || undefined,
    });

    let savedIds: string[] = [];

    if (save === true && courseId) {
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
  } catch (error) {
    console.error("generate-games failed:", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ error: "Failed to generate games" }, { status: 502 });
  }
});
