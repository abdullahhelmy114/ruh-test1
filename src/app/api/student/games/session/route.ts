// src/app/api/student/games/session/route.ts
// جلب جلسة لعبة عشوائية من جدول generated_games مباشرة
// مع تحويل معرّفات الألعاب من الواجهة إلى game_type في قاعدة البيانات

import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { requireStudent, requireEnrolled } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";

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

// Phase 2.4a: caller identity from the central auth layer; the student must be
// enrolled in the target course (admin bypass); `count` is validated as a
// small positive integer. Game conversion and response shape are unchanged.
// REVIEW (Phase 4): games are graded client-side and the session payload
// carries the answers by design; a server-side game score needs a persisted
// session model, which is out of scope here.
export const POST = withApi(async (request) => {
  const user = await requireStudent(request);

  try {
    const body = await request.json();
    const { gameId, courseId } = body;
    const requestedCount = Number(body.count ?? 10);
    const count = Number.isInteger(requestedCount) && requestedCount > 0 && requestedCount <= 50 ? requestedCount : 10;

    if (!gameId || !courseId) {
      return NextResponse.json({ error: "gameId and courseId are required" }, { status: 400 });
    }

    await requireEnrolled(user, courseId);
    const sql = neon(process.env.DATABASE_URL!);

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
  } catch (error) {
    if (error instanceof Error && (error.name === "AuthError" || error.name === "HttpError")) throw error;
    console.error("Error fetching game session:", error);
    return NextResponse.json({ error: "Failed to get session" }, { status: 500 });
  }
});

/**
 * لمنع خطأ 405 عند فتح الرابط مباشرة
 */
export async function GET() {
  return NextResponse.json({ error: "Method not allowed. Use POST." }, { status: 405 });
}