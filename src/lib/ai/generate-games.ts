// src/lib/ai/generate-games.ts
import { groqJSONCompletion } from "../groq-client";

export type GameType =
  | "word_order"
  | "speed_choice"
  | "matching"
  | "letter_connect"
  | "time_race"
  | "coloring";

export interface GeneratedGame {
  game_type: GameType;
  title: string;
  description?: string;
  game_data: any;
  difficulty?: string;
}

export interface GenerateGamesInput {
  sourceText: string;
  gameTypes: GameType[];
  countPerType: number;
  difficulty?: string;
  additionalInstructions?: string;
}

function chunkText(text: string, chunkSize = 3000): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * توليد ألعاب من نص مصدر مع تقطيع تلقائي
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

  const chunks = chunkText(sourceText, 10000);
  const totalChunks = chunks.length;
  const perChunkCount = Math.max(1, Math.ceil(countPerType / totalChunks));

  const allGames: GeneratedGame[] = [];

  for (const chunk of chunks) {
    const chunkGames = await generateGamesFromChunk({
      sourceText: chunk,
      gameTypes,
      countPerType: perChunkCount,
      difficulty,
      additionalInstructions,
    });
    allGames.push(...chunkGames);
  }

  return allGames;
}

/**
 * توليد ألعاب من مقطع واحد
 */
async function generateGamesFromChunk(
  input: GenerateGamesInput
): Promise<GeneratedGame[]> {
  const {
    sourceText,
    gameTypes,
    countPerType,
    difficulty,
    additionalInstructions = "",
  } = input;

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
      "game_type": "word_order",
      "title": "عنوان اللعبة",
      "description": "وصف مختصر",
      "game_data": { ... },
      "difficulty": "${difficulty || "متوسط"}"
    }
  ]
}

تفاصيل game_data لكل نوع لعبة:
1. word_order: { "sentence": "...", "words": ["...", "..."], "correct_order": [0, 1] }
2. speed_choice: { "question": "...", "options": ["...", "..."], "correct_index": 0, "time_limit_seconds": 10 }
3. matching: { "pairs": [{"left": "...", "right": "..."}], "correct_mapping": {} }
4. letter_connect: { "word": "...", "letters": ["..."], "correct_order": [0] }
5. time_race: { "questions": [{"question": "...", "options": ["..."], "correct_index": 0}] }
6. coloring: { "word": "...", "image_hint": "..." }

تأكد من أن جميع الألعاب مبنية على النص المصدر ومناسبة للمستوى.
أعد فقط JSON بدون أي تعليقات إضافية.
`;

  const parsed = await groqJSONCompletion<{ games: GeneratedGame[] }>(
    userPrompt,
    systemPrompt,
    {
      model: process.env.GEMINI_MODEL || "gemini-3.5-flash-lite",
      temperature: 0.8,
      max_tokens: 10000, // تم رفعها
    }
  );

  if (!parsed || !Array.isArray(parsed.games)) {
    throw new Error("Invalid response format from AI");
  }

  return parsed.games.filter((g) => g.game_type && g.title && g.game_data);
}