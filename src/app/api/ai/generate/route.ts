import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { verifyIdToken } from "@/lib/firebase/server";
import { sql } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await verifyIdToken(req);
    if (!user || user.role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { prompt, type, courseTitle, level } = await req.json();
    if (!prompt) return NextResponse.json({ error: "Prompt is required" }, { status: 400 });

    const openRouterApiKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterApiKey) throw new Error("OPENROUTER_API_KEY is missing!");

    // =========================================================
    // 🔍 1. البحث في قاعدة بيانات Neon (RAG)
    // =========================================================
    let contextData = "";
    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
      const embeddingModel = genAI.getGenerativeModel({ model: "embedding-001" });
      const promptEmbedResult = await embeddingModel.embedContent(prompt);
      const promptVector = `[${promptEmbedResult.embedding.values.join(",")}]`;

      const relevantChunks = await sql`
        SELECT book_title, chunk_text 
        FROM knowledge_base 
        ORDER BY embedding <=> ${promptVector}::vector 
        LIMIT 15
      `;
      if (relevantChunks && relevantChunks.length > 0) {
        contextData = relevantChunks.map(c => `[كتاب: ${c.book_title}]:\n${c.chunk_text}`).join("\n\n");
      }
    } catch (e) {
      console.warn("RAG Bypassed");
    }

    // =========================================================
    // 🧠 2. هندسة الأوامر الصارمة حسب نوع الطلب
    // =========================================================
    let systemInstruction = "";

    if (type === "curriculum") {
      systemInstruction = `أنت مطور مناهج ذو خبرة، متخصص في تعليم اللغات لغير الناطقين بها.
المصدر المعتمد الوحيد لكتابة المنهج:
${contextData}

المطلوب إنجازه للمنهج:
بناءً على طلب المستخدم التالي: "${prompt}"
قم بتصميم دورة شاملة بعنوان "${courseTitle || 'دورة تعليمية'}" موجهة للمتعلمين في مستوى الكفاءة "${level || 'مبتدئ'}".
حدد وحدات الدورة، ودروس كل وحدة متسلسلة منطقياً.

قاعدة برمجية صارمة جداً (إجباري):
لا تكتب أي نص عادي. يجب أن ترجع الرد فقط على هيئة مصفوفة JSON (Raw JSON Array) صالحة برمجياً، حيث يمثل كل كائن (Object) درساً واحداً في هذه الدورة.
يجب أن يكون محتوى الدرس (content) مكتوباً بصيغة HTML منسقة وجميلة وجاهزة للعرض.
الهيكل الإجباري:
[
  {
    "title": "اسم الوحدة: اسم الدرس",
    "content": "<h1>أهداف الدرس</h1><p>...</p><h2>الأنشطة والواجبات</h2><p>...</p>"
  }
]`;

    } else if (type === "quiz") {
      systemInstruction = `أنت مصمم اختبارات خبير.
المصدر المعتمد:
${contextData}

المطلوب: إنشاء 5 أسئلة اختيار من متعدد حول: "${prompt}".
قواعد صارمة:
1. اللغة العربية الفصحى فقط.
2. لا تخرج عن المصدر.
3. أرجع الرد كـ JSON array فقط بدون أي كلمات أخرى.
الهيكل الإجباري:
[{"id": "q1", "question": "السؤال؟", "options": [{"id": "o1", "text": "خيار 1", "label": "أ"}], "correctIndex": 0, "explanation": "الشرح"}]`;

    } else {
      systemInstruction = `أنت خبير في صياغة المناهج الدراسية والأكاديمية.
المصدر المعتمد:
${contextData}

طلب المستخدم: "${prompt}"

تعليمات صارمة:
1. أنت مقيد 100% بالمعلومات الموجودة في المصدر المرفق فقط.
2. اكتب درساً تعليمياً شاملاً ومفصلاً باللغة العربية الفصحى.
3. قم بتنسيق الدرس بالكامل باستخدام وسوم HTML فقط (<h1>, <h2>, <p>, <ul>). لا تستخدم Markdown أبداً.
4. لا تقم بتغليف الرد بعلامات \`\`\`html. أرجع الكود مباشرة.`;
    }

    // =========================================================
    // 🌐 3. إرسال الطلب لـ Claude 3.5 Sonnet عبر OpenRouter
    // =========================================================
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openRouterApiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://ruhulqudus.net", // مطلوب لعمل OpenRouter بكفاءة
        "X-Title": "Ruhulqudus Academy"          // مطلوب لعمل OpenRouter بكفاءة
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-exp:free", // أو استخدم النموذج المجاني google/gemini-2.0-flash-exp:free
        messages: [{ role: "user", content: systemInstruction }],
        temperature: 0.2
      })
    });

    if (!response.ok) throw new Error("OpenRouter API Failed");

    const data = await response.json();
    let text = data.choices[0].message.content;

    // =========================================================
    // 🧹 4. تنظيف الـ JSON والـ HTML من شوائب الماركداون
    // =========================================================
    if (type === "quiz" || type === "curriculum") {
      text = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    } else {
      text = text.replace(/```html/gi, "").replace(/```/g, "").trim();
    }

    return NextResponse.json({ success: true, text });
  } catch (error: any) {
    console.error("AI Generation Error Detailed:", error);
    return NextResponse.json({ error: "Failed", details: error.message }, { status: 500 });
  }
}