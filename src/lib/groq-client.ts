// src/lib/groq-client.ts
// عميل Gemini API المشترك (الاسم تاريخي؛ تم تعطيل OpenRouter نهائيًا).
// النموذج الافتراضي: gemini-3.7-flash (أو من البيئة GEMINI_MODEL)
//
// Phase 3 batch 5 — cost and error hardening of the shared client used by
// evaluate-writing/speaking, the admin generators and curriculum generation:
//   - at most GROQ_MAX_ATTEMPTS (3) provider calls per logical request
//     (previously 10, retried on every failure including permanent 4xx)
//   - retries only on 429, 5xx, network failure or the per-attempt timeout
//   - capped backoff: 2 s, 4 s; a provider retryDelay is honoured only up to
//     MAX_PROVIDER_DELAY_MS
//   - every attempt is a real fetch abort via AbortSignal.timeout
//     (DEFAULT_TIMEOUT_MS, overridable per call for long generations)
//   - the API key travels in the x-goog-api-key header, never in the URL
//   - provider response bodies are never thrown or logged; outward errors
//     carry only a label and the HTTP status
//   - fetch and sleep are injectable for tests (no real waiting)
// Model selection, prompt shaping and the JSON-extraction helpers are
// unchanged.

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
  /** Per-attempt timeout; defaults to DEFAULT_TIMEOUT_MS. */
  timeoutMs?: number;
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

/** Test seams. Production callers never pass these. */
export interface GroqClientDeps {
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  apiKey?: string;
}

export const GROQ_MAX_ATTEMPTS = 3;
export const DEFAULT_TIMEOUT_MS = 120_000;
export const MAX_PROVIDER_DELAY_MS = 20_000;
export const BASE_BACKOFF_MS = 2_000;
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/** Sanitised provider failure: never carries the provider body. */
export class GeminiProviderError extends Error {
  readonly status: number | null;
  readonly retryable: boolean;
  readonly retryAfterMs: number | null;
  constructor(message: string, opts: { status?: number | null; retryable: boolean; retryAfterMs?: number | null }) {
    super(message);
    this.name = "GeminiProviderError";
    this.status = opts.status ?? null;
    this.retryable = opts.retryable;
    this.retryAfterMs = opts.retryAfterMs ?? null;
  }
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

/** Provider-directed delay from a 429: Retry-After header or the body's retryDelay, capped. */
function providerDelayMs(headers: Headers, bodyText: string): number | null {
  let seconds: number | null = null;
  const header = headers.get("retry-after");
  if (header && /^\d+$/.test(header.trim())) seconds = parseInt(header.trim(), 10);
  if (seconds === null) {
    const match = bodyText.match(/retryDelay"?\s*:\s*"(\d+)s"/);
    if (match) seconds = parseInt(match[1], 10);
  }
  if (seconds === null || !Number.isFinite(seconds)) return null;
  return Math.min(seconds * 1000 + 500, MAX_PROVIDER_DELAY_MS);
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * استدعاء Gemini API (محاولة واحدة)
 */
async function callGemini(
  messages: ChatMessage[],
  options: GroqRequestOptions,
  deps: GroqClientDeps
): Promise<GroqResponse> {
  const apiKey = deps.apiKey ?? process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const model = options.model || process.env.GEMINI_MODEL || "gemini-3.7-flash";
  const temperature = options.temperature ?? 0.7;
  const maxTokens = options.max_tokens || 4096;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetchImpl = deps.fetchImpl ?? fetch;

  const { systemInstruction, contents } = convertMessagesToGemini(messages);

  const requestBody: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
      ...(options.response_format?.type === "json_object" ? { responseMimeType: "application/json" } : {}),
    },
  };

  if (systemInstruction) {
    requestBody.systemInstruction = systemInstruction;
  }

  let response: Response;
  try {
    response = await fetchImpl(`${GEMINI_BASE}/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(requestBody),
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    // Network failure, DNS error or the per-attempt timeout (AbortError/TimeoutError).
    throw new GeminiProviderError("Gemini provider unavailable", { retryable: true });
  }

  if (!response.ok) {
    // The body is read only to extract a retry hint; it is never stored, logged or thrown.
    const bodyText = await response.text().catch(() => "");
    const status = response.status;
    const retryable = status === 429 || status >= 500;
    throw new GeminiProviderError(`Gemini provider status ${status}`, {
      status,
      retryable,
      retryAfterMs: retryable ? providerDelayMs(response.headers, bodyText) : null,
    });
  }

  const data = await response.json().catch(() => null);
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  const usage: GroqUsage | undefined = data?.usageMetadata
    ? {
        prompt_tokens: data.usageMetadata.promptTokenCount,
        completion_tokens: data.usageMetadata.candidatesTokenCount,
        total_tokens: data.usageMetadata.totalTokenCount,
      }
    : undefined;

  return { text, usage };
}

/**
 * الدالة الرئيسية: حتى 3 محاولات إجمالًا، مع إعادة المحاولة فقط عند 429/5xx/انقطاع الشبكة/المهلة.
 */
export async function groqChatCompletion(
  messages: ChatMessage[],
  options: GroqRequestOptions = {},
  deps: GroqClientDeps = {}
): Promise<GroqResponse> {
  const sleep = deps.sleep ?? defaultSleep;

  for (let attempt = 1; attempt <= GROQ_MAX_ATTEMPTS; attempt++) {
    try {
      return await callGemini(messages, options, deps);
    } catch (error) {
      const retryable = error instanceof GeminiProviderError && error.retryable;
      if (!retryable || attempt === GROQ_MAX_ATTEMPTS) throw error;

      const providerDelay = error instanceof GeminiProviderError ? error.retryAfterMs : null;
      const delayMs = Math.min(providerDelay ?? BASE_BACKOFF_MS * attempt, MAX_PROVIDER_DELAY_MS);
      console.warn(
        `Gemini attempt ${attempt}/${GROQ_MAX_ATTEMPTS} failed (${error instanceof GeminiProviderError ? error.status ?? "network" : "error"}); retrying in ${delayMs}ms`
      );
      await sleep(delayMs);
    }
  }

  // Unreachable: the loop either returns or throws on the final attempt.
  throw new GeminiProviderError("Gemini provider unavailable", { retryable: false });
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

  // Log only the size of the unparsable output, never its content.
  console.error(`Failed to parse JSON from Gemini (${result.text.length} chars)`);
  throw new Error("Failed to parse JSON response");
}
