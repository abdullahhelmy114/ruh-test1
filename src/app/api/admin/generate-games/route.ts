// app/api/admin/generate-games/route.ts
// توليد ألعاب تعليمية من النصوص وحفظها في قاعدة البيانات (اختياري)

import { NextResponse } from "next/server";
import { generateGamesFromText } from "@/lib/ai/generate-games";
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

export async function POST(request: Request) {
  const isAdmin = await verifyAdmin(request);
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
}