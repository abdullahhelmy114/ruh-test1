// app/api/admin/generate-questions/route.ts
// توليد أسئلة من النصوص وحفظها في قاعدة البيانات (اختياري)

import { NextResponse } from "next/server";
import { generateQuestionsFromText } from "@/lib/ai/generate-questions";
import { neon } from "@neondatabase/serverless";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";

export const POST = withApi(async (request) => {
  await requireAdmin(request);

  try {
    const body = await request.json();
    const {
      sourceText,
      questionTypes,
      countPerType,
      difficulty,
      courseId,
      save = false,
    } = body;

    if (!sourceText || !questionTypes || !countPerType) {
      return NextResponse.json(
        { error: "Missing required fields: sourceText, questionTypes, countPerType" },
        { status: 400 }
      );
    }

    if (!Array.isArray(questionTypes) || questionTypes.length === 0) {
      return NextResponse.json(
        { error: "questionTypes must be a non-empty array" },
        { status: 400 }
      );
    }

    if (countPerType <= 0) {
      return NextResponse.json(
        { error: "countPerType must be positive" },
        { status: 400 }
      );
    }

    const questions = await generateQuestionsFromText({
      sourceText,
      questionTypes,
      countPerType,
      difficulty,
    });

    let savedIds: string[] = [];

    if (save && courseId) {
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
  } catch (error: any) {
    console.error("Error generating questions:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate questions" },
      { status: 500 }
    );
  }
});