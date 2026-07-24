// 1. الخدعة الهندسية (Polyfill) في أعلى الملف لتعمل قبل أي شيء
if (typeof globalThis.DOMMatrix === "undefined") {
  (globalThis as any).DOMMatrix = class DOMMatrix {};
  (globalThis as any).ImageData = class ImageData {};
  (globalThis as any).Path2D = class Path2D {};
}

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { verifyIdToken } from "@/lib/firebase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = "force-dynamic";

// =================================================================
// 🛠️ الحل الجذري لمشكلة "l is not a function" (ESM/CJS Interop)
// =================================================================
const pdfParseModule = require("pdf-parse");
// استخراج الدالة بشكل آمن مهما كان نوع الضغط الذي يفعله Next.js
const pdfParse = typeof pdfParseModule === "function" ? pdfParseModule : pdfParseModule.default;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  try {
    const user = await verifyIdToken(req);
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const bookTitle = formData.get("book_title") as string;

    if (!file || !bookTitle) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    let fullText = "";

    // 2. عزل عملية قراءة الـ PDF لضمان عدم انهيار السيرفر
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const pdfData = await pdfParse(buffer);
      fullText = pdfData.text;
    } catch (pdfError: any) {
      console.error("PDF Extraction Error:", pdfError);
      return NextResponse.json({ error: "فشل استخراج النص من ملف الـ PDF. تأكد أن الملف سليم." }, { status: 400 });
    }

    if (!fullText || fullText.trim() === "") {
      return NextResponse.json({ error: "لم يتمكن النظام من استخراج نص. تأكد أن الـ PDF ليس مجرد صور (Scanned)." }, { status: 400 });
    }

    // 3. تقسيم الكتاب إلى "أجزاء" (Chunks) كل جزء 1000 حرف تقريباً
    const chunks = fullText.match(/[\s\S]{1,1000}/g) || [];
    
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
    console.error("Upload Knowledge Error Detailed:", error);
    return NextResponse.json({ 
      error: error.message || "حدث خطأ غير معروف في السيرفر" 
    }, { status: 500 });
  }
}