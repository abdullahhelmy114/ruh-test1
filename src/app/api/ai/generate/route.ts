import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/firebase/server";
import { sql } from "@/lib/db/client";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

// تعطيل worker في بيئة Node (استخراج النص لا يحتاجه)
if (typeof window === "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "";
}

/**
 * استخراج النص من PDF باستخدام pdfjs-dist
 */
async function extractTextFromBuffer(buffer: Buffer): Promise<string> {
  const uint8 = new Uint8Array(buffer); // التحويل المطلوب
  const loadingTask = pdfjsLib.getDocument({ data: uint8 });
  const pdf = await loadingTask.promise;
  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(" ");
    fullText += pageText + "\n";
  }
  return fullText;
}

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await verifyIdToken(req);
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    let bookText = "";
    let level = "";
    let instructions = "";

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      level = formData.get("level") as string;
      instructions = (formData.get("instructions") as string) || "";
      const pdfFile = formData.get("pdfFile") as File | null;
      const bookTitle = formData.get("bookTitle") as string | null;

      if (!level) {
        return NextResponse.json({ error: "يجب توفير المستوى التعليمي" }, { status: 400 });
      }

      if (pdfFile) {
        const buffer = Buffer.from(await pdfFile.arrayBuffer());
        bookText = await extractTextFromBuffer(buffer);
      } else if (bookTitle) {
        bookText = await getTextFromStoredBook(bookTitle);
      } else {
        return NextResponse.json({ error: "يجب رفع ملف PDF أو اختيار كتاب" }, { status: 400 });
      }
    } else {
      // JSON (للتوافق مع الكود القديم)
      const body = await req.json();
      const { bookTitle, level: jsonLevel, instructions: jsonInstructions } = body;
      if (!bookTitle || !jsonLevel) {
        return NextResponse.json({ error: "يجب إرسال bookTitle و level" }, { status: 400 });
      }
      level = jsonLevel;
      instructions = jsonInstructions || "";
      bookText = await getTextFromStoredBook(bookTitle);
    }

    if (!bookText || bookText.length < 100) {
      return NextResponse.json({ error: "النص المستخرج قصير جداً أو فارغ" }, { status: 500 });
    }

    // إرسال النص إلى خدمة بايثون
    const pythonServiceUrl = process.env.PYTHON_AI_SERVICE_URL || "https://ai.ruhulqudus.net";
    const pythonResponse = await fetch(`${pythonServiceUrl}/generate-curriculum`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ book_text: bookText, level, instructions }),
    });

    if (!pythonResponse.ok) {
      const errData = await pythonResponse.json().catch(() => null);
      throw new Error(errData?.detail || "فشل الاتصال بخدمة Python");
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

/**
 * دالة مساعدة لتحميل كتاب من Gemini File API واستخراج النص
 */
async function getTextFromStoredBook(bookTitle: string): Promise<string> {
  const books = await sql`
    SELECT file_uri FROM gemini_books WHERE title = ${bookTitle} LIMIT 1
  `;
  if (!books || books.length === 0) {
    throw new Error("الكتاب غير موجود في قاعدة المعرفة");
  }
  const fileUri: string = books[0].file_uri;
  // استخراج اسم الملف من الرابط (مثال: https://.../files/XYZ)
  const fileName = fileUri.split("/").pop();
  if (!fileName) throw new Error("اسم الملف غير صالح");

  const apiKey = process.env.GEMINI_API_KEY!;
  const downloadUrl = `https://generativelanguage.googleapis.com/v1beta/files/${fileName}?key=${apiKey}&alt=media`;

  const res = await fetch(downloadUrl);
  if (!res.ok) {
    throw new Error(`فشل تنزيل الكتاب من Gemini (${res.status})`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  return extractTextFromBuffer(buffer);
}