// src/lib/ai/evaluate-writing.ts
// تصحيح الكتابة وتقييمها باستخدام Groq API

import { simpleGroqCompletion } from "../groq-client";
import { levenshteinDistance } from "./levenshtein";

export interface WritingEvaluationResult {
  score: number;              // 0-100
  passed: boolean;            // true if score >= 60
  feedback: string;           // ملاحظات بناءة
  corrected_text?: string;    // النص الصحيح المقترح
  errors: string[];           // أخطاء إملائية/نحوية
  suggestions: string[];      // اقتراحات للتحسين
}

/**
 * تقييم كتابة الطالب بناءً على السؤال/الموضوع والإجابة المقدمة.
 * @param prompt السؤال أو المطلوب كتابته (مثل "اكتب ما تسمع" أو سؤال مفتوح)
 * @param userAnswer إجابة الطالب النصية
 * @returns نتيجة التقييم
 */
export async function evaluateWriting(
  prompt: string,
  userAnswer: string
): Promise<WritingEvaluationResult> {
  if (!prompt || !userAnswer) {
    throw new Error("Both prompt and user answer are required");
  }

  const systemPrompt = `أنت خبير لغوي في تعليم اللغة العربية للناطقين بغيرها.
قارن إجابة الطالب بالسؤال المطلوب، وصحح الأخطاء الإملائية والنحوية.
قدم تغذية راجعة مفصلة باللغة الإنجليزية (لأنها ستُترجم لاحقاً).
أعد الناتج بصيغة JSON فقط بدون أي نص إضافي.`;

  const userPrompt = `
السؤال/المطلوب:
"""
${prompt}
"""

إجابة الطالب:
"""
${userAnswer}
"""

المطلوب:
1. صحح إجابة الطالب إن وجدت أخطاء.
2. حدد الأخطاء الإملائية أو النحوية.
3. أعط درجة من 0 إلى 100 (دقة الكتابة).
4. حدد ما إذا كان الطالب قد نجح (الدرجة >= 60).
5. اكتب ملاحظات مختصرة باللغة الإنجليزية.

صيغة JSON:
{
  "score": 85,
  "passed": true,
  "feedback": "Well done, minor spelling errors...",
  "corrected_text": "النص الصحيح",
  "errors": ["خطأ إملائي في كلمة..."],
  "suggestions": ["Focus on the letter أ versus ا"]
}
`;

  const response = await simpleGroqCompletion(userPrompt, systemPrompt, {
    model: "gemini-3.5-flash-lite",
    temperature: 0.3,
    max_tokens: 1000,
  });

  try {
    let cleaned = response.trim();
    if (cleaned.startsWith("```json")) {
      cleaned = cleaned.replace(/^```json\s*/, "").replace(/```$/, "");
    } else if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```\s*/, "").replace(/```$/, "");
    }
    const parsed = JSON.parse(cleaned) as WritingEvaluationResult;
    return {
      score: parsed.score,
      passed: parsed.passed ?? parsed.score >= 60,
      feedback: parsed.feedback,
      corrected_text: parsed.corrected_text,
      errors: Array.isArray(parsed.errors) ? parsed.errors : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
    };
  } catch (error) {
    console.error("Failed to parse writing evaluation response:", response);
    // تقييم بسيط بناءً على مسافة ليفنشتاين كاحتياطي
    const distance = levenshteinDistance(prompt, userAnswer);
    const maxLength = Math.max(prompt.length, userAnswer.length);
    const similarity = maxLength === 0 ? 100 : (1 - distance / maxLength) * 100;
    const score = Math.round(Math.max(0, similarity));
    return {
      score,
      passed: score >= 60,
      feedback: "Evaluation based on text similarity.",
      errors: [],
      suggestions: [],
    };
  }
}

// Phase 3 batch 5: the private full-matrix Levenshtein copy was replaced by
// the shared O(min(n,m))-memory implementation in ./levenshtein.ts.