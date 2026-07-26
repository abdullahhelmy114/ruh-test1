import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { verifyIdToken } from "@/lib/firebase/server";
import { sql } from "@/lib/db/client";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  try {
    // 1. حماية الـ API (للأدمن فقط)
    const user = await verifyIdToken(req);
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { prompt, type } = await req.json();
    if (!prompt) return NextResponse.json({ error: "Prompt is required" }, { status: 400 });

    // =========================================================
    // 🔍 الجزء الأول: الـ RAG (استرجاع المعرفة من Neon)
    // =========================================================
    let contextData = "";
    
    try {
      // أ. تحويل سؤال المعلم إلى متجهات بنفس اللغة التي يستخدمها سيرفر بايثون
      const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-001" });
      const promptEmbedResult = await embeddingModel.embedContent(prompt);
      const promptVector = `[${promptEmbedResult.embedding.values.join(",")}]`;

      // ب. البحث في قاعدة بيانات Neon (أقرب 3 نصوص لسؤال المعلم)
      const relevantChunks = await sql`
        SELECT book_title, chunk_text 
        FROM knowledge_base 
        ORDER BY embedding <=> ${promptVector}::vector 
        LIMIT 3
      `;

      // ج. تجميع النصوص لتقديمها لـ Gemini
      if (relevantChunks && relevantChunks.length > 0) {
        contextData = relevantChunks.map(c => `[من كتاب: ${c.book_title}]: ${c.chunk_text}`).join("\n\n");
      }
    } catch (dbError) {
      console.error("Vector Search Error (Proceeding without RAG):", dbError);
      // إذا فشل البحث في قاعدة البيانات (لأي سبب)، سنستمر بدون السياق بدلاً من إيقاف النظام
    }

    // =========================================================
    // 🧠 الجزء الثاني: توليد الرد النهائي عبر Gemini
    // =========================================================
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    let systemInstruction = "";
    
    if (type === "quiz") {
      // تعليمات صارمة لتوليد الأسئلة بصيغة JSON المخصصة للمحرر الخاص بنا
      systemInstruction = `أنت خبير تعليمي. بناءً على هذا النص الحرفي من المناهج المعتمدة فقط:\n\n${contextData}\n\nقم بتوليد 3 أسئلة اختيار من متعدد باللغة الإنجليزية حول هذا الموضوع: "${prompt}". أرجع الرد كـ JSON array فقط بهذا الشكل الدقيق: [{"id": "q1", "question": "...", "options": [{"id": "o1", "text": "...", "label": "A"}], "correctIndex": 0, "explanation": "..."}]`;
    } else {
      // للمحرر العادي (صياغة، تلخيص، أو توليد درس كامل من كتاب)
      systemInstruction = `أنت مساعد تعليمي خبير ومصمم مناهج (RAG System).
      طلب منك المستخدم الآتي: "${prompt}"
      
      استخدم هذه المعلومات الموثوقة المستخرجة من قاعدة البيانات الخاصة بنا للإجابة:
      ${contextData ? contextData : "لا توجد معلومات محددة في قاعدة البيانات، أجب بناءً على معرفتك الموثوقة."}
      
      يجب أن تكون إجابتك دقيقة، تعليمية، ומنسقة باستخدام HTML فقط (بدون markdown) لتتناسب مع محرر نصوص غني (Rich Text Editor).`;
    }

    const result = await model.generateContent(systemInstruction);
    const text = result.response.text();

    return NextResponse.json({ success: true, text });
  } catch (error) {
    console.error("Gemini AI Error:", error);
    return NextResponse.json({ error: "Failed to generate content" }, { status: 500 });
  }
}