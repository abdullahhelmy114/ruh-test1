import { NextResponse } from "next/server";
import { withApi } from "@/lib/api/handler";
import { checkRateLimit, clientKey, retryAfterSeconds } from "@/lib/security/rate-limit";

// Node runtime: the abuse limiter is process-memory based and relies on the
// long-running Railway Node process, not an ephemeral Edge isolate.
export const runtime = "nodejs";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "nvidia/nemotron-3-nano-30b-a3b:free";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

// Phase 3 batch 3 — public abuse gate (this assistant is intentionally
// public on the marketing site). Previously an unbounded history was relayed
// to the provider by anyone, with no timeout, and provider error text was
// returned. Now:
//   - per-IP rate limit (429)
//   - caps on the current message, history length, per-entry and total size
//   - provider request timeout; generic error bodies only
// Model/provider and the reply contract ({ reply }) are unchanged.
// Authenticated per-user quotas are a later batch.
const IP_LIMIT = { limit: 20, windowMs: 10 * 60 * 1000 }; // 20 turns / 10 min per client
const MESSAGE_MAX = 2000;       // chars
const HISTORY_MAX_ENTRIES = 20; // turns kept from the client transcript
const HISTORY_ENTRY_MAX = 2000; // chars per turn
const HISTORY_TOTAL_MAX = 20000; // chars across the whole history
const PROVIDER_TIMEOUT_MS = 30_000;

async function fetchAcademyContext(): Promise<string> {
  try {
    const res = await fetch(`${SITE_URL}/api/academy-info`, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return "";
    const data = await res.json();
    return JSON.stringify(data, null, 2);
  } catch (e) {
    console.warn("Failed to fetch academy info:", e);
    return "";
  }
}

export const POST = withApi(async (req) => {
  const ipCheck = checkRateLimit(`ai-chat:${clientKey(req)}`, IP_LIMIT);
  if (!ipCheck.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds(ipCheck)) } }
    );
  }

  try {
    const body = await req.json().catch(() => null);
    const message: unknown = body?.message;
    const rawHistory: unknown = body?.history;

    if (!message || typeof message !== "string" || message.length > MESSAGE_MAX) {
      return NextResponse.json(
        { error: "Missing or invalid 'message' field" },
        { status: 400 }
      );
    }

    // Bounded history: last N well-formed turns, each capped, total capped.
    const history: Array<{ role: "user" | "assistant"; content: string }> = [];
    let historyChars = 0;
    if (Array.isArray(rawHistory)) {
      for (const msg of rawHistory.slice(-HISTORY_MAX_ENTRIES)) {
        const role = msg?.role;
        const content = msg?.content;
        if ((role !== "user" && role !== "assistant") || typeof content !== "string") continue;
        const clipped = content.slice(0, HISTORY_ENTRY_MAX);
        if (historyChars + clipped.length > HISTORY_TOTAL_MAX) break;
        historyChars += clipped.length;
        history.push({ role, content: clipped });
      }
    }

    const academyContext = await fetchAcademyContext();

    const systemPrompt = `أنت Nūr، المساعد الذكي لموقع Ruh-Ul-Qudus Academy.
مهمتك مساعدة المستخدمين في التنقل بالموقع وفهم الدورات والخدمات واختيار الأنسب لهم.

لديك وصول مباشر إلى بيانات الموقع الحقيقية (JSON) التالية:
${academyContext}

تعليمات:
- أجب فقط بناءً على البيانات الموجودة في السياق أعلاه.
- إذا سألك المستخدم عن شيء غير موجود في البيانات، فقل: "لا أملك هذه المعلومة حاليًا، يمكنك التواصل مع الدعم."
- كن ودودًا ومختصرًا وواضحًا.
- استخدم العربية الفصحى، وإذا سأل المستخدم بالإنجليزية أجب بالإنجليزية.
- عند عرض الدورات أو الكورسات:
    * قم بتصنيفها حسب المستوى (مبتدئ، متوسط، متقدم) إذا كانت بيانات المستوى متوفرة.
    * اعرض لكل دورة: الاسم، المستوى، السعر، المدة (إن وجدت)، وعدد الدروس (إن وجد).
    * استخدم تنسيقًا واضحًا مع نقاط أو قوائم.
    * لا تقم بإضافة أي رموز عملة إذا لم تكن متوفرة في البيانات، فقط اعرض الرقم كما هو.
- عند سؤال "أي كورس أشتري؟" أو "ما الأفضل لي؟" اسأل عن مستواه واهتماماته ثم رشح من الدورات الموجودة.
- عند سؤال "أين أجد الكورسات المشترك فيها؟" أجب أنها في لوحة التحكم أو صفحة "دوراتي".
- عند سؤال "ليه الموقع ده مميز؟" استخدم وصف الدورات والمميزات الموجودة.
- لا تختلق معلومات غير موجودة في السياق.
- تذكر المحادثة السابقة ولا تكرر ما قلته إلا إذا لزم الأمر.
- **مهم جدًا: لا تقم أبدًا بعرض أي تفكير داخلي أو خطوات أو "Here's a thinking process". أجب فقط بالإجابة النهائية مباشرة.**`;

    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: message },
    ];

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages,
        temperature: 0.3,
        max_tokens: 2048,
      }),
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });

    if (!response.ok) {
      // Provider bodies can contain account/quota details: log, never return.
      console.error("OpenRouter API error:", response.status);
      return NextResponse.json({ error: "Assistant unavailable" }, { status: 502 });
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content ?? "";

    return NextResponse.json({ reply: text });
  } catch (e) {
    console.error("AI Chat error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
});
