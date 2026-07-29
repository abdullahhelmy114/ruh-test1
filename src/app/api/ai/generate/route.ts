import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/firebase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * استخراج النص من PDF عبر Gemini مع إعادة المحاولة عند تجاوز الحصة
 */
async function extractTextFromFileUri(fileUri: string, apiKey: string, retries = 3): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const result = await model.generateContent([
        {
          fileData: {
            mimeType: "application/pdf",
            fileUri: fileUri,
          },
        },
        {
          text: "استخرج كامل محتوى هذا الكتاب كنص تعليمي مفصل، مع إعادة صياغة الجمل بأسلوب تربوي واضح، مع الحفاظ على التسلسل الأصلي للموضوعات. لا تختصر، أخرج النص كاملاً.",
        },
      ]);
      return result.response.text();
    } catch (error: any) {
      if (error?.status === 429) {
        // تجاوز الحصة - انتظر المدة المطلوبة ثم أعد المحاولة
        const retryAfter = error?.errorDetails?.[2]?.retryDelay || "60s";
        const seconds = parseInt(retryAfter) || 60;
        console.warn(`Gemini rate limit hit, retrying in ${seconds}s...`);
        await new Promise((res) => setTimeout(res, seconds * 1000 + 1000));
        continue;
      }
      throw error;
    }
  }
  throw new Error("فشل استخراج النص بعد عدة محاولات");
}

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await verifyIdToken(req);
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json({ error: "يرجى رفع ملف PDF مباشرة" }, { status: 400 });
    }

    const formData = await req.formData();
    const level = formData.get("level") as string;
    const instructions = (formData.get("instructions") as string) || "";
    const pdfFile = formData.get("pdfFile") as File | null;

    if (!level || !pdfFile) {
      return NextResponse.json({ error: "يجب توفير المستوى ورفع ملف PDF" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY!;

    // رفع الملف إلى Gemini للحصول على fileUri
    const { GoogleAIFileManager } = require("@google/generative-ai/server");
    const fileManager = new GoogleAIFileManager(apiKey);
    
    const tempPath = `/tmp/${Date.now()}-${pdfFile.name}`;
    const buffer = Buffer.from(await pdfFile.arrayBuffer());
    require("fs").writeFileSync(tempPath, buffer);
    
    let fileUri: string;
    try {
      const uploadResult = await fileManager.uploadFile(tempPath, {
        mimeType: "application/pdf",
        displayName: pdfFile.name,
      });
      fileUri = uploadResult.file.uri;
    } finally {
      require("fs").unlinkSync(tempPath);
    }

    // استخراج النص (مع إعادة المحاولة)
    const bookText = await extractTextFromFileUri(fileUri, apiKey);

    if (!bookText || bookText.length < 100) {
      return NextResponse.json({ error: "النص المستخرج قصير جداً" }, { status: 500 });
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