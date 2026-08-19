// src/lib/ai/evaluate-speaking.ts
// تقييم النطق باستخدام Groq API

import { simpleGroqCompletion } from "../groq-client";

export interface SpeakingEvaluationResult {
  score: number;           // 0-100
  passed: boolean;         // true if score >= 60
  feedback: string;        // ملاحظات مفصلة
  errors: string[];        // أخطاء النطق المحتملة
  suggestions: string[];   // اقتراحات للتحسين
}

/**
 * تقييم نطق الطالب بناءً على النص المتوقع والنص الفعلي.
 * @param expectedText النص الصحيح الذي يجب أن ينطقه الطالب
 * @param actualText النص الذي نطقه الطالب (بعد تحويل الصوت إلى نص)
 * @returns نتيجة التقييم
 */
export async function evaluateSpeaking(
  expectedText: string,
  actualText: string
): Promise<SpeakingEvaluationResult> {
  if (!expectedText || !actualText) {
    throw new Error("Both expected and actual text are required");
  }

  const systemPrompt = `أنت خبير في تقييم نطق اللغة العربية للناطقين بغيرها.
قارن بين النص الصحيح المطلوب والنص الذي نطقه الطالب.
حدد الأخطاء الصوتية المحتملة (مثل نطق حرف بشكل خاطئ أو استبدال حرف بآخر).
قدم ملاحظات بناءة باللغة الإنجليزية (لأنها ستُترجم لاحقاً).
أعد الناتج بصيغة JSON فقط بدون أي نص إضافي.`;

  const userPrompt = `
النص المطلوب نطقه:
"""
${expectedText}
"""

النص الذي نطقه الطالب (كما تعرف عليه النظام):
"""
${actualText}
"""

المطلوب:
1. قارن بين النصين.
2. حدد الأخطاء الصوتية المحتملة (مثل: نطق "ث" كـ "س").
3. أعط درجة من 0 إلى 100 (دقة النطق).
4. حدد ما إذا كان الطالب قد نجح (الدرجة >= 60).
5. اكتب ملاحظات مختصرة باللغة الإنجليزية.

صيغة JSON:
{
  "score": 85,
  "passed": true,
  "feedback": "Overall good pronunciation, but minor issues with...",
  "errors": ["The letter 'ث' was pronounced as 'س'"],
  "suggestions": ["Focus on the difference between 'ث' and 'س'"]
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
    const parsed = JSON.parse(cleaned) as SpeakingEvaluationResult;
    return {
      score: parsed.score,
      passed: parsed.passed ?? parsed.score >= 60,
      feedback: parsed.feedback,
      errors: Array.isArray(parsed.errors) ? parsed.errors : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
    };
  } catch (error) {
    console.error("Failed to parse speaking evaluation response:", response);
    // في حالة فشل الـ JSON، نقدم تقييمًا بسيطًا بناءً على المسافة
    const distance = levenshteinDistance(expectedText, actualText);
    const score = Math.max(0, 100 - distance * 5);
    return {
      score,
      passed: score >= 60,
      feedback: "Evaluation based on text similarity.",
      errors: [],
      suggestions: [],
    };
  }
}

/**
 * حساب مسافة ليفنشتاين بين نصين (للاستخدام كاحتياطي)
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}