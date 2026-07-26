import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { verifyIdToken } from "@/lib/firebase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  try {
    const user = await verifyIdToken(req);
    if (!user || user.role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { chunks, bookTitle } = await req.json();
    const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

    for (const chunk of chunks) {
      // 1. تحويل النص لمتجه
      const result = await embeddingModel.embedContent(chunk);
      const embeddingString = `[${result.embedding.values.join(",")}]`;

      // 2. الحفظ في الداتا بيز (إذا لم تكن أنشأت الجدول سينفجر الخطأ هنا وسنراه)
      await sql`
        INSERT INTO knowledge_base (book_title, chunk_text, embedding)
        VALUES (${bookTitle}, ${chunk}, ${embeddingString}::vector)
      `;

      // 3. 🛑 تأخير متعمد (1 ثانية) لحماية مفتاحك من حظر جوجل (Rate Limit)
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    // سيطبع الخطأ الحقيقي في اللوجز (هل هو داتا بيز أم جوجل؟)
    console.error("EMBEDDING ERROR DETAILED:", error.message || error);
    return NextResponse.json({ error: error.message || "فشل الحفظ في قاعدة البيانات" }, { status: 500 });
  }
}