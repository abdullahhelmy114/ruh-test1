import { NextResponse } from 'next/server';
import { buildOnboardingPrompt, buildSalesPrompt, buildDashboardPrompt } from '@/lib/tutorPrompts';
import { sql } from '@/lib/db/client';
import { requireAuth, AuthError } from '@/lib/auth';
import { withApi } from '@/lib/api/handler';
import { checkRateLimit, clientKey, retryAfterSeconds } from '@/lib/security/rate-limit';

type Language = 'en' | 'tr' | 'it' | 'es' | 'ar';

// Phase 3 batch 3 — abuse/cost gate.
// The `sales` context is intentionally anonymous (public courses page) and
// used to relay an unbounded history to Gemini with the API key in the URL
// query string and no timeout. Now:
//   - anonymous sales calls are rate-limited per client (429)
//   - message/history sizes are capped for every context
//   - the key travels in the `x-goog-api-key` header, never in the URL
//   - both Gemini calls carry a timeout; failures return fixed messages
// Authenticated contexts keep their current auth; per-user quotas are a
// later batch. Prompts, model and reply contract are unchanged.
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent';
const SALES_IP_LIMIT = { limit: 20, windowMs: 10 * 60 * 1000 }; // 20 anonymous turns / 10 min per client
const AUTH_USER_LIMIT = { limit: 30, windowMs: 10 * 60 * 1000 }; // 30 authenticated turns / 10 min per uid (batch 5)
const MESSAGE_MAX = 2000;        // chars
const HISTORY_MAX_ENTRIES = 20;  // turns kept from the client transcript
const HISTORY_ENTRY_MAX = 2000;  // chars per turn
const HISTORY_TOTAL_MAX = 20000; // chars across the whole history
const PROVIDER_TIMEOUT_MS = 30_000;

function boundedHistory(raw: unknown): Array<{ role: 'user' | 'model'; parts: { text: string }[] }> {
  const out: Array<{ role: 'user' | 'model'; parts: { text: string }[] }> = [];
  if (!Array.isArray(raw)) return out;
  let total = 0;
  for (const msg of raw.slice(-HISTORY_MAX_ENTRIES)) {
    const content = msg?.content;
    if (typeof content !== 'string') continue;
    const text = content.slice(0, HISTORY_ENTRY_MAX);
    if (total + text.length > HISTORY_TOTAL_MAX) break;
    total += text.length;
    out.push({ role: msg?.role === 'assistant' ? 'model' : 'user', parts: [{ text }] });
  }
  return out;
}

// دالة استخراج التقييم بصيغة JSON من رد المعلم
async function extractAssessment(replyText: string, apiKey: string): Promise<any | null> {
  const extractionPrompt = `
استخرج من النص التالي معلومات تقييم الطالب:
- المستوى (level) من A1 إلى C2
- الهدف (goal) من القيم التالية: general, academic, business, religious, travel
- ملخص تقييم مختصر (notes)
- قائمة بمعرفات الكورسات المقترحة (recommended_courses) من النص

النص: "${replyText}"

أعد النتيجة بصيغة JSON فقط بدون أي نص إضافي.
مثال: {"level":"A2","goal":"general","notes":"مستوى متوسط","recommended_courses":["arabic-a2-general"]}
`;

  try {
    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: extractionPrompt }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 300 },
      }),
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      const jsonString = text.substring(jsonStart, jsonEnd + 1);
      return JSON.parse(jsonString);
    }
    return null;
  } catch (error) {
    console.error('فشل استخراج التقييم:', error);
    return null;
  }
}

// Phase 2.2: the `sales` context is a genuine pre-authentication use (public
// courses page). Every other context requires a verified session, and the
// assessment written in `onboarding` is keyed by the caller's own uid; the
// client-supplied userId is no longer accepted. userName/userLevel/userGoal
// remain prompt hints only (they never establish identity).
export const POST = withApi(async (req) => {
  try {
    const {
      message,
      history = [],
      context = 'dashboard',
      userLevel,
      userGoal,
      userName,
      language = 'ar', // ✅ لغة جديدة
    } = await req.json();

    const user = context === 'sales' ? null : await requireAuth(req);
    const userId = user?.uid ?? null;

    if (!user) {
      // Anonymous sales assistant: bounded per client.
      const ipCheck = checkRateLimit(`tutor-sales:${clientKey(req)}`, SALES_IP_LIMIT);
      if (!ipCheck.allowed) {
        return NextResponse.json(
          { error: 'Too many requests' },
          { status: 429, headers: { 'Retry-After': String(retryAfterSeconds(ipCheck)) } }
        );
      }
    } else {
      // Phase 3 batch 5: authenticated contexts (onboarding/dashboard) cost up
      // to two Gemini calls per turn and had no quota. Keyed by the verified
      // uid, checked before any provider work; the anonymous limiter above is
      // not applied to authenticated callers.
      const userCheck = checkRateLimit(`tutor-auth:${user.uid}`, AUTH_USER_LIMIT);
      if (!userCheck.allowed) {
        return NextResponse.json(
          { error: 'Too many requests' },
          { status: 429, headers: { 'Retry-After': String(retryAfterSeconds(userCheck)) } }
        );
      }
    }

    if (!message || typeof message !== 'string' || message.length > MESSAGE_MAX) {
      return NextResponse.json({ error: 'الرسالة فارغة أو غير صالحة' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'مفتاح API غير مضبوط' }, { status: 500 });
    }

    let systemPrompt = '';
    if (context === 'onboarding') {
      systemPrompt = await buildOnboardingPrompt(userName, language as Language);
    } else if (context === 'sales') {
      systemPrompt = await buildSalesPrompt(language as Language);
    } else {
      systemPrompt = await buildDashboardPrompt(userLevel, userGoal, language as Language);
    }

    const contents = [
      { role: 'user', parts: [{ text: systemPrompt }] },
      { role: 'model', parts: [{ text: 'حسنًا، لنبدأ! كيف يمكنني مساعدتك؟' }] },
      ...boundedHistory(history),
      { role: 'user', parts: [{ text: message }] },
    ];

    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 800,
        },
      }),
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });

    const data = await response.json();
    if (!response.ok) {
      // Provider bodies can contain key/quota details: log the status only.
      console.error('Gemini API error:', response.status);
      throw new Error('فشل الاتصال بـ Gemini');
    }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'عذرًا، لم أستطع الرد.';

    let assessment = null;
    if (context === 'onboarding' && userId) {
      assessment = await extractAssessment(reply, apiKey);
      if (assessment) {
        await sql`
          INSERT INTO user_assessment (user_id, user_goal, user_level, assessment_notes, recommended_course_ids)
          VALUES (
            ${userId},
            ${assessment.goal || null},
            ${assessment.level || null},
            ${assessment.notes || reply},
            ${assessment.recommended_courses || []}
          )
        `;
      }
    }

    return NextResponse.json({ reply, assessment });
  } catch (error) {
    if (error instanceof AuthError) throw error; // let withApi map 401/403
    console.error('Error in /api/tutor:', error);
    return NextResponse.json({ error: 'حدث خطأ في المعالجة' }, { status: 500 });
  }
});