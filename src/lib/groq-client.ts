// src/lib/groq-client.ts
// عميل Gemini API مع 10 محاولات تلقائية عند الفشل.
// تم تعطيل OpenRouter نهائيًا.
// النموذج الافتراضي: gemini-3.7-flash (أو من البيئة GEMINI_MODEL)

export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface GroqRequestOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: "json_object" };
}

export interface GroqUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface GroqResponse {
  text: string;
  usage?: GroqUsage;
}

/**
 * تحويل رسائل Chat إلى صيغة Gemini
 */
function convertMessagesToGemini(messages: ChatMessage[]) {
  const systemMessage = messages.find((m) => m.role === "system");
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  return {
    systemInstruction: systemMessage
      ? { parts: [{ text: systemMessage.content }] }
      : undefined,
    contents,
  };
}

/**
 * استدعاء Gemini API
 */
async function callGemini(
  messages: ChatMessage[],
  options: GroqRequestOptions
): Promise<GroqResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const model = options.model || process.env.GEMINI_MODEL || "gemini-3.7-flash";
  const temperature = options.temperature ?? 0.7;
  const maxTokens = options.max_tokens || 4096;

  const { systemInstruction, contents } = convertMessagesToGemini(messages);

  const requestBody: any = {
    contents,
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
    },
  };

  if (systemInstruction) {
    requestBody.systemInstruction = systemInstruction;
  }

  if (options.response_format?.type === "json_object") {
    requestBody.generationConfig.responseMimeType = "application/json";
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  const usage: GroqUsage | undefined = data.usageMetadata
    ? {
        prompt_tokens: data.usageMetadata.promptTokenCount,
        completion_tokens: data.usageMetadata.candidatesTokenCount,
        total_tokens: data.usageMetadata.totalTokenCount,
      }
    : undefined;

  return { text, usage };
}

/**
 * الدالة الرئيسية: تحاول Gemini حتى 10 مرات مع مهلة بين المحاولات.
 */
export async function groqChatCompletion(
  messages: ChatMessage[],
  options: GroqRequestOptions = {}
): Promise<GroqResponse> {
  const maxAttempts = 10;
  let lastError: any;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await callGemini(messages, options);
    } catch (error: any) {
      lastError = error;

      // محاولة استخراج retryDelay من رسالة الخطأ إذا كانت 429
      let retryDelayMs = 2000 * attempt; // الافتراضي
      if (error?.message?.includes("429")) {
        const match = error.message.match(/retryDelay":\s*"(\d+)s"/);
        if (match) {
          retryDelayMs = parseInt(match[1], 10) * 1000 + 500; // إضافة 0.5 ثانية أمان
        }
      }

      console.warn(
        `Gemini attempt ${attempt}/${maxAttempts} failed. Waiting ${retryDelayMs / 1000}s before retry.`,
        error
      );

      if (attempt === maxAttempts) throw error;

      await new Promise((r) => setTimeout(r, retryDelayMs));
    }
  }

  throw lastError;
}

/**
 * توليد نص بسيط
 */
export async function simpleGroqCompletion(
  prompt: string,
  systemPrompt: string = "You are a helpful assistant.",
  options: GroqRequestOptions = {}
): Promise<string> {
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: prompt },
  ];
  const result = await groqChatCompletion(messages, options);
  return result.text;
}

/**
 * توليد استجابة JSON مع استخراج آمن
 */
export async function groqJSONCompletion<T = any>(
  prompt: string,
  systemPrompt: string,
  options: GroqRequestOptions = {}
): Promise<T> {
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: prompt },
  ];

  const result = await groqChatCompletion(messages, {
    ...options,
    response_format: { type: "json_object" },
  });

  let cleaned = result.text.trim();

  // إزالة علامات code fences إن وجدت
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json\s*/, "").replace(/```$/, "");
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```\s*/, "").replace(/```$/, "");
  }

  try {
    // المحاولة الأولى: تحليل النص كما هو
    return JSON.parse(cleaned) as T;
  } catch {
    // المحاولة الثانية: استخراج جزء JSON (كائن أو مصفوفة)
    try {
      const firstChar = cleaned.trim()[0];
      if (firstChar === "{") {
        const firstBrace = cleaned.indexOf("{");
        const lastBrace = cleaned.lastIndexOf("}");
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          const jsonOnly = cleaned.slice(firstBrace, lastBrace + 1);
          return JSON.parse(jsonOnly) as T;
        }
      } else if (firstChar === "[") {
        const firstBracket = cleaned.indexOf("[");
        const lastBracket = cleaned.lastIndexOf("]");
        if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
          const jsonOnly = cleaned.slice(firstBracket, lastBracket + 1);
          return JSON.parse(jsonOnly) as T;
        }
      }
    } catch {
      // فشل الاستخراج أيضًا
    }
  }

  console.error("Failed to parse JSON. Raw response:", result.text);
  throw new Error("Failed to parse JSON response");
}