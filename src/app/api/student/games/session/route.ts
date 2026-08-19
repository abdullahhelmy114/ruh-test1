// src/app/api/student/games/session/route.ts
// جلب جلسة لعبة عشوائية من جدول generated_games مباشرة
// مع تحويل معرّفات الألعاب من الواجهة إلى game_type في قاعدة البيانات

import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { firebaseAdmin } from "@/lib/firebase-admin";

type GameId = "word-order" | "speed-choice" | "matching" | "letter-connect" | "time-race";

// أنواع الأسئلة المرتبطة بكل لعبة (تُستخدم كخيار احتياطي فقط)
const GAME_QUESTION_TYPE: Record<GameId, string[]> = {
  "word-order": ["word_order"],
  "speed-choice": ["choice"],
  "matching": ["matching"],
  "letter-connect": ["fill_blank", "word_order"],
  "time-race": ["choice"],
};

// تحويل معرّف اللعبة في الواجهة (بشرطة) إلى game_type المخزن في قاعدة البيانات (بشرطة سفلية)
const DB_GAME_TYPE: Record<GameId, string> = {
  "word-order": "word_order",
  "speed-choice": "speed_choice",
  "matching": "matching",
  "letter-connect": "letter_connect",
  "time-race": "time_race",
};

function safeJsonParse(value: any): any {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

/**
 * تحويل بيانات لعبة مخزنة في generated_games إلى صيغة الأسئلة الموحدة للجلسة
 */
function convertGameToSessionQuestion(game: any) {
  const data = safeJsonParse(game.game_data);

  // ألعاب speed_choice و time_race => اختيار
  if (game.game_type === "speed_choice" || game.game_type === "time_race") {
    return {
      kind: "choice",
      prompt: data.question || "اختر الإجابة الصحيحة",
      options: data.options || [],
      answer: data.options?.[data.correct_index] ?? null,
      explanation: data.explanation || "الإجابة الصحيحة معروضة.",
    };
  }

  // ألعاب word_order
  if (game.game_type === "word_order") {
    return {
      kind: "sequence",
      prompt: "رتب الكلمات لتكوين جملة صحيحة",
      tokens: data.words || [],
      answer: data.correct_order
        ? data.correct_order.map((idx: number) => data.words?.[idx])
        : data.sentence?.split(" "),
      explanation: data.sentence || "الترتيب الصحيح للجملة.",
    };
  }

  // ألعاب letter_connect
  if (game.game_type === "letter_connect") {
    return {
      kind: "sequence",
      prompt: `كوّن الكلمة: ${data.word || ""}`,
      tokens: data.letters || [],
      answer: data.correct_order
        ? data.correct_order.map((idx: number) => data.letters?.[idx])
        : data.word?.split(""),
      explanation: `الكلمة الصحيحة: ${data.word || ""}`,
    };
  }

  // ألعاب matching
  if (game.game_type === "matching") {
    return {
      kind: "pairs",
      prompt: "طابق كل كلمة مع معناها",
      pairs: data.pairs || [],
      answer: data.correct_mapping || data.pairs,
      explanation: "طابق الأزواج بشكل صحيح.",
    };
  }

  // افتراضي: choice
  return {
    kind: "choice",
    prompt: data.question || "سؤال",
    options: data.options || [],
    answer: data.options?.[data.correct_index] ?? null,
    explanation: data.explanation || "",
  };
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const token = authHeader.split("Bearer ")[1];
  try {
    const decoded = await firebaseAdmin.auth().verifyIdToken(token);
    const sql = neon(process.env.DATABASE_URL!);
    const profile = await sql`SELECT id FROM profiles WHERE firebase_uid = ${decoded.uid} LIMIT 1`;
    if (profile.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const { gameId, courseId, count = 10 } = body;

    if (!gameId || !courseId) {
      return NextResponse.json({ error: "gameId and courseId are required" }, { status: 400 });
    }

    // تحويل معرّف اللعبة إلى game_type الصحيح في قاعدة البيانات
    const dbGameType = DB_GAME_TYPE[gameId as GameId];
    if (!dbGameType) {
      return NextResponse.json({ error: "Invalid game type" }, { status: 400 });
    }

    // 1) جلب ألعاب عشوائية من generated_games
    const games = await sql`
      SELECT id, game_type, game_data, difficulty
      FROM generated_games
      WHERE course_id = ${courseId}
        AND game_type = ${dbGameType}
      ORDER BY random()
      LIMIT ${count}
    `;

    if (games.length > 0) {
      const sessionQuestions = games.map((g: any) => convertGameToSessionQuestion(g));
      return NextResponse.json({ questions: sessionQuestions });
    }

    // 2) fallback: جلب أسئلة من generated_questions بنفس النوع
    const questionTypes = GAME_QUESTION_TYPE[gameId as GameId];
    if (!questionTypes) {
      return NextResponse.json({ error: "Invalid game type" }, { status: 400 });
    }

    const questions = await sql`
      SELECT id, question_text, options, correct_answer, difficulty
      FROM generated_questions
      WHERE course_id = ${courseId}
        AND question_type = ANY(${questionTypes})
      ORDER BY random()
      LIMIT ${count}
    `;

    if (questions.length === 0) {
      return NextResponse.json({ error: "No questions available for this game" }, { status: 404 });
    }

    const sessionQuestions = questions.map((q: any) => {
      const options = safeJsonParse(q.options);
      const correctAnswer = safeJsonParse(q.correct_answer);
      return {
        kind: gameId === "word-order" || gameId === "letter-connect" ? "sequence" : gameId === "matching" ? "pairs" : "choice",
        prompt: q.question_text,
        options: Array.isArray(options) ? options : undefined,
        tokens: gameId === "word-order" ? options : gameId === "letter-connect" ? String(q.question_text).split("") : undefined,
        pairs: gameId === "matching" ? options : undefined,
        answer: correctAnswer,
        explanation: q.explanation || "الإجابة الصحيحة معروضة.",
      };
    });

    return NextResponse.json({ questions: sessionQuestions });
  } catch (error: any) {
    console.error("Error fetching game session:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get session" },
      { status: 500 }
    );
  }
}

/**
 * لمنع خطأ 405 عند فتح الرابط مباشرة
 */
export async function GET() {
  return NextResponse.json({ error: "Method not allowed. Use POST." }, { status: 405 });
}