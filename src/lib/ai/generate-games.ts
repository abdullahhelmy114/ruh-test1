// src/lib/ai/generate-games.ts
// توليد بيانات ألعاب تعليمية من النصوص باستخدام Groq API

import { groqJSONCompletion } from "../groq-client";

export type GameType =
  | "word_order"     // ترتيب الكلمات لتكوين جملة
  | "speed_choice"   // اختيار الصحيح بسرعة
  | "matching"       // مطابقة صوت وصورة (أو كلمة ومعنى)
  | "letter_connect" // توصيل الحروف لتكوين كلمة
  | "time_race"      // سباق زمني (سلسلة أسئلة سريعة)
  | "coloring";      // تلوين حروف/كلمات (قد لا يحتاج Groq، لكن بيانات بسيطة)

export interface GeneratedGame {
  game_type: GameType;
  title: string;
  description?: string;
  game_data: any; // JSON خاص بكل لعبة
  difficulty?: string;
}

export interface GenerateGamesInput {
  sourceText: string;
  gameTypes: GameType[];
  countPerType: number;
  difficulty?: string;
  additionalInstructions?: string;
}

/**
 * توليد بيانات ألعاب من نص مصدر باستخدام Groq.
 * @param input المصدر والأنواع المطلوبة
 * @returns مصفوفة من الألعاب المولدة
 */
export async function generateGamesFromText(
  input: GenerateGamesInput
): Promise<GeneratedGame[]> {
  const {
    sourceText,
    gameTypes,
    countPerType,
    difficulty,
    additionalInstructions = "",
  } = input;

  if (!sourceText || sourceText.trim().length === 0) {
    throw new Error("Source text is required");
  }
  if (!gameTypes || gameTypes.length === 0) {
    throw new Error("At least one game type is required");
  }
  if (countPerType <= 0) {
    throw new Error("countPerType must be positive");
  }

  const systemPrompt = `أنت خبير ألعاب تعليمية متخصص في تعليم اللغة العربية والقرآن الكريم.
صمم ألعاباً تفاعلية ممتعة مبنية على النص المقدم.
أعد الناتج بصيغة JSON فقط، بدون أي نص إضافي.`;

  const userPrompt = `
النص المصدر:
"""
${sourceText}
"""

المطلوب:
قم بتوليد ${countPerType} لعبة لكل نوع من الأنواع التالية: ${gameTypes.join(", ")}.

${difficulty ? `مستوى الصعوبة: ${difficulty}` : ""}
${additionalInstructions ? `تعليمات إضافية: ${additionalInstructions}` : ""}

صيغة JSON المطلوبة:
{
  "games": [
    {
      "game_type": "word_order",       // أو أي نوع من الأنواع المطلوبة
      "title": "عنوان اللعبة",
      "description": "وصف مختصر",
      "game_data": { ... },           // بيانات حسب نوع اللعبة
      "difficulty": "${difficulty || "متوسط"}"
    }
  ]
}

تفاصيل game_data لكل نوع لعبة:

1. word_order (ترتيب الكلمات):
{
  "sentence": "الجملة الصحيحة",
  "words": ["كلمة1", "كلمة2", "كلمة3"],  // الكلمات مبعثرة
  "correct_order": [0, 1, 2]            // ترتيب الفهارس الصحيح
}

2. speed_choice (اختيار الصحيح بسرعة):
{
  "question": "نص السؤال",
  "options": ["خيار1", "خيار2", "خيار3", "خيار4"],
  "correct_index": 0,                   // فهرس الإجابة الصحيحة
  "time_limit_seconds": 10              // الحد الزمني المقترح
}

3. matching (مطابقة):
{
  "pairs": [
    { "left": "كلمة", "right": "معناها" },
    { "left": "صوت", "right": "نص" }      // إذا كانت مطابقة صوت ونص
  ],
  "correct_mapping": { "كلمة": "معناها" } // أو { "left_item": "right_item" }
}

4. letter_connect (توصيل الحروف):
{
  "word": "الكلمة",
  "letters": ["ح", "ر", "ف"],           // الحروف مبعثرة
  "correct_order": [0, 1, 2]            // ترتيب الفهارس الصحيح
}

5. time_race (سباق زمني):
{
  "questions": [
    {
      "question": "سؤال سريع",
      "options": ["خيار1", "خيار2", "خيار3"],
      "correct_index": 0
    }
  ]
}

6. coloring (تلوين):
{
  "word": "الكلمة",
  "image_hint": "وصف بسيط للصورة المقترحة" // لن نستخدم Groq لتوليد صورة، فقط بيانات
}

تأكد من أن جميع الألعاب مبنية على النص المصدر ومناسبة للمستوى.
أعد فقط JSON بدون أي تعليقات إضافية.
`;

  const parsed = await groqJSONCompletion<{ games: GeneratedGame[] }>(
    userPrompt,
    systemPrompt,
    {
      model: "gemini-3.7-flash",
      temperature: 0.8,
      max_tokens: 4000,
    }
  );

  if (!parsed || !Array.isArray(parsed.games)) {
    throw new Error("Invalid response format from AI");
  }

  const cleaned = parsed.games.filter(
    (g) => g.game_type && g.title && g.game_data
  );

  return cleaned;
}