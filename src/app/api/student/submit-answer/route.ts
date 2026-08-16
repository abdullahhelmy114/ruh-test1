// app/api/student/submit-answer/route.ts
// تقديم إجابة سؤال/لعبة وتقييمها فورياً، وتسجيل النشاط اليومي

import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { firebaseAdmin } from "@/lib/firebase-admin";
import { addPoints, getPointsBalance } from "@/lib/gamification/points";
import { updateStreak } from "@/lib/gamification/streaks";

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

function isAnswerCorrect(
  questionType: string,
  userAnswer: any,
  correctAnswer: any
): boolean {
  switch (questionType) {
    case "choice":
    case "true_false":
    case "listening":
      return userAnswer === correctAnswer;
    case "fill_blank":
      return (
        String(userAnswer).trim().toLowerCase() ===
        String(correctAnswer).trim().toLowerCase()
      );
    case "word_order":
    case "matching":
      return JSON.stringify(userAnswer) === JSON.stringify(correctAnswer);
    default:
      return false;
  }
}

export async function POST(request: Request) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = neon(process.env.DATABASE_URL!);
  try {
    const body = await request.json();
    const {
      questionId,
      questionType,
      userAnswer,
      correctAnswer,
      activitySummary,
      finalize,
    } = body;

    if (!questionType || userAnswer === undefined) {
      return NextResponse.json(
        { error: "questionType and userAnswer are required" },
        { status: 400 }
      );
    }

    let actualCorrectAnswer = correctAnswer;
    if (actualCorrectAnswer === undefined && questionId) {
      const questionRes = await sql`
        SELECT correct_answer FROM generated_questions
        WHERE id = ${questionId}
        LIMIT 1
      `;
      if (questionRes.length > 0) {
        actualCorrectAnswer = questionRes[0].correct_answer
          ? JSON.parse(questionRes[0].correct_answer)
          : null;
      } else {
        const quizRes = await sql`
          SELECT correct FROM quizzes
          WHERE id = ${questionId}
          LIMIT 1
        `;
        if (quizRes.length > 0) {
          const quiz = quizRes[0];
          const options = quiz.options ? JSON.parse(quiz.options) : [];
          actualCorrectAnswer = options[quiz.correct] || null;
        }
      }
    }

    if (actualCorrectAnswer === undefined || actualCorrectAnswer === null) {
      return NextResponse.json(
        { error: "correctAnswer could not be determined" },
        { status: 400 }
      );
    }

    const isCorrect = isAnswerCorrect(questionType, userAnswer, actualCorrectAnswer);

    await sql`
      INSERT INTO activity_log (user_id, activity_type, points_earned, metadata)
      VALUES (${userId}, 'question_answered', 0, ${JSON.stringify({
        questionId: questionId || null,
        questionType,
        isCorrect,
        timestamp: new Date().toISOString(),
      })})
    `;

    let activityCompleted = false;
    let pointsAwarded = 0;
    let streakInfo = null;

    if (finalize && activitySummary) {
      const { totalQuestions, correctCount, activityType } = activitySummary;
      const score = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;

      if (totalQuestions >= 10 && score >= 50) {
        streakInfo = await updateStreak(userId);
        activityCompleted = true;
        pointsAwarded += 1;

        if (score === 100) {
          await addPoints(userId, 1, "perfect_activity_bonus", {
            activityType,
            totalQuestions,
            correctCount,
            score,
          });
          pointsAwarded += 1;
        }

        await sql`
          INSERT INTO activity_log (user_id, activity_type, points_earned, metadata)
          VALUES (${userId}, ${activityType === 'game' ? 'game_completed' : 'quiz_completed'}, 0, ${JSON.stringify({
            totalQuestions,
            correctCount,
            score,
          })})
        `;
      }
    }

    return NextResponse.json({
      success: true,
      isCorrect,
      correctAnswer: actualCorrectAnswer,
      activityCompleted,
      pointsAwarded,
      streak: streakInfo,
    });
  } catch (error: any) {
    console.error("Error processing answer:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process answer" },
      { status: 500 }
    );
  }
}