import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { verifyIdToken } from "@/lib/firebase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await verifyIdToken(req);
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // =========================================================
    // 🛠️ الخدعة الهندسية والاستدعاء داخل الدالة
    // هذا يضمن 100% نجاح الـ Build لأنه لن يعمل إلا وقت الرفع الفعلي
    // =========================================================
    if (typeof globalThis.DOMMatrix === "undefined") {
      (globalThis as any).DOMMatrix = class DOMMatrix {};
      (globalThis as any).ImageData = class ImageData {};
      (globalThis as any).Path2D = class Path2D {};
    }
    const pdfParse = require("pdf-parse");
    // =========================================================

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const bookTitle = formData.get("book_title") as string;

    if (!file || !bookTitle) {
      return NextResponse.json({ error: "البيانات غير مكتملة" }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      throw new Error("مفتاح Gemini API مفقود في إعدادات السيرفر!");
    }

    // قراءة الـ PDF
    const buffer = Buffer.from(await file.arrayBuffer());
    const pdfData = await pdfParse(buffer);
    const fullText = pdfData.text;

    if (!fullText) {
      throw new Error("لم يتمكن النظام من استخراج النص من هذا الملف، تأكد أنه ملف نصي وليس مجرد صور ممسوحة ضوئياً.");
    }

    // تقسيم الكتاب
    const chunks = fullText.match(/[\s\S]{1,1000}/g) || [];
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

    let processedChunks = 0;

    for (const chunk of chunks) {
      if (chunk.trim().length < 50) continue;

      const result = await embeddingModel.embedContent(chunk);
      const embedding = result.embedding.values; 

      const embeddingString = `[${embedding.join(",")}]`;

      await sql`
        INSERT INTO knowledge_base (book_title, chunk_text, embedding)
        VALUES (${bookTitle}, ${chunk}, ${embeddingString}::vector)
      `;
      processedChunks++;
    }

    return NextResponse.json({ success: true, message: `تمت إضافة الكتاب ومعالجة ${processedChunks} جزء بنجاح!` });

  } catch (error: any) {
    console.error("🔥 الخطأ الحقيقي:", error);
    // إرجاع الخطأ الحقيقي للمتصفح لكي نراه في الإشعار الأحمر!
    return NextResponse.json({ 
      error: error.message || "حدث خطأ غير معروف في السيرفر" 
    }, { status: 500 });
  }
}