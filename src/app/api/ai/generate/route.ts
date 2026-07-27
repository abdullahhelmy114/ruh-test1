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
    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("مفتاح GEMINI_API_KEY غير موجود!");

    const genAI = new GoogleGenerativeAI(apiKey);

    // =========================================================
    // 🔍 المرحلة الأولى: سحب صفحات الكتاب من الداتا بيز
    // =========================================================
    let contextData = "";
    
    try {
      const embeddingModel = genAI.getGenerativeModel({ model: "embedding-001" });
      const promptEmbedResult = await embeddingModel.embedContent(prompt);
      const promptVector = `[${promptEmbedResult.embedding.values.join(",")}]`;

      // 🚀 تم زيادة الـ LIMIT إلى 8 لجلب صفحات أكثر من الكتاب ليكون الدرس دسماً وشاملاً
      const relevantChunks = await sql`
        SELECT book_title, chunk_text 
        FROM knowledge_base 
        ORDER BY embedding <=> ${promptVector}::vector 
        LIMIT 8
      `;

      if (relevantChunks && relevantChunks.length > 0) {
        contextData = relevantChunks.map(c => `[نص من كتاب: ${c.book_title}]:\n${c.chunk_text}`).join("\n\n---\n\n");
      }
    } catch (dbError: any) {
      console.warn("Vector Search Bypassed:", dbError.message);
    }

    // =========================================================
    // 🧠 المرحلة الثانية: الأوامر الصارمة لـ Gemini
    // =========================================================
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    let finalPrompt = "";
    
    if (type === "quiz") {
      finalPrompt = `أنت مصمم اختبارات تعليمية خبير.
      
المصدر الوحيد والمعتمد (من الكتاب):
${contextData}

المطلوب:
بناءً على الموضوع التالي: "${prompt}" ومن خلال المصدر المرفق أعلاه حصراً، قم بإنشاء 5 أسئلة اختيار من متعدد.

قواعد صارمة جداً لا تكسرها:
1. الأسئلة والخيارات والشرح يجب أن تكون جميعها باللغة العربية الفصحى 100%. (يُمنع استخدام الإنجليزية).
2. لا تضف أي معلومة من خارج المصدر المرفق.
3. أرجع الرد كـ JSON array فقط بدون أي نصوص إضافية أو علامات (مثل \`\`\`json).
4. الهيكل المطلوب حرفياً:
[
  {
    "id": "q1",
    "question": "نص السؤال هنا؟",
    "options": [
      {"id": "o1", "text": "الخيار الأول", "label": "أ"},
      {"id": "o2", "text": "الخيار الثاني", "label": "ب"}
    ],
    "correctIndex": 0,
    "explanation": "شرح سبب الإجابة الصحيحة مستخرج من الكتاب."
  }
]`;
    } else {
      finalPrompt = `أنت خبير في صياغة المناهج الدراسية والأكاديمية.

المصدر الوحيد والمعتمد (من الكتاب المرفوع):
${contextData}

طلب المستخدم:
"${prompt}"

تعليمات صارمة جداً (إجباري الالتزام بها):
1. أنت مقيد 100% بالمعلومات الموجودة في "المصدر الوحيد" أعلاه. يُمنع منعاً باتاً تأليف أي معلومة أو جلب أمثلة من خارج هذا الكتاب.
2. اكتب "درساً تعليمياً شاملاً ومفصلاً جداً" باللغة العربية الفصحى فقط لا غير (يُمنع استخدام أي كلمات أو مصطلحات إنجليزية).
3. يجب أن يكون بناء الدرس منهجياً ويحتوي على:
   - عنوان رئيسي يعبر عن الدرس.
   - مقدمة تمهيدية مشوقة للطالب.
   - شرح عميق ومفصل مقسم إلى فقرات متسلسلة (استناداً للنص المرفق).
   - ذكر الأمثلة أو الأدلة الموجودة في الكتاب نصاً.
   - خاتمة تلخص أهم ما جاء في الدرس.
4. قم بتنسيق الدرس بالكامل باستخدام وسوم HTML فقط ليكون جاهزاً للعرض (استخدم <h1> للعناوين الكبرى, <h2> للعناوين الفرعية, <p> للفقرات, <strong> للكلمات المهمة، <ul> للقوائم).
5. لا تستخدم أسلوب Markdown إطلاقاً (لا تستخدم ** أو ##).
6. إذا كان "المصدر" فارغاً أو لا يحتوي على معلومات كافية، اكتب فقط: "عذراً، لم أجد معلومات كافية في الكتاب المرفق لتوليد هذا الدرس." ولا تقم بالتأليف أبداً.`;
    }

    const result = await model.generateContent(finalPrompt);
    let text = result.response.text();

    if (type === "quiz") {
      text = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    }

    return NextResponse.json({ success: true, text });

  } catch (error: any) {
    console.error("Gemini AI Final Error Detailed:", error);
    return NextResponse.json({ 
      error: "Failed to generate content", 
      details: error.message || String(error)
    }, { status: 500 });
  }
}