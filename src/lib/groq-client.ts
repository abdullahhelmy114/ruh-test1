// src/lib/groq-client.ts
// عميل Google Gemini API
// المفتاح: GEMINI_API_KEY
// النموذج الافتراضي: gemini-3.7-flash

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

function convertMessages(messages: ChatMessage[]) {
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

export async function groqChatCompletion(
  messages: ChatMessage[],
  options: GroqRequestOptions = {}
): Promise<GroqResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set in environment variables");
  }

  const model = options.model || process.env.GEMINI_MODEL || "gemini-3.7-flash";
  const temperature = options.temperature ?? 0.7;
  const maxTokens = options.max_tokens || 4096;

  const { systemInstruction, contents } = convertMessages(messages);

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
    model: options.model || process.env.GEMINI_MODEL || "gemini-3.7-flash",
    response_format: { type: "json_object" },
  });

  try {
    let cleaned = result.text.trim();
    if (cleaned.startsWith("```json")) {
      cleaned = cleaned.replace(/^```json\s*/, "").replace(/```$/, "");
    } else if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```\s*/, "").replace(/```$/, "");
    }
    return JSON.parse(cleaned) as T;
  } catch (error) {
    console.error("Failed to parse JSON from Gemini:", result.text);
    throw new Error("Failed to parse JSON response");
  }
}