import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/firebase/server";
import { sql } from "@/lib/db/client";
import pdfParse from "pdf-parse"; // استيراد مباشر (قد تحتاج ts-ignore)

export const dynamic = "force-dynamic";

// دالة مساعدة لاستخراج النص من PDF (سواء من ملف مباشر أو من رابط Gemini)
async function extractTextFromBuffer(buffer: Buffer): Promise<string> {
  // @ts-ignore – pdf-parse قد لا يملك تعريفات TypeScript متوافقة
  const pdfParse = require("pdf-parse");
  const data = await pdfParse(buffer);
  return data.text;
}

export async function POST(req: NextRequest) {
  try {
    // 1. التحقق من الصلاحية (أدمن فقط)
    const user = await verifyIdToken(req);
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    let bookText = "";
    let level = "";
    let instructions = "";

    // 2. تحديد نوع المحتوى واستقبال البيانات
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      // --- حالة رفع ملف PDF أو إرسال FormData من الواجهة ---
      const formData = await req.formData();
      level = formData.get("level") as string;
      instructions = (formData.get("instructions") as string) || "";
      const pdfFile = formData.get("pdfFile") as File | null;
      const bookTitle = formData.get("bookTitle") as string | null;

      if (!level) {
        return NextResponse.json({ error: "يجب توفير المستوى التعليمي" }, { status: 400 });
      }

      if (pdfFile) {
        // قراءة الملف المرفوع مباشرة
        const buffer = Buffer.from(await pdfFile.arrayBuffer());
        bookText = await extractTextFromBuffer(buffer);
      } else if (bookTitle) {
        // جلب الكتاب من Gemini File API بنفس الآلية السابقة
        const books = await sql`
          SELECT file_uri FROM gemini_books WHERE title = ${bookTitle} LIMIT 1
        `;
        if (!books || books.length === 0) {
          return NextResponse.json({ error: "الكتاب غير موجود في قاعدة المعرفة" }, { status: 404 });
        }
        const fileUri = books[0].file_uri;
        const fileName = fileUri.split("/").pop();
        if (!fileName) throw new Error("اسم الملف غير صالح");

        const apiKey = process.env.GEMINI_API_KEY!;
        const downloadUrl = `https://generativelanguage.googleapis.com/v1beta/files/${fileName}?key=${apiKey}&alt=media`;
        const res = await fetch(downloadUrl);
        if (!res.ok) throw new Error(`فشل تنزيل الكتاب من Gemini (${res.status})`);
        const buffer = Buffer.from(await res.arrayBuffer());
        bookText = await extractTextFromBuffer(buffer);
      } else {
        return NextResponse.json({ error: "يجب رفع ملف PDF أو اختيار كتاب" }, { status: 400 });
      }
    } else {
      // --- حالة JSON (للتوافق مع الكود القديم إن وُجد) ---
      const body = await req.json();
      const { bookTitle, level: jsonLevel, instructions: jsonInstructions } = body;
      if (!bookTitle || !jsonLevel) {
        return NextResponse.json({ error: "يجب إرسال bookTitle و level" }, { status: 400 });
      }
      level = jsonLevel;
      instructions = jsonInstructions || "";

      const books = await sql`
        SELECT file_uri FROM gemini_books WHERE title = ${bookTitle} LIMIT 1
      `;
      if (!books || books.length === 0) {
        return NextResponse.json({ error: "الكتاب غير موجود" }, { status: 404 });
      }
      const fileUri = books[0].file_uri;
      const fileName = fileUri.split("/").pop();
      if (!fileName) throw new Error("اسم الملف غير صالح");

      const apiKey = process.env.GEMINI_API_KEY!;
      const downloadUrl = `https://generativelanguage.googleapis.com/v1beta/files/${fileName}?key=${apiKey}&alt=media`;
      const res = await fetch(downloadUrl);
      if (!res.ok) throw new Error("فشل تنزيل الكتاب من Gemini");
      const buffer = Buffer.from(await res.arrayBuffer());
      bookText = await extractTextFromBuffer(buffer);
    }

    if (!bookText || bookText.length < 100) {
      return NextResponse.json({ error: "النص المستخرج قصير جداً أو فارغ" }, { status: 500 });
    }

    // 3. إرسال النص إلى خدمة بايثون (وكلاء OpenRouter)
    const pythonServiceUrl = process.env.PYTHON_AI_SERVICE_URL || "https://ai.ruhulqudus.net";
    const pythonResponse = await fetch(`${pythonServiceUrl}/generate-curriculum`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        book_text: bookText,
        level: level,
        instructions: instructions,
      }),
    });

    if (!pythonResponse.ok) {
      const errData = await pythonResponse.json().catch(() => null);
      throw new Error(errData?.detail || "فشل الاتصال بخدمة توليد المنهج (Python)");
    }

    const curriculumData = await pythonResponse.json();
    return NextResponse.json({
      success: true,
      markdown: curriculumData.markdown,
      titles: curriculumData.titles,
    });
  } catch (error: any) {
    console.error("Curriculum Generation Error:", error);
    return NextResponse.json(
      { error: "فشل في توليد المنهج", details: error.message },
      { status: 500 }
    );
  }
}