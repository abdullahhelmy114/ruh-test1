// 1. الخدعة الهندسية (Polyfill) لمنع انهيار Next.js أثناء الـ Build
if (typeof global.DOMMatrix === "undefined") {
  (global as any).DOMMatrix = class DOMMatrix {};
  (global as any).ImageData = class ImageData {};
  (global as any).Path2D = class Path2D {};
}

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { verifyIdToken } from "@/lib/firebase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// 2. إخبار Next.js أن هذا المسار ديناميكي لمنع البناء الثابت (Static Generation)
export const dynamic = "force-dynamic";

const pdfParse = require("pdf-parse");
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

    // 1. قراءة الـ PDF وتحويله لنص
    const buffer = Buffer.from(await file.arrayBuffer());
    const pdfData = await pdfParse(buffer);
    const fullText = pdfData.text;

    // 2. تقسيم الكتاب إلى "أجزاء" (Chunks) كل جزء 1000 حرف تقريباً ليسهل البحث فيه
    const chunks = fullText.match(/[\s\S]{1,1000}/g) || [];
    
    // 3. تحويل كل جزء إلى "متجه رياضي" (Embedding) وحفظه في Neon
    const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

    for (const chunk of chunks) {
      if (chunk.trim().length < 50) continue; // تخطي الأجزاء الفارغة

      const result = await embeddingModel.embedContent(chunk);
      const embedding = result.embedding.values; // مصفوفة من 768 رقم

      // إدخال النص والمتجه في الداتا بيز (يجب تحويل المصفوفة لنص ليفهمها pgvector)
      const embeddingString = `[${embedding.join(",")}]`;

      await sql`
        INSERT INTO knowledge_base (book_title, chunk_text, embedding)
        VALUES (${bookTitle}, ${chunk}, ${embeddingString}::vector)
      `;
    }

    return NextResponse.json({ success: true, message: `تمت إضافة الكتاب ومعالجة ${chunks.length} جزء بنجاح!` });

  } catch (error) {
    console.error("Upload Knowledge Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}