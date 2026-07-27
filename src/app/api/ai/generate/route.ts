import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { verifyIdToken } from "@/lib/firebase/server";
import { sql } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await verifyIdToken(req);
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { prompt, type } = await req.json();
    if (!prompt) return NextResponse.json({ error: "Prompt is required" }, { status: 400 });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("مفتاح GEMINI_API_KEY غير موجود في إعدادات السيرفر!");
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    // =========================================================
    // 🔍 الجزء الأول: الـ RAG (استرجاع المعرفة من Neon)
    // =========================================================
    let contextData = "";
    
    try {
      const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
      const promptEmbedResult = await embeddingModel.embedContent(prompt);
      const promptVector = `[${promptEmbedResult.embedding.values.join(",")}]`;

      const relevantChunks = await sql`
        SELECT book_title, chunk_text 
        FROM knowledge_base 
        ORDER BY embedding <=> ${promptVector}::vector 
        LIMIT 3
      `;

      if (relevantChunks && relevantChunks.length > 0) {
        contextData = relevantChunks.map(c => `[من كتاب: ${c.book_title}]: ${c.chunk_text}`).join("\n\n");
      }
    } catch (dbError: any) {
      console.error("Vector Search Error:", dbError);
      // لن نوقف الكود لو فشل البحث، بل سنخبر Gemini ليعتمد على ذكائه
      contextData = `(ملاحظة للنظام: حدث خطأ في استرجاع الكتاب ${dbError.message}. أجب بناءً على معرفتك العامة فقط.)`;
    }

    // =========================================================
    // 🧠 الجزء الثاني: توليد الرد النهائي عبر Gemini
    // =========================================================
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    let systemInstruction = "";
    
    if (type === "quiz") {
      systemInstruction = `أنت خبير تعليمي. بناءً على هذا النص الحرفي من المناهج المعتمدة فقط:\n\n${contextData}\n\nقم بتوليد 3 أسئلة اختيار من متعدد باللغة الإنجليزية حول هذا الموضوع: "${prompt}". أرجع الرد كـ JSON array فقط بهذا الشكل الدقيق: [{"id": "q1", "question": "...", "options": [{"id": "o1", "text": "...", "label": "A"}], "correctIndex": 0, "explanation": "..."}]`;
    } else {
      systemInstruction = `أنت مساعد تعليمي خبير ومصمم مناهج (RAG System).
      طلب منك المستخدم الآتي: "${prompt}"
      
      استخدم هذه المعلومات الموثوقة المستخرجة من قاعدة البيانات الخاصة بنا للإجابة:
      ${contextData ? contextData : "لا توجد معلومات محددة في قاعدة البيانات، أجب بناءً على معرفتك الموثوقة."}
      
      يجب أن تكون إجابتك دقيقة، تعليمية، ومُنسقة باستخدام HTML فقط (بدون markdown) لتتناسب مع محرر نصوص غني (Rich Text Editor). لا تستخدم وسوم Markdown للـ HTML.`;
    }

    const result = await model.generateContent(systemInstruction);
    const text = result.response.text();

    return NextResponse.json({ success: true, text });

  } catch (error: any) {
    console.error("Gemini AI Error Detailed:", error);
    // إرسال الخطأ الحقيقي للمتصفح لنعرف ما هي المشكلة بالضبط!
    return NextResponse.json({ 
      error: "Failed to generate content", 
      details: error.message || String(error)
    }, { status: 500 });
  }
}