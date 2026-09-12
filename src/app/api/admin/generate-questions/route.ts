// app/api/admin/generate-questions/route.ts
// توليد أسئلة من النصوص وحفظها في قاعدة البيانات (اختياري)

import { NextResponse } from "next/server";
import { generateQuestionsFromText, type QuestionType } from "@/lib/ai/generate-questions";
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

// Phase 3 batch 5 — admin cost hardening. One request fans out into one
// provider call per 8,000-char chunk of source text (each with the shared
// client's retries), so the request boundary is now fixed BEFORE chunking:
//   - 10 requests / 10 min per admin uid
//   - sourceText <= 80,000 chars (at most 10 chunks)
//   - questionTypes: 1..8 distinct entries from the supported list
//   - countPerType: 1..20
//   - generic errors (no provider body / error.message)
// Generation prompts, model choice and the optional save path are unchanged.
const ADMIN_LIMIT = { limit: 10, windowMs: 10 * 60 * 1000 };
const SOURCE_MAX = 80_000;
const TYPES_MAX = 8;
const COUNT_MAX = 20;
const QUESTION_TYPES: ReadonlySet<string> = new Set<QuestionType>([
  "choice", "true_false", "fill_blank", "word_order", "matching", "listening", "writing", "speaking",
]);

export const POST = withApi(async (request) => {
  const admin = await requireAdmin(request);

  const check = checkRateLimit(`generate-questions:${admin.uid}`, ADMIN_LIMIT);
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
    questionTypes,
    countPerType: rawCount,
    difficulty: rawDifficulty,
    courseId: rawCourseId,
    save = false,
  } = body as Record<string, unknown>;

  if (typeof rawSource !== "string" || !rawSource.trim() || !questionTypes || rawCount === undefined) {
    return NextResponse.json(
      { error: "Missing required fields: sourceText, questionTypes, countPerType" },
      { status: 400 }
    );
  }
  const sourceText = boundedString(rawSource, { max: SOURCE_MAX });
  if (!sourceText) return NextResponse.json({ error: "sourceText too long" }, { status: 413 });
  if (!isAllowedStringArray(questionTypes, QUESTION_TYPES, TYPES_MAX)) {
    return NextResponse.json(
      { error: "questionTypes must be 1-8 distinct supported types" },
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
    const questions = await generateQuestionsFromText({
      sourceText,
      questionTypes: questionTypes as QuestionType[],
      countPerType,
      difficulty: difficulty || undefined,
    });

    let savedIds: string[] = [];

    if (save === true && courseId) {
      const sql = neon(process.env.DATABASE_URL!);
      for (const q of questions) {
        const result = await sql`
          INSERT INTO generated_questions (
            course_id,
            question_type,
            question_text,
            options,
            correct_answer,
            audio_text,
            difficulty
          )
          VALUES (
            ${courseId},
            ${q.question_type},
            ${q.question_text},
            ${JSON.stringify(q.options ?? null)}::jsonb,
            ${JSON.stringify(q.correct_answer ?? null)}::jsonb,
            ${q.audio_text || null},
            ${q.difficulty || null}
          )
          RETURNING id
        `;
        if (result.length > 0) {
          savedIds.push(result[0].id);
        }
      }
    }

    return NextResponse.json({ success: true, questions, savedIds });
  } catch (error) {
    console.error("generate-questions failed:", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ error: "Failed to generate questions" }, { status: 502 });
  }
});
