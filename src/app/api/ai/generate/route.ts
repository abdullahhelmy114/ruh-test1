import { NextRequest, NextResponse } from "next/server";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import { verifyIdToken } from "@/lib/firebase/server";
import { sql } from "@/lib/db/client";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // 1. التحقق من الصلاحية (أدمن فقط)
    const user = await verifyIdToken(req);
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    // 2. استلام البيانات من CurriculumModal
    const { bookTitle, level, instructions } = await req.json();
    if (!bookTitle || !level) {
      return NextResponse.json(
        { error: "يجب إرسال bookTitle و level" },
        { status: 400 }
      );
    }

    // 3. جلب file_uri من قاعدة البيانات
    const books = await sql`
      SELECT file_uri FROM gemini_books WHERE title = ${bookTitle} LIMIT 1
    `;
    if (!books || books.length === 0) {
      return NextResponse.json(
        { error: "الكتاب غير موجود في قاعدة المعرفة" },
        { status: 404 }
      );
    }
    const fileUri: string = books[0].file_uri;

    // 4. استخراج النص الكامل من PDF محليًا (بدون استهلاك حصة Gemini)
    const apiKey = process.env.GEMINI_API_KEY!;

    // استخراج اسم الملف من الرابط الكامل
    const fileName = fileUri.split("/").pop();
    if (!fileName) throw new Error("اسم الملف غير صالح");

    const fileManager = new GoogleAIFileManager(apiKey);

    // جلب معلومات الملف لمعرفة رابط التحميل الصحيح
    const fileInfo = await fileManager.getFile(`files/${fileName}`);
    if (!fileInfo || !fileInfo.uri) {
      throw new Error("الملف غير موجود في Gemini File API");
    }

    // تنزيل الملف إلى مجلد مؤقت
    const tempDir = path.join(process.cwd(), "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const tempFilePath = path.join(tempDir, `${Date.now()}.pdf`);

    let bookText = "";
    try {
      // تنزيل الملف عبر الرابط المسترجع مع مفتاح API
      const downloadResponse = await fetch(fileInfo.uri, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!downloadResponse.ok) {
        throw new Error(`فشل تنزيل الملف (${downloadResponse.status})`);
      }

      const buffer = Buffer.from(await downloadResponse.arrayBuffer());

      // استخراج النص باستخدام pdf-parse
      // @ts-ignore – مكتبة pdf-parse لا تملك تعريفات TypeScript حديثة
      const pdfParse = require("pdf-parse");
      const pdfData = await pdfParse(buffer);
      bookText = pdfData.text;

      if (!bookText || bookText.length < 100) {
        throw new Error("النص المستخرج قصير جداً أو فارغ");
      }
    } finally {
      // تنظيف الملف المؤقت
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    }

    // 5. إرسال النص إلى خدمة وكلاء بايثون لتوليد المنهج
    const pythonServiceUrl =
      process.env.PYTHON_AI_SERVICE_URL || "https://ai.ruhulqudus.net";

    const pythonResponse = await fetch(
      `${pythonServiceUrl}/generate-curriculum`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          book_text: bookText,
          level: level,
          instructions: instructions || "",
        }),
      }
    );

    if (!pythonResponse.ok) {
      const errData = await pythonResponse.json().catch(() => null);
      throw new Error(
        errData?.detail || "فشل الاتصال بخدمة توليد المنهج (Python)"
      );
    }

    const curriculumData = await pythonResponse.json();

    // 6. إرجاع المنهج النهائي للواجهة الأمامية
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