import { NextResponse } from "next/server";

export const runtime = "edge";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "nvidia/nemotron-3-nano-30b-a3b:free";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

async function fetchAcademyContext(): Promise<string> {
  try {
    const res = await fetch(`${SITE_URL}/api/academy-info`);
    if (!res.ok) return "";
    const data = await res.json();
    return JSON.stringify(data, null, 2);
  } catch (e) {
    console.warn("Failed to fetch academy info:", e);
    return "";
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message: string = body.message;
    const history: Array<{ role: "user" | "assistant"; content: string }> =
      body.history && Array.isArray(body.history) ? body.history : [];

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'message' field" },
        { status: 400 }
      );
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
    ];

    for (const msg of history) {
      if (msg.role === "user" || msg.role === "assistant") {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      }
    }

    messages.push({ role: "user", content: message });

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
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error("OpenRouter API error:", err);
      return NextResponse.json(
        { error: err?.error?.message || "OpenRouter API error" },
        { status: 500 }
      );
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
}