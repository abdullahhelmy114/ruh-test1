// 1. الخدعة الهندسية (Polyfill) في أعلى الملف لتعمل قبل أي شيء
if (typeof globalThis.DOMMatrix === "undefined") {
  (globalThis as any).DOMMatrix = function() {};
  (globalThis as any).ImageData = function() {};
  (globalThis as any).Path2D = function() {};
}

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { verifyIdToken } from "@/lib/firebase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// @ts-ignore: تجاهل خطأ التعريفات لهذه المكتبة
import PDFParser from "pdf2json";

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

    // 2. قراءة الـ PDF بشكل سريع
    try {
      const buffer = Buffer.from(await file.arrayBuffer());

      fullText = await new Promise((resolve, reject) => {
        const pdfParser = new PDFParser(null, true);
        
        pdfParser.on("pdfParser_dataError", (errData: any) => reject(errData.parserError));
        pdfParser.on("pdfParser_dataReady", () => {
          const text = decodeURIComponent(pdfParser.getRawTextContent())
            .replace(/\r\n/g, " ")
            .replace(/\n/g, " ");
          resolve(text);
        });

        pdfParser.parseBuffer(buffer);
      });

    } catch (pdfError: any) {
      console.error("PDF2JSON Extraction Error:", pdfError);
      return NextResponse.json({ 
        error: `فشل قراءة الملف. السبب التقني: ${pdfError.message || String(pdfError)}` 
      }, { status: 400 });
    }

    if (!fullText || fullText.trim() === "") {
      return NextResponse.json({ error: "لم يتمكن النظام من استخراج نص. تأكد أن الـ PDF ليس مجرد صور." }, { status: 400 });
    }

    const chunks = fullText.match(/[\s\S]{1,1000}/g) || [];

    // =================================================================
    // 🚀 3. تشغيل المعالجة في الخلفية (بدون await)
    // =================================================================
    processAndStoreEmbeddings(chunks, bookTitle).catch(console.error);

    // =================================================================
    // ⚡ 4. الرد فوراً على Cloudflare لمنع خطأ 524
    // =================================================================
    return NextResponse.json({ 
      success: true, 
      message: `تم استلام الكتاب بنجاح! جاري معالجة وحفظ ${chunks.length} جزء في الخلفية. يمكنك ترك هذه الصفحة الآن وسيتم إضافته للمكتبة تلقائياً.` 
    });

  } catch (error: any) {
    console.error("Upload Knowledge Error Detailed:", error);
    return NextResponse.json({ 
      error: error.message || "حدث خطأ غير معروف في السيرفر" 
    }, { status: 500 });
  }
}

// =================================================================
// 🧠 دالة المعالجة في الخلفية (Background Task)
// =================================================================
async function processAndStoreEmbeddings(chunks: string[], bookTitle: string) {
  console.log(`[RAG System] بدء معالجة كتاب: ${bookTitle} (${chunks.length} جزء)`);
  
  const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
  let processed = 0;

  for (const chunk of chunks) {
    if (chunk.trim().length < 50) continue;

    try {
      const result = await embeddingModel.embedContent(chunk);
      const embedding = result.embedding.values; 
      const embeddingString = `[${embedding.join(",")}]`;

      await sql`
        INSERT INTO knowledge_base (book_title, chunk_text, embedding)
        VALUES (${bookTitle}, ${chunk}, ${embeddingString}::vector)
      `;
      processed++;
      
      // تأخير بسيط جداً (نصف ثانية) لحماية سيرفرك من الضغط ولمنع حظر Gemini (Rate Limit)
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (e) {
      console.error("Error processing chunk:", e);
    }
  }
  
  console.log(`[RAG System] تم الانتهاء من معالجة وحفظ كتاب: ${bookTitle}. الأجزاء المكتملة: ${processed}`);
}