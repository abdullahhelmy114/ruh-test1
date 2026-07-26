import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { verifyIdToken } from "@/lib/firebase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
// استيراد المكتبة الجديدة (مخصصة للسيرفرات فقط)
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

    // =================================================================
    // 📖 قراءة الـ PDF بالطريقة النظيفة والحديثة (بدون أي Polyfills)
    // =================================================================
    try {
      const buffer = Buffer.from(await file.arrayBuffer());

      // تغليف العملية في Promise لتعمل بسلاسة مع (async/await)
      fullText = await new Promise((resolve, reject) => {
        const pdfParser = new PDFParser(null, true); // رقم 1 يعني: استخرج النصوص فقط (أسرع وأخف)
        
        pdfParser.on("pdfParser_dataError", (errData: any) => reject(errData.parserError));
        pdfParser.on("pdfParser_dataReady", () => {
          // جلب النص وفك تشفيره وتنظيفه من المسافات العشوائية
          const text = decodeURIComponent(pdfParser.getRawTextContent())
            .replace(/\r\n/g, " ")
            .replace(/\n/g, " ");
          resolve(text);
        });

        // بدء القراءة
        pdfParser.parseBuffer(buffer);
      });

    } catch (pdfError: any) {
      console.error("PDF2JSON Extraction Error:", pdfError);
      return NextResponse.json({ 
        error: `فشل قراءة الملف. السبب التقني: ${pdfError.message || String(pdfError)}` 
      }, { status: 400 });
    }

    if (!fullText || fullText.trim() === "") {
      return NextResponse.json({ error: "لم يتمكن النظام من استخراج نص. تأكد أن الـ PDF ليس مجرد صور (Scanned)." }, { status: 400 });
    }

    // =================================================================
    // 🧠 تحويل النص إلى متجهات (Vectors) وحفظه
    // =================================================================
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