// src/lib/ai/generate-questions.ts
// توليد أسئلة تعليمية من النصوص باستخدام Groq API

import { groqJSONCompletion } from "../groq-client";

export type QuestionType =
  | "choice"        // اختيار من متعدد
  | "true_false"    // صح/خطأ
  | "fill_blank"    // أكمل الفراغ
  | "word_order"    // ترتيب الكلمات
  | "matching"      // مطابقة
  | "listening"     // أسئلة استماع (نص صوتي)
  | "writing"       // أسئلة كتابة
  | "speaking";     // أسئلة نطق

export interface GeneratedQuestion {
  question_type: QuestionType;
  question_text: string;
  options: any;       // JSON: مصفوفة للاختيارات أو صح/خطأ أو أزواج مطابقة
  correct_answer: any; // الإجابة الصحيحة (نص/رقم/مصفوفة)
  audio_text?: string; // النص المراد تحويله لصوت في أسئلة الاستماع
  difficulty?: string; // مستوى الصعوبة
  explanation?: string; // شرح اختياري
}

export interface GenerateQuestionsInput {
  sourceText: string;
  questionTypes: QuestionType[];
  countPerType: number;
  difficulty?: string;
  language?: string; // "ar" افتراضياً
  additionalInstructions?: string;
}

/**
 * توليد أسئلة متنوعة من نص مصدر باستخدام Groq.
 * @param input المصدر والأنواع المطلوبة
 * @returns مصفوفة من الأسئلة المولدة
 */
export async function generateQuestionsFromText(
  input: GenerateQuestionsInput
): Promise<GeneratedQuestion[]> {
  const {
    sourceText,
    questionTypes,
    countPerType,
    difficulty,
    language = "ar",
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

  // بناء الـ Prompt بالعربية مع طلب JSON صارم
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
      "question_type": "choice",           // أو أي نوع من الأنواع المطلوبة
      "question_text": "نص السؤال",
      "options": ["خيار1", "خيار2", "خيار3", "خيار4"],
      "correct_answer": "الإجابة الصحيحة",   // للاختيارات: النص الصحيح
      "audio_text": "نص للاستماع إن لزم",    // فقط لأنواع listening
      "difficulty": "${difficulty || "متوسط"}",
      "explanation": "شرح مختصر"
    }
  ]
}

أنواع الأسئلة المدعومة وتنسيق كل نوع:
- choice: options مصفوفة من 4 نصوص، correct_answer هو النص الصحيح.
- true_false: options ["صح", "خطأ"], correct_answer هو "صح" أو "خطأ".
- fill_blank: question_text يحتوي على فراغ مثل "أكمل: ___ هو عاصمة مصر"، correct_answer هو الكلمة الناقصة.
- word_order: question_text هو الجملة الصحيحة، correct_answer هو مصفوفة الكلمات بالترتيب الصحيح، options هي الكلمات المبعثرة (يمكن أن تكون options مصفوفة من الكلمات). سنستخدم correct_answer مصفوفة من الكلمات بالترتيب الصحيح، وoptions غير مطلوبة.
- matching: question_text هو تعليمة، options عبارة عن مصفوفة كائنات {left: "...", right: "..."}، correct_answer كائن يربط بينهما (مثلاً {left: "كلمة", right: "معناها"}) أو مصفوفة من الأزواج الصحيحة. سنستخدم correct_answer كائن.
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
      model: "gemini-3.7-flash",
      temperature: 0.7,
      max_tokens: 4000,
    }
  );

  if (!parsed || !Array.isArray(parsed.questions)) {
    throw new Error("Invalid response format from AI");
  }

  // تنظيف وفلترة الأسئلة
  const cleaned = parsed.questions.filter(
    (q) => q.question_type && q.question_text && q.correct_answer !== undefined
  );

  return cleaned;
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
  // نفس الدالة السابقة لكن يمكن إضافة منطق تخزين هنا
  const questions = await generateQuestionsFromText({
    sourceText,
    questionTypes,
    countPerType,
    difficulty,
  });

  // هنا يمكن حفظ الأسئلة في generated_questions عبر دالة مستقلة
  // لكن سنترك الحفظ للـ API route لاحقاً

  return questions;
}