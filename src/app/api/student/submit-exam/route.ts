// app/api/student/submit-exam/route.ts
// تقديم الامتحان الكامل وتصحيحه وإصدار النقاط

import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { firebaseAdmin } from "@/lib/firebase-admin";
import { addPoints } from "@/lib/gamification/points";
import { checkAndAwardBadges } from "@/lib/gamification/badges";

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

function isAnswerCorrect(questionType: string, userAnswer: any, correctAnswer: any): boolean {
  switch (questionType) {
    case "choice":
    case "true_false":
    case "listening":
      return userAnswer === correctAnswer;
    case "fill_blank":
      return String(userAnswer).trim().toLowerCase() === String(correctAnswer).trim().toLowerCase();
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
    const { examId, answers } = body;

    if (!examId || !Array.isArray(answers) || answers.length === 0) {
      return NextResponse.json(
        { error: "examId and answers array are required" },
        { status: 400 }
      );
    }

    const attemptRes = await sql`
      SELECT id, user_id, course_id, passed, score
      FROM exam_attempts
      WHERE id = ${examId}
      LIMIT 1
    `;
    if (attemptRes.length === 0) {
      return NextResponse.json({ error: "Exam attempt not found" }, { status: 404 });
    }
    const attempt = attemptRes[0];
    if (attempt.user_id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (attempt.passed) {
      return NextResponse.json({ error: "Exam already submitted" }, { status: 400 });
    }

    const questionIds = answers.map((a: any) => a.questionId);
    if (questionIds.length === 0) {
      return NextResponse.json({ error: "No question IDs provided" }, { status: 400 });
    }

    const questionsRes = await sql`
      SELECT id, question_type, correct_answer
      FROM generated_questions
      WHERE id = ANY(${questionIds})
    `;
    const correctMap = new Map<string, { question_type: string; correct_answer: any }>();
    for (const q of questionsRes) {
      let parsedCorrect = q.correct_answer;
      try {
        parsedCorrect = q.correct_answer ? JSON.parse(q.correct_answer) : null;
      } catch {
        parsedCorrect = q.correct_answer;
      }
      correctMap.set(q.id, {
        question_type: q.question_type,
        correct_answer: parsedCorrect,
      });
    }

    let correctCount = 0;
    let validCount = 0;
    for (const ans of answers) {
      const qInfo = correctMap.get(ans.questionId);
      if (!qInfo) continue;
      validCount++;
      const isCorrect = isAnswerCorrect(qInfo.question_type, ans.answer, qInfo.correct_answer);
      if (isCorrect) correctCount++;
    }

    const totalQuestions = validCount;
    const score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
    const passed = score >= 50;

    await sql`
      UPDATE exam_attempts
      SET score = ${score},
          total_questions = ${totalQuestions},
          passed = ${passed},
          points_awarded = 0
      WHERE id = ${examId}
    `;

    let pointsAwarded = 0;

    if (passed) {
      const configRes = await sql`
        SELECT value FROM gamification_config WHERE key_name = 'exam_pass_points'
      `;
      const examPassPoints = configRes.length > 0 ? parseInt(configRes[0].value, 10) || 100 : 100;

      await addPoints(userId, examPassPoints, "exam_pass", {
        examId,
        score,
        totalQuestions,
      });
      pointsAwarded = examPassPoints;

      await sql`
        UPDATE exam_attempts SET points_awarded = ${examPassPoints} WHERE id = ${examId}
      `;

      try {
        await checkAndAwardBadges(userId);
      } catch (badgeError) {
        console.error("Error checking badges:", badgeError);
      }
    }

    return NextResponse.json({
      success: true,
      result: {
        score,
        passed,
        points_awarded: pointsAwarded,
        totalQuestions,
        correctCount,
      },
    });
  } catch (error: any) {
    console.error("Error submitting exam:", error);
    return NextResponse.json(
      { error: error.message || "Failed to submit exam" },
      { status: 500 }
    );
  }
}