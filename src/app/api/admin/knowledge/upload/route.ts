// 1. الخدعة الهندسية (Polyfill) في أعلى الملف لتعمل قبل أي شيء وتمنع انهيار البناء (Build)
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

    // =================================================================
    // 2. عزل عملية قراءة الـ PDF لمعرفة السبب بدقة وحل مشكلة l is not a function
    // =================================================================
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      
      // استخراج دالة الـ PDF بشكل صارم جداً (مهما كان نوع الضغط الذي طبقه Next.js)
      const pdfParseModule = require("pdf-parse");
      const pdfParse = typeof pdfParseModule === "function" 
        ? pdfParseModule 
        : (pdfParseModule.default || Object.values(pdfParseModule).find(v => typeof v === 'function'));

      if (typeof pdfParse !== "function") {
        return NextResponse.json({ 
          error: `المكتبة لم تُحمّل كدالة. نوعها الحالي: ${typeof pdfParseModule}` 
        }, { status: 400 });
      }

      const pdfData = await pdfParse(buffer);
      fullText = pdfData.text;
    } catch (pdfError: any) {
      console.error("PDF Extraction Error Detailed:", pdfError);
      return NextResponse.json({ 
        // سيتم طباعة السبب التقني الحقيقي للواجهة إذا فشل قراءة الملف
        error: `فشل قراءة الملف. السبب التقني: ${pdfError.message || String(pdfError)}` 
      }, { status: 400 });
    }

    if (!fullText || fullText.trim() === "") {
      return NextResponse.json({ error: "لم يتمكن النظام من استخراج نص. تأكد أن الـ PDF ليس مجرد صور (Scanned)." }, { status: 400 });
    }

    // =================================================================
    // 3. معالجة النص، تقسيمه، وحفظه كـ Vectors
    // =================================================================
    
    // تقسيم الكتاب إلى "أجزاء" (Chunks) كل جزء 1000 حرف تقريباً ليسهل البحث فيه بدقة
    const chunks = fullText.match(/[\s\S]{1,1000}/g) || [];
    
    // استخدام نموذج التضمين الخاص بجوجل
    const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

    let processedChunks = 0;

    for (const chunk of chunks) {
      if (chunk.trim().length < 50) continue; // تخطي الأجزاء الفارغة والقصيرة جداً

      // تحويل النص إلى متجهات رياضية
      const result = await embeddingModel.embedContent(chunk);
      const embedding = result.embedding.values; // مصفوفة من الأرقام
      
      // تحويل المصفوفة إلى نص حتى يفهمها محرك pgvector في قاعدة البيانات
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