import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/firebase/server";
import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from "@google/generative-ai";
import { sql } from "@/lib/db/client";

export const dynamic = "force-dynamic";

// تعطيل جميع فلاتر الأمان لمنع حظر المحتوى التعليمي
const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
];

async function extractTextFromFileUri(fileUri: string, apiKey: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash", safetySettings });

  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          {
            fileData: {
              mimeType: "application/pdf",
              fileUri: fileUri,
            },
          },
          {
            text: "استخرج كامل محتوى هذا الكتاب في شكل نص تعليمي مفصل، مع إعادة صياغة الجمل بأسلوب تربوي واضح دون نسخ حرفي، للحفاظ على التسلسل الأصلي للموضوعات.",
          },
        ],
      },
    ],
  });

  const response = result.response;
  return response.text();
}

async function uploadToGemini(buffer: Buffer, fileName: string, apiKey: string): Promise<string> {
  const { GoogleAIFileManager } = require("@google/generative-ai/server");
  const fileManager = new GoogleAIFileManager(apiKey);
  
  // حفظ مؤقت لرفع الملف
  const tempPath = `/tmp/${Date.now()}-${fileName}`;
  require("fs").writeFileSync(tempPath, buffer);
  
  const uploadResult = await fileManager.uploadFile(tempPath, {
    mimeType: "application/pdf",
    displayName: fileName,
  });
  
  // حذف الملف المؤقت
  require("fs").unlinkSync(tempPath);
  
  return uploadResult.file.uri;
}

export async function POST(req: NextRequest) {
  try {
    const user = await verifyIdToken(req);
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const contentType = req.headers.get("content-type") || "";
    let bookText = "";
    let level = "";
    let instructions = "";

    const apiKey = process.env.GEMINI_API_KEY!;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      level = formData.get("level") as string;
      instructions = (formData.get("instructions") as string) || "";
      const pdfFile = formData.get("pdfFile") as File | null;
      const bookTitle = formData.get("bookTitle") as string | null;

      if (!level) {
        return NextResponse.json({ error: "يجب توفير المستوى التعليمي" }, { status: 400 });
      }

      let fileUri: string | null = null;

      if (pdfFile) {
        // رفع الملف إلى Gemini للحصول على fileUri
        const buffer = Buffer.from(await pdfFile.arrayBuffer());
        fileUri = await uploadToGemini(buffer, pdfFile.name, apiKey);
      } else if (bookTitle) {
        // جلب fileUri من قاعدة البيانات
        const books = await sql`
          SELECT file_uri FROM gemini_books WHERE title = ${bookTitle} LIMIT 1
        `;
        if (!books || books.length === 0) {
          return NextResponse.json({ error: "الكتاب غير موجود" }, { status: 404 });
        }
        fileUri = books[0].file_uri;
      } else {
        return NextResponse.json({ error: "يجب رفع ملف PDF أو اختيار كتاب" }, { status: 400 });
      }

      // استخراج النص عبر Gemini (بدون مشاكل worker)
      bookText = await extractTextFromFileUri(fileUri!, apiKey);
    } else {
      return NextResponse.json({ error: "يرجى رفع ملف PDF مباشرة أو استخدام واجهة API المحدثة" }, { status: 400 });
    }

    if (!bookText || bookText.length < 100) {
      return NextResponse.json({ error: "النص المستخرج قصير جداً" }, { status: 500 });
    }

    // 5. إرسال النص إلى خدمة بايثون
    const pythonServiceUrl = process.env.PYTHON_AI_SERVICE_URL || "https://ai.ruhulqudus.net";
    const pythonResponse = await fetch(`${pythonServiceUrl}/generate-curriculum`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ book_text: bookText, level, instructions }),
    });

    if (!pythonResponse.ok) {
      const errData = await pythonResponse.json().catch(() => null);
      throw new Error(errData?.detail || "فشل الاتصال بخدمة بايثون");
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