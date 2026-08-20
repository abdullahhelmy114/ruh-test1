// src/lib/ai/generate-questions.ts
import { groqJSONCompletion } from "../groq-client";

export type QuestionType =
  | "choice"
  | "true_false"
  | "fill_blank"
  | "word_order"
  | "matching"
  | "listening"
  | "writing"
  | "speaking";

export interface GeneratedQuestion {
  question_type: QuestionType;
  question_text: string;
  options: any;
  correct_answer: any;
  audio_text?: string;
  difficulty?: string;
  explanation?: string;
}

export interface GenerateQuestionsInput {
  sourceText: string;
  questionTypes: QuestionType[];
  countPerType: number;
  difficulty?: string;
  language?: string;
  additionalInstructions?: string;
}

/**
 * تقطيع النص إلى أجزاء صغيرة لتجنب تجاوز حدود الـ Tokens
 */
function chunkText(text: string, chunkSize = 8000): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * توليد أسئلة من نص مصدر مع تقطيع تلقائي
 */
export async function generateQuestionsFromText(
  input: GenerateQuestionsInput
): Promise<GeneratedQuestion[]> {
  const {
    sourceText,
    questionTypes,
    countPerType,
    difficulty,
    additionalInstructions = "",
  } = input;

  if (!sourceText || sourceText.trim().length === 0) {
    throw new Error("Source text is required");
  }
  if (!questionTypes || questionTypes.length === 0) {
    throw new Error("At least one question type is required");
  }
  if (countPerType <= 0) {
    throw new Error("countPerType must be positive");
  }

  const chunks = chunkText(sourceText, 8000);
  const totalChunks = chunks.length;
  const perChunkCount = Math.max(1, Math.ceil(countPerType / totalChunks));

  const allQuestions: GeneratedQuestion[] = [];

  for (const chunk of chunks) {
    const chunkQuestions = await generateQuestionsFromChunk({
      sourceText: chunk,
      questionTypes,
      countPerType: perChunkCount,
      difficulty,
      additionalInstructions,
    });
    allQuestions.push(...chunkQuestions);
  }

  return allQuestions;
}

/**
 * توليد أسئلة من مقطع واحد (بدون تقطيع داخلي)
 */
async function generateQuestionsFromChunk(
  input: GenerateQuestionsInput
): Promise<GeneratedQuestion[]> {
  const {
    sourceText,
    questionTypes,
    countPerType,
    difficulty,
    additionalInstructions = "",
  } = input;

  const systemPrompt = `أنت خبير تعليمي متخصص في توليد أسئلة تعلم اللغة العربية والقرآن الكريم.
أنشئ أسئلة متنوعة بناءً على النص المقدم.
يجب أن تكون الأسئلة دقيقة ومناسبة للمستوى المحدد.
أعد الناتج بصيغة JSON فقط، بدون أي نص إضافي.`;

  const userPrompt = `
النص المصدر:
"""
${sourceText}
"""

المطلوب:
قم بتوليد ${countPerType} سؤال لكل نوع من الأنواع التالية: ${questionTypes.join(", ")}.

${difficulty ? `مستوى الصعوبة: ${difficulty}` : ""}
${additionalInstructions ? `تعليمات إضافية: ${additionalInstructions}` : ""}

صيغة JSON المطلوبة:
{
  "questions": [
    {
      "question_type": "choice",
      "question_text": "نص السؤال",
      "options": ["خيار1", "خيار2", "خيار3", "خيار4"],
      "correct_answer": "الإجابة الصحيحة",
      "audio_text": "نص للاستماع إن لزم",
      "difficulty": "${difficulty || "متوسط"}",
      "explanation": "شرح مختصر"
    }
  ]
}

أنواع الأسئلة المدعومة وتنسيق كل نوع:
- choice: options مصفوفة من 4 نصوص، correct_answer هو النص الصحيح.
- true_false: options ["صح", "خطأ"], correct_answer هو "صح" أو "خطأ".
- fill_blank: question_text يحتوي على فراغ مثل "أكمل: ___ هو عاصمة مصر"، correct_answer هو الكلمة الناقصة.
- word_order: question_text هو الجملة الصحيحة، correct_answer هو مصفوفة الكلمات بالترتيب الصحيح، options هي الكلمات المبعثرة.
- matching: question_text هو تعليمة، options عبارة عن مصفوفة كائنات {left: "...", right: "..."}، correct_answer كائن يربط بينهما.
- listening: مشابه لـ choice لكن مع audio_text يحتوي على النص الذي سيُقرأ صوتياً، والخيارات نصية.
- writing: question_text هو سؤال كتابي مفتوح، correct_answer نص مرجعي للتقييم.
- speaking: question_text هو ما يجب أن يقوله الطالب، correct_answer نص مرجعي.

تأكد من أن جميع الأسئلة مبنية على النص المصدر وذات صلة.
أعد فقط JSON بدون أي تعليقات إضافية.
`;

  const parsed = await groqJSONCompletion<{ questions: GeneratedQuestion[] }>(
    userPrompt,
    systemPrompt,
    {
      model: process.env.GEMINI_MODEL || "gemini-3.5-flash-lite",
      temperature: 0.7,
      max_tokens: 10000,
    }
  );

  if (!parsed || !Array.isArray(parsed.questions)) {
    throw new Error("Invalid response format from AI");
  }

  return parsed.questions.filter(
    (q) => q.question_type && q.question_text && q.correct_answer !== undefined
  );
}

/**
 * توليد أسئلة من نص ثم تحويلها للتخزين في قاعدة البيانات.
 * يمكن استخدامها مباشرة في API route.
 */
export async function generateQuestionsForCourse(
  sourceText: string,
  questionTypes: QuestionType[],
  countPerType: number,
  courseId: string,
  difficulty?: string
): Promise<GeneratedQuestion[]> {
  const questions = await generateQuestionsFromText({
    sourceText,
    questionTypes,
    countPerType,
    difficulty,
  });

  return questions;
}